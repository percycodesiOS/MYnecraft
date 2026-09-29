import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stageRelease, safeFile } from './stage-release.mjs';
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { stdio: 'pipe' }).toString().trim();
const put = (root, path, text) => { mkdirSync(join(root, path, '..'), {recursive:true}); writeFileSync(join(root,path),text); };
test('release preserves unrelated host files, copies committed runtime only, and refuses unsafe targets', () => {
  const root=mkdtempSync(join(tmpdir(),'mynecraft-release-test-')), src=join(root,'source'), dst=join(root,'host');
  for (const p of [src,dst]) {
    mkdirSync(p); git(p,'init','-b','main'); git(p,'config','user.name','Release test'); git(p,'config','user.email','test@example.invalid'); git(p,'config','core.autocrlf','false');
  }
  for(const file of ['index.html','game/mynecraft.html','game/start-menu.css','game/assets/test.svg','game/tests/private.test.mjs']) put(src,file,'source '+file+'\n');
  put(dst,'unrelated.html','preserve me\n'); put(dst,'game/old-asset.png','preserve legacy asset\n');
  for(const p of [src,dst]) {git(p,'add','.'); git(p,'commit','-m','fixture');}
  git(dst,'remote','add','origin','https://github.com/percycodesiOS/CyberGrader.io.git'); git(dst,'update-ref','refs/remotes/origin/main','HEAD');
  assert.equal(stageRelease(src,dst,true).runtimeFiles,4);
  assert.equal(git(dst,'status','--porcelain'),'');
  const result=stageRelease(src,dst);
  assert.equal(result.committedOrPushed,false);
  assert.equal(readFileSync(join(dst,'unrelated.html'),'utf8'),'preserve me\n');
  assert.equal(readFileSync(join(dst,'game/old-asset.png'),'utf8'),'preserve legacy asset\n');
  assert.equal(readFileSync(join(dst,'game/mynecraft.html'),'utf8'),'source game/mynecraft.html\n');
  assert.equal(Object.keys(JSON.parse(readFileSync(join(dst,'mynecraft-release.json'),'utf8')).files).length,4);
  assert.throws(()=>stageRelease(src,dst),/clean/);
  assert.throws(()=>safeFile(dst,'../outside.html'),/outside/);
  git(dst,'remote','set-url','origin','https://github.com/another/wrong.git');
  assert.throws(()=>stageRelease(src,dst),/origin/);
});
