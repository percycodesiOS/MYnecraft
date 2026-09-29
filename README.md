# MYnecraft: EC Edition

Standalone source repository and primary GitHub Pages site for MYnecraft. The September 29, 2026 extraction preserves the released game from `percycodesiOS/CyberGrader.io` commit `243bd39ae03d049da97f1db9e405b74e061b7446`, including its regression tests and assets.

## Play

Primary site, published from this repository:

- [Landing page](https://percycodesios.github.io/MYnecraft/)
- [Game](https://percycodesios.github.io/MYnecraft/game/mynecraft.html)

Compatibility addresses, still published from `percycodesiOS/CyberGrader.io`:

- [Landing page](https://percycodesios.github.io/CyberGrader.io/)
- [Game](https://percycodesios.github.io/CyberGrader.io/game/mynecraft.html)

Keep both working. Students, bookmarks and course links may use the old addresses. Do not rename or delete CyberGrader.io, redirect its game away, or remove its unrelated apps. When served from the CyberGrader.io path, the landing page shows a short link to the primary site.

## Saved worlds

Both Pages sites share the origin `https://percycodesios.github.io`. The game saves to `localStorage` key `mynecraft_save_v1`, which is scoped by origin rather than path, so a player's autosave opens at either address in the same browser. The game uses no cookies, IndexedDB or service worker. Do not change the save key, move the site to another domain, or add path-scoped storage without a migration. Download World / Load World JSON backups remain the way to move a world to another device or browser.

Because the two addresses share one save, keep them on the same release. An older compatibility copy could otherwise load and rewrite a save made by a newer primary build.

## Develop and verify

Edit `index.html`, `game/mynecraft.html`, `game/start-menu.css` and `game/assets/` here. Run `npm test` with Node.js. No npm dependencies are required. The game and regression harness use Three.js 0.160.0; the harness may fetch that pinned library into the operating system's temporary cache on first run.

Serve this directory over HTTP to inspect desktop and touch layouts. Preserve save keys, imported worlds, controls, query/hash parameters and relative asset paths. Unit tests do not replace a browser check when changing visible behavior.

## Release

Both published copies contain the same committed runtime files: `index.html` and `game/` except `game/tests/`, plus a `mynecraft-release.json` manifest with the source commit and file hashes.

### 1. Primary site

1. Review and test changes here, commit them, and push `main`.
2. `.github/workflows/pages.yml` runs `npm test`, builds `_site` with `node scripts/build-site.mjs`, and deploys it to GitHub Pages. A failed test stops the deploy. The repository's Pages source must be **GitHub Actions**.
3. Confirm the workflow succeeded, then fetch the primary landing page, game, changed assets and `mynecraft-release.json`, and check that `sourceCommit` matches.

### 2. CyberGrader.io compatibility copy

1. Make a fresh clone of `https://github.com/percycodesiOS/CyberGrader.io.git` into an isolated release directory. Do not use a dirty development checkout or an old review worktree.
2. Run `node scripts/stage-release.mjs --target <release-directory> --check` from this repository, then the same command without `--check`.
3. Review the host diff. The helper stages only the tracked MYnecraft runtime files and `mynecraft-release.json`. It does not delete old files, change Pages settings, commit, or push. Unrelated CyberGrader/GameBash content stays intact.
4. Commit the reviewed host diff and push its existing `main` branch normally. Its Pages site continues deploying from that branch.
5. Verify the compatibility landing page, game, changed assets and `mynecraft-release.json`. Record the source commit, hosting commit, checks and observed deployment result for both sites.

For a rollback, use a reviewed known-good source commit in a separate clean source checkout: revert on `main` here, then repeat both release steps. Do not reset shared history or erase players' saves.

Old CyberGrader.io commits and review worktrees remain historical evidence. The initial extraction excludes unrelated apps and untracked alternate image/design files; it does not discard those originals. CIRC-HQ is a separate product and repository.
