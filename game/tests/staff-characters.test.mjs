// Run: node game/tests/staff-characters.test.mjs
// Synthetic localStorage and a DOM/WebGL stub exercise the real game module.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const Three=await import(new URL('../vendor/three.module.js',import.meta.url));
class Element{
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.style={};this.children=[];this.dataset={};this.events={};this.textContent='';
  this.classList={add(){},remove(){},toggle(){}};
  this.getBoundingClientRect=()=>({left:0,top:0,width:132,height:132,right:132,bottom:132});
 }
 appendChild(child){this.children.push(child);return child;}
 append(...children){this.children.push(...children);}
 addEventListener(type,listener){(this.events[type]??=[]).push(listener);}
 setAttribute(name,value){this[name]=value;}
 getContext(){
  if(this.context)return this.context;
  const colors=new Set(),draws=[];
  this.context=new Proxy({colors,draws,measureText:t=>({width:t.length*15}),fillRect(...args){colors.add(this.fillStyle);if(draws.length<100)draws.push({color:this.fillStyle,args});},fill(){colors.add(this.fillStyle);}},
   {get:(object,key)=>object[key]??(()=>{})});
  return this.context;
 }
}
class Renderer{constructor(){this.domElement=new Element('canvas');this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'')+`
globalThis.api={STAFF_CHARACTERS,MAX_CAMPUS_ACTORS,staffInputs,staffCards,staffCanvases,staffLook,playerAvatars,
 get playerAvatar(){return playerAvatar;},get playerCharacter(){return playerCharacter;},get view(){return view;},
 setPlayerCharacter,setMacekOutfit,setView,updatePlayerAvatar,viewArms,viewModel,identityStatus,player,camera,
 campusActors,macek,micco,ellie,percy,CIRC_ROOM,macekPatrol,skinTex,patternedSleeve,macekClothes,scene,WORLD,saveState,
 persistSave,worldBackupText,readWorldBackup,restoreWorldBackup,walkFeet,walkingPath,canStandAt,insideBounds,schoolFootprint,
 getBlock,setBlock,updateCampus,eriksen,mullet,wingenbach,mcmichael,eriksenBounds,mulletBounds,wingenbachBounds,mcmichaelBounds,
 mulletPatrol,mcmichaelPatrol,staffRoutine,updateStaffActivities,bubble};`;

function boot(state={}){
 const elements={},events={},writes=[];
 const document={body:new Element(),createElement:tag=>new Element(tag),getElementById:id=>elements[id]??=new Element(),addEventListener(type,listener){(events[type]??=[]).push(listener);},exitPointerLock(){}};
 let saved=JSON.stringify({edits:{'25,20,25':'snow'},player:{x:47.5,y:6.7,z:35.5,sel:8},...state}),reloads=0;
 const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,addEventListener(type,listener){(events[type]??=[]).push(listener);},
  localStorage:{getItem:()=>saved,setItem:(key,value)=>{writes.push(key);saved=value;},removeItem(){saved=null;}},location:{reload(){reloads++;}},confirm:()=>true});
 vm.runInContext(source,context);
 return {a:context.api,context,elements,writes,get saved(){return saved;},get reloads(){return reloads;}};
}
const expected=[['student','Student'],['macek','Mr. Macek'],['micco','Ms. Micco'],['eriksen','Ms. Eriksen'],['mullet','Mr. Mullet'],['wingenbach','Mr. Wingenbach'],['mcmichael','Ms. McMichael']];
const oldNames=['Sir D','Mr. Macek','KaY','Ellie','Percy','Ms. Micco','Officer Shields','Mr. B','Mr. Eiler','Cookie Man','School Officer','Sleeves','js'];
const newNames=['Ms. Eriksen','Mr. Mullet','Mr. Wingenbach','Ms. McMichael'];
const state=boot(),a=state.a;
assert.deepEqual(Array.from(a.STAFF_CHARACTERS,c=>[c.id,c.name]),expected,'the neutral Student plus the six requested teachers are selectable');
assert.deepEqual(Array.from(a.campusActors,n=>n.name),[...oldNames,...newNames],'four NPCs append without replacing or reordering the old roster');
assert.equal(a.MAX_CAMPUS_ACTORS,a.campusActors.length,'import bound covers the complete current roster');
assert.equal(a.playerCharacter,'student','a world with no character field starts as the neutral Student, not a teacher');
assert.equal(a.playerAvatar.style,'student');
assert.equal(state.elements.enter.textContent,'▶ PLAY','the big button just says Play');
assert.equal(state.elements.playingAs.textContent,'Playing as: a Student','the character is named, small, beside Play');
assert(Math.hypot(a.macek.pos.x-a.CIRC_ROOM.x,a.macek.pos.z-a.CIRC_ROOM.z)<a.CIRC_ROOM.radius,'fresh campus Mr. Macek starts in CIRC');
for(const dog of [a.ellie,a.percy])assert(dog.pos.distanceTo(a.macek.pos)<4,'fresh companions start beside their CIRC NPC');
assert.equal(a.playerAvatars.micco.style,a.micco.style,'the playable Micco reuses her existing campus style');
assert.deepEqual(a.playerAvatars.micco.head.material[4].map.image.getContext('2d').draws,a.micco.head.material[4].map.image.getContext('2d').draws,'Micco retains the existing face drawing');
assert.equal(state.elements.staffChoices.children.length,7);
assert.equal(new Set(Object.values(a.playerAvatars).map(v=>v.body.material[0].map)).size,7,'each selection has its own visible clothing');
assert.equal(new Set(Object.values(a.playerAvatars).map(v=>v.head.material[4].map)).size,7,'every player body has a distinct face');
// Every world saved Mr. Macek as the automatic default before the Student existed.
// Only a choice the player actually made keeps him; other saved teachers stay as picked.
{
 assert.equal(boot({playerCharacter:'macek'}).a.playerCharacter,'student','an old automatic Mr. Macek becomes the Student');
 const chosenMacek=boot({playerCharacter:'macek',characterChosen:true});
 assert.equal(chosenMacek.a.playerCharacter,'macek','a real Mr. Macek pick is kept');
 assert.equal(chosenMacek.elements.playingAs.textContent,'Playing as: Mr. Macek');
 assert.equal(boot({playerCharacter:'eriksen'}).a.playerCharacter,'eriksen','any other saved teacher is kept');
 const bad=JSON.parse(chosenMacek.a.worldBackupText());bad.state.characterChosen='yes';
 assert.throws(()=>chosenMacek.a.readWorldBackup(JSON.stringify(bad)),/character/i,'a malformed choice flag is rejected');
}

