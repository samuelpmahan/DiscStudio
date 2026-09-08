import assert from 'node:assert/strict';
import test from 'node:test';
import { BADGE_ASSEMBLY_COMPOSITION, BADGE_ASSEMBLY_PQL, createPxC, invokePql, materializeBattleState, exportBattleState, trackAccess } from '../../source/candidate-pxc/index.js';

test('real composition parses with declaration order and exact addresses', () => {
 assert.equal(BADGE_ASSEMBLY_COMPOSITION.PrincipleComponentRender, 'S1');
 assert.deepEqual(BADGE_ASSEMBLY_COMPOSITION.Ticks.map(t => t.name), ['BlackMask','WhiteMask','BadgeAssembly','WhiteDigitRecognition','BadgeOutputs']);
 assert.equal(BADGE_ASSEMBLY_COMPOSITION.Ticks[2].Calculations.at(-1).into, 'px.s1.exp.badgeAssembly.badgeCandidates');
 assert.match(BADGE_ASSEMBLY_PQL, /fn\.s1\.badges\.remainingPixels/);
});

test('registered fn calculations execute in source order and record actual traffic', () => {
 const pxc = createPxC({ input: { value: 3 } }); const order = [];
 const comp = { PrincipleComponentRender:'T', Ticks:[{name:'A', consumes:['input'], Calculations:[{call:'fn.double',with:{source:'input'},args:{},into:'middle'}]},{name:'B', consumes:['middle'], Calculations:[{call:'fn.plus',with:{source:'middle'},args:{amount:2},into:'output'}]}]};
 pxc.register({address:'fn.double'}, ({source}) => { order.push('double'); return { value: source.value * 2 }; });
 pxc.register({address:'fn.plus'}, ({source,amount}) => { order.push('plus'); return source.value + amount; });
 const run = invokePql(comp,{pxc}); assert.deepEqual(order,['double','plus']); assert.equal(pxc.get('output'),8); assert.equal(run.Ticks[1].Calculations[0].inputs.source.value,6);
 const access = trackAccess(pxc, {id:'B', consumes:['middle']}); access.tracked.get('middle'); access.tracked.set('output2', 9); assert.deepEqual([...access.consumed],['middle']); assert.equal(access.writes[0].kind,'new-address');
});

test('inputs are immutable and export is stable', () => {
 const input = { pixels:[1,2] }; const pxc = createPxC({ input }); pxc.register({address:'fn.echo'}, ({source}) => { assert.throws(() => { source.pixels.push(3); }, TypeError); return source; });
 const comp = { PrincipleComponentRender:'T',Ticks:[{name:'A',Calculations:[{call:'fn.echo',with:{source:'input'},args:{},into:'out'}]}]}; const run=invokePql(comp,{pxc}); const state=materializeBattleState({run,pxc}); assert.deepEqual(JSON.parse(exportBattleState(state)).identity,{queryId:'T',sourceId:'T',executionId:'exec-1'});
});
