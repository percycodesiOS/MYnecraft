// Actual game-module integration, using an in-memory room transport only.
// No production service, network request, real session or browser save is used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as Three from '../vendor/three.module.js';

const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const moduleSource=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const helpers=await Promise.all(['hardcore-rules.js','hardcore-world.js','play-activities.js','cafeteria-cleaner.js'].map(file=>fs.readFile(new URL('../'+file,import.meta.url),'utf8')));
class Element{
  constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';this.value='';}
  appendChild(e){this.children.push(e);}append(...es){this.children.push(...es);}
  addEventListener(k,f){(this.events[k]??=[]).push(f);}setAttribute(k,v){this[k]=v;}focus(){}
  getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
const elements={},events={},intervals=[],writes=[],commands=[],moves=[],navigations=[];
const personal=JSON.stringify({mode:'survival',health:9,dayTime:.4,edits:{'25,20,25':'orange'},player:{x:25,y:25,z:25,sel:3,yaw:1,pitch:0,flying:false},inventory:{wood:77},canary:'TEST_ONLY_PERSONAL_SAVE',hardcoreWorld:{canary:'TEST_ONLY_HARDCORE_SAVE'}});
let stored=personal,transport=null,writable=false,disposed=false;
const session={baseUrl:'http://127.0.0.1:9999',token:'TEST_ONLY_SESSION',roomId:'test-room',studentId:'student-self',number:7};
const document={body:new Element(),hidden:false,createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(k,f){(events[k]??=[]).push(f);},exitPointerLock(){}};
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},clearInterval(){},requestAnimationFrame(){},console,URLSearchParams,URL,
  addEventListener(k,f){(events[k]??=[]).push(f);},
  localStorage:{getItem:()=>stored,setItem:(key,value)=>{writes.push({key,value});stored=value;},removeItem(key){writes.push({key,removed:true});stored=null;}},
  location:{search:'?room=1',href:'http://127.0.0.1/game/mynecraft.html?room=1',assign:url=>navigations.push(url),replace:url=>navigations.push(url),reload:()=>navigations.push('reload')},
  history:{state:null,replaceState(){}},confirm:()=>true,
  fetch(){throw new Error('This test must never make network requests.');},
  MYNE_ROOM:{readSession:()=>session,create(api){transport=api;return{canPlay:()=>writable&&!disposed,canWrite:()=>writable&&!disposed&&api.isActive(),edit(p){if(writable&&!disposed&&api.isActive())commands.push({...p});},move(p){if(writable&&!disposed&&api.isActive())moves.push({...p});},dispose(){disposed=true;}};}}
});
for(const source of helpers)vm.runInContext(source,context);
vm.runInContext(moduleSource+`
globalThis.testApi={isGroupRoom,isHardcoreWorld,gameMode,player,camera,startGame,pauseGame,doPlace,doBreak,castVoxel,getBlock,setBlock,persistSave,worldBackupText,restoreWorldBackup,saveAreaLabel,travelTo,modeSelect,resetBtn,saveBtn,backLink,campusOnlyVisuals,cafeteriaCleaner,activities,scene,tick,keys,
  select(key){selected=BLOCK_KEYS.indexOf(key);},get clock(){return dayTime;},set clock(value){dayTime=value;},get sleeping(){return isWorldSleeping();},get labels(){return areaLabels;}};`,context);
const a=context.testApi;
const fire=(element,event)=>{for(const fn of element.events[event]||[])fn({preventDefault(){}});};
const unchanged=message=>{assert.equal(writes.length,0,message);assert.equal(stored,personal,message);};

assert(a.isGroupRoom);assert(!a.isHardcoreWorld);assert.equal(a.gameMode,'creative');
assert(transport,'room session creates the room transport');
unchanged('room entry preserves both personal save slots byte for byte');
assert.equal(a.getBlock(25,20,25),undefined,'personal edits never seed a group world');
assert.equal(a.campusOnlyVisuals.visible,false);
assert.equal(a.cafeteriaCleaner,null);assert.equal(a.activities,null);
assert.equal(elements.schoolExplore.hidden,true);
assert(!a.scene.getObjectByName('Cafeteria custodian'));
assert(!a.scene.getObjectByName('MYnecraft play activities'));

