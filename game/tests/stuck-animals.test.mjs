// Run: node game/tests/stuck-animals.test.mjs
// Kids reported animals getting stuck. Against the real game: a placed animal walled
// into one block hops out to open ground, animals in the open never jump around,
// and Percy and Ellie walk as close as they can to a walled-off player instead of
// freezing, then come in as soon as the wall is taken down.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html = await fs.readFile(new URL('../mynecraft.html', import.meta.url), 'utf8');
const threeURL = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three = await import(new URL(threeURL, new URL('../mynecraft.html', import.meta.url)));
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';", '');
const activitiesSource = await fs.readFile(new URL('../play-activities.js', import.meta.url), 'utf8');
function boot() {
  class Element {
    constructor() { this.style = {}; this.children = []; this.dataset = {}; this.events = {}; this.classList = { add() {}, remove() {} }; this.textContent = ''; }
    appendChild(e) { this.children.push(e); } append(...es) { this.children.push(...es); }
    addEventListener(k, f) { (this.events[k] ??= []).push(f); } setAttribute(k, v) { this[k] = v; }
    getContext() { return new Proxy({ measureText: t => ({ width: t.length * 15 }) }, { get: (o, k) => o[k] ?? (() => {}) }); }
  }
  const elements = {}, store = new Map();
  const document = { body: new Element(), createElement: () => new Element(), getElementById: id => elements[id] ??= new Element(), addEventListener() {}, exitPointerLock() {} };
  class Renderer { constructor() { this.domElement = new Element(); this.shadowMap = {}; } setPixelRatio() {} setSize() {} render() {} }
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const context = vm.createContext({ THREE: { ...Three, WebGLRenderer: Renderer, TextureLoader: class { load() { return new Three.Texture(); } } }, document, window: {}, navigator: { maxTouchPoints: 0 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    performance: { now: () => 0 }, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {}, console, URLSearchParams, addEventListener() {}, localStorage, location: { reload() {} }, confirm: () => true });
  vm.runInContext(activitiesSource, context);
  vm.runInContext(script + '\nglobalThis.api={player,ellie,percy,startGame,updateCompanions,setCompanionMode,companionHome,activities,setBlock,getBlock,recordEdit,groundSurface,walkingPath,nearestWalkPoint,worldBounds};', context);
  return context.api;
}
const a = boot(); a.startGame();
const flat = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
// Kids build and break through recordEdit, like the PLACE and BREAK buttons.
const build = (x, y, z, block) => { a.setBlock(x, y, z, block); a.recordEdit(x, y, z, block); };

// Placed animals.
{
  const act = a.activities, car = act.spot('car'), cx = Math.floor(car.x) + 6, cz = Math.floor(car.z);
  const tick = seconds => { for (let t = 0; t < seconds * 20; t++) act.update(1 / 20, {}); };
  tick(1); assert(act.spawnAnimal('cow', { x: cx + .5, z: cz + .5 }), 'a cow can be placed on the lawn');
  const cow = () => act.serialize().animals.find(e => e.kind === 'cow');
  const start = cow(), c = { x: Math.floor(start.x), y: Math.floor(start.y), z: Math.floor(start.z) }, walls = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) for (const dy of [0, 1]) if (!a.getBlock(c.x + dx, c.y + dy, c.z + dz)) { build(c.x + dx, c.y + dy, c.z + dz, 'stone'); walls.push([c.x + dx, c.y + dy, c.z + dz]); }
  let escaped = false;
  for (let t = 0; t < 8 * 20 && !escaped; t++) { act.update(1 / 20, {}); const p = cow(); escaped = Math.floor(p.x) !== c.x || Math.floor(p.z) !== c.z; }
  assert(escaped, 'a cow walled into a single block hops out within a few seconds');
  const out = cow();
  assert(!a.getBlock(Math.floor(out.x), Math.floor(out.y), Math.floor(out.z)), 'it lands on open ground, not inside a block');
  for (const [x, y, z] of walls) build(x, y, z, null);
  // In the open, animals wander normally and never jump: no step longer than walking pace.
  assert(act.spawnAnimal('sheep', { x: cx + 4.5, z: cz + 3.5 }) || (tick(1), act.spawnAnimal('sheep', { x: cx + 4.5, z: cz + 3.5 })));
  let last = act.serialize().animals.map(e => ({ ...e })), biggest = 0;
  for (let t = 0; t < 120 * 20; t++) {
    act.update(1 / 20, {});
    const now = act.serialize().animals;
    now.forEach((e, i) => { biggest = Math.max(biggest, flat(e, last[i])); });
    last = now.map(e => ({ ...e }));
  }
  assert(biggest < .1, `animals in the open never hop (largest single step ${biggest.toFixed(2)} blocks)`);
}

// Percy and Ellie.
{
  a.setCompanionMode('follow', false);
  const home = a.companionHome;
  const spot = a.nearestWalkPoint({ x: home.x + 22, y: home.y, z: home.z }, a.worldBounds);
  const run = seconds => { for (let t = 0; t < seconds * 20; t++) a.updateCompanions(1 / 20); };
  // Wall the player into a 5x5 yard, two blocks high, far from the dogs.
  a.player.flying = false; a.player.pos.set(spot.x + .5, spot.y + a.player.height, spot.z + .5);
  const wall = [];
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 3) for (const dy of [0, 1]) if (!a.getBlock(spot.x + dx, spot.y + dy, spot.z + dz)) { build(spot.x + dx, spot.y + dy, spot.z + dz, 'stone'); wall.push([spot.x + dx, spot.y + dy, spot.z + dz]); }
  assert.equal(a.walkingPath(a.ellie.pos, { x: spot.x + .5, y: spot.y, z: spot.z + .5 }, a.worldBounds).length, 0, 'the yard really is closed off');
  run(40);
  for (const dog of [a.ellie, a.percy]) assert(flat(dog.pos, a.player.pos) < 6.5, `${dog.name} waits just outside the wall instead of freezing far away (${flat(dog.pos, a.player.pos).toFixed(1)} blocks)`);
  // Taking the wall down lets them in right away, with no long wait.
  for (const [x, y, z] of wall) build(x, y, z, null);
  let arrived = false, waited = 0;
  while (!arrived && waited < 15) { a.updateCompanions(1 / 20); waited += 1 / 20; arrived = [a.ellie, a.percy].every(dog => flat(dog.pos, a.player.pos) < 3.5); }
  assert(arrived, `both dogs come in once the wall is gone (after ${waited.toFixed(1)} s)`);
}
// Other characters keep the old rule: an exact route or none.
assert.equal(a.walkingPath({ x: 0, y: 200, z: 0 }, { x: 0, y: 200, z: 0 }, a.worldBounds).length, 0);
console.log('PASS: boxed-in animals hop out, animals in the open never jump, and Percy and Ellie get as close as they can, then come in when the way opens.');
