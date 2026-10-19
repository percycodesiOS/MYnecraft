# MYnecraft: EC Edition

Standalone source repository and primary GitHub Pages site for MYnecraft. The September 29, 2026 extraction preserves the released game from `percycodesiOS/CyberGrader.io` commit `243bd39ae03d049da97f1db9e405b74e061b7446`, including its regression tests and assets.

## Play

Primary site, published from this repository:

- [Landing page](https://percycodesios.github.io/MYnecraft/)
- [Game](https://percycodesios.github.io/MYnecraft/game/mynecraft.html)

Compatibility addresses, still published from `percycodesiOS/CyberGrader.io`:

- [Landing page](https://percycodesios.github.io/CyberGrader.io/)
- [Game](https://percycodesios.github.io/CyberGrader.io/game/mynecraft.html)

Keep both working. The school has approved the existing CyberGrader.io address, so classroom links must continue to use it. Do not rename or delete CyberGrader.io, redirect its game away, or remove its unrelated apps. The landing page keeps Play on the same path and does not send students to the separate primary site.

## Saved worlds

Both Pages sites share the origin `https://percycodesios.github.io`. The game saves to `localStorage` key `mynecraft_save_v1`, which is scoped by origin rather than path, so a player's autosave opens at either address in the same browser. The game uses no cookies, IndexedDB or service worker. Do not change the save key, move the site to another domain, or add path-scoped storage without a migration. Download Save (formerly Download World) / Load World JSON backups remain the way to move a world to another device or browser. The backup format is unchanged, so older MYnecraft downloads still load. These files cannot be imported into Minecraft. Loading validates the file before asking to replace the current local world; canceling or a failed storage write preserves that world. Download and check a copy of the current world first to keep both.

Creative and regular Embrace the Challenge continue to share the campus world. Hardcore is directly selectable from the landing page or `game/mynecraft.html?mode=hardcore`; completing the regular challenge is not required. It uses a separate resource world and progress stored in the `hardcoreWorld` property of the same save envelope. `activeWorld` records which world to reopen. Existing campus fields stay at the top level for legacy compatibility. Download Save includes both worlds; importing a backup replaces the saved envelope after confirmation rather than merging worlds. Older backups have no Hardcore slot and keep their original campus build.

Because the two addresses share one save, keep them on the same release. An older compatibility copy could otherwise load and rewrite a save made by a newer primary build.

## Building and play options

- **Creative:** unlimited building in the campus world, with flight and coordinate travel.
- **Embrace the Challenge:** the existing campus goals stay the same: collect 10 wood, place 12 blocks, and find CIRC.
- **Embrace the Challenge: Hardcore:** a separate peaceful resource world with a village, crafting, a mine, building goals, and unlockable materials, animals, and existing teacher characters. Its name describes progression and resource limits, not combat or permanent death. Only the player's own qualifying construction completes building goals.
- **Materials and depth:** cherry, spruce, and pine wood variations, concrete colors, copper and iron ores, and mineable terrain down to the protected floor at Y = -40. Deep terrain is virtual until exposed, keeping the initial world size bounded. Excavations are saved as block edits and their exposed faces are rebuilt on load.
- **Play activities:** Use E or the on-screen action to shoot at a basketball hoop or enter/leave the small car. Choose unlocked animals in Inventory; fish require a player-built pond or tank and can only be placed in water. Activities are stored separately with the campus and Hardcore worlds.
- **Percy and Ellie:** In the campus world, the pair run short loops together and return to the current player. They travel side by side where space permits, use narrow paths safely, and stay on the ground when the player flies. The menu pauses their routine.
- **Help:** H toggles the on-screen movement guide and mouse hint. The menu's Show movement help checkbox provides the same choice on touch devices.
- **Day and night:** Auto sleep is the default. At 6:00 PM the world rests for one active second, then starts a new day at 6:00 AM. The menu and inventory pause that second. Always day keeps a bright sky while the normal schedule clock advances. Full day/night retains the original 20-minute cycle. The setting is saved with the world; campus schedules continue to use game time.
- **Cafeteria cleanup:** A procedural cafeteria custodian rides a gray floor scrubber from 2:00 PM to 3:00 PM each game day. The route stays in the main cafeteria, clears the visible tables and stools, and stops for student-placed obstacles. It pauses with the game, is restored from game time, and does not appear in Hardcore. No source photograph or private identity is included.

Progression rules live in `game/hardcore-rules.js`, resource terrain in `game/hardcore-world.js`, additional play activities in `game/play-activities.js`, and the timed cafeteria custodian in `game/cafeteria-cleaner.js`. Keep these local scripts available at both release addresses with the main game.

## Group-room development status

`game/rooms.html` and `game/room-client.js` connect to the separate Node service in `server/room-service.mjs`; see `server/README.md`. This service is not hosted by GitHub Pages and no public service URL is configured in this release. Local verification covers teacher admission, open/close, scoped sessions, authoritative block edits, and isolation from personal saves. Chat and text-sign fields are absent from the room protocol. The service holds rooms in memory and requires manual teacher review unless a server-side detector is supplied. Automated recognition of words made from blocks, actual screenshot capture/delivery, durable storage, verified student identity, and full-class load validation remain incomplete. Do not represent this as the completed automatic classroom-safeguard system.

## Develop and verify

Edit `index.html`, `game/mynecraft.html`, `game/start-menu.css` and `game/assets/` here. Run `npm test` with Node.js. No npm dependencies are required. The game and regression harness use the vendored Three.js 0.160.0 module in `game/vendor/`; its original MIT license is alongside it. The game loads its engine, textures, fonts and controls from the same published path, without requiring an external CDN to be unblocked. Tests also run without a network download or temporary engine cache. See `game/vendor/README.md` for provenance and the pinned hash.

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
