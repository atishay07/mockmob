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
import '../model/deck.dart';
import '../state/answers_controller.dart';
import '../widgets/step_layout.dart';
import '../widgets/warmup_option.dart';

/// The warm-up question for [answers]: the weakest chosen subject that has one.
WarmupQuestion warmupQuestionFor(OnboardingAnswers answers) {
  final previous = answers.warmup?.questionId;
  if (previous != null) {
    for (final q in kWarmupPool) {
      if (q.id == previous) return q;
    }
  }
  final subject = answers.ranked.firstWhere(warmupSubjects.contains, orElse: () => SheetSubject.accountancy);
  return warmupFor(subject)!;
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
  late final DateTime _shownAt = ref.read(nowProvider)();

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
          for (var i = 0; i < _q.options.length; i++) ...[
            WarmupOption(
              letter: letters[i],
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
        ],
      ),
      bottom: result == null
          ? Align(
              child: KeyButton.quiet(
                label: OnboardingCopy.skipQuestion,
                onPressed: () {
                  ref.read(onboardingAnswersProvider.notifier).skip(Steps.question);
                  widget.onNext();
                },
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                // The payoff sits with the action, so it is seen without scrolling.
                Semantics(
                  liveRegion: true,
                  child: Text(
                    result.correct ? OnboardingCopy.rightIn((result.millis / 1000).round()) : OnboardingCopy.trapLead,
                    style: type.cardTitle.copyWith(color: result.correct ? colors.ink : colors.wrongText),
                  ),
                ),
                if (!result.correct) ...[
                  const SizedBox(height: MmSpace.s8),
                  DecoratedBox(
                    decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line))),
                    child: Padding(padding: const EdgeInsets.all(MmSpace.s16), child: Text(_q.fix, style: type.small.copyWith(color: colors.ink))),
                  ),
                ],
                const SizedBox(height: MmSpace.s16),
                KeyButton(label: OnboardingCopy.next, onPressed: widget.onNext),
              ],
            ),
    );
  }
}
