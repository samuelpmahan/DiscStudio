import { deepFreeze } from './board.js';
/** Deterministic PCR projection. The renderer consumes `outputs.materialized`, while View Args stay outside PQL. */
export function materializeBattleState({ run, pxc, image = null }) {
  const state = {
    schema: 'candidate-pxc/battle-state@2',
    identity: { queryId: run.queryId, sourceId: run.sourceId, executionId: run.executionId },
    ticks: run.Ticks.map((tick) => ({ name: tick.name, calculations: tick.Calculations.map((calculation) => ({ call: calculation.actualCall, testimony: calculation.testimony })) })),
    outputs: { materialized: pxc.has('px.candidate.battle.part.materialized') ? pxc.get('px.candidate.battle.part.materialized') : undefined },
    image: image ? { kind: 'supplied-export-reference', id: image.id, width: image.width, height: image.height } : null
  };
  return deepFreeze(state);
}
export function exportBattleState(state) { return JSON.stringify(state); }
