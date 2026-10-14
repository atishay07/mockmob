// Account > Appearance (web redesign W2.3). Theme and glass are per-device choices kept in
// localStorage under the keys the boot script reads (shared/theme.mjs), so the next page load
// paints the chosen look before anything else. Plain module for the browser and node tests.

import { THEME_KEY, GLASS_KEY, THEMES, GLASS_LEVELS } from '../../../../shared/theme.mjs';

export { THEME_KEY, GLASS_KEY };

// The app's words (flutter_app/lib/features/you/copy.dart): Night and Daylight; Full, Lite, Off.
export const THEME_OPTIONS = Object.freeze([
  Object.freeze({ id: 'dark', label: 'Night', note: 'Warm charcoal and lamp light' }),
  Object.freeze({ id: 'light', label: 'Daylight', note: 'Warm paper' }),
]);

export const GLASS_OPTIONS = Object.freeze([
  Object.freeze({ id: 'full', label: 'Full', note: 'Live blur on the header, dock and sheets' }),
  Object.freeze({ id: 'lite', label: 'Lite', note: 'A dense tint without blur' }),
  Object.freeze({ id: 'off', label: 'Off', note: 'Solid bars and sheets' }),
]);

export function validTheme(value) {
  return THEMES.includes(value) ? value : null;
}

export function validGlass(value) {
  return GLASS_LEVELS.includes(value) ? value : null;
}

/**
 * What this browser has saved. `available` is false when storage cannot be read (private mode,
 * blocked site data): the choice then applies for this visit only.
 * @returns {{ theme: 'dark'|'light'|null, glass: 'full'|'lite'|'off'|null, available: boolean }}
 */
export function readAppearance(storage) {
  try {
    if (!storage) return { theme: null, glass: null, available: false };
    return {
      theme: validTheme(storage.getItem(THEME_KEY)),
      glass: validGlass(storage.getItem(GLASS_KEY)),
      available: true,
    };
  } catch {
    return { theme: null, glass: null, available: false };
  }
}

/** Saves one choice. Returns true only when the browser kept it. */
export function writeAppearance(storage, kind, value) {
  const key = kind === 'theme' ? THEME_KEY : kind === 'glass' ? GLASS_KEY : null;
  const valid = kind === 'theme' ? validTheme(value) : kind === 'glass' ? validGlass(value) : null;
  if (!key || !valid || !storage) return false;
  try {
    storage.setItem(key, valid);
    return storage.getItem(key) === valid;
  } catch {
    return false;
  }
}

/** The status line after a change. */
export function appearanceNote(kind, value, kept) {
  const options = kind === 'theme' ? THEME_OPTIONS : GLASS_OPTIONS;
  const label = options.find((option) => option.id === value)?.label || value;
  const what = kind === 'theme' ? `${label} theme` : `Glass ${label.toLowerCase()}`;
  return kept
    ? `${what}, kept on this device.`
    : `${what} for this visit. This browser is not keeping site data, so it resets when you leave.`;
}
