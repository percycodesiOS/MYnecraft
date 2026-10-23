// Run: node game/tests/kid-requests.test.mjs
// Student requests against the real game source: dogs that do not always follow,
// a one-place library, bookshelves, and saves that are never silently lost.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const threeURL=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three=await import(new URL(threeURL,new URL('../mynecraft.html',import.meta.url)));
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const SAVE_KEY='mynecraft_save_v1';
const activitiesSource=await fs.readFile(new URL('../play-activities.js',import.meta.url),'utf8');
function boot(store,{withActivities=false}={}){
  const events={};
  class Element{
    constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';}
    appendChild(e){this.children.push(e);} append(...es){this.children.push(...es);}
    addEventListener(k,f){(this.events[k]??=[]).push(f);} setAttribute(k,v){this[k]=v;}
    getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
  }
  const elements={};
  const document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(k,f){(events[k]??=[]).push(f);},exitPointerLock(){}};
  class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class {load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
    performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,
    addEventListener(k,f){(events[k]??=[]).push(f);},localStorage,location:{reload(){}},confirm:()=>true});
  if(withActivities)vm.runInContext(activitiesSource,context);
  vm.runInContext(script+`\n globalThis.api={player,ellie,percy,startGame,persistSave,worldBackupText,readWorldBackup,updateCompanions,companionPair,companionAnchor,companionHome,
    setCompanionMode,hostPrompt,hostInteract,gardenPlan,GARDEN_KITS,BLOCKS,INVENTORY_ADDITIONS,DAMAGED_SAVE_KEY,elements:document,activities,groundSurface,
    get keys(){return BLOCK_KEYS;},get companionMode(){return companionMode;},get damagedSaveKept(){return damagedSaveKept;},setBlock,getBlock,isSolid};`,context);
  return {a:context.api,elements};
}

// A fresh world: Percy and Ellie play near their own home instead of trailing the player.
const store=new Map();
const {a,elements}=boot(store);
assert.equal(a.companionMode,'play','new worlds start with the dogs playing on their own');
assert.equal(elements.companionMode.value,'play','the menu shows the same choice');
a.startGame();
a.player.flying=false;a.player.pos.set(a.companionHome.x+30,6.7,a.companionHome.z+5);
let closest=Infinity,farthestFromHome=0;
for(let n=0;n<2400;n++){
  if(n%400===0)a.player.pos.x=a.companionHome.x+(n%800?-28:28);
  a.updateCompanions(1/20);
  for(const dog of [a.ellie,a.percy]){
    closest=Math.min(closest,Math.hypot(dog.pos.x-a.player.pos.x,dog.pos.z-a.player.pos.z));
    farthestFromHome=Math.max(farthestFromHome,Math.hypot(dog.pos.x-a.companionHome.x,dog.pos.z-a.companionHome.z));
  }
}
assert(closest>12,'the dogs never chase a player who walks away');
assert(farthestFromHome<14,'they keep playing around their home');
// Walking up to them offers a clear Interact choice to bring them along.
a.player.pos.set(a.ellie.pos.x+1.2,a.ellie.pos.y+1.7,a.ellie.pos.z);
assert.equal(a.hostPrompt(),'Dogs: follow me');
assert(a.hostInteract());assert.equal(a.companionMode,'follow');
assert.equal(JSON.parse(store.get(SAVE_KEY)).companionMode,'follow','the choice is saved right away');
assert.equal(a.hostPrompt(),'Dogs: go play');
// Following: after the player moves, both dogs come along.
a.player.pos.set(a.ellie.pos.x-8,a.player.pos.y,a.ellie.pos.z);
let caughtUp=false;
for(let n=0;n<1200&&!caughtUp;n++){a.updateCompanions(1/20);caughtUp=[a.ellie,a.percy].every(d=>Math.hypot(d.pos.x-a.player.pos.x,d.pos.z-a.player.pos.z)<5);}
assert(caughtUp,'Follow me brings both dogs to the player');
// Stay: they hold their spot even as the player leaves.
a.setCompanionMode('stay',false);
const spot={x:(a.ellie.pos.x+a.percy.pos.x)/2,z:(a.ellie.pos.z+a.percy.pos.z)/2};
a.player.pos.x+=20;
for(let n=0;n<1200;n++)a.updateCompanions(1/20);
for(const dog of [a.ellie,a.percy])assert(Math.hypot(dog.pos.x-spot.x,dog.pos.z-spot.z)<4,'Stay keeps them where they were');
// Backups carry the choice; older backups without it load as "play".
const backup=JSON.parse(a.worldBackupText());
assert.equal(a.readWorldBackup(JSON.stringify(backup)).companionMode,'stay');
delete backup.state.companionMode;assert.equal(a.readWorldBackup(JSON.stringify(backup)).companionMode,undefined);
backup.state.companionMode='chase';assert.throws(()=>a.readWorldBackup(JSON.stringify(backup)),/Percy and Ellie/);

