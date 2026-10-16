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

/// The capsule's five slots, left to right, in branch order. Start is not a slot: it is the
/// separate key beside the capsule (NAV-1017 section 6), so a slot and a branch are the same
/// number.
const int kBarSlots = 5;

/// The shell branch a slot opens (the same number; kept so callers read as intent).
int slotToBranch(int slot) => slot;

/// The slot of a shell branch.
int branchToSlot(int branch) => branch;

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
