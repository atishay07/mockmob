import 'bar_icons.dart';

/// One of the bar's five places (app-ia-1016.md section 3).
class BarTab {
  const BarTab(this.label, this.icon);

  final String label;
  final BarIconKind icon;
}

/// The five places in branch order: Today, Practice, Review, Colleges, You.
const List<BarTab> kBarTabs = [
  BarTab('Today', BarIconKind.today),
  BarTab('Practice', BarIconKind.practice),
  BarTab('Review', BarIconKind.review),
  BarTab('Colleges', BarIconKind.colleges),
  BarTab('You', BarIconKind.you),
];

/// The shell branch of each place.
abstract final class BarBranch {
  static const int today = 0;
  static const int practice = 1;
  static const int review = 2;
  static const int colleges = 3;
  static const int you = 4;
}

/// The bar's six visual slots, left to right: Today, Practice, Start, Review, Colleges, You.
const int kBarSlots = 6;

/// The visual slot of the Start key.
const int kStartSlot = 2;

/// The shell branch a visual slot opens, or null for the Start slot. Slots 0, 1, 3, 4 and 5 open
/// branches 0, 1, 2, 3 and 4.
int? slotToBranch(int slot) => switch (slot) {
  0 => 0,
  1 => 1,
  3 => 2,
  4 => 3,
  5 => 4,
  _ => null,
};

/// The visual slot of a shell branch.
int branchToSlot(int branch) => branch < kStartSlot ? branch : branch + 1;

/// The spoken name of a tab: "Review, tab 3 of 5, 4 open mistakes to repair". Start is not a tab,
/// so the tabs count to five. "Selected" comes from the selected flag. Review's count is tonight's
/// chapter's open mistakes, the noun Today's hero uses for the same number ("3 of the 4 open
/// mistakes in ..."), and it names no time of day: the badge is the same at 9 AM and at 11 PM.
String barTabSemanticsLabel(
  int branch, {
  int reviewCount = 0,
  bool reviewDot = false,
  bool collegesDot = false,
  bool youDot = false,
}) {
  final base = '${kBarTabs[branch].label}, tab ${branch + 1} of ${kBarTabs.length}';
  if (branch == BarBranch.review && reviewCount > 0) {
    return '$base, $reviewCount open ${reviewCount == 1 ? 'mistake' : 'mistakes'} to repair';
  }
  if (branch == BarBranch.review && reviewDot) return '$base, a result is waiting';
  if (branch == BarBranch.colleges && collegesDot) return '$base, new cutoffs for your colleges';
  if (branch == BarBranch.you && youDot) return '$base, needs your attention';
  return base;
}
