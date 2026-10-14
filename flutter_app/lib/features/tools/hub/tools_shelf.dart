import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show MmPressable;
import '../compass/compass_controller.dart';
import '../copy.dart';
import '../tools_paths.dart';
import '../widgets/tools_page.dart';

/// The CUET tools group for You (replaces the two Custom Tab rows): Compass with what the
/// student's subjects open once known, the Combo planner and the 2027 guide, all native. Place
/// it under a "CUET tools" heading; it brings its own panel and gutter.
class ToolsShelf extends ConsumerWidget {
  const ToolsShelf({super.key, this.showAll = true});

  /// Adds a last row into the tools hub.
  final bool showAll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(compassControllerProvider).value;
    final opens = s == null || s.selection.isEmpty ? null : '${s.eligible.length} of ${s.total}';
    return YouPanel(
      inset: 64,
      children: [
        YouRow(
          icon: LucideIcons.compass,
          title: ToolsCopy.compassTitle,
          note: ToolsCopy.compassQuestion,
          value: opens,
          onTap: () => context.push(ToolsPaths.compass),
        ),
        YouRow(icon: LucideIcons.layoutGrid, title: ToolsCopy.comboTitle, note: ToolsCopy.comboNote, onTap: () => context.push(ToolsPaths.combo)),
        YouRow(icon: LucideIcons.calendarRange, title: ToolsCopy.guideTitle, note: ToolsCopy.guideNote, onTap: () => context.push(ToolsPaths.guide2027)),
        if (showAll) YouRow(icon: LucideIcons.wrench, title: 'All CUET tools', onTap: () => context.push(ToolsPaths.hub)),
      ],
    );
  }
}

/// The way into Compass under Today's road to May: a plain list row (icon, title, chevron).
class ToolsQuietLink extends StatelessWidget {
  const ToolsQuietLink({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: ToolsCopy.compassQuestion,
      onTap: () => context.push(ToolsPaths.compass),
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: Row(
            children: [
              Icon(LucideIcons.compass, size: 20, color: colors.ink2),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(ToolsCopy.compassQuestion, style: type.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600))),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
