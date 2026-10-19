// The 24 Mob names (spec 5.3 D0a, `src/lib/mob/names.mjs`): a fixed kind list, no free text. The key is
// the index; the server holds the same list. "Night Owls" is gone (F9).

const List<String> mobNames = [
  'Chai Circle',
  'Quiet Comets',
  'Margin Makers',
  'Steady Kites',
  'Ledger Club',
  'Paper Planes',
  'Tea Break Crew',
  'Bright Folds',
  'Page Turners',
  'Desk Mates',
  'Little Lamps',
  'Sharp Pencils',
  'Kind Keys',
  'Graph Gang',
  'Inkwell',
  'Clear Skies',
  'First Light',
  'Long Paper',
  'Neat Notes',
  'Blue Margins',
  'Five Desks',
  'Steady Hands',
  'Fresh Pages',
  'Calm Clocks',
];

String mobNameOf(int? key) => key == null || key < 0 || key >= mobNames.length ? '' : mobNames[key];
