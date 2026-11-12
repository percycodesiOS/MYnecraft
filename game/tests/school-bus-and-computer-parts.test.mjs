// Run: node game/tests/school-bus-and-computer-parts.test.mjs
// November 2026 student requests against the real game source: a school bus to
// drive from the parking lot, and buttons, Red rock and Computer lights for
// building a model computer.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const threeURL=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three=await import(new URL(threeURL,new URL('../mynecraft.html',import.meta.url)));
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const SAVE_KEY='mynecraft_save_v1';
const activitiesSource=await fs.readFile(new URL('../play-activities.js',import.meta.url),'utf8');
function boot(store){
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
  vm.runInContext(activitiesSource,context);
  vm.runInContext(script+`\n globalThis.api={player,scene,startGame,persistSave,worldBackupText,readWorldBackup,hostPrompt,hostInteract,tryThing,BLOCKS,INVENTORY_ADDITIONS,POWER_BLOCKS,activities,groundSurface,
    setBlock,getBlock,isSolid,recordEdit,updatePower,computePower,poweredButtons,powerOverlays,updatePlayerAvatar,camera,
    setAim:hit=>{aimHit=hit;},setView:value=>{view=value;},
    get keys(){return BLOCK_KEYS;},get selected(){return selected;},get started(){return started;},get gameMode(){return gameMode;}};`,context);
  return {g:context.api,elements,activities:context.MYNE_ACTIVITIES};
}
const near=(a,b,slack=.01)=>Math.abs(a-b)<=slack;
const HOME={x:30.5,z:75.8,yaw:-Math.PI/2};

