import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptDisc, pngFromCandidateScene, renderCandidateScene } from '../../source/candidate-adapter/renderer.js';

const imageSrc = 'data:image/png;base64,AAAA';

function workspace(overrides = {}) {
  const discs = [
    {
      id: 'disc-a', manufacturer: 'Discraft', mold: 'Buzzz', variant: 'Mint practice',
      flight: { speed: 5, glide: null, turn: -1, fade: 1 }, image: { src: imageSrc, alt: 'A Buzzz' }
    },
    {
      id: 'disc-b', manufacturer: 'Innova', mold: 'Roc', variant: 'Fractional test',
      flight: { speed: 4.5, glide: 3, turn: null, fade: 0 }, image: null
    }
  ];
  return {
    version: 1,
    discs,
    battle: {
      id: 'battle-1', title: 'Fixture battle',
      entries: [{ id: 'entry-a', discId: 'disc-a', score: -1.25 }, { id: 'entry-b', discId: 'disc-b', score: 2.5 }]
    },
    cardAppearance: { layout: 'showcase', hierarchy: 'name', theme: 'ink', imageFit: 'contain', showVariant: true },
    battleAppearance: { layout: 'row', showScores: true },
    battleVisual: { highlightedEntryId: 'entry-b', emphasizedEntryIds: ['entry-a', 'entry-b'] },
    ...overrides
  };
}

test('maps B disc facts, variant, embedded photo, and null flights at the A boundary', () => {
  const disc = adaptDisc(workspace().discs[0]);
  assert.equal(disc.facts.manufacturer, 'Discraft');
  assert.equal(disc.facts.mold, 'Buzzz');
  assert.deepEqual(disc.facts.flight, [5, '—', -1, 1]);
  assert.equal(disc.label, 'Mint practice');
  assert.deepEqual(disc.photo, { kind: 'upload', dataUrl: imageSrc, fileName: 'candidate-image', width: 1, height: 1 });
});

test('renders negative and fractional scores exactly after stringifying at A call boundary', () => {
  const result = renderCandidateScene(workspace());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.svg, />-1\.25<\/text>/);
  assert.match(result.svg, />2\.5<\/text>/);
  assert.match(result.svg, /SCORE/);
});

test('renders null flight values as visible em dashes and maps image.src to SVG image href', () => {
  const result = renderCandidateScene(workspace());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.svg, /href="data:image\/png;base64,AAAA"/);
  assert.match(result.svg, />—<\/text>/);
  assert.doesNotMatch(result.svg, />null<\/text>/);
});

test('marks every emphasized entry independently and preserves authored highlight state', () => {
  const result = renderCandidateScene(workspace());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal((result.svg.match(/aria-label="Manually marked winner"/g) ?? []).length, 2);
  assert.match(result.svg, /stroke="#c9ef82" stroke-width="4"/);
  const withoutHighlight = renderCandidateScene(workspace({
    battleVisual: { highlightedEntryId: null, emphasizedEntryIds: ['entry-a', 'entry-b'] }
  }));
  assert.equal(withoutHighlight.ok, true);
  if (withoutHighlight.ok) assert.doesNotMatch(withoutHighlight.svg, /stroke="#c9ef82" stroke-width="4"/);
  // A highlight is a visual authored state; editor selection is absent from
  // the adapter input and cannot alter exported markup.
  const selected = renderCandidateScene({ ...workspace(), selectedEntryId: 'entry-a' });
  assert.deepEqual(selected, result);
});

test('returns a typed unsupported result for grid instead of choosing row or stack', () => {
  const result = renderCandidateScene(workspace({ battleAppearance: { layout: 'grid', showScores: true } }));
  assert.deepEqual(result, {
    ok: false,
    kind: 'unsupported',
    code: 'UNSUPPORTED_GRID',
    message: 'Concept A export cannot faithfully represent Concept B grid layout.'
  });
});

