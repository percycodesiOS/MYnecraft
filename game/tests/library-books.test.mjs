// Run: node game/tests/library-books.test.mjs
// The Little Library: original stories, a read-aloud session and the reading room.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../library-books.js', import.meta.url), 'utf8');
const scope = vm.createContext({ console }); vm.runInContext(source, scope);
const L = scope.MYNE_LIBRARY;

// Enough short, kid-sized books, each with a title, a cover colour and real pages.
assert(L.STORIES.length >= 8, 'a full shelf of stories');
assert.equal(new Set(L.STORIES.map(s => s.id)).size, L.STORIES.length);
for (const story of L.STORIES) {
  assert(story.title && /^#[0-9a-f]{6}$/i.test(story.color));
  assert(story.pages.length >= 4 && story.pages.length <= 8, story.title + ' is a short read');
  for (const page of story.pages) assert(page.length >= 40 && page.length <= 260, story.title + ' pages are short enough to read aloud');
}
assert(L.STORIES.some(s => /tea/i.test(s.title)), 'the tea-on-the-roof request has its own story');
assert(L.STORIES.some(s => /library/i.test(s.title)), 'and so does the library request');

// A fake voice records what is said; tests decide when each page finishes.
function fakeSpeech() {
  const log = [], ends = [];
  return { log, ends, speak(text, onEnd) { log.push(['speak', text]); ends.push(onEnd); }, pause() { log.push(['pause']); }, resume() { log.push(['resume']); }, cancel() { log.push(['cancel']); } };
}
{
  const speech = fakeSpeech(), changes = [];
  const s = L.createSession(speech, state => changes.push(state));
  assert(!s.readAloud(), 'nothing to read before a book is open');
  assert(s.open('roof-tea')); assert.equal(s.state().page, 0); assert.equal(s.state().pages, 5);
  assert(s.readAloud()); assert(s.state().reading);
  assert.equal(speech.log.at(-1)[1], L.STORIES[0].pages[0]);
  // Finishing a page reads the next one, all the way to the end.
  speech.ends.at(-1)(); assert.equal(s.state().page, 1); assert.equal(speech.log.at(-1)[1], L.STORIES[0].pages[1]);
  assert(s.pause()); assert(s.state().paused); assert.deepEqual(speech.log.at(-1), ['pause']);
  assert(s.resume()); assert(!s.state().paused); assert.deepEqual(speech.log.at(-1), ['resume']);
  // Turning the page while reading keeps reading from the new page.
  assert(s.next()); assert.equal(s.state().page, 2); assert(s.state().reading); assert.equal(speech.log.at(-1)[1], L.STORIES[0].pages[2]);
  // A late "end" from a cancelled page never skips ahead.
  const stale = speech.ends[1]; stale(); assert.equal(s.state().page, 2);
  s.stop(); assert(!s.state().reading); speech.ends.at(-1)(); assert.equal(s.state().page, 2, 'stop means stop');
  assert(s.prev()); assert.equal(s.state().page, 1); assert(!s.state().reading);
  for (let i = 0; i < 10; i++) s.next(); assert.equal(s.state().page, 4); assert(!s.next(), 'cannot turn past the last page');
  s.readAloud(); speech.ends.at(-1)(); assert(!s.state().reading, 'reading finishes at the end of the book');
  s.closeBook(); assert.equal(s.state().book, null); assert(!s.open('missing-book'));
  assert(changes.length > 5, 'every change repaints the page');
}
{
  const s = L.createSession(null);
  assert(s.open('dogs-day')); assert.equal(s.state().canSpeak, false); assert(!s.readAloud(), 'devices without a voice still show every page');
  assert(s.next()); assert.equal(s.state().text, L.STORIES.find(b => b.id === 'dogs-day').pages[1]);
}
assert.equal(L.browserSpeech({}), null, 'no speechSynthesis means no voice, not an error');

// The reading room itself, with a tiny stand-in page.
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.hidden = false; this.disabled = false; this.dataset = {}; this.events = {}; this.attrs = {}; this.textContent = ''; this.className = ''; this.style = { setProperty: (k, v) => { this.style[k] = v; } }; }
  append(...c) { this.children.push(...c); } appendChild(c) { this.children.push(c); }
  setAttribute(k, v) { this.attrs[k] = v; } addEventListener(k, f) { (this.events[k] ??= []).push(f); }
  click() { for (const f of this.events.click || []) f({}); } focus() { this.focused = true; }
  querySelector() { return this.find(e => e.tag === 'button'); }
  find(test) { for (const c of this.children) { if (test(c)) return c; const d = c.find?.(test); if (d) return d; } return null; }
}
const winEvents = {};
const doc = { body: new El('body'), createElement: tag => new El(tag) };
const win = { addEventListener: (k, f) => (winEvents[k] ??= []).push(f) };
let opened = 0, closed = 0;
const room = L.mount(doc, win, { onOpen: () => opened++, onClose: () => closed++ });
const overlay = doc.body.children[0];
assert(overlay.hidden && !room.isOpen());
room.open(); assert(room.isOpen()); assert.equal(opened, 1);
const findText = text => overlay.find(e => e.tag === 'button' && e.textContent === text);
const book = overlay.find(e => e.dataset?.story === 'little-library'); book.click();
const page = overlay.find(e => e.className === 'library-page');
assert.equal(page.textContent, L.STORIES.find(b => b.id === 'little-library').pages[0]);
assert(overlay.find(e => e.className === 'library-reader').hidden === false);
assert(findText('◀ Back').disabled); findText('Next ▶').click();
assert.equal(page.textContent, L.STORIES.find(b => b.id === 'little-library').pages[1]);
assert(overlay.find(e => e.className === 'library-note').hidden === false, 'the stand-in page has no voice, so it says so');
findText('Choose another book').click(); assert(overlay.find(e => e.className === 'library-shelf').hidden === false);
let prevented = false;
for (const f of winEvents.keydown) f({ code: 'Escape', preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
assert(!room.isOpen() && prevented && closed === 1, 'Escape closes the library and returns to the game');
console.log('PASS: original read-aloud shelf, page-by-page speech with pause/stop, voiceless devices, and the reading room.');
