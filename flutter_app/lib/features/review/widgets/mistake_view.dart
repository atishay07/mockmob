import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/marks_at_stake.dart';
import '../../../core/models/attempt.dart';
import '../../../core/models/question.dart';
import '../../../core/models/repair.dart';
import '../../../core/models/repair_check.dart' show RepairCheckStatus;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart' show MistakeStage;
import '../data/repair_check_logic.dart' show CheckReceipt;
import '../data/repair_state.dart';
import 'life_row.dart';
import 'outcome_views.dart';
import 'question_panel.dart';
import 'repair_check_section.dart';
import 'repair_mobi.dart';
import 'retry_first.dart';
import 'review_bits.dart' show FlushKey;
import 'run_track.dart';

/// Callbacks of the per-mistake screen.
class MistakeActions {
  const MistakeActions({
    required this.onNext,
    required this.onFinishForNow,
    required this.onRetry,
    required this.onReadKey,
    this.onGoTo,
    this.onLeadCheck,
    this.onSelectTry,
    this.onCheckTry,
    this.onSkipTry,
  });

  /// The try step: a pick (free, local), "Check my answer", and "Show the reason now". Null leaves
  /// the step out (the run never offers it).
  final ValueChanged<int>? onSelectTry;
  final VoidCallback? onCheckTry;
  final VoidCallback? onSkipTry;

  final VoidCallback onNext;
  final VoidCallback onFinishForNow;
  final VoidCallback onRetry;
  final VoidCallback onReadKey;

  /// Shows a step already reached (the run track, a swipe). Returns whether it moved. Null: the
  /// track is a picture only.
  final bool Function(int index)? onGoTo;

  /// A saved repair opened again leads with "Check it held": its key brings the check question into
  /// view (once). Null leaves the key as it was.
  final VoidCallback? onLeadCheck;
}

/// "You also missed this question in Mock 3 on 12 October.", from the student's own record, with
/// the key that opens that result.
class EarlierMiss {
  const EarlierMiss({required this.line, required this.onOpen});

