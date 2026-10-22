// Exercise the real game module, controls, save boundary, and all three classic scripts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const threeURL=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three=await import(new URL(threeURL,new URL('../mynecraft.html',import.meta.url)));
const classicNames=['hardcore-rules.js','hardcore-world.js','play-activities.js'];
const classics=await Promise.all(classicNames.map(name=>fs.readFile(new URL('../'+name,import.meta.url),'utf8')));
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const instrumented=source+`\n globalThis.api={startGame,doBreak,doPlace,castVoxel,setBlock,getBlock,recordEdit,persistSave,worldBackupText,readWorldBackup,restoreWorldBackup,openInventory,closeInventory,refreshInventory,advanceHardcore,player,camera,craftingChoices,animalChoices,inventoryChoices,gardenChoices,fishingRodChoice,modeSelect,resetBtn,LEGACY_BLOCK_KEYS,BLOCK_KEYS,
get mode(){return gameMode;},get inventory(){return inventory;},get hardcore(){return hardcore;},get state(){return saveState;},get envelope(){return saveEnvelope;},get activities(){return activities;},get fishUnlocked(){return fishUnlocked;},get inventoryOpen(){return inventoryOpen;},get selectedAnimal(){return chosenAnimal;},get worldIsHardcore(){return isHardcoreWorld;},
selectBlock(key){selected=BLOCK_KEYS.indexOf(key);chosenAnimal=null;},modeTo(value){modeSelect.value=value;for(const fn of modeSelect.events.change)fn();}};`;
const json=value=>JSON.parse(JSON.stringify(value));

function loadGame(storage,url='https://example.test/game/mynecraft.html'){
  const events={},elements={};
  let document;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';this.disabled=false;this.hidden=false;}
    appendChild(e){this.children.push(e);return e;} append(...es){this.children.push(...es);}
    addEventListener(k,f){(this.events[k]??=[]).push(f);} setAttribute(k,v){this[k]=v;}
    focus(){document.activeElement=this;} getBoundingClientRect(){return {left:0,top:0,width:132,height:132,right:132,bottom:132};}
    getContext(){return new Proxy({measureText:t=>({width:String(t).length*15})},{get:(o,k)=>o[k]??(()=>{})});}
  }
  document={body:new Element(),activeElement:null,createElement:tag=>new Element(tag),getElementById:id=>elements[id]??=new Element(),addEventListener(k,f){(events[k]??=[]).push(f);},exitPointerLock(){}};
  class Renderer{constructor(){this.domElement=new Element('canvas');this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
  const location={href:url,search:new URL(url).search,hash:new URL(url).hash,reloads:0,reload(){this.reloads++;}};
  const history={state:null,replaceState(state,title,url){location.href=url;location.search=new URL(url).search;location.hash=new URL(url).hash;}};
  const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
    performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URL,URLSearchParams,location,history,confirm:()=>true,
    addEventListener(k,f){(events[k]??=[]).push(f);},localStorage:{getItem:()=>storage.text,setItem:(key,value)=>{assert.equal(key,'mynecraft_save_v1');if(storage.failWrites>0){storage.failWrites--;throw Error('Storage unavailable');}if(storage.failOnWrite===++storage.writes)throw Error('Storage unavailable');storage.text=value;},removeItem:()=>{storage.text=null;}}});
  classics.forEach((script,i)=>vm.runInContext(script,context,{filename:classicNames[i]}));
  vm.runInContext(instrumented,context,{filename:'mynecraft.html'});
  return {a:context.api,context,elements,location};
}
function aim(a,x,y,z,down=false){a.player.pos.set(x,y,z);a.camera.position.copy(a.player.pos);a.camera.rotation.set(down?-Math.PI/2:0,0,0,'YXZ');}
function click(button){assert.equal(button.disabled,false,'control should be enabled');for(const fn of button.events.click||[])fn({preventDefault(){},stopPropagation(){},isTrusted:false});}
function craft(game,id){const {a}=game;if(!a.inventoryOpen)a.openInventory();const item=a.craftingChoices.find(c=>c.id===id);assert(item,'recipe exists: '+id);click(item.button);}
function put(a,x,y,z,block){a.setBlock(x,y,z,block);a.recordEdit(x,y,z,block);}
function makeHouse(a){for(let x=10;x<15;x++)for(let z=10;z<15;z++){put(a,x,35,z,'planks');put(a,x,39,z,'planks');if(x===10||x===14||z===10||z===14)for(let y=36;y<39;y++)if(!(x===12&&z===10&&y<38))put(a,x,y,z,'planks');}}
function makeAlmostPond(a){for(let x=26;x<28;x++)for(let z=26;z<28;z++){put(a,x,35,z,'stone');if(x!==27||z!==27)put(a,x,36,z,'water');}for(let n=26;n<28;n++)for(const [x,z]of[[25,n],[28,n],[n,25],[n,28]])put(a,x,36,z,'glass');}