// ---------- the school bus ----------
{
  const store=new Map();
  const {g,elements:els}=boot(store);
  assert(g.activities,'activities load with the game');g.startGame();g.player.flying=false;
  const home=g.activities.spot('bus');
  assert(near(home.x,HOME.x)&&near(home.z,HOME.z)&&near(home.yaw,HOME.yaw),'the bus waits along the south curb of the parking lot');
  assert.equal(home.y,g.groundSurface(HOME.x,HOME.z),'on the ground');
  assert(g.activities.busIsClear(),'with nothing in its way');
  const mesh=g.scene.getObjectByName('Driveable school bus');
  assert(mesh&&mesh.isMesh&&mesh.visible,'one visible bus');
  assert(mesh.geometry.attributes.color&&mesh.material.vertexColors,'drawn as a single vertex-coloured mesh');
  assert(mesh.geometry.index.count>=600,'with a body, wheels, windows and lights');
  const box=new Three.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
  assert(box.max.z-box.min.z>8.5&&box.max.z-box.min.z<9&&box.max.y<2.75&&box.min.y>=0,'8.6 blocks long, under 3 high, wheels on the ground');

  // Far away there is nothing to drive.
  g.player.pos.set(0,g.groundSurface(0,20)+1.7,20);
  assert.notEqual(g.activities.getPrompt(),'Drive school bus');
  // The Things to try shortcut stands the player at the folding door, facing the bus.
  g.tryThing('bus');
  assert(near(g.player.pos.x,home.door.x,.6)&&near(g.player.pos.z,home.door.z,.6),'beside the door');
  const forward={x:-Math.sin(g.player.yaw),z:-Math.cos(g.player.yaw)};
  assert(forward.x*(home.aim.x-g.player.pos.x)+forward.z*(home.aim.z-g.player.pos.z)>1,'looking at the bus');
  assert(/Drive school bus/.test(els.status.textContent));
  assert.equal(g.activities.getPrompt(),'Drive school bus');
  assert(g.activities.interact());assert(g.activities.isDriving()&&g.activities.isDrivingBus(),'Interact gets in');
  assert.equal(g.activities.getPrompt(),'Park / get out');
  assert.equal(g.activities.viewRange(),10.5,'third person pulls the camera back to show the whole bus');

  // Straight out of the lot toward the exit lane.
  let clearAllTheWay=true;
  for(let i=0;i<120;i++){g.activities.update(.05,{forward:1,turn:0});clearAllTheWay&&=g.activities.busIsClear();}
  let now=g.activities.spot('bus');
  assert(now.x-home.x>18,'it drives east along the lot (moved '+(now.x-home.x).toFixed(1)+' blocks)');
  assert(near(now.z,HOME.z,.05),'in a straight line');
  assert(clearAllTheWay,'without touching anything');
  // The driver rides in the seat: front left, 2.3 above the road.
  const s=Math.sin(now.yaw),c=Math.cos(now.yaw);
  assert(near(g.player.pos.x,now.x+(-.55)*c+(-1.6)*s,.02)&&near(g.player.pos.z,now.z-(-.55)*s+(-1.6)*c,.02)&&near(g.player.pos.y,now.y+2.3,.05),'driver sits behind the windscreen');
  assert.equal(g.player.yaw,now.yaw,'and looks where the bus points');
  // Third person: the camera ends up well behind the driver, never inside a wall.
  g.setView('third');g.camera.quaternion.setFromEuler(new Three.Euler(0,now.yaw,0,'YXZ'));g.updatePlayerAvatar(.05);
  assert(Math.hypot(g.camera.position.x-g.player.pos.x,g.camera.position.z-g.player.pos.z)>8,'chase camera');
  g.setView('first');

  // Steering hard for a long time can never push the long body into the school or water.
  let moved=0,last=now;
  for(let i=0;i<1200;i++){
    g.activities.update(.05,{forward:i%300<240?1:-1,turn:i%200<120?1:-1});
    assert(g.activities.busIsClear(),'the whole footprint stays clear (step '+i+')');
    const p=g.activities.spot('bus');moved+=Math.hypot(p.x-last.x,p.z-last.z);last=p;
  }
  assert(moved>40,'it keeps moving while it steers (drove '+moved.toFixed(0)+' blocks)');

  // Park, step out beside it, and the spot is saved.
  assert(g.activities.interact());assert(!g.activities.isDriving(),'Interact parks');
  assert(/beside the school bus/.test(els.status.textContent));
  const parked=g.activities.spot('bus');
  assert(Math.hypot(g.player.pos.x-parked.x,g.player.pos.z-parked.z)<6.2,'the driver steps out next to the bus');
  g.persistSave();
  const saved=JSON.parse(store.get(SAVE_KEY));
  assert.deepEqual(Object.keys(saved.activities.buses),['campus']);
  assert(near(saved.activities.buses.campus.x,parked.x)&&near(saved.activities.buses.campus.z,parked.z));
  // Reloading the page puts the bus back where it was parked.
  const again=boot(store).g;
  const reloaded=again.activities.spot('bus');
  assert(near(reloaded.x,parked.x)&&near(reloaded.z,parked.z)&&near(reloaded.yaw,parked.yaw),'the parked spot survives a reload');
  // A save from before the bus existed still loads, with the bus at home.
  delete saved.activities.buses;
  const older=boot(new Map([[SAVE_KEY,JSON.stringify(saved)]])).g;
  const fresh=older.activities.spot('bus');
  assert(near(fresh.x,HOME.x)&&near(fresh.z,HOME.z),'older saves get the bus at its home spot');
  assert(near(older.activities.spot('car').x,again.activities.spot('car').x),'and keep their car');
}
console.log('PASS: the school bus waits in the lot, drives, steers safely, parks, and saves its spot.');

