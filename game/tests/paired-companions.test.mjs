// Run: node game/tests/character-review.test.mjs
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
let saved=JSON.stringify({edits:{'25,20,25':'snow'},player:{x:47.5,y:6.7,z:35.5,sel:8},campus:[{name:'MaCEk',x:47.5,y:5,z:29.5,patrolIndex:2},{name:'Mr Unicorn 🦄',x:46.5,y:5,z:14.5,patrolIndex:3},{name:'Cookie Monster',x:32.5,y:5,z:-11.5,patrolIndex:4}]}),reloaded=false;
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class {load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:2,
 performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,
 addEventListener(k,f){(events[k]??=[]).push(f);},localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>{saved=null;}},location:{reload(){reloaded=true;}},confirm:()=>true});
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const instrumented=script+`\n globalThis.api={WORLD,instMeshes,buildMeshes,player,camera,npcs,animals,hotbar,resetBtn,modeSelect,startGame,doPlace,doBreak,castVoxel,persistSave,worldBackupText,readWorldBackup,restoreWorldBackup,tick,isSolid,isExposed,
 get time(){return dayTime;},get health(){return health;},get mode(){return gameMode;},get inventory(){return inventory;},get selected(){return selected;},
 select(i){selected=i;},pause(){started=false;},modeTo(v){modeSelect.value=v;for(const change of modeSelect.events.change)change();},get keys(){return BLOCK_KEYS;},getBlock,setBlock,campusActors,sirD,macek,kay,ellie,percy,walkingPath,campusBounds,insideBounds,updateCampus,entranceDoors,moveHorizontal,canStandAt,
 micco,campusAreas,believeBanner,floorLogo,campusDetails,cloudGroup,cloudMesh,clouds,updateClouds,spawnParticles,updateParticles,particles,shardMaterial,setMacekOutfit,patternedSleeve,updateBlockMeshes,faceSlots,faceDirections,faceVisible,travelTo,setGraphics,graphicsBtn,graphicsSelect,renderer,schoolLogo,CampusActor,createWalkingSearch,PATH_STEP_NODES,
 shields,unicorn,unicornPatrol,shieldsSeated,SHIELDS_CYCLE,SHIELDS_SIT,updateShields,schoolInteriorBounds,schoolFootprint,skinTex,
 eddie,eddieRoost,eddiePerch,eddieFacing,updateEddie,EDDIE_ROCK,EDDIE_ROOF,EDDIE_DUSK,EDDIE_DAWN,
 buses,updateBuses,busRouteDistance,busRoutePoint,busAtKerb,busStopDistances,BUS_ARRIVE,BUS_COUNT,BUS_STAGGER,BUS_DRIVE_IN,BUS_DWELL,BUS_DRIVE_OUT,BUS_VISIT,BUS_LOOP,busRouteLength,BUS_ROUTE,
 playerAvatar,staffLook,viewArms,viewModel,macekBodies,macekClothes,identityStatus,worldClockEl,setView,updatePlayerAvatar,viewSelect,viewBtn,groundSurface,inBusYard,
 bubble,showBubble,SHIELDS_LINES,heightAt,nearestWalkPoint,walkFeet,
 eiler,eilerPatrol,entranceStaffBounds,canonicalCampusName,updateCompanions,companionAnchor,companionPair,ellieGoal,percyGoal,saveState,worldBounds,sleeves,sleevesBounds,sleevesPatrol,js,jsBounds,jsStops,jsRoutine,updateJs,playgroundSwings,scene,get view(){return view;},get macekOutfit(){return macekOutfit;},
 setTime(t){dayTime=t;}};`;
vm.runInContext(instrumented,context);
const a=context.api;

