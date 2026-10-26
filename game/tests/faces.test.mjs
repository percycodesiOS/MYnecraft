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
  '\nglobalThis.api={playerAvatars,legacyStudent:buildPlayerAvatar(\'student\'),macek,micco,sirD,shields,eiler,cookie,schoolOfficer,js,sleeves,unicorn,eriksen,mullet,wingenbach,mcmichael};';
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
// 64-pixel teacher faces: the campus Mr. Macek, Ms. Micco and every playable teacher.
assertStraight('campus Mr. Macek', a.macek, 64);
assertStraight('Ms. Micco', a.micco, 64);
for (const id of ['macek', 'eriksen', 'mullet', 'wingenbach', 'mcmichael', 'micco']) assertStraight('playable ' + id, a.playerAvatars[id], 64);
// 16-pixel faces: the retired Student look (still rendered for old saves) and the other campus characters.
for (const [name, person] of Object.entries({ student: a.legacyStudent, sirD: a.sirD, shields: a.shields, eiler: a.eiler, cookie: a.cookie, schoolOfficer: a.schoolOfficer, js: a.js, sleeves: a.sleeves, mrB: a.unicorn })) assertStraight(name, person, 16);
// Kenny: every teacher's face is built the same way. Eyes, nose and mouth sit in the same
// places on Mr. Macek, Ms. Micco and the staff looks, and no nose block sticks out of a face.
{
  const shape = person => faceRects(person).filter(r => ['#fff5e8', '#292d30', '#cb9876', '#9c6650', '#fff4dd'].includes(r.color)).map(r => [r.color, r.x, r.y, r.w, r.h].join()).sort();
  const reference = shape(a.playerAvatars.mullet);
  for (const [name, person] of [['campus Mr. Macek', a.macek], ['playable Mr. Macek', a.playerAvatars.macek], ['Ms. Micco', a.micco], ['Mr. Wingenbach', a.playerAvatars.wingenbach], ['Ms. McMichael', a.playerAvatars.mcmichael]])
    assert.deepEqual(shape(person), reference, name + ' has the same face construction as the other teachers');
  const sticksOut = person => { let found = false; person.group.traverse(m => { if (m.isMesh && m.geometry?.parameters && m.position.z > .25 && Math.abs(m.position.y - person.head.position.y) < .12 && Math.abs(m.position.x) < .1 && m.geometry.parameters.width < .2) found = true; }); return found; };
  assert(!sticksOut(a.macek), 'no protruding nose block on the campus Mr. Macek');
}

// Ms. Eriksen: relaxed eyes, a little less open than the other teachers', and her original smile.
{
  const art = eyes(faceRects(a.playerAvatars.eriksen), 64), music = eyes(faceRects(a.playerAvatars.wingenbach), 64);
  assert(art.whites[0].w * art.whites[0].h < music.whites[0].w * music.whites[0].h * .5, 'Ms. Eriksen has normal-sized eyes, not bug eyes');
  assert(art.whites[0].h <= 4, 'her eyes are a little less wide open');
  const mouth = list => list.filter(r => r.color === '#9c6650' || (r.color === '#fff4dd' && r.y > 40)).map(r => [r.color, r.x, r.y, r.w, r.h].join());
  assert.deepEqual(mouth(faceRects(a.playerAvatars.eriksen)), mouth(faceRects(a.playerAvatars.mullet)), 'her mouth is back to the original smile');
}
// Kenny: the men's hair must end in one clean, straight line. No hair block beside the
// face may hang lower than the front edge (the back of the head is allowed to go lower).
{
  const pieces = (person, color) => {
    const out = [];
    person.group.traverse(m => {
      if (!m.isMesh || !m.geometry?.parameters || m.material?.color?.getHex?.() !== color) return;
      let y = m.position.y, z = m.position.z;
      for (let p = m.parent; p && p !== person.group; p = p.parent) { y += p.position.y; z += p.position.z; }
      const { width, height, depth } = m.geometry.parameters;
      out.push({ bottom: y - height / 2, front: z + depth / 2, z, width });
    });
    return out;
  };
  for (const [name, person, color] of [['campus Mr. Macek', a.macek, 0xa7804e], ['playable Mr. Macek', a.playerAvatars.macek, a.playerAvatars.macek.group.getObjectByName('straight hairline').material.color.getHex()],
    ['Mr. Mullet', a.playerAvatars.mullet, a.playerAvatars.mullet.group.getObjectByName('straight hairline').material.color.getHex()], ['Mr. Wingenbach', a.playerAvatars.wingenbach, 0x3e3129], ['the Student', a.legacyStudent, 0x6b4a2f]]) {
    // Front edge: the wide pieces across the forehead. Sides: the narrow strips beside the face.
    const hair = pieces(person, color), front = hair.filter(p => p.front > .2 && p.width >= .3), sides = hair.filter(p => p.z > -.2 && p.width < .15);
    assert(front.length && sides.length, name + ': hair pieces found');
    const edge = Math.min(...front.map(p => p.bottom)), lowest = Math.min(...sides.map(p => p.bottom));
    assert(lowest >= edge - .006, `${name}: side hair stops level with the front hairline (${lowest.toFixed(3)} vs ${edge.toFixed(3)})`);
  }
  assert(!a.legacyStudent.group.getObjectByName('side fringe') && !a.js.group.getObjectByName('side fringe'), 'no slanted or stepped fringe pieces');
  // Painted faces: no side strip of hair below the top band.
  const sideStrips = (rects, size) => rects.filter(r => (r.x === 0 || r.x + r.w === size) && r.w <= size / 8 && r.y > 0 && r.y < size * .45 && !/^#(fff|eab887|e5b993|edc3a2|d9a27d|eec6a2|cb9876)/i.test(r.color));
  for (const [name, person, size] of [['campus Mr. Macek', a.macek, 64], ['playable Mr. Macek', a.playerAvatars.macek, 64], ['Mr. Mullet', a.playerAvatars.mullet, 64], ['Mr. Wingenbach', a.playerAvatars.wingenbach, 64],
    ['the Student', a.legacyStudent, 16], ['js', a.js, 16], ['Sleeves', a.sleeves, 16], ['Officer Shields', a.shields, 16], ['Cookie', a.cookie, 16]])
    assert.deepEqual(sideStrips(faceRects(person), size), [], name + ': the painted hairline is one straight band');
}
// Hair hugs the head. Curly and long hair can frame a face without a wide halo;
// the three short cuts stay close to the head width and below a tenth-block crown.
for(const id of ['macek','eriksen','mullet','wingenbach','mcmichael']){
  const person=a.playerAvatars[id],box=new Three.Box3().setFromObject(person.hair),size=box.getSize(new Three.Vector3());
  assert(size.x/person.head.geometry.parameters.width<=1.25,id+': hair is proportionate to the head');
  for(const part of person.hair.children.filter(p=>p.name.includes('crown')))assert(part.geometry.parameters.height<=.10,id+': crown stays close to the head');
}
console.log('PASS: mirrored eyes, straight hairlines, proportional teacher hair silhouettes, and Ms. Eriksen has relaxed eyes and her original smile.');
