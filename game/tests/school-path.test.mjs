import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('the game engine is the original pinned local module, with no external runtime imports',()=>{
 const html=readFileSync(new URL('../mynecraft.html',import.meta.url),'utf8');
 const imports=JSON.parse(html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/)[1]).imports;
 assert.equal(imports.three,'./vendor/three.module.js');
 const engine=readFileSync(new URL('../vendor/three.module.js',import.meta.url));
 assert.equal(createHash('sha256').update(engine).digest('hex'),'76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495');
 assert.doesNotMatch(engine.toString(),/\b(?:import|export)\s[^;\n]*\bfrom\s*['"]https?:/);
 assert.match(readFileSync(new URL('../vendor/THREE-LICENSE.txt',import.meta.url),'utf8'),/Permission is hereby granted/);
 for(const source of [html,readFileSync(new URL('../../index.html',import.meta.url),'utf8')]){
  assert.doesNotMatch(source,/<(?:script|img|link)\b[^>]*(?:src|href)\s*=\s*["']https?:/i,'runtime assets must remain on the approved site');
 }
});

test('school Play and return links stay beneath the existing CyberGrader.io path',()=>{
 const landing=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../mynecraft.html',import.meta.url),'utf8');
 const base='https://percycodesios.github.io/CyberGrader.io/';
 const play=landing.match(/id="play-button" href="([^"]+)"/)[1];
 assert.equal(new URL(play,base).href,base+'game/mynecraft.html?mode=creative');
 assert.match(game,/backLink\.href = '\.\.\/index\.html'/);
 assert.doesNotMatch(landing,/href="https:\/\/percycodesios\.github\.io\/MYnecraft\//,'students are not directed to the unapproved new path');
});