// The bookshelf is appended last, so every older selected-block index still means the same block.
assert.equal(a.keys.at(-1),'bookshelf');assert.equal(a.keys.length,37);
assert(a.BLOCKS.bookshelf&&!a.BLOCKS.bookshelf.plant);
assert(a.INVENTORY_ADDITIONS.includes('bookshelf'),'group rooms, which accept only the original blocks, hide it');
// The one-place library: bookshelf walls, a door toward the player, windows, floor, roof and light.
assert.equal(a.GARDEN_KITS.library,'Little library');
const cells=a.gardenPlan('library',10,5,10,{x:0,z:-1});
const at=(x,y,z)=>cells.find(c=>c.x===x&&c.y===y&&c.z===z)?.block;
assert.equal(cells.length,96);
assert.equal(at(10,6,10),undefined);assert.equal(at(10,7,10),undefined,'a two-high doorway on the player side');
assert.equal(at(10,8,10),'bookshelf');assert.equal(at(9,6,10),'bookshelf');
assert.equal(at(8,7,8),'glass');assert.equal(at(12,7,8),'glass');assert.equal(at(10,9,8),'glow');
assert(cells.every(c=>c.z>=6&&c.z<=10),'the room extends away from the player');
assert.equal(cells.filter(c=>c.block==='bookshelf').length,44);
const east=a.gardenPlan('library',0,5,0,{x:3,z:.5});
assert(east.every(c=>c.x>=0&&c.x<=4)&&!east.some(c=>c.x===0&&c.z===0&&c.y===6),'facing east puts the door on the west wall');
console.log('PASS: dogs play near home by default, follow or stay on request, saved choice, bookshelf block and one-place library.');

// A save that cannot be read is set aside before anything can overwrite it.
{
  const broken=new Map([[SAVE_KEY,'{"edits":{"1,2,3":"stone"'],]);
  const {a:b}=boot(broken);
  assert(b.damagedSaveKept,'the damaged save was noticed');
  assert.equal(broken.get(b.DAMAGED_SAVE_KEY),'{"edits":{"1,2,3":"stone"');
  b.startGame();b.persistSave();
  assert.doesNotThrow(()=>JSON.parse(broken.get(SAVE_KEY)),'play continues with a fresh, valid save');
  assert.equal(broken.get(b.DAMAGED_SAVE_KEY),'{"edits":{"1,2,3":"stone"','and the damaged copy is still there to recover');
  const {a:c}=boot(new Map([[SAVE_KEY,JSON.stringify([1,2,3])]]));
  assert(c.damagedSaveKept,'a save of the wrong shape is kept too');
  const {a:d}=boot(new Map());
  assert(!d.damagedSaveKept,'a first visit has nothing to recover');
}
console.log('PASS: unreadable saves are kept aside for recovery instead of being overwritten.');

// On the real campus: the parked car drives off across the lot, and tea on a
// school roof is recognized as a roof (the lawn is not).
{
  const {a:g,elements:els}=boot(new Map(),{withActivities:true});
  assert(g.activities,'activities load with the game');g.startGame();
  const start=g.activities.serialize().cars.campus;
  g.player.flying=false;g.player.pos.set(start.x+1.5,g.groundSurface(start.x+1.5,start.z)+1.7,start.z);
  assert.equal(g.activities.getPrompt(),'Drive car');assert(g.activities.interact());assert(g.activities.isDriving());
  let farthest=0;
  for(let i=0;i<240;i++){g.activities.update(.05,{forward:1,turn:i>120?1:0});const c=g.activities.serialize().cars.campus;farthest=Math.max(farthest,Math.hypot(c.x-start.x,c.z-start.z));}
  assert(farthest>12,'the car really drives across the campus lot (moved '+farthest.toFixed(1)+' blocks)');
  assert(g.activities.interact());assert(!g.activities.isDriving(),'and parks');
  // Find a real school roof: a tall solid column with an open room underneath.
  let roof=null;
  for(let x=30;x<=90&&!roof;x++)for(let z=-30;z<=40&&!roof;z++){
    const top=g.groundSurface(x+.5,z+.5);
    if(top<10)continue;
    let room=false;for(let y=top-3;y>=top-12;y--)if(!g.isSolid(x,y,z)){room=true;break;}
    if(room&&!g.isSolid(x,top,z)&&!g.isSolid(x,top+1,z))roof={x:x+.5,y:top,z:z+.5};
  }
  assert(roof,'the campus has a reachable roof');
  g.player.pos.set(roof.x,roof.y+1.7,roof.z);g.player.vel.set(0,0,0);g.player.onGround=true;
  assert(g.activities.equipTea());assert(g.activities.interact());assert(g.activities.isSitting());
  assert(/roof with a warm cup of tea/.test(els.status.textContent),'sitting up there is a roof tea party');
  g.activities.interact();
  const lawnY=g.groundSurface(.5,20.5);g.player.pos.set(.5,lawnY+1.7,20.5);
  g.activities.interact();assert(g.activities.isSitting());
  assert(!/roof/.test(els.status.textContent),'the lawn is not a roof');
}
console.log('PASS: real campus car drive and roof tea.');
