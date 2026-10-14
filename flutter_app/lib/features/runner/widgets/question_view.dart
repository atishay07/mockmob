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
/// the question, then the options. Solid surfaces only. The pieces arrive together when the
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

  /// The question itself is the hero of the screen: 19/28 at weight 600.
  static TextStyle questionStyle(BuildContext context) {
    final style = context.mmType.question;
    return style.copyWith(fontSize: 19, height: 28 / 19, fontWeight: FontWeight.w600, color: context.mmColors.ink);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final passage = question.passageText;
    final body = question.body;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...?leading,
        EnterItem(
          order: 0,
          child: Row(
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
            child: Text(question.question, style: questionStyle(context)),
          ),
        ),
        if (body != null && body.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          EnterItem(order: 2, child: Text(body, style: type.body.copyWith(color: colors.ink))),
        ],
        const SizedBox(height: MmSpace.s24),
        for (var i = 0; i < question.options.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          EnterItem(
            order: 2 + i,
            child: AnswerOption(
              letter: question.options[i].key,
              text: question.options[i].text,
              selected: selected == i,
              quiet: selected != null && selected != i,
              onSelect: canAnswer ? () => onSelect(i) : null,
              onLock: onLock,
            ),
          ),
        ],
        // Reserve the clear key's height so nothing below jumps when an answer appears.
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48 + MmSpace.s8),
          child: Align(
            alignment: Alignment.bottomLeft,
            child: selected != null && canAnswer
                ? Transform.translate(
                    offset: const Offset(-MmSpace.s4, 0),
                    child: KeyButton.quiet(label: RunnerCopy.clearAnswer, onPressed: () => onSelect(null), hapticOnCommit: false),
                  )
                : const SizedBox.shrink(),
          ),
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
