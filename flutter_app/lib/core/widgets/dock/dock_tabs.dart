import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// One of the three dock tabs (brief section 6). The outline icon is Lucide's light weight and
/// the active icon the regular weight, MockMob's "outline to filled" switch; the tab's answer
/// bubble inks as well, so the state never rests on the icon alone.
class MmTab {
  const MmTab(this.label, this.icon, this.activeIcon);

  final String label;
  final IconData icon;
  final IconData activeIcon;
}

const List<MmTab> kMmTabs = [
  MmTab('Today', LucideIcons.sunMoon300, LucideIcons.sunMoon),
  MmTab('Practice', LucideIcons.penLine300, LucideIcons.penLine),
  MmTab('Review', LucideIcons.listChecks300, LucideIcons.listChecks),
];

/// The semantic name of a tab: "Practice, tab 2 of 3". "Selected" comes from the selected flag.
String tabSemanticsLabel(int index, {bool newResult = false}) {
  final base = '${kMmTabs[index].label}, tab ${index + 1} of ${kMmTabs.length}';
  return newResult ? '$base, new result' : base;
}
