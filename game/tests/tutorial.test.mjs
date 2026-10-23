// Run: node game/tests/tutorial.test.mjs
// The Basics quest: each control is learned by doing it, one short instruction at a
// time, with Skip and Exit always there. Finishing is remembered as its own browser
// preference; the world save is never touched. Uses tutorial.js and the real game.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const tutorialSource = await fs.readFile(new URL('../tutorial.js', import.meta.url), 'utf8');
const html = await fs.readFile(new URL('../mynecraft.html', import.meta.url), 'utf8');
// Values from the quest's own sandbox are copied before comparing.
const plain = value => JSON.parse(JSON.stringify(value));
const T = (() => { const c = vm.createContext({ setTimeout: () => 1, clearTimeout() {} }); vm.runInContext(tutorialSource, c); return c.MYNE_TUTORIAL; })();
assert.doesNotMatch(tutorialSource, /localStorage|sessionStorage|mynecraft_save/, 'the quest itself never reads or writes saves');

// The basics, in order, each with a keyboard and a touch version short enough to read at a glance.
assert.deepEqual(plain(T.STEPS.map(s => s.id)), ['move', 'look', 'jump', 'fly', 'place', 'break', 'inventory', 'interact', 'save']);
for (const step of T.STEPS) {
  assert(step.title && step.icon, step.id + ' has a title and a picture');
  for (const text of [step.keys, step.touch]) assert(text && text.length <= 90, `${step.id}: one short instruction, no wall of text`);
}
assert.equal(T.DONE_KEY, 'mynecraft_tutorial_done');
assert.notEqual(T.DONE_KEY, 'mynecraft_save_v1');
// Flying is only taught where flying is allowed.
assert.deepEqual(plain(T.createQuest({ creative: false }).steps.map(s => s.id)), ['move', 'look', 'jump', 'place', 'break', 'inventory', 'interact', 'save']);

// Doing each thing finishes its step; nothing else does.
{
  const q = T.createQuest({ creative: true }), seen = [];
  q.onChange(kind => seen.push(kind));
  const at = (x, y, z, yaw = 0, pitch = 0, flying = false) => ({ x, y, z, yaw, pitch, flying });
  q.update(at(0, 5, 0)); q.update(at(2, 5, 0));
  assert.equal(q.state().step.id, 'move', 'two steps is not enough walking yet');
  assert.equal(q.signal('placed'), false, 'placing a block early does not skip ahead');
  q.update(at(3.2, 5, 0)); assert.equal(q.state().step.id, 'look', 'walking a few blocks finishes Move');
  q.update(at(3.2, 5, 0)); q.update(at(3.2, 5, 0, 1.1)); assert.equal(q.state().step.id, 'jump', 'turning to look around finishes Look');
  q.update(at(3.2, 5, 0)); q.update(at(3.2, 5.4, 0)); assert.equal(q.state().step.id, 'jump');
  q.update(at(3.2, 5.9, 0)); assert.equal(q.state().step.id, 'fly', 'a jump finishes Jump');
  q.update(at(3.2, 5, 0)); q.update(at(3.2, 8, 0)); assert.equal(q.state().step.id, 'fly', 'climbing without flying does not count');
  q.update(at(3.2, 8, 0, 0, 0, true)); q.update(at(3.2, 10.5, 0, 0, 0, true)); assert.equal(q.state().step.id, 'place', 'flying up finishes Fly');
  for (const [event, next] of [['placed', 'break'], ['broke', 'inventory'], ['picked', 'interact'], ['interacted', 'save']]) {
    assert.equal(q.signal('saved'), false); assert(q.signal(event)); assert.equal(q.state().step.id, next);
  }
  assert(q.signal('saved'));
  assert.deepEqual(plain(q.state()), { index: 9, total: 9, step: null, finished: true, exited: false });
  assert.equal(seen.at(-1), 'finished'); assert.equal(seen.filter(k => k === 'done').length, 8);
  assert.equal(q.signal('placed'), false, 'a finished quest ignores everything');
}
// Skip moves on; Exit stops the quest right away.
{
  const q = T.createQuest(); q.skip(); q.skip(); assert.equal(q.state().step.id, 'jump');
  q.exit(); assert.equal(q.state().exited, true); assert.equal(q.state().step, null);
  q.skip(); assert.equal(q.signal('placed'), false); assert.equal(q.state().index, 2, 'nothing happens after Exit');
}

