import 'package:flutter/material.dart';

import '../../../core/models/question.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'question_panel.dart';

/// How the student's second try compares with the key and with their first pick.
enum RetryVerdict {
  /// The pick is the key.
  right,

  /// The same wrong option as in the paper.
  still,

  /// A different wrong option.
  different,
}

/// The verdict for a checked try, or null when it cannot be told yet (no pick, or the key is not
/// known: it then arrives with the reason). [key] is the server's key when it answered, else the
/// one on the phone (the server wins). [before] is the pick made in the paper.
RetryVerdict? retryVerdictOf({required int? pick, required int? key, required int? before}) {
  if (pick == null || key == null) return null;
  if (pick == key) return RetryVerdict.right;
  return pick == before ? RetryVerdict.still : RetryVerdict.different;
}

/// The words each option of a checked repair carries, in place of "Your answer": the key, your pick
/// now, your pick in the paper, and your pick that is also the key. Never colour alone.
Map<int, String> retryOptionWords({required int? pick, required int? key, required int? before, required String source}) {
  return {
    ?key: pick == key ? ReviewCopy.yourPickAndKey : ReviewCopy.keyWord,
    if (pick != null && pick != key) pick: ReviewCopy.yourPickNow,
    if (before != null && before != key && before != pick) before: ReviewCopy.yourPickIn(source),
  };
}

/// The try step's body: the title, the question and its options with no key and no marks, and the
/// pick made in the paper tagged in words. The options are a radio group of 56 dp rows. [mobi] is
/// the one Mobi of the screen with the hint beside him (the caller places him, so he keeps his
/// state from the try into the reason).
class RetryFirstBody extends StatelessWidget {
  const RetryFirstBody({
    super.key,
    required this.question,
    required this.picked,
    required this.before,
    required this.source,
    required this.onPick,
    required this.mobi,
  });

  final SnapshotQuestion question;

  /// The option chosen on this step, or null.
  final int? picked;

  /// The option chosen in the paper (tagged, still pickable).
  final int? before;
  final String source;
  final ValueChanged<int> onPick;

  /// Places the hint beside Mobi (the caller owns him).
  final Widget Function(Widget hint) mobi;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final passage = question.passageText?.trim();
    final body = distinctBody(question.question, question.body);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(ReviewCopy.tryTitle, style: type.headline.copyWith(fontSize: 20, height: 26 / 20)),
        ),
        const SizedBox(height: MmSpace.s16),
        if (passage != null && passage.isNotEmpty) ...[PassageBlock(text: passage), const SizedBox(height: MmSpace.s16)],
        Text(question.question, style: type.question),
        if (body != null && body.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          Text(body, style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        Semantics(
          container: true,
          explicitChildNodes: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < question.options.length; i++) ...[
                if (i > 0) const SizedBox(height: MmSpace.s8),
                MmSelectRow(
                  title: question.options[i].text,
                  letter: question.options[i].key,
                  note: before == i ? ReviewCopy.yourPickIn(source) : null,
                  selected: picked == i,
                  onTap: () => onPick(i),
                ),
              ],
            ],
          ),
        ),
        mobi(Text(ReviewCopy.tryHint, style: type.label.copyWith(color: colors.ink2))),
      ],
    );
  }
}

/// The verdict line under the folded question: the verdict in words (18 sp, w600) and one line of
/// what comes next, as a polite live region. It rises 8 dp and fades in over 240 ms; no shake for a
/// wrong pick (the student is learning, not failing a paper). Under reduced motion it is a plain
/// fade.
class RetryVerdictLine extends StatelessWidget {
  const RetryVerdictLine({super.key, required this.verdict, this.pickLetter, this.keyLetter});

  final RetryVerdict verdict;
  final String? pickLetter;
  final String? keyLetter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final (title, line) = switch (verdict) {
      RetryVerdict.right => (ReviewCopy.verdictRight, ReviewCopy.verdictRightLine),
      RetryVerdict.still => (ReviewCopy.verdictStill(pickLetter), ReviewCopy.verdictStillLine(keyLetter)),
      RetryVerdict.different => (ReviewCopy.verdictDifferent(pickLetter, keyLetter), ReviewCopy.verdictDifferentLine(keyLetter)),
    };
    final reduced = Motion.reduced(context);
    return Semantics(
      container: true,
      liveRegion: true,
      label: '$title $line',
      excludeSemantics: true,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: reduced ? 1 : 0, end: 1),
        duration: Motion.of(context, Motion.card),
        curve: Motion.out,
        builder: (context, t, child) => Opacity(
          opacity: t,
          child: Transform.translate(offset: Offset(0, reduced ? 0 : 8 * (1 - t)), child: child),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: type.headline.copyWith(fontSize: 18, height: 24 / 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: MmSpace.s4),
            Text(line, style: type.body.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// The pinned band of the try step: "Check my answer" (off until a pick), what the reason costs,
/// and the quiet "Show the reason now".
class RetryBar extends StatelessWidget {
  const RetryBar({super.key, required this.hasPick, required this.onCheck, required this.onSkip, this.costLine});

  final bool hasPick;
  final VoidCallback onCheck;
  final VoidCallback onSkip;

  /// "The reason uses 1 AI credit. You have 43.", "The key explanation is free.", or null.
  final String? costLine;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyButton(
          label: ReviewCopy.checkMyAnswer,
          semanticsLabel: hasPick ? ReviewCopy.checkMyAnswer : ReviewCopy.checkMyAnswerNeedsPick,
          onPressed: hasPick ? onCheck : null,
        ),
        if (costLine != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(costLine!, style: type.small.copyWith(color: colors.ink2), textAlign: TextAlign.center),
        ],
        Align(child: KeyButton.quiet(label: ReviewCopy.showReasonNow, onPressed: onSkip)),
      ],
    );
  }
}
