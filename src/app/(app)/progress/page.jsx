import { permanentRedirect } from 'next/navigation';

// /progress is part of You now: Your week, Milestones and Personal bests (web IA plan 2.4). Its list of
// mistakes to repair is Review > Repair record. The redirect is also declared in data/route_moves.mjs,
// which IA9 turns into a 308 in next.config.mjs; this keeps the old address working until then.
export default function Progress() {
  permanentRedirect('/you#progress');
}
