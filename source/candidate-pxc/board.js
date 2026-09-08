/** DiscStudio immutable-Part adapter around the vendored ChainSpot PxC core. */
import { createExecBoard, pxFn, pxKey, trackAccess as chainSpotTrackAccess } from './chainspot/exec.js';
export { pxFn, pxKey };
export function deepFreeze(value, seen = new WeakSet()) {
  if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child, seen); }
  return value;
}
/** Adds immutable Part ownership and an exact runtime event log without replacing ChainSpot execution. */
export function createPxC(initial = {}) {
  const core = createExecBoard(); const events = [];
  const board = {
    fork: () => core.fork(),
    get(slot) { const address = typeof slot === 'string' ? slot : slot.address; events.push({ kind: 'get', address }); return core.get(slot); },
    has: (slot) => core.has(slot),
    set(slot, value) { const address = typeof slot === 'string' ? slot : slot.address; const existed = core.has(slot); events.push({ kind: 'set', address, write: existed ? 'replacement' : 'new-address' }); core.set(slot, deepFreeze(value)); },
    register: (fn, calculate) => core.register(fn, calculate),
    call(fn, args) { events.push({ kind: 'call', address: fn.address }); return core.call(fn, args); },
    telemetryMark: () => events.length,
    telemetrySince: (mark) => events.slice(mark)
  };
  for (const [address, value] of Object.entries(initial)) board.set(address, value);
  events.length = 0;
  return board;
}
/** Retained export for callers using the original access recorder. */
export function trackAccess(board, tick) { return chainSpotTrackAccess(board, tick); }
