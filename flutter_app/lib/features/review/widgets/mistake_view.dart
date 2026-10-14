import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/marks_at_stake.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/question.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart' show MistakeStage;
import '../data/repair_state.dart';
import 'life_row.dart';
import 'outcome_views.dart';
import 'question_panel.dart';
import 'repair_mobi.dart';
import 'review_bits.dart' show FlushKey;
import 'run_track.dart';

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
  const MistakeView({
    super.key,
    required this.run,
    required this.question,
    required this.actions,
    this.detail,
    this.renewDate,
    this.scheme,
  });

  final RepairRunState run;

  /// The question from the attempt snapshot, or null when it is missing.
  final SnapshotQuestion? question;

  /// The attempt detail (answer reviews), for the key rule of the answer review. Null until it
  /// has loaded at least once.
  final AttemptDetail? detail;

  /// When the explanation credits renew ("1 November"), for the used-up credits line.
  final String? renewDate;
  final MistakeActions actions;

  /// The paper's marking scheme, for the free marks line. Null hides the line.
  final MarkingScheme? scheme;

  /// The letter of option [i] of the question ("B"), or null.
  String? _letter(int? i) {
    final q = question;
    if (q == null || i == null || i < 0 || i >= q.options.length) return null;
    return q.options[i].key;
  }

  /// "This answer cost 6 marks in this session: 5 not earned and 1 penalty.", or null when the
  /// scheme is unknown or the key of this answer was corrected (its marks then changed).
  String? _marksLine(String questionId) {
    if (detail?.answerReviews[questionId]?.isCorrected ?? false) return null;
    return marksAtStake(scheme)?.line;
  }

  Widget? _marks(BuildContext context) {
    final line = _marksLine(run.current!.item.questionId);
    return line == null ? null : MarksLine(text: line);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final step = run.current!;
    final outcome = step.outcome;
    final loading = outcome == null || outcome is OutcomeLoading;
    // A call that failed and can be tried again: the key becomes "Try again", and moving on is the
    // quiet text under it. Nothing else on this screen is a second button.
    final retryHere = outcome is OutcomeFailed && outcome.failure.canRetry;
    final moveOn = run.isLast ? ReviewCopy.finish : ReviewCopy.nextMistake;

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
          child: Stack(
            children: [
              ListView(
                key: PageStorageKey(step.item.key),
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s32),
                children: [
                  Text('${ReviewCopy.questionLabel(step.item.number)}, ${step.item.source}', style: type.caption.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  if (question == null)
                    Text(ReviewCopy.notFound, style: type.body.copyWith(color: colors.ink2))
                  else if (outcome is OutcomeExplained)
                    // Once explained the paid part leads: the question folds to one line.
                    FoldedQuestion(
                      key: ValueKey('fold-${step.item.key}'),
                      line: ReviewCopy.foldedQuestion(step.item.number, _letter(chosen), _letter(keyIndex)),
                      panel: QuestionPanel(question: question!, chosen: chosen, keyIndex: keyIndex),
                    )
                  else
                    QuestionPanel(question: question!, chosen: chosen, keyIndex: keyIndex),
                  RepairMobi(stepKey: step.item.key, outcome: outcome),
                  ..._outcome(context, outcome, chosenLetter: _letter(chosen)),
                ],
              ),
              // The words run under the key: a short fade into the ground says there is more, in
              // place of a hard cut or a rule.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 24,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [colors.ground.withValues(alpha: 0), colors.ground],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        ColoredBox(
          color: colors.ground,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // While the explanation is made the key holds its place and shows its spinner: a
                // working key, not a grey one that looks broken.
                KeyButton(
                  label: retryHere ? ReviewCopy.tryAgainKey : moveOn,
                  loading: loading,
                  onPressed: retryHere ? actions.onRetry : actions.onNext,
                ),
                if (retryHere) Align(child: KeyButton.quiet(label: moveOn, onPressed: actions.onNext)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _outcome(BuildContext context, MistakeOutcome? outcome, {String? chosenLetter}) {
    final colors = context.mmColors;
    final type = context.mmType;
    final readKey = StateAction(ReviewCopy.readKey, actions.onReadKey);
    switch (outcome) {
      case null || OutcomeLoading():
        return [
          const SizedBox(height: MmSpace.s32),
          Text(ReviewCopy.working, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          const SkeletonGroup(
            label: ReviewCopy.working,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [Skeleton.line(), SizedBox(height: MmSpace.s12), Skeleton.line(), SizedBox(height: MmSpace.s12), Skeleton.line(width: 180)],
            ),
          ),
        ];
      case OutcomeExplained(:final response):
        return [
          StageMoment(repaired: run.current?.countsAsRepaired ?? false),
          if (response.explanation != null) WorkedExplanation(explanation: response.explanation!, chosenLetter: chosenLetter),
          ?_marks(context),
          ConceptRow(chapter: run.chapter),
          RetryCard(subjectId: run.subjectId, chapter: run.chapter),
        ];
      case OutcomeSetAside(:final heldByServer):
        return [NoticePanel(message: heldByServer ? ReviewCopy.heldForRecheck : ReviewCopy.setAsideCheck, icon: LucideIcons.scale)];
      case OutcomeNotExplained():
        return [NoticePanel(message: ReviewCopy.notExplained, primary: readKey)];
      case OutcomeFailed(:final failure, message: final serverMessage):
        // The server's own sentence wins when it sent one; a timeout always says the same words.
        final message = serverMessage ?? switch (failure) {
          RepairFailure.offline => ReviewCopy.offline,
          RepairFailure.rateLimited => ReviewCopy.waitAMinute,
          RepairFailure.inProgress => ReviewCopy.stillWorking,
          RepairFailure.cannotRepair => ReviewCopy.cannotRepair,
          RepairFailure.notFound => ReviewCopy.notFound,
          RepairFailure.tookTooLong => ReviewCopy.tookTooLong,
          RepairFailure.providerUnavailable => ReviewCopy.providerUnavailable,
          RepairFailure.walletUnavailable => ReviewCopy.walletUnavailable,
          RepairFailure.budgetReached => ReviewCopy.repairsPaused,
          RepairFailure.unavailable || RepairFailure.unknown => ReviewCopy.couldNotMake,
        };
        return [
          NoticePanel(
            message: message,
            icon: failure == RepairFailure.offline ? LucideIcons.wifiOff : LucideIcons.info,
            // The key below says "Try again"; reading the key explanation is the quiet link here.
            primary: failure == RepairFailure.notFound ? null : readKey,
          ),
        ];
      case OutcomeKeyReview(:final reason):
        return [
          if (reason == KeyReviewReason.outOfCredits) NoticePanel(message: ReviewCopy.creditsUsedLine(renewDate)),
          if (reason == KeyReviewReason.paused) const NoticePanel(message: ReviewCopy.paused),
          _KeyReview(detail: detail, questionId: run.current!.item.questionId),
          ?_marks(context),
        ];
    }
  }
}

/// The free marks line: what this answer cost in its session, from the scheme alone.
class MarksLine extends StatelessWidget {
  const MarksLine({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(LucideIcons.scale, size: 16, color: colors.ink3),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}

/// The question once the repair is on screen: one line, "Q7. Your pick B. Key C.", with "Show the
/// question" to open it again. The two states cross-fade on top of each other (no size animation
/// inside the scrolling list); the height settles when the fade ends.
class FoldedQuestion extends StatefulWidget {
  const FoldedQuestion({super.key, required this.line, required this.panel});

  final String line;
  final Widget panel;

  @override
  State<FoldedQuestion> createState() => _FoldedQuestionState();
}

class _FoldedQuestionState extends State<FoldedQuestion> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final folded = Column(
      key: const ValueKey('folded'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.sunken,
            shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
            child: Text(widget.line, style: type.labelLarge.copyWith(color: colors.ink)),
          ),
        ),
        FlushKey(label: ReviewCopy.showQuestion, onPressed: () => setState(() => _open = true)),
      ],
    );
    final open = Column(
      key: const ValueKey('open'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.panel,
        FlushKey(label: ReviewCopy.hideQuestion, onPressed: () => setState(() => _open = false)),
      ],
    );
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.crossFade),
      switchInCurve: Motion.out,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [...previous, ?current],
      ),
      child: _open ? open : folded,
    );
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

