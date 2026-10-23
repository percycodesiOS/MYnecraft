import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';

const source = await fs.readFile(new URL('../play-activities.js', import.meta.url), 'utf8');
const scope = vm.createContext({ console }); vm.runInContext(source, scope);
function fixture() {
  const scene = new THREE.Scene(), player = { pos: new THREE.Vector3(86, 6.7, 31.5), vel: new THREE.Vector3(), yaw: 0, height: 1.7, radius: .3, flying: false };
  let active = true, hardcore = false, unlocked = true, water = true, wall = false, curb = false, roll = 0, roof = false;
  const messages = [], extra = new Map();
  const getBlock = (x, y, z) => extra.has(`${x},${y},${z}`) ? extra.get(`${x},${y},${z}`) : y < 5 ? 'stone' : curb && y === 5 && z <= 50 && z >= 40 ? 'stone' : wall && x >= 25 && x <= 35 && z <= 55 && y < 8 ? 'stone' : water && y === 5 && x >= 0 && x <= 2 && z >= 0 && z <= 2 ? 'water' : undefined;
  const isSolid = (x,y,z) => !!getBlock(x,y,z) && getBlock(x,y,z) !== 'water';
  const groundSurface = (x, z) => { for (let y = 12; y >= 0; y--) if (isSolid(Math.floor(x), y, Math.floor(z))) return y + 1; return 0; };
  const api = scope.MYNE_ACTIVITIES.create({ THREE, scene, player, getBlock, isSolid, groundSurface, inBounds: (x,z) => Math.abs(x) < 100 && Math.abs(z) < 100, isActive: () => active, isHardcore: () => hardcore, isUnlocked: () => unlocked, random: () => roll, isOnRoof: () => roof, reportStatus: text => messages.push(text) });
  return { api, scene, player, messages, extra, state: values => { if ('active' in values) active = values.active; if ('hardcore' in values) hardcore = values.hardcore; if ('unlocked' in values) unlocked = values.unlocked; if ('water' in values) water = values.water; if ('wall' in values) wall = values.wall; if ('curb' in values) curb = values.curb; if ('roll' in values) roll = values.roll; if ('roof' in values) roof = values.roof; } };
}

