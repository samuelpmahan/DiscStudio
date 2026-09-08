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
