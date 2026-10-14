import 'bar_icons.dart';

/// One of the bar's four places (DOCK.md section 1).
class BarTab {
  const BarTab(this.label, this.icon);

  final String label;
  final BarIconKind icon;
}

/// The four places in branch order: Today, Practice, Review, You.
const List<BarTab> kBarTabs = [
  BarTab('Today', BarIconKind.today),
  BarTab('Practice', BarIconKind.practice),
  BarTab('Review', BarIconKind.review),
  BarTab('You', BarIconKind.you),
];

/// The bar's five visual slots, left to right: Today, Practice, Start, Review, You.
const int kBarSlots = 5;

/// The visual slot of the Start key.
const int kStartSlot = 2;

/// The shell branch a visual slot opens, or null for the Start slot. Slots 0, 1, 3 and 4 open
/// branches 0, 1, 2 and 3.
int? slotToBranch(int slot) => switch (slot) {
  0 => 0,
  1 => 1,
  3 => 2,
  4 => 3,
  _ => null,
};

/// The visual slot of a shell branch.
int branchToSlot(int branch) => branch < 2 ? branch : branch + 1;

/// The spoken name of a tab: "Review, tab 3 of 4, 3 to repair tonight". Start is not a tab, so
/// the tabs count to four. "Selected" comes from the selected flag.
String barTabSemanticsLabel(int branch, {int reviewCount = 0, bool reviewDot = false, bool youDot = false}) {
  final base = '${kBarTabs[branch].label}, tab ${branch + 1} of ${kBarTabs.length}';
  if (branch == 2 && reviewCount > 0) return '$base, $reviewCount to repair tonight';
  if (branch == 2 && reviewDot) return '$base, a result is waiting';
  if (branch == 3 && youDot) return '$base, needs your attention';
  return base;
}