// A real shot travels in an arc and is counted only when falling through a rim.
{
  const f = fixture();
  assert.equal(f.api.getPrompt(), 'Pick up basketball'); assert(f.api.interact());
  f.api.update(.05); assert.equal(f.api.getPrompt(), 'Shoot basketball'); assert(f.api.interact());
  for (let i=0;i<160;i++) f.api.update(.05);
  assert.equal(f.api.serialize().score.campus, 1);
  for (let i=0;i<100;i++) f.api.update(.05);
  assert.equal(f.api.serialize().score.campus, 1, 'one basket cannot count twice');
  f.api.dispose(); assert.equal(f.scene.children.length, 0);
}
// Steering has low speed, cannot tunnel through a solid wall, pauses and exits.
{
  const f = fixture(); f.player.pos.set(30,6.7,60); f.state({wall:true}); assert(f.api.interact()); assert(f.api.isDriving());
  for (let i=0;i<200;i++) f.api.update(.05,{forward:1,turn:0});
  const parked = f.api.serialize().cars.campus;
  assert(parked.z < 60 && parked.z >= 57.18, 'car stops outside its real collision footprint');
  f.state({active:false}); for(let i=0;i<50;i++)f.api.update(.05,{forward:1,turn:1}); assert.equal(f.api.serialize().cars.campus.z,parked.z); assert.equal(f.api.interact(),false);
  f.state({active:true}); assert(f.api.interact()); assert(!f.api.isDriving()); assert.equal(f.player.vel.length(),0); assert(f.player.pos.y>=6.7);
}
// Fish require an unlocked habitat and cannot swim out of even a tiny pond.
{
  const f=fixture(); f.state({unlocked:false}); assert(!f.api.spawnAnimal('fish',{x:1.5,y:5.5,z:1.5}));
  f.state({unlocked:true}); assert(!f.api.spawnAnimal('fish',{x:10,y:5.5,z:10})); assert(f.api.spawnAnimal('fish',{x:1.5,y:5.5,z:1.5}));
  for(let i=0;i<2000;i++)f.api.update(.05);
  const fish=f.api.serialize().animals.find(a=>a.kind==='fish'); assert(fish.x>=.22&&fish.x<=2.78&&fish.z>=.22&&fish.z<=2.78);
  const mesh=f.scene.getObjectByName('Activity animal: fish'); f.state({water:false}); f.api.update(.05); assert(!mesh.visible,'removing water never leaves a fish displayed on land');
  f.state({water:true}); f.api.update(.05); assert(mesh.visible);
  const saved=f.api.serialize(), f2=fixture(); f2.api.restore(saved); assert.equal(f2.api.serialize().animals.length,1);
  assert.equal(f2.api.restore({animals:[{kind:'fish',world:'campus',x:NaN,y:5,z:0}]}), false); assert.equal(f2.api.serialize().animals.length,1,'malformed import leaves the open world intact');
  assert(scope.MYNE_ACTIVITIES.validateSerialized(saved));
  const tooMany=JSON.parse(JSON.stringify(saved)); tooMany.animals=Array(49).fill(saved.animals[0]); assert(!scope.MYNE_ACTIVITIES.validateSerialized(tooMany));
  const invalid=JSON.parse(JSON.stringify(saved)); invalid.animals[0].x='1'; assert(!scope.MYNE_ACTIVITIES.validateSerialized(invalid));
  f2.api.restore(undefined); assert.equal(f2.api.serialize().animals.length,0,'legacy world clears prior placed animals');
}
// World switching hides campus animals and restores independent car/score data.
{
  const f=fixture(); const horse=f.scene.getObjectByName('Activity animal: horse'); assert(horse.visible); f.state({hardcore:true}); f.api.setWorld(); assert(!horse.visible);
  assert.equal(f.api.serialize().cars.hardcore.x,5); f.player.pos.set(5,6.7,24); assert(f.api.interact());
  for(let i=0;i<20;i++)f.api.update(.05,{forward:1}); const z=f.api.serialize().cars.hardcore.z;
  f.state({hardcore:false}); f.api.setWorld(); assert(!f.api.isDriving()); assert(horse.visible); assert.equal(f.api.serialize().cars.campus.x,30);
  f.state({hardcore:true}); f.api.setWorld(); assert.equal(f.api.serialize().cars.hardcore.z,z);
}
console.log('PASS: basketball arc and scoring, parked/paused/colliding car, safe exits, habitat-only persistent fish, independent world activities.');

