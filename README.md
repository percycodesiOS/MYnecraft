# MYnecraft: EC Edition

Standalone source repository for MYnecraft. The September 29, 2026 extraction preserves the released game from `percycodesiOS/CyberGrader.io` commit `243bd39ae03d049da97f1db9e405b74e061b7446`, including its regression tests and assets.

## Play

- [Landing page](https://percycodesios.github.io/CyberGrader.io/)
- [Game](https://percycodesios.github.io/CyberGrader.io/game/mynecraft.html)

These addresses remain the public release locations. Do not rename or delete the hosting repository, enable a replacement Pages site, or redirect players as part of source cleanup.

## Develop and verify

Edit `index.html`, `game/mynecraft.html`, `game/start-menu.css` and `game/assets/` here. Run `npm test` with Node.js. No npm dependencies are required. The game and regression harness use Three.js 0.160.0; the harness may fetch that pinned library into the operating system's temporary cache on first run.

Serve this directory over HTTP to inspect desktop and touch layouts. Preserve save keys, imported worlds, controls, query/hash parameters and relative asset paths. Unit tests do not replace a browser check when changing visible behavior.

## Release without changing student links

1. Review and test changes here, commit them, and push this source repository.
2. Make a fresh clone of `https://github.com/percycodesiOS/CyberGrader.io.git` into an isolated release directory. Do not use a dirty development checkout.
3. Run `node scripts/stage-release.mjs --target <release-directory> --check` from this repository, then the same command without `--check`.
4. Review the host diff. Only the tracked MYnecraft runtime files and `mynecraft-release.json` are staged by the helper. It does not delete old files, change Pages settings, commit, or push. Unrelated CyberGrader/GameBash content stays intact.
5. Commit the reviewed host diff and push its existing `main` branch using the normal authenticated Git workflow. GitHub Pages continues deploying the old host's `main` branch at its existing address.
6. Verify the landing page, game, changed assets and `mynecraft-release.json` at the existing URLs. Record the source commit, hosting commit, checks and observed deployment result.

For a rollback, use a reviewed known-good source commit in a separate clean source checkout and repeat the same release process. Do not reset shared history or erase players' saves.

Old CyberGrader.io commits and review worktrees remain historical evidence. The initial extraction excludes unrelated apps and untracked alternate image/design files; it does not discard those originals. CIRC-HQ is a separate product and repository.
