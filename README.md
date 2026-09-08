# DiscStudio

A static comparison site that preserves two Disc Studio explorations:

- **Concept A** is the original vanilla Creator workbench source in `public/concept-a/`.
- **Concept B** is rebuilt from its Svelte entry in `source/concept-b/` and components in `source/disc-studio/`.
- **Merged candidate** is a provisional `/candidate/` route that combines Concept B's shelf and facts with Concept A's compact transparent graphic export.

## Source provenance

- **Concept A:** ChainSpot branch `task/creator-v0-disc-card-battle`, commit `f0820e0211be23ca9bcf19bb82a57d81d007cec4`.
- **Concept B:** branch `task/disc-studio-v00`, commit `1bc41b2f05703874a967297ac78639b63ca34138`.

## Run locally

```sh
npm ci
npm run build
npm run smoke
npm run preview
```

If the Vite preview command is unavailable in a constrained environment, serve the production artifact directly:

```sh
python3 -m http.server 4173 --directory dist
```

Open `/`, `/concept-a/`, `/concept-b/`, or `/candidate/`. The artifact smoke check verifies that the built routing files exist and that the root chooser links to both concepts and the candidate.

The candidate stores its workspace, Bags, design preferences, navigation, and checklist state under separate candidate-specific browser keys. DiscShelf/MyBag is the first page; On the Course defaults to Single Disc and can switch to Disc Battle. The course page exports transparent PNG graphics through Concept A's renderer.

The two-page domain contract and remaining boundaries are documented in `docs/candidate-mybag-handoff.md`.

## GitHub Pages

The deployment workflow publishes `dist` after `npm ci` and `npm run smoke`. The resulting Pages paths are `/DiscStudio/`, `/DiscStudio/concept-a/`, and `/DiscStudio/concept-b/` when the repository is hosted at `samuelpmahan/DiscStudio`.

Both concepts include the same collapsed Tick/Part checklist from `public/shared/tick-part-checklist.js`. Provide `data-checklist` and a unique `storage-key` on the custom element so future integrations can configure its rows without coupling their saved review state.
