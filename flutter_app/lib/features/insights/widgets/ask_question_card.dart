import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/ask_question.dart';

/// The mistake Ask was handed from a repair ("Ask Mobi about Q3"): what Mobi will see, in the
/// student's own words, so a reply about it never arrives about something else. A hairline panel,
/// no side stripe. One way out, which drops the question: "Ask something else", and when written
/// replies cannot be bought "Ask about my record" under the one line that says Mobi cannot answer
/// this question and that nothing was charged. It never says the question can be asked about for
/// free: a record answer cannot discuss a question.
class AskQuestionCard extends StatelessWidget {
  const AskQuestionCard({super.key, required this.hand, required this.blocked, required this.onDrop});

  final AskQuestionHand hand;

  /// Written replies are paused, out, or unreadable: Mobi cannot answer the question.
  final bool blocked;
  final VoidCallback onDrop;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ctx = hand.context;

    Widget panel(List<Widget> children, {String? label}) => Semantics(
          container: true,
          liveRegion: true,
          label: label,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: colors.raised,
              shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
            ),
          ),
        );

    if (hand.loading) {
      return Semantics(liveRegion: true, child: Text(InsightsCopy.questionOpening, style: type.small.copyWith(color: colors.ink2)));
    }
    if (hand.status == AskQuestionStatus.error || ctx == null) {
      return panel([
        Text(hand.message ?? askQuestionOpenFailed, style: type.labelLarge.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: MmSpace.s4),
        Text(InsightsCopy.questionErrorHelp, style: type.small.copyWith(color: colors.ink2)),
        _drop(InsightsCopy.questionAskRecord),
      ]);
    }
    final cut = ctx.question.length >= 160 ? '...' : '';
    return panel(
      [
        Text(InsightsCopy.questionCardTitle(ctx.chapter), style: type.labelLarge.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: MmSpace.s8),
        Text('${ctx.question}$cut', style: type.body),
        if (ctx.pickLetter != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(InsightsCopy.questionPicked(ctx.pickLetter!, hasKey: ctx.hasKey), style: type.small.copyWith(color: colors.ink2)),
        ],
        if (ctx.rule != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(InsightsCopy.questionRule(ctx.rule!), style: type.small.copyWith(color: colors.ink2)),
        ],
        if (blocked) ...[
          const SizedBox(height: MmSpace.s12),
          Text(InsightsCopy.questionBlocked, style: type.small.copyWith(fontWeight: FontWeight.w700, color: colors.ink)),
        ],
        _drop(blocked ? InsightsCopy.questionAskRecord : InsightsCopy.questionAskElse),
      ],
      label: InsightsCopy.questionCardTitle(ctx.chapter),
    );
  }

  Widget _drop(String label) => Align(
        alignment: Alignment.centerLeft,
        child: Transform.translate(
          offset: const Offset(-MmSpace.s16, 0),
          child: KeyButton.quiet(label: label, onPressed: onDrop),
        ),
      );
}
