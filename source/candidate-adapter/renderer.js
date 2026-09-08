// @ts-check
/**
 * A deliberately small boundary from Concept B's model to Concept A's pure
 * SVG primitives. This module has no dependency on Svelte or editor state.
 */
import { discCard, pngFromScene } from '../../public/concept-a/render.js';

/** @typedef {import('../disc-studio/model').Disc} BDisc */
/** @typedef {import('../disc-studio/model').Workspace} BWorkspace */
/**
 * Concept A's runtime text primitive accepts an em dash in its flight tuple,
 * although the old A declaration only describes numeric flights.
 * @typedef {Object} CandidateRenderDisc
 * @property {string} id
 * @property {{manufacturer:string,mold:string,flight:[number|'—',number|'—',number|'—',number|'—']}} facts
 * @property {string} label
 * @property {string} plastic
 * @property {string} weight
 * @property {{kind:'upload',dataUrl:string,fileName:string,width:number,height:number}|null} photo
 */

/** @typedef {'UNSUPPORTED_GRID'|'UNSUPPORTED_IMAGE_FIT'|'UNSUPPORTED_HIDDEN_SCORES'|'INVALID_INPUT'} UnsupportedCode */
/** @typedef {{ok:false, kind:'unsupported'|'invalid', code:UnsupportedCode, message:string}} UnsupportedResult */
/** @typedef {{ok:true, kind:'svg', svg:string, bounds:{x:number,y:number,width:number,height:number}, cardCount:number, effectiveScale:number, disclosures:string[]}} CandidateScene */
/** @typedef {CandidateScene|UnsupportedResult} CandidateRenderResult */
/** @typedef {{layout:'row'|'stack'}} CandidateViewArgs */

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const CARD_GAP = 14;

/** @param {BDisc} disc @returns {CandidateRenderDisc} */
export function adaptDisc(disc) {
  if (!disc || typeof disc !== 'object') throw new TypeError('A Concept B disc is required.');
  const flight = disc.flight;
  if (!flight || typeof flight !== 'object') throw new TypeError('A Concept B disc must include flight numbers.');
  // Concept A's text primitive renders null as an empty string. Materialize
  // B's null semantics here so the exported card visibly shows an em dash.
  const orderedFlight = [flight.speed, flight.glide, flight.turn, flight.fade].map((value) =>
    value === null ? '—' : value
  );
  if (orderedFlight.some((value) => value !== '—' && (typeof value !== 'number' || !Number.isFinite(value)))) {
    throw new TypeError('Concept B flight numbers must be finite numbers or null.');
  }
  if (disc.image !== null && (!disc.image || typeof disc.image.src !== 'string')) {
    throw new TypeError('Concept B image must be null or contain a string src.');
  }
  if (disc.image !== null && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(disc.image.src)) {
    throw new TypeError('Concept B image must be an embedded PNG, JPEG or WebP data URL.');
  }
  return {
    id: disc.id,
    facts: {
      manufacturer: disc.manufacturer,
      mold: disc.mold,
      // A's renderer only needs values at its text boundary; its runtime
      // renderer accepts the em dash alongside numeric flight values.
      flight: orderedFlight
    },
    // Variant is the only B specimen label. Plastic and weight have no B
    // source and remain empty so A cannot invent another label.
    label: disc.variant,
    plastic: '',
    weight: '',
    photo: disc.image
      ? { kind: 'upload', dataUrl: disc.image.src, fileName: 'candidate-image', width: 1, height: 1 }
      : null
  };
}

