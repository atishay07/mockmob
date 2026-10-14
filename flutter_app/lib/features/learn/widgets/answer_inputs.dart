import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../models/run_item.dart';

const _letters = ['A', 'B', 'C', 'D', 'E', 'F'];

String _letter(int i) => i < _letters.length ? _letters[i] : '${i + 1}';

class OptionLetter extends StatelessWidget {
  const OptionLetter(this.letter, {super.key});

  final String letter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: colors.lineStrong),
        ),
        child: SizedBox(
          width: 28,
          height: 28,
          child: Center(
            child: Text(
              letter,
              style: context.mmType.label.copyWith(color: colors.ink2),
            ),
          ),
        ),
      ),
    );
  }
}

/// Answer options before the student answers: one is selected, nothing is decided yet.
class LiveOptions extends StatelessWidget {
  const LiveOptions({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final List<String> options;
  final int? selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < options.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s12),
            KeyButton.option(
              label: options[i],
              selected: selected == i,
              leading: OptionLetter(_letter(i)),
              semanticsLabel: 'Option ${_letter(i)}, ${options[i]}',
              onPressed: () => onSelect(i),
            ),
          ],
        ],
      ),
    );
  }
}

/// Answer options after feedback: the right one carries a check and an ink border, a wrong
/// choice carries a cross, "Your answer" and the wrong colours. Never colour alone.
class ResultOptions extends StatelessWidget {
  const ResultOptions({
    super.key,
    required this.options,
    required this.correct,
    required this.chosen,
  });

  final List<String> options;
  final int? correct;
  final int? chosen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s12),
          Builder(
            builder: (context) {
              final isCorrect = i == correct;
              final isWrongPick = i == chosen && !isCorrect;
              final words = isCorrect
                  ? (i == chosen
                        ? LearnCopy.yourAnswer
                        : LearnCopy.correctAnswer)
                  : (isWrongPick ? LearnCopy.yourAnswer : null);
              return Semantics(
                container: true,
                label:
                    'Option ${_letter(i)}, ${options[i]}${words == null ? '' : '. $words'}',
                excludeSemantics: true,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: isWrongPick ? colors.wrongSurface : colors.raised,
                    borderRadius: MmRadius.keyAll,
                    border: Border.all(
                      color: isCorrect
                          ? colors.ink
                          : (isWrongPick ? colors.wrongBorder : colors.line),
                      width: isCorrect || isWrongPick ? 2 : 1,
                    ),
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: MmTarget.option,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: MmSpace.s20,
                        vertical: MmSpace.s12,
                      ),
                      child: Row(
                        children: [
                          OptionLetter(_letter(i)),
                          const SizedBox(width: MmSpace.s12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  options[i],
                                  style: type.body.copyWith(
                                    fontWeight: FontWeight.w500,
                                    color: isWrongPick
                                        ? colors.wrongText
                                        : (isCorrect
                                              ? colors.ink
                                              : colors.ink2),
                                  ),
                                ),
                                if (words != null)
                                  Text(
                                    words,
                                    style: type.small.copyWith(
                                      color: isWrongPick
                                          ? colors.wrongText
                                          : colors.ink2,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (isCorrect)
                            Icon(
                              LucideIcons.check,
                              size: 20,
                              color: colors.ink,
                            ),
                          if (isWrongPick)
                            Icon(
                              LucideIcons.x,
                              size: 20,
                              color: colors.wrongText,
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ],
    );
  }
}

/// A text, numeric or ratio answer. Spelling and gap tasks must not be auto-corrected.
class AnswerField extends StatelessWidget {
  const AnswerField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onSubmitted,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onSubmitted;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(
      borderRadius: MmRadius.keyAll,
      borderSide: BorderSide(color: c, width: w),
    );
    return TextField(
      controller: controller,
      enabled: enabled,
      style: type.question,
      cursorColor: colors.ink,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: TextInputAction.done,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: type.body.copyWith(color: colors.ink3),
        filled: true,
        fillColor: colors.raised,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: MmSpace.s20,
          vertical: MmSpace.s16,
        ),
        enabledBorder: border(colors.lineStrong, 1),
        disabledBorder: border(colors.line, 1),
        focusedBorder: border(colors.ink, 2),
      ),
    );
  }
}

/// What the server said about an answer: correct, not quite or skipped, then what was given,
/// the right answer and why.
class FeedbackPanel extends StatelessWidget {
  const FeedbackPanel({super.key, required this.feedback, required this.item});

  final RunFeedback feedback;
  final RunItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final right = feedback.correct == true;
    final headline = feedback.skipped
        ? LearnCopy.skipped
        : (right ? LearnCopy.correct : LearnCopy.notQuite);
    final showGiven =
        !right &&
        !feedback.skipped &&
        item.type != RunItemType.choice &&
        feedback.given != null;
    final showAnswer =
        !right && feedback.answer != null && item.type != RunItemType.choice;
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: right ? colors.raised2 : colors.wrongSurface,
          borderRadius: MmRadius.panelAll,
          border: Border.all(
            color: right ? colors.lineStrong : colors.wrongBorder,
            width: right ? 1 : 1.5,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(
                    right ? LucideIcons.check : LucideIcons.circleAlert,
                    size: 20,
                    color: right ? colors.ink : colors.wrongText,
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Text(
                    headline,
                    style: type.subhead.copyWith(
                      color: right ? colors.ink : colors.wrongText,
                    ),
                  ),
                ],
              ),
              if (showGiven) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.yourAnswer,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(feedback.given!, style: type.body),
              ],
              if (showAnswer) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.correctAnswer,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(
                  feedback.answer!,
                  style: type.body.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
              if (feedback.whyChosen != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(feedback.whyChosen!, style: type.body),
              ],
              if (feedback.explanation != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  feedback.explanation!,
                  style: type.body.copyWith(color: colors.ink2),
                ),
              ],
              if (feedback.cue != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  LearnCopy.memoryCue,
                  style: type.label.copyWith(color: colors.ink2),
                ),
                Text(feedback.cue!, style: type.body),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
