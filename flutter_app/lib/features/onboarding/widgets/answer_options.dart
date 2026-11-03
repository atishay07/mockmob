import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/sample_questions.dart';

/// The four answer keys of a sample question. Before an answer they are live option keys. After
/// one, the chosen key stays flush, the others recede, and when [revealCorrect] the right answer
/// is marked, all with a glyph or a word as well as colour (spec 5.1.3).
class AnswerOptions extends StatelessWidget {
  const AnswerOptions({
    super.key,
    required this.question,
    required this.chosenKey,
    required this.onChoose,
    this.receded = true,
    this.revealCorrect = true,
  });

  final SampleQuestion question;

  /// Null until the student answers.
  final String? chosenKey;
  final ValueChanged<String> onChoose;

  /// The other keys have faded back (90 ms after the choice).
  final bool receded;

  /// The right answer is marked (when the reason panel starts to rise).
  final bool revealCorrect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final option in question.options) ...[
          if (chosenKey == null)
            KeyButton.option(
              label: option.text,
              selected: false,
              leading: KeyChip(letter: option.key),
              semanticsLabel: OnboardingCopy.optionLabel(option.key, option.text),
              onPressed: () => onChoose(option.key),
            )
          else
            _ResolvedOption(
              option: option,
              isChosen: option.key == chosenKey,
              isCorrect: option.key == question.correctKey,
              receded: receded,
              revealCorrect: revealCorrect,
            ),
          const SizedBox(height: MmSpace.s12),
        ],
      ],
    );
  }
}

/// What the letter chip shows: the letter, a check or a cross.
enum ChipMark { letter, right, wrong }

/// The letter chip at the start of an option, or the mark that replaces it after resolution.
class KeyChip extends StatelessWidget {
  const KeyChip({super.key, required this.letter, this.mark = ChipMark.letter});

  final String letter;
  final ChipMark mark;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (Color fill, Color edge, Widget child) = switch (mark) {
      ChipMark.right => (colors.ink, colors.ink, Icon(LucideIcons.check, size: 18, color: colors.ground)),
      ChipMark.wrong => (colors.wrongSurface, colors.wrongBorder, Icon(LucideIcons.x, size: 18, color: colors.wrongText)),
      ChipMark.letter => (colors.raised2, colors.line, Text(letter, style: type.label.copyWith(color: colors.ink2))),
    };
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(color: fill, borderRadius: MmRadius.smallAll, border: Border.all(color: edge)),
        child: SizedBox.square(dimension: 30, child: Center(child: child)),
      ),
    );
  }
}

class _ResolvedOption extends StatelessWidget {
  const _ResolvedOption({
    required this.option,
    required this.isChosen,
    required this.isCorrect,
    required this.receded,
    required this.revealCorrect,
  });

  final SampleOption option;
  final bool isChosen;
  final bool isCorrect;
  final bool receded;
  final bool revealCorrect;

  bool get _showRight => isCorrect && (isChosen || revealCorrect);

  String get _semantics {
    final base = OnboardingCopy.optionLabel(option.key, option.text);
    final parts = <String>[
      if (isChosen) OnboardingCopy.semanticsYourAnswer,
      if (isChosen) (isCorrect ? OnboardingCopy.semanticsCorrect : OnboardingCopy.semanticsWrong),
      if (!isChosen && _showRight) OnboardingCopy.semanticsCorrectAnswer,
    ];
    return parts.isEmpty ? base : '$base. ${parts.join('. ')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final mark = _showRight ? ChipMark.right : (isChosen ? ChipMark.wrong : ChipMark.letter);

    // Chosen and right: flush with an ink border and a check chip. Chosen and wrong: flush with a
    // wrong-coloured border and a cross chip. The right answer shown after a miss: flush with a
    // check chip. The rest flatten to flush (the lip goes) but keep their full-strength text, so
    // the student can still read why each one was or was not the answer.
    final flush = isChosen || _showRight || receded;

    Widget face = KeyButtonFace(
      label: option.text,
      variant: KeyVariant.option,
      depth: flush ? 1 : 0,
      leading: KeyChip(letter: option.key, mark: mark),
    );
    if (isChosen) {
      face = DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          borderRadius: MmRadius.keyAll,
          border: Border.all(color: isCorrect ? colors.ink : colors.wrongBorder, width: 2),
        ),
        child: face,
      );
    }

    return Semantics(
      container: true,
      label: _semantics,
      selected: isChosen,
      inMutuallyExclusiveGroup: true,
      excludeSemantics: true,
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.release),
        switchInCurve: Motion.out,
        child: KeyedSubtree(key: ValueKey('$flush-$_showRight'), child: face),
      ),
    );
  }
}
