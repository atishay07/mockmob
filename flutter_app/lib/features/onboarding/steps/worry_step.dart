import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../choices_copy.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/choice_tile.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';
import '../widgets/glyphs.dart';

/// Step 6: where the marks go, in the student's words. Six tiles, two columns, each with the
/// picture of its worry in a lamp-lit medallion. Up to three picks (owner, 18 Oct, D45): each
/// chosen tile says its place (First, Second, Third), a fourth tap swaps out the oldest with a
/// light hint, and the guide Mobi answers the newest pick. The first pick is the primary: it
/// rewrites the first move on the sheet above.
class WorryStep extends ConsumerStatefulWidget {
  const WorryStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  ConsumerState<WorryStep> createState() => _WorryStepState();
}

class _WorryStepState extends ConsumerState<WorryStep> {
  /// The swap hint shows after a fourth pick, until the next tap.
  bool _swapped = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final worries = widget.answers.worries;
    Widget tile(int i) {
      final w = Worry.values[i];
      final rank = worries.indexOf(w);
      return EntranceItem.answer(
        i,
        child: _WorryTile(
          worry: w,
          rank: rank < 0 ? null : rank,
          onTap: () {
            final swapped = ref.read(onboardingAnswersProvider.notifier).toggleWorry(w);
            setState(() => _swapped = swapped);
          },
        ),
      );
    }

    return StepLayout(
      title: OnboardingCopy.worryTitle,
      support: ChoicesCopy.worrySupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < Worry.values.length; i += 2) ...[
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: tile(i)),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: i + 1 < Worry.values.length ? tile(i + 1) : const SizedBox()),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s12),
          ],
          // Always laid out, so the hint never pushes the tiles; read out when it appears.
          Semantics(
            liveRegion: true,
            child: AnimatedOpacity(
              opacity: _swapped ? 1 : 0,
              duration: Motion.of(context, Motion.ui),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.info, size: 16, color: colors.ink2)),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(child: Text(_swapped ? ChoicesCopy.worrySwapped : '', style: context.mmType.small.copyWith(color: colors.ink2))),
                ],
              ),
            ),
          ),
        ],
      ),
      bottom: KeyButton(label: OnboardingCopy.next, onPressed: worries.isEmpty ? null : widget.onNext),
    );
  }
}

class _WorryTile extends StatelessWidget {
  const _WorryTile({required this.worry, required this.rank, required this.onTap});

  final Worry worry;

  /// 0 for the first pick, 1 and 2 after; null when not picked.
  final int? rank;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final selected = rank != null;
    final glyphColor = selected ? colors.ink : colors.ink2;
    final glyph = switch (worry) {
      // The ink in the bubble is a fill: volt in both themes, held by the ink ring (SPACING.md 8.3).
      Worry.knewIt => TrapGlyph(size: 22, color: glyphColor, mark: colors.volt),
      Worry.time => Icon(LucideIcons.timer, size: 21, color: glyphColor),
      Worry.numericals => Icon(LucideIcons.calculator, size: 21, color: glyphColor),
      Worry.passages => Icon(LucideIcons.bookOpenText, size: 21, color: glyphColor),
      Worry.syllabus => Icon(LucideIcons.layers, size: 21, color: glyphColor),
      Worry.noIdea => Icon(LucideIcons.circleHelp, size: 21, color: glyphColor),
    };
    return ChoiceTile(
      selected: selected,
      exclusive: false,
      onTap: onTap,
      semanticsLabel: selected ? '${worry.option}, ${ChoicesCopy.worryRank(rank!)}' : worry.option,
      minHeight: 124,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s12, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GlyphMedallion(size: 44, lit: selected, child: glyph),
          const SizedBox(height: MmSpace.s12),
          Text(worry.option, style: type.labelLarge.copyWith(height: 20 / 15, color: selected ? colors.ink : colors.ink2)),
          if (selected) ...[
            const SizedBox(height: MmSpace.s4),
            Text(ChoicesCopy.worryRank(rank!), style: type.caption.copyWith(color: colors.accentText, fontWeight: FontWeight.w600)),
          ],
        ],
      ),
    );
  }
}
