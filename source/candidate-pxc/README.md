# Candidate PxC/PQL integration

DiscStudio uses the browser-safe `board.ts` and `pql.ts` runtime from ChainSpot ref `origin/task/quick-anno-s1-materialization` at `82f8fc94afd4fa277837e2b4725d7c6e100b1b20`. The vendored ESM transcription is in `chainspot/exec.js`; it removes TypeScript annotations only and uses the same `yaml@2.9.0` parser dependency. DiscStudio does not implement a second PQL parser or scheduler.

`runCandidateBattle` seeds immutable shelf and complete snapshot Parts, registers its three domain calculations, then invokes the vendored ChainSpot PQL executor. Its PxC adapter records actual `get`, `call`, and `set` events, which become calculation telemetry and are checked by `assertPqlCorrespondence`.

The bounded one-entry cache is keyed by the complete shelf and semantic snapshot Parts (PNG export evidence is excluded). A hit reuses the original frozen `resolved`, `overlay`, and `materialized` Parts and makes no new calculation calls. Any shelf or semantic snapshot change invalidates the whole semantic run. View Args are deliberately absent from the key: they project `materialized` to SVG only, so a styling change never reruns semantic calculations.

`MaterializeOverlay` produces `battle-render-input`: resolved disc facts, ordered entries, scores, highlight, and winners. `renderBattleSnapshotScene` consumes that exact Part before applying View Args and exporting a PNG. The Part contains no SVG or export claim; SVG and PNG are presentation artifacts outside PQL.