// Clothing checks inspect the textures actually applied to meshes, not only card labels.
const hasColor=(texture,color)=>texture.image.getContext('2d').colors.has(color);
assert(hasColor(a.playerAvatars.macek.body.material[0].map,'#b84348'),'Macek polo includes red stripes');
assert(hasColor(a.playerAvatars.macek.body.material[0].map,'#e9e8e0'),'Macek polo includes light stripes');
assert(hasColor(a.playerAvatars.eriksen.body.material[4].map,'#a54cb0'),'Eriksen wears purple');
assert(hasColor(a.playerAvatars.eriksen.body.material[4].map,'#16191e'),'Eriksen keeps black outer clothing');
assert(hasColor(a.playerAvatars.mullet.body.material[4].map,'#202e49'),'Mullet wears navy');
assert(hasColor(a.playerAvatars.mullet.legL.children[0].material[0].map,'#c4b28c'),'Mullet wears khaki shorts');
assert(a.playerAvatars.mullet.group.getObjectByName('hood'),'the hoodie has its visible hood');
assert(hasColor(a.playerAvatars.wingenbach.body.material[4].map,'#202429'),'Wingenbach wears black');
assert(hasColor(a.playerAvatars.wingenbach.legL.children[0].material[0].map,'#8e9398'),'Wingenbach wears gray pants');
assert(hasColor(a.playerAvatars.mcmichael.body.material[0].map,'#eee6d6'),'McMichael wears cream');
assert(hasColor(a.playerAvatars.mcmichael.legL.children[0].material[0].map,'#f4f0e7'),'McMichael has contrasting polka dots');
assert(a.playerAvatars.mcmichael.group.getObjectByName('glasses bridge'),'McMichael retains glasses');
assert(a.playerAvatars.eriksen.group.getObjectByName('curl'),'Eriksen has curly hair');
// The neutral Student wears a blue star tee and sneakers, and never a staff lanyard or ID.
assert(hasColor(a.playerAvatars.student.body.material[0].map,'#2f8fd8'),'the Student wears a bright blue tee');
assert(hasColor(a.playerAvatars.student.body.material[0].map,'#ffd23f'),'with a yellow star');
assert(a.playerAvatars.student.group.getObjectByName('sneaker'),'the Student wears sneakers');
assert.notEqual(a.playerAvatars.student.group.userData.portrait,'Gators lanyard','the Student does not inherit the Mr. Macek ID and lanyard');
assert.equal(a.playerAvatars.student.group.children.filter(c=>c.geometry?.type==='PlaneGeometry').length,0,'no badge or lanyard planes');

