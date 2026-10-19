// Mob names from a fixed kind list (MOB-BUILD-SPEC-V3 0.3 item 8, D0a; C-dec 2 item 7). No free text: a Mob stores only
// the key (mobs.name_key, 0..23). A null key shows the subject name. "Night Owls" is not on the list (F9). The app keeps
// the same list in lib/features/social/logic/mob_names.dart, and a contract test keeps the two equal.
export const MOB_NAMES = Object.freeze([
  'Chai Circle', 'Quiet Comets', 'Margin Makers', 'Steady Kites', 'Ledger Club', 'Paper Planes',
  'Tea Break Crew', 'Bright Folds', 'Page Turners', 'Desk Mates', 'Little Lamps', 'Sharp Pencils',
  'Kind Keys', 'Graph Gang', 'Inkwell', 'Clear Skies', 'First Light', 'Long Paper',
  'Neat Notes', 'Blue Margins', 'Five Desks', 'Steady Hands', 'Fresh Pages', 'Calm Clocks',
]);

export const validNameKey = (v) => Number.isInteger(v) && v >= 0 && v < MOB_NAMES.length;

/** { key, text }: the Mob's name, or the subject name when no name was picked (key null). */
export function mobName(key, subjectName) {
  if (validNameKey(key)) return { key, text: MOB_NAMES[key] };
  return { key: null, text: subjectName || '' };
}
