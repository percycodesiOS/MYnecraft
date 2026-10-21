// Run: node game/tests/input-regression.test.mjs
// Device class, pointer-lock gestures, and saved control choices. One world boot.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../start-menu.css',import.meta.url),'utf8');
assert.match(html,/Press Esc to release the mouse/);
assert.match(html,/body\.touch-device #mouseHint \{ display: none/);
assert.doesNotMatch(css,/bottom:\s*max\(300px/);
assert.match(css,/#challengeProgress[\s\S]*top:\s*148px/);

const threeURL=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three=await import(new URL(threeURL,new URL('../mynecraft.html',import.meta.url)));

const events={};
const locks=[];
const exits=[];
const lockWaiters=[];
const mediaListeners=[];
let now=10000;
const env={coarse:false,hover:true};
class Element{
 constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';this.value='';this.getBoundingClientRect=()=>({left:0,top:0,width:132,height:132,right:132,bottom:132});}
 appendChild(e){this.children.push(e);} append(...es){this.children.push(...es);}
 addEventListener(k,f){(this.events[k]??=[]).push(f);} setAttribute(k,v){this[k]=v;}
 focus(){document.activeElement=this;}
 getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
 requestPointerLock(){const waiter={};const promise=new Promise(resolve=>{waiter.resolve=resolve;});locks.push(promise);lockWaiters.push(waiter);return promise;}
}
const elements=Object.fromEntries(['start','enter','mode','modeHelp','status','info','controlsLayout'].map(k=>[k,new Element()]));
const navigator={maxTouchPoints:0,platform:'Win32',userAgent:'Windows'};
const document={
 body:new Element(),pointerLockElement:null,hidden:false,
 createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),
 addEventListener(k,f){(events[k]??=[]).push(f);},
 exitPointerLock(){exits.push(now);this.pointerLockElement=null;}
};
function queryMatches(query){
 return (query.includes('pointer: coarse')&&env.coarse)||(query.includes('hover: none')&&!env.hover)||(query.includes('pointer: fine')&&!env.coarse)||(query.includes('hover: hover')&&env.hover);
}
let saved=JSON.stringify({controls:'desktop',graphics:'detailed',mode:'creative',edits:{},player:{x:1,y:18,z:12,sel:0,flying:false,yaw:0,pitch:0}});
const context=vm.createContext({
 THREE:{...Three,WebGLRenderer:class{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(v){this.pixelRatio=v;}setSize(){}render(){}},TextureLoader:class{load(){return new Three.Texture();}}},
 document,window:{matchMedia(query){return {matches:queryMatches(query),addEventListener(type,fn){if(type==='change')mediaListeners.push(fn);},removeEventListener(){}};}},
 navigator,innerWidth:1440,innerHeight:900,devicePixelRatio:2,
 performance:{now:()=>now},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,
 addEventListener(k,f){(events[k]??=[]).push(f);},
 localStorage:{getItem:()=>saved,setItem:(k,v)=>{saved=v;},removeItem(){saved=null;}},
 location:{reload(){},href:'http://127.0.0.1/game/mynecraft.html'},history:{replaceState(){},state:null},confirm:()=>true
});
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'');
const instrumented=script+`\n globalThis.api={
 startGame,releaseInput,setControlsLayout,readWorldBackup,worldBackupText,environmentWantsTouch,touchLayoutOn,menuBtn,renderer,lookLayer,stick,btnJump,
 modeSelect,setGraphics,player,tick,flyTag,camera,doPlace,setBlock,getBlock,persistSave,inventory,inventoryBtn,inventoryChoices,inventoryOverlay,inventoryBack,
 get inventoryOpen(){return inventoryOpen;},get selected(){return selected;},
 get lookActive(){return lookActive;},get started(){return started;},get inputEpoch(){return inputEpoch;},get controls(){return controlsLayout;},
 get movement(){return keys;},get graphics(){return graphics;},get view(){return view;},
 modeTo(v){modeSelect.value=v;for(const change of modeSelect.events.change||[])change();}
};`;
vm.runInContext(instrumented,context);
const a=context.api;
const mouse=()=>({type:'click',button:0,pointerType:'mouse'});
const touch=()=>({type:'click',button:0,pointerType:'touch',sourceCapabilities:{firesTouchEvents:true}});
function apply(next){
 Object.assign(env,next);
 navigator.maxTouchPoints=next.touch??navigator.maxTouchPoints;
 navigator.platform=next.platform??navigator.platform;
 navigator.userAgent=next.ua??navigator.userAgent;
 if(next.width)context.innerWidth=next.width;
 if(next.height)context.innerHeight=next.height;
 a.setControlsLayout('auto');
}
function stop(){if(a.started)for(const fn of events.keydown)fn({code:'Escape',preventDefault(){}});}
function locksAfter(fn){const before=locks.length;fn();return locks.length-before;}

const booted=JSON.parse(saved);
assert.equal(booted.controls,'desktop','a saved Keyboard choice is retained');
assert.equal(booted.graphics,'detailed','graphics stays detailed through that migration');
assert.equal(a.graphics,'detailed');
assert.equal(a.renderer.shadowMap.enabled,true);
assert.equal(a.controls,'desktop');
assert.equal(locks.length,0,'booting does not capture the mouse');
assert.equal(a.touchUI?.style.display??document.getElementById('touchUI').style.display,'none');

const desktop={coarse:false,hover:true,touch:0,platform:'Win32',ua:'Windows',width:390,height:844};
const phone={coarse:true,hover:false,touch:5,platform:'iPhone',ua:'iPhone',width:390,height:844};
const ipad={coarse:false,hover:true,touch:5,platform:'MacIntel',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',width:1024,height:768};
const laptop={coarse:false,hover:true,touch:10,platform:'Win32',ua:'Windows touch laptop',width:1440,height:900};

for(const mode of ['creative','survival']){
 a.modeTo(mode);
 apply(desktop);
 assert.equal(a.environmentWantsTouch(),false,`${mode} narrow window with a mouse stays desktop`);
 assert.equal(document.getElementById('touchUI').style.display,'none');
 stop();
 assert.equal(locksAfter(()=>a.startGame()),0,`${mode} startGame alone does not capture the mouse`);
 assert.equal(locksAfter(()=>elements.enter.events.click[0](mouse())),1,`${mode} Play click captures the mouse`);
 assert.equal(locksAfter(()=>a.renderer.domElement.events.click[0](mouse())),1,`${mode} canvas click captures the mouse`);
 now+=800;
 assert.equal(locksAfter(()=>a.renderer.domElement.events.click[0](touch())),0,`${mode} a touch click never captures the mouse`);

 apply(phone);
 assert.equal(a.environmentWantsTouch(),true);
 assert.equal(document.getElementById('touchUI').style.display,'block');
 assert.equal(locksAfter(()=>elements.enter.events.click[0](mouse())),0,`${mode} phone Play never captures the mouse`);
 assert.equal(locksAfter(()=>a.renderer.domElement.events.click[0](mouse())),0,`${mode} phone canvas never captures the mouse`);
 assert.equal(locksAfter(()=>a.lookLayer.events.touchstart[0]({changedTouches:[{identifier:4,clientX:20,clientY:20}],preventDefault(){}})),0,`${mode} phone look drag never captures the mouse`);

 apply(ipad);
 assert.equal(a.environmentWantsTouch(),true,`${mode} iPad desktop-mode Safari uses touch controls`);
 assert.equal(locksAfter(()=>elements.enter.events.click[0](mouse())),0,`${mode} iPad never captures the mouse`);
 assert.equal(locksAfter(()=>a.renderer.domElement.events.click[0](mouse())),0);

 apply(laptop);
 assert.equal(a.environmentWantsTouch(),false,`${mode} touch laptop keeps keyboard and mouse`);
 assert.equal(document.getElementById('touchUI').style.display,'none');
 stop();
 assert.equal(locksAfter(()=>elements.enter.events.click[0](mouse())),1,`${mode} touch laptop Play can capture the mouse`);
}

// The actual menu and toolbar choices change the layout and survive saving.
apply(laptop);
const menu=document.getElementById('controlsLayout');
const toolbar=document.getElementById('controlsToggle');
// The stub does not index dynamically appended IDs; retrieve via the body.
const panel=document.body.children.find(el=>el.id==='controls');
const liveToolbar=panel.children.find(el=>el.id==='controlsToggle');
menu.value='touch';menu.events.change[0]();
assert.equal(a.controls,'touch');assert.equal(liveToolbar.value,'touch');
assert.equal(document.getElementById('touchUI').style.display,'block');
assert.equal(JSON.parse(saved).controls,'touch');
assert.equal(menu.disabled,false);assert.equal(liveToolbar.disabled,false);
liveToolbar.value='desktop';liveToolbar.events.change[0]();
assert.equal(menu.value,'desktop');assert.equal(document.getElementById('touchUI').style.display,'none');
assert.equal(JSON.parse(saved).controls,'desktop');
apply(phone);a.setControlsLayout('desktop');
assert.equal(locksAfter(()=>elements.enter.events.click[0](mouse())),0,'manual keyboard on a phone never captures the mouse');
a.setControlsLayout('touch');
for(const fn of mediaListeners)fn();
assert.equal(a.controls,'touch','device changes preserve an explicit choice');

apply(desktop);
a.modeTo('creative');
stop();
elements.enter.events.click[0](mouse());
a.renderer.domElement.events.mousedown[0]({type:'mousedown',button:0,pointerType:'mouse'});
assert.equal(a.lookActive,true,'drag-look is the fallback while the cursor is free');
for(const fn of events.mouseup)fn();
assert.equal(a.lookActive,false);
apply(phone);
a.renderer.domElement.events.mousedown[0]({type:'mousedown',button:0,pointerType:'mouse'});
assert.equal(a.lookActive,false,'touch layout does not arm mouse drag-look');

apply(desktop);
a.startGame();
a.movement.KeyW=true;a.movement.Space=true;
document.pointerLockElement=a.renderer.domElement;
const exitsBeforeBlur=exits.length;
for(const fn of events.blur)fn();
assert.equal(a.movement.KeyW,false);
assert.equal(a.movement.Space,false);
assert.equal(a.lookActive,false,'blur clears mouse drag');
assert.equal(a.started,false,'blur pauses even before a pointerlockchange event');
assert(exits.length>exitsBeforeBlur,'blur releases pointer lock');
assert.equal(locks.length>0,true);
const locksAtBlur=locks.length;
for(const fn of events.pointerlockchange)fn();
assert.equal(locks.length,locksAtBlur,'losing the lock does not capture the mouse again');

a.startGame();
a.movement.KeyA=true;
a.renderer.domElement.events.mousedown[0]({type:'mousedown',button:0,pointerType:'mouse'});
document.hidden=true;
document.pointerLockElement=a.renderer.domElement;
const exitsBeforeHide=exits.length;
for(const fn of events.visibilitychange)fn();
assert.equal(a.movement.KeyA,false);
assert.equal(a.lookActive,false,'hiding the page clears mouse drag');
assert.equal(a.started,false,'hiding the page pauses even without a lock-loss event');
assert(exits.length>exitsBeforeHide,'hiding the page releases pointer lock');
document.hidden=false;

a.startGame();
a.movement.KeyD=true;
document.pointerLockElement=a.renderer.domElement;
const exitsBeforeDevice=exits.length;
apply(phone);
assert.equal(a.movement.KeyD,false,'a device change drops held keys');
assert(exits.length>exitsBeforeDevice,'a device change releases pointer lock');
assert.equal(document.getElementById('touchUI').style.display,'block');
a.movement.KeyW=true;
for(const fn of mediaListeners)fn();
assert.equal(a.movement.KeyW,false,'a media-query change drops held keys');

apply(desktop);
a.startGame();
a.lookLayer.events.touchstart[0]({changedTouches:[{identifier:9,clientX:30,clientY:40}],preventDefault(){}});
a.stick.events.touchstart[0]({changedTouches:[{identifier:3,clientX:10,clientY:10}],preventDefault(){}});
a.btnJump.events.touchstart[0]({preventDefault(){}});
assert.equal(a.movement.Space,true);
for(const fn of events.blur)fn();
assert.equal(a.movement.Space,false,'blur releases touch buttons');
assert.equal(a.movement.KeyW,false,'blur releases the stick');

apply(laptop);
stop();
const beforeLate=locks.length;
elements.enter.events.click[0](mouse());
assert.equal(locks.length,beforeLate+1);
for(const fn of events.keydown)fn({code:'Escape',preventDefault(){}});
assert.equal(a.started,false);
const exitsBeforeLate=exits.length;
lockWaiters.at(-1).resolve();
await locks.at(-1).then(()=>{},()=>{});
await Promise.resolve();
assert(exits.length>exitsBeforeLate,'a lock that arrives after pause is released immediately');
assert.equal(locks.length,beforeLate+1,'that late lock does not request another');

stop();
elements.enter.events.click[0](mouse());
for(const fn of events.keydown)fn({code:'Escape',preventDefault(){}});
document.pointerLockElement=a.renderer.domElement;
const exitsBeforeEvent=exits.length;
const locksBeforeEvent=locks.length;
for(const fn of events.pointerlockchange)fn();
assert(exits.length>exitsBeforeEvent,'a lock that lands after pause exits from pointerlockchange');
assert.equal(locks.length,locksBeforeEvent);
assert.equal(document.pointerLockElement,null);

// Losing focus can happen before the browser grants a requested lock. Older
// implementations return void, so there may be no Promise callback to reject
// that late lock. Pausing must not depend on an existing lock-loss event.
const originalRequestPointerLock=a.renderer.domElement.requestPointerLock;
for(const resultKind of ['promise','void'])for(const interruption of ['blur','hidden']){
 apply(desktop);stop();document.hidden=false;document.pointerLockElement=null;
 let requests=0;
 a.renderer.domElement.requestPointerLock=function(){
  requests++;
  if(resultKind==='promise')return originalRequestPointerLock.call(this);
 };
 elements.enter.events.click[0](mouse());
 a.renderer.domElement.events.mousedown[0]({type:'mousedown',button:0,pointerType:'mouse'});
 a.movement.KeyW=true;a.movement.Space=true;
 if(interruption==='hidden'){document.hidden=true;for(const fn of events.visibilitychange)fn();}
 else for(const fn of events.blur)fn();
 assert.equal(a.started,false,`${resultKind} pending lock: ${interruption} pauses without a held lock`);
 assert.equal(a.lookActive,false);
 assert.equal(a.movement.KeyW,false);assert.equal(a.movement.Space,false);
 document.hidden=false; // Returning to a visible page does not resume play.
 document.pointerLockElement=a.renderer.domElement;
 for(const fn of events.pointerlockchange)fn();
 if(resultKind==='promise'){
  lockWaiters.at(-1).resolve();await locks.at(-1);await Promise.resolve();
 }
 assert.equal(document.pointerLockElement,null,`${resultKind} late lock after ${interruption} is released`);
 assert.equal(a.started,false,'late completion never resumes the game');
 assert.equal(requests,1,'an interruption does not reacquire the mouse');
}
a.renderer.domElement.requestPointerLock=originalRequestPointerLock;

apply(desktop);
a.startGame();
a.movement.KeyS=true;
document.pointerLockElement=a.renderer.domElement;
a.menuBtn.events.click[0]();
assert.equal(a.started,false);
assert.equal(a.movement.KeyS,false,'Menu clears held keys');
assert.equal(document.pointerLockElement,null,'Menu releases pointer lock');

for(const mode of ['creative','survival']){
 const backup=JSON.parse(a.worldBackupText());
 backup.state.mode=mode;
 backup.state.graphics=mode==='creative'?'smooth':'detailed';
 backup.state.controls='touch';
 let loaded=a.readWorldBackup(JSON.stringify(backup));
 assert.equal(loaded.controls,'touch',`${mode} touch import retains its choice`);
 assert.equal(loaded.graphics,backup.state.graphics,`${mode} graphics stays with the touch import`);
 backup.state.controls='desktop';
 loaded=a.readWorldBackup(JSON.stringify(backup));
 assert.equal(loaded.controls,'desktop',`${mode} keyboard import retains its choice`);
 assert.equal(loaded.graphics,backup.state.graphics);
}
assert.equal(JSON.parse(saved).controls,'auto');
assert.equal(a.graphics,'detailed');

// Direction keys must actually move the player, including all four arrows.
apply(desktop);a.modeTo('creative');a.startGame();
function press(code,target){let prevented=false;for(const fn of events.keydown)fn({code,target,preventDefault(){prevented=true;}});return prevented;}
function release(code){for(const fn of events.keyup)fn({code});}
function readyToMove(){a.releaseInput();a.player.pos.set(0,35,0);a.player.yaw=0;a.player.pitch=0;a.player.flying=true;}
for(const [code,x,z] of [['KeyW',0,-.25],['KeyS',0,.25],['KeyA',-.25,0],['KeyD',.25,0],['ArrowUp',0,-.25],['ArrowDown',0,.25],['ArrowLeft',-.25,0],['ArrowRight',.25,0]]){
 readyToMove();const prevented=press(code);a.tick(now+=50);
 assert.equal(a.player.pos.x,x,`${code} moves in the expected x direction`);
 assert.equal(a.player.pos.z,z,`${code} moves in the expected z direction`);
 if(code.startsWith('Arrow'))assert(prevented,`${code} does not scroll the page while playing`);
 release(code);a.tick(now+=50);
 assert.equal(a.player.pos.x,x,`${code} stops on release`);assert.equal(a.player.pos.z,z);
}
readyToMove();press('KeyW');press('ArrowUp');release('ArrowUp');a.tick(now+=50);
assert.equal(a.player.pos.z,-.25,'releasing an arrow does not release a held W');
readyToMove();press('KeyW');press('ArrowUp');release('KeyW');a.tick(now+=50);
assert.equal(a.player.pos.z,-.25,'releasing W does not release a held arrow');
for(const tagName of ['INPUT','SELECT','TEXTAREA','BUTTON']){
 readyToMove();assert.equal(press('ArrowLeft',{tagName}),false);a.tick(now+=50);
 assert.equal(a.player.pos.x,0,`${tagName} retains arrow-key editing without moving the player`);
}
readyToMove();press('ArrowUp');for(const fn of events.blur)fn();
assert.equal(a.movement.ArrowUp,false,'losing focus releases arrow movement');
assert.equal(press('ArrowRight'),false,'arrows do not capture page scrolling while paused');
assert.equal(a.movement.ArrowRight,false,'arrows cannot start movement while paused');

// Sprint and vertical flight must work together without one changing the other.
a.startGame();
for(const sprint of ['ShiftLeft','ShiftRight']){
 readyToMove();press('KeyW');press(sprint);a.tick(now+=50);
 assert.equal(a.player.pos.z,-.4,`${sprint} speeds up horizontal flight`);
 assert.equal(a.player.pos.y,35,`${sprint} does not make flight descend`);
 press('Space');a.tick(now+=50);
 assert.equal(a.player.pos.y,35.4,'Space can climb while sprinting');
 release('Space');press('KeyV');a.tick(now+=50);
 assert.equal(a.player.pos.y,35,'V can descend while sprinting');
 release('KeyV');a.tick(now+=50);
 assert.equal(a.player.pos.y,35,'releasing V restores hover even while sprinting');
 readyToMove();a.player.flying=false;press('KeyW');press(sprint);a.tick(now+=50);
 assert.equal(a.player.vel.z,-8,`${sprint} still sprints on foot`);
}
readyToMove();press('Space');press('KeyV');a.tick(now+=50);
assert.equal(a.player.pos.y,35,'opposing up and down inputs cancel instead of favoring descent');
readyToMove();const originalView=a.view;
press('KeyV');a.tick(now+=50);
assert.equal(a.player.pos.y,34.75,'V descends');
assert.equal(a.view,originalView,'V descent does not change the camera');
release('KeyV');press('KeyC');a.tick(now+=50);
assert.notEqual(a.view,originalView,'C changes the camera');
assert.equal(a.player.pos.y,34.75,'C changes no flight height');
const changedView=a.view;
for(const fn of events.keydown)fn({code:'KeyC',repeat:true,preventDefault(){}});
assert.equal(a.view,changedView,'holding C does not repeatedly toggle the camera');
release('KeyC');press('KeyC');assert.equal(a.view,originalView,'a second deliberate C press restores the view');
release('KeyC');press('KeyE');a.tick(now+=50);
assert.equal(a.player.pos.y,34.75,'the superseded E key no longer descends');
readyToMove();a.player.flying=false;press('KeyF');
assert.equal(a.player.flying,true,'one F press starts flight');
assert.match(a.flyTag.textContent,/V down · SHIFT faster/,'the actual flight cue agrees with the controls');
for(const fn of events.keydown)fn({code:'KeyF',repeat:true,preventDefault(){}});
assert.equal(a.player.flying,true,'holding F does not repeatedly toggle flight');
release('KeyF');press('KeyF');assert.equal(a.player.flying,false,'a second deliberate press lands');
assert.equal(a.flyTag.textContent,'Flight OFF');
apply(phone);a.startGame();a.player.flying=false;
document.getElementById('btnFly').events.touchstart[0]({preventDefault(){}});
assert.match(a.flyTag.textContent,/JUMP up · DOWN down/,'touch flight cue names the visible touch buttons');
apply(desktop);a.startGame();
readyToMove();
const down=document.getElementById('btnDown');
down.events.touchstart[0]({preventDefault(){}});
assert.equal(a.movement.KeyV,true,'touch DOWN uses the independent descent input');
assert.equal(a.movement.ShiftLeft,false,'touch DOWN never turns sprint on');
a.tick(now+=50);assert.equal(a.player.pos.y,34.75,'touch DOWN descends at normal flight speed');
down.events.touchend[0]();a.tick(now+=50);assert.equal(a.player.pos.y,34.75,'touch release stops descent');
press('KeyV');for(const fn of events.blur)fn();
assert.equal(a.movement.KeyV,false,'losing focus clears descent');
assert.equal(a.started,false);

// The visual inventory pauses safely, selects the real building material, and
// retains existing save data. These actions run against the actual game module.
a.modeTo('creative');a.startGame();readyToMove();
const savedBeforePicker=a.readWorldBackup(a.worldBackupText());
press('KeyW');assert(press('KeyI'),'I is handled while playing');
assert.equal(a.inventoryOpen,true);assert.equal(a.started,false);
assert.equal(a.movement.KeyW,false,'opening the picker releases movement');
assert.equal(a.inventoryOverlay.hidden,false);
assert.equal(a.renderer.domElement.inert,true,'the world cannot receive input behind the picker');
assert.equal(a.inventoryChoices.length,36,'legacy materials, wood, concrete, ore and flower variations are available');
assert(a.inventoryChoices.every(c=>!c.button.disabled&&c.count.textContent==='Unlimited'));
const pausedPosition=a.player.pos.clone();a.tick(now+=50);assert(a.player.pos.equals(pausedPosition));
for(const fn of events.keydown)fn({code:'KeyI',repeat:true,preventDefault(){}});
assert.equal(a.inventoryOpen,true,'holding I does not close the picker immediately');
a.inventoryBack.focus();
for(const fn of events.keydown)fn({code:'Tab',preventDefault(){}});
assert.equal(document.activeElement.dataset.garden,'oak','Tab wraps to the first visible garden choice within the picker');
a.inventoryChoices[7].button.events.click[0]();
assert.equal(a.selected,7,'Brick is selected through the real inventory button');
assert.equal(a.inventoryOpen,false);assert.equal(a.started,true);
assert.equal(a.renderer.domElement.inert,false);assert.equal(document.activeElement,a.renderer.domElement);
assert.equal(JSON.parse(saved).player.sel,7,'selection is retained in the existing save');
assert.deepEqual(JSON.parse(saved).edits,{...savedBeforePicker.edits},'selecting a block preserves all existing edits');
assert.deepEqual(JSON.parse(saved).inventory,{...savedBeforePicker.inventory},'Creative selection does not invent collected items');

// Place the chosen material on a real block, then round-trip the same backup schema.
a.player.pos.set(90.5,30.5,80.5);a.player.flying=true;a.camera.rotation.set(0,0,0);
for(let z=77;z<=80;z++)a.setBlock(90,30,z,null);
a.setBlock(90,30,76,'stone');a.doPlace();
assert.equal(a.getBlock(90,30,77),'brick','inventory selection drives actual placement');
a.persistSave();const pickedBackup=a.readWorldBackup(a.worldBackupText());
assert.equal(pickedBackup.edits['90,30,77'],'brick');assert.equal(pickedBackup.player.sel,7);
a.inventoryBtn.events.click[0]();press('Escape');
assert.equal(a.inventoryOpen,false);assert.equal(a.started,true,'Esc closes only the picker and resumes');
a.inventoryBtn.events.click[0]();press('KeyI');assert.equal(a.inventoryOpen,false,'I closes the picker');
for(const tagName of ['INPUT','SELECT','TEXTAREA','BUTTON']){
 press('KeyI',{tagName});assert.equal(a.inventoryOpen,false,`${tagName} keeps I as ordinary form input`);
}

a.modeTo('survival');a.inventory.brick=2;a.inventoryBtn.events.click[0]();
assert.equal(a.inventoryChoices[7].count.textContent,'2 available');
assert.equal(a.inventoryChoices[0].button.disabled,true,'empty survival materials are visibly unavailable');
const beforeEmptyChoice=a.selected;a.inventoryChoices[0].button.events.click[0]();
assert.equal(a.selected,beforeEmptyChoice);assert.equal(a.inventoryOpen,true,'an empty choice cannot resume with a fabricated item');
a.inventoryBack.events.click[0]();assert.equal(a.started,true,'Back to game resumes');
a.inventoryBtn.events.click[0]();for(const fn of events.blur)fn();
assert.equal(a.inventoryOpen,false);assert.equal(a.started,false,'losing focus closes the picker into the pause menu');
assert.equal(a.renderer.domElement.inert,false);

console.log('PASS: input regression (desktop, phone, iPad, touch laptop, saved controls, both modes, WASD/arrows, independent sprint/flight/descent, inventory open/close/focus/select/place/save).');
