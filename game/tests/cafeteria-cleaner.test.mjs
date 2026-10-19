import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as Three from '../vendor/three.module.js';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const cleanerSource=await fs.readFile(new URL('../cafeteria-cleaner.js',import.meta.url),'utf8');
class Element{
  constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';}
  appendChild(e){this.children.push(e);}append(...es){this.children.push(...es);}
  addEventListener(k,f){(this.events[k]??=[]).push(f);}setAttribute(k,v){this[k]=v;}focus(){}
  getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
const elements={},document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(){},exitPointerLock(){}};
let saved=JSON.stringify({edits:{},player:{x:47.5,y:6.7,z:35.5,sel:8},dayTime:.12});
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,addEventListener(){},
  localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem(){saved=null;}},location:{reload(){}},confirm:()=>true});
vm.runInContext(cleanerSource,context);
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'')+`
globalThis.api={cafeteriaCleaner,scene,startGame,pauseGame,getBlock,setBlock,officerCafeteriaBounds};`;
vm.runInContext(source,context);
const a=context.api,c=a.cafeteriaCleaner,rules=context.MYNE_CAFETERIA_CLEANER;
const at=(h,m=0)=>(h*60+m-360+1440)%1440/1440;
assert(!rules.onDuty(at(13,59.99)));
assert(rules.onDuty(at(14)));
assert(rules.onDuty(at(14,59.99)));
assert(!rules.onDuty(at(15)));
assert(!rules.onDuty(at(2)));
assert.equal(c.group.name,'Cafeteria custodian');
for(const name of ['Gray scrubber chassis','Black shirt','Blue jeans leg','Black hair','Glasses frame','Goatee','Steering wheel','Rotating floor brush'])assert(c.group.getObjectByName(name),name);
assert.equal(a.scene.getObjectsByProperty('name','Cafeteria custodian').length,1);
assert(!c.group.visible,'no morning cleaning shift');
a.startGame();c.sync(at(14));
assert(c.group.visible,'shift appears at 2 PM');
assert(c.route.length>=8,`actual cafeteria has a usable sweep route, found ${c.route.length} points`);
for(const p of c.route){assert(c.fits(p.x,p.z),'whole machine clears actual cafeteria and visible tables');assert(p.x>=38&&p.x<=50&&p.z>=-12&&p.z<=-2);}
const first=c.group.position.clone();
let time=at(14),totalMoved=0;
for(let i=0;i<999;i++){
  const previous=c.group.position.clone();time+=.05/1200;c.update(.05,time);
  assert(c.group.visible&&c.fits(c.group.position.x,c.group.position.z),'the entire machine remains in clear cafeteria floor space');
  const d=c.group.position.distanceTo(previous);assert(d<.046,'normal shift never teleports');totalMoved+=d;
}
assert(totalMoved>30,'the custodian rides around throughout the game hour');
c.update(.05,at(15));assert(!c.group.visible,'shift ends at 3 PM');
c.sync(at(14));assert(c.group.position.distanceTo(first)<1e-9,'the next day starts the same route');

// Pausing freezes position and schedule state, regardless of caller time.
const paused=c.group.position.clone();a.pauseGame();c.update(20,at(15));
assert(c.group.visible);assert(c.group.position.distanceTo(paused)<1e-9);
a.startGame();

// Edits can block a machine, but can never make it drive through a block.
time=at(14);c.sync(time);
const obstacle=c.route.find(p=>Math.hypot(p.x-first.x,p.z-first.z)>2.4);
assert(obstacle,'test needs a future route cell');
const ox=Math.floor(obstacle.x),oz=Math.floor(obstacle.z),old=a.getBlock(ox,5,oz);
a.setBlock(ox,5,oz,'stone');
let stopped=false;
for(let i=0;i<400;i++){time+=.05/1200;c.update(.05,time);stopped ||= c.blocked;assert(!c.group.visible||c.fits(c.group.position.x,c.group.position.z),'new blocks do not clip the scrubber');}
assert(stopped,'custodian stops for a newly blocked aisle');
a.setBlock(ox,5,oz,old??null);const stoppedAt=c.group.position.clone();
for(let i=0;i<80;i++){time+=.05/1200;c.update(.05,time);}
assert(c.group.position.distanceTo(stoppedAt)>.2,'clearing the aisle lets the same route resume');

c.sync(at(14,30));const loaded=c.group.position.clone();c.sync(at(14,30));
assert(c.group.position.distanceTo(loaded)<1e-9,'loading the same game time restores the same shift position');
assert.equal(a.scene.getObjectsByProperty('name','Cafeteria custodian').length,1,'clock jumps do not duplicate the character');
c.dispose();assert.equal(a.scene.getObjectsByProperty('name','Cafeteria custodian').length,0);
console.log('PASS: 2-3 PM cafeteria cleaning, actual-table clearance, pauses, edits, daily replay, reload position and procedural appearance.');
