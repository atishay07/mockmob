import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/choice_tile.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';
import '../widgets/glyphs.dart';

/// Step 6: where the marks go, in the student's words. Six tiles, two columns, each with the
/// picture of its worry in a lamp-lit medallion. The answer rewrites the first move on the sheet
/// above; the guide Mobi thinks it over, then says what happens next.
class WorryStep extends ConsumerWidget {
  const WorryStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final worry = answers.worry;
    Widget tile(int i) {
      final w = Worry.values[i];
      return EntranceItem.answer(
        i,
        child: _WorryTile(
          worry: w,
          selected: worry == w,
          onTap: () => ref.read(onboardingAnswersProvider.notifier).setWorry(w),
        ),
      );
    }

    return StepLayout(
      title: OnboardingCopy.worryTitle,
      support: OnboardingCopy.worrySupport,
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
        ],
      ),
      bottom: KeyButton(label: OnboardingCopy.next, onPressed: worry == null ? null : onNext),
    );
  }
}

class _WorryTile extends StatelessWidget {
  const _WorryTile({required this.worry, required this.selected, required this.onTap});

  final Worry worry;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final glyphColor = selected ? colors.ink : colors.ink2;
    final glyph = switch (worry) {
      Worry.knewIt => TrapGlyph(size: 22, color: glyphColor, mark: colors.isNight ? colors.volt : colors.accentText),
      Worry.time => Icon(LucideIcons.timer, size: 21, color: glyphColor),
      Worry.numericals => Icon(LucideIcons.calculator, size: 21, color: glyphColor),
      Worry.passages => Icon(LucideIcons.bookOpenText, size: 21, color: glyphColor),
      Worry.syllabus => Icon(LucideIcons.layers, size: 21, color: glyphColor),
      Worry.noIdea => Icon(LucideIcons.circleHelp, size: 21, color: glyphColor),
    };
    return ChoiceTile(
      selected: selected,
      onTap: onTap,
      semanticsLabel: worry.option,
      minHeight: 124,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s12, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GlyphMedallion(size: 44, lit: selected, child: glyph),
          const SizedBox(height: MmSpace.s12),
          Text(worry.option, style: type.labelLarge.copyWith(height: 20 / 15, color: selected ? colors.ink : colors.ink2)),
        ],
      ),
    );
  }
}