/** @param {BWorkspace} workspace @param {CandidateViewArgs|undefined} viewArgs */
function unsupportedFor(workspace, viewArgs) {
  // A view argument is an explicit export decision, so it may resolve a B
  // grid for this provisional A renderer. Without one, grid remains blocked.
  if (viewArgs === undefined && workspace.battleAppearance.layout === 'grid') {
    return /** @type {UnsupportedResult} */ ({
      ok: false,
      kind: 'unsupported',
      code: 'UNSUPPORTED_GRID',
      message: 'Concept A export cannot faithfully represent Concept B grid layout.'
    });
  }
  if (workspace.cardAppearance.imageFit === 'cover') {
    return /** @type {UnsupportedResult} */ ({
      ok: false,
      kind: 'unsupported',
      code: 'UNSUPPORTED_IMAGE_FIT',
      message: 'Concept A export cannot faithfully represent Concept B imageFit=cover.'
    });
  }
  if (workspace.battleAppearance.showScores === false) {
    return /** @type {UnsupportedResult} */ ({
      ok: false,
      kind: 'unsupported',
      code: 'UNSUPPORTED_HIDDEN_SCORES',
      message: 'Concept A battle cards always render a SCORE field, so hidden Concept B scores cannot be exported faithfully.'
    });
  }
  return null;
}

/** @param {BWorkspace} workspace @returns {CandidateRenderDisc[]} */
function adaptedDiscs(workspace) {
  return workspace.discs.map(adaptDisc);
}

/** @param {BWorkspace} workspace */
function validateInput(workspace) {
  if (!workspace || typeof workspace !== 'object') return 'A Concept B workspace is required.';
  if (!workspace.battle || !Array.isArray(workspace.battle.entries)) return 'Concept B battle entries are required.';
  if (!Array.isArray(workspace.discs)) return 'Concept B discs are required.';
  if (!workspace.cardAppearance || !workspace.battleAppearance || !workspace.battleVisual) return 'Concept B presentation and visual state are required.';
  const discIds = new Set();
  for (const disc of workspace.discs) {
    if (!disc || typeof disc !== 'object' || typeof disc.id !== 'string' || !disc.id.trim() || discIds.has(disc.id)) {
      return 'Concept B discs must have unique, nonempty identifiers.';
    }
    discIds.add(disc.id);
  }
  const entryIds = new Set();
  for (const entry of workspace.battle.entries) {
    if (!entry || typeof entry.id !== 'string' || entryIds.has(entry.id)) return 'Concept B battle entries must have unique identifiers.';
    entryIds.add(entry.id);
    if (typeof entry.discId !== 'string' || !discIds.has(entry.discId)) {
      return `Battle entry ${String(entry.id)} references a missing disc.`;
    }
    if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) {
      return `Battle entry ${String(entry.id)} must have a finite numeric score.`;
    }
  }
  const visual = workspace.battleVisual;
  if (
    !(visual.highlightedEntryId === null || entryIds.has(visual.highlightedEntryId)) ||
    !Array.isArray(visual.emphasizedEntryIds) ||
    visual.emphasizedEntryIds.some((id) => typeof id !== 'string' || !entryIds.has(id)) ||
    new Set(visual.emphasizedEntryIds).size !== visual.emphasizedEntryIds.length
  ) return 'Concept B visual state references a missing or duplicate entry.';
  return null;
}

/**
 * Render the B battle as a deterministic A-style transparent SVG scene.
 *
 * B's highlightedEntryId is authored visual state and is passed through to
 * A's highlighted card treatment. B's emphasizedEntryIds is plural, so each
 * matching card independently receives winner:true. There is intentionally no
 * selectedEntryId argument: editor focus is outside export input.
 * Malformed disc facts are converted to INVALID_INPUT here; adaptDisc remains
 * a low-level mapper that throws when called directly with malformed data.
 *
 * @param {BWorkspace} workspace
 * @param {CandidateViewArgs} [viewArgs] Explicit export layout, independent of Workspace state.
 * @returns {CandidateRenderResult}
 */
