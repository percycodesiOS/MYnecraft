import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runtimePlan, releaseManifest, primaryBase } from './stage-release.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = data => createHash('sha256').update(data).digest('hex');
// Builds the primary GitHub Pages artifact from committed runtime bytes: the same files stage-release.mjs copies to CyberGrader.io.
export function buildSite(sourceRoot, outRoot) {
  sourceRoot = realpathSync.native(resolve(sourceRoot));
  outRoot = resolve(outRoot);
  const rel = relative(sourceRoot, outRoot);
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.includes('/') || rel.includes('\\') || !rel.startsWith('_')) throw new Error('Output must be a new top-level folder starting with _ inside the source checkout.');
  if (existsSync(outRoot) && readdirSync(outRoot).length) throw new Error(`Output folder must be empty: ${outRoot}`);
  const { commit, plan } = runtimePlan(sourceRoot, name => join(outRoot, name));
  for (const p of plan) { mkdirSync(dirname(p.to), { recursive: true }); writeFileSync(p.to, p.data); }
  writeFileSync(join(outRoot, 'mynecraft-release.json'), JSON.stringify(releaseManifest(commit, plan, primaryBase), null, 2) + '\n');
  // GitHub Pages artifacts skip Jekyll, but keep the marker so a branch-based fallback serves every asset unchanged.
  writeFileSync(join(outRoot, '.nojekyll'), '');
  for (const p of plan) if (hash(readFileSync(p.to)) !== p.sha256) throw new Error(`Verification failed: ${p.name}`);
  return { mode: 'site-built', sourceCommit: commit, runtimeFiles: plan.length, out: outRoot, liveBase: primaryBase };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf('--out');
  console.log(JSON.stringify(buildSite(source, resolve(source, i >= 0 && args[i + 1] ? args[i + 1] : '_site')), null, 2));
}
