// Run: node game/tests/building-tools.test.mjs
// Uses the exact Three.js version pinned by the game; no browser or real saves are touched.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const threeURL=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three=await import(new URL(threeURL,new URL('../mynecraft.html',import.meta.url)));
const events={};
class Element{
 constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';this.getBoundingClientRect=()=>({left:0,top:0,width:132,height:132,right:132,bottom:132});}
 appendChild(e){this.children.push(e);} append(...es){this.children.push(...es);}
 addEventListener(k,f){(this.events[k]??=[]).push(f);} setAttribute(k,v){this[k]=v;}
 getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
const elements=Object.fromEntries(['start','enter','mode','modeHelp','status','info'].map(k=>[k,new Element()]));
const document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(k,f){(events[k]??=[]).push(f);},exitPointerLock(){}};
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};this.renderCount=0;}setPixelRatio(value){this.pixelRatio=value;}setSize(){}render(){this.renderCount++;}}
let saved=JSON.stringify({edits:{'25,20,25':'snow'},player:{x:1,y:18,z:12,sel:8}}),reloaded=false;
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class {load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:2,
 performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,
 addEventListener(k,f){(events[k]??=[]).push(f);},localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>{saved=null;}},location:{reload(){reloaded=true;}},confirm:()=>true});
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const instrumented=script+`\n globalThis.api={player,camera,startGame,tick,keys,setBlock,getBlock,waterLiftAt,saveAreaLabel,removeAreaLabel,readAreaLabels,readWorldBackup,restoreWorldBackup,worldBackupText,updateAreaLabelVisibility,areaLabelSprites,schoolWayfinding,campusActors,modeSelect,btnDown,
 get selected(){return selected;},get view(){return view;},
 get labels(){return areaLabels;},get health(){return health;},get breath(){return breath;},setBreath(v){breath=v;},modeTo(v){modeSelect.value=v;for(const fn of modeSelect.events.change)fn();}};`;
vm.runInContext(instrumented,context);
const a=context.api;
a.startGame();a.player.flying=false;a.player.pos.set(85.5,22.8,75.5);
for(let y=20;y<=34;y++)a.setBlock(85,y,75,null);
a.setBlock(85,20,75,'glow');
for(let y=21;y<=30;y++)a.setBlock(85,y,75,'water');
assert(a.waterLiftAt(85,21,75));assert(a.waterLiftAt(85,30,75));
assert.equal(a.waterLiftAt(85,31,75),false,'empty air is not a lift');
a.setBlock(85,25,75,null);assert.equal(a.waterLiftAt(85,30,75),false,'an air gap stops the lift');
a.setBlock(85,25,75,'water');a.setBlock(85,20,75,'stone');assert.equal(a.waterLiftAt(85,30,75),false,'ordinary water remains ordinary');
a.setBlock(85,20,75,'glow');
let now=1000;a.tick(now);const startY=a.player.pos.y;
for(let i=0;i<25;i++)a.tick(now+=50);
assert(a.player.pos.y>startY+4,'real physics lifts the player without jump or flight');
const upperY=a.player.pos.y;a.keys.ShiftLeft=true;
for(let i=0;i<15;i++)a.tick(now+=50);
assert(a.player.pos.y<upperY-1.5,'Shift descends in the water column');a.keys.ShiftLeft=false;
a.modeTo('survival');a.player.pos.set(85.5,24,75.5);a.setBreath(0);
a.tick(now+=50);assert.equal(a.breath,10,'powered water restores air in challenge mode');assert.equal(a.health,20);
a.btnDown.events.touchstart[0]({preventDefault(){}});assert.equal(a.keys.ShiftLeft,true,'touch DOWN works in the lift without flying');a.btnDown.events.touchend[0]();assert.equal(a.keys.ShiftLeft,false);
a.player.pos.set(85.5,28,75.5);a.setBlock(85,30,75,'glass');
for(let i=0;i<20;i++)a.tick(now+=50);
assert(a.player.pos.y<30,'solid roof collision is retained');
a.player.pos.set(85.5,23,75.5);
assert.match(a.saveAreaLabel('Music Studio'),/saved/);
assert.equal(a.labels.length,1);assert.equal(a.labels[0].text,'Music Studio');
const anchor={...a.labels[0]};a.player.pos.set(80,26,78);
assert.match(a.saveAreaLabel('Art Studio','0'),/saved/);
assert.equal(a.labels[0].x,anchor.x,'editing text does not move the sign');assert.equal(a.labels[0].y,anchor.y);assert.equal(a.labels[0].z,anchor.z);
assert.equal(a.labels[0].text,'Art Studio');
a.updateAreaLabelVisibility();assert.equal(a.areaLabelSprites[0].visible,true);
assert(a.areaLabelSprites[0].scale.x<=3,'area signs stay small');
a.player.pos.set(-80,20,-80);a.updateAreaLabelVisibility();assert.equal(a.areaLabelSprites[0].visible,false,'distant signs disappear');
const backup=a.readWorldBackup(a.worldBackupText());assert.equal(backup.areaLabels[0].text,'Art Studio');
const old=JSON.parse(a.worldBackupText());delete old.state.areaLabels;
assert.equal(a.readWorldBackup(JSON.stringify(old)).areaLabels.length,0,'old worlds with no area signs still import');
const bad=JSON.parse(a.worldBackupText());bad.state.areaLabels=[{text:'Bad',x:Infinity,y:0,z:0}];
assert.throws(()=>a.readWorldBackup(JSON.stringify(bad)),/area signs/);
const beforeFailedImport=saved;
assert.throws(()=>a.restoreWorldBackup(JSON.stringify(bad)),/area signs/);
assert.equal(saved,beforeFailedImport,'failed sign import does not mutate storage');assert.equal(reloaded,false);
assert.throws(()=>a.readAreaLabels([{text:'Bad\nname',x:0,y:10,z:0}]),/area signs/);
assert.match(a.saveAreaLabel('x'.repeat(33)),/1 to 32/);assert.equal(a.labels.length,1);
assert.match(a.removeAreaLabel('0'),/removed/);assert.equal(a.labels.length,0);assert.equal(a.areaLabelSprites.length,0);
a.player.pos.set(80,20,70);
for(let i=0;i<40;i++)a.saveAreaLabel('Space '+i);
assert.match(a.saveAreaLabel('Too many'),/40 signs/);assert.equal(a.labels.length,40);
assert.equal(a.schoolWayfinding.length,2);assert(a.schoolWayfinding.every(s=>/^EC[EM]S/.test(s.name)));
assert(a.campusActors.every(actor=>!actor.nameTag||!actor.nameTag.visible),'floating person markers stay hidden');
assert.equal(a.readWorldBackup(a.worldBackupText()).areaLabels.length,40);
a.modeTo('creative');a.startGame();a.player.flying=false;
const beforeForm={selected:a.selected,view:a.view};
for(const tagName of ['INPUT','SELECT','TEXTAREA','BUTTON'])for(const code of ['KeyF','KeyV','Digit2','BracketRight','Space']){
  for(const fn of events.keydown)fn({code,target:{tagName},preventDefault(){}});
  assert.equal(a.player.flying,false,'editing a form never toggles flight');assert.equal(a.view,beforeForm.view);
  assert.equal(a.selected,beforeForm.selected);assert(!a.keys.Space,'space in a form does not move the player');
}
console.log('PASS: working water lift, descent, touch DOWN, air, gaps and roof collisions; saved/editable/bounded area signs, legacy backups and two building labels.');
