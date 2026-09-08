import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BADGE_ASSEMBLY_COMPOSITION,
  CANDIDATE_BATTLE_COMPOSITION,
  createPxC,
  invokePql,
  assertPqlCorrespondence,
  runCandidateBattle
} from '../../source/candidate-pxc/index.js';

test('calculation telemetry reports each actual invocation in declaration order', () => {
  const board = createPxC({ seed: { value: 4 } });
  const calls = [];
  board.register({ address: 'fn.add' }, ({ input, amount }) => ({ value: input.value + amount }));
  board.register({ address: 'fn.double' }, ({ input }) => ({ value: input.value * 2 }));
  const composition = {
    PrincipleComponentRender: 'telemetry',
    Ticks: [{ name: 'Compute', Calculations: [
      { call: 'fn.add', with: { input: 'seed' }, args: { amount: 3 }, into: 'added' },
      { call: 'fn.double', with: { input: 'added' }, args: {}, into: 'result' }
    ] }]
  };
  const run = invokePql(composition, { pxc: board, onCalculation: event => calls.push(event) });
  assert.deepEqual(calls.map(({ tick, calculation }) => [tick, calculation.actualCall]), [
    ['Compute', 'fn.add'], ['Compute', 'fn.double']
  ]);
  assert.equal(calls[0].calculation.inputs.input.value, 4);
  assert.deepEqual(calls[0].calculation.testimony, {
    calculationIndex: 0,
    declaredConsumes: ['seed'],
    actualConsumes: ['seed'],
    declaredProduces: ['added'],
    actualProduces: ['added'],
    writes: [{ address: 'added', kind: 'new-address' }],
    calls: ['fn.add'],
    existenceChecks: []
  });
  assert.equal(run.Ticks[0].Calculations[1].output.value, 14);
});

test('a rewritten computed Part is observed by later consumers and isolated across forks', () => {
  const board = createPxC({ source: 2 });
  board.register({ address: 'fn.mul' }, ({ value, factor }) => value * factor);
  board.set('computed', board.call({ address: 'fn.mul' }, { value: board.get('source'), factor: 2 }));
  const fork = board.fork();
  board.set('computed', board.call({ address: 'fn.mul' }, { value: board.get('computed'), factor: 3 }));
  assert.equal(board.get('computed'), 12);
  assert.equal(fork.get('computed'), 4);
  assert.notEqual(board.get('computed'), fork.get('computed'));
});

test('parse-only S1 declaration has provenance without claiming browser execution', () => {
  assert.equal(BADGE_ASSEMBLY_COMPOSITION.PrincipleComponentRender, 'S1');
  const board = createPxC({ 'px.s1.exp.maskComponents.part.croppedRaster': { width: 1, height: 1 } });
  assert.throws(
    () => invokePql(BADGE_ASSEMBLY_COMPOSITION, { pxc: board, queryId: 'S1' }),
    /calculation 'fn\.s1\.exp\.maskComponents\.selectHsvMask' is not registered/
  );
});

test('candidate browser integration emits correspondence testimony for every registered calculation', () => {
  const { run } = runCandidateBattle({
    shelf: [{ id: 'disc-a', mold: 'A' }],
    snapshot: { id: 'snapshot-1', entries: [{ id: 'entry-a', discId: 'disc-a', score: 2 }], winnerEntryIds: [], imageExport: null }
  }, { queryId: 'candidate-browser', sourceId: 'candidate-source', executionId: 'candidate-execution' });
  assert.equal(assertPqlCorrespondence(CANDIDATE_BATTLE_COMPOSITION, run), true);
  const declaredCalls = CANDIDATE_BATTLE_COMPOSITION.Ticks.flatMap(tick => tick.Calculations.map(calculation => calculation.call));
  const actualCalls = run.Ticks.flatMap(tick => tick.Calculations.map(calculation => calculation.testimony.calls[0]));
  assert.deepEqual(actualCalls, declaredCalls);
  assert.deepEqual([run.queryId, run.sourceId, run.executionId], ['candidate-browser', 'candidate-source', 'candidate-execution']);
});
