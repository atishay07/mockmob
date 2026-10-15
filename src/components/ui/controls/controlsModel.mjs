// Pure logic for the designed control set (Listbox, SegmentedControl). No React, no DOM:
// node --test covers it in controlsModel.test.mjs.

/** Normalises options: plain values become { value, label }; keeps group and disabled. */
export function normaliseOptions(options = []) {
  return options.map((option) => (option && typeof option === 'object' && 'value' in option
    ? { ...option, label: option.label ?? String(option.value), disabled: Boolean(option.disabled) }
    : { value: option, label: String(option), disabled: false }));
}

/** Splits options into ordered sections: options without a group first, then each group in order of first use. */
export function groupOptions(options = []) {
  const sections = [];
  const byName = new Map();
  options.forEach((option, index) => {
    const name = option.group ?? null;
    let section = byName.get(name);
    if (!section) {
      section = { name, items: [] };
      byName.set(name, section);
      if (name === null) sections.unshift(section); else sections.push(section);
    }
    section.items.push({ option, index });
  });
  return sections;
}

export const indexOfValue = (options, value) => options.findIndex((option) => Object.is(option.value, value) || option.value === value);

/** The next enabled index from `from` moving by `step` (1 or -1). Clamps at the ends; returns `from` if none. */
export function stepEnabled(options, from, step) {
  for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
  return from;
}

/** First or last enabled index, or -1 when every option is disabled. */
export function edgeEnabled(options, last = false) {
  if (last) { for (let i = options.length - 1; i >= 0; i -= 1) if (!options[i].disabled) return i; return -1; }
  return options.findIndex((option) => !option.disabled);
}

/** Moves by a page (default 10 rows), landing on an enabled option. */
export function pageEnabled(options, from, step, size = 10) {
  let target = Math.max(0, Math.min(options.length - 1, from + step * size));
  if (!options[target]?.disabled) return target;
  const nearer = stepEnabled(options, target, -step);
  return nearer !== target ? nearer : stepEnabled(options, target, step);
}

/**
 * Typeahead: the next enabled option (after `from`, wrapping) whose label starts with the query.
 * A query of one repeated letter cycles through options with that first letter, as native selects do.
 */
export function typeaheadMatch(options, query, from = -1) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || !options.length) return -1;
  const repeated = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = repeated ? q[0] : q;
  const start = repeated || q.length === 1 ? from + 1 : Math.max(from, 0);
  for (let n = 0; n < options.length; n += 1) {
    const i = (start + n) % options.length;
    if (!options[i].disabled && String(options[i].label).trim().toLowerCase().startsWith(needle)) return i;
  }
  return -1;
}

/**
 * What a key does in a select-only combobox (WAI-ARIA APG). Returns null for keys it does not own.
 * Closed: arrows, Home, End, Enter and Space open. Open: move, select, close.
 */
export function listboxKeyAction(key, { open, altKey = false } = {}) {
  if (!open) {
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') return altKey && key === 'ArrowUp' ? null : { type: 'open', focus: key === 'ArrowUp' ? 'current-or-last' : 'current-or-first' };
    if (key === 'Home') return { type: 'open', focus: 'first' };
    if (key === 'End') return { type: 'open', focus: 'last' };
    return null;
  }
  if (key === 'ArrowUp' && altKey) return { type: 'select-close' };
  if (key === 'ArrowDown') return { type: 'move', step: 1 };
  if (key === 'ArrowUp') return { type: 'move', step: -1 };
  if (key === 'Home') return { type: 'edge', last: false };
  if (key === 'End') return { type: 'edge', last: true };
  if (key === 'PageDown') return { type: 'page', step: 1 };
  if (key === 'PageUp') return { type: 'page', step: -1 };
  if (key === 'Enter' || key === ' ') return { type: 'select-close' };
  if (key === 'Escape') return { type: 'close' };
  if (key === 'Tab') return { type: 'select-close', keepDefault: true };
  return null;
}

/** Roving radio keys for a segmented control: the index to check next, or null. Disabled options are skipped. */
export function segmentKeyTarget(options, current, key) {
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  if (!enabled.length) return null;
  const at = enabled.indexOf(current);
  if (key === 'Home') return enabled[0];
  if (key === 'End') return enabled[enabled.length - 1];
  const dir = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (!dir) return null;
  if (at < 0) return dir > 0 ? enabled[0] : enabled[enabled.length - 1];
  return enabled[(at + dir + enabled.length) % enabled.length];
}

/**
 * Where a popover goes: below the trigger unless the room below is short and there is more above.
 * Returns { placement, top|bottom, left, width, maxHeight } in viewport pixels.
 */
export function placePopover(trigger, viewport, { gap = 6, margin = 12, minWidth = 220, maxHeight = 340, minRoom = 180 } = {}) {
  const below = viewport.height - trigger.bottom - gap - margin;
  const above = trigger.top - gap - margin;
  const up = below < Math.min(minRoom, maxHeight) && above > below;
  const width = Math.min(Math.max(trigger.width, minWidth), viewport.width - margin * 2);
  const left = Math.max(margin, Math.min(trigger.left, viewport.width - margin - width));
  const room = Math.max(120, up ? above : below);
  return up
    ? { placement: 'top', bottom: viewport.height - trigger.top + gap, left, width, maxHeight: Math.min(maxHeight, room) }
    : { placement: 'bottom', top: trigger.bottom + gap, left, width, maxHeight: Math.min(maxHeight, room) };
}
