import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
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
///
/// Tap the header to open how it compares: the best fit says how the ranking works, every other
/// card says, from the real counts, what it opens more or fewer of than the best.
class ComboCard extends ConsumerStatefulWidget {
  const ComboCard({super.key, required this.combo, required this.rank, required this.catalog, required this.targetCount, this.best, this.inked = true});

  final DuCombo combo;
  final int rank;
  final DuCatalog catalog;
  final int targetCount;

  /// The top-ranked combination, for the "Compared with best" line; null on the best card itself.
  final DuCombo? best;

  /// False draws the card's answer bubble hollow, so it can ink in as the card lands.
  final bool inked;

  @override
  ConsumerState<ComboCard> createState() => _ComboCardState();
}

class _ComboCardState extends ConsumerState<ComboCard> {
  bool _expanded = false;

  DuCombo get combo => widget.combo;
  int get rank => widget.rank;
  DuCatalog get catalog => widget.catalog;
  int get targetCount => widget.targetCount;
  bool get inked => widget.inked;

  String get _detail {
    final best = widget.best;
    if (best == null || rank == 0) return ComboWords.rankRule;
    return ComboWords.comparedWithBest(
      targetsMet: combo.met.length,
      bestTargetsMet: best.met.length,
      programmes: combo.unlocked,
      bestProgrammes: best.unlocked,
      papers: combo.items.length,
      bestPapers: best.items.length,
      hasTargets: targetCount > 0,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final best = rank == 0;
    return ToolsCard(
      lit: best,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: _expanded,
            label: _expanded ? ComboWords.collapse : ComboWords.expand,
            excludeSemantics: false,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _expanded = !_expanded),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: MmTarget.min),
                child: Row(
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
                child: best
                    // The best combination wears the volt: a filled tag, the card's lit edge and the one volt key.
                    ? Align(
                        alignment: Alignment.centerLeft,
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
                            child: Text(ToolsCopy.bestFit, style: type.labelLarge.copyWith(fontSize: 13, color: colors.voltInk)),
                          ),
                        ),
                      )
                    : Text(ToolsCopy.option(rank + 1), style: type.labelLarge.copyWith(color: colors.ink2)),
              ),
              Text(ToolsCopy.papers(combo.items.length), style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(width: MmSpace.s8),
              AnimatedRotation(
                turns: _expanded ? 0.5 : 0,
                duration: Motion.of(context, Motion.ui),
                curve: Motion.glide,
                child: Icon(LucideIcons.chevronDown, size: 16, color: colors.ink3),
              ),
            ],
          ),
              ),
            ),
          ),
          AnimatedSize(
            duration: Motion.of(context, Motion.ui),
            curve: Motion.glide,
            alignment: Alignment.topCenter,
            child: _expanded
                ? Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s4),
                    child: Text(_detail, style: type.caption.copyWith(color: colors.ink2)),
                  )
                : const SizedBox(width: double.infinity),
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
          const SizedBox(height: MmSpace.s16),
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
            const SizedBox(height: MmSpace.s16),
            Row(
              children: [
                Icon(LucideIcons.check, size: 14, color: colors.goodText),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(ToolsCopy.meetsEvery, style: type.caption.copyWith(color: colors.goodText))),
              ],
            ),
          ],
          const SizedBox(height: MmSpace.s20),
          // The best combination's key is the volt one; the others are the quiet outline.
          if (best)
            KeyButton(label: ToolsCopy.seeInCompass, onPressed: () => _open(context, ref))
          else
            KeyButton.secondary(label: ToolsCopy.seeInCompass, onPressed: () => _open(context, ref)),
        ],
      ),
    );
  }

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    // Shown, not saved: the student's own Compass subjects stay as they are.
    ref.read(compassControllerProvider.notifier).showCombination(combo.selection);
    try {
      await ref.read(compassControllerProvider.future);
    } on Object {
      // Compass opens on its own load-failed state with Try again, and shows this
      // combination once it loads.
    }
    if (context.mounted) await context.push(ToolsPaths.compass);
  }
}

/// "3 of 6" with the first figure rolling up from 0 and a 4 dp bar filling to the same share
/// (450 ms on Emphasized). Both are the real counts; under reduced motion they are simply drawn.
class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.a, required this.b});

  final String label;
  final int a;
  final int b;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final share = b <= 0 ? 0.0 : (a / b).clamp(0.0, 1.0);
    final reduced = Motion.reduced(context);
    final figure = type.figureCompact.copyWith(fontSize: 44, height: 1);
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s4),
          Text.rich(
            TextSpan(children: [
              WidgetSpan(
                alignment: PlaceholderAlignment.baseline,
                baseline: TextBaseline.alphabetic,
                child: reduced ? Text('$a', style: figure) : MmCountUp(value: a, style: figure, semanticsLabel: '$a'),
              ),
              TextSpan(text: ' of $b', style: type.labelLarge.copyWith(color: colors.ink2)),
            ]),
          ),
          const SizedBox(height: MmSpace.s8),
          ExcludeSemantics(child: _FigureBar(share: share, reduced: reduced)),
        ],
      ),
    );
  }
}

class _FigureBar extends StatelessWidget {
  const _FigureBar({required this.share, required this.reduced});

  final double share;
  final bool reduced;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final fill = colors.isNight ? colors.volt : colors.accentText;
    Widget bar(double f) => SizedBox(
          height: 4,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: colors.lineStrong),
                FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: f.clamp(0.0, 1.0), child: ColoredBox(color: fill)),
              ],
            ),
          ),
        );
    if (reduced) return bar(share);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: share),
      duration: Motion.drawIn,
      curve: Motion.emphasized,
      builder: (context, f, _) => bar(f),
    );
  }
}