const assertActive=(api,id,name)=>{
 assert.equal(api.playerCharacter,id);assert.equal(api.playerAvatar,api.playerAvatars[id]);
 assert.equal(api.playerAvatar.group.userData.characterId,id);
 assert.match(api.identityStatus.textContent,new RegExp(name.replaceAll('.','\\.')));
 for(const [candidate]of expected){
  assert.equal(api.staffInputs[candidate].checked,candidate===id,'only the selected radio is checked');
  assert.equal(api.staffCards[candidate].dataset.selected,String(candidate===id));
 }
 for(const arm of ['armL','armR']){
  assert.equal(api.viewArms[arm].userData.characterId,id);
  for(let side=0;side<6;side++)assert.equal(api.viewArms[arm].material[side].map,api.playerAvatar[arm].children[0].material[side].map,'first-person sleeve matches selected third-person arm');
  const skin=id==='micco'||id==='student'?api.skinTex:api.staffLook(api.playerAvatar.style).skin;
  assert.equal(api.viewArms[arm].userData.hand.material[0].map,skin,'first-person hand matches the selected skin');
 }
 assert.equal(api.macek.body.material[0].map,api.macekClothes.black,'the campus Macek remains black SV');
 for(const arm of [api.macek.armL,api.macek.armR])assert.equal(arm.children[0].material[0].map,api.patternedSleeve,'both campus Macek sleeves stay patterned');
};
const sceneNodes=()=>{let count=0;a.scene.traverse(()=>count++);return count;};
const nodeCount=sceneNodes(),originalModels=Object.values(a.playerAvatars),originalTextures=originalModels.map(v=>v.body.material[0].map);
const importer=boot();
for(const [index,[id,name]]of expected.entries()){
 const input=a.staffInputs[id];assert.equal(input.type,'radio');assert.equal(input.name,'playerCharacter');assert.equal(input.value,id);
 assert.equal(a.staffCanvases[id].tagName,'CANVAS');assert.match(a.staffCanvases[id]['aria-label'],new RegExp(name.replaceAll('.','\\.')));
 input.checked=true;input.events.change[0]();assertActive(a,id,name);
 assert.equal(state.elements.enter.textContent,'▶ PLAY','Play never turns into a character name');
 assert.equal(state.elements.playingAs.textContent,'Playing as: '+(id==='student'?'a Student':name),'the small line names the selected character');
 assert.equal(JSON.parse(state.saved).characterChosen,true,'a picked character is remembered as a real choice');
 for(const view of ['first','third']){
  a.setView(view);assert.equal(a.viewModel.visible,view==='first');
  assert.deepEqual(Object.values(a.playerAvatars).filter(v=>v.group.visible).map(v=>v.group.userData.characterId),view==='third'?[id]:[],'camera mode shows only the selected body');
 }
 a.player.pos.set(105,30,90);a.player.yaw=.67;a.player.vel.set(0,0,0);a.updatePlayerAvatar(1/60);
 assert.equal(a.playerAvatar.group.position.x,105);assert.equal(a.playerAvatar.group.position.z,90);
 assert(Math.abs(a.playerAvatar.group.position.y-(30-a.player.height))<1e-9,'each body tracks the player feet');
 a.setView(index%2?'first':'third');a.persistSave();
 const decoded=a.readWorldBackup(a.worldBackupText());
 assert.equal(decoded.playerCharacter,id);assert.equal(JSON.parse(state.saved).playerCharacter,id);
 assert.equal(importer.a.restoreWorldBackup(a.worldBackupText()),true,'valid new-character backups import');
 assert.equal(importer.reloads,index+1);
 const reloaded=boot(JSON.parse(importer.saved));assertActive(reloaded.a,id,name);
 assert.equal(reloaded.a.view,index%2?'first':'third');
 assert.equal(reloaded.a.getBlock(25,20,25),'snow','import and reload preserve the built world');
 assert.equal(reloaded.a.campusActors.length,17);
}

