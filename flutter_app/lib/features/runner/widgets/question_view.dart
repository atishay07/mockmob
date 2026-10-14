import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'answer_option.dart';
import 'question_enter.dart';
import 'runner_controls.dart';

/// The question region (spec 5.5, runner.md 3.4 and 3.5): the passage in its own scrolling well,
/// the question at the top, then the options as the rows of an OMR sheet at the foot. Solid surfaces only. The pieces arrive together when the
/// question does (see [QuestionEnter]) and then nothing moves except the chosen option's ink.
class QuestionView extends StatelessWidget {
  const QuestionView({
    super.key,
    required this.question,
    required this.selected,
    required this.marked,
    required this.canAnswer,
    required this.onSelect,
    required this.onMark,
    this.passageRange,
    this.leading,
    this.note,
    this.onLock,
  });

  final SessionQuestion question;

  /// The chosen option index, or null.
  final int? selected;
  final bool marked;
  final bool canAnswer;

  /// Null clears the answer.
  final ValueChanged<int?> onSelect;
  final ValueChanged<bool> onMark;

  /// "Questions 3 to 6 use this passage."
  final (int, int)? passageRange;

  /// Banners that belong above the question (return after a gap, the practice note).
  final List<Widget>? leading;

  /// One quiet line beside the mark toggle (the practice skin's note).
  final Widget? note;

  /// The global centre of the bubble an answer is about to be chosen on (the lock-in flight).
  final ValueChanged<Offset>? onLock;

  /// The question itself is the hero of the screen: 19/28 at weight 600 for a long stem, and
  /// larger when the stem is short, so a one-line question fills the space it has instead of
  /// leaving a gap above the options.
  static TextStyle questionStyle(BuildContext context, {int length = 200}) {
    final style = context.mmType.question;
    // At large system text the question already grows with it, and the options need the room:
    // the short-stem boost is for the normal size only.
    final large = MediaQuery.textScalerOf(context).scale(1) >= 1.15;
    final size = large
        ? 19.0
        : length <= 60
        ? 30.0
        : length <= 100
        ? 27.0
        : length <= 140
        ? 24.0
        : length <= 200
        ? 21.0
        : 19.0;
    return style.copyWith(fontSize: size, height: size <= 19 ? 28 / 19 : 1.28, fontWeight: FontWeight.w600, color: context.mmColors.ink);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final passage = question.passageText;
    final body = question.body;

    final rule = ColoredBox(color: colors.line, child: const SizedBox(height: 1));
    // On a tall screen the options grow (60 dp up to 78 dp), so the gap between a short question
    // and its options is spent on bigger keys, not left as air. 640 dp and shorter keeps 60.
    final screen = MediaQuery.sizeOf(context).height;
    final optionHeight = (60 + (screen - 700) * 0.12).clamp(60.0, 78.0);

    // The question sits at the top and the options at the foot, next to the thumb and the bottom
    // bar: on a short question the space between them is air, not a dead lower third. The layout
    // gives this column at least the height of the screen (see RunnerLayout), and the gap is
    // whatever is left over.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ...?leading,
            EnterItem(
              order: 0,
              // From 1.15x text the note would wrap beside the toggle: it takes a line above it.
              child: note != null && MediaQuery.textScalerOf(context).scale(1) >= 1.15
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        note!,
                        Align(
                          alignment: Alignment.centerRight,
                          child: MarkToggle(marked: marked, onChanged: onMark),
                        ),
                      ],
                    )
                  : Row(
                      children: [
                        Expanded(child: note ?? const SizedBox.shrink()),
                        const SizedBox(width: MmSpace.s8),
                        MarkToggle(marked: marked, onChanged: onMark),
                      ],
                    ),
            ),
            if (passage != null && passage.isNotEmpty) ...[
              EnterItem(order: 1, child: _PassageWell(text: passage, range: passageRange)),
              const SizedBox(height: MmSpace.s20),
            ] else
              const SizedBox(height: MmSpace.s4),
            EnterItem(
              order: 1,
              child: Semantics(
                header: true,
                child: Text(
                  question.question,
                  // A passage question keeps the standard size: the passage is the long read.
                  style: questionStyle(context, length: passage != null && passage.isNotEmpty ? 200 : question.question.length),
                ),
              ),
            ),
            if (body != null && body.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s12),
              EnterItem(order: 2, child: Text(body, style: type.body.copyWith(color: colors.ink))),
            ],
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MmSpace.s24),
            // The options are the rows of an OMR sheet: hairline rules between them, no boxes.
            EnterItem(order: 2, child: rule),
            for (var i = 0; i < question.options.length; i++)
              EnterItem(
                order: 2 + i,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AnswerOption(
                      letter: question.options[i].key,
                      text: question.options[i].text,
                      selected: selected == i,
                      onSelect: canAnswer ? () => onSelect(i) : null,
                      onLock: onLock,
                      minHeight: optionHeight,
                    ),
                    rule,
                  ],
                ),
              ),
            // Reserve the clear key's height so nothing below jumps when an answer appears.
            ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min + MmSpace.s12 * 2),
              child: Align(
                alignment: Alignment.centerLeft,
                child: selected != null && canAnswer
                    ? KeyButton.secondary(
                        label: RunnerCopy.clearAnswer,
                        onPressed: () => onSelect(null),
                        expanded: false,
                        minHeight: MmTarget.min,
                        hapticOnCommit: false,
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A long passage scrolls inside its own well, at most 40% of the screen, so the question and
/// options stay within reach.
class _PassageWell extends StatelessWidget {
  const _PassageWell({required this.text, this.range});

  final String text;
  final (int, int)? range;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.4;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.sunken,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.keyAll,
          side: BorderSide(color: colors.line),
        ),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Scrollbar(
          child: SingleChildScrollView(
            primary: false,
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(LucideIcons.bookOpen, size: 14, color: colors.ink3),
                    const SizedBox(width: MmSpace.s6),
                    Expanded(
                      child: Text(
                        range == null ? RunnerCopy.passage : '${RunnerCopy.passage}. ${RunnerCopy.passageRange(range!.$1, range!.$2)}',
                        style: type.caption.copyWith(color: colors.ink3),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                Text(text, style: type.body.copyWith(color: colors.ink)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
