import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/subjects.dart';
import '../data/warmup_pool.dart';
import '../model/answers.dart';
import '../state/answers_controller.dart';
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
  const QuestionStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  ConsumerState<QuestionStep> createState() => _QuestionStepState();
}

class _QuestionStepState extends ConsumerState<QuestionStep> {
  late final WarmupQuestion _q = warmupQuestionFor(widget.answers);
  // Set when the question first shows (a lazy initializer would only run at the first tap,
  // so every answer read as "about a second").
  late final DateTime _shownAt;

  @override
  void initState() {
    super.initState();
    _shownAt = ref.read(nowProvider)();
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
            Semantics(
              liveRegion: true,
              child: Text(
                result.correct ? OnboardingCopy.rightIn((result.millis / 1000).round()) : OnboardingCopy.trapLead,
                style: type.cardTitle.copyWith(color: colors.ink),
              ),
            ),
            if (!result.correct) ...[
              const SizedBox(height: MmSpace.s8),
              DecoratedBox(
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
