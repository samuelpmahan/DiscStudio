import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDiscToBag,
  bagContains,
  createBag,
  missingDiscIds,
  parseBagState,
  removeDiscFromBag,
  serializeBagState,
  createBattleSnapshot,
  duplicateBattleSnapshot,
  updateBattleSnapshot,
  reorderBattleSnapshots,
  validateBattleSnapshotState,
  toggleDiscMembership,
  validateBagState
} from '../../source/candidate-bags/model.ts';

const shelf = [
  { id: 'disc-1', manufacturer: 'Discraft', mold: 'Buzzz' },
  { id: 'disc-2', manufacturer: 'Innova', mold: 'Roc' }
];

test('creates stable bag identity and validates a clean immutable snapshot', () => {
  const bag = createBag('bag-sat', 'Saturday round', ['disc-1']);
  assert.deepEqual(bag, { id: 'bag-sat', name: 'Saturday round', discIds: ['disc-1'] });
  const state = validateBagState({ version: 1, bags: [bag] }, shelf);
  assert.notEqual(state.bags[0], bag);
  assert.notEqual(state.bags[0].discIds, bag.discIds);
});

test('allows one physical disc in multiple bags without cloning the disc', () => {
  const state = validateBagState({ version: 1, bags: [
    { id: 'bag-a', name: 'Putting', discIds: [] },
    { id: 'bag-b', name: 'Saturday', discIds: [] }
  ] }, shelf);
  const withA = addDiscToBag(state, 'bag-a', 'disc-1', shelf);
  const withBoth = addDiscToBag(withA, 'bag-b', 'disc-1', shelf);
  assert.deepEqual(withBoth.bags.map((bag) => bag.discIds), [['disc-1'], ['disc-1']]);
  assert.deepEqual(shelf, [
    { id: 'disc-1', manufacturer: 'Discraft', mold: 'Buzzz' },
    { id: 'disc-2', manufacturer: 'Innova', mold: 'Roc' }
  ]);
  assert.equal(bagContains(withBoth.bags[0], 'disc-1'), true);
  assert.equal(bagContains(withBoth.bags[1], 'disc-1'), true);
});

test('membership add/remove is immutable and remove only affects the chosen bag', () => {
  const shelfArray = shelf;
  const physicalDiscOne = shelf[0];
  const state = validateBagState({ version: 1, bags: [
    { id: 'bag-a', name: 'A', discIds: ['disc-1'] },
    { id: 'bag-b', name: 'B', discIds: ['disc-1', 'disc-2'] }
  ] }, shelf);
  const added = toggleDiscMembership(state, 'bag-a', 'disc-2', true, shelf);
  const removed = removeDiscFromBag(added, 'bag-a', 'disc-1', shelf);
  assert.strictEqual(shelf, shelfArray);
  assert.strictEqual(shelf[0], physicalDiscOne);
  assert.deepEqual(state.bags[0].discIds, ['disc-1']);
  assert.deepEqual(added.bags[0].discIds, ['disc-1', 'disc-2']);
  assert.deepEqual(removed.bags[0].discIds, ['disc-2']);
  assert.deepEqual(removed.bags[1].discIds, ['disc-1', 'disc-2']);
});

test('rejects duplicate physical Disc IDs in the supplied shelf', () => {
  const duplicateShelf = [shelf[0], { ...shelf[1], id: shelf[0].id }];
  assert.throws(
    () => validateBagState({ version: 1, bags: [{ id: 'bag-a', name: 'A', discIds: [] }] }, duplicateShelf),
    /shelf contains duplicate disc identifier disc-1/
  );
});

test('missing shelf references fail validation and remain visible through diagnostics', () => {
  const raw = { version: 1, bags: [{ id: 'bag-a', name: 'A', discIds: ['missing-disc'] }] };
  assert.throws(() => validateBagState(raw, shelf), /references missing disc missing-disc/);
  const bag = { id: 'bag-a', name: 'A', discIds: ['missing-disc'] };
  assert.deepEqual(missingDiscIds(bag, shelf), ['missing-disc']);
  assert.throws(() => addDiscToBag(validateBagState({ version: 1, bags: [{ id: 'bag-a', name: 'A', discIds: [] }] }, shelf), 'bag-a', 'missing-disc', shelf), /was not found on the shelf/);
});

