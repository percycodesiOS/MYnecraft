import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const context = vm.createContext({});
vm.runInContext(await fs.readFile(new URL('../library-books.js', import.meta.url), 'utf8'), context);
const L = context.MYNE_LIBRARY;
const base = new URL('../assets/library-audio/ava-v1/', import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', base), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
assert.equal(manifest.pages.length, L.STORIES.reduce((count, book) => count + book.pages.length, 0));
assert.equal(manifest.voice, 'en-US-AvaMultilingualNeural');
for (const book of L.STORIES) for (let page = 0; page < book.pages.length; page++) {
  const matches = manifest.pages.filter(item => item.book === book.id && item.page === page + 1);
  assert.equal(matches.length, 1, 'exactly one recording per page');
  const record = matches[0];
  assert.equal(record.file, `${book.id}-${page + 1}.mp3`);
  assert.equal(record.textSha256, hash(book.pages[page]), 'regenerate narration when words change');
  const bytes = await fs.readFile(new URL(record.file, base));
  assert.equal(bytes.length, record.bytes);
  assert.equal(hash(bytes), record.sha256, 'recording is the verified complete MP3');
  assert(record.seconds > 2 && record.seconds < 30 && record.frames > 0 && record.verifiedWords > 0);
}

class FakeAudio {
  static instances = [];
  constructor() { FakeAudio.instances.push(this); this.src = ''; this.currentTime = 0; this.paused = true; this.pending = []; }
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() { this.currentTime = 0; }
}
const voice = L.recordedSpeech({ Audio: FakeAudio });
const audio = voice.element;
assert.equal(audio.preload, 'none', 'no eager audio download while playing the game');
const session = L.createSession(voice);
session.open('roof-tea');
assert.equal(audio.src, '', 'opening the library does not autoplay');
session.readAloud();
assert.equal(audio.src, 'assets/library-audio/ava-v1/roof-tea-1.mp3');
audio.pending.at(-1).resolve();
audio.currentTime = 2;
session.pause(); assert(audio.paused); assert(session.state().paused);
session.resume(); assert(!audio.paused); assert.equal(audio.currentTime, 2, 'resume keeps the playhead');
const staleEnded = audio.onended;
const stalePlay = audio.pending.at(-1);
session.next();
assert.equal(audio.src, 'assets/library-audio/ava-v1/roof-tea-2.mp3');
staleEnded(); stalePlay.reject(new Error('old page aborted'));
await Promise.resolve();
assert.equal(session.state().page, 1); assert(session.state().reading);
audio.onended(); assert.equal(session.state().page, 2);
assert.equal(FakeAudio.instances.length, 1, 'reuse the unlocked audio element for all pages');
const cancelledEnd = audio.onended;
session.stop(); cancelledEnd();
assert(audio.paused); assert.equal(audio.src, ''); assert.equal(session.state().page, 2); assert(!session.state().reading);

// A failed request stays on its page and offers a retry, without a robot fallback.
session.readAloud(); audio.onerror();
assert(!session.state().reading); assert.equal(session.state().page, 2); assert.match(session.state().error, /try again/);
session.readAloud(); assert.equal(session.state().error, ''); assert(session.state().reading);
audio.pending.at(-1).reject(new Error('autoplay denied'));
await Promise.resolve();
assert(!session.state().reading); assert.equal(session.state().page, 2);

// Pausing while play is still loading must not turn its AbortError into a failure.
session.readAloud(); const interruptedPlay = audio.pending.at(-1);
session.pause(); session.resume(); interruptedPlay.reject(new Error('paused'));
await Promise.resolve();
assert(session.state().reading); assert.equal(session.state().error, '');
const oldBookEnd = audio.onended;
session.open('dogs-day'); oldBookEnd();
assert.equal(session.state().book, 'dogs-day'); assert.equal(session.state().page, 0); assert(!session.state().reading);
session.readAloud();
for (let i = 0; i < 5; i++) audio.onended();
assert.equal(session.state().page, 4); assert(!session.state().reading); assert.equal(session.state().error, '');
session.closeBook(); assert.equal(audio.src, ''); assert(audio.paused);
assert.equal(L.recordedSpeech({}), null);

// Very old devices without audio can still use an available enhanced device voice.
const enhanced = { name: 'Example Enhanced', lang: 'en-US' }, ordinary = { name: 'Basic', lang: 'en-US' };
let utterance;
const fallback = L.browserSpeech({ SpeechSynthesisUtterance: function(text) { this.text = text; },
  speechSynthesis: { getVoices: () => [ordinary, enhanced], speak: value => { utterance = value; } } });
fallback.speak('Hello.');
assert.equal(utterance.voice, enhanced); assert.equal(utterance.pitch, 1); assert.equal(utterance.rate, 1);
console.log('PASS: all 40 natural recordings match their pages; pause/resume, page turns, stop, retry and stale callbacks are safe.');
