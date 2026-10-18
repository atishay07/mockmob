import 'bar_icons.dart';

/// One of the bar's four places (D105, 19 Oct: Today, Practice, Start, Mob, You).
class BarTab {
  const BarTab(this.label, this.icon);

  final String label;
  final BarIconKind icon;
}

/// The four places in branch order: Today, Practice, Mob, You. Start is not a place: it is the
/// round key in the middle of the row, between Practice and Mob (D105, "Start stays the centre
/// key"). Review moved inside Practice as Your papers; Colleges is a page pushed over the bar.
const List<BarTab> kBarTabs = [
  BarTab('Today', BarIconKind.today),
  BarTab('Practice', BarIconKind.practice),
  BarTab('Mob', BarIconKind.mob),
  BarTab('You', BarIconKind.you),
];

/// The shell branch of each place.
abstract final class BarBranch {
  static const int today = 0;
  static const int practice = 1;
  static const int mob = 2;
  static const int you = 3;
}

/// The capsule's four tab slots, left to right, in branch order. Start is not a slot: it is the key
/// in the middle of the capsule, two slots on each side of it, so a slot and a branch are the same
/// number.
const int kBarSlots = 4;

/// How many tab slots sit left of the Start key.
const int kSlotsBeforeKey = 2;

/// The shell branch a slot opens (the same number; kept so callers read as intent).
int slotToBranch(int slot) => slot;

/// The slot of a shell branch.
int branchToSlot(int branch) => branch;

/// The spoken name of a tab: "Practice, tab 2 of 4, 4 open mistakes to repair". Start is not a tab,
/// so the tabs count to four. "Selected" comes from the selected flag. Practice carries the count
/// that Review's tab carried (Your papers lives in Practice now, D105): tonight's chapter's open
/// mistakes, the noun Today's hero uses for the same number, and it names no time of day.
String barTabSemanticsLabel(
  int branch, {
  int reviewCount = 0,
  bool reviewDot = false,
  bool youDot = false,
}) {
  final base = '${kBarTabs[branch].label}, tab ${branch + 1} of ${kBarTabs.length}';
  if (branch == BarBranch.practice && reviewCount > 0) {
    return '$base, $reviewCount open ${reviewCount == 1 ? 'mistake' : 'mistakes'} to repair';
  }
  if (branch == BarBranch.practice && reviewDot) return '$base, a result is waiting';
  if (branch == BarBranch.you && youDot) return '$base, needs your attention';
  return base;
}
