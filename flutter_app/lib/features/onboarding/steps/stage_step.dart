import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../state/answers_controller.dart';
import '../widgets/step_layout.dart';

/// Step 3: where the student is. The weeks to the expected window roll onto the sheet above.
class StageStep extends ConsumerWidget {
  const StageStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stage = answers.stage;
    final note = switch (stage) {
      Stage.classTwelve => OnboardingCopy.boardsNote,
      Stage.classEleven => OnboardingCopy.classElevenNote,
      _ => null,
    };
    return StepLayout(
      title: OnboardingCopy.stageTitle,
      support: note ?? OnboardingCopy.stageSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final s in Stage.values) ...[
            MmSelectRow(
              title: s.option,
              selected: stage == s,
              onTap: () => ref.read(onboardingAnswersProvider.notifier).setStage(s),
            ),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
      bottom: KeyButton(label: OnboardingCopy.next, onPressed: stage == null ? null : onNext),
    );
  }
}
