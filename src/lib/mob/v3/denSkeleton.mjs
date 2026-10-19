// The den's skeleton shape (MOB-BUILD-SPEC-V3 D6), pure so the tests can hold it. The skeleton is the room itself (same
// art, lamp, size and head), with paper blocks for the words and the pennant and no Folds, then blocks the size of what
// sat under the room the last time on this device and at this width band: the card, a notice, the quest strip. With
// nothing remembered, the den's usual shape: the open-game card and the quest strip, measured at 390 and 1440 px.

export const SHAPE_KINDS = Object.freeze(['den', 'start', 'v2']);
// Width bands: phones and small tablets draw the den's narrow card (keys stacked), wider screens the row of keys.
export const shapeBand = (width) => (Number(width) >= 640 ? 'w' : 'n');
// Measured on the open-game den (Chai Circle fixture) on 20 Oct: [card, quest strip] in px.
export const DEFAULT_BLOCKS = Object.freeze({ n: Object.freeze([301, 66]), w: Object.freeze([206, 66]) });
const MAX_BLOCKS = 4;

const height = (v) => (Number.isFinite(v) ? Math.max(24, Math.min(900, Math.round(v))) : null);

/** A stored shape made safe: unknown kinds become 'den', heights are whole px in 24..900, at most 4 blocks per band. */
export function parseShape(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kind = SHAPE_KINDS.includes(r.kind) ? r.kind : 'den';
  const blocks = {};
  for (const band of ['n', 'w']) {
    const list = Array.isArray(r.blocks?.[band]) ? r.blocks[band].map(height).filter((h) => h !== null).slice(0, MAX_BLOCKS) : [];
    if (list.length) blocks[band] = list;
  }
  return { kind, switcher: r.switcher === true, blocks };
}

/** The block heights the skeleton draws under the room at this width. */
export function skeletonBlocks(shape, width) {
  const band = shapeBand(width);
  const list = shape?.blocks?.[band];
  return Array.isArray(list) && list.length ? list : [...DEFAULT_BLOCKS[band]];
}
