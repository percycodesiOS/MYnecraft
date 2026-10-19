# MYnecraft room service

This dependency-free Node HTTP service is a local reference implementation for teacher-controlled, creative group building. It is **not deployed** and is not part of the static Pages site. It makes no external requests. All rooms, tokens and events are in memory; restarting the process loses them. This service does not provide OCR, image classification, chat, or automatic detection of inappropriate builds. Without an optional moderation hook, teachers review the shared world themselves.

## Start locally

Use a supported Node version with the built-in test runner and fetch (Node 20 or newer). Set `MYNE_TEACHER_PASSWORD` to a private password of 16 to 256 characters, then run `npm run rooms`. There is no default password. Keep secrets in the host's environment or secret manager, never in the static game or repository.

Default listener: `127.0.0.1:8787`. `HOST` and `PORT` can override it. `MYNE_ALLOWED_ORIGINS` is a comma-separated list of exact browser origins, for example `https://percycodesios.github.io`. Browser requests with an Origin header are denied unless listed. Requests without Origin still require authentication for protected endpoints. A deployed service needs HTTPS, host request limits, availability monitoring, and a school-approved host; this source does not configure a host or publish anything. Do not put the teacher password in a URL or send it over public HTTP.

`npm run test:rooms` runs real HTTP tests on loopback with temporary test credentials.

## Protocol

All POST bodies are JSON objects with `Content-Type: application/json`. Extra fields, including arbitrary names or chat text, are rejected. Protected requests use `Authorization: Bearer <token>`. Tokens expire after eight hours. Never put a token in a URL, another student's browser, or a downloaded personal world file. Errors are `{ "error": "..." }` with the appropriate HTTP status (400, 401, 403, 404, 409, 413, 415, 429 or 503). Successful calls return HTTP 200.

| Method and path | Body / authorization | Result |
|---|---|---|
| `GET /api/health` | None | Service/version health |
| `POST /api/teacher/login` | `{password}` | `{token, expiresInSeconds}` |
| `GET /api/rooms` | Teacher | `{rooms: [...]}` |
| `POST /api/rooms` | `{}`; teacher | `{id, code, status, world, mode, sequence, expires, players}`; starts closed |
| `POST /api/rooms/:id/open` | `{}`; teacher | Open room summary |
| `POST /api/rooms/:id/close` | `{}`; teacher | Closed room summary; joining and edits stop |
| `POST /api/rooms/:id/reopen` | `{}`; teacher | Reopen the same world/code and keep builds |
| `POST /api/join` | `{code}`; eight-digit string | `{token, roomId, studentId, number, world, mode, bounds, expiresInSeconds}` |
| `GET /api/rooms/:id/state` | Teacher or this room's student | `{roomId,status,world,mode,sequence,bounds,edits,players,self,moderation}`; teacher also receives `events` |
| `POST /api/rooms/:id/move` | `{x,y,z,yaw}`; active student | `{sequence,player}` |
| `POST /api/rooms/:id/edit` | `{x,y,z,block}`; active student | `{sequence,edit,locked}`; `block:null` removes a block |
| `POST /api/rooms/:id/players/:studentId/lock` | `{}`; teacher | Paused student record |
| `POST /api/rooms/:id/players/:studentId/unlock` | `{}`; teacher | Unpaused student record |
| `POST /api/rooms/:id/players/:studentId/remove` | `{}`; teacher | Student can no longer poll or edit |
| `POST /api/rooms/:id/players/:studentId/restore` | `{}`; teacher | Restored student remains locked until explicitly unlocked |

Each new student joins locked and requires teacher admission with the unlock action before moving or editing. Student labels are assigned numbers only. Player records contain `{id,number,locked,removed,x,y,z,yaw}`; no bearer tokens, account identities, or personal names are exposed. Polling is available to locked students so the client can explain the pause. Removed tokens are denied; restoring preserves that student's token until its original expiry. A code is a classroom invitation, not verified identity. Removing a student rotates the invitation code. Any fresh join still waits for teacher admission; a code does not establish who is using the device. This prototype has no roster/login identity layer. Close the room to stop new joins. Removed students continue to count against the room limit so numbers are not reused or unlimited sessions created.

## Shared world and limits

`world: "resource-v1"` uses the checked-in `game/hardcore-world.js` generator, shared once in server memory, plus the same deep rock/ore rule as the client. `mode: "creative"` has unlimited approved materials. The authoritative room data stores only delta edits keyed `"x,y,z"`, with a material ID or null value. The allowlist is the 28 material IDs exported by the service. Bounds are x=-96..128, y=-39..60, z=-96..96; the bottom layer at -40 cannot be changed.

Edits require an open room, an unremoved/unlocked student, valid integer coordinates, an approved material, a target within eight blocks of the latest accepted avatar position, and an empty target for placement. A player cannot place a block through another player's body. Removal requires a block to exist. Positions are finite, in bounds, with yaw between -8π and 8π. Movement allows 18 blocks/second plus a two-block allowance, with at most two seconds of accumulated movement credit; arbitrary distant teleports are rejected. Movement is an anti-teleport bound, not a full server physics simulation. The client should send its initial position then at most five movement updates per second, poll at about once per second, and render the server's accepted position after a rejected move.

Defaults: 16 rooms, 40 students per room, 20,000 edited cells per room, 500 recent moderation/teacher events, 1,000 active tokens, 2 KB request bodies, 64 concurrent requests, eight-hour tokens and twelve-hour room expiry. Each student may submit at most 180 edits, 300 moves and 120 polls per minute; overall token traffic is capped at 600/minute. Teacher sign-in is limited to ten attempts per source address per ten minutes. Classroom joining allows 120 attempts/minute per address. Forwarded-IP headers are not trusted. Room mutations are serialized, so closing or locking cannot race a queued edit. Limits are memory and traffic bounds, not a guarantee against a determined denial-of-service attack.

The shared source-address allowance is `min(30000, max(3000, players * 600 + 1200))` requests/minute: 25,200 with the default 40-player capacity. This accommodates one full classroom behind a school NAT while preserving every per-token and per-action limit. It is not a capacity promise for multiple simultaneous classrooms behind one address. The loopback HTTP regression exercises ten same-address students sending four moves/second and a poll every 750 milliseconds for a simulated minute, then verifies that excessive polling by one student is still rejected.

The client must keep room tokens and shared edits outside personal campus/Hardcore saves. Do not merge room edits into local saves, load personal backups into the room, or use existing personal-world import/export/reset controls in a room session. The browser should apply an edit only after server acceptance or roll back optimistic edits on error. All clients must use the matching resource generator version. The bundled game/room-client.js and game/rooms.html provide the matching client integration.

## Optional moderation hook

Import `createRoomService({password, allowedOrigins, moderationHook})` from `room-service.mjs`. The optional server-side hook receives `{roomId,studentId,sequence,edit,edits,getBlock}` after an accepted edit. `edits` is a copied Map and `getBlock(x,y,z)` reads the authoritative world. Returning `{lock:true}` locks that student and records `moderation_review`. Errors or a two-second timeout lock the student with `moderation_unavailable`; a teacher can inspect and unlock. The accepted block remains visible for review. The hook is never sent to clients, and no external provider is called by this service. Configuring a hook does not establish OCR or reliable inappropriate-build detection.

Teacher actions and moderation events have fixed type codes and timestamps only. These recent in-memory events are for classroom review, not a durable audit/compliance record. No export, persistence, hosting, student accounts, or notification system is included.
