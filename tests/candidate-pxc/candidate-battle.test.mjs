import assert from 'node:assert/strict'; import test from 'node:test';
import { CANDIDATE_BATTLE_COMPOSITION, runCandidateBattle, clearCandidateBattleCache, materializeBattleState, assertPqlCorrespondence } from '../../source/candidate-pxc/index.js';

test('candidate PQL resolves immutable shelf and snapshot into semantic overlay model', () => {
 const shelf = [{ id:'a', mold:'A' }, { id:'b', mold:'B' }];
 const snapshot = { id:'state-7', entries:[{ id:'entry-a', discId:'a', score:9 },{ id:'entry-b', discId:'b', score:7 }], highlightedEntryId:'entry-a', winnerEntryIds:['entry-a'], imageExport:null };
 const { pxc, run } = runCandidateBattle({ shelf, snapshot }, { queryId:'q-7', sourceId:'src-yaml', executionId:'x-3' });
 assert.deepEqual(CANDIDATE_BATTLE_COMPOSITION.Ticks.map(t=>t.name), ['ResolveSnapshot','RenderOverlay','MaterializeOverlay']); assertPqlCorrespondence(CANDIDATE_BATTLE_COMPOSITION, run);
 assert.equal(pxc.get('px.candidate.battle.part.overlay').kind, 'semantic-battle-overlay'); assert.equal(pxc.get('px.candidate.battle.part.materialized').identity.snapshotId, 'state-7');
 const testimony = run.Ticks[1].Calculations[0].testimony; assert.deepEqual(testimony.declaredConsumes, testimony.actualConsumes); assert.deepEqual(testimony.declaredProduces, testimony.actualProduces); assert.equal(shelf[0].mold, 'A'); assert.equal(snapshot.entries[0].discId, 'a');
 const state = materializeBattleState({ run, pxc }); assert.deepEqual(state.identity,{queryId:'q-7',sourceId:'src-yaml',executionId:'x-3'}); assert.equal(state.outputs.materialized.svg, undefined);
});

test('PQL result identity is independent of view style args', () => {
 const input = { shelf:[{id:'a',mold:'A'}], snapshot:{id:'s',entries:[{id:'e',discId:'a',score:1}],highlightedEntryId:null,winnerEntryIds:[],imageExport:null} };
 const a = runCandidateBattle(input,{queryId:'q',sourceId:'src',executionId:'x'}).run; const b = runCandidateBattle(input,{queryId:'q',sourceId:'src',executionId:'x'}).run;
 assert.deepEqual([a.queryId,a.sourceId,a.executionId],[b.queryId,b.sourceId,b.executionId]);
});

test('computed semantic Parts are reused for unchanged input and invalidated by shelf or snapshot changes', () => {
 clearCandidateBattleCache();
 const shelf = [{ id:'a', manufacturer:'M', mold:'A' }];
 const snapshot = { id:'s', entries:[{ id:'e', discId:'a', score:1 }], highlightedEntryId:null, winnerEntryIds:[], imageExport:null };
 const first = runCandidateBattle({ shelf, snapshot });
 const second = runCandidateBattle({ shelf, snapshot });
 assert.equal(first.cache.hit, false); assert.equal(second.cache.hit, true);
 assert.equal(first.pxc, second.pxc); assert.equal(second.run.telemetry.eventCount, first.run.telemetry.eventCount);
 const exportOnly = runCandidateBattle({ shelf, snapshot: { ...snapshot, imageExport:'data:image/png;base64,AA==' } });
 assert.equal(exportOnly.cache.hit, true);
 const changedSnapshot = runCandidateBattle({ shelf, snapshot: { ...snapshot, entries:[{ ...snapshot.entries[0], score:2 }] } });
 assert.equal(changedSnapshot.cache.hit, false); assert.equal(changedSnapshot.cache.invalidated.snapshot, true); assert.equal(changedSnapshot.cache.invalidated.shelf, false);
 const changedShelf = runCandidateBattle({ shelf: [{ ...shelf[0], mold:'A2' }], snapshot });
 assert.equal(changedShelf.cache.hit, false); assert.equal(changedShelf.cache.invalidated.shelf, true);
});
