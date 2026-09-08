import { createPxC, deepFreeze } from './board.js';
import { readPql, invokePql } from './pql.js';

export const CANDIDATE_BATTLE_PQL = `PrincipleComponentRender: candidate-battle
Ticks:
  - name: ResolveSnapshot
    Calculations:
      - call: fn.candidate.battle.resolveEntries
        with:
          shelf: px.candidate.battle.part.shelf
          snapshot: px.candidate.battle.part.snapshot
        args: {}
        into: px.candidate.battle.part.resolved
  - name: RenderOverlay
    Calculations:
      - call: fn.candidate.battle.renderOverlay
        with:
          resolved: px.candidate.battle.part.resolved
        args: {}
        into: px.candidate.battle.part.overlay
  - name: MaterializeOverlay
    Calculations:
      - call: fn.candidate.battle.materializeOverlay
        with:
          snapshot: px.candidate.battle.part.snapshot
          overlay: px.candidate.battle.part.overlay
        args: {}
        into: px.candidate.battle.part.materialized
`;
export const CANDIDATE_BATTLE_COMPOSITION = readPql(CANDIDATE_BATTLE_PQL);
let cached = null;
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function copyShelf(shelf) { return shelf.map((disc) => ({ ...disc, flight: disc.flight ? { ...disc.flight } : disc.flight, image: disc.image ? { ...disc.image } : disc.image })); }
/** PNG export evidence is presentation state, so it is intentionally excluded from semantic input/cache. */
function copySnapshot(snapshot) { return { id: snapshot.id, entries: snapshot.entries.map((entry) => ({ id: entry.id, discId: entry.discId, score: entry.score })), highlightedEntryId: snapshot.highlightedEntryId ?? null, winnerEntryIds: [...(snapshot.winnerEntryIds ?? [])] }; }
function cacheResult(entry, hit) { return { pxc: entry.pxc, run: entry.run, cache: Object.freeze({ hit, key: entry.key, invalidated: entry.invalidated, computedParts: hit ? [] : ['resolved', 'overlay', 'materialized'], reusedParts: hit ? ['resolved', 'overlay', 'materialized'] : [] }) }; }
/** Clear retained computed Parts. Useful when the candidate workspace is discarded. */
export function clearCandidateBattleCache() { cached = null; }
/**
 * Execute DiscStudio battle semantics through ChainSpot's PxC/PQL core.
 * The cache key deliberately excludes View Args: changing presentation reprojects frozen Parts without semantic work.
 */
export function runCandidateBattle({ shelf, snapshot }, options = {}) {
  const shelfKey = stable(shelf), semanticSnapshot = copySnapshot(snapshot), snapshotKey = stable(semanticSnapshot), key = `${shelfKey}|${snapshotKey}`;
  if (cached?.key === key) return cacheResult(cached, true);
  const invalidated = Object.freeze({ shelf: !cached || cached.shelfKey !== shelfKey, snapshot: !cached || cached.snapshotKey !== snapshotKey });
  const immutableShelf = deepFreeze(copyShelf(shelf));
  const immutableSnapshot = deepFreeze(semanticSnapshot);
  const pxc = createPxC({ 'px.candidate.battle.part.shelf': immutableShelf, 'px.candidate.battle.part.snapshot': immutableSnapshot });
  pxc.register({ address: 'fn.candidate.battle.resolveEntries' }, ({ shelf: discs, snapshot: state }) => ({
    id: state.id,
    entries: state.entries.map((entry) => {
      const disc = discs.find((candidate) => candidate.id === entry.discId);
      return { ...entry, disc: disc ? { id: disc.id, manufacturer: disc.manufacturer, mold: disc.mold, variant: disc.variant ?? null, flight: disc.flight ?? null, image: disc.image ?? null } : null };
    }),
    highlightedEntryId: state.highlightedEntryId,
    winnerEntryIds: [...state.winnerEntryIds]
  }));
  pxc.register({ address: 'fn.candidate.battle.renderOverlay' }, ({ resolved }) => ({
    kind: 'semantic-battle-overlay', snapshotId: resolved.id, entries: resolved.entries,
    highlightedEntryId: resolved.highlightedEntryId, winnerEntryIds: resolved.winnerEntryIds
  }));
  pxc.register({ address: 'fn.candidate.battle.materializeOverlay' }, ({ snapshot: state, overlay }) => ({
    kind: 'battle-render-input', snapshotId: state.id, identity: { snapshotId: state.id },
    entries: overlay.entries.map((entry) => ({ id: entry.id, discId: entry.discId, score: entry.score, disc: entry.disc })),
    battleVisual: { highlightedEntryId: overlay.highlightedEntryId, emphasizedEntryIds: [...overlay.winnerEntryIds] }
  }));
  const run = invokePql(CANDIDATE_BATTLE_COMPOSITION, { pxc, queryId: options.queryId ?? `candidate-battle:${snapshot.id}`, sourceId: options.sourceId ?? 'candidate-battle-yaml', executionId: options.executionId ?? key });
  cached = { key, shelfKey, snapshotKey, pxc, run, invalidated };
  return cacheResult(cached, false);
}
