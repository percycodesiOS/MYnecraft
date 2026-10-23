// Run: node game/tests/title-screen.test.mjs
// The plain school link shows the landing title screen first, exactly once per
// tab, with no redirect loop; deep links and saves are unaffected.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const game = await fs.readFile(new URL('../mynecraft.html', import.meta.url), 'utf8');
const landing = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');
// The title check is the first plain <script> in the game's <head>, before any engine loads.
const headScript = game.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
assert(game.indexOf(headScript) < game.indexOf('<script type="importmap">'), 'the check runs before the game engine loads');
const landingScript = landing.match(/<script>([\s\S]*?)<\/script>/)[1];

function tab(initial = {}) {
  const store = new Map(Object.entries(initial)), writes = [];
  return { store, writes, sessionStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { writes.push(k); store.set(k, String(v)); }, removeItem: k => store.delete(k) } };
}
function openGame({ search = '', hash = '', session = tab(), broken = false } = {}) {
  const replaced = [];
  const sessionStorage = broken ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } : session.sessionStorage;
  vm.runInNewContext(headScript, { location: { search, hash, replace: url => replaced.push(url) }, sessionStorage });
  return { replaced, session };
}

// A fresh tab on the school link goes to the landing page on the same site.
{
  const first = openGame();
  assert.deepEqual(first.replaced, ['../index.html'], 'relative, so CyberGrader.io students stay on CyberGrader.io');
  // Coming back from the landing in the same tab never redirects again.
  const again = openGame({ session: first.session });
  assert.deepEqual(again.replaced, [], 'no loop, even if the landing page never ran');
}
// Deep links and room links open the game exactly as before.
for (const search of ['?mode=hardcore', '?mode=creative', '?room=1', '?demo=1']) assert.deepEqual(openGame({ search }).replaced, [], search + ' opens the game directly');
assert.deepEqual(openGame({ hash: '#play' }).replaced, [], 'a #hash link opens the game directly');
// Blocked storage fails open: the game loads, and nothing throws.
assert.deepEqual(openGame({ broken: true }).replaced, []);
// The tab mark is never the world save.
{ const s = tab(); openGame({ session: s }); assert.deepEqual(s.writes, ['mynecraft_title_seen']); assert(!s.writes.includes('mynecraft_save_v1')); }

// The landing marks the tab, and PLAY asks the game to start right away.
{
  const s = tab(), events = {}, modes = ['creative', 'survival', 'hardcore'].map(value => ({ value, checked: false, addEventListener(type, fn) { this.change = fn; } }));
  const play = { href: 'game/mynecraft.html?mode=creative', addEventListener(type, fn) { events[type] = fn; }, setAttribute(name, value) { this[name] = value; } };
  const howto = { addEventListener(type, fn) { this[type] = fn; } }, details = { open: false };
  vm.runInNewContext(landingScript, { document: { getElementById: id => ({ 'play-button': play, 'howto-button': howto, howDetails: details })[id] ?? null, querySelectorAll: () => modes }, sessionStorage: s.sessionStorage });
  howto.click(); assert.equal(details.open, true, 'the big How to play button also opens the full controls');
  assert.equal(s.store.get('mynecraft_title_seen'), '1', 'seeing the title screen marks the tab');
  assert.equal(s.store.has('mynecraft_start_now'), false);
  modes[1].checked = true; modes[1].change(); assert.equal(play.href, 'game/mynecraft.html?mode=survival');
  events.click(); assert.equal(s.store.get('mynecraft_start_now'), '1', 'PLAY goes straight into the world');
  assert.deepEqual([...s.store.keys()].sort(), ['mynecraft_start_now', 'mynecraft_title_seen'], 'only tab marks, never the save');
  const back = openGame({ session: s }); assert.deepEqual(back.replaced, [], 'the game opened from PLAY stays in the game');
}
// The landing still works where sessionStorage is missing entirely.
assert.doesNotThrow(() => vm.runInNewContext(landingScript, { document: { getElementById: () => ({ setAttribute() {} }), querySelectorAll: () => [] } }));
// The title screen keeps the approved relative Play path and a real game title.
assert.match(landing, /id="play-button" href="game\/mynecraft\.html\?mode=creative"/);
assert.match(landing, /class="block-title" aria-label="MYnecraft"/);
// Kenny's October 23 requests: a big How to play button, mode snippets, a readable
// tagline plate, and the Specials teachers instead of the dogs on the title screen.
assert.match(landing, /id="howto-button"/);
assert.equal((landing.match(/<span class="more">/g) || []).length, 3, 'each mode has its short snippet');
assert.match(landing, /class="tagline"/);
assert.doesNotMatch(landing, /ec-world-cover\.png/, 'the dog picture is no longer the title background');
for (const id of ['macek', 'micco', 'eriksen', 'mullet', 'wingenbach', 'mcmichael']) {
  assert.match(landing, new RegExp(`class="fig[^"]*" src="game/assets/staff-lineup/${id}\\.png"`), id + ' stands in the school scene on wide screens');
  assert.match(landing, new RegExp(`crew-row[\\s\\S]*staff-lineup/${id}\\.png`), id + ' is in the row on phones');
}
assert.match(landing, /class="fig fig-wave" src="game\/assets\/staff-lineup\/macek\.png"/, 'Mr. Macek is the one waving');
assert.match(landing, /@font-face\{font-family:Fredoka;src:url\('game\/assets\/fredoka\/Fredoka-latin\.woff2'\)/, 'the kid font is bundled locally');
for (const file of ['../assets/fredoka/Fredoka-latin.woff2', '../assets/fredoka/OFL.txt', '../assets/ec-title-bg.jpg', ...['macek', 'micco', 'eriksen', 'mullet', 'wingenbach', 'mcmichael'].map(id => `../assets/staff-lineup/${id}.png`)]) {
  const bytes = await fs.readFile(new URL(file, import.meta.url));
  // The full-width school picture gets more room than the small pictures, still far below the 2.5 MB original.
  const limit = file.endsWith('ec-title-bg.jpg') ? 400 * 1024 : 300 * 1024;
  assert(bytes.length > 0 && bytes.length < limit, file + ' exists and stays light for phones');
}
assert.match(await fs.readFile(new URL('../assets/fredoka/OFL.txt', import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
assert.doesNotMatch(landing, /percycodesios\.github\.io\/MYnecraft/, 'students are never sent to the separate primary site');
console.log('PASS: plain link shows the title screen once per tab, no loops, deep links unchanged, PLAY starts the world, saves untouched.');
