// @ts-check
import { discCard } from '../../public/concept-a/render.js';
import { adaptDisc, pngFromCandidateScene, renderCandidateScene } from '../candidate-adapter/renderer.js';
import { runCandidateBattle } from '../candidate-pxc/index.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const GAP = 14;

/** Deterministic non-cryptographic identifier for render projections; it is not a content-security hash. */
function stableId(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
function canonicalView(view) {
  return { mode: view.mode, theme: view.theme, anchor: view.anchor, scale: view.scale, cardLayout: view.cardLayout, battleLayout: view.battleLayout, showInstanceLabel: view.showInstanceLabel, showFlightNumbers: view.showFlightNumbers, cardDiscId: view.cardDiscId };
}

/**
 * Run snapshot semantics through the candidate PCR, then project its frozen overlay model with View Args.
 * The PQL run does not receive View Args and this function does not write a PNG; export attaches bytes later.
 * @param {import('../disc-studio/model').Workspace} workspace
 * @param {{id:string, entries:Array<{id:string,discId:string,score:number}>, highlightedEntryId:string|null,winnerEntryIds:string[]}} snapshot
 * @param {import('../candidate-ui/OnTheCourse.svelte').CourseView} view
 */
export function renderBattleSnapshotScene(workspace, snapshot, view) {
  const runInput = { shelf: workspace.discs, snapshot };
  const runIdentity = stableId(runInput);
  const { pxc, run, cache } = runCandidateBattle(runInput, { queryId: `candidate-battle:${snapshot.id}`, sourceId: runIdentity, executionId: runIdentity });
  // This is the PQL-produced Part. Rendering never reads the authored snapshot directly.
  const materialized = pxc.get('px.candidate.battle.part.materialized');
  if (materialized.entries.some((entry) => !entry.disc)) return { svg: '', cardCount: 0, blocked: 'Selected battle state references a missing shelf disc.' };
  const semanticWorkspace = {
    ...workspace,
    discs: materialized.entries.map((entry) => entry.disc),
    battle: { ...workspace.battle, entries: materialized.entries.map(({ id, discId, score }) => ({ id, discId, score })) },
    battleVisual: materialized.battleVisual
  };
  const scene = renderCourseScene(semanticWorkspace, view);
  if (scene.blocked) return scene;
  const viewId = stableId(canonicalView(view));
  return { ...scene, materialization: { pqlResultId: runIdentity, viewId, svgId: stableId(scene.svg), pcr: run.PrincipleComponentRender, cache: { hit: cache.hit, computedParts: cache.computedParts, reusedParts: cache.reusedParts } } };
}


/**
 * Project B workspace facts through A's card primitive using explicit course view settings.
 * @param {import('../disc-studio/model').Workspace} workspace
 * @param {import('../candidate-ui/OnTheCourse.svelte').CourseView} view
 */
export function renderCourseScene(workspace, view) {
  const guard = renderCandidateScene(workspace, { layout: view.battleLayout });
  if (!guard.ok && view.mode === 'battle') {
    return { svg: '', cardCount: 0, blocked: guard.message };
  }
  if (!view || !['card', 'battle'].includes(view.mode)) {
    return { svg: '', cardCount: 0, blocked: 'Choose Single Disc or Disc Battle.' };
  }
  if (!['dark', 'light'].includes(view.theme) || !['wide', 'portrait'].includes(view.cardLayout) ||
    !['row', 'stack'].includes(view.battleLayout) || !['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].includes(view.anchor) ||
    !Number.isFinite(view.scale) || view.scale < .5 || view.scale > 1.5) {
    return { svg: '', cardCount: 0, blocked: 'One or more design settings are unsupported.' };
  }
  const presentation = {
    mode: view.mode,
    theme: view.theme,
    anchor: view.anchor,
    scale: view.scale,
    cardLayout: view.cardLayout,
    battleLayout: view.battleLayout,
    showInstanceLabel: view.showInstanceLabel,
    showFlightNumbers: view.showFlightNumbers
  };
  const cards = [];
  if (view.mode === 'card') {
    const disc = workspace.discs.find((item) => item.id === view.cardDiscId);
    if (!disc) return { svg: '', cardCount: 0, blocked: 'Choose a shelf disc for Single Disc.' };
    cards.push(discCard(/** @type {any} */ (adaptDisc(disc)), presentation));
  } else {
    const byId = new Map(workspace.discs.map((disc) => [disc.id, disc]));
    for (const entry of workspace.battle.entries) {
      const disc = byId.get(entry.discId);
      if (!disc) return { svg: '', cardCount: 0, blocked: `Battle entry ${entry.id} references a missing disc.` };
      cards.push(discCard(/** @type {any} */ (adaptDisc(disc)), presentation, {
        battle: true,
        score: String(entry.score),
        highlighted: workspace.battleVisual.highlightedEntryId === entry.id,
        winner: workspace.battleVisual.emphasizedEntryIds.includes(entry.id)
      }));
    }
  }
  const stacked = view.mode === 'battle' && view.battleLayout === 'stack';
  const contentWidth = cards.length ? (stacked ? Math.max(...cards.map((card) => card.width)) : cards.reduce((sum, card) => sum + card.width, 0) + GAP * (cards.length - 1)) : 0;
  const contentHeight = cards.length
    ? (stacked
      ? cards.reduce((sum, card) => sum + card.height, 0) + GAP * (cards.length - 1)
      : Math.max(...cards.map((card) => card.height)))
    : 0;
  const scale = Math.min(view.scale, 1800 / Math.max(contentWidth, 1), 960 / Math.max(contentHeight, 1));
  const x = view.anchor === 'center' ? (WIDTH - contentWidth * scale) / 2 : view.anchor.endsWith('right') ? 1860 - contentWidth * scale : 60;
  const y = view.anchor === 'center' ? (HEIGHT - contentHeight * scale) / 2 : view.anchor.startsWith('top') ? 60 : 1020 - contentHeight * scale;
  let offset = 0;
  const markup = cards.map((card) => {
    const group = `<g transform="translate(${stacked ? 0 : offset} ${stacked ? offset : 0})">${card.markup}</g>`;
    offset += (stacked ? card.height : card.width) + GAP;
    return group;
  }).join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${view.mode === 'card' ? 'Single Disc' : 'Disc Battle'} overlay" font-family="Arial, Helvetica, sans-serif"><g transform="translate(${x} ${y}) scale(${scale})">${markup}</g></svg>`,
    cardCount: cards.length,
    disclosures: ['Images use contain placement in the exported graphic.']
  };
}

export function exportCoursePng(scene) {
  return pngFromCandidateScene(scene.svg);
}
