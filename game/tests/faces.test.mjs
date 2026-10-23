// Run: node game/tests/faces.test.mjs
// Every face looks straight ahead: within each eye the pupil is centred, and the
// two eyes mirror each other across the face. Ms. Eriksen has normal-sized eyes
// and her smirk. Uses the real game source with a canvas that records drawing.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const html = await fs.readFile(new URL('../mynecraft.html', import.meta.url), 'utf8');
const Three = await import(new URL('../vendor/three.module.js', import.meta.url));
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.style = {}; this.children = []; this.dataset = {}; this.events = {}; this.textContent = ''; this.classList = { add() {}, remove() {} }; }
  appendChild(child) { this.children.push(child); return child; } append(...c) { this.children.push(...c); }
  addEventListener(type, fn) { (this.events[type] ??= []).push(fn); } setAttribute(k, v) { this[k] = v; }
  getContext() {
    if (this.context) return this.context;
    const rects = [];
    this.context = new Proxy({ rects, measureText: t => ({ width: t.length * 15 }), fillRect(x, y, w, h) { rects.push({ color: this.fillStyle, x, y, w, h }); } }, { get: (o, k) => o[k] ?? (() => {}) });
    return this.context;
  }
}
class Renderer { constructor() { this.domElement = new Element('canvas'); this.shadowMap = {}; } setPixelRatio() {} setSize() {} render() {} }
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';", '') +
  '\nglobalThis.api={playerAvatars,macek,micco,sirD,shields,eiler,cookie,schoolOfficer,js,sleeves,unicorn,eriksen,mullet,wingenbach,mcmichael};';
const elements = {}, document = { body: new Element(), createElement: t => new Element(t), getElementById: id => elements[id] ??= new Element(), addEventListener() {}, exitPointerLock() {} };
const context = vm.createContext({ THREE: { ...Three, WebGLRenderer: Renderer, TextureLoader: class { load() { return new Three.Texture(); } } }, document, window: {}, navigator: { maxTouchPoints: 0 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  performance: { now: () => 0 }, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {}, console, URLSearchParams, addEventListener() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { reload() {} }, confirm: () => true });
vm.runInContext(source, context);
const a = context.api;
const faceRects = person => person.head.material[4].map.image.getContext('2d').rects;

// Find the eyes by colour: whites, then the darkest marks drawn inside them (the pupils).
function eyes(rects, size) {
  const whites = rects.filter(r => /^#ff[f-]|^#fff/i.test(r.color) && r.y > size * .3 && r.y < size * .6 && r.w < size * .4);
  assert.equal(whites.length, 2, 'two eye whites');
  whites.sort((p, q) => p.x - q.x);
  const pupils = whites.map(w => {
    const inside = rects.filter(r => r !== w && r.x >= w.x && r.x + r.w <= w.x + w.w && r.y >= w.y && r.y + r.h <= w.y + w.h && !/^#(dceef3|fff)/i.test(r.color));
    const dark = inside.sort((p, q) => p.w - q.w)[0];
    assert(dark, 'each eye has a pupil');
    return dark;
  });
  return { whites, pupils };
}
function assertStraight(name, person, size) {
  const { whites, pupils } = eyes(faceRects(person), size);
  for (let i = 0; i < 2; i++) {
    const offset = (pupils[i].x + pupils[i].w / 2) - (whites[i].x + whites[i].w / 2);
    // Exactly centred: even half a pixel toward the nose on both sides reads as cross-eyed.
    assert(Math.abs(offset) < .01, `${name}: ${i ? 'right' : 'left'} pupil is centred in its eye (offset ${offset})`);
  }
  assert.equal(whites[0].x + whites[0].w + whites[1].x, size, `${name}: the eyes mirror each other across the face`);
  assert.equal(pupils[0].x + pupils[0].w + pupils[1].x, size, `${name}: the pupils mirror each other, so neither eye looks inward`);
}
// 64-pixel faces: the campus Mr. Macek and every playable teacher.
assertStraight('campus Mr. Macek', a.macek, 64);
for (const id of ['macek', 'eriksen', 'mullet', 'wingenbach', 'mcmichael']) assertStraight('playable ' + id, a.playerAvatars[id], 64);
// 16-pixel faces: Ms. Micco, the Student and the other campus characters.
for (const [name, person] of Object.entries({ micco: a.micco, student: a.playerAvatars.student, sirD: a.sirD, shields: a.shields, eiler: a.eiler, cookie: a.cookie, schoolOfficer: a.schoolOfficer, js: a.js, sleeves: a.sleeves, mrB: a.unicorn })) assertStraight(name, person, 16);

// Ms. Eriksen: eyes no bigger than the other teachers', and a lopsided (smirking) mouth with no teeth showing.
{
  const art = eyes(faceRects(a.playerAvatars.eriksen), 64), music = eyes(faceRects(a.playerAvatars.wingenbach), 64);
  assert(art.whites[0].w * art.whites[0].h < music.whites[0].w * music.whites[0].h * .7, 'Ms. Eriksen has normal-sized eyes, not bug eyes');
  const rects = faceRects(a.playerAvatars.eriksen), mouth = rects.filter(r => r.color === '#9c6650');
  assert(mouth.length >= 2, 'her mouth has a lifted corner');
  const left = Math.min(...mouth.map(r => r.y)), mid = Math.max(...mouth.map(r => r.y));
  assert(mid - left >= 3, 'one corner lifts higher than the rest: a smirk');
  assert(!rects.some(r => r.color === '#fff4dd' && r.y > 40), 'a closed smirk, no big toothy grin');
}
console.log('PASS: every teacher and campus face looks straight ahead with mirrored eyes; Ms. Eriksen has normal eyes and her smirk.');