// A build on the bus's home spot, or blocks boxing it in, never traps the bus for good.
{
  const {g,elements:els}=boot(new Map());
  g.startGame();g.player.flying=false;
  const ground=g.groundSurface(HOME.x,HOME.z);
  // A wall right against the front bumper and one against the back.
  for(const x of [35,36,25,24])for(let z=74;z<=77;z++)for(let y=ground;y<ground+3;y++)g.setBlock(x,y,z,'brick');
  g.setBlock(30,ground+1,75,'brick');   // and a block inside the body
  assert(!g.activities.busIsClear(),'the bus is boxed in');
  const door=g.activities.spot('bus').door;
  g.player.pos.set(door.x,g.groundSurface(door.x,door.z)+1.7,door.z);
  assert.equal(g.activities.getPrompt(),'Drive school bus');
  assert(g.activities.interact());assert(!g.activities.isDriving(),'a boxed-in bus does not start');
  assert(/boxed in/.test(els.status.textContent),'and says why');
  // The menu shortcut sends it to the next clear row of the lot.
  g.tryThing('bus');
  const moved=g.activities.spot('bus');
  assert(near(moved.x,30.5)&&near(moved.z,69.2),'the bus moves to a clear row');
  assert(g.activities.busIsClear());
  assert(/back in its parking spot/.test(els.status.textContent));
  assert.equal(g.activities.getPrompt(),'Drive school bus');
  assert(g.activities.interact());assert(g.activities.isDrivingBus(),'and drives again');
}
console.log('PASS: a boxed-in bus says so and can be sent back to a clear spot.');

// The save format: the bus is optional, and a malformed entry is refused whole.
{
  const {activities}=boot(new Map());
  const base={version:1,score:{campus:0,hardcore:0},cars:{},animals:[]};
  assert(activities.validateSerialized(base),'no bus entry is valid');
  assert(activities.validateSerialized({...base,buses:{}}));
  assert(activities.validateSerialized({...base,buses:{campus:{x:30,y:5,z:70,yaw:1}}}));
  for(const bad of [{hardcore:{x:1,y:5,z:1,yaw:0}},{campus:{x:1,y:5,z:1}},{campus:{x:NaN,y:5,z:1,yaw:0}},{campus:{x:9999,y:5,z:1,yaw:0}},[],'bus',null])
    assert(!activities.validateSerialized({...base,buses:bad}),'refused: '+JSON.stringify(bad));
}
console.log('PASS: bus save data is optional and validated.');