// Repeated selection reuses all body, texture and scene objects.
for(let repeat=0;repeat<20;repeat++)for(const [id,name]of expected){a.setPlayerCharacter(id);assertActive(a,id,name);}
assert.equal(sceneNodes(),nodeCount,'selection never adds scene objects');
assert.deepEqual(Object.values(a.playerAvatars),originalModels,'selection reuses cached bodies');
assert.deepEqual(Object.values(a.playerAvatars).map(v=>v.body.material[0].map),originalTextures,'selection reuses clothing textures');
assert.equal(a.setPlayerCharacter('unknown'),false);assert.equal(a.playerCharacter,'mcmichael','invalid selection preserves the current character');
assert(state.writes.every(key=>key==='mynecraft_save_v1'),'new character state uses the unchanged shared save key');

// Genuine pre-update backups retain the old thirteen actors and lack the new field.
for(const legacyOutfit of [undefined,'polo','black']){
 const old=JSON.parse(a.worldBackupText());old.state.campus=old.state.campus.slice(0,13);delete old.state.playerCharacter;
 if(legacyOutfit===undefined)delete old.state.macekOutfit;else old.state.macekOutfit=legacyOutfit;
 const decoded=a.readWorldBackup(JSON.stringify(old));assert.equal(decoded.playerCharacter,'student');assert.equal(decoded.campus.length,13);
 assert.equal(decoded.macekOutfit,legacyOutfit??'polo','legacy outfit values remain import-compatible');
 if(legacyOutfit!=='polo'){
  // Partial historical campus arrays are accepted. Missing companions must
  // start near the restored NPC, not at a new default elsewhere on campus.
  decoded.campus=decoded.campus.filter(actor=>!['Ellie','Percy'].includes(actor.name));
  Object.assign(decoded.campus.find(actor=>actor.name==='Mr. Macek'),{x:47.5,y:legacyOutfit==='black'?11:5,z:legacyOutfit==='black'?16.5:29.5});
  assert.equal(a.readWorldBackup(JSON.stringify({...old,state:decoded})).campus.length,11,'partial campus arrays remain valid imports');
 }
 const oldWorld=boot(decoded);assertActive(oldWorld.a,'student','Student');
 assert.deepEqual(Array.from(oldWorld.a.campusActors,n=>n.name),[...oldNames,...newNames]);
 assert.equal(new Set(oldWorld.a.campusActors.map(n=>n.name)).size,17,'old worlds gain each new NPC exactly once');
 assert.equal(oldWorld.a.getBlock(25,20,25),'snow');
 for(const dog of [oldWorld.a.ellie,oldWorld.a.percy]){
  assert(dog.pos.distanceTo(oldWorld.a.macek.pos)<5,'missing companion starts beside the restored Mr. Macek');
  assert.equal(dog.pos.y,oldWorld.a.macek.pos.y,'missing companion starts on the restored NPC floor');
  assert.equal(oldWorld.a.walkFeet(Math.floor(dog.pos.x),Math.floor(dog.pos.z),dog.pos.y),dog.pos.y,'companion fallback has walkable support');
 }
}
const validation=boot(),full=JSON.parse(a.worldBackupText());
assert.equal(validation.a.readWorldBackup(JSON.stringify(full)).campus.length,17,'a complete new world passes the import bound');
const invalidStates=[];
for(const id of ['',null,17,{},[],true,'unknown','MACEK']){
 const invalid=structuredClone(full);invalid.state.playerCharacter=id;invalidStates.push(invalid);
}
const oversized=structuredClone(full);oversized.state.campus.push({...oversized.state.campus[0]});invalidStates.push(oversized);
for(const mutation of [actor=>{actor.x=10001;},actor=>{actor.y=null;},actor=>{actor.z='5';},actor=>{actor.name='x'.repeat(41);},actor=>{actor.patrolIndex=-1;},actor=>{actor.patrolIndex=.5;}]){
 const invalid=structuredClone(full);mutation(invalid.state.campus[16]);invalidStates.push(invalid);
}
const beforeInvalid=validation.saved;
for(const invalid of invalidStates){
 assert.throws(()=>validation.a.restoreWorldBackup(JSON.stringify(invalid)),/character/i,'malformed character state is rejected before import');
 assert.equal(validation.saved,beforeInvalid,'invalid character data cannot overwrite an existing world');
 assert.equal(validation.reloads,0);
}

