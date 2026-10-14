import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/subjects.dart';
import '../data/warmup_pool.dart';
import '../model/answers.dart';
import '../state/answers_controller.dart';
import '../widgets/pace_line.dart';
import '../widgets/step_layout.dart';
import '../widgets/warmup_option.dart';

/// The warm-up question for [answers]: the weakest chosen subject that has one, picked by the
/// student's seed. Once answered, the same question again.
WarmupQuestion warmupQuestionFor(OnboardingAnswers answers) {
  final previous = answers.warmup?.questionId;
  if (previous != null) {
    for (final q in kWarmupPool) {
      if (q.id == previous) return q;
    }
  }
  final subject = answers.ranked.firstWhere(warmupSubjects.contains, orElse: () => SheetSubject.accountancy);
  return warmupFor(subject, seed: answers.seed ?? 0)!;
}

/// Step 7: one real question in the weakest subject, on a calm solid surface. A right answer
/// shows the measured time; a wrong one shows the trap and the ten-second fix. Nothing buzzes on
/// a wrong answer.
class QuestionStep extends ConsumerStatefulWidget {
  const QuestionStep({super.key, required this.answers, required this.onNext, this.mobi});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  /// The guide Mobi of the top bar. Given, he thinks it over when the question has been open for
  /// 20 seconds, and after a wrong answer he points down at the ten-second fix (the flow plays the
  /// right and wrong reactions themselves).
  final MobiController? mobi;

  /// How long the question waits before Mobi thinks beside the student.
  static const Duration thinkAfter = Duration(seconds: 20);

  /// How long after a wrong answer he waits to point at the fix: the encouraging nod finishes first.
  static const Duration pointAfter = Duration(milliseconds: 1500);

  @override
  ConsumerState<QuestionStep> createState() => _QuestionStepState();
}

class _QuestionStepState extends ConsumerState<QuestionStep> {
  late final WarmupQuestion _q = warmupQuestionFor(widget.answers);
  // Set when the question first shows (a lazy initializer would only run at the first tap,
  // so every answer read as "about a second").
  late final DateTime _shownAt;
  Timer? _think;
  Timer? _point;
  final GlobalKey _fixKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _shownAt = ref.read(nowProvider)();
    if (widget.answers.warmup == null) {
      _think = Timer(QuestionStep.thinkAfter, () {
        if (mounted && widget.answers.warmup == null && !Motion.reduced(context)) widget.mobi?.react(MobiAct.think);
      });
    }
  }

  @override
  void didUpdateWidget(QuestionStep old) {
    super.didUpdateWidget(old);
    final was = old.answers.warmup, now = widget.answers.warmup;
    if (was == null && now != null) {
      _think?.cancel();
      // A wrong answer: after his nod, he points at the fix. No shake, no buzz.
      if (!now.correct) {
        _point = Timer(QuestionStep.pointAfter, () {
          if (mounted && !Motion.reduced(context)) widget.mobi?.pointAtWidget(_fixKey);
        });
      }
    }
  }

  @override
  void dispose() {
    _think?.cancel();
    _point?.cancel();
    super.dispose();
  }

  void _choose(int i) {
    if (widget.answers.warmup != null) return;
    final ms = ref.read(nowProvider)().difference(_shownAt).inMilliseconds;
    ref.read(hapticsProvider).selection();
    ref.read(onboardingAnswersProvider.notifier).recordWarmup(
          WarmupResult(questionId: _q.id, chosen: i, correct: i == _q.answer, millis: ms < 0 ? 0 : ms),
        );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final result = widget.answers.warmup?.questionId == _q.id ? widget.answers.warmup : null;
    const letters = ['A', 'B', 'C', 'D'];

    return StepLayout(
      title: OnboardingCopy.questionTitle(_q.subject.label),
      support: _q.chapter,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Clock(since: _shownAt, stoppedAt: result?.millis),
          const SizedBox(height: MmSpace.s12),
          Text(_q.stem, style: type.question),
          const SizedBox(height: MmSpace.s20),
          // Shown in the question's stable shuffled order; the choice is stored as the index
          // into the authored options.
          for (final (shown, i) in _q.order.indexed) ...[
            WarmupOption(
              letter: letters[shown],
              text: _q.options[i],
              state: result == null
                  ? WarmupOptionState.open
                  : (i == _q.answer
                      ? WarmupOptionState.right
                      : (i == result.chosen ? WarmupOptionState.wrong : WarmupOptionState.dimmed)),
              onTap: result == null ? () => _choose(i) : null,
            ),
            const SizedBox(height: MmSpace.s8),
          ],
          // The payoff sits right under the options, so every option stays in view above it.
          if (result != null) ...[
            const SizedBox(height: MmSpace.s8),
            if (result.correct)
              // The measured time is the payoff: a monumental number that rolls in.
              Semantics(
                liveRegion: true,
                label: '${OnboardingCopy.rightIn((result.millis / 1000).round())} '
                    '${OnboardingCopy.paceSpoken((result.millis / 1000).round())}',
                excludeSemantics: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        MonumentalNumber(value: '${math.max(1, (result.millis / 1000).round())}', style: type.figure),
                        const SizedBox(width: MmSpace.s12),
                        Expanded(
                          child: Text(
                            OnboardingCopy.rightSeconds((result.millis / 1000).round()),
                            style: type.cardTitle.copyWith(color: colors.ink),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s12),
                    PaceLine(seconds: result.millis / 1000),
                  ],
                ),
              )
            else
              Semantics(
                liveRegion: true,
                child: Text(OnboardingCopy.trapLead, style: type.cardTitle.copyWith(color: colors.ink)),
              ),
            if (!result.correct) ...[
              const SizedBox(height: MmSpace.s8),
              DecoratedBox(
                key: _fixKey,
                decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line))),
                child: Padding(padding: const EdgeInsets.all(MmSpace.s16), child: Text(_q.fix, style: type.small.copyWith(color: colors.ink))),
              ),
            ],
          ],
        ],
      ),
      // Skipping lives in the top bar; the only key here is Continue, once answered.
      bottom: result == null ? null : KeyButton(label: OnboardingCopy.next, onPressed: widget.onNext),
    );
  }
}

/// The clock the warm-up is timed by, quiet above the question: the seconds since it appeared,
/// stopped at the answer. Its own repaint boundary; it ticks once a second and never moves.
class _Clock extends ConsumerStatefulWidget {
  const _Clock({required this.since, required this.stoppedAt});

  final DateTime since;

  /// The measured time once answered.
  final int? stoppedAt;

  @override
  ConsumerState<_Clock> createState() => _ClockState();
}

class _ClockState extends ConsumerState<_Clock> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    if (widget.stoppedAt == null) _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void didUpdateWidget(_Clock old) {
    super.didUpdateWidget(old);
    if (widget.stoppedAt != null) _tick?.cancel();
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ms = widget.stoppedAt ?? ref.read(nowProvider)().difference(widget.since).inMilliseconds;
    final s = (ms < 0 ? 0 : ms) ~/ 1000;
    final text = '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
    final ink = widget.stoppedAt == null ? colors.ink3 : colors.ink2;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: Row(
          children: [
            Icon(LucideIcons.timer, size: 15, color: ink),
            const SizedBox(width: MmSpace.s4),
            Text(text, style: type.label.copyWith(color: ink)),
          ],
        ),
      ),
    );
  }
}
