import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const Three=await import(new URL('../vendor/three.module.js',import.meta.url));
class Element{
 constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';}
 appendChild(e){this.children.push(e);}append(...es){this.children.push(...es);}
 addEventListener(k,f){(this.events[k]??=[]).push(f);}setAttribute(k,v){this[k]=v;}
 getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'')+`
globalThis.api={schoolOfficer,schoolOfficerCar,officerRoutine,schoolOfficerSchedule,updateSchoolOfficer,officerEntryPath,officerExitPath,officerPatrolPath,officerEntryStops,officerCafeteriaStops,officerCafeteriaBounds,officerEntranceBounds,officerWalkMinutes,officerClockMinutes,officerDriveInPath,officerDriveOutPath,officerPathPoint,campusActors,scene,shields,walkFeet,walkingPath,getBlock,setBlock,canStandAt,worldBackupText,readWorldBackup,updateCampus,entranceDoors,player,setTime(t){dayTime=t;}};`;
function boot(save={}){
 const elements={},document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(){},exitPointerLock(){}};
 let saved=JSON.stringify({edits:{},player:{x:47.5,y:6.7,z:35.5,sel:8},...save});
 const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,addEventListener(){},
  localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem(){saved=null;}},location:{reload(){}},confirm:()=>true});
 vm.runInContext(source,context);return context.api;
}
const at=(hour,minute=0)=>((hour*60+minute-360+1440)%1440)/1440;
const a=boot({dayTime:at(8,19)});
const expectPhase=(h,m,phase)=>{a.updateSchoolOfficer(0,at(h,m));assert.equal(a.officerRoutine.phase,phase,`${h}:${m} ${phase}`);};
expectPhase(8,19,'offsite');assert(!a.schoolOfficer.group.visible&&!a.schoolOfficerCar.visible);
expectPhase(8,20,'drivingIn');assert(!a.schoolOfficer.group.visible&&a.schoolOfficerCar.visible);
expectPhase(8,29.99,'drivingIn');
expectPhase(8,30,'walkingIn');assert(a.schoolOfficer.group.visible);
assert(a.schoolOfficerCar.position.distanceTo(new Three.Vector3(46,5,31))<.001,'car reaches the existing front curb at 8:30');
assert(a.schoolOfficer.pos.z<29,'officer steps onto the sidewalk clear of the parked car');
assert.equal(a.schoolOfficer.name,'School Officer');assert.equal(a.shields.name,'Officer Shields');
assert.equal(a.campusActors.length,12);assert.equal(a.campusActors.filter(x=>x.name==='School Officer').length,1);
assert.equal(a.schoolOfficer.group.userData.appearance,'black duty vest, glasses, tied-back hair');
assert.equal(a.schoolOfficer.group.getObjectByName('black duty vest').material.color.getHex(),0x171b20);
assert(a.schoolOfficer.group.getObjectByName('tied-back hair'));
for(const route of [a.officerEntryPath,a.officerExitPath,a.officerPatrolPath]){
 assert(route.points.length>4,'the whole route is reachable');
 for(const p of route.points){
  assert.equal(a.walkFeet(Math.floor(p.x),Math.floor(p.z),p.y),p.y,'route has solid ground and headroom');
  assert(a.canStandAt(new Three.Vector3(p.x,p.y+1.7001,p.z)),'route clears player-width collision');
 }
}
assert(a.officerEntryPath.points.some(p=>p.z===23.5&&p.x>=45&&p.x<=48),'walk goes through the front door');
for(const path of [a.officerDriveInPath,a.officerDriveOutPath])for(const p of path){
 assert.equal(a.getBlock(Math.floor(p.x),4,Math.floor(p.z)),'stone','car stays on the existing paved loop');
}
for(const path of [a.officerDriveInPath,a.officerDriveOutPath])for(let i=0;i<=200;i++){
 const p={};a.officerPathPoint(path,path.at(-1).d*i/200,p);
 for(const x of [-1.1,0,1.1])for(const z of [-2.1,0,2.1]){
  const wx=Math.floor(p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw));
  const wz=Math.floor(p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw));
  for(const y of [5,6])assert(!a.getBlock(wx,y,wz),'the whole car clears the school walls');
 }
}
// Run a complete shift at the same 20-minute-per-day clock rate as the game.
let time=at(8,30),previous=a.schoolOfficer.pos.clone(),sawDoor=false,sawPatrol=false,sawDeparture=false,sawDrive=false;
const car=a.schoolOfficerCar,actor=a.schoolOfficer,children=a.scene.children.length;
for(let i=0;i<7600;i++){
 time=(time+.05/1200)%1;a.updateSchoolOfficer(.05,time);
 const phase=a.officerRoutine.phase;
 if(actor.group.visible){
  assert(actor.pos.distanceTo(previous)<1.2,'normal movement stays within a single walking step, including voxel risers');
  assert(a.canStandAt(new Three.Vector3(actor.pos.x,actor.pos.y+1.7001,actor.pos.z)),'officer never walks through building blocks');
 }
 if(phase==='walkingIn')sawDoor ||= actor.pos.z>22&&actor.pos.z<25;
 if(phase==='patrol'){
  sawPatrol=true;assert(actor.pos.z< -2&&actor.pos.z> -13&&actor.pos.x>=38&&actor.pos.x<=50,'daytime patrol stays in the cafeteria');
 }
 sawDeparture ||= phase==='walkingOut';sawDrive ||= phase==='drivingOut';previous.copy(actor.pos);
}
assert(sawDoor&&sawPatrol&&sawDeparture&&sawDrive,'full day includes doorway, cafeteria, walk out, and car departure');
assert.equal(a.officerRoutine.phase,'offsite');assert(!actor.group.visible&&!car.visible);
assert.equal(a.scene.children.length,children,'daily updates allocate no additional scene actors or cars');
// Large forward/backward jumps and reloading at a saved time reconstruct a
// single routine without inheriting a hidden/outdated actor position.
for(const [h,m,phase]of [[12,0,'patrol'],[15,0,'walkingOut'],[23,0,'offsite'],[8,25,'drivingIn'],[12,0,'patrol']])expectPhase(h,m,phase);
const saved=JSON.parse(a.worldBackupText());saved.state.dayTime=at(12);
const reloaded=boot(saved.state);
assert.equal(reloaded.officerRoutine.phase,'patrol');assert(reloaded.schoolOfficer.group.visible&&reloaded.schoolOfficerCar.visible);
assert(reloaded.schoolOfficer.pos.z< -2);assert.equal(reloaded.campusActors.filter(x=>x.name==='School Officer').length,1);
assert.equal(reloaded.readWorldBackup(reloaded.worldBackupText()).campus.length,12);
saved.state.campus=saved.state.campus.filter(x=>x.name!=='School Officer'&&x.name!=='Sleeves');
assert.equal(reloaded.readWorldBackup(JSON.stringify(saved)).campus.length,10,'older ten-actor saves remain valid');
assert.equal(boot(saved.state).campusActors.filter(x=>x.name==='School Officer').length,1,'legacy load adds the routine once');
// A user-built wall at the doorway stops the walk. Removal resumes the same
// officer and opens the regular animated door; there is no teleport fallback.
a.updateSchoolOfficer(0,at(8,29));a.updateSchoolOfficer(0,at(8,30));
const wall=[];
for(let x=38;x<=52;x++)for(let y=5;y<=9;y++){wall.push([x,y,23,a.getBlock(x,y,23)]);a.setBlock(x,y,23,'stone');}
time=at(8,30);
for(let i=0;i<800;i++){time+=.05/1200;a.updateSchoolOfficer(.05,time);assert(a.schoolOfficer.pos.z>=24,'blocked entry never phases through the wall');}
for(const [x,y,z,b]of wall)a.setBlock(x,y,z,b);
for(let i=0;i<1600&&a.officerRoutine.phase!=='patrol';i++){time+=.05/1200;a.updateSchoolOfficer(.05,time);}
assert.equal(a.officerRoutine.phase,'patrol','removing the wall lets navigation retry and finish entering');
assert.equal(a.schoolOfficer,a.campusActors[10]);assert.equal(a.schoolOfficerCar,car);
expectPhase(15,0,'walkingOut');expectPhase(0,0,'offsite');expectPhase(8,30,'walkingIn');
console.log('PASS: school officer clock boundaries, front curb car route, entrance/cafeteria collision, full daily routine, blocked-door recovery, clock jumps, legacy/reloaded saves and no duplicate actors.');