test('Hardcore actual UI, world saves, resource gates, and fish habitat integration',()=>{
  const storage={text:null,writes:0,failWrites:0};
  let game=loadGame(storage,'https://example.test/game/mynecraft.html?mode=hardcore&demo=1#play');
  let a=game.a;
  assert.equal(a.mode,'hardcore');assert(a.worldIsHardcore);assert.equal(game.location.search,'?demo=1');assert.equal(game.location.hash,'#play');
  assert.deepEqual(json(a.hardcore.unlocks.characters),['macek']);assert.equal(a.getBlock(0,3,0),'grass','the resource world replaces campus terrain');
  a.envelope.edits['25,20,25']='snow'; // Simulate an existing independent campus build.
  a.startGame();
  aim(a,60.5,40.5,60.5);a.setBlock(60,40,57,'stone');a.doBreak();
  assert.equal(a.getBlock(60,40,57),'stone','bare hands cannot mine stone');assert.equal(a.inventory.stone,0);
  for(let n=0;n<10;n++){aim(a,60.5+n,40.5,60.5);a.setBlock(60+n,40,57,'wood');a.doBreak();}
  assert.equal(a.inventory.wood,10);assert.equal(a.hardcore.collected.wood,10);assert.equal(a.hardcore.completed.length,0,'the axe is still required');
  craft(game,'axe');assert(a.hardcore.tools.axe);assert.equal(a.inventory.wood,7);assert.deepEqual(json(a.hardcore.completed),['wood']);
  craft(game,'planks');craft(game,'pick');assert(a.hardcore.tools.pick);assert.equal(a.inventory.wood,4);assert.equal(a.inventory.planks,2);
  a.closeInventory();
  for(let n=0;n<8;n++){aim(a,60.5+n,41.5,60.5);a.setBlock(60+n,41,57,'stone');a.doBreak();}
  assert.deepEqual(json(a.hardcore.completed),['wood','stone']);
  aim(a,74.5,40.5,60.5);a.setBlock(74,40,57,'dirt');a.inventory.glass=1;a.selectBlock('glass');a.doPlace();
  assert(!a.getBlock(74,40,58),'locked glass is not placed');assert.equal(a.inventory.glass,1);
  a.selectBlock('wood');a.doPlace();assert.equal(a.getBlock(74,40,58),'wood');assert.equal(a.inventory.wood,3);
  const gathered=a.hardcore.collected.wood;a.doBreak();assert.equal(a.inventory.wood,4);assert.equal(a.hardcore.collected.wood,gathered,'recycling is not natural gathering');
  a.openInventory();assert(a.animalChoices.find(c=>c.kind==='fish').button.disabled);a.closeInventory();
  makeHouse(a);a.advanceHardcore();assert(a.hardcore.completed.includes('house'));
  for(let n=0;n<12;n++){const block=n<6?'copperore':n<10?'ironore':'sand';aim(a,60.5+n,42.5,60.5);a.setBlock(60+n,42,57,block);a.doBreak();}
  craft(game,'concrete');assert(a.hardcore.completed.includes('workshop'));a.closeInventory();
  makeAlmostPond(a);assert(!a.hardcore.unlocks.animals.includes('fish'));
  a.inventory.water=1;a.selectBlock('water');aim(a,27.5,39.5,27.5,true);a.doPlace();
  assert.equal(a.getBlock(27,36,27),'water');assert(a.hardcore.completed.includes('habitat'));assert(a.hardcore.unlocks.animals.includes('fish'));
  a.openInventory();click(a.animalChoices.find(c=>c.kind==='fish').button);assert.equal(a.selectedAnimal,'fish');
  const animalCount=a.activities.serialize().animals.length;
  aim(a,74.5,40.5,60.5);a.doPlace();assert.equal(a.activities.serialize().animals.length,animalCount,'fish cannot be placed on land');
  aim(a,26.5,39.5,26.5,true);a.doPlace();assert.equal(a.activities.serialize().animals.length,animalCount+1,'fish can be placed in a completed water habitat');

  assert(a.persistSave());const exported=a.worldBackupText(),saved=JSON.parse(storage.text);
  assert.equal(saved.activeWorld,'hardcore');assert.equal(saved.edits['25,20,25'],'snow');assert.equal(saved.edits['74,40,58'],undefined);
  assert.equal(saved.hardcoreWorld.edits['74,40,58'],null);assert.equal(saved.hardcoreWorld.activities.animals.length,animalCount+1);
  assert.equal(a.readWorldBackup(exported).hardcoreWorld.activities.animals.length,animalCount+1);
  const legacy=JSON.parse(exported);delete legacy.state.hardcoreWorld;delete legacy.state.activeWorld;
  for(const key of a.BLOCK_KEYS)if(!a.LEGACY_BLOCK_KEYS.includes(key))delete legacy.state.inventory[key];
  delete legacy.state.hardcore;delete legacy.state.activities;
  const loadedLegacy=a.readWorldBackup(JSON.stringify(legacy));for(const key of a.BLOCK_KEYS)if(!a.LEGACY_BLOCK_KEYS.includes(key))assert.equal(loadedLegacy.inventory[key],0);
  const malformed=JSON.parse(exported);
  malformed.state.hardcoreWorld.hardcoreWorld=JSON.parse(exported).state.hardcoreWorld;
  assert.throws(()=>a.readWorldBackup(JSON.stringify(malformed)),/nested worlds/);

  game.context.confirm=()=>false;const beforeCancel=storage.text;assert.equal(a.restoreWorldBackup(exported),false);assert.equal(storage.text,beforeCancel);assert.equal(game.location.reloads,0);
  storage.failWrites=1;a.modeTo('creative');assert.equal(a.mode,'hardcore');assert.equal(a.modeSelect.value,'hardcore');assert.equal(game.location.reloads,0);assert.equal(storage.text,beforeCancel);
  storage.failOnWrite=storage.writes+2;a.modeTo('creative');assert.equal(a.modeSelect.value,'hardcore');assert.equal(game.location.reloads,0);assert.equal(JSON.parse(storage.text).activeWorld,'hardcore','failure writing destination retains the original active world');storage.failOnWrite=0;
  a.modeTo('creative');assert.equal(game.location.reloads,1);assert.equal(JSON.parse(storage.text).activeWorld,'campus');
  game=loadGame(storage);a=game.a;assert.equal(a.mode,'creative');assert.equal(a.getBlock(25,20,25),'snow');assert(!a.getBlock(74,40,58));
  assert.equal(a.fishUnlocked,false);a.startGame();aim(a,80.5,40.5,60.5);a.setBlock(80,40,57,'stone');a.selectBlock('planks');a.doPlace();assert.equal(a.fishUnlocked,false,'one random campus block never unlocks fish');
  a.modeTo('hardcore');assert.equal(game.location.reloads,1);assert.equal(JSON.parse(storage.text).activeWorld,'hardcore');
  game=loadGame(storage);a=game.a;assert.equal(a.mode,'hardcore');assert(a.hardcore.completed.includes('habitat'));assert.equal(a.activities.serialize().animals.length,animalCount+1,'placed animals are restored on reload');
  assert.equal(a.getBlock(27,36,27),'water');assert.equal(a.envelope.edits['25,20,25'],'snow');
  game.context.confirm=()=>true;storage.failWrites=1;const beforeImport=storage.text;assert.throws(()=>a.restoreWorldBackup(exported),/could not save/);assert.equal(storage.text,beforeImport);assert.equal(game.location.reloads,0);
  assert(a.restoreWorldBackup(exported));assert.equal(game.location.reloads,1);assert.equal(JSON.parse(storage.text).hardcoreWorld.activities.animals.length,animalCount+1);assert.equal(JSON.parse(storage.text).edits['25,20,25'],'snow');
});


