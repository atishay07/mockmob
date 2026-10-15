import { permanentRedirect } from 'next/navigation';

// /progress is part of You now: Your week, Milestones and Personal bests (web IA plan 2.4). Its list of
// mistakes to repair is Review > Repair record. next.config.mjs answers first with the same 308 from
// data/route_moves.mjs (it keeps the query); this page is the fallback if that wiring is ever removed.
export default function Progress() {
  permanentRedirect('/you#progress');
}
