import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRoomService } from '../../server/room-service.mjs';

const clientSource = await fs.readFile(new URL('../room-client.js', import.meta.url), 'utf8');

test('room client uses authoritative HTTP edits, admission, pause, lock and close', { timeout: 20000 }, async () => {
  // Temporary loopback-only credentials. Nothing reaches a deployed classroom.
  const password = 'synthetic-room-client-test-only';
  const server = createRoomService({ password });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const clients = [];
  const call = async (path, token, body) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json();
    assert(response.ok, JSON.stringify(data));
    return data;
  };
  try {
    const teacher = await call('/api/teacher/login', null, { password });
    const room = await call('/api/rooms', teacher.token, {});
    await call('/api/rooms/' + room.id + '/open', teacher.token, { manualReview: true });
    const joined = [];
    for (let i = 0; i < 2; i++) joined.push(await call('/api/join', null, { code: room.code }));

    for (const student of joined) {
      const urls = [], stored = new Map(), edits = [], flags = { active: true };
      const context = vm.createContext({
        URL, AbortController, Date, console, setTimeout, clearTimeout,
        // Tests poll explicitly, so no background interval can race assertions.
        setInterval: () => 1, clearInterval() {},
        fetch(url, options) { urls.push(String(url)); return fetch(url, options); },
        sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }
      });
      vm.runInContext(clientSource, context);
      const session = { baseUrl: base, token: student.token, roomId: student.roomId, studentId: student.studentId, number: student.number };
      context.MYNE_ROOM.saveSession(session);
      assert.equal(context.MYNE_ROOM.readSession().studentId, student.studentId);
      const api = context.MYNE_ROOM.create({ session, isActive: () => flags.active, onEdit: edit => edits.push(edit), onStatus() {} });
      assert.equal(api.canWrite(), false, 'no write before hydration');
      clients.push({ api, flags, edits, context, urls });
    }
    for (let n = 0; n < 100 && clients.some(client => !client.api.getState()); n++) await new Promise(resolve => setTimeout(resolve, 10));
    assert(clients.every(client => client.api.getState()), 'both clients hydrated');
    assert(clients.every(client => !client.api.canWrite()), 'new students await teacher admission');
    for (const student of joined) await call('/api/rooms/' + room.id + '/players/' + student.studentId + '/unlock', teacher.token, {});
    for (const client of clients) await client.api.poll();
    assert(clients.every(client => client.api.canWrite()), 'teacher admitted both students');

    assert(await clients[0].api.edit({ x: 1, y: 4, z: 12, block: 'dirt' }));
    await clients[1].api.poll();
    assert.equal(clients[0].edits.length, 1);
    assert.equal(clients[1].edits.length, 1);
    assert.equal(clients[1].edits[0].block, 'dirt');
    await clients[1].api.poll();
    assert.equal(clients[1].edits.length, 1, 'repeat state does not apply a block twice');

    clients[0].flags.active = false;
    assert.equal(clients[0].api.canPlay(), true, 'sleeping or menu input pause does not revoke room admission');
    const requests = clients[0].urls.length;
    assert.equal(await clients[0].api.edit({ x: 2, y: 4, z: 12, block: 'dirt' }), false);
    assert.equal(clients[0].urls.length, requests, 'paused input sends no request');
    clients[0].flags.active = true;

    await call('/api/rooms/' + room.id + '/players/' + joined[0].studentId + '/lock', teacher.token, {});
    await clients[0].api.poll();
    assert.equal(clients[0].api.canWrite(), false, 'teacher lock stops further edits');
    assert.equal(clients[0].api.canPlay(), false, 'teacher lock also freezes world simulation');
    await call('/api/rooms/' + room.id + '/close', teacher.token, {});
    await clients[1].api.poll();
    assert.equal(clients[1].api.canWrite(), false, 'closed room stops further edits');
    await call('/api/rooms/' + room.id + '/reopen', teacher.token, { manualReview: true });
    await clients[1].api.poll();
    assert.equal(clients[1].api.canWrite(), true, 'reopening retains admitted students');
    assert.equal(clients[1].edits.length, 1, 'reopening retains the shared build');
    for (const client of clients) for (const url of client.urls) for (const student of joined) assert(!url.includes(student.token), 'tokens never enter URLs');
  } finally {
    for (const client of clients) client.api.dispose();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('room client rejects unsafe service addresses, session data and malformed state', () => {
  let value = null;
  const context = vm.createContext({ URL, sessionStorage: { getItem: () => value } });
  vm.runInContext(clientSource, context);
  const client = context.MYNE_ROOM;
  assert.equal(client.serviceURL('http://example.com'), null);
  assert.equal(client.serviceURL('https://user:password@example.com'), null);
  assert.equal(client.serviceURL('https://example.com?token=private'), null);
  assert.equal(client.serviceURL('javascript:alert(1)'), null);
  assert.equal(client.serviceURL('https://example.com/'), 'https://example.com');
  assert.equal(client.serviceURL('http://localhost:8787/'), 'http://localhost:8787');
  value = '{invalid JSON'; assert.equal(client.readSession(), null);
  value = JSON.stringify({ baseUrl: 'http://example.com', token: '12345678', roomId: 'room', studentId: 'student', number: 1 });
  assert.equal(client.readSession(), null);
  const state = { world: 'resource-v1', mode: 'creative', status: 'open', sequence: 1, self: { id: 'student', number: 1, x: .5, y: 5.7, z: 12.5, yaw: 0 }, players: [], edits: { '1,4,12': 'dirt' } };
  assert.equal(client.normalizeState(state).edits.length, 1);
  assert.throws(() => client.normalizeState({ ...state, edits: { 'NaN,4,12': 'dirt' } }));
  assert.throws(() => client.normalizeState({ ...state, edits: { '1,4,12': '<script>' } }));
  assert.throws(() => client.normalizeState({ ...state, sequence: -1 }));
  assert.throws(() => client.normalizeState({ ...state, world: 'unknown-world' }));
});

test('teacher polling preserves clickable controls and review choice', async () => {
  // A minimal DOM exercises the real launcher. No browser package or server is
  // needed to catch the former every-poll replaceChild race.
  let document;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.dataset = {}; this.listeners = new Map(); this._text = ''; }
    set textContent(value) { this._text = String(value); for (const child of this.children) child.parentNode = null; this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    append(...children) { for (const child of children) this.appendChild(child); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    replaceChild(next, previous) { const index = this.children.indexOf(previous); assert(index >= 0); this.children[index] = next; previous.parentNode = null; next.parentNode = this; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    contains(child) { return this === child || this.children.some(next => next.contains(child)); }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    async fire(name) { return this.listeners.get(name)?.({ preventDefault() {} }); }
    querySelectorAll() { return this.children.flatMap(child => [...(child.dataset.focusKey ? [child] : []), ...child.querySelectorAll()]); }
    focus() { document.activeElement = this; }
  }
  const elements = new Map();
  for (const id of ['roomService', 'studentJoin', 'joinButton', 'studentStatus', 'roomCode', 'teacherLogin', 'loginButton', 'teacherStatus', 'teacherPassword', 'teacherDashboard', 'teacherLogout', 'createRoom', 'refreshRooms', 'roomsList']) elements.set(id, new Element('div'));
  document = { activeElement: null, body: { hasAttribute: () => true }, getElementById: id => elements.get(id), createElement: tag => new Element(tag), createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; } };
  const intervals = [];
  const state = { code: '12345678', status: 'closed', sequence: 1, automaticTextDetection: false, players: [], events: [] };
  const context = vm.createContext({
    document, URL, AbortController, setTimeout, clearTimeout, location: { origin: 'http://localhost:8787' }, sessionStorage: { getItem: () => null },
    setInterval(fn) { intervals.push(fn); return intervals.length; }, clearInterval() {}, addEventListener() {},
    async fetch(url) {
      const path = new URL(url).pathname;
      let data;
      if (path === '/api/teacher/login') data = { token: 'synthetic-teacher-token' };
      else if (path === '/api/rooms') data = { rooms: [{ id: 'test-room', code: state.code }] };
      else if (path.endsWith('/state')) data = structuredClone(state);
      else if (path.endsWith('/open')) { state.status = 'open'; data = {}; }
      else throw new Error('Unexpected request ' + path);
      return { ok: true, json: async () => data };
    }
  });
  vm.runInContext(clientSource, context);
  elements.get('teacherPassword').value = 'synthetic-password';
  await elements.get('teacherLogin').fire('submit');
  const list = elements.get('roomsList');
  const firstCard = list.children[0];
  const find = key => list.querySelectorAll().find(node => node.dataset.focusKey === key);
  const checkbox = find('manual-review'), open = find('open');
  assert.equal(open.disabled, true);
  checkbox.checked = true;
  await checkbox.fire('change');
  open.focus();
  assert.equal(open.disabled, false);
  const poll = async () => { intervals.at(-1)(); await new Promise(resolve => setImmediate(resolve)); };
  state.sequence++;
  await poll();
  assert.equal(list.children[0], firstCard, 'sequence-only polling keeps the card mounted');
  assert.equal(find('open'), open, 'an in-progress click keeps its actual button');
  state.players.push({ id: 'student-one', number: 1, locked: true, removed: false, x: 0, y: 5.7, z: 12.5 });
  await poll();
  assert.notEqual(list.children[0], firstCard, 'new students update controls');
  assert.equal(find('manual-review').checked, true, 'review choice survives needed updates');
  assert.equal(document.activeElement, find('open'), 'focused control survives needed updates');
  const admittedCard = list.children[0];
  state.players[0].x = 3; state.sequence++;
  await poll();
  assert.equal(list.children[0], admittedCard, 'player movement does not detach teacher controls');
  await find('open').fire('click');
  assert.equal(state.status, 'open');
  assert(find('close'), 'opening shows the close control');
});