// ---------- buttons, Red rock and Computer lights ----------
{
  const store=new Map();
  const {g,elements:els}=boot(store);
  g.startGame();
  const parts=['redrock','button','greenbutton','bluebutton','yellowbutton','lamp'];
  assert.deepEqual([...g.keys.slice(-6)],parts,'appended after every existing block');
  assert.deepEqual([...g.POWER_BLOCKS],parts);
  for(const id of parts){
    assert(g.BLOCKS[id]&&!g.BLOCKS[id].plant&&g.BLOCKS[id].mats.length===6&&g.BLOCKS[id].onTexture,id+' is a full block with a lit look');
    assert(g.INVENTORY_ADDITIONS.includes(id),'group rooms, which accept only the original blocks, hide '+id);
  }
  assert.equal(g.BLOCKS.redrock.name,'Red rock');assert.equal(g.BLOCKS.button.name,'Red button');assert.equal(g.BLOCKS.lamp.name,'Computer light');

  // A button, a bent line of Red rock, and lights along it.
  const y=30,X=0,Z=0;
  const put=(x,yy,z,block)=>{g.setBlock(x,yy,z,block);g.recordEdit(x,yy,z,block);};
  put(X,y,Z,'button');
  for(const [x,z] of [[1,0],[2,0],[3,0],[3,1],[3,2]])put(X+x,y,Z+z,'redrock');
  put(X+3,y,Z+3,'lamp');put(X+2,y+1,Z,'lamp');put(X,y+1,Z,'lamp');       // end of the line, above the line, on the button
  put(X+3,y,Z+4,'redrock');put(X+3,y,Z+5,'lamp');                          // behind a light: power stops at the light
  put(X+6,y,Z,'redrock');put(X+7,y,Z,'lamp');                              // not connected
  put(X+1,y,Z-1,'greenbutton');                                            // another button touching the line
  const savedBlocks=()=>JSON.stringify(JSON.parse(g.worldBackupText()).state.edits);
  const before=savedBlocks();
  const count=name=>{const m=g.powerOverlays.get(name);return m&&m.visible?m.count:0;};
  assert.equal(g.hostPrompt(),'','nothing to press until a button is aimed at');
  g.player.pos.set(X+.5,y+1.5,Z-2.5);g.setAim({x:X,y,z:Z});
  assert.equal(g.hostPrompt(),'Press button');
  g.player.pos.set(X+.5,y+.5,Z+20);assert.equal(g.hostPrompt(),'','too far away to reach');
  g.player.pos.set(X+.5,y+1.5,Z-2.5);assert.equal(g.hostPrompt(),'Press button');
  assert(g.hostInteract(),'Interact presses it');
  assert.equal(els.status.textContent,'Click! 3 Computer lights switched on.');
  assert.equal(count('button'),1,'the pressed button lights');
  assert.equal(count('redrock'),5,'the joined Red rock glows');
  assert.equal(count('lamp'),3,'and every light touching it or the button');
  assert.equal(count('greenbutton'),0,'another button is not pressed by it');
  const lit=g.computePower();
  assert(!lit.has(`${X+3},${y},${Z+4}`)&&!lit.has(`${X+3},${y},${Z+5}`),'power does not pass through a light');
  assert(!lit.has(`${X+6},${y},${Z}`)&&!lit.has(`${X+7},${y},${Z}`),'or jump a gap');
  // Power is a picture only: the world and its backup are exactly as they were.
  assert.equal(g.getBlock(X+3,y,Z+3),'lamp');assert.equal(savedBlocks(),before,'no "on" block is ever saved');
  // It stays on for a moment, then goes out by itself.
  g.updatePower(1);assert.equal(count('lamp'),3,'still on after one second');
  g.updatePower(1);assert.equal(count('lamp'),0);assert.equal(count('redrock'),0);assert.equal(count('button'),0);
  assert.equal(g.poweredButtons.size,0,'all off after two seconds');
  // Breaking the line while it is on cuts the power at once.
  assert(g.hostInteract());assert.equal(count('lamp'),3);
  put(X+1,y,Z,null);g.updatePower(.01);
  assert.equal(count('redrock'),0);assert.equal(count('lamp'),1,'only the light on the button itself stays lit');
  // Breaking the pressed button turns everything off.
  put(X,y,Z,null);g.updatePower(.01);
  assert.equal(count('lamp'),0);assert.equal(g.poweredButtons.size,0);
  // A button alone explains what to add.
  put(X+20,y,Z,'yellowbutton');g.setAim({x:X+20,y,z:Z});g.player.pos.set(X+20.5,y+1.5,Z-2.5);
  assert(g.hostInteract());assert(/Put Red rock or a Computer light against this button/.test(els.status.textContent));
  put(X+21,y,Z,'redrock');assert(g.hostInteract());assert(/Red rock is glowing/.test(els.status.textContent));
  assert.equal(count('yellowbutton'),1);
  // A very long line is bounded, not endless.
  for(let i=22;i<60;i++)put(X+i,y,Z,'redrock');
  assert(g.hostInteract());assert.equal(count('redrock'),39);
  // The Things to try shortcut picks the Red button in Creative.
  assert.equal(g.gameMode,'creative');g.tryThing('computer');
  assert.equal(g.keys[g.selected],'button');assert(/Red button selected/.test(els.status.textContent));
  // The parts are saved like any other block and come back after a reload.
  g.persistSave();
  const again=boot(store).g;
  assert.equal(again.getBlock(X+20,y,Z),'yellowbutton');assert.equal(again.getBlock(X+21,y,Z),'redrock');assert.equal(again.getBlock(X+3,y,Z+3),'lamp');
  assert.equal(again.poweredButtons.size,0,'and nothing is lit after a reload');
}
console.log('PASS: buttons power Red rock and Computer lights, switch off by themselves, and never change the saved world.');
