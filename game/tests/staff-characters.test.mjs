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
globalThis.api={STAFF_CHARACTERS,MAX_CAMPUS_ACTORS,staffInputs,staffCards,staffCanvases,staffLook,playerAvatars,legacyStudent:buildPlayerAvatar('student'),
 get playerAvatar(){return playerAvatar;},get playerCharacter(){return playerCharacter;},get characterChosen(){return characterChosen;},get view(){return view;},
 setPlayerCharacter,setMacekOutfit,setView,updatePlayerAvatar,viewArms,viewModel,identityStatus,player,camera,
 campusActors,macek,micco,ellie,percy,CIRC_ROOM,macekPatrol,skinTex,patternedSleeve,macekClothes,scene,WORLD,saveState,
 persistSave,worldBackupText,readWorldBackup,restoreWorldBackup,walkFeet,walkingPath,canStandAt,insideBounds,schoolFootprint,
 getBlock,setBlock,updateCampus,eriksen,mullet,wingenbach,mcmichael,eriksenBounds,mulletBounds,wingenbachBounds,mcmichaelBounds,
 mulletPatrol,mcmichaelPatrol,staffRoutine,updateStaffActivities,bubble,layoutViewArms,swingArm};`;

function boot(state={}){
 const elements={},events={},writes=[];
 const document={body:new Element(),createElement:tag=>new Element(tag),getElementById:id=>elements[id]??=new Element(),addEventListener(type,listener){(events[type]??=[]).push(listener);},exitPointerLock(){}};
 // boot(null) is a brand-new player with nothing saved yet.
 let saved=state===null?null:JSON.stringify({edits:{'25,20,25':'snow'},player:{x:47.5,y:6.7,z:35.5,sel:8},...state}),reloads=0;
 const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,addEventListener(type,listener){(events[type]??=[]).push(listener);},
  localStorage:{getItem:()=>saved,setItem:(key,value)=>{writes.push(key);saved=value;},removeItem(){saved=null;}},location:{reload(){reloads++;}},confirm:()=>true});
 vm.runInContext(source,context);
 return {a:context.api,context,elements,writes,get saved(){return saved;},get reloads(){return reloads;}};
}
const expected=[['macek','Mr. Macek'],['micco','Ms. Micco'],['eriksen','Ms. Eriksen'],['mullet','Mr. Mullet'],['wingenbach','Mr. Wingenbach'],['mcmichael','Ms. McMichael']];
const oldNames=['Sir D','Mr. Macek','KaY','Ellie','Percy','Ms. Micco','Officer Shields','Mr. B','Mr. Eiler','Cookie Man','School Officer','Sleeves','js'];
const newNames=['Ms. Eriksen','Mr. Mullet','Mr. Wingenbach','Ms. McMichael'];
const state=boot(),a=state.a;
assert.deepEqual(Array.from(a.STAFF_CHARACTERS,c=>[c.id,c.name]),expected,'only the six Specials teachers are selectable');
assert(!('student' in a.playerAvatars)&&!('student' in a.staffInputs),'there is no playable Student card or body');
assert.deepEqual(Array.from(a.campusActors,n=>n.name),[...oldNames,...newNames],'four NPCs append without replacing or reordering the old roster');
assert.equal(a.MAX_CAMPUS_ACTORS,a.campusActors.length,'import bound covers the complete current roster');
assert.equal(a.playerCharacter,'macek','a world with no character field plays as Mr. Macek, a valid teacher');
assert.equal(a.playerAvatar.style,'macekStriped');
assert.equal(a.characterChosen,false,'no teacher has been picked yet');
assert.equal(state.elements.enter.textContent,'▶ PLAY','the big button just says Play');
assert.equal(state.elements.playingAs.textContent,'Playing as: Mr. Macek','the character is named, small, beside Play');
assert.equal(state.elements.changeCharacter.textContent,'Choose your teacher','the player is asked to choose a teacher');
assert.match(a.identityStatus.textContent,/^Pick your Specials teacher\. Until you do, you play as Mr\. Macek · CIRC\. First-person camera\./,'one plain sentence, without repeating the name');
// The public title screen and the in-game chooser (the same panel, shown on pause) are teacher-only.
assert.match(html,/<h2 id="characterTitle">Choose your Specials teacher<\/h2>/);
assert.match(html,/aria-label="Choose your Specials teacher"/);
assert.doesNotMatch(html,/Play as a student|a Student|Choose your character/,'no Student wording remains on the title screen');
// A brand-new player with nothing saved gets the same valid teacher and the same question.
{
 const fresh=boot(null);
 assert.equal(fresh.a.playerCharacter,'macek');assert.equal(fresh.a.characterChosen,false);
 assert.equal(fresh.elements.changeCharacter.textContent,'Choose your teacher');
 assert.equal(fresh.elements.startTip.textContent,'','a new player sees the normal tip, not the old-save message');
 fresh.a.staffInputs.wingenbach.checked=true;fresh.a.staffInputs.wingenbach.events.change[0]();
 assert.equal(fresh.a.playerCharacter,'wingenbach');assert.equal(fresh.a.characterChosen,true);
 assert.equal(fresh.elements.changeCharacter.textContent,'Change','once picked, the button just offers a change');
 assert.doesNotMatch(fresh.a.identityStatus.textContent,/Pick your/);
 assert.deepEqual([JSON.parse(fresh.saved).playerCharacter,JSON.parse(fresh.saved).characterChosen],['wingenbach',true]);
 const back=boot(JSON.parse(fresh.saved));assert.equal(back.a.playerCharacter,'wingenbach','the pick survives a reload');
 assert.equal(back.elements.changeCharacter.textContent,'Change');
 // Picking Mr. Macek himself is a real choice too, and ends the question.
 const pickMacek=boot(null);pickMacek.a.staffInputs.macek.checked=true;pickMacek.a.staffInputs.macek.events.change[0]();
 assert.equal(pickMacek.a.characterChosen,true);assert.equal(pickMacek.elements.changeCharacter.textContent,'Change');
 assert.equal(boot(JSON.parse(pickMacek.saved)).elements.changeCharacter.textContent,'Change');
}
assert(Math.hypot(a.macek.pos.x-a.CIRC_ROOM.x,a.macek.pos.z-a.CIRC_ROOM.z)<a.CIRC_ROOM.radius,'fresh campus Mr. Macek starts in CIRC');
for(const dog of [a.ellie,a.percy])assert(dog.pos.distanceTo(a.macek.pos)<4,'fresh companions start beside their CIRC NPC');
assert.equal(a.playerAvatars.micco.style,a.micco.style,'the playable Micco reuses her existing campus style');
assert.deepEqual(a.playerAvatars.micco.head.material[4].map.image.getContext('2d').draws,a.micco.head.material[4].map.image.getContext('2d').draws,'Micco retains the existing face drawing');
assert.equal(state.elements.staffChoices.children.length,6);
for(const character of a.STAFF_CHARACTERS){
 const card=a.staffCards[character.id];
 assert.equal(card.children.find(child=>child.className==='staff-role').textContent,character.role,'refreshing locks keeps the teacher department intact');
 assert.equal(card.children.find(child=>child.id===`character-description-${character.id}`).textContent,character.detail,'outfit details remain in their own accessible description');
}
assert.deepEqual(state.elements.staffChoices.children.map(card=>card.dataset.character),expected.map(([id])=>id),'the chooser shows exactly the six teachers');
assert.equal(new Set(Object.values(a.playerAvatars).map(v=>v.body.material[0].map)).size,6,'each selection has its own visible clothing');
assert.equal(new Set(Object.values(a.playerAvatars).map(v=>v.head.material[4].map)).size,6,'every player body has a distinct face');
// Every world saved Mr. Macek as the automatic default before the Student existed.
// Only a choice the player actually made keeps him; other saved teachers stay as picked.
{
 const autoMacek=boot({playerCharacter:'macek'});
 assert.equal(autoMacek.a.playerCharacter,'macek','an old automatic Mr. Macek stays a valid teacher');
 assert.equal(autoMacek.elements.changeCharacter.textContent,'Choose your teacher','and is asked to pick a teacher');
 const chosenMacek=boot({playerCharacter:'macek',characterChosen:true});
 assert.equal(chosenMacek.a.playerCharacter,'macek','a real Mr. Macek pick is kept');
 assert.equal(chosenMacek.elements.playingAs.textContent,'Playing as: Mr. Macek');
 assert.equal(chosenMacek.elements.changeCharacter.textContent,'Change','a real pick is not asked again');
 for(const [id,name] of expected.slice(1)){
  const kept=boot({playerCharacter:id});
  assert.equal(kept.a.playerCharacter,id,'any other saved teacher is kept: '+name);
  assert.equal(kept.elements.changeCharacter.textContent,'Change');
  assert.equal(kept.elements.playingAs.textContent,'Playing as: '+name);
 }
 const bad=JSON.parse(chosenMacek.a.worldBackupText());bad.state.characterChosen='yes';
 assert.throws(()=>chosenMacek.a.readWorldBackup(JSON.stringify(bad)),/character/i,'a malformed choice flag is rejected');
}
// Kenny, October 24: no playable Student. A world saved as the Student still loads with
// every build, plays as a valid teacher, and asks the player to choose a teacher.
for(const wasChosen of [true,false,undefined]){
 const saveFields={playerCharacter:'student',view:'third',inventory:{stone:3}};if(wasChosen!==undefined)saveFields.characterChosen=wasChosen;
 const old=boot(saveFields);
 assert.equal(old.a.playerCharacter,'macek','a saved Student plays as Mr. Macek');
 assert.equal(old.a.characterChosen,false,'a saved Student pick is not a teacher choice');
 assert.equal(old.a.getBlock(25,20,25),'snow','the saved build is still there');assert.equal(old.a.view,'third','other settings are kept');
 assert.equal(old.a.playerAvatar.group.visible,true,'the third-person body shown is a teacher, not the Student');
 assert.equal(old.elements.changeCharacter.textContent,'Choose your teacher');
 assert.equal(old.elements.startTip.textContent,'Your world is saved. Now choose your Specials teacher.');
 assert.match(old.a.identityStatus.textContent,/^Your world and builds are saved\. Pick your Specials teacher\./);
 assert.equal(old.writes.length,0,'loading alone does not rewrite the old save');
 assert.equal(JSON.parse(old.saved).playerCharacter,'student');
 old.a.staffInputs.mcmichael.checked=true;old.a.staffInputs.mcmichael.events.change[0]();
 assert.equal(old.a.playerCharacter,'mcmichael');assert.equal(old.a.characterChosen,true);
 assert.equal(old.elements.startTip.textContent,'Your world saves by itself.','the old-save message clears once a teacher is picked');
 assert.equal(old.elements.changeCharacter.textContent,'Change');
 const after=JSON.parse(old.saved);
 assert.deepEqual([after.playerCharacter,after.characterChosen,after.edits['25,20,25'],after.view],['mcmichael',true,'snow','third'],'the pick is saved and the world is not reset');
 const reopened=boot(after);assert.equal(reopened.a.playerCharacter,'mcmichael');assert.equal(reopened.elements.startTip.textContent,'');
}
// A Student save that is never changed keeps asking, and still plays: it is never stranded.
{
 const played=boot({playerCharacter:'student'});played.a.persistSave();
 const next=boot(JSON.parse(played.saved));
 assert.equal(next.a.playerCharacter,'macek');assert.equal(next.elements.changeCharacter.textContent,'Choose your teacher');
 assert.equal(next.a.getBlock(25,20,25),'snow');
}
// Old Student backups (including a nested Hardcore world) still import and open as a teacher.
{
 const legacy=JSON.parse(a.worldBackupText());legacy.state.playerCharacter='student';legacy.state.characterChosen=true;
 legacy.state.hardcoreWorld={...structuredClone(legacy.state),playerCharacter:'student'};delete legacy.state.hardcoreWorld.hardcoreWorld;
 const decoded=a.readWorldBackup(JSON.stringify(legacy));
 assert.equal(decoded.playerCharacter,'student','the backup is read as written');assert.equal(decoded.hardcoreWorld.playerCharacter,'student');
 const target=boot({playerCharacter:'eriksen',characterChosen:true});
 assert.equal(target.a.restoreWorldBackup(JSON.stringify(legacy)),true,'an old Student backup imports');
 const opened=boot(JSON.parse(target.saved));
 assert.equal(opened.a.playerCharacter,'macek');assert.equal(opened.a.characterChosen,false);
 assert.equal(opened.elements.changeCharacter.textContent,'Choose your teacher');assert.equal(opened.a.getBlock(25,20,25),'snow');
 for(const bad of ['Student','STUDENT','students']){
  const wrong=structuredClone(legacy);wrong.state.playerCharacter=bad;
  assert.throws(()=>a.readWorldBackup(JSON.stringify(wrong)),/character/i,'only the exact old Student id is accepted: '+bad);
 }
}
// Choosing a teacher is only a look. It never reaches the group-room or teacher controls.
{
 const roomSource=await fs.readFile(new URL('../room-client.js',import.meta.url),'utf8');
 assert.doesNotMatch(roomSource,/playerCharacter|characterChosen|STAFF_CHARACTERS/,'the room and teacher client never read the playable character');
 for(const line of html.split('\n').filter(l=>/playerCharacter|characterChosen/.test(l)))
  assert.doesNotMatch(line,/MYNE_ROOM|canWrite|teacherLogin|teacherToken|isGroupRoom\s*=|admit/i,'character code never touches room permissions');
}

// Clothing checks inspect the textures actually applied to meshes, not only card labels.
const hasColor=(texture,color)=>texture.image.getContext('2d').colors.has(color);
assert(hasColor(a.playerAvatars.macek.body.material[0].map,'#171b22'),'Macek wears his black SV shirt');
assert(hasColor(a.playerAvatars.macek.body.material[0].map,'#1d2027'),'Macek shirt has dark weave');
assert.equal(a.playerAvatars.macek.armL.children[0].material[0].map,a.patternedSleeve,'playable Macek has left patterned sleeve');
assert.equal(a.playerAvatars.macek.armR.children[0].material[0].map,a.patternedSleeve,'playable Macek has right patterned sleeve');
assert(a.playerAvatars.macek.group.getObjectByName('watch face'),'playable Macek has watch on left wrist');
assert(a.playerAvatars.macek.group.getObjectByName('bracelet leather')&&a.playerAvatars.macek.group.getObjectByName('bracelet copper'),'playable Macek has bracelet stack on right wrist');
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
// Kenny's October 23 fixes: even skin, straight hairlines and black pants for Mr. Macek.
{
 const macekFace=a.macek.head.material[4].map.image.getContext('2d').colors;
 for(const blotch of ['#efbd90','#e3ae7d','#c99b72'])assert(!macekFace.has(blotch),'campus Mr. Macek has one even skin tone, no checker or chin patch: '+blotch);
 assert(!hasColor(a.playerAvatars.macek.head.material[4].map,'#9c7856'),'playable Mr. Macek has no blotchy mouth or chin patches');
 assert(a.playerAvatars.mullet.group.getObjectByName('straight hairline'),'Mr. Mullet has a clean, straight hairline');
 assert(!a.playerAvatars.mullet.group.getObjectByName('receding side')&&!a.playerAvatars.mullet.group.getObjectByName('thinning fringe'),'no receding or thinning pieces');
 assert(a.playerAvatars.wingenbach.group.getObjectByName('straight hairline'),'Mr. Wingenbach has a clean, straight hairline');
 assert(a.playerAvatars.macek.group.getObjectByName('straight hairline'),'playable Mr. Macek keeps his straight hairline');
 const rgb=c=>c.startsWith('#')?[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)):c.match(/\d+/g).map(Number);
 const pants=[...a.macek.legL.children[0].material[0].map.image.getContext('2d').colors].map(rgb);
 assert(pants.length&&pants.every(([r,g,b])=>Math.max(r,g,b)<=40),'campus Mr. Macek wears solid black trousers');
}
// The retired Student look still renders for old saves: blue star tee, sneakers, no staff ID.
assert(hasColor(a.legacyStudent.body.material[0].map,'#2f8fd8'),'the Student wears a bright blue tee');
assert(hasColor(a.legacyStudent.body.material[4].map,'#ffd23f'),'with a yellow star on the front');
// Kenny: from behind, the small star read as a rude hand gesture. The star is on the front
// face only; the back, sides, top and bottom are plain blue.
{
  const body=a.legacyStudent.body,groups=body.geometry.groups.map(g=>[g.start,g.count,g.materialIndex].join());
  assert.deepEqual(groups,['0,24,0','24,6,4','30,6,0'],'front face (+Z) uses its own material; back (-Z) and sides use material 0');
  assert(!hasColor(body.material[0].map,'#ffd23f'),'no star on the back or sides of the Student tee');
  assert(hasColor(body.material[0].map,'#2f8fd8'),'the back is the same blue');
}
assert(a.legacyStudent.group.getObjectByName('sneaker'),'the Student wears sneakers');
assert.notEqual(a.legacyStudent.group.userData.portrait,'Gators lanyard','the Student does not inherit the Mr. Macek ID and lanyard');
assert.equal(a.legacyStudent.group.children.filter(c=>c.geometry?.type==='PlaneGeometry').length,0,'no badge or lanyard planes');

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
  const skin=id==='micco'?api.skinTex:api.staffLook(api.playerAvatar.style).skin;
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
 assert.equal(state.elements.playingAs.textContent,'Playing as: '+name,'the small line names the selected character');assert.equal(state.elements.changeCharacter.textContent,'Change');
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
 const decoded=a.readWorldBackup(JSON.stringify(old));assert.equal(decoded.playerCharacter,'macek');assert.equal(decoded.characterChosen,false);assert.equal(decoded.campus.length,13);
 assert.equal(decoded.macekOutfit,legacyOutfit??'polo','legacy outfit values remain import-compatible');
 if(legacyOutfit!=='polo'){
  // Partial historical campus arrays are accepted. Missing companions must
  // start near the restored NPC, not at a new default elsewhere on campus.
  decoded.campus=decoded.campus.filter(actor=>!['Ellie','Percy'].includes(actor.name));
  Object.assign(decoded.campus.find(actor=>actor.name==='Mr. Macek'),{x:47.5,y:legacyOutfit==='black'?11:5,z:legacyOutfit==='black'?16.5:29.5});
  assert.equal(a.readWorldBackup(JSON.stringify({...old,state:decoded})).campus.length,11,'partial campus arrays remain valid imports');
 }
 const oldWorld=boot(decoded);assertActive(oldWorld.a,'macek','Mr. Macek');assert.equal(oldWorld.elements.changeCharacter.textContent,'Choose your teacher','an old backup with no character is asked to pick a teacher');
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

// First-person arms frame the view from the lower corners on any screen shape, leaving the
// middle (crosshair, block bar, the ground being built on) clear, and stay on screen.
for(const aspect of [16/9,16/10,4/3,375/812]){
 a.camera.aspect=aspect;a.layoutViewArms();
 const halfH=.72*Math.tan(Three.MathUtils.degToRad(a.camera.fov/2)),halfW=halfH*aspect;
 for(const [name,side] of [['armL',-1],['armR',1]]){
  const p=a.viewArms[name].position;
  assert.equal(Math.sign(p.x),side,'each arm stays on its own side');
  assert(Math.abs(p.x)<=halfW,'the arm stays inside the view at aspect '+aspect.toFixed(2));
  if(aspect>1)assert(Math.abs(p.x)>=halfW*.5,'on a wide screen the arm sits out toward the edge, not over the middle');
  assert(p.y<=-halfH*.9,'the arm sits low, near the bottom edge');
 }
}
{
 const rest=a.viewArms.armR.rotation.x;a.swingArm();a.updatePlayerAvatar(.1);
 assert(a.viewArms.armR.rotation.x<rest-.3,'placing or breaking swings the right arm');
 for(let i=0;i<10;i++)a.updatePlayerAvatar(.1);
 assert(Math.abs(a.viewArms.armR.rotation.x-a.viewArms.armL.rotation.x)<.05,'and it comes back to rest');
}

console.log('PASS: teacher-only chooser (six Specials teachers, Mr. Macek until one is picked), new-player and saved-Student paths that keep every build, Student backups that still import, no character access to room permissions, the retired Student look with a plain blue back, all six teacher bodies/arms/clothing, plain PLAY with a Playing as line, old automatic Macek migration, UI selection and identity, save/import/reload/legacy safety, 17-NPC bounds, independent black-SV NPC, actual walks/floors, painting/music without world edits, Spanish body proximity/cooldown and cached object reuse.');
