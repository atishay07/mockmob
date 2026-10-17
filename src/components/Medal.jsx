"use client";

// The medal: a circle engraved with a numeral or a plain line icon, as in the app. Earned is the volt medal,
// the next one an inked ring, the rest a dashed ring. `size` is the diameter ladder: md 38 (a row of the paths),
// lg 56 (the shelf), xl 80 (the badge's own sheet). No glow in either theme.
import { CalendarCheck, Check, CircleCheckBig, FileText, LayoutGrid, Monitor, Repeat, ShieldCheck, TrendingUp } from 'lucide-react';

const GLYPHS = {
  first_scored_session: '1', first_full_mock: FileText, first_nta: Monitor, sessions_10: '10', full_mocks_5: '5',
  first_repair: Check, repairs_5: '5', repairs_10: '10', repairs_25: '25', first_hold: ShieldCheck,
  first_week_met: CalendarCheck, weeks_met_4: '4', run_weeks_3: Repeat,
  clean_set: CircleCheckBig, four_subjects: LayoutGrid, new_best: TrendingUp,
};

export function Medal({ id, status, size = 'md', reveal = false }) {
  const Glyph = GLYPHS[id];
  return (
    <span className="sb-medal" data-status={status} data-size={size} data-reveal={reveal ? 'true' : undefined} aria-hidden="true">
      {typeof Glyph === 'string' ? <b>{Glyph}</b> : Glyph ? <Glyph size="1.2em" strokeWidth={1.75} /> : null}
    </span>
  );
}
