import assert from 'node:assert/strict';
import test from 'node:test';
import { renderBattleSnapshotScene } from '../../source/candidate/course-renderer.js';

const image = null;
const workspace = {
 version: 1,
 discs: [
  { id:'disc-a', manufacturer:'Axiom', mold:'Proxy', variant:'', flight:{speed:3,glide:3,turn:-1,fade:0}, image },
  { id:'disc-b', manufacturer:'Innova', mold:'Roc', variant:'', flight:{speed:4,glide:4,turn:0,fade:3}, image }
 ],
 battle:{ id:'b', title:'Battle', entries:[] },
 cardAppearance:{ layout:'showcase', hierarchy:'name', theme:'ink', imageFit:'contain', showVariant:true },
 battleAppearance:{ layout:'row', showScores:true },
 battleVisual:{ highlightedEntryId:null, emphasizedEntryIds:[] }
};
const view = { mode: 'battle', theme: 'dark', anchor: 'bottom-left', scale: 1, cardLayout: 'wide', battleLayout: 'row', showInstanceLabel: true, showFlightNumbers: true, cardDiscId: null };
test('view changes alter projection identity without changing the PQL result identity', () => {
 const snapshot = { id:'state-one', entries:[{id:'entry-a',discId:'disc-a',score:4},{id:'entry-b',discId:'disc-b',score:2}], highlightedEntryId:'entry-a', winnerEntryIds:[], imageExport:null };
 const dark = renderBattleSnapshotScene(workspace, snapshot, view);
 const light = renderBattleSnapshotScene(workspace, snapshot, { ...view, theme: 'light' });
 assert.equal(dark.blocked, undefined); assert.equal(light.blocked, undefined);
 assert.equal(dark.materialization.pqlResultId, light.materialization.pqlResultId);
 assert.notEqual(dark.materialization.viewId, light.materialization.viewId);
 assert.notEqual(dark.materialization.svgId, light.materialization.svgId);
});