  final String line;
  final VoidCallback onOpen;
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
    this.earlier,
    this.tryNote,
    this.attempted,
    this.savedWhen,
    this.checkLed = false,
  });

  final RepairRunState run;

  /// Which paper this mistake came from and when it was attempted, in the student's own time:
  /// "Mock 3, 14 Oct, 9:41 PM". Null shows the paper's name alone.
  final String? attempted;

  /// When the saved repair on screen was made ("15 Oct, 8:05 PM"), or null.
  final String? savedWhen;

  /// The saved repair's "Check it held" key has been used: the key goes back to moving on.
  final bool checkLed;

  /// The cost line under "Check my answer" ("The reason uses 1 AI credit. You have 43.", "The key
  /// explanation is free."), or null when the balance is not known.
  final String? tryNote;

  /// The same question missed in another paper, or null (never guessed).
  final EarlierMiss? earlier;

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
    // A saved repair opened again: what is left to do on it is the check, so that is the key.
    final leadCheck = !checkLed &&
        savedWhen != null &&
        actions.onLeadCheck != null &&
        outcome is OutcomeExplained &&
        outcome.response.check?.status == RepairCheckStatus.ready;

    // A checked try: the pick now leads, the paper's pick is the quiet earlier one, and the key is
    // known from the phone at once (the server's answer, when it comes, wins).
    final tried = step.checkedPick;
    final localKey = detail?.visibleKeyIndex(step.item.questionId);
    final trying = step.awaitingTry && question != null && actions.onCheckTry != null;
    final (chosen, keyIndex) = switch (outcome) {
      OutcomeExplained(:final response) => (tried ?? response.chosenIndex ?? step.item.givenIndex, response.keyIndex),
      OutcomeKeyReview() => (tried ?? step.item.givenIndex, localKey),
      _ => (tried ?? step.item.givenIndex, tried == null ? null : localKey),
    };
    final verdict = switch (outcome) {
      OutcomeExplained(reopened: false) || OutcomeKeyReview() || null || OutcomeLoading() => retryVerdictOf(pick: tried, key: keyIndex, before: step.item.givenIndex),
      _ => null,
    };
    final earlierPick = tried == null ? null : step.item.givenIndex;
    final words = tried == null || question == null
        ? null
        : retryOptionWords(pick: tried, key: keyIndex, before: step.item.givenIndex, source: step.item.source);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TopBar(run: run, onFinishForNow: actions.onFinishForNow, onGoTo: actions.onGoTo),
        Expanded(
          child: _SwipeSteps(
            run: run,
            onGoTo: actions.onGoTo,
            child: Stack(
            children: [
              // Only the mistake itself moves on: the track above and the key below stay put, so
              // the track's lift can travel and the key never blinks.
              Positioned.fill(
                child: _StepSwap(
                  index: run.index,
                  child: ListView(
                key: PageStorageKey(step.item.key),
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s48),
                children: [
                  // A saved repair says when it was made before anything else (F17).
                  if (savedWhen != null) ...[
                    Semantics(header: true, child: Text(ReviewCopy.repairedOn(savedWhen!), style: type.cardTitle)),
                    const SizedBox(height: MmSpace.s4),
                  ],
                  Text('${ReviewCopy.questionLabel(step.item.number)}, ${attempted ?? step.item.source}', style: type.caption.copyWith(color: colors.ink2)),
                  if (earlier case final e?) _EarlierLine(miss: e),
                  const SizedBox(height: MmSpace.s8),
                  if (question == null)
                    Text(ReviewCopy.notFound, style: type.body.copyWith(color: colors.ink2))
                  else if (trying)
                    RetryFirstBody(
                      key: ValueKey('try-${step.item.key}'),
                      question: question!,
                      picked: step.retryPick,
                      before: step.item.givenIndex,
                      source: step.item.source,
                      onPick: actions.onSelectTry ?? (_) {},
                      mobi: (hint) => RepairMobi(stepKey: step.item.key, outcome: null, trying: true, beside: hint),
                    )
                  else if (outcome is OutcomeExplained)
                    // Once explained the paid part leads: the question folds to one line, and the
                    // key reveals itself on it (a stored repair paints it final).
                    KeyReveal(
                      key: ValueKey('fold-reveal-${step.item.key}'),
                      keyShown: true,
                      animate: !outcome.reopened,
                      // The acknowledgement already gave the light haptic.
                      haptic: false,
                      builder: (context, reveal) => FoldedQuestion(
                        key: ValueKey('fold-${step.item.key}'),
                        line: ReviewCopy.foldedQuestion(step.item.number, _letter(chosen), _letter(keyIndex)),
                        number: step.item.number,
                        pick: _letter(chosen),
                        answer: _letter(keyIndex),
                        reveal: reveal,
                        panel: QuestionPanel(question: question!, chosen: chosen, keyIndex: keyIndex, earlier: earlierPick, words: words),
                      ),
                    )
                  else
                    KeyReveal(
                      key: ValueKey('reveal-${step.item.key}'),
                      keyShown: keyIndex != null,
                      builder: (context, reveal) =>
                          QuestionPanel(question: question!, chosen: chosen, keyIndex: keyIndex, reveal: reveal, earlier: earlierPick, words: words),
                    ),
                  if (!trying)
                    ..._outcome(
                      context,
                      outcome,
                      chosenLetter: _letter(chosen),
                      keyLetter: _letter(keyIndex),
                      verdict: verdict,
                      skippedTry: step.tryStage == TryStage.done && tried == null,
                    ),
                ],
                  ),
                ),
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
        ),
        ColoredBox(
          color: colors.ground,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (trying)
                  RetryBar(
                    hasPick: step.retryPick != null,
                    costLine: tryNote,
                    onCheck: actions.onCheckTry!,
                    onSkip: actions.onSkipTry ?? actions.onCheckTry!,
                  )
                else ...[
                  // While the explanation is made the key holds its place and shows its spinner: a
                  // working key, not a grey one that looks broken.
                  KeyButton(
                    label: retryHere ? ReviewCopy.tryAgainKey : (leadCheck ? CheckCopy.title : moveOn),
                    loading: loading,
                    onPressed: retryHere ? actions.onRetry : (leadCheck ? actions.onLeadCheck : actions.onNext),
                  ),
                  if (retryHere || leadCheck) Align(child: KeyButton.quiet(label: moveOn, onPressed: actions.onNext)),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// "Ask Mobi about Q3" and "Check it held" under the explanation, or null when the repair
  /// response has no `check` (an older server, a held repair): then neither is drawn.
  Widget? _follow(RepairResponse response) {
    final check = response.check;
    if (check == null) return null;
    final item = run.current!.item;
    return RepairFollowUp(
      key: ValueKey('follow-${item.key}'),
      attemptId: run.attemptId,
      questionId: item.questionId,
      number: item.number,
      check: check,
      receipt: CheckReceipt(
        source: item.source,
        // What the mistake cost in its paper: free, from the marking scheme alone, left out when the
        // key of this answer was corrected (its marks then changed).
        marks: (detail?.answerReviews[item.questionId]?.isCorrected ?? false) ? null : marksAtStake(scheme)?.total,
        trap: response.explanation?.trapHeading != null,
        runKeys: [for (final s in run.steps) (attemptId: run.attemptId, questionId: s.item.questionId)],
      ),
    );
  }

  /// The sentences of "From your record" for [questionId]: the lines the server built from the
  /// student's own answers (null renders nothing, never a placeholder), then the repeated-trap
  /// line from this repair's answer. A pattern the lines already say is not said twice.
  List<String> _recordLines(String questionId, RepairResponse response) {
    final lines = <String>[
      for (final l in detail?.mistakeInsights[questionId]?.lines ?? const [])
        if (l.text.trim().isNotEmpty) l.text.trim(),
    ];
    final pattern = response.pattern?.line.trim();
    if (pattern != null && pattern.isNotEmpty && !lines.contains(pattern)) lines.add(pattern);
    return lines;
  }

  /// The small print under a repair: "1 credit used. 43 left." for a fresh one, "Saved repair. No
  /// credit used." for one opened again. An answer that does not say what it cost says nothing
  /// about cost: an unknown charge is never shown as none.
  static String? finePrint(RepairResponse response, {required bool reopened, String? savedWhen}) {
    if (reopened || response.status == RepairStatus.stored) {
      return savedWhen == null ? ReviewCopy.savedRepairNoCredit : ReviewCopy.savedRepairFinePrint(savedWhen);
    }
    final charged = response.charged;
    if (charged == null) return null;
    if (charged <= 0) return ReviewCopy.noCreditUsed;
    final wallet = response.wallet;
    return ReviewCopy.creditsUsed(charged, wallet?.total ?? wallet?.balance);
  }

  /// The outcome under the question. Its first line has Mobi beside it, where the website has him
  /// (MistakeRepair.jsx): the wait line, the four steps of a landed repair, a failure's notice and
  /// "could not explain". A key review and a set-aside question have no Mobi, as on the website.
  /// He is always the first child here, so he keeps his state from the wait to the repair.
  List<Widget> _outcome(BuildContext context, MistakeOutcome? outcome, {String? chosenLetter, String? keyLetter, RetryVerdict? verdict, bool skippedTry = false}) {
    final readKey = StateAction(ReviewCopy.readKey, actions.onReadKey);
    Widget withMobi(Widget line) => RepairMobi(stepKey: run.current!.item.key, outcome: outcome, beside: line, verdict: verdict, skippedTry: skippedTry);
    // The verdict, when the phone can already tell it: it leads, with Mobi beside it, and the wait
    // line or the reason follows under it.
    final verdictLine = verdict == null ? null : RetryVerdictLine(verdict: verdict, pickLetter: chosenLetter, keyLetter: keyLetter);
    switch (outcome) {
      case null || OutcomeLoading():
        final wait = RepairWaitLine(key: ValueKey('wait-${run.current!.item.key}'), number: run.current!.item.number);
        return [
          // What is true now, in one line that changes on real elapsed time (8 s, then 45 s), with
          // the website's words and timings. No stage is invented, and nothing is added under it.
          if (verdictLine != null) ...[withMobi(verdictLine), const SizedBox(height: MmSpace.s12), wait] else withMobi(wait),
          const SizedBox(height: MmSpace.s16),
          // The placeholder is only a shape: the wait line above is what a screen reader hears.
          ExcludeSemantics(
            child: SkeletonGroup(
              label: ReviewCopy.writingRepair(run.current!.item.number),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [Skeleton.line(), SizedBox(height: MmSpace.s12), Skeleton.line(), SizedBox(height: MmSpace.s12), Skeleton.line(width: 180)],
              ),
            ),
          ),
        ];
      case OutcomeExplained(:final response, :final reopened, :final requestId):
        // The header already says when it was made, so the small print says only that it cost nothing.
        final fine = finePrint(response, reopened: reopened);
        return [
          // A repair made earlier and opened again is repaired too: its thread is simply there,
          // with no draw, since nothing new happened.
          if (verdictLine != null) ...[
            withMobi(verdictLine),
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s16),
              child: StageMoment(repaired: run.current?.countsAsRepaired ?? false, animate: true),
            ),
          ] else
            withMobi(StageMoment(repaired: reopened || (run.current?.countsAsRepaired ?? false), animate: !reopened)),
          if (response.explanation != null)
            WorkedExplanation(
              explanation: response.explanation!,
              chosenLetter: chosenLetter,
              keyLetter: keyLetter,
              letterOf: question == null ? null : _letter,
              recordLines: _recordLines(run.current!.item.questionId, response),
              // Only a repair the server just made arrives block by block, and only the first time
              // it is on screen; a saved one, or one gone back to along the track, is simply there.
              animate: !reopened && response.status == RepairStatus.explained,
              arrivalKey: '${run.attemptId}/${run.current!.item.key}/${requestId ?? ''}',
              // "Ask Mobi about Q3", then "Check it held": only for a repair that carried a `check`.
              follow: _follow(response),
            ),
          ?_marks(context),
          ConceptRow(chapter: run.chapter),
          RetryCard(subjectId: run.subjectId, chapter: run.chapter),
          if (fine != null) RepairFinePrint(text: fine),
        ];
      case OutcomeSetAside(:final heldByServer):
        return [NoticePanel(message: heldByServer ? ReviewCopy.heldForRecheck : ReviewCopy.setAsideCheck, icon: LucideIcons.scale)];
      case OutcomeNotExplained():
        return [withMobi(NoticePanel(message: ReviewCopy.notExplained, primary: readKey))];
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
          withMobi(
            NoticePanel(
              message: message,
              icon: failure == RepairFailure.offline ? LucideIcons.wifiOff : LucideIcons.info,
              // The key below says "Try again"; reading the key explanation is the quiet link here.
              primary: failure == RepairFailure.notFound ? null : readKey,
            ),
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
  const FoldedQuestion({super.key, required this.line, required this.panel, this.number, this.pick, this.answer, this.reveal});

  /// What the line says, for TalkBack ("Q7. Your pick B. Key C.").
  final String line;
  final Widget panel;

  /// The question number and the two letters drawn as bubbles. Without a [number] the line is
  /// plain text.
  final int? number;
  final String? pick;
  final String? answer;

  /// The key reveal's clock, or null for the final state.
  final Animation<double>? reveal;

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
            child: widget.number == null
                ? Text(widget.line, style: type.labelLarge.copyWith(color: colors.ink))
                : FoldLine(line: widget.line, number: widget.number!, pick: widget.pick, answer: widget.answer, reveal: widget.reveal),
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

/// "Q7 (B) Your answer (C) Correct answer": the folded question as bubbles (the website's
/// FoldLine). On the reveal's clock the pick settles and its word fades in, then the key's ring
/// draws round, fills, and its word fades in. TalkBack hears the one plain sentence.
class FoldLine extends StatelessWidget {
  const FoldLine({super.key, required this.line, required this.number, this.pick, this.answer, this.reveal});

  final String line;
  final int number;
  final String? pick;
  final String? answer;
  final Animation<double>? reveal;

  @override
  Widget build(BuildContext context) {
    final r = reveal;
    return Semantics(
      label: line,
      excludeSemantics: true,
      child: r == null ? _paint(context, 1) : AnimatedBuilder(animation: r, builder: (context, _) => _paint(context, r.value)),
    );
  }

  Widget _paint(BuildContext context, double t) {
    final colors = context.mmColors;
    final type = context.mmType;
    final settle = KeyRevealTiming.window(t, 0, KeyRevealTiming.settleEnd);
    final ring = KeyRevealTiming.window(t, KeyRevealTiming.strokeStart, KeyRevealTiming.strokeEnd);
    final fill = KeyRevealTiming.window(t, KeyRevealTiming.strokeEnd, KeyRevealTiming.keyWordStart);
    return Wrap(
      spacing: MmSpace.s16,
      runSpacing: MmSpace.s8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text('Q$number', style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
        if (pick != null)
          Transform.translate(
            offset: Offset(0, -KeyRevealTiming.settle * (1 - Motion.out.transform(settle))),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _LetterBubble(letter: pick!, mine: true),
                const SizedBox(width: MmSpace.s8),
                Opacity(
                  opacity: KeyRevealTiming.window(t, KeyRevealTiming.yourWordStart, KeyRevealTiming.yourWordEnd),
                  child: Text(ReviewCopy.yourAnswer, style: type.label.copyWith(color: colors.badText)),
                ),
              ],
            ),
          ),
        if (answer != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _LetterBubble(letter: answer!, mine: false, ring: ring, fill: fill),
              const SizedBox(width: MmSpace.s8),
              Opacity(
                opacity: KeyRevealTiming.window(t, KeyRevealTiming.keyWordStart, 1),
                child: Text(ReviewCopy.correctAnswer, style: type.label.copyWith(color: colors.ink)),
              ),
            ],
          ),
      ],
    );
  }
}

/// A 28 dp bubble with its letter: your pick ringed in coral, or the key, whose ring draws round
/// ([ring], 0 to 1) and then fills volt ([fill]).
class _LetterBubble extends StatelessWidget {
  const _LetterBubble({required this.letter, required this.mine, this.ring = 1, this.fill = 1});

  final String letter;
  final bool mine;
  final double ring;
  final double fill;

  static const double size = 28;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ink = mine ? colors.badText : Color.lerp(colors.ink, colors.voltInk, fill)!;
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _LetterBubblePainter(
          mine: mine,
          ring: ring,
          fill: fill,
          coral: colors.badText,
          volt: colors.volt,
          rim: colors.isNight ? colors.volt : colors.voltEdge,
        ),
        child: Center(
          child: Text(letter, style: type.label.copyWith(fontSize: 13, height: 1, fontWeight: FontWeight.w700, color: ink)),
        ),
      ),
    );
  }
}

