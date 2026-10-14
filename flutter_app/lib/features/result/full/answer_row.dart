import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answer_items.dart';

/// One answer of the full result: a collapsed header (bubble, number, verdict in words, chapter)
/// that opens to the question, the options with the student's choice and, only where the key rule
/// allows, the correct option and the explanation. Solid and calm: the work layer.
class AnswerRow extends StatefulWidget {
  const AnswerRow({super.key, required this.item, required this.expanded, required this.onToggle, required this.keysOff, this.onRepair});

  final AnswerItem item;
  final bool expanded;
  final VoidCallback onToggle;

  /// `answerReviewState == 'unavailable'`, or the detail could not be read.
  final bool keysOff;
  final VoidCallback? onRepair;

  @override
  State<AnswerRow> createState() => _AnswerRowState();
}

class _AnswerRowState extends State<AnswerRow> {
  /// True once the student has opened this row by a tap. A row that is open when the page
  /// arrives (the first wrong answer, a linked question) rides the page's own entrance instead.
  bool _tapped = false;

  AnswerItem get item => widget.item;

  @override
  void didUpdateWidget(AnswerRow old) {
    super.didUpdateWidget(old);
    if (!old.expanded && widget.expanded) _tapped = true;
  }

  String get _status => switch (item.verdict) {
    Verdict.correct => ResultCopy.statusCorrect,
    Verdict.wrong => ResultCopy.statusWrong,
    Verdict.blank => ResultCopy.statusBlank,
    Verdict.held => ResultCopy.statusHeld,
  };

  BubbleState get _bubble => switch (item.verdict) {
    Verdict.correct => BubbleState.filled,
    Verdict.wrong => BubbleState.wrong,
    Verdict.blank => BubbleState.blank,
    Verdict.held => BubbleState.marked,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapter = item.question.chapter;
    final expanded = widget.expanded;
    final header = MmPressable(
      onTap: widget.onToggle,
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: '${ResultCopy.question(item.number)}, $_status${chapter == null ? '' : ', $chapter'}',
      selected: expanded,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 60),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              Bubble(state: _bubble, size: 22, animate: false),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The group header above already says wrong, not attempted, correct or being checked,
                    // and the bubble shows it, so the row names only its question. TalkBack still hears
                    // the verdict (semantics label above).
                    Text(ResultCopy.question(item.number), style: type.subhead.copyWith(fontSize: 16)),
                    if (chapter != null) Text(chapter, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              AnimatedRotation(
                turns: expanded ? 0.5 : 0,
                duration: Motion.of(context, Motion.ui),
                curve: Motion.out,
                child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
              ),
            ],
          ),
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        // The answer opens in place (no animated height in the scrolling list); after a tap its
        // body fades and rises into the space once, under its header.
        if (expanded)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s20),
            child: _tapped
                ? MmEntrance(rise: 8, child: _Body(item: item, keysOff: widget.keysOff, onRepair: widget.onRepair))
                : _Body(item: item, keysOff: widget.keysOff, onRepair: widget.onRepair),
          ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.item, required this.keysOff, this.onRepair});

  final AnswerItem item;
  final bool keysOff;
  final VoidCallback? onRepair;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = item.question;
    final note = item.verdict == Verdict.held
        ? ResultCopy.keyHeld
        : keysOff
        ? ResultCopy.keysOff
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (q.passageText != null && q.passageText!.trim().isNotEmpty) ...[
          // Nested in the answer: a sunken well, never a third border.
          MmSurface.inset(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ResultCopy.passage, style: type.label.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s4),
                Text(q.passageText!, style: type.body.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
        ],
        Text(q.question, style: type.question),
        if (q.body != null && q.body!.trim().isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          Text(q.body!, style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        for (var i = 0; i < q.options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          _Option(
            letter: q.options[i].key,
            text: q.options[i].text,
            mine: item.given == i,
            mineWrong: item.given == i && item.verdict == Verdict.wrong,
            isKey: !keysOff && item.keyIndex == i,
          ),
        ],
        if (item.verdict == Verdict.blank) ...[
          const SizedBox(height: MmSpace.s12),
          Text(ResultCopy.didNotAnswer, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (item.changed) ...[
          const SizedBox(height: MmSpace.s8),
          Text(ResultCopy.changedAnswer, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (note != null) ...[const SizedBox(height: MmSpace.s12), Text(note, style: type.small.copyWith(color: colors.ink2))],
        if (!keysOff && item.explanation != null && item.explanation!.trim().isNotEmpty) ...[
          const SizedBox(height: MmSpace.s16),
          Text(ResultCopy.explanation, style: type.label.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
          Text(item.explanation!, style: type.body),
        ],
        if (item.repaired) ...[
          const SizedBox(height: MmSpace.s12),
          ReceiptLine(text: ResultCopy.repaired),
        ] else if (onRepair != null) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: ResultCopy.repairThis, onPressed: onRepair, expanded: false),
        ],
      ],
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({required this.letter, required this.text, required this.mine, required this.mineWrong, required this.isKey});

  final String letter;
  final String text;
  final bool mine;
  final bool mineWrong;
  final bool isKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = isKey ? BubbleState.filled : (mineWrong ? BubbleState.wrong : (mine ? BubbleState.marked : BubbleState.hollow));
    final tags = [if (mine) ResultCopy.yourAnswer, if (isKey) ResultCopy.correctAnswer];
    final border = isKey ? colors.ink2 : (mineWrong ? colors.wrongBorder : colors.line);
    return Semantics(
      container: true,
      label: '$letter. $text${tags.isEmpty ? '' : '. ${tags.join('. ')}'}',
      excludeSemantics: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: MmTarget.option),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
        decoration: ShapeDecoration(
          color: mineWrong ? colors.wrongSurface : colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.keyAll,
            side: BorderSide(color: border, width: isKey || mineWrong ? 1.5 : 1),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Bubble(state: state, size: 20, animate: false),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$letter. $text', style: type.body.copyWith(color: mineWrong ? colors.wrongText : colors.ink)),
                  if (tags.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(tags.join('. '), style: type.label.copyWith(color: mineWrong ? colors.wrongText : colors.ink2)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
