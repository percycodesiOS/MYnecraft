# MYnecraft source ownership

This repository is the authoritative MYnecraft development source. Read README.md for release instructions.

- Keep the existing CyberGrader.io Pages landing and game URLs unchanged.
- Make game changes here. CyberGrader.io is the compatibility publication host; do not independently edit its game copy.
- Preserve saved worlds, legacy imports, control preferences, browser storage keys, relative assets and query/hash behavior.
- Run `npm test` for gameplay/release changes and inspect affected browser behavior when appropriate.
- Release with `scripts/stage-release.mjs` into a clean isolated CyberGrader.io clone; review the diff before an authorized normal push. Never force-push or delete unrelated files.
- Preserve unfinished work in older review checkouts. Compare its history before reusing it; never overwrite this newer baseline with an old review version.
- Keep personal context, private documents, student records, credentials and assistant memory outside this public repository. Do not modify CIRC-HQ as part of MYnecraft work.
- Report prepared, committed, pushed and verified-live states accurately. A source push alone does not deploy the host.