// Before admission, the main loop keeps the player and world clock still.
a.startGame();a.keys.KeyW=true;a.player.vel.set(2,3,4);
const waitingAt=a.player.pos.clone(),waitingClock=a.clock;a.tick(50);
assert.equal(a.player.pos.distanceTo(waitingAt),0);assert.equal(a.player.vel.length(),0);assert.equal(a.clock,waitingClock);
writable=true;a.keys.KeyW=false;
transport.onState({status:'open',self:{id:'student-self',number:7,x:0.5,y:10,z:.5,yaw:0,locked:false}});
assert.match(elements.status.textContent,/Builder 7/);
assert.equal(a.player.pos.y,10,'authoritative position corrects a far-away local spawn');
a.player.pos.set(.5,10,.5);a.camera.position.copy(a.player.pos);a.camera.rotation.set(0,0,0);a.camera.updateMatrixWorld();
transport.onEdit({x:0,y:10,z:-2,block:'stone'});
assert.equal(a.castVoxel().z,-2);

// Only server callbacks change voxels. Commands do not optimistically alter it.
a.select('planks');a.doPlace();
assert.equal(commands.length,1);assert.equal(JSON.stringify(commands[0]),JSON.stringify({x:0,y:10,z:-1,block:'planks'}));
assert.equal(a.getBlock(0,10,-1),undefined);
transport.onEdit(commands[0]);assert.equal(a.getBlock(0,10,-1),'planks');
a.doBreak();assert.equal(commands.length,2);assert.equal(commands[1].block,null);
assert.equal(a.getBlock(0,10,-1),'planks');transport.onEdit(commands[1]);assert.equal(a.getBlock(0,10,-1),undefined);
transport.onEdit({x:0,y:10,z:-1,block:'not-a-real-block'});assert.equal(a.getBlock(0,10,-1),undefined);
unchanged('authoritative room edits never touch personal localStorage');

// Sleep must finish while input is suspended, without bypassing teacher locks.
a.clock=.5;a.tick(1000);assert(a.sleeping,'6 PM starts room sleep');
assert.equal(transport.isActive(),false,'sleep blocks edits and movement input');
writable=false;a.tick(1500);assert(a.sleeping,'teacher pause preserves sleep progress');
writable=true;a.tick(2000);assert(a.sleeping,'first half second after admission');
a.tick(2500);assert.equal(a.sleeping,false,'one active second completes room sleep');
assert.equal(a.clock,0,'room wakes at sunrise');
// Room peers are numbered; local/removed students do not create duplicate avatars.
transport.onPlayers([{id:'student-self',number:7,x:0,y:6,z:0,yaw:0},{id:'peer',number:8,x:2,y:6,z:2,yaw:1},{id:'removed',number:9,x:3,y:6,z:3,yaw:0,removed:true}]);
assert(a.scene.getObjectByName('Builder 8'));assert(!a.scene.getObjectByName('Builder 7'));assert(!a.scene.getObjectByName('Builder 9'));
transport.onPlayers([{id:'peer',number:8,x:2,y:6,z:2,yaw:1,locked:true}]);assert.equal(a.scene.getObjectByName('Builder 8').visible,false);
transport.onPlayers([]);assert(!a.scene.getObjectByName('Builder 8'));

// Manual and automatic save paths, reset, import, signs and mode changes are isolated.
assert.equal(a.persistSave(),false);fire(a.saveBtn,'click');
for(const timer of intervals.filter(t=>t.ms===5000))timer.fn();
assert.throws(()=>a.worldBackupText(),/shared room/i);
assert.throws(()=>a.restoreWorldBackup('{}'),/Leave the group room/i);
assert.match(a.saveAreaLabel('TEST SIGN'),/off in group rooms/);assert.equal(a.labels.length,0);
const beforeTravel=a.player.pos.clone();assert.match(a.travelTo(20,30,20),/off in group rooms/);assert.equal(a.player.pos.distanceTo(beforeTravel),0);
fire(elements.overview,'click');fire(elements.visitSchool,'click');assert.equal(a.player.pos.distanceTo(beforeTravel),0,'campus shortcuts cannot move a room player');
for(const mode of ['survival','hardcore']){a.modeSelect.value=mode;fire(a.modeSelect,'change');assert.equal(a.modeSelect.value,'creative');}
fire(a.resetBtn,'click');assert.equal(navigations.length,0);
for(const id of ['downloadWorld','loadWorld','areaLabelText','removeAreaLabel'])assert.equal(elements[id].disabled,true,id+' disabled in a room');
unchanged('save/import/reset/mode handlers cannot modify personal worlds from a room');

