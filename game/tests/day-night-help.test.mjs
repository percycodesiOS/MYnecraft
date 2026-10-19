// Exercise the actual clock and keyboard handlers, including menu/inventory pauses.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const Three=await import(new URL('../vendor/three.module.js',import.meta.url));
const events={};
class Element{
  constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';}
  appendChild(e){this.children.push(e);}append(...es){this.children.push(...es);}
  addEventListener(k,f){(this.events[k]??=[]).push(f);}setAttribute(k,v){this[k]=v;}focus(){}
  getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
const elements={},document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(k,f){(events[k]??=[]).push(f);},exitPointerLock(){}};
let saved=JSON.stringify({edits:{},player:{x:47.5,y:6.7,z:35.5,sel:8},dayTime:.12});
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,addEventListener(k,f){(events[k]??=[]).push(f);},
  localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem(){saved=null;}},location:{reload(){}},confirm:()=>true});
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'')+`
globalThis.api={advanceWorldClock,setDayNightMode,normalizeDayNightMode,startGame,pauseGame,openInventory,closeInventory,tick,player,sun,scene,keys,sleepTransition,setMovementHelpVisible,dayNightSelect,movementHelpCheckbox,timeLabel,
  get time(){return dayTime;},set time(t){dayTime=t;},get nightMode(){return dayNightMode;},get remaining(){return sleepRemaining;},get help(){return movementHelpVisible;}};`;
vm.runInContext(source,context);
const a=context.api;
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-9,message);
const key=(code,options={})=>{for(const fn of events.keydown||[])fn({code,preventDefault(){},...options});};

assert.equal(a.nightMode,'auto-sleep','old worlds default to the requested quick sleep');
assert.equal(a.normalizeDayNightMode('invalid'),'auto-sleep');
assert.equal(a.help,true);
a.startGame();a.time=.5-.025/1200;
const before=a.player.pos.clone();a.keys.KeyW=true;
a.tick(50);
assert.equal(a.time,.5,'sleep starts at 6 PM, even when a frame crosses it');
assert.equal(a.remaining,1);
assert.equal(a.sleepTransition.hidden,false);
assert.equal(a.keys.KeyW,false,'sleep clears held movement');
assert.equal(a.player.pos.distanceTo(before),0,'no movement during the sleep transition');

a.advanceWorldClock(.4);near(a.remaining,.6);
a.pauseGame();a.advanceWorldClock(30);near(a.remaining,.6,'menu time does not consume sleep');
a.startGame();a.openInventory();a.advanceWorldClock(30);near(a.remaining,.6,'inventory time does not consume sleep');
a.closeInventory();a.advanceWorldClock(.59);assert(a.remaining>0,'sleep must last the full active second');
a.advanceWorldClock(.01);
assert.equal(a.remaining,0);assert.equal(a.time,0,'wake at 6 AM');assert.equal(a.sleepTransition.hidden,true);
assert.match(a.timeLabel(),/^6:00 AM/);assert.match(elements.status.textContent,/Good morning/);

// Opening an older save at night sleeps on the next active frame, not in the menu.
a.time=.8;a.pauseGame();a.advanceWorldClock(.05);assert.equal(a.time,.8);
a.startGame();a.advanceWorldClock(.05);assert.equal(a.remaining,1);
a.setDayNightMode('full-cycle');assert.equal(a.remaining,0);assert.equal(a.sleepTransition.hidden,true);
a.time=.5;a.advanceWorldClock(.05);near(a.time,.5+.05/1200,'Full day/night retains the original clock speed');
a.time=.99999;a.advanceWorldClock(.05);near(a.time,(.99999+.05/1200)%1,'Full day/night wraps normally');

// Always day advances the real schedule clock, while its rendered sun stays up.
a.setDayNightMode('always-day');a.time=.8;a.tick(100);
near(a.time,.8+.05/1200,'Always day does not freeze school schedules');
near(a.sun.position.y,90,'Always day renders the sun at noon');
assert.match(a.timeLabel(),/AM.*☀/);
a.setDayNightMode('full-cycle');a.time=.8;a.tick(150);
assert(a.sun.position.y<0,'Full day/night still renders night');
a.setDayNightMode('auto-sleep');a.time=0;a.tick(200);
assert(a.scene.background.r>0.1,'wake-up sunrise is visibly lit');
a.time=.5;a.tick(250);assert.equal(a.remaining,1);
a.tick(1250);assert.equal(a.remaining,0,'sleep lasts one active second even when frame rate is slow');
assert.equal(a.time,0);

// H changes only help, ignores key repeat and form typing, and can restore it.
key('KeyH');assert.equal(a.help,false);assert.equal(elements.info.style.display,'none');assert.equal(elements.mouseHint.style.display,'none');
key('KeyH',{repeat:true});assert.equal(a.help,false);
key('KeyH',{target:{tagName:'INPUT'}});assert.equal(a.help,false);
key('KeyH');assert.equal(a.help,true);assert.equal(elements.info.style.display,'');assert.equal(elements.mouseHint.style.display,'');
a.pauseGame();key('KeyH');assert.equal(a.help,true,'typing in the paused menu does not change help');
a.movementHelpCheckbox.checked=false;for(const fn of a.movementHelpCheckbox.events.change)fn();
assert.equal(a.help,false,'the menu checkbox supports touch devices');
a.dayNightSelect.value='always-day';for(const fn of a.dayNightSelect.events.change)fn();assert.equal(a.nightMode,'always-day');
console.log('Day/night, active-second sleep, schedule clock, and movement help checks passed.');
