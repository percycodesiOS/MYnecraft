// Run: node game/tests/mynecraft.test.mjs
// Uses the exact Three.js version pinned by the game; no browser or real saves are touched.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const threeURL=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three=await import(new URL(threeURL,new URL('../mynecraft.html',import.meta.url)));
const events={};
class Element{
 constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';}
 appendChild(e){this.children.push(e);} append(...es){this.children.push(...es);}
 addEventListener(k,f){(this.events[k]??=[]).push(f);} setAttribute(k,v){this[k]=v;}
 getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
const elements=Object.fromEntries(['start','enter','mode','modeHelp','status','info'].map(k=>[k,new Element()]));
const document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(k,f){(events[k]??=[]).push(f);},exitPointerLock(){}};
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};this.renderCount=0;}setPixelRatio(value){this.pixelRatio=value;}setSize(){}render(){this.renderCount++;}}
let saved=JSON.stringify({edits:{'25,20,25':'snow'},player:{x:44.5,y:12.7001,z:-3.5,sel:8,flying:false}}),reloaded=false;
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class {load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:2,
 performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,
 addEventListener(k,f){(events[k]??=[]).push(f);},localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>{saved=null;}},location:{reload(){reloaded=true;}},confirm:()=>true});
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');

const instrumented=script+`\n globalThis.api={WORLD,instMeshes,player,getBlock,setBlock,isSolid,schoolFootprint,CIRC_ROOM,SCHOOL_STAIRS,SCHOOL_RAMP,rampCells,FLAGPOLE,PARKING,VESTIBULE,learningCommunities,atriumOpenings,atriumRailCells,cafeteriaTV,entranceDoors,bollardPositions,bollards,americanFlag,schoolWayfinding,walkingPath,walkFeet,moveHorizontal,collideAxis,canStandAt,campusBounds,schoolInteriorBounds,circTables,cafeteriaTables,unicornPatrol,sirPatrol,macekPatrol,eilerPatrol,sleevesPatrol,cookiePatrol,schoolLogo,recoverSchoolSavePosition,schoolLights,setGraphics};`;
vm.runInContext(instrumented,context);
const a=context.api;
assert(Math.abs(a.player.pos.y-12.7001)<.001,'old upper-floor save recovers on the same floor');
assert(a.isSolid(Math.floor(a.player.pos.x),10,Math.floor(a.player.pos.z)),'old save no longer floats above the new atrium');
assert.equal(a.getBlock(25,20,25),'snow','existing user edit survives the school update');
for(const [x,z]of [...a.atriumOpenings.map(p=>[p.x,p.z]),[44,18],[48,18],[44,20],[48,22]])for(const feet of [5,11]){
 const pos=new Three.Vector3(x+.5,feet+1.7001,z+.5);a.recoverSchoolSavePosition(pos);
 assert(Math.abs(pos.y-feet-1.7001)<.001,'school recovery does not push a player onto the roof');
 assert(a.canStandAt(pos)&&a.isSolid(Math.floor(pos.x),feet-1,Math.floor(pos.z)),'old school positions recover to supported clear floor');
}
const flying=new Three.Vector3(44.5,12.7001,-3.5);a.recoverSchoolSavePosition(flying,true);assert.equal(flying.z,-3.5,'valid Creative flight is not snapped to a floor');
for(const {x,z}of a.atriumRailCells){assert(a.isSolid(x,11,z)&&a.isSolid(x,12,z),'balcony guard is real collision');}
a.setGraphics('smooth');assert.equal(a.schoolLights.filter(l=>l.visible).length,1,'Smooth has one unshadowed room-light budget');
a.setGraphics('detailed');assert.equal(a.schoolLights.filter(l=>l.visible).length,4);a.setGraphics('smooth');
const entrance={x:46.5,y:5,z:26.5};
const route=(from,to,label,bounds=a.campusBounds)=>{
 const result=a.walkingPath(from,to,bounds);assert(result.length>0,label+' is reachable');
 for(const p of result){assert.equal(a.walkFeet(p.x,p.z,p.y),p.y,label+' has solid walkable floor');assert(a.canStandAt(new Three.Vector3(p.x+.5,p.y+1.7001,p.z+.5)),label+' has player-width headroom');}
 return result;
};
const walkPlayer=(from,steps,label)=>{
 a.player.pos.set(from.x,from.y+1.7001,from.z);a.player.onGround=true;a.player.flying=false;a.player.vel.set(0,0,0);
 for(const p of steps){
  const tx=p.x+.5,tz=p.z+.5;
  for(let frame=0;frame<100&&(Math.abs(a.player.pos.x-tx)>.001||Math.abs(a.player.pos.z-tz)>.001||Math.abs(a.player.pos.y-p.y-1.7001)>.02);frame++){
   a.moveHorizontal('x',Math.max(-.12,Math.min(.12,tx-a.player.pos.x)));
   a.moveHorizontal('z',Math.max(-.12,Math.min(.12,tz-a.player.pos.z)));
   a.collideAxis('y',-.15);
  }
  assert(Math.abs(a.player.pos.x-tx)<.01&&Math.abs(a.player.pos.z-tz)<.01,label+' walks cell '+p.x+','+p.z);
  assert(Math.abs(a.player.pos.y-p.y-1.7001)<.03,label+' reaches each elevation');
  assert(a.canStandAt(a.player.pos),label+' remains clear of blocks');
 }
};
const upper={x:47.5,y:11,z:16.5};
route(entrance,upper,'upper floor');route(upper,entrance,'ground floor');
route(entrance,{x:54,y:5,z:-11},'CIRC centre');
route(entrance,{x:46,y:5,z:-5},'cafeteria');
route(entrance,{x:25,y:5,z:-24},'ECES wing');
route(entrance,{x:57,y:5,z:-24},'ECMS wing');
route(entrance,{x:a.FLAGPOLE.x+2,y:5,z:a.FLAGPOLE.z},'flagpole approach');
route(entrance,{x:78,y:5,z:-10},'outdoor classroom');
walkPlayer(entrance,route(entrance,{x:31,y:5,z:7},'elementary cafeteria'),'elementary cafeteria');
for(const c of a.learningCommunities)walkPlayer(entrance,route(entrance,c,c.name),c.name);
walkPlayer(entrance,route(entrance,{x:40,y:11,z:12},'kindergarten landing'),'kindergarten landing');
walkPlayer(entrance,route(entrance,{x:20,y:5,z:73},'left parking lot'),'left parking lot');
assert.equal(a.entranceDoors.length,4,'outer and inner glass door pairs exist');
for(const z of [18,23])for(let x=45;x<=47;x++)assert(a.canStandAt(new Three.Vector3(x+.5,6.7001,z+.5)),'both vestibule doorways retain full player clearance');
assert(a.atriumOpenings.length>80,'main dining area has an open two-storey atrium');
assert(a.cafeteriaTV.position.y>10,'main cafeteria TV hangs above the ground-floor heads');
// Each independent ascent must work with the other one disabled.
const stairs=[];
for(let x=a.SCHOOL_STAIRS.x0;x<=a.SCHOOL_STAIRS.x1;x++)for(let z=5;z<=10;z++)for(let y=5;y<=14;y++){
 stairs.push([x,y,z,a.getBlock(x,y,z)]);a.setBlock(x,y,z,null);
}
walkPlayer(entrance,route(entrance,upper,'curved rising walkway without the straight stairs'),'curved walkway');
for(const [x,y,z,v]of stairs)a.setBlock(x,y,z,v);
const ramps=[];
for(const {x,z}of a.rampCells)for(let y=5;y<=14;y++){ramps.push([x,y,z,a.getBlock(x,y,z)]);a.setBlock(x,y,z,null);}
walkPlayer(entrance,route(entrance,upper,'right staircase without the curved walkway'),'right stair');
for(const [x,y,z,v]of ramps)a.setBlock(x,y,z,v);
// Exercise the real player collision/auto-step at the bottom of the right stair.
a.player.pos.set(54.5,6.7001,11.35);a.player.onGround=true;a.player.flying=false;
a.moveHorizontal('z',-.2);assert(a.player.pos.y>7.6,'player steps onto the right staircase');assert(a.canStandAt(a.player.pos));
for(const {x,z}of a.bollardPositions){
 assert(a.isSolid(Math.floor(x),4,Math.floor(z)),'bollard rests on real pavement');
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)assert(!a.schoolFootprint(Math.floor(x+dx),Math.floor(z+dz)),'bollard plus one-cell clearance stays outside the school');
 assert(Math.abs(x-46.5)>3,'bollard leaves the main approach clear');
}
assert.equal(a.americanFlag.name,'American flag at the front approach');
assert(!a.schoolFootprint(a.FLAGPOLE.x,a.FLAGPOLE.z),'flagpole stays outdoors');
assert.equal(a.FLAGPOLE.x,46);assert.equal(a.FLAGPOLE.z,40,'flag is centered on the entrance-circle island');
assert.equal(a.getBlock(a.FLAGPOLE.x,4,a.FLAGPOLE.z),'grass','flag remains on the island rather than the road');
assert(a.schoolWayfinding.find(l=>l.name.startsWith('ECES')).position.x<a.schoolWayfinding.find(l=>l.name.startsWith('ECMS')).position.x,'ECES left and ECMS right from the front');
assert(a.schoolWayfinding.some(l=>l.name==='Kindergarten · Floor 2'&&l.position.y>11));
assert(a.schoolWayfinding.some(l=>l.name==='CIRC'&&l.position.y<10));
for(const [name,stops]of [['Mr B',a.unicornPatrol],['Sir D',a.sirPatrol],['Mr Macek',a.macekPatrol],['Mr Eiler',a.eilerPatrol],['Sleeves',a.sleevesPatrol],['Cookie Man',a.cookiePatrol]])
 for(const [x,y,z] of stops)assert.equal(a.walkFeet(x,z,y),y,`${name} patrol ${x},${z} retains clear floor`);
for(const [x,z]of [[58,60],[58,70],[45,75]])for(let y=a.getBlock(x,0,z)?0:1;y<=4;y++)assert(a.isSolid(x,y,z),'new pavement is supported through the underlying grade');
for(const x of [45,46,47,49,50,51,52,53,54])for(let z=17;z<=22;z++)assert(a.canStandAt(new Three.Vector3(x+.5,6.7001,z+.5)),`vestibule aisle and reception remain clear at ${x},${z}`);
const triangles=Object.values(a.instMeshes).reduce((n,m)=>n+m.count*m.geometry.index.count/3,0);assert(triangles<200000,'campus remains within the enlarged terrain triangle budget');
console.log(`PASS campus layout: independent stairs and circular walkway, full collision clearance, CIRC/cafeteria/wings/flag/outdoor routes, exterior bollards, wayfinding, NPC stops. Terrain triangles: ${triangles}`);
