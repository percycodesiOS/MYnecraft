import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(await fs.readFile(new URL('../hardcore-rules.js', import.meta.url), 'utf8'), context);
const H = context.MYNE_HARDCORE;
const json = value => JSON.parse(JSON.stringify(value));
function world() {
  const blocks = {}, edits = {};
  return { blocks, edits, getBlock: (x,y,z) => blocks[`${x},${y},${z}`] || null, put(x,y,z,type,own=true) { blocks[`${x},${y},${z}`]=type; if(own)edits[`${x},${y},${z}`]=type; } };
}
function house(w, own=true) {
  for(let x=0;x<5;x++)for(let z=0;z<5;z++){
    w.put(x,0,z,'planks',own);w.put(x,4,z,'planks',own);
    if(x===0||x===4||z===0||z===4)for(let y=1;y<=3;y++)if(!(x===2&&z===0&&y<3))w.put(x,y,z,'planks',own);
  }
}
function pond(w, own=true) {
  for(let x=10;x<12;x++)for(let z=10;z<12;z++){w.put(x,0,z,'stone',own);w.put(x,1,z,'water',own);}
  for(let n=10;n<12;n++)for(const [x,z] of [[9,n],[12,n],[n,9],[n,12]])w.put(x,1,z,'glass',own);
}
function starter(){let s=H.normalize();s.tools.axe=true;s.tools.pick=true;s.collected.wood=10;s.collected.stone=8;return H.advance(s,{}).state;}
test('legacy/default normalization ignores forged unlocks, invalid counters, and skipped rewards',()=>{
  const s=H.normalize({tools:{axe:'yes'},collected:{wood:Infinity,stone:-3,dirt:1e10},completed:['habitat'],unlocks:{characters:['mcmichael'],animals:['fish']}});
  assert.equal(s.tools.axe,false);assert.equal(s.collected.wood,0);assert.equal(s.collected.dirt,1000000);
  assert.deepEqual(json(s.completed),[]);assert.deepEqual(json(s.unlocks.characters),['macek']);assert(!s.unlocks.animals.includes('fish'));
  assert.equal(H.normalize(null).version,1);
});
test('crafting conserves inventory, needs the recipe, and does not mutate callers',()=>{
  const s=H.normalize(),inv={wood:12,sand:10,stone:10};
  assert(!H.craft(s,inv,'concrete').ok);assert(!H.craft(s,inv,'missing').ok);assert(!H.craft(s,inv,'toString').ok);
  const axe=H.craft(s,inv,'axe');assert(axe.ok);assert.equal(axe.inventory.wood,9);assert.equal(inv.wood,12);assert(!s.tools.axe);
  assert(!H.craft(axe.state,axe.inventory,'axe').ok);
  const planks=H.craft(axe.state,axe.inventory,'planks');assert.equal(planks.inventory.planks,4);assert.equal(planks.inventory.wood,8);
  const pick=H.craft(planks.state,planks.inventory,'pick');assert(pick.ok);assert.equal(pick.inventory.wood,6);assert.equal(pick.inventory.planks,2);
  assert(H.canMine(pick.state,'stone'));assert(!H.canMine(s,'stone'));assert(!H.canMine(s,'ironore'));
});
test('natural gathering does not count recycling player blocks; steps unlock in order',()=>{
  let s=H.normalize();s.tools.axe=true;
  s=H.recordMine(s,'wood',{natural:false});assert.equal(s.collected.wood,0);
  for(let i=0;i<10;i++)s=H.recordMine(s,'wood',{natural:true});
  let update=H.advance(s,{});assert.deepEqual(json(update.newlyCompleted),['wood']);assert.equal(update.rewards[0].character,'micco');
  s=update.state;assert(H.canUseBlock(s,'cherrywood'));assert(!H.canUseBlock(s,'glass'));
  s.tools.pick=true;for(let i=0;i<8;i++)s=H.recordMine(s,'stone',{natural:true});
  update=H.advance(s,{});assert.deepEqual(json(update.state.completed),['wood','stone']);assert(H.canMine(update.state,'copperore'));
  assert.deepEqual(json(H.advance(update.state,{}).rewards),[]);
});
test('house needs an actual player-built floor, walls, roof, door, and usable interior',()=>{
  const w=world();house(w);assert(H.inspectHouse(w.getBlock,w.edits).valid);assert(H.inspectHouse(w.getBlock,new Map(Object.entries(w.edits))).valid);
  const natural=world();house(natural,false);assert(!H.inspectHouse(natural.getBlock,natural.edits).valid);
  w.put(1,4,1,null);assert(!H.inspectHouse(w.getBlock,w.edits).valid);w.put(1,4,1,'planks');
  w.put(2,1,0,'stone');assert(!H.inspectHouse(w.getBlock,w.edits).valid);w.put(2,1,0,null);
  w.put(2,1,2,'stone');assert(!H.inspectHouse(w.getBlock,w.edits).valid);w.put(2,1,2,null);
  const update=H.advance(starter(),w);assert.deepEqual(json(update.newlyCompleted),['house']);assert(H.canUseBlock(update.state,'glass'));
});
test('fish require a built watertight habitat and are only placed in water',()=>{
  const w=world();pond(w);assert(H.inspectHabitat(w.getBlock,w.edits).valid);
  const natural=world();pond(natural,false);assert(!H.inspectHabitat(natural.getBlock,natural.edits).valid);
  w.put(10,0,10,null);assert(!H.inspectHabitat(w.getBlock,w.edits).valid);w.put(10,0,10,'stone');
  w.put(9,1,10,null);assert(!H.inspectHabitat(w.getBlock,w.edits).valid);w.put(9,1,10,'glass');
  let s=starter();assert(!H.canPlaceAnimal(s,'fish',w.getBlock,10,1,10));house(w);s=H.advance(s,w).state;
  s.collected.copperore=6;s.collected.ironore=4;
  const c=H.craft(s,{stone:2,sand:2},'concrete');assert(c.ok);assert.equal(c.inventory.concrete,4);
  const result=H.advance(c.state,w);assert.deepEqual(json(result.newlyCompleted),['workshop','habitat']);assert(H.status(result.state).complete);
  assert(H.canPlaceAnimal(result.state,'fish',w.getBlock,10,1,10));assert(!H.canPlaceAnimal(result.state,'fish',w.getBlock,10,3,10));
  assert.deepEqual(json(result.state.unlocks.characters),json(H.CHARACTERS));
});
test('invalid edit coordinates do not trigger geometry reads and scans have a hard bound',()=>{
  let reads=0;const edits={'NaN,1,2':'planks','900000000000000,1,2':'planks','1.2,1,2':'water'};
  assert(!H.inspectHouse(()=>{reads++;return null;},edits).valid);assert.equal(reads,0);
  const many={};for(let n=0;n<22000;n++)many[`${n%10000},${Math.floor(n/10000)},0`]='planks';
  H.inspectHouse(()=>{reads++;return null;},many);assert(reads<=150000);
});
test('wood variant recipes unlock with their logs and preserve every inventory material',()=>{
  const inventory=Object.fromEntries(H.BLOCKS.map((key,i)=>[key,i+30]));
  const original={...inventory};
  const base=H.craft(H.normalize(),inventory,'planks');assert(base.ok);
  for(const key of H.BLOCKS)assert.equal(base.inventory[key],inventory[key]+(key==='planks'?4:key==='wood'?-1:0));
  assert.deepEqual(inventory,original,'craft leaves the input inventory intact');
  assert(!H.craft(H.normalize(),inventory,'cherryplanks').ok);
  let s=H.normalize();s.tools.axe=true;s.collected.wood=10;s=H.advance(s,{}).state;
  assert(H.canMine(s,'cherryleaves'));assert(H.canMine(s,'cherrywood'));assert(!H.canMine(s,'sprucewood'));
  const cherry=H.craft(s,inventory,'cherryplanks');assert(cherry.ok);assert.equal(cherry.inventory.cherrywood,inventory.cherrywood-1);assert.equal(cherry.inventory.cherryplanks,inventory.cherryplanks+4);
  assert(!H.craft(s,inventory,'spruceplanks').ok);
  s=starter();assert(H.craft(s,inventory,'spruceplanks').ok);assert(!H.craft(s,inventory,'pineplanks').ok);
  const w=world();house(w);s=H.advance(s,w).state;
  assert(H.craft(s,inventory,'pineplanks').ok);assert(H.canMine(s,'pinewood'));
});
test('all concrete colors use the same materials and count toward the workshop reward',()=>{
  const w=world();house(w);const houseState=H.advance(starter(),w).state;
  for(const color of ['concrete','whiteconcrete','redconcrete','yellowconcrete','blueconcrete']){
    assert(!H.craft(starter(),{stone:2,sand:2},color).ok);
    assert(H.canMine(houseState,color));
    const result=H.craft(houseState,{stone:2,sand:2},color);assert(result.ok);assert.equal(result.inventory[color],4);assert.equal(result.inventory.stone,0);assert.equal(result.inventory.sand,0);
    result.state.collected.copperore=6;result.state.collected.ironore=4;
    assert.equal(H.status(result.state).next.progress,14);
    const complete=H.advance(result.state,w);assert.deepEqual(json(complete.newlyCompleted),['workshop']);
    assert(H.normalize(complete.state).completed.includes('workshop'),'colored concrete completion survives normalization');
  }
});