// Celebration starts on a real scored shot, pauses with gameplay, then clears.
{
  const f=fixture(); f.api.interact(); f.api.update(.05); f.api.interact();
  for(let i=0;i<100&&f.api.serialize().score.campus===0;i++)f.api.update(.05);
  const confetti=f.scene.getObjectByName('Basket confetti');
  assert(confetti.visible,'a scored basket launches a visible celebration at the hoop');
  assert(confetti.children.length>=90&&confetti.children.length<=120,'a bigger burst still stays bounded on school tablets');
  for(let i=0;i<12;i++)f.api.update(.05);
  const spread=Math.max(...confetti.children.map(c=>Math.hypot(c.position.x,c.position.z)));
  assert(spread>2.5,'the burst spreads well beyond the rim');
  const y=confetti.children[0].position.y;
  f.state({active:false});f.api.update(.05);assert.equal(confetti.children[0].position.y,y);
  f.state({active:true});for(let i=0;i<70;i++)f.api.update(.05);
  assert(!confetti.visible,'confetti clears after its celebration');
}
// Fish grow only in water during play, and their age survives a save/load.
{
  const f=fixture();f.api.spawnAnimal('fish',{x:1.5,y:5.5,z:1.5});
  const mesh=f.scene.getObjectByName('Activity animal: fish');assert.equal(mesh.scale.x,.55);
  for(let i=0;i<100;i++)f.api.update(.05);
  const age=f.api.serialize().animals[0].age;
  f.state({active:false});f.api.update(.05);assert.equal(f.api.serialize().animals[0].age,age);
  f.state({active:true,water:false});f.api.update(.05);assert.equal(f.api.serialize().animals[0].age,age,'dry tanks pause growth');
  f.state({water:true});for(let i=0;i<2401;i++)f.api.update(.05);
  assert.equal(f.api.serialize().animals[0].age,120);assert.equal(mesh.scale.x,1);
  const saved=f.api.serialize(),f2=fixture();assert(f2.api.restore(saved));assert.equal(f2.api.serialize().animals[0].age,120);
  const legacy=JSON.parse(JSON.stringify(saved));delete legacy.catches;delete legacy.animals[0].age;
  assert(f2.api.restore(legacy));assert.equal(f2.api.serialize().animals[0].age,0,'old fish saves remain supported');
  const invalid=JSON.parse(JSON.stringify(saved));invalid.animals[0].age=-1;assert(!f2.api.restore(invalid));
  invalid.animals[0].age=Infinity;assert(!scope.MYNE_ACTIVITIES.validateSerialized(invalid));
}
// A rod catches grown fish through the real Interact path, never young or dry fish.
{
  const f=fixture();f.player.pos.set(1.5,6.7,4);f.player.yaw=0;
  f.state({unlocked:false});assert(!f.api.equipRod());f.state({unlocked:true});assert(f.api.equipRod());
  f.api.spawnAnimal('fish',{x:1.5,y:5.5,z:1.5});f.api.interact();
  for(let i=0;i<50;i++)f.api.update(.05);assert.equal(f.api.serialize().animals.length,1,'young fish cannot be caught');
  const mature=f.api.serialize();mature.animals[0].age=120;assert(f.api.restore(mature));assert(f.api.equipRod());
  assert(f.api.interact());assert.equal(f.api.getPrompt(),'Fishing…');
  f.state({active:false});for(let i=0;i<50;i++)f.api.update(.05);assert.equal(f.api.serialize().animals.length,1,'menu pause cannot finish a catch');
  f.state({active:true,water:false});f.api.update(.05);assert.equal(f.api.serialize().animals.length,1,'removing water cancels a cast');
  f.state({water:true});f.api.interact();for(let i=0;i<45;i++)f.api.update(.05);
  assert.equal(f.api.serialize().animals.length,0);assert.equal(f.api.serialize().catches.campus,1);
  const saved=f.api.serialize(),f2=fixture();assert(f2.api.restore(saved));assert.equal(f2.api.serialize().catches.campus,1);
  const bad=JSON.parse(JSON.stringify(saved));bad.catches.campus=-1;assert(!f2.api.restore(bad));
  f.api.unequipRod();assert(!f.api.isFishing());
}
console.log('PASS: scored-basket confetti, saved active-water fish growth, legacy save validation, and paused/cancelled/successful rod catches.');