// Lock/close gates block the main loop, edits and outgoing movement updates.
writable=false;a.keys.KeyW=true;a.player.vel.set(5,0,5);
transport.onState({status:'open',self:{id:'student-self',number:7,x:.5,y:10,z:.5,yaw:0,locked:true}});
transport.onClosed({status:'open',self:{locked:true}});
assert.match(elements.status.textContent,/admit or resume/);
const lockedAt=a.player.pos.clone(),lockedClock=a.clock;a.tick(100);
assert.equal(a.player.pos.distanceTo(lockedAt),0);assert.equal(a.clock,lockedClock);assert.equal(a.player.vel.length(),0);
a.doPlace();a.doBreak();assert.equal(commands.length,2,'locked transport rejects edit attempts');
for(const timer of intervals.filter(t=>t.ms===250))timer.fn();assert.equal(moves.length,0);
transport.onState({status:'closed',self:{id:'student-self',number:7,x:.5,y:10,z:.5,yaw:0,locked:false}});transport.onClosed({status:'closed'});
assert.match(elements.status.textContent,/teacher has closed/);a.tick(150);assert.equal(a.player.pos.distanceTo(lockedAt),0);

assert.equal(a.backLink.href,'rooms.html');assert.equal(a.backLink.textContent,'Leave room');
for(const fn of events.beforeunload||[])fn();
assert(disposed,'leaving disposes the connection');
unchanged('leaving a shared room does not save it over either personal world');

// A stale room URL with no valid session must also fail closed, never fall back
// to a personal world that the student might accidentally start changing.
{
  const missingElements={},missingEvents={},missingIntervals=[],missingWrites=[];
  const missingDocument={body:new Element(),hidden:false,createElement:()=>new Element(),getElementById:id=>missingElements[id]??=new Element(),addEventListener(k,f){(missingEvents[k]??=[]).push(f);},exitPointerLock(){}};
  const missing=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document:missingDocument,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
    performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(fn){missingIntervals.push(fn);return missingIntervals.length;},clearInterval(){},requestAnimationFrame(){},console,URLSearchParams,URL,
    addEventListener(k,f){(missingEvents[k]??=[]).push(f);},
    localStorage:{getItem:()=>personal,setItem:(...args)=>missingWrites.push(args),removeItem:(...args)=>missingWrites.push(args)},
    location:{search:'?room=1',href:'http://127.0.0.1/game/mynecraft.html?room=1',reload(){}},confirm:()=>true,
    fetch(){throw new Error('No room session may make a network request.');},
    MYNE_ROOM:{readSession:()=>null,create(){throw new Error('Missing session must not create a room connection.');}}
  });
  for(const source of helpers)vm.runInContext(source,missing);
  vm.runInContext(moduleSource+`\nglobalThis.testApi={isGroupRoom,roomConnection,startGame,tick,player,keys,getBlock,persistSave,backLink,get clock(){return dayTime;}};`,missing);
  const m=missing.testApi;
  assert(m.isGroupRoom);assert.equal(m.roomConnection,null);
  assert.equal(m.getBlock(25,20,25),undefined,'invalid session does not load personal edits');
  assert.match(missingElements.status.textContent,/No active room session/);
  assert.equal(m.backLink.href,'rooms.html');
  m.startGame();m.keys.KeyW=true;const pos=m.player.pos.clone(),time=m.clock;m.tick(50);
  assert.equal(m.player.pos.distanceTo(pos),0);assert.equal(m.clock,time);
  assert.equal(m.persistSave(),false);
  for(const fn of missingIntervals)fn();for(const fn of missingEvents.beforeunload||[])fn();
  assert.equal(missingWrites.length,0,'invalid room entry, timers and exit never write personal saves');
}
console.log('PASS: group-room admission, authoritative edits, peers, pause/close gates, feature restrictions and personal-save isolation.');