class _LetterBubblePainter extends CustomPainter {
  const _LetterBubblePainter({required this.mine, required this.ring, required this.fill, required this.coral, required this.volt, required this.rim});

  final bool mine;
  final double ring;
  final double fill;
  final Color coral;
  final Color volt;
  final Color rim;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2 - 1;
    if (mine) {
      canvas.drawCircle(c, r, Paint()..color = coral.withValues(alpha: 0.10));
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = coral,
      );
      return;
    }
    if (fill > 0) canvas.drawCircle(c, r, Paint()..color = volt.withValues(alpha: fill));
    if (ring > 0) {
      canvas.drawPath(
        mmPathPrefix(MmPaths.ring(Rect.fromCircle(center: c, radius: r)), Motion.inOut.transform(ring)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round
          ..color = rim,
      );
    }
  }

  @override
  bool shouldRepaint(_LetterBubblePainter old) =>
      old.mine != mine || old.ring != ring || old.fill != fill || old.coral != coral || old.volt != volt || old.rim != rim;
}

/// The free line under the question's caption when the same question was missed in another paper:
/// a doubled bubble, the sentence, and a quiet key that opens that result.
class _EarlierLine extends StatelessWidget {
  const _EarlierLine({required this.miss});

  final EarlierMiss miss;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: MmPressable(
        onTap: miss.onOpen,
        pressedScale: 0.985,
        focusRadius: MmRadius.keyAll,
        haptic: MmPressHaptic.selection,
        semanticsLabel: '${miss.line} ${ReviewCopy.openThatResult}',
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            children: [
              const MissedTwiceGlyph(),
              const SizedBox(width: MmSpace.s8),
              Expanded(child: Text(miss.line, style: type.small.copyWith(color: colors.ink))),
              const SizedBox(width: MmSpace.s8),
              Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

/// Two overlapping coral bubbles: the same question missed more than once.
class MissedTwiceGlyph extends StatelessWidget {
  const MissedTwiceGlyph({super.key, this.size = 14});

  final double size;

  @override
  Widget build(BuildContext context) {
    final coral = context.mmColors.badText;
    return ExcludeSemantics(
      child: SizedBox(
        width: size * 1.6,
        height: size,
        child: CustomPaint(painter: _TwiceGlyphPainter(coral)),
      ),
    );
  }
}

class _TwiceGlyphPainter extends CustomPainter {
  const _TwiceGlyphPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.height / 2 - 0.75;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = color;
    canvas.drawCircle(Offset(r + 0.75, size.height / 2), r, stroke);
    canvas.drawCircle(Offset(size.width - r - 0.75, size.height / 2), r, Paint()..color = color.withValues(alpha: 0.18));
    canvas.drawCircle(Offset(size.width - r - 0.75, size.height / 2), r, stroke);
  }

  @override
  bool shouldRepaint(_TwiceGlyphPainter old) => old.color != color;
}

/// One mistake hands over to the next as a shared-axis step: the new one glides in from the side
/// the run is moving to (from the right going on, from the left going back) while the old one
/// holds, then drifts a little the other way as it fades. The two overlap, so no frame is ever
/// blank, and the leaving one takes no touch (a quick second tap lands on the new mistake). Under
/// reduced motion it is a short fade in place.
class _StepSwap extends StatefulWidget {
  const _StepSwap({required this.index, required this.child});

  /// The mistake on screen: a lower one than before is a step back.
  final int index;

  /// Keyed by the mistake, so a new one is a new layer.
  final Widget child;

  @override
  State<_StepSwap> createState() => _StepSwapState();
}

class _StepSwapState extends State<_StepSwap> {
  late int _last = widget.index;
  int _direction = 1;

  @override
  void didUpdateWidget(_StepSwap old) {
    super.didUpdateWidget(old);
    if (widget.index != _last) {
      _direction = widget.index < _last ? -1 : 1;
      _last = widget.index;
    }
  }

  @override
  Widget build(BuildContext context) => MmOverlapSwitcher.axis(direction: _direction, fit: StackFit.expand, child: widget.child);
}

/// A horizontal swipe on the mistake goes back to the one before it (and forward again to one
/// already reached). Only steps already reached: a swipe never starts a new repair call.
class _SwipeSteps extends StatelessWidget {
  const _SwipeSteps({required this.run, required this.onGoTo, required this.child});

  final RepairRunState run;
  final bool Function(int index)? onGoTo;
  final Widget child;

  /// The fling speed that counts as a swipe.
  static const double minVelocity = 320;

  @override
  Widget build(BuildContext context) {
    final go = onGoTo;
    if (go == null) return child;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: (d) {
        final v = d.primaryVelocity ?? 0;
        if (v.abs() < minVelocity) return;
        final target = v > 0 ? run.index - 1 : run.index + 1;
        if (run.canGoTo(target)) go(target);
      },
      child: child,
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
  const _TopBar({required this.run, required this.onFinishForNow, this.onGoTo});

  final RepairRunState run;
  final VoidCallback onFinishForNow;
  final bool Function(int index)? onGoTo;

  RunSegmentState _segment(int i) {
    final s = run.steps[i];
    if (s.countsAsRepaired || s.outcome is OutcomeExplained) return RunSegmentState.done;
    return switch (s.outcome) {
      OutcomeKeyReview() => RunSegmentState.reviewed,
      OutcomeSetAside() => RunSegmentState.setAside,
      _ => i == run.index ? RunSegmentState.current : (i <= run.furthest ? RunSegmentState.seen : RunSegmentState.upcoming),
    };
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final n = run.steps.length;
    final go = onGoTo;
    return Padding(
      // A track you can tap is a 48 dp row of its own, so it needs no padding under it.
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.s4, go == null ? MmSpace.s8 : 0),
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
            child: RunTrack(
              segments: [for (var i = 0; i < n; i++) _segment(i)],
              onScreen: run.index,
              onTap: go == null ? null : (i) => go(i),
              canTap: run.canGoTo,
            ),
          ),
        ],
      ),
    );
  }
}

/// The four steps over a worked explanation, beside Mobi: Found sits lit, and 160 ms later (the
/// moment the explanation has landed) the line draws to Repaired and the bubble inks, as Mobi
/// hops. Retested and Still right stay dashed. Only a repair the server acknowledged ([repaired])
/// completes the step. Without [animate] (a repair opened again) it is simply there.
class StageMoment extends StatefulWidget {
  const StageMoment({super.key, required this.repaired, this.animate = true});

  final bool repaired;
  final bool animate;

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
    if (!widget.animate || Motion.reduced(context)) {
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

  // Its place on the page is the row it sits in (beside Mobi), so it brings no padding of its own.
  @override
  Widget build(BuildContext context) => LifeRow(stage: _stage, bubbleSize: 16, animate: widget.animate);
}

/// The question of [questionId] in [attempt], or null.
SnapshotQuestion? questionIn(Attempt? attempt, String questionId) {
  if (attempt == null) return null;
  for (final q in attempt.questions) {
    if (q.id == questionId) return q;
  }
  return null;
}