// Real campus voxel navigation, with a wide school-yard lane to measure formation.
for(let x=14;x<=37;x++)for(let z=45;z<=73;z++){
 a.setBlock(x,4,z,'stone');for(let y=5;y<=9;y++)a.setBlock(x,y,z,undefined);
}
a.player.pos.set(25.5,6.7,60.5);a.player.flying=false;a.player.yaw=0;
a.ellie.pos.set(26.5,5,58.5);a.percy.pos.set(24.5,5,58.5);
a.macek.pos.set(60.5,5,-10.5);
a.startGame();
let roamed=false,returned=false,sawRun=false,maxGap=0,maxStep=0,sideFrames=0,movingFrames=0;
let previous=[a.ellie.pos.clone(),a.percy.pos.clone()];
for(let n=0;n<3600;n++){
 const oldPhase=a.companionPair.phase;
 a.updateCompanions(1/60);
 const gap=a.ellie.pos.distanceTo(a.percy.pos);maxGap=Math.max(maxGap,gap);
 for(const [i,dog] of [a.ellie,a.percy].entries()){
  const step=dog.pos.distanceTo(previous[i]);maxStep=Math.max(maxStep,step);previous[i].copy(dog.pos);
  assert(dog.invulnerable);assert(a.walkFeet(Math.floor(dog.pos.x),Math.floor(dog.pos.z),dog.pos.y)!==null,'every step stays on walkable cells');
 }
 if(a.companionPair.phase==='roam'){
  roamed=true;sawRun ||= a.ellie.speed>3||a.percy.speed>3;
  if(a.ellie.route.length&&a.percy.route.length){movingFrames++;if(gap>=1&&gap<3)sideFrames++;}
 }
 if(roamed&&oldPhase==='return'&&a.companionPair.phase==='rest')returned=true;
}
console.log({roamed,returned,sawRun,maxGap,maxStep,sideFrames,movingFrames,phase:a.companionPair.phase,ellie:a.ellie.pos,percy:a.percy.pos});
assert(roamed&&returned,'both dogs go on an outing and return to the player');assert(sawRun,'outings include running');
assert(maxGap<5,'friends remain a close pair on the open route');assert(maxStep<.25,'no catch-up teleport');
assert(sideFrames>movingFrames*.65,'side by side through most of the open route');
// Recalling the pair follows the player rather than the independently walking NPC.
a.player.pos.set(17.5,6.7,48.5);
let reachedNewHome=false;
for(let n=0;n<1800;n++){
 a.updateCompanions(1/60);
 if(a.companionPair.phase==='rest'&&[a.ellie,a.percy].every(d=>d.pos.distanceTo({x:17.5,y:5,z:48.5})<4)){reachedNewHome=true;break;}
}
assert(reachedNewHome,'a changed player position recalls both dogs');
// A tall wall across their next outing must be navigated, never crossed.
for(let z=44;z<60;z++)for(let y=5;y<8;y++)a.setBlock(21,y,z,'stone');
a.player.pos.set(29.5,6.7,48.5);
let gotAroundWall=false;
for(let n=0;n<3600;n++){
 a.updateCompanions(1/60);
 for(const dog of [a.ellie,a.percy])assert(!a.getBlock(Math.floor(dog.pos.x),Math.ceil(dog.pos.y),Math.floor(dog.pos.z)),'dogs never occupy wall blocks');
 if(a.companionPair.phase==='rest'){gotAroundWall=true;break;}
}
assert(gotAroundWall,'the pair routes around the wall to return');
const home={...a.companionAnchor};a.player.flying=true;a.player.pos.set(100,35,70);
for(let n=0;n<60;n++)a.updateCompanions(1/60);
assert.equal(a.companionAnchor.x,home.x);assert.equal(a.companionAnchor.y,home.y);assert.equal(a.companionAnchor.z,home.z);
assert([a.ellie,a.percy].every(d=>d.pos.y<10),'dogs remain on their last grounded floor while the player flies');
// A return on the upper floor uses real stairs; no vertical snapping.
a.player.flying=false;a.player.pos.set(47.5,12.7,16.5);a.player.yaw=0;
a.ellie.pos.set(46.5,5,29.5);a.percy.pos.set(48.5,5,29.5);
for(const dog of [a.ellie,a.percy]){dog.route=[];dog.navigationSearch=null;dog.companionGoal='';}
let upstairs=false;
for(let n=0;n<18000;n++){
 a.updateCompanions(1/60);
 if(a.companionPair.phase==='rest'&&[a.ellie,a.percy].every(d=>Math.abs(d.pos.y-11)<.2)){upstairs=true;break;}
}
console.log('upstairs',upstairs,a.companionPair.phase,a.ellie.pos,a.percy.pos);
assert(upstairs,'both dogs use the stairs to return to the player upstairs');
// The real render loop freezes positions and the outing timer while the menu is open.
a.pause();const paused=[a.ellie.pos.clone(),a.percy.pos.clone(),a.companionPair.elapsed];
for(let n=0;n<30;n++)a.tick(n*100);
assert(a.ellie.pos.equals(paused[0]));assert(a.percy.pos.equals(paused[1]));assert.equal(a.companionPair.elapsed,paused[2]);
console.log('PASS: paired school-yard walking/running, recall to grounded player, collision-safe wall route, flying fallback, and menu pause.');
