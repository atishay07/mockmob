import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/step_layout.dart';

/// Step 6: where the marks go, in the student's words. The answer rewrites the first move on
/// the sheet above, and Mobi says one line about what happens next.
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
      bottom: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedSwitcher(
            duration: Motion.of(context, Motion.glideDuration),
            switchInCurve: Motion.glide,
            child: worry == null
                ? const SizedBox(width: double.infinity)
                : Padding(
                    key: ValueKey(worry),
                    padding: const EdgeInsets.only(bottom: MmSpace.s12),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Mobi(pose: MobiPose.point, size: 76, motion: MobiMotion.settle, say: worry.mobiLine, sayLive: true),
                    ),
                  ),
          ),
          KeyButton(label: OnboardingCopy.next, onPressed: worry == null ? null : onNext),
        ],
      ),
    );
  }
}
