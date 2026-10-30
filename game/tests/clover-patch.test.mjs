// Run: node --test game/tests/clover-patch.test.mjs
// Verification of the child's clover patch lifecycle, exact messages, saves, and bug fixes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const html = await fs.readFile(new URL('../mynecraft.html', import.meta.url), 'utf8');
const landing = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');
const threeURL = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
const Three = await import(new URL(threeURL, new URL('../mynecraft.html', import.meta.url)));
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';", '');
const SAVE_KEY = 'mynecraft_save_v1';

function boot(store = new Map()) {
  const events = {};
  class Element {
    constructor() { this.style = {}; this.children = []; this.dataset = {}; this.events = {}; this.classList = { add(){}, remove(){} }; this.textContent = ''; }
    appendChild(e) { this.children.push(e); } append(...es) { this.children.push(...es); }
    addEventListener(k, f) { (this.events[k] ??= []).push(f); } setAttribute(k, v) { this[k] = v; }
    focus() { document.activeElement = this; }
    getContext() { return new Proxy({ measureText: t => ({ width: t.length * 15 }) }, { get: (o, k) => o[k] ?? (() => ({})) }); }
  }
  const elements = {};
  const document = {
    body: new Element(),
    createElement: () => new Element(),
    getElementById: id => elements[id] ??= new Element(),
    addEventListener(k, f) { (events[k] ??= []).push(f); },
    exitPointerLock() {}
  };
  class Renderer {
    constructor() { this.domElement = new Element(); this.shadowMap = {}; }
    setPixelRatio() {} setSize() {} render() {}
  }
  const localStorage = {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const context = vm.createContext({
    THREE: { ...Three, WebGLRenderer: Renderer, TextureLoader: class { load() { return new Three.Texture(); } } },
    document, window: {}, navigator: { maxTouchPoints: 0 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    performance: { now: () => 0 }, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {},
    console, URLSearchParams, addEventListener(k, f) { (events[k] ??= []).push(f); },
    localStorage, location: { reload() {} }, confirm: () => true,
    elements, events
  });
  vm.runInContext(script + `\n globalThis.api = {
    player, camera, renderer, inventoryBtn, inventoryClose,
    startGame, persistSave, worldBackupText, readWorldBackup,
    hostPrompt, hostInteract, schoolFootprint, groundSurface, canStandAt,
    getBlock, setBlock, isSolid, elements, events,
    cloverState: globalThis.MYNE_CLOVER?.state,
    cloverLocation: globalThis.MYNE_CLOVER?.location,
    cloverPrompt: globalThis.MYNE_CLOVER?.prompt,
    interactClover: globalThis.MYNE_CLOVER?.interact,
    finishCloverGrowth: globalThis.MYNE_CLOVER?.finishGrowth,
    updateCloverPatch: globalThis.MYNE_CLOVER?.update,
    tryThing
  };`, context);
  return { a: context.api, elements, events, store, doc: document };
}

test('clover patch is placed away from school footprint on open meadow', () => {
  const { a } = boot();
  assert(a.cloverLocation, 'clover location is defined');
  assert.equal(a.schoolFootprint(a.cloverLocation.x, a.cloverLocation.z), false, 'clover patch is outside school footprint');
  assert(a.cloverLocation.x < 0, 'located to the west away from the school building');
  assert.equal(a.cloverState.state, 'empty', 'initial clover state is empty');
  a.tryThing('clover');
  const dx=a.cloverLocation.x-a.player.pos.x,dz=a.cloverLocation.z-a.player.pos.z;
  const alignment=(-Math.sin(a.player.yaw)*dx-Math.cos(a.player.yaw)*dz)/Math.hypot(dx,dz);
  assert(alignment>.99&&a.player.pitch<0,'the shortcut faces down toward the garden');
  assert.equal(a.hostPrompt(),'Plant clover seed','the shortcut arrives within interaction range');
});

test('clover patch lifecycle: plant, water, visible growth, pick with exact luck message', () => {
  const { a, elements } = boot();
  a.startGame();
  const loc = a.cloverLocation;

  // Far away: no prompt
  a.player.pos.set(loc.x + 20, loc.y + 1.7, loc.z + 20);
  assert.equal(a.hostPrompt(), '');
  assert.equal(a.hostInteract(), false);

  // Walk up to clover patch
  a.player.pos.set(loc.x + 1.0, loc.y + 1.7, loc.z);
  assert.equal(a.hostPrompt(), 'Plant clover seed');

  // 1. Plant seed
  assert(a.hostInteract());
  assert.equal(a.cloverState.state, 'planted');
  assert.match(elements.status.textContent, /Planted clover seeds/);

  // 2. Water patch
  assert.equal(a.hostPrompt(), 'Water clover patch');
  assert(a.hostInteract());
  assert.equal(a.cloverState.state, 'watered');
  assert.equal(a.cloverState.growthTimer, 0);
  assert.match(elements.status.textContent, /Watered the clover patch/);

  // 3. Sprouting & Growth
  assert.equal(a.hostPrompt(), 'Clovers growing…');
  a.updateCloverPatch(2.5);
  assert.equal(a.cloverState.state, 'watered');
  assert(a.cloverState.growthTimer >= 2.5);

  // Finishing growth
  a.updateCloverPatch(3.0);
  assert.equal(a.cloverState.state, 'grown');

  // Test 4-leaf clover exact message: "Remember, you make your own luck."
  a.cloverState.cloverType = 'four_leaf';
  assert.equal(a.hostPrompt(), 'Pick four-leaf clover');
  assert(a.hostInteract());
  assert.equal(elements.status.textContent, 'Remember, you make your own luck.');
  assert.equal(a.cloverState.state, 'empty', 'patch resets to empty after picking');

  // Test ordinary 3-leaf clover picking
  a.hostInteract(); // plant
  a.hostInteract(); // water
  a.cloverState.growthTimer = 5.0;
  a.cloverState.cloverType = 'ordinary';
  a.cloverState.state = 'grown';
  assert.equal(a.hostPrompt(), 'Pick clover');
  assert(a.hostInteract());
  assert.match(elements.status.textContent, /three-leaf clover/);
  assert.equal(a.cloverState.state, 'empty');
});

test('clover patch save and reload persistence', () => {
  const store = new Map();
  const { a: first } = boot(store);
  first.startGame();
  const loc = first.cloverLocation;
  first.player.pos.set(loc.x + 1.0, loc.y + 1.7, loc.z);
  first.hostInteract(); // plant
  first.hostInteract(); // water
  first.cloverState.growthTimer = 3.2;
  first.persistSave();

  const savedRaw = store.get(SAVE_KEY);
  assert(savedRaw, 'world was saved to localStorage');
  const parsed = JSON.parse(savedRaw);
  assert.equal(parsed.cloverPatch.state, 'watered');
  assert.equal(parsed.cloverPatch.growthTimer, 3.2);

  // Reload world from store
  const { a: reloaded } = boot(store);
  assert.equal(reloaded.cloverState.state, 'watered');
  assert.equal(reloaded.cloverState.growthTimer, 3.2);

  // Legacy save without cloverPatch loads safely
  const legacyStore = new Map();
  legacyStore.set(SAVE_KEY, JSON.stringify({ mode: 'creative', edits: {}, player: { x: 0, y: 7, z: 0, yaw: 0, pitch: 0, sel: 0, flying: false } }));
  const { a: legacy } = boot(legacyStore);
  assert.equal(legacy.cloverState.state, 'empty');
});

test('Bug 1 verified: teacher choice writes to correct active world', () => {
  const teacherWriter = landing.slice(landing.indexOf('  function writeSavedTeacher(id){'), landing.indexOf('  function applyTeacher(id,persist){'));
  const sample = {
    edits: { '1,2,3': 'stone' },
    playerCharacter: 'macek',
    characterChosen: true,
    activeWorld: 'hardcore',
    hardcoreWorld: { edits: { '4,5,6': 'wood' }, playerCharacter: 'micco', characterChosen: true }
  };
  let raw = JSON.stringify(sample);
  const context = vm.createContext({
    valid: new Set(['macek', 'micco', 'eriksen', 'mullet', 'wingenbach', 'mcmichael']),
    saveKey: SAVE_KEY,
    localStorage: { getItem: () => raw, setItem: (k, v) => { raw = v; } }
  });
  vm.runInContext(teacherWriter + '\nwriteSavedTeacher("eriksen");', context);
  const result = JSON.parse(raw);
  assert.equal(result.playerCharacter, 'macek', 'campus character preserved');
  assert.equal(result.hardcoreWorld.playerCharacter, 'eriksen', 'hardcore character updated');
  assert.deepEqual(result.edits, sample.edits, 'campus edits preserved');
  assert.deepEqual(result.hardcoreWorld.edits, sample.hardcoreWorld.edits, 'hardcore edits preserved');
});

test('Bug 2 verified: unlocked left mousedown does not break aimed block before drag/click decision', () => {
  const { a, events } = boot();
  a.startGame();
  a.player.pos.set(0.5, 60.7, 0.5);
  a.camera.position.copy(a.player.pos);
  a.camera.rotation.set(0, 0, 0);
  a.setBlock(0, 60, -2, 'stone');
  assert.equal(a.getBlock(0, 60, -2), 'stone');

  const drag = { type: 'mousedown', button: 0, pointerType: 'mouse', target: a.renderer.domElement };
  for (const fn of a.renderer.domElement.events.mousedown || []) fn(drag);
  for (const fn of events.mousedown || []) fn(drag);
  assert.equal(a.getBlock(0, 60, -2), 'stone', 'block remains unbroken on unlocked mousedown');
});

test('Bug 3 verified: inventory Tab trap cycles through inventoryClose button', () => {
  const { a, events, doc } = boot();
  a.startGame();
  a.inventoryBtn.events.click[0]();
  const firstBlock=doc.activeElement;
  for(const fn of events.keydown||[])fn({code:'Tab',shiftKey:true,preventDefault(){},target:doc.activeElement});
  assert.equal(doc.activeElement,a.inventoryClose,'Shift+Tab from the first block reaches the top close button');
  for(const fn of events.keydown||[])fn({code:'Tab',preventDefault(){},target:doc.activeElement});
  assert.equal(doc.activeElement,firstBlock,'Tab follows the visible order from close to blocks');
  let closeReached = false;
  for (let n = 0; n < 200; n++) {
    const key = { code: 'Tab', preventDefault() {}, target: doc.activeElement };
    for (const fn of events.keydown || []) fn(key);
    if (doc.activeElement === a.inventoryClose) {
      closeReached = true;
      break;
    }
  }
  assert.equal(closeReached, true, 'Tab cycling reaches inventoryClose (✕)');
});