test('Creative inventory pond kit unlocks fish and a selectable fishing rod',()=>{
  const game=loadGame({text:null,writes:0,failWrites:0}),a=game.a;a.startGame();
  for(let x=59;x<=66;x++)for(let z=59;z<=66;z++){
    a.setBlock(x,35,z,'stone');for(let y=36;y<=41;y++)a.setBlock(x,y,z,null);
  }
  a.openInventory();assert(a.fishingRodChoice.disabled);
  click(a.gardenChoices.find(button=>button.dataset.garden==='pond'));
  aim(a,62.5,40.5,62.5,true);a.doPlace();
  assert.equal(a.getBlock(62,37,62),'water');assert.equal(a.getBlock(61,37,62),'stone');
  assert(a.fishUnlocked,'placing the complete pond runs the real habitat unlock');
  a.openInventory();assert(!a.fishingRodChoice.disabled);
  click(a.animalChoices.find(c=>c.kind==='fish').button);
  aim(a,62.5,40.5,62.5,true);a.doPlace();
  assert.equal(a.activities.serialize().animals.length,1);
  a.openInventory();click(a.fishingRodChoice);assert(a.activities.isFishing(),'inventory selection equips the rod after resuming play');
  a.openInventory();click(a.inventoryChoices[2].button);assert(!a.activities.isFishing(),'choosing a block puts the rod away');
  assert(a.persistSave());const backup=a.readWorldBackup(a.worldBackupText());
  assert.equal(backup.activities.animals[0].age,0);assert.equal(backup.activities.catches.campus,0);
});