test('serializes and parses clean bag state with cloned memberships', () => {
  const state = validateBagState({ version: 1, bags: [{ id: 'bag-a', name: 'A', discIds: ['disc-2'] }] }, shelf);
  const parsed = parseBagState(serializeBagState(state, shelf), shelf);
  assert.deepEqual(parsed, state);
  assert.notEqual(parsed.bags, state.bags);
  assert.notEqual(parsed.bags[0].discIds, state.bags[0].discIds);
});

test('rejects duplicate bag IDs and duplicate memberships', () => {
  assert.throws(() => validateBagState({ version: 1, bags: [
    { id: 'bag-a', name: 'A', discIds: [] }, { id: 'bag-a', name: 'B', discIds: [] }
  ] }, shelf), /duplicate bag identifier/);
  assert.throws(() => validateBagState({ version: 1, bags: [
    { id: 'bag-a', name: 'A', discIds: ['disc-1', 'disc-1'] }
  ] }, shelf), /duplicate disc membership/);
});

test('battle snapshots are complete immutable ordered states with physical disc references', () => {
  const first = createBattleSnapshot('state-1', [
    { id: 'entry-1', discId: 'disc-1', score: 8 },
    { id: 'entry-2', discId: 'disc-2', score: 6 }
  ], 'data:image/png;base64,AA==');
  const authored = updateBattleSnapshot({ version: 1, snapshots: [first] }, 'state-1', {
    highlightedEntryId: 'entry-1', winnerEntryIds: ['entry-1']
  });
  const copied = duplicateBattleSnapshot(authored, 'state-1', 'state-2');
  const edited = updateBattleSnapshot(copied, 'state-2', { entries: [{ id: 'entry-2', discId: 'disc-2', score: 10 }, { id: 'entry-1', discId: 'disc-1', score: 8 }] });
  assert.deepEqual(authored.snapshots[0].entries.map((entry) => entry.score), [8, 6]);
  assert.deepEqual(edited.snapshots[1].entries.map((entry) => entry.discId), ['disc-2', 'disc-1']);
  assert.equal(edited.snapshots[0].imageExport, 'data:image/png;base64,AA==');
  assert.deepEqual(reorderBattleSnapshots(edited, 'state-2', -1).snapshots.map((snapshot) => snapshot.id), ['state-2', 'state-1']);
  assert.throws(() => validateBattleSnapshotState({ version: 1, snapshots: [{ ...first, highlightedEntryId: 'missing' }] }, shelf), /highlight references/);
});

test('authoring edits fork a new full snapshot and entry reorder preserves the prior state', async () => {
  const { forkBattleSnapshot, reorderBattleSnapshotEntries } = await import('../../source/candidate-bags/model.ts');
  const first = createBattleSnapshot('state-1', [
    { id: 'entry-1', discId: 'disc-1', score: 8 },
    { id: 'entry-2', discId: 'disc-2', score: 6 }
  ]);
  const base = { version: 1, snapshots: [first] };
  const edited = forkBattleSnapshot(base, 'state-1', 'state-2', { highlightedEntryId: 'entry-2', winnerEntryIds: ['entry-2'], entries: [{ ...first.entries[0], score: 9 }, { ...first.entries[1] }] }, shelf);
  assert.equal(edited.snapshots.length, 2);
  assert.equal(base.snapshots[0].entries[0].score, 8);
  assert.equal(base.snapshots[0].highlightedEntryId, null);
  const reordered = reorderBattleSnapshotEntries(edited, 'state-2', 'entry-2', -1, shelf);
  assert.deepEqual(edited.snapshots[1].entries.map((entry) => entry.id), ['entry-1', 'entry-2']);
  assert.deepEqual(reordered.snapshots[2].entries.map((entry) => entry.id), ['entry-2', 'entry-1']);
  assert.deepEqual(reordered.snapshots[1].entries.map((entry) => entry.id), ['entry-1', 'entry-2']);
});
