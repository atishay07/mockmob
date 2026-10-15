import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../you/widgets/you_row.dart' show YouPanel, YouRow;
import '../compass/compass_controller.dart';
import '../copy.dart';
import '../tools_paths.dart';
import '../widgets/tools_page.dart' show ToolsLinkRow;
import '../widgets/tools_parts.dart' show ToolsFlatList;

/// Where the hairlines of a flat list start: past the 4 dp edge, the 28 dp bare icon and 16 dp.
const double _flatInset = 28 + MmSpace.s16;

/// The CUET tools group for You (replaces the two Custom Tab rows): Compass with what the
/// student's subjects open once known, the Combo planner and the 2027 guide, all native. Place
/// it under a "CUET tools" heading; it is a flat list on the ground and brings its own gutter.
class ToolsShelf extends ConsumerWidget {
  const ToolsShelf({super.key, this.showAll = true});

  /// Adds a last row into the tools hub.
  final bool showAll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(compassControllerProvider).value;
    final opens = s == null || s.selection.isEmpty ? null : '${s.eligible.length} of ${s.total}';
    // A flat list on the ground, like Progress above it on You: no panel, hairlines between.
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(
          flat: true,
          icon: LucideIcons.compass,
          title: ToolsCopy.compassTitle,
          note: ToolsCopy.compassQuestion,
          value: opens,
          onTap: () => context.push(ToolsPaths.compass),
        ),
        YouRow(flat: true, icon: LucideIcons.layoutGrid, title: ToolsCopy.comboTitle, note: ToolsCopy.comboNote, onTap: () => context.push(ToolsPaths.combo)),
        YouRow(flat: true, icon: LucideIcons.calendarRange, title: ToolsCopy.guideTitle, note: ToolsCopy.guideNote, onTap: () => context.push(ToolsPaths.guide2027)),
        if (showAll) YouRow(flat: true, icon: LucideIcons.wrench, title: ToolsCopy.allToolsRow, onTap: () => context.push(ToolsPaths.hub)),
      ],
    );
  }
}

/// The CUET tools on Today: Admission Compass with what the student's subjects open (live, once the
/// DU data is on the phone), and a row into all the tools. Two flat rows that bring no gutter of
/// their own; Today places them.
class ToolsQuietLink extends ConsumerWidget {
  const ToolsQuietLink({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(compassControllerProvider).value;
    final known = s != null && !s.selection.isEmpty;
    return ToolsFlatList(
      margin: EdgeInsets.zero,
      children: [
        ToolsLinkRow(
          flat: true,
          icon: LucideIcons.compass,
          title: ToolsCopy.compassTitle,
          note: known ? ToolsCopy.todayCompassNote(s.eligible.length, s.total) : ToolsCopy.compassQuestion,
          onTap: () => context.push(ToolsPaths.compass),
        ),
        ToolsLinkRow(
          flat: true,
          icon: LucideIcons.wrench,
          title: ToolsCopy.allToolsRow,
          note: ToolsCopy.allToolsNote,
          onTap: () => context.push(ToolsPaths.hub),
        ),
      ],
    );
  }
}
