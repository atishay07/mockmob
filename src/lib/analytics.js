// ─── Analytics Logger — Phase 1 ──────────────────────────────────────────────
// Lightweight in-memory + console analytics. No external dependency.

let _store = {
  viewed: 0,
  answered: 0,
  skipped: 0,
  totalDwellMs: 0,
  dwellSamples: 0,
};

export const Analytics = {
  recordView() {
    _store.viewed++;
    _flush();
  },
  recordAnswer() {
    _store.answered++;
    _flush();
  },
  recordSkip(dwellMs = 0) {
    _store.skipped++;
    if (dwellMs > 0) {
      _store.totalDwellMs += dwellMs;
      _store.dwellSamples++;
    }
    _flush();
  },
  recordDwell(dwellMs) {
    if (dwellMs > 0) {
      _store.totalDwellMs += dwellMs;
      _store.dwellSamples++;
    }
  },
  getSnapshot() {
    const total = _store.answered + _store.skipped;
    return {
      viewed: _store.viewed,
      answered: _store.answered,
      skipped: _store.skipped,
      skipRate: total > 0 ? (((_store.skipped / total) * 100).toFixed(1) + '%') : 'N/A',
      avgDwellMs: _store.dwellSamples > 0
        ? Math.round(_store.totalDwellMs / _store.dwellSamples)
        : 0,
    };
  },
};

let _flushTimer = null;
function _flush() {
  if (typeof window === 'undefined') return;
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    console.log('[MockMob Analytics]', Analytics.getSnapshot());
  }, 2000);
}
