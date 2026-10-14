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
 playerAvatar,viewArms,viewModel,macekBodies,macekClothes,outfitPolo,outfitBlack,identityStatus,worldClockEl,setView,refreshOutfitPreview,updatePlayerAvatar,viewSelect,viewBtn,groundSurface,inBusYard,
 bubble,showBubble,SHIELDS_LINES,heightAt,nearestWalkPoint,walkFeet,
 eiler,eilerPatrol,entranceStaffBounds,canonicalCampusName,updateCompanions,companionAnchor,saveState,worldBounds,sleeves,sleevesBounds,sleevesPatrol,js,jsBounds,jsStops,jsRoutine,updateJs,playgroundSwings,scene,get view(){return view;},get macekOutfit(){return macekOutfit;},
 setTime(t){dayTime=t;}};`;
vm.runInContext(instrumented,context);
const a=context.api;

// Legacy labels are migration aliases; saves and all visible identities use the new names.
assert.equal(a.macek.name,'Mr. Macek');assert.equal(a.macek.patrolIndex,2);
assert.equal(a.unicorn.name,'Mr. B');assert.equal(a.unicorn.patrolIndex,3);
assert.equal(a.eiler.name,'Mr. Eiler');assert.equal(a.campusActors.length,13);assert.equal(a.campusActors[9].name,'Cookie Man');assert.equal(a.campusActors[7].name,'Mr. B');
assert.equal(a.campusActors[9].patrolIndex,4,'the old custodian name restores his saved patrol progress');
assert.equal(a.canonicalCampusName('Cookie Monster'),'Cookie Man');
assert.equal(a.canonicalCampusName('MaCEk'),'Mr. Macek');
assert.equal(a.canonicalCampusName('Mr Unicorn 🦄'),'Mr. B');
let backup=JSON.parse(a.worldBackupText());
backup.state.campus[1].name='MaCEk';backup.state.campus[7].name='Mr Unicorn 🦄';backup.state.campus[9].name='Cookie Monster';
const restored=a.readWorldBackup(JSON.stringify(backup));
assert.equal(restored.campus[1].name,'Mr. Macek');assert.equal(restored.campus[7].name,'Mr. B');
assert.equal(restored.campus.length,13);assert.equal(restored.campus[9].name,'Cookie Man');assert.equal(a.getBlock(25,20,25),'snow');
// NPC and player use the exact same cached face, shirt and sleeves, including the collar details.
assert.equal(a.macek.head.material[4].map,a.playerAvatar.head.material[4].map);
assert.equal(a.macek.head.geometry.parameters.width,a.playerAvatar.head.geometry.parameters.width);
assert.equal(a.macek.head.material[4].map.colorSpace,Three.SRGBColorSpace);
for(const arm of Object.values(a.viewArms))assert.equal(arm.userData.hand.material[4].map,a.skinTex,'first-person hands keep skin when outfits change');
for(const slot of a.hotbar.children)assert.equal(slot.children.length,2,'textured block thumbnail survives separate quantity updates');
assert.equal(a.macek.group.userData.portrait,'Gators lanyard');
for(const look of ['polo','black']){
 a.setMacekOutfit(look);
 for(const character of [a.macek,a.playerAvatar]){
  assert.equal(character.body.material[4].map,a.macekClothes[look]);
  assert.equal(character.armR.children[0].material[4].map,a.patternedSleeve);
  assert.equal(character.armL.children[0].material[4].map,look==='black'?a.patternedSleeve:a.skinTex);
  assert(character.poloCollars.every(c=>c.visible===(look==='polo')));
  assert(character.shoulderCaps.every(c=>c.material[4].map===a.macekClothes[look]));
 }
}
assert.equal(a.unicorn.laptop.rotation.y,Math.PI,'laptop screen is turned back toward wearer');
assert.equal(a.unicorn.laptop.userData.carryArm,'armL');
assert.equal(a.unicorn.armLockL,-1.32);assert.equal(a.unicorn.armLockR,undefined);
let freeArmMoved=false;
for(let i=0;i<120;i++){a.unicorn.patrol(.05,a.unicornPatrol);assert.equal(a.unicorn.armL.rotation.x,-1.32);freeArmMoved ||= Math.abs(a.unicorn.armR.rotation.x)>.1;}
assert(freeArmMoved,'free arm swings while carrying the laptop with one arm');
// Entrance staff can walk but can never plan a route beyond their compact entrance post.
let maxShieldsDistance=0,sawSeated=false,sawStanding=false;
for(let i=0;i<2600;i++){
 a.updateShields(.05,a.player.pos);a.eiler.patrol(.05,a.eilerPatrol);
 maxShieldsDistance=Math.max(maxShieldsDistance,Math.hypot(a.shields.pos.x-50.5,a.shields.pos.z-20.5));
 sawSeated ||= a.shields.poseBlend>.97;sawStanding ||= a.shields.poseBlend<.03;
 for(const actor of [a.shields,a.eiler]){
  assert(a.insideBounds(actor.pos.x,actor.pos.z,a.entranceStaffBounds),actor.name+' stays near entrance');
  assert(a.schoolFootprint(Math.floor(actor.pos.x),Math.floor(actor.pos.z)));
  assert.equal(a.walkFeet(Math.floor(actor.pos.x),Math.floor(actor.pos.z),actor.pos.y),5);
 }
}
assert(maxShieldsDistance>1.5,'Officer Shields actually takes a short walk');
assert(maxShieldsDistance<6,'patrol stays near the front desk');assert(sawSeated&&sawStanding);
// Dogs follow the campus Mr. Macek. A distant or flying player does not take them away.
a.macek.pos.set(25.5,5,-20.5);a.macek.group.rotation.y=Math.PI;a.macek.yaw=Math.PI;
a.player.pos.set(110,36,70);a.player.yaw=0;a.player.flying=true;
const before=a.ellie.pos.clone();a.updateCompanions(.05);
assert(a.ellie.pos.distanceTo(before)<0.4,'one frame walks toward Mr. Macek instead of snapping there');
let maxStep=0;const samples=[[a.ellie,a.ellie.pos.x,a.ellie.pos.y,a.ellie.pos.z],[a.percy,a.percy.pos.x,a.percy.pos.y,a.percy.pos.z]];
for(let i=0;i<900;i++){
 a.updateCompanions(.05);
 for(const s of samples){maxStep=Math.max(maxStep,Math.hypot(s[0].pos.x-s[1],s[0].pos.y-s[2],s[0].pos.z-s[3]));s[1]=s[0].pos.x;s[2]=s[0].pos.y;s[3]=s[0].pos.z;}
}
assert(maxStep<1.2,'the trail stays on walked steps');
for(const dog of [a.ellie,a.percy]){
 assert(dog.invulnerable);
 assert(Math.hypot(dog.pos.x-a.macek.pos.x,dog.pos.z-a.macek.pos.z)<5,dog.name+' reaches the distant Mr. Macek');
 assert(Math.hypot(dog.pos.x-a.player.pos.x,dog.pos.z-a.player.pos.z)>40,dog.name+' ignores the player');
 assert.equal(a.walkFeet(Math.floor(dog.pos.x),Math.floor(dog.pos.z),dog.pos.y),dog.pos.y);
}
assert(Math.hypot(a.ellie.pos.x-a.percy.pos.x,a.ellie.pos.z-a.percy.pos.z)>1,'Ellie and Percy keep different trailing offsets');
assert(Math.hypot(a.companionAnchor.x-a.macek.pos.x,a.companionAnchor.z-a.macek.pos.z)<.01);
a.player.pos.set(70,35,50);
for(let i=0;i<80;i++)a.updateCompanions(.05);
assert(Math.abs(a.companionAnchor.y-a.macek.pos.y)<.01,'a flying player does not lift the anchor');
for(const dog of [a.ellie,a.percy])assert(dog.pos.y<8,'dogs stay on Mr. Macek\'s floor while the player is in the air');
a.macek.pos.set(47.5,11,16.5);a.macek.group.rotation.y=0;
for(let i=0;i<1200;i++)a.updateCompanions(.05);
for(const dog of [a.ellie,a.percy]){
 assert(Math.abs(dog.pos.y-a.macek.pos.y)<2,dog.name+' climbs to Mr. Macek');
 assert(Math.hypot(dog.pos.x-a.macek.pos.x,dog.pos.z-a.macek.pos.z)<6);
 assert.equal(a.getBlock(Math.floor(dog.pos.x),Math.round(dog.pos.y),Math.floor(dog.pos.z)),undefined);
}
// Sleeves is visibly bigger than KaY, still miniature, with one patterned right
// arm and a compact walking route on the front lawn. Existing actor slots
// and old saves retain their identities when this twelfth character is added.
assert.equal(a.sleeves.name,'Sleeves');assert.equal(a.campusActors[11],a.sleeves);
assert(a.sleeves.group.scale.x>a.kay.group.scale.x*1.25);
assert(a.sleeves.group.scale.x<1);
assert(a.sleeves.group.getObjectByName('blond crop'));
assert.notEqual(a.sleeves.armR.children[0].material[0].map,a.sleeves.armL.children[0].material[0].map);
assert.equal(a.sleeves.group.userData.patternedArm,'armL');assert(a.sleeves.armL.position.x<0,'pattern is on the viewer-left arm from the front');
assert.equal(a.sleeves.legR.getObjectByName('tan clog').material.color.getHex(),0xb6aa91);
const sceneCount=a.scene.children.length;
let sleevesDistance=0,lastSleeves=a.sleeves.pos.clone();
for(let i=0;i<1800;i++){
 a.sleeves.patrol(.05,a.sleevesPatrol);
 assert(a.insideBounds(a.sleeves.pos.x,a.sleeves.pos.z,a.sleevesBounds),'Sleeves stays on his entrance route');
 assert(Math.hypot(a.sleeves.pos.x-46.5,a.sleeves.pos.z-24)>=5,'the lawn patrol does not hold the entrance doors open');
 assert.equal(a.walkFeet(Math.floor(a.sleeves.pos.x),Math.floor(a.sleeves.pos.z),a.sleeves.pos.y),5,JSON.stringify(a.sleeves.pos));
 assert(a.sleeves.pos.distanceTo(lastSleeves)<.1,'Sleeves walks without teleporting');
 sleevesDistance+=a.sleeves.pos.distanceTo(lastSleeves);lastSleeves.copy(a.sleeves.pos);
}
assert(sleevesDistance>30,'Sleeves actually walks several lawn circuits');
assert.equal(a.scene.children.length,sceneCount,'walking adds no new actors or scene meshes');
const withSleeves=JSON.parse(a.worldBackupText());
assert.equal(a.readWorldBackup(JSON.stringify(withSleeves)).campus.filter(c=>c.name==='Sleeves').length,1);
const legacySleeves=structuredClone(withSleeves);legacySleeves.state.campus=legacySleeves.state.campus.filter(c=>c.name!=='Sleeves'&&c.name!=='js');
assert.equal(a.readWorldBackup(JSON.stringify(legacySleeves)).campus.length,11,'pre-Sleeves backups still import');
for(const state of [withSleeves.state,legacySleeves.state]){
 const nextContext=vm.createContext({...context,api:undefined,localStorage:{getItem:()=>JSON.stringify(state),setItem(){},removeItem(){}}});
 vm.runInContext(instrumented,nextContext);
 assert.equal(nextContext.api.campusActors.filter(c=>c.name==='Sleeves').length,1,'a reload creates exactly one Sleeves');
 if(state===withSleeves.state)assert.equal(nextContext.api.sleeves.patrolIndex,a.sleeves.patrolIndex);
}
// js walks the playground, boards each existing swing and keeps his hips on the
// animated seat. Transitions stay continuous, and old saves gain him only once.
assert.equal(a.js.name,'js');assert.equal(a.campusActors[12],a.js);
assert(a.js.group.scale.x>a.kay.group.scale.x&&a.js.group.scale.x<1);
for(const name of ['light brown blond hair','side fringe','tied sweatshirt','orange lime shoe'])assert(a.js.group.getObjectByName(name),name);
const visitedSwings=new Set(),phases=new Set(),lastJs=a.js.group.position.clone();
const hip=new Three.Vector3(),seat=new Three.Vector3(),grip=new Three.Vector3();
let walked=0,swingRange=0,swingSave;
const previousGround=a.js.pos.clone(),jsSceneCount=a.scene.children.length;
for(let i=0;i<12000;i++){
 a.updateJs(1/60);phases.add(a.jsRoutine.phase);
 assert(a.insideBounds(a.js.pos.x,a.js.pos.z,a.jsBounds),'js stays on the playground');
 assert.equal(a.walkFeet(Math.floor(a.js.pos.x),Math.floor(a.js.pos.z),a.js.pos.y),5,'saved anchor stays on walkable ground');
 for(const x of [67.5,76.5])assert(Math.hypot(a.js.pos.x-x,a.js.pos.z-33.5)>.4,'route clears decorative swing support posts');
 assert(a.js.group.position.distanceTo(lastJs)<.15,'walking, boarding and leaving do not teleport');
 walked+=a.js.pos.distanceTo(previousGround);previousGround.copy(a.js.pos);lastJs.copy(a.js.group.position);
 if(a.jsRoutine.phase==='swing'){
  visitedSwings.add(a.jsRoutine.swing);
  const swing=a.playgroundSwings[a.jsRoutine.swing];
  a.js.group.updateMatrixWorld(true);swing.pivot.updateMatrixWorld(true);
  hip.set(0,.55,0).applyMatrix4(a.js.group.matrixWorld);
  seat.set(0,.05,0).applyMatrix4(swing.seat.matrixWorld);
  assert(hip.distanceTo(seat)<1e-8,'seated hips follow the exact swing seat transform');
  for(const [arm,side]of [[a.js.armL,-1],[a.js.armR,1]]){
   grip.set(0,-.75,0).applyMatrix4(arm.matrixWorld);
   assert(Math.abs(grip.x-swing.pivot.position.x-side*.4)<.03,'raised hands reach outward to the chains');
  }
  swingRange=Math.max(swingRange,Math.abs(swing.pivot.rotation.x));
  swingSave??=JSON.parse(a.worldBackupText()).state;
 }
}
assert(walked>100,'js really completes multiple playground loops');
assert.deepEqual([...visitedSwings].sort(),[0,1],'he takes turns on both swings');
for(const phase of ['walk','board','swing','leave'])assert(phases.has(phase),phase);
assert(swingRange>.4,'the occupied swing visibly moves');
assert.equal(a.scene.children.length,jsSceneCount,'the routine reuses existing scene objects');
const withJs=JSON.parse(a.worldBackupText());
assert.equal(a.readWorldBackup(JSON.stringify(withJs)).campus.filter(c=>c.name==='js').length,1);
const beforeJs=structuredClone(withJs.state);beforeJs.campus=beforeJs.campus.filter(c=>c.name!=='js');
for(const state of [beforeJs,swingSave]){
 const nextContext=vm.createContext({...context,api:undefined,localStorage:{getItem:()=>JSON.stringify(state),setItem(){},removeItem(){}}});
 vm.runInContext(instrumented,nextContext);
 const next=nextContext.api;
 assert.equal(next.campusActors.filter(c=>c.name==='js').length,1);
 assert.equal(next.campusActors.filter(c=>c.name==='Sleeves').length,1);
 assert.equal(next.jsRoutine.phase,'walk','a saved swing resumes safely on the ground');
 assert.equal(next.js.pos.y,5);assert.equal(next.js.group.position.y,5);
 assert.equal(next.getBlock(25,20,25),'snow','adding js preserves saved block edits');
}
// A blocked approach must not be accepted as the swing destination. Removing
// the wall allows the same actor to continue with his normal navigation retry.
a.jsRoutine.phase='walk';a.jsRoutine.swing=0;a.js.patrolIndex=a.jsStops.length;
a.js.pos.set(72.5,5,33.5);a.js.group.position.copy(a.js.pos);a.js.route=[];a.js.navigationSearch=null;a.js.planTimer=0;
for(let y=5;y<=7;y++)a.setBlock(70,y,33,'stone');
for(let i=0;i<160;i++){a.updateJs(.05);assert.equal(a.jsRoutine.phase,'walk');}
for(let y=5;y<=7;y++)a.setBlock(70,y,33,null);
for(let i=0;i<800&&a.jsRoutine.phase==='walk';i++)a.updateJs(.05);
assert.equal(a.jsRoutine.phase,'board','clear approach lets the same js board');
const tooMany=structuredClone(withJs);tooMany.state.campus.push({...tooMany.state.campus[0]});
assert.throws(()=>a.readWorldBackup(JSON.stringify(tooMany)),/invalid characters/,'backup still bounds its character array');
console.log('PASS: old-name save migration, thirteen NPCs, shared portrait/outfit details, protected companions, Sleeves appearance/patrol, js playground walking, both animated swings, continuous boarding, seat alignment, blocked approach recovery and legacy/swing save reloads.');