test('uses an explicit export view layout for a grid workspace without mutating B state', () => {
  const source = workspace({ battleAppearance: { layout: 'grid', showScores: true } });
  const before = structuredClone(source);
  const result = renderCandidateScene(source, { layout: 'stack' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.cardCount, 2);
    assert.match(result.svg, /translate\(0 190\)/);
  }
  assert.deepEqual(source, before);
});

test('returns a typed unsupported result for imageFit=cover', () => {
  const result = renderCandidateScene(workspace({ cardAppearance: { ...workspace().cardAppearance, imageFit: 'cover' } }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'UNSUPPORTED_IMAGE_FIT');
});

test('returns a typed unsupported result when B hides scores', () => {
  const result = renderCandidateScene(workspace({ battleAppearance: { layout: 'row', showScores: false } }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'UNSUPPORTED_HIDDEN_SCORES');
});

test('rejects missing disc references and invalid visual entry IDs', () => {
  const missingDisc = renderCandidateScene(workspace({
    battle: { ...workspace().battle, entries: [{ id: 'entry-a', discId: 'gone', score: 1 }] }
  }));
  assert.equal(missingDisc.ok, false);
  if (!missingDisc.ok) assert.match(missingDisc.message, /missing disc/);

  const missingVisual = renderCandidateScene(workspace({
    battleVisual: { highlightedEntryId: 'gone', emphasizedEntryIds: ['entry-a'] }
  }));
  assert.equal(missingVisual.ok, false);
  if (!missingVisual.ok) assert.match(missingVisual.message, /visual state/);
});

test('rejects duplicate or empty disc IDs before constructing the lookup map', () => {
  const duplicate = workspace({ discs: [workspace().discs[0], { ...workspace().discs[1], id: 'disc-a' }] });
  const duplicateResult = renderCandidateScene(duplicate);
  assert.equal(duplicateResult.ok, false);
  if (!duplicateResult.ok) assert.equal(duplicateResult.code, 'INVALID_INPUT');

  const empty = workspace({ discs: [{ ...workspace().discs[0], id: '  ' }, workspace().discs[1]] });
  const emptyResult = renderCandidateScene(empty);
  assert.equal(emptyResult.ok, false);
  if (!emptyResult.ok) assert.equal(emptyResult.code, 'INVALID_INPUT');
});

test('rejects malformed embedded image URLs as typed invalid input', () => {
  const result = renderCandidateScene(workspace({
    discs: [{ ...workspace().discs[0], image: { src: 'https://example.test/disc.png', alt: 'external' } }, workspace().discs[1]]
  }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'INVALID_INPUT');
    assert.match(result.message, /embedded PNG, JPEG or WebP/);
  }
});

test('converts malformed flight facts into typed invalid input', () => {
  const result = renderCandidateScene(workspace({
    discs: [{ ...workspace().discs[0], flight: { speed: Infinity, glide: 4, turn: -1, fade: 1 } }, workspace().discs[1]]
  }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'INVALID_INPUT');
});

test('rejects non-finite B scores at the adapter boundary', () => {
  const result = renderCandidateScene(workspace({
    battle: { ...workspace().battle, entries: [{ id: 'entry-a', discId: 'disc-a', score: Number.NaN }] }
  }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'INVALID_INPUT');
});

test('PNG bridge rejects unsupported scenes without silently remapping', async () => {
  const result = renderCandidateScene(workspace({ battleAppearance: { layout: 'grid', showScores: true } }));
  await assert.rejects(pngFromCandidateScene(result), /cannot faithfully represent.*grid layout/);
});

test('renders a disc whose complete flight object is unknown as em dashes', () => {
  const source = workspace({ discs: [{ ...workspace().discs[0], flight: undefined }, workspace().discs[1]] });
  const result = renderCandidateScene(source, { layout: 'row' });
  assert.equal(result.ok, true);
  assert.match(result.svg, /—/);
});
