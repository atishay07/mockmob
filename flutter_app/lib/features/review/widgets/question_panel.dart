import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The question as it was answered, on solid ground (the work layer never has art behind
/// reading): an optional passage, the question, and the options with the student's answer and
/// the correct one marked by bubble, word and surface, never colour alone.
class QuestionPanel extends StatelessWidget {
  const QuestionPanel({super.key, required this.question, this.chosen, this.keyIndex, this.showKey = true});

  final SnapshotQuestion question;
  final int? chosen;

  /// The correct option, or null when no key may be shown (spec 5.7 key rule).
  final int? keyIndex;
  final bool showKey;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final passage = question.passageText?.trim();
    final body = question.body?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (passage != null && passage.isNotEmpty) ...[PassageBlock(text: passage), const SizedBox(height: MmSpace.s16)],
        Text(question.question, style: type.question),
        if (body != null && body.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          Text(body, style: type.body.copyWith(color: context.mmColors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        for (var i = 0; i < question.options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          MarkedOption(letter: question.options[i].key, text: question.options[i].text, mark: _markFor(i)),
        ],
      ],
    );
  }

  OptionMark _markFor(int i) {
    final isKey = showKey && keyIndex == i;
    if (isKey) return OptionMark.correct;
    if (chosen == i) return OptionMark.yours;
    return OptionMark.none;
  }
}

enum OptionMark { none, yours, correct }

/// One option row with its mark.
class MarkedOption extends StatelessWidget {
  const MarkedOption({super.key, required this.letter, required this.text, this.mark = OptionMark.none});

  final String letter;
  final String text;
  final OptionMark mark;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (fill, border, bubble, word) = switch (mark) {
      OptionMark.yours => (colors.wrongSurface, colors.wrongBorder, BubbleState.wrong, ReviewCopy.yourAnswer),
      OptionMark.correct => (colors.raised, colors.isNight ? colors.ink2 : colors.ink, BubbleState.filled, ReviewCopy.correctAnswer),
      OptionMark.none => (colors.raised, colors.line, BubbleState.hollow, null),
    };
    final textColor = mark == OptionMark.yours ? colors.wrongText : (mark == OptionMark.none ? colors.ink2 : colors.ink);
    return Semantics(
      container: true,
      label: 'Option $letter, $text${word == null ? '' : ', $word'}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: fill,
          shape: mmShapeBorder(
            MmRadius.keyAll,
            side: BorderSide(color: border, width: mark == OptionMark.none ? 1 : 1.5),
          ),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.option),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: SizedBox.square(
                    dimension: 22,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Bubble(state: bubble, size: 22, animate: false),
                        if (bubble == BubbleState.hollow)
                          Text(letter, style: type.label.copyWith(fontSize: 11, height: 1, color: colors.ink2)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(text, style: type.body.copyWith(color: textColor)),
                      if (word != null) ...[
                        const SizedBox(height: 4),
                        Text(word, style: type.label.copyWith(color: mark == OptionMark.yours ? colors.wrongText : colors.ink)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A reading passage, folded to a few lines until opened.
class PassageBlock extends StatefulWidget {
  const PassageBlock({super.key, required this.text});

  final String text;

  @override
  State<PassageBlock> createState() => _PassageBlockState();
}

class _PassageBlockState extends State<PassageBlock> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.sunken,
        shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s8, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(ReviewCopy.passage, style: type.label.copyWith(color: colors.ink2)),
                ),
                IconButton(
                  onPressed: () => setState(() => _open = !_open),
                  tooltip: _open ? 'Fold the passage' : 'Open the passage',
                  icon: AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: Motion.of(context, Motion.ui),
                    child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
                  ),
                ),
              ],
            ),
            AnimatedSize(
              duration: Motion.of(context, Motion.card),
              curve: Motion.emphasized,
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(right: MmSpace.s8),
                child: Text(
                  widget.text,
                  style: type.body.copyWith(color: colors.ink),
                  maxLines: _open ? null : 4,
                  overflow: _open ? TextOverflow.visible : TextOverflow.fade,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