/// Progress in real work ("1 of 3 mistakes") as the run track, and "Finish for now" always in reach.
class _TopBar extends StatelessWidget {
  const _TopBar({required this.run, required this.onFinishForNow});

  final RepairRunState run;
  final VoidCallback onFinishForNow;

  RunSegmentState _segment(int i) {
    final s = run.steps[i];
    if (s.countsAsRepaired || s.outcome is OutcomeExplained) return RunSegmentState.done;
    return switch (s.outcome) {
      OutcomeKeyReview() => RunSegmentState.reviewed,
      OutcomeSetAside() => RunSegmentState.setAside,
      _ => i == run.index ? RunSegmentState.current : RunSegmentState.upcoming,
    };
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final n = run.steps.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.s4, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Semantics(liveRegion: true, child: Text(ReviewCopy.progress(run.index + 1, n), style: type.labelLarge)),
              ),
              KeyButton.quiet(label: ReviewCopy.finishForNow, onPressed: onFinishForNow),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: MmSpace.s12),
            child: RunTrack(segments: [for (var i = 0; i < n; i++) _segment(i)]),
          ),
        ],
      ),
    );
  }
}

/// The stage thread over a worked explanation: Found sits lit, and 160 ms later (the moment the
/// explanation has landed) the line draws to Repaired and the bubble inks. Checked and Holds stay
/// dashed. Only a repair the server acknowledged ([repaired]) completes the stage.
class StageMoment extends StatefulWidget {
  const StageMoment({super.key, required this.repaired});

  final bool repaired;

  @override
  State<StageMoment> createState() => _StageMomentState();
}

class _StageMomentState extends State<StageMoment> {
  Timer? _timer;
  late MistakeStage _stage = MistakeStage.found;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _complete();
  }

  /// A repair the server acknowledged after this stage was already on screen (the explanation
  /// landed first, the acknowledgement a moment later) completes it then, with the same beat.
  @override
  void didUpdateWidget(StageMoment old) {
    super.didUpdateWidget(old);
    if (widget.repaired && !old.repaired) _complete();
  }

  void _complete() {
    if (!widget.repaired || _stage == MistakeStage.repaired || (_timer?.isActive ?? false)) return;
    if (Motion.reduced(context)) {
      _stage = MistakeStage.repaired;
    } else {
      _timer = Timer(const Duration(milliseconds: 160), () {
        if (mounted) setState(() => _stage = MistakeStage.repaired);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: MmSpace.s24),
    child: LifeRow(stage: _stage, bubbleSize: 16),
  );
}

/// The question of [questionId] in [attempt], or null.
SnapshotQuestion? questionIn(Attempt? attempt, String questionId) {
  if (attempt == null) return null;
  for (final q in attempt.questions) {
    if (q.id == questionId) return q;
  }
  return null;
}