// Baskets can be missed: an unlucky long shot lands beside the rim, never through it.
{
  const f=fixture();f.state({roll:.99});f.api.interact();f.api.update(.05);f.api.interact();
  for(let i=0;i<200;i++)f.api.update(.05);
  assert.equal(f.api.serialize().score.campus,0,'a missed shot scores nothing');
  assert(f.messages.some(m=>/So close/.test(m)),'a miss gives gentle, encouraging feedback');
  assert(!f.scene.getObjectByName('Basket confetti').visible,'no celebration for a miss');
  // Standing close and facing the hoop keeps a high chance, so most kids still score.
  const g=fixture();g.state({roll:.9});assert(g.api.interact());
  g.player.pos.set(86,6.7,25.5);g.api.update(.05);assert(g.api.interact());for(let i=0;i<200;i++)g.api.update(.05);
  assert.equal(g.api.serialize().score.campus,1,'a close, straight shot still goes in');
}
// Rapid PLACE taps cannot stack animals, and placed animals can be put away.
{
  const f=fixture();
  assert(f.api.spawnAnimal('dog',{x:40.5,y:5,z:40.5}));
  assert(!f.api.spawnAnimal('dog',{x:42.5,y:5,z:40.5}),'a second tap in the same instant is ignored');
  for(let i=0;i<10;i++)f.api.update(.05);
  assert(!f.api.spawnAnimal('cat',{x:40.6,y:5,z:40.6}),'animals cannot be stacked on one spot');
  assert(f.messages.some(m=>/already standing there/.test(m)));
  assert(f.api.spawnAnimal('cat',{x:42.5,y:5,z:40.5}));
  assert.equal(f.api.placedCount(),2);
  // Facing the dog offers a clear Put away action through Interact.
  const dog=f.scene.getObjectByName('Activity animal: dog');
  f.player.pos.set(dog.position.x,6.7,dog.position.z+2.5);f.player.yaw=0;f.player.pitch=-.3;
  assert.equal(f.api.getPrompt(),'Put away dog');assert(f.api.interact());assert.equal(f.api.placedCount(),1);
  assert(f.messages.some(m=>/went home/.test(m)));
  // BREAK aimed at an animal also puts it away, and Put away all clears the rest.
  const cats=[];f.scene.traverse(o=>{if(o.name==='Activity animal: cat')cats.push(o);});
  const cat=cats.find(o=>Math.hypot(o.position.x-42.5,o.position.z-40.5)<1);
  const origin={x:cat.position.x,y:6.7,z:cat.position.z+2},dir=new THREE.Vector3(0,-1.6,-2).normalize();
  assert(f.api.putAwayAimed(origin,dir));assert.equal(f.api.placedCount(),0);
  for(let i=0;i<10;i++){for(let j=0;j<8;j++)f.api.update(.05);assert(f.api.spawnAnimal('sheep',{x:10.5+i*2,y:5,z:-20.5}));}
  assert.equal(f.api.putAwayAll(),10);assert.equal(f.api.serialize().animals.length,0);
  assert(f.scene.getObjectByName('Activity animal: horse'),'the world\'s own animals are never removed');
}
// An animal boxed in by new blocks hops out to the nearest open ground.
{
  const f=fixture();assert(f.api.spawnAnimal('cow',{x:50.5,y:5,z:-30.5}));
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]])for(const y of [5,6])f.extra.set(`${50+dx},${y},${-31+dz}`,'stone');
  f.extra.set('50,5,-31','stone');f.extra.set('50,6,-31','stone');
  for(let i=0;i<120;i++)f.api.update(.05);
  const cow=f.api.serialize().animals[0];
  assert(Math.hypot(cow.x-50.5,cow.z+30.5)>=1.5,'the trapped cow moved out of the blocks');
  assert.equal(f.extra.get(`${Math.floor(cow.x)},5,${Math.floor(cow.z)}`),undefined,'and stands on open ground');
}
// Curbs no longer stop the car, but tall walls still do.
{
  const f=fixture();f.state({curb:true});f.player.pos.set(30,6.7,60);assert(f.api.interact());
  for(let i=0;i<200&&f.api.serialize().cars.campus.z>=48;i++)f.api.update(.05,{forward:1,turn:0});
  const car=f.api.serialize().cars.campus;
  assert(car.z<48,'the car rolls up onto a one-block curb and keeps going');assert.equal(car.y,6);
  for(let i=0;i<80;i++)f.api.update(.05,{forward:1,turn:1});
  assert.notEqual(f.api.serialize().cars.campus.yaw,0,'steering turns the car');
}
// A cup of tea: sit down (even on a roof), sip, and stand by moving or Interact.
{
  const f=fixture();f.player.pos.set(60.5,6.7,-60.5);f.player.onGround=true;
  assert(f.api.equipTea());assert(f.api.hasTea());assert.equal(f.api.getPrompt(),'Sit and drink tea');
  f.state({roof:true});assert(f.api.interact());assert(f.api.isSitting());
  assert(Math.abs(f.player.pos.y-6.15)<1e-9,'sitting lowers the view');
  assert(f.messages.some(m=>/roof with a warm cup of tea/.test(m)));
  const cup=f.scene.getObjectByName('Cup of tea');for(let i=0;i<100;i++)f.api.update(.05);
  assert(cup.visible);assert.equal(f.api.getPrompt(),'Stand up');
  // The cup is a small thing held below the eyes, never a wall in front of them.
  const size=new THREE.Box3().setFromObject(cup).getSize(new THREE.Vector3());
  assert(Math.max(size.x,size.y,size.z)<.6,'the whole cup, saucer and steam stay hand-sized');
  assert(cup.position.distanceTo(f.player.pos)>.45,'and sit in front of the view, not around the camera');
  f.api.update(.05,{forward:1});assert(!f.api.isSitting(),'moving stands you back up');
  assert(Math.abs(f.player.pos.y-6.7)<1e-9);
  f.api.interact();assert(f.api.isSitting());f.api.interact();assert(!f.api.isSitting());
  f.player.flying=true;f.api.interact();assert(!f.api.isSitting(),'no sitting in mid-air');
  f.player.flying=false;f.api.unequipTea();assert(!f.api.hasTea());f.api.update(.05);assert(!cup.visible);
  assert(f.api.equipTea());assert(f.api.equipRod());assert(!f.api.hasTea(),'choosing another tool puts the tea down');
}
console.log('PASS: missable baskets, animal spam guard, put away one or all, unstuck animals, curb-friendly car, and tea breaks.');