// The card: big friendly text, keyboard or touch wording, and Skip / Exit buttons.
class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.hidden = false; this.textContent = ''; this.className = ''; }
  append(...c) { this.children.push(...c); } appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attributes[k] = v; } addEventListener(type, fn) { (this.events[type] ??= []).push(fn); }
  click() { for (const fn of this.events.click || []) fn({}); } remove() { this.removed = true; }
  find(cls) { if (this.className === cls) return this; for (const c of this.children) { const f = c.find?.(cls); if (f) return f; } return null; }
}
const fakeDocument = () => ({ body: new Node('body'), createElement: tag => new Node(tag) });
{
  const doc = fakeDocument(), q = T.createQuest(), ends = [], closes = [], helpers = [];
  let touch = false;
  const ui = T.mount(doc, q, { isTouch: () => touch, onEnd: k => ends.push(k), onClose: k => closes.push(k), onHelper: id => helpers.push(id) });
  const part = cls => ui.card.find(cls);
  assert.equal(doc.body.children[0], ui.card); assert.equal(ui.card.id, 'questCard'); assert.equal(ui.card.attributes.role, 'status');
  assert.equal(part('quest-progress').textContent, 'Step 1 of 9'); assert.equal(part('quest-title').textContent, 'Walk around');
  assert.match(part('quest-text').textContent, /W A S D/);
  assert.equal(part('quest-helper').hidden, true, 'no extra button unless the step needs one');
  touch = true; ui.paint('start'); assert.match(part('quest-text').textContent, /round stick/, 'touch players get touch wording');
  part('quest-skip').click(); assert.equal(part('quest-title').textContent, 'Look around', 'Skip moves to the next basic');
  q.update({ x: 0, y: 5, z: 0, yaw: 0, pitch: 0 }); q.update({ x: 0, y: 5, z: 0, yaw: 1.2, pitch: 0 });
  assert.match(part('quest-progress').textContent, /^Nice! ✓/, 'every finished step gets a quick cheer'); assert.equal(ui.card.dataset.cheer, 'true');
  while (q.state().step.id !== 'interact') q.skip();
  assert.equal(part('quest-helper').hidden, false); assert.equal(part('quest-helper').textContent, 'Take me to the ball');
  part('quest-helper').click(); assert.deepEqual(helpers, ['interact']);
  ui.setDocked(true); assert.equal(ui.card.dataset.place, 'corner', 'over the menu the card moves to the corner');
  ui.setDocked(false); assert.equal(ui.card.dataset.place, 'top');
  q.skip(); q.signal('saved');
  assert.equal(part('quest-title').textContent, 'You did it!'); assert.deepEqual(ends, ['finished']);
  assert.equal(part('quest-skip').hidden, true); assert.equal(part('quest-helper').textContent, 'Keep playing');
  part('quest-helper').click(); assert.deepEqual(closes, ['finished']); assert.equal(ui.card.hidden, true);
}
{
  const doc = fakeDocument(), q = T.createQuest(), ends = [], closes = [];
  const ui = T.mount(doc, q, { onEnd: k => ends.push(k), onClose: k => closes.push(k) });
  ui.card.find('quest-exit').click();
  assert.equal(ui.card.hidden, true); assert.deepEqual(ends, ['exited']); assert.deepEqual(closes, ['exited'], 'Exit closes the card at any step');
}

// In the real game: ?tutorial=1 starts the quest in the world, actions finish steps,
// and finishing stores only the "done" preference.
{
  const threeURL = JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports.three;
  const Three = await import(new URL(threeURL, new URL('../mynecraft.html', import.meta.url)));
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';", '');
  assert.match(html, /<script src="tutorial\.js"><\/script>/, 'the game loads the quest');
  function boot(store, search) {
    class Element extends Node {
      constructor(tag = 'div') { super(tag); this.style = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
      getContext() { return new Proxy({ measureText: t => ({ width: t.length * 15 }) }, { get: (o, k) => o[k] ?? (() => {}) }); }
    }
    const elements = {};
    const document = { body: new Element('body'), createElement: t => new Element(t), getElementById: id => elements[id] ??= new Element(), addEventListener() {}, exitPointerLock() {} };
    class Renderer { constructor() { this.domElement = new Element('canvas'); this.shadowMap = {}; } setPixelRatio() {} setSize() {} render() {} }
    const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
    const context = vm.createContext({ THREE: { ...Three, WebGLRenderer: Renderer, TextureLoader: class { load() { return new Three.Texture(); } } }, document, window: {}, navigator: { maxTouchPoints: 0 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
      performance: { now: () => 0 }, setTimeout: () => 1, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {}, console, URLSearchParams, addEventListener() {},
      localStorage, location: { search, reload() {} }, confirm: () => true });
    vm.runInContext(tutorialSource, context);
    vm.runInContext(script + '\nglobalThis.api={player,startGame,tryThing,get quest(){return quest;},get questCard(){return questCard;},get started(){return started;}};', context);
    return { a: context.api, document };
  }
  const store = new Map([['mynecraft_save_v1', JSON.stringify({ version: 1, edits: [] })]]), before = store.get('mynecraft_save_v1');
  const { a, document } = boot(store, '?mode=creative&tutorial=1');
  assert(a.quest, 'the title screen link starts the quest'); assert.equal(a.started, true, 'and goes straight into the world');
  assert(document.body.children.includes(a.questCard.card), 'the quest card is on screen');
  assert.equal(a.quest.steps.length, 9, 'Creative includes the flying step');
  // Pressing Save on the save step finishes the quest.
  while (a.quest.state().step.id !== 'save') a.quest.skip();
  const walk = node => [node, ...(node.children || []).flatMap(walk)];
  const save = walk(document.body).find(n => n.tagName === 'BUTTON' && n.textContent === 'Save');
  assert(save, 'the Save button is on screen'); save.click();
  assert.equal(a.quest.state().finished, true, 'pressing Save finishes the save step');
  assert.equal(store.get('mynecraft_tutorial_done'), '1', 'finishing is remembered for next time');
  a.questCard.card.find('quest-helper').click();
  assert.equal(a.quest, null, 'Keep playing closes the quest');
  assert.equal(JSON.parse(store.get('mynecraft_save_v1')).version, JSON.parse(before).version, 'the world save keeps its format');
  // The menu offers the quest again any time.
  assert.match(html, /data-try="quest"/); a.tryThing('quest'); assert(a.quest && !a.quest.state().finished, 'Things to try restarts the quest');
  // Without the link, no quest appears.
  const plain = boot(new Map(), '');
  assert.equal(plain.a.quest, null, 'a normal game has no quest card');
}
console.log('PASS: the Basics quest teaches each control by doing it, Skip and Exit always work, and only a separate "done" preference is saved.');
