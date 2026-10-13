import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/attempt.dart';
import '../../../core/models/question.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/repair_state.dart';
import 'outcome_views.dart';
import 'question_panel.dart';

/// Callbacks of the per-mistake screen.
class MistakeActions {
  const MistakeActions({required this.onNext, required this.onFinishForNow, required this.onRetry, required this.onReadKey});

  final VoidCallback onNext;
  final VoidCallback onFinishForNow;
  final VoidCallback onRetry;
  final VoidCallback onReadKey;
}

/// One mistake in the calm panel (spec 5.8 step 2): solid ground, no art, nothing moving.
/// The question with the student's answer, then the correct answer once the server says it,
/// what happened, the worked explanation and the optional retry.
class MistakeView extends StatelessWidget {
  const MistakeView({super.key, required this.run, required this.question, required this.actions, this.detail, this.renewLine});

  final RepairRunState run;

  /// The question from the attempt snapshot, or null when it is missing.
  final SnapshotQuestion? question;

  /// The attempt detail (answer reviews), for the key rule of the answer review. Null until it
  /// has loaded at least once.
  final AttemptDetail? detail;
  final String? renewLine;
  final MistakeActions actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final step = run.current!;
    final outcome = step.outcome;
    final loading = outcome == null || outcome is OutcomeLoading;

    final (chosen, keyIndex) = switch (outcome) {
      OutcomeExplained(:final response) => (response.chosenIndex ?? step.item.givenIndex, response.keyIndex),
      OutcomeKeyReview() => (step.item.givenIndex, detail?.visibleKeyIndex(step.item.questionId)),
      _ => (step.item.givenIndex, null),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TopBar(run: run, onFinishForNow: actions.onFinishForNow),
        Expanded(
          child: ListView(
            key: PageStorageKey(step.item.key),
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s32),
            children: [
              Text('${ReviewCopy.questionLabel(step.item.number)}, ${step.item.source}', style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
              if (question == null)
                Text(ReviewCopy.notFound, style: type.body.copyWith(color: colors.ink2))
              else
                QuestionPanel(question: question!, chosen: chosen, keyIndex: keyIndex),
              ..._outcome(context, outcome),
            ],
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.ground,
            border: Border(top: BorderSide(color: colors.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s16),
            child: KeyButton(label: run.isLast ? ReviewCopy.finish : ReviewCopy.nextMistake, onPressed: loading ? null : actions.onNext),
          ),
        ),
      ],
    );
  }

  List<Widget> _outcome(BuildContext context, MistakeOutcome? outcome) {
    final colors = context.mmColors;
    final type = context.mmType;
    final readKey = StateAction(ReviewCopy.readKey, actions.onReadKey);
    switch (outcome) {
      case null || OutcomeLoading():
        return [
          const SizedBox(height: MmSpace.s24),
          Text(ReviewCopy.working, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          const SkeletonGroup(
            label: ReviewCopy.working,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [Skeleton.line(), SizedBox(height: 10), Skeleton.line(), SizedBox(height: 10), Skeleton.line(width: 180)],
            ),
          ),
        ];
      case OutcomeExplained(:final response):
        return [
          if (response.explanation != null) WorkedExplanation(explanation: response.explanation!),
          ConceptRow(chapter: run.chapter),
          RetryCard(subjectId: run.subjectId, chapter: run.chapter),
        ];
      case OutcomeSetAside(:final heldByServer):
        return [NoticePanel(message: heldByServer ? ReviewCopy.heldForRecheck : ReviewCopy.setAsideCheck, icon: LucideIcons.scale)];
      case OutcomeNotExplained():
        return [NoticePanel(message: ReviewCopy.notExplained, secondary: readKey)];
      case OutcomeFailed(:final failure):
        final message = switch (failure) {
          RepairFailure.offline => ReviewCopy.offline,
          RepairFailure.rateLimited => ReviewCopy.waitAMinute,
          RepairFailure.inProgress => ReviewCopy.stillWorking,
          RepairFailure.cannotRepair => ReviewCopy.cannotRepair,
          RepairFailure.notFound => ReviewCopy.notFound,
          RepairFailure.unavailable || RepairFailure.unknown => ReviewCopy.couldNotMake,
        };
        return [
          NoticePanel(
            message: message,
            icon: failure == RepairFailure.offline ? LucideIcons.wifiOff : LucideIcons.info,
            primary: failure.canRetry ? StateAction(ReviewCopy.tryAgainKey, actions.onRetry) : null,
            secondary: failure == RepairFailure.notFound ? null : readKey,
          ),
        ];
      case OutcomeKeyReview(:final reason):
        return [
          if (reason == KeyReviewReason.outOfCredits) NoticePanel(message: ReviewCopy.outOfCredits, detail: renewLine),
          if (reason == KeyReviewReason.paused) const NoticePanel(message: ReviewCopy.paused),
          _KeyReview(detail: detail, questionId: run.current!.item.questionId),
        ];
    }
  }
}

/// The no-AI answer review: the key explanation under the key rule, labelled as costing nothing.
class _KeyReview extends StatelessWidget {
  const _KeyReview({required this.detail, required this.questionId});

  final AttemptDetail? detail;
  final String questionId;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final d = detail;
    final key = d?.visibleKeyIndex(questionId);
    final text = d?.visibleExplanation(questionId)?.trim();
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(ReviewCopy.answerReview, style: type.cardTitle)),
          const SizedBox(height: MmSpace.s4),
          Text(ReviewCopy.keyExplanationLabel, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          Text(
            d == null
                ? ReviewCopy.keyNeedsConnection
                : key == null
                ? ReviewCopy.keyHidden
                : (text == null || text.isEmpty ? ReviewCopy.noKeyExplanation : text),
            style: type.body,
          ),
          const SizedBox(height: MmSpace.s12),
          Row(
            children: [
              Icon(LucideIcons.smartphone, size: 14, color: colors.ink3),
              const SizedBox(width: MmSpace.s8),
              Expanded(
                child: Text(ReviewCopy.reviewedNote, style: type.caption.copyWith(color: colors.ink3)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Progress in real work ("1 of 3 mistakes") as bubbles, and "Finish for now" always in reach.
class _TopBar extends StatelessWidget {
  const _TopBar({required this.run, required this.onFinishForNow});

  final RepairRunState run;
  final VoidCallback onFinishForNow;

  BubbleState _state(int i) {
    final s = run.steps[i];
    if (s.countsAsRepaired) return BubbleState.filled;
    return switch (s.outcome) {
      OutcomeExplained() => BubbleState.filled,
      OutcomeKeyReview() => BubbleState.marked,
      OutcomeSetAside() => BubbleState.blank,
      _ => BubbleState.wrong,
    };
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final n = run.steps.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.s4, MmSpace.s8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(liveRegion: true, child: Text(ReviewCopy.progress(run.index + 1, n), style: type.labelLarge)),
                const SizedBox(height: 6),
                BubbleRow(states: [for (var i = 0; i < n; i++) _state(i)], bubbleSize: 12, gap: 6, emphasis: run.index),
              ],
            ),
          ),
          KeyButton.quiet(label: ReviewCopy.finishForNow, onPressed: onFinishForNow),
        ],
      ),
    );
  }
}

/// The question of [questionId] in [attempt], or null.
SnapshotQuestion? questionIn(Attempt? attempt, String questionId) {
  if (attempt == null) return null;
  for (final q in attempt.questions) {
    if (q.id == questionId) return q;
  }
  return null;
}