// New activities occupy real supported floors and routes, with props independent of WORLD.
for(const [actor,bounds,floor]of [[a.eriksen,a.eriksenBounds,11],[a.wingenbach,a.wingenbachBounds,11],[a.mcmichael,a.mcmichaelBounds,11],[a.mullet,a.mulletBounds,5]]){
 assert.equal(actor.pos.y,floor,actor.name+' starts on the intended floor');
 assert.equal(a.walkFeet(Math.floor(actor.pos.x),Math.floor(actor.pos.z),floor),floor,actor.name+' has solid ground and headroom');
 assert(a.insideBounds(actor.pos.x,actor.pos.z,bounds));
 assert.equal(a.schoolFootprint(Math.floor(actor.pos.x),Math.floor(actor.pos.z)),actor!==a.mullet,'only Mullet starts outside');
 assert(actor.group.userData.activity);assert(actor.invulnerable);
}
for(const [actor,route,bounds,floor]of [[a.macek,a.macekPatrol,a.macek.bounds,5],[a.mullet,a.mulletPatrol,a.mulletBounds,5],[a.mcmichael,a.mcmichaelPatrol,a.mcmichaelBounds,11]]){
 for(let index=0;index<route.length;index++){
  const from=route[index],to=route[(index+1)%route.length];
  const path=a.walkingPath({x:from[0],y:from[1],z:from[2]},{x:to[0],y:to[1],z:to[2]},bounds);
  assert(path.length>0,actor.name+' can reach every patrol stop');
  for(const step of path){
   if(actor===a.macek)assert(step.y>=5&&step.y<11,'CIRC patrol stays on the lower floor, including supported one-block steps');
   else assert.equal(step.y,floor,actor.name+' route stays on the correct floor');
   assert.equal(a.walkFeet(step.x,step.z,step.y),step.y,'every route node has support and headroom');
   assert(a.canStandAt(new Three.Vector3(step.x+.5,step.y+1.7001,step.z+.5)),'every route node clears player-width collision');
   assert(a.insideBounds(step.x+.5,step.z+.5,bounds));
   assert.equal(a.schoolFootprint(step.x,step.z),actor!==a.mullet);
  }
 }
}
assert.equal(a.eriksen.brush.parent,a.eriksen.armR);assert.equal(a.eriksen.palette.parent,a.eriksen.armL);
assert(a.eriksen.easel.getObjectByName('canvas'));assert(a.eriksen.easel.getObjectByName('painted tree'));
assert.equal(a.eriksen.easel.position.y,11);assert.equal(a.wingenbach.keyboard.position.y,11);
assert(a.wingenbach.keyboard.children.filter(p=>p.name==='white key').length>=12);
assert(a.wingenbach.keyboard.children.some(p=>p.name==='black key'));
const worldBefore=Array.from(a.WORLD),editsBefore=JSON.stringify(a.saveState.edits),activityNodes=sceneNodes();
const previousMullet=a.mullet.pos.clone(),previousSpanish=a.mcmichael.pos.clone();
let outdoorDistance=0,spanishDistance=0,artMin=Infinity,artMax=-Infinity,musicMin=Infinity,musicMax=-Infinity;
a.player.pos.set(110,30,90);
for(let i=0;i<2400;i++){
 a.updateStaffActivities(.05);
 for(const [actor,bounds,floor]of [[a.mullet,a.mulletBounds,5],[a.mcmichael,a.mcmichaelBounds,11]]){
  assert(a.insideBounds(actor.pos.x,actor.pos.z,bounds));assert.equal(actor.pos.y,floor);
  assert.equal(a.walkFeet(Math.floor(actor.pos.x),Math.floor(actor.pos.z),actor.pos.y),floor);
 }
 assert(a.mullet.pos.distanceTo(previousMullet)<.1,'outdoor walk is continuous');assert(a.mcmichael.pos.distanceTo(previousSpanish)<.1,'Spanish patrol is continuous');
 outdoorDistance+=a.mullet.pos.distanceTo(previousMullet);spanishDistance+=a.mcmichael.pos.distanceTo(previousSpanish);
 previousMullet.copy(a.mullet.pos);previousSpanish.copy(a.mcmichael.pos);
 artMin=Math.min(artMin,a.eriksen.armR.rotation.x);artMax=Math.max(artMax,a.eriksen.armR.rotation.x);
 musicMin=Math.min(musicMin,a.wingenbach.armL.rotation.x);musicMax=Math.max(musicMax,a.wingenbach.armL.rotation.x);
}
assert(outdoorDistance>100,'Mullet really walks outdoors');assert(spanishDistance>60,'McMichael walks her classroom route');
assert(artMax-artMin>.2,'the brush arm visibly paints');assert(musicMax-musicMin>.1,'the keyboard hands visibly play');
assert.equal(sceneNodes(),activityNodes,'activities reuse existing actors and props');
assert.deepEqual(Array.from(a.WORLD),worldBefore,'painting and music never alter world blocks');
assert.equal(JSON.stringify(a.saveState.edits),editsBefore,'activities never write player edits');

