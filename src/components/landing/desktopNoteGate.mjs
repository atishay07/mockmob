// The first-visit desktop note's gate (DesktopNote.jsx; owner LK320). Plain data and one self-contained function, so
// node --test can run it (desktopNoteGate.test.mjs) and the page can inline it.

/** localStorage: the time of the first phone visit (ms), or 'x' once the cross was pressed. */
export const DESK_NOTE_KEY = 'mm:desk-note:v1';
/** The note belongs to the first visit: it stops showing this long after the first load. */
export const DESK_NOTE_VISIT_MS = 30 * 60 * 1000;
/** Phones only. */
export const DESK_NOTE_MEDIA = '(max-width: 699px)';
export const DESK_NOTE_WORDS = 'MockMob works best on a laptop or desktop.';

// Written in plain ES2017 with no outside references: it is inlined as `(${deskNoteGate})(window, document, cfg)`.
export function deskNoteGate(w, d, cfg) {
  var show = false;
  try {
    var html = d.documentElement;
    var signed = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(d.cookie);
    if (!signed && html.getAttribute('data-app-view') !== '1' && w.matchMedia(cfg.media).matches) {
      var now = Date.now();
      var first = w.localStorage.getItem(cfg.key);
      if (!first) { first = String(now); w.localStorage.setItem(cfg.key, first); }
      show = first !== 'x' && now - Number(first) >= 0 && now - Number(first) < cfg.visit;
    }
    if (show) html.setAttribute('data-desk-note', '1');
  } catch (e) { show = false; }
  return show;
}

export const deskNoteScript = () => `(${deskNoteGate.toString()})(window,document,${JSON.stringify({ key: DESK_NOTE_KEY, visit: DESK_NOTE_VISIT_MS, media: DESK_NOTE_MEDIA })})`;
