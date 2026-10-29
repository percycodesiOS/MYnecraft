// Run: node game/tests/ui-layout.test.mjs
// Static layout guards for the phone and Chromebook interface: every top-bar button stays
// on screen, touch screens do not repeat the FLY button, browsers fetch the current
// stylesheet, and the landing header stays on one line on a phone.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const css = await fs.readFile(new URL('../start-menu.css', import.meta.url), 'utf8');
const game = await fs.readFile(new URL('../mynecraft.html', import.meta.url), 'utf8');
const landing = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');

// The body of the first @media block whose condition matches.
function mediaBody(source, condition) {
  const start = source.indexOf('@media ' + condition);
  assert(start >= 0, 'media block exists: ' + condition);
  let depth = 0, i = source.indexOf('{', start);
  const open = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, i);
}

const narrow = mediaBody(css, '(max-width:1100px)');
assert.match(narrow, /#controls \{[^}]*flex-wrap:wrap/, 'on tablets and phones the top bar wraps instead of pushing buttons off screen');
assert.match(narrow, /#questToggle[^{]*\{[^}]*font-size:0/, 'Fly and Tutorial become icons on narrower screens');
assert.match(css, /body\.touch-device #controls #flyToggle \{ display:none; \}/, 'touch screens use the big FLY button instead');
assert.match(mediaBody(css, '(max-width:420px)'), /#controls button \{[^}]*padding:9px 9px/, 'small phones get compact buttons');

// A new version tag makes every browser fetch the updated stylesheet instead of a cached one.
const version = game.match(/href="start-menu\.css\?v=([^"]+)"/);
assert(version, 'the stylesheet link carries a version');
assert.notEqual(version[1], 'teachers-20261027', 'the version changed with this stylesheet');

// The inventory sheet keeps its close button at the top while it scrolls.
assert.match(css, /\.inventory-head \{[^}]*position: sticky/, 'the Blocks sheet header stays in view');

// The landing header: one line on a phone, the small edition pill hidden there.
assert.match(landing, /\.nav-cta,\.nav-brand\{white-space:nowrap\}/);
assert.match(landing, /@media \(max-width:480px\)\{\.nav-brand small\{display:none\}/);

console.log('PASS: phone top bar wraps and stays on screen, touch FLY is not repeated, stylesheet version bumped, sticky Blocks header, one-line landing header.');
