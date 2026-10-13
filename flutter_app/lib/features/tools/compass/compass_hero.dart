import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../widgets/action_chip.dart';
import '../widgets/subject_picker_sheet.dart';
import '../widgets/tools_card.dart';
import 'compass_controller.dart';

/// Opens the subject picker wired to Compass.
Future<void> openCompassPicker(BuildContext context, WidgetRef ref, DuCatalog catalog) {
  final controller = ref.read(compassControllerProvider.notifier);
  return showSubjectPicker(
    context: context,
    catalog: catalog,
    watch: (ref) => ref.watch(compassControllerProvider).value?.selection.picks.toSet() ?? const {},
    onToggle: controller.toggle,
    onPreset: controller.applyPreset,
    onClear: controller.clear,
  );
}

/// The focal pane of Compass: how many DU programmes the ticked subjects open (out of all of
/// them), the subjects themselves as inked chips (tap one to take it off), and the key to edit.
/// With nothing ticked it becomes the starting point: the rule of thumb and the presets.
class CompassHero extends ConsumerWidget {
  const CompassHero({super.key, required this.state});

  final CompassState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = state;
    final controller = ref.read(compassControllerProvider.notifier);

    if (s.selection.isEmpty) {
      return ToolsCard(
        lit: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ToolsCopy.emptyHeroTitle, style: type.cardTitle),
            const SizedBox(height: MmSpace.s8),
            Text(ToolsCopy.emptyHeroBody, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            Text(ToolsCopy.quickStart, style: type.caption.copyWith(color: colors.ink3)),
            const SizedBox(height: MmSpace.s4),
            Wrap(
              spacing: MmSpace.s8,
              children: [
                for (final p in duPresets)
                  ToolsActionChip(label: p.label, icon: LucideIcons.zap, onTap: () => controller.applyPreset(p)),
              ],
            ),
            const SizedBox(height: MmSpace.s20),
            KeyButton(label: ToolsCopy.pickSubjects, onPressed: () => openCompassPicker(context, ref, s.catalog)),
          ],
        ),
      );
    }

    final open = s.eligible.length;
    return ToolsCard(
      lit: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MergeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MonumentalNumber(
                  value: '$open',
                  unit: 'of ${s.total}',
                  style: type.figure,
                  semanticsLabel: '$open of ${s.total}',
                ),
                const SizedBox(height: MmSpace.s8),
                Text(ToolsCopy.programmesOpen, style: type.labelLarge),
                const SizedBox(height: 2),
                Text(ToolsCopy.rulesLine, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s16),
          Wrap(
            spacing: MmSpace.s8,
            children: [
              for (final pick in s.selection.picks)
                MmChip(
                  label: pick.name(s.catalog, short: true),
                  selected: true,
                  onTap: () => controller.toggle(pick),
                ),
            ],
          ),
          if (s.seededFromSheet) ...[
            const SizedBox(height: MmSpace.s8),
            Text(ToolsCopy.fromSheet, style: type.caption.copyWith(color: colors.ink2)),
          ],
          if (s.selection.count > 5) ...[
            const SizedBox(height: MmSpace.s12),
            InlineBanner(message: ToolsCopy.overLimit(s.selection.count), tone: BannerTone.warning),
          ],
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(
            label: ToolsCopy.editSubjects,
            expanded: false,
            onPressed: () => openCompassPicker(context, ref, s.catalog),
          ),
        ],
      ),
    );
  }
}