export function renderCandidateScene(workspace, viewArgs) {
  const invalid = validateInput(workspace);
  if (invalid) return { ok: false, kind: 'invalid', code: 'INVALID_INPUT', message: invalid };
  if (viewArgs !== undefined && (!viewArgs || !['row', 'stack'].includes(viewArgs.layout))) {
    return { ok: false, kind: 'invalid', code: 'INVALID_INPUT', message: 'Export view layout must be row or stack.' };
  }
  const unsupported = unsupportedFor(workspace, viewArgs);
  if (unsupported) return unsupported;

  const layout = viewArgs?.layout ?? workspace.battleAppearance.layout;
  let aDiscs;
  try {
    aDiscs = adaptedDiscs(workspace);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Concept B disc facts are malformed.';
    return { ok: false, kind: 'invalid', code: 'INVALID_INPUT', message };
  }
  const byId = new Map(aDiscs.map((disc) => [disc.id, disc]));
  const view = {
    mode: 'battle',
    theme: workspace.cardAppearance.theme === 'paper' ? 'light' : 'dark',
    anchor: 'center',
    scale: 1,
    cardLayout: 'wide',
    battleLayout: layout,
    showInstanceLabel: workspace.cardAppearance.showVariant,
    showFlightNumbers: true
  };
  const emphasized = new Set(workspace.battleVisual.emphasizedEntryIds);
  const cards = workspace.battle.entries.flatMap((entry) => {
    const disc = byId.get(entry.discId);
    if (!disc) throw new Error(`Battle entry ${entry.id} references a missing disc.`);
    // String conversion happens only at A's score prop boundary. The B score
    // remains a finite number throughout validation and lookup above.
    const state = {
      battle: true,
      score: workspace.battleAppearance.showScores ? String(entry.score) : undefined,
      highlighted: entry.id === workspace.battleVisual.highlightedEntryId,
      winner: emphasized.has(entry.id)
    };
    // A's public declaration predates B's nullable-flight semantics. The
    // local CandidateRenderDisc type above is accurate for this runtime, and
    // this bridge is the only place that calls the older primitive.
    const renderCard = /** @type {any} */ (discCard);
    return [renderCard(disc, view, state)];
  });
  const stacked = layout === 'stack';
  const width = cards.length
    ? stacked
      ? Math.max(...cards.map((card) => card.width))
      : cards.reduce((sum, card) => sum + card.width, 0) + CARD_GAP * (cards.length - 1)
    : 0;
  const height = cards.length
    ? stacked
      ? cards.reduce((sum, card) => sum + card.height, 0) + CARD_GAP * (cards.length - 1)
      : Math.max(...cards.map((card) => card.height))
    : 0;
  const scale = Math.min(1, CANVAS_WIDTH / Math.max(width, 1), CANVAS_HEIGHT / Math.max(height, 1));
  const x = (CANVAS_WIDTH - width * scale) / 2;
  const y = (CANVAS_HEIGHT - height * scale) / 2;
  let offset = 0;
  const markup = cards.map((card) => {
    const group = `<g transform="translate(${stacked ? 0 : offset} ${stacked ? offset : 0})">${card.markup}</g>`;
    offset += (stacked ? card.height : card.width) + CARD_GAP;
    return group;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" role="img" aria-label="DiscBattle overlay" font-family="Arial, Helvetica, sans-serif"><g transform="translate(${x} ${y}) scale(${scale})">${markup}</g></svg>`;
  const disclosures = workspace.cardAppearance.imageFit === 'contain'
    ? ['B imageFit=contain maps to A preserveAspectRatio="xMidYMid meet".']
    : [];
  return {
    ok: true,
    kind: 'svg',
    svg,
    bounds: { x, y, width: width * scale, height: height * scale },
    cardCount: cards.length,
    effectiveScale: scale,
    disclosures
  };
}

/**
 * Browser-only PNG bridge. It delegates rasterization to Concept A's existing
 * browser bridge and rejects typed unsupported results instead of guessing a
 * layout or image fit.
 * @param {CandidateScene|UnsupportedResult|string} scene
 * @param {number} [width]
 * @returns {Promise<Blob>}
 */
export function pngFromCandidateScene(scene, width = CANVAS_WIDTH) {
  if (typeof scene !== 'string' && !scene.ok) return Promise.reject(new Error(scene.message));
  return pngFromScene(typeof scene === 'string' ? scene : scene.svg, width);
}

export const candidateCanvas = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
