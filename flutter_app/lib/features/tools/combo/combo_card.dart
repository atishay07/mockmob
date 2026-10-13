import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../compass/compass_controller.dart';
import '../copy.dart';
import '../domain/du_combos.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_models.dart';
import '../tools_paths.dart';
import '../widgets/tools_card.dart';

/// One ranked combination: the papers, numbered (what goes on the form), how many of the
/// targets and of all DU programmes it opens, what each missed target still needs, and the way
/// into Compass with exactly these subjects.
class ComboCard extends ConsumerWidget {
  const ComboCard({super.key, required this.combo, required this.rank, required this.catalog, required this.targetCount, this.inked = true});

  final DuCombo combo;
  final int rank;
  final DuCatalog catalog;
  final int targetCount;

  /// False draws the card's answer bubble hollow, so it can ink in as the card lands.
  final bool inked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final best = rank == 0;
    return ToolsCard(
      lit: best,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              // The bubble is a state: inked when this combination reaches every target.
              if (targetCount > 0) ...[
                Bubble(
                  state: inked && combo.missed.isEmpty ? BubbleState.filled : BubbleState.hollow,
                  size: 14,
                  semanticsLabel: combo.missed.isEmpty ? ToolsCopy.meetsEvery : ToolsCopy.missesATarget,
                ),
                const SizedBox(width: MmSpace.s8),
              ],
              Expanded(
                child: Text(
                  best ? ToolsCopy.bestFit : ToolsCopy.option(rank + 1),
                  style: type.labelLarge.copyWith(color: best ? colors.accentText : colors.ink2),
                ),
              ),
              Text(ToolsCopy.papers(combo.items.length), style: type.caption.copyWith(color: colors.ink2)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          // The papers in form order, numbered: the number is the paper count, not decoration.
          for (final (i, item) in combo.items.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  SizedBox(
                    width: 22,
                    child: Text(
                      '${i + 1}',
                      style: type.label.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                  ),
                  Expanded(child: Text(item.name(catalog), style: type.body)),
                ],
              ),
            ),
          const SizedBox(height: MmSpace.s8),
          Row(
            children: [
              if (targetCount > 0) Expanded(child: _Figure(label: ToolsCopy.yourTargets, a: combo.met.length, b: targetCount)),
              Expanded(child: _Figure(label: ToolsCopy.allProgrammes, a: combo.unlocked, b: catalog.groups.length)),
            ],
          ),
          if (combo.missed.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s12),
            for (final m in combo.missed)
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.x, size: 14, color: colors.warnText)),
                    const SizedBox(width: MmSpace.s8),
                    Expanded(
                      child: Text(
                        m.nearest == null
                            ? m.name
                            : ToolsCopy.needs(m.name, [for (final g in m.nearest!.gaps) duDescribeGap(g, catalog).replaceFirst('Add ', '')].join(', ')),
                        style: type.caption.copyWith(color: colors.ink2),
                      ),
                    ),
                  ],
                ),
              ),
          ] else if (targetCount > 0) ...[
            const SizedBox(height: MmSpace.s12),
            Row(
              children: [
                Icon(LucideIcons.check, size: 14, color: colors.goodText),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(ToolsCopy.meetsEvery, style: type.caption.copyWith(color: colors.goodText))),
              ],
            ),
          ],
          const SizedBox(height: MmSpace.s12),
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(
              label: ToolsCopy.seeInCompass,
              onPressed: () async {
                final compass = ref.read(compassControllerProvider.notifier);
                await ref.read(compassControllerProvider.future);
                compass.setSelection(combo.selection);
                if (context.mounted) await context.push(ToolsPaths.compass);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.a, required this.b});

  final String label;
  final int a;
  final int b;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: 2),
          Text.rich(
            TextSpan(children: [
              TextSpan(text: '$a', style: type.figureCompact.copyWith(fontSize: 32, height: 1)),
              TextSpan(text: ' of $b', style: type.label.copyWith(color: colors.ink2)),
            ]),
          ),
        ],
      ),
    );
  }
}
