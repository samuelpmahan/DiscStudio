import { invokePql as invokeChainSpotPql, readPql } from './chainspot/exec.js';
export { readPql };
/**
 * Executes the original ChainSpot PQL runner and attaches DiscStudio run identity
 * plus event telemetry captured at the actual PxC call boundary.
 */
export function invokePql(composition, { pxc, onCalculation, queryId = composition.PrincipleComponentRender, sourceId = composition.PrincipleComponentRender, executionId = 'exec-1' } = {}) {
  const mark = pxc.telemetryMark?.() ?? 0;
  let rawRun;
  try { rawRun = invokeChainSpotPql(composition, { pxc }); }
  catch (error) { throw new Error(`${error.message}${error.cause?.message ? `: ${error.cause.message}` : ''}`, { cause: error }); }
  const events = pxc.telemetrySince?.(mark) ?? [];
  let calculationIndex = 0, cursor = 0;
  const ticks = rawRun.Ticks.map((tick) => ({ name: tick.name, Calculations: tick.Calculations.map((calculation) => {
    const expectedGets = Object.values(calculation.with); const slice = events.slice(cursor, cursor + expectedGets.length + 2); cursor += expectedGets.length + 2;
    const calls = slice.filter((event) => event.kind === 'call').map((event) => event.address);
    const produced = slice.filter((event) => event.kind === 'set').map((event) => event.address);
    const actualConsumes = slice.filter((event) => event.kind === 'get').map((event) => event.address);
    const testimony = { calculationIndex: calculationIndex++, declaredConsumes: expectedGets, actualConsumes, declaredProduces: [calculation.into], actualProduces: produced, writes: slice.filter((event) => event.kind === 'set').map((event) => ({ address: event.address, kind: event.write })), calls, existenceChecks: [] };
    const record = { ...calculation, testimony }; onCalculation?.({ tick: tick.name, calculation: record }); return record;
  }) }));
  return Object.freeze({ ...rawRun, queryId, sourceId, executionId, Ticks: ticks, telemetry: Object.freeze({ eventCount: events.length, events: Object.freeze(events) }) });
}
export function assertPqlCorrespondence(composition, run) {
  if (composition.Ticks.length !== run.Ticks.length) throw new Error('PQL/PCR testimony tick count mismatch.');
  let index = 0;
  composition.Ticks.forEach((tick, ti) => {
    const runtime = run.Ticks[ti]; if (runtime.name !== tick.name || runtime.Calculations.length !== tick.Calculations.length) throw new Error(`PQL/PCR testimony mismatch at tick '${tick.name}'.`);
    tick.Calculations.forEach((declared, ci) => { const actual = runtime.Calculations[ci]; if (actual.call !== declared.call || actual.actualCall !== declared.call || actual.into !== declared.into || actual.testimony.calculationIndex !== index++ || actual.testimony.calls.join('|') !== declared.call || actual.testimony.actualConsumes.join('|') !== Object.values(declared.with).join('|') || actual.testimony.actualProduces.join('|') !== declared.into) throw new Error(`PQL/PCR testimony mismatch at ${tick.name}[${ci}].`); });
  });
  return true;
}
