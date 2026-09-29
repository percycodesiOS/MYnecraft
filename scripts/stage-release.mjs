import { execFileSync } from 'node:child_process';
import { lstatSync, existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hash = data => createHash('sha256').update(data).digest('hex');
const expectedHost = /^(https:\/\/github\.com\/|git@github\.com:)percycodesios\/CyberGrader\.io(?:\.git)?$/i;
export function safeFile(root, name) {
  const path = resolve(root, name);
  const rel = relative(root, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Path outside release root: ${name}`);
  let current = path;
  while (current !== root) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Symlink is not a release destination: ${name}`);
    current = dirname(current);
  }
  return path;
}
export function stageRelease(sourceRoot, targetRoot, check = false) {
  sourceRoot = realpathSync.native(resolve(sourceRoot));
  targetRoot = realpathSync.native(resolve(targetRoot));
  if (sourceRoot === targetRoot) throw new Error('Source and host checkout must differ.');
  if (!expectedHost.test(git(targetRoot, 'remote', 'get-url', 'origin'))) throw new Error('Target origin is not the existing CyberGrader.io host.');
  for (const root of [sourceRoot, targetRoot]) {
    if (realpathSync.native(resolve(git(root, 'rev-parse', '--show-toplevel'))) !== root) throw new Error('Use the root of each checkout.');
    if (git(root, 'status', '--porcelain')) throw new Error(`Checkout must be clean: ${root}`);
  }
  if (git(targetRoot, 'branch', '--show-current') !== 'main' || git(targetRoot, 'rev-parse', 'HEAD') !== git(targetRoot, 'rev-parse', 'origin/main')) throw new Error('Use a fresh main checkout matching origin/main.');
  const commit = git(sourceRoot, 'rev-parse', 'HEAD');
  const names = git(sourceRoot, 'ls-files', '-z').split('\0').filter(name => name === 'index.html' || (name.startsWith('game/') && !name.startsWith('game/tests/'))).sort();
  for (const required of ['index.html', 'game/mynecraft.html', 'game/start-menu.css']) if (!names.includes(required)) throw new Error(`Missing runtime file: ${required}`);
  // Validate every file before writing anything; use committed bytes, not a second mutable source read.
  const plan = names.map(name => {
    const from = safeFile(sourceRoot, name), to = safeFile(targetRoot, name);
    if (!lstatSync(from).isFile()) throw new Error(`Not a regular runtime file: ${name}`);
    const data = execFileSync('git', ['-C', sourceRoot, 'show', `${commit}:${name}`], { maxBuffer: 64 * 1024 * 1024 });
    return { name, to, data, sha256: hash(data) };
  });
  const manifestPath = safeFile(targetRoot, 'mynecraft-release.json');
  const manifest = { sourceRepository: 'https://github.com/percycodesiOS/MYnecraft', sourceCommit: commit, liveBase: 'https://percycodesios.github.io/CyberGrader.io/', files: Object.fromEntries(plan.map(p => [p.name, p.sha256])) };
  if (!check) {
    for (const p of plan) { mkdirSync(dirname(p.to), { recursive: true }); writeFileSync(p.to, p.data); }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    for (const p of plan) if (hash(readFileSync(p.to)) !== p.sha256) throw new Error(`Verification failed: ${p.name}`);
  }
  return { mode: check ? 'check-only' : 'prepared-and-verified', sourceCommit: commit, runtimeFiles: plan.length, target: targetRoot, committedOrPushed: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf('--target');
  if (i < 0 || !args[i + 1]) throw new Error('Usage: node scripts/stage-release.mjs --target <clean-host-clone> [--check]');
  console.log(JSON.stringify(stageRelease(source, args[i + 1], args.includes('--check')), null, 2));
}
