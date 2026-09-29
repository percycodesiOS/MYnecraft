# MYnecraft source ownership

This repository is the authoritative MYnecraft development source and its primary GitHub Pages site. Read README.md for release instructions.

- Primary site: `https://percycodesios.github.io/MYnecraft/`, deployed from this repository's `main` by `.github/workflows/pages.yml` after `npm test` passes.
- Keep the CyberGrader.io landing and game URLs working as compatibility addresses. Do not rename or delete CyberGrader.io, redirect its game away, or touch its unrelated apps.
- Make game changes here. Do not independently edit CyberGrader.io's game copy; update it only with `scripts/stage-release.mjs` from a clean isolated clone so both addresses run the same release.
- Preserve saved worlds, legacy imports, control preferences, the `mynecraft_save_v1` storage key, relative assets and query/hash behavior. Both sites share the `percycodesios.github.io` origin and therefore one autosave; do not move either to another origin without a migration.
- Run `npm test` for gameplay/release changes and inspect affected browser behavior when appropriate.
- Review the host diff before an authorized normal push. Never force-push or delete unrelated files.
- Preserve unfinished work in older review checkouts. Compare its history before reusing it; never overwrite this newer baseline with an old review version.
- Keep personal context, private documents, student records, credentials and assistant memory outside this public repository. Do not modify CIRC-HQ as part of MYnecraft work.
- Report prepared, committed, pushed and verified-live states accurately for each site. A source push deploys only the primary site, and only after the workflow succeeds.
