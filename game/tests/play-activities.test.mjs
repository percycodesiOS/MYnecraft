import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';

const source = await fs.readFile(new URL('../play-activities.js', import.meta.url), 'utf8');
const scope = vm.createContext({ console }); vm.runInContext(source, scope);
function fixture() {
  const scene = new THREE.Scene(), player = { pos: new THREE.Vector3(86, 6.7, 31.5), vel: new THREE.Vector3(), yaw: 0, height: 1.7, radius: .3, flying: false };
  let active = true, hardcore = false, unlocked = true, water = true, wall = false;
  const messages = [];
  const getBlock = (x, y, z) => y < 5 ? 'stone' : wall && x >= 25 && x <= 35 && z <= 55 && y < 8 ? 'stone' : water && y === 5 && x >= 0 && x <= 2 && z >= 0 && z <= 2 ? 'water' : undefined;
  const api = scope.MYNE_ACTIVITIES.create({ THREE, scene, player, getBlock, isSolid: (x,y,z) => !!getBlock(x,y,z) && getBlock(x,y,z) !== 'water', groundSurface: () => 5, inBounds: (x,z) => Math.abs(x) < 100 && Math.abs(z) < 100, isActive: () => active, isHardcore: () => hardcore, isUnlocked: () => unlocked, reportStatus: text => messages.push(text) });
  return { api, scene, player, messages, state: values => { if ('active' in values) active = values.active; if ('hardcore' in values) hardcore = values.hardcore; if ('unlocked' in values) unlocked = values.unlocked; if ('water' in values) water = values.water; if ('wall' in values) wall = values.wall; } };
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
  assert(parked.z < 60 && parked.z >= 57.35, 'car stops outside its enclosing collision footprint');
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