// Greeting proximity is measured from the player body, with floor/cooldown guards.
a.staffRoutine.spanishCooldown=0;a.staffRoutine.spanishWasNear=false;a.bubble.textContent='';
a.camera.position.set(a.mcmichael.pos.x,12.7,a.mcmichael.pos.z);
a.player.pos.set(110,30,90);a.updateStaffActivities(0);
assert.equal(a.bubble.textContent,'','a nearby third-person camera cannot trigger a greeting for a distant player');
a.camera.position.set(110,30,90);a.player.pos.set(a.mcmichael.pos.x,6.7,a.mcmichael.pos.z);a.updateStaffActivities(0);
assert.equal(a.bubble.textContent,'','standing on the floor below does not trigger the upstairs greeting');
a.player.pos.set(a.mcmichael.pos.x,12.7,a.mcmichael.pos.z+1);a.updateStaffActivities(0);
assert.match(a.bubble.textContent,/Hola.*Cómo estás/,'the nearby player receives the Spanish greeting');
a.bubble.textContent='';for(let i=0;i<20;i++)a.updateStaffActivities(0);
assert.equal(a.bubble.textContent,'','remaining nearby does not repeat the greeting');
a.player.pos.set(110,30,90);a.updateStaffActivities(0);
a.player.pos.set(a.mcmichael.pos.x,12.7,a.mcmichael.pos.z+1);a.updateStaffActivities(0);
assert.equal(a.bubble.textContent,'','leaving and returning during cooldown does not spam greetings');
a.player.pos.set(110,30,90);for(let i=0;i<260;i++)a.updateStaffActivities(.05);
a.player.pos.set(a.mcmichael.pos.x,12.7,a.mcmichael.pos.z+1);a.updateStaffActivities(0);
assert.match(a.bubble.textContent,/Hola.*Cómo estás/,'a later return earns a new greeting');

console.log('PASS: the neutral Student default plus all six teacher bodies/arms/clothing, plain PLAY with a Playing as line, old automatic Macek migration, UI selection and identity, save/import/reload/legacy safety, 17-NPC bounds, independent black-SV NPC, actual walks/floors, painting/music without world edits, Spanish body proximity/cooldown and cached object reuse.');
