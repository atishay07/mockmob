import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/step_layout.dart';

/// Step 6: where the marks go, in the student's words. The answer rewrites the first move on
/// the sheet above; the guide Mobi, thinking while the student reads, says what happens next.
class WorryStep extends ConsumerWidget {
  const WorryStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final worry = answers.worry;
    return StepLayout(
      title: OnboardingCopy.worryTitle,
      support: OnboardingCopy.worrySupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, w) in Worry.values.indexed) ...[
            MmSelectRow(
              letter: kAnswerLetters[i],
              title: w.option,
              selected: worry == w,
              onTap: () => ref.read(onboardingAnswersProvider.notifier).setWorry(w),
            ),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
      bottom: KeyButton(label: OnboardingCopy.next, onPressed: worry == null ? null : onNext),
    );
  }
}
