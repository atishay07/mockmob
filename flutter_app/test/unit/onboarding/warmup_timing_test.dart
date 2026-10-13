import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/steps/question_step.dart';

import '../../golden/onboarding/support.dart';

void main() {
  // Regression (device pass 2, 13 Oct): the shown time was read lazily at the first tap, so
  // every warm-up answer said "about a second".
  testWidgets('the warm-up times the answer from when the question appeared', (tester) async {
    tester.view.physicalSize = const Size(768, 1706);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    var now = DateTime.utc(2026, 10, 13, 14);
    await tester.pumpWidget(
      ProviderScope(
        overrides: onboardingOverrides(clock: () => now),
        child: MaterialApp(
          theme: buildTheme(Brightness.dark),
          home: Scaffold(
            body: Consumer(
              builder: (context, ref, _) {
                final answers = ref.watch(onboardingAnswersProvider).value ?? OnboardingAnswers.empty;
                return QuestionStep(answers: answers, onNext: () {});
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    now = now.add(const Duration(seconds: 12));
    final q = warmupQuestionFor(OnboardingAnswers.empty);
    await tester.tap(find.bySemanticsLabel(RegExp('^Option ${'ABCD'[q.answer]}, ')).first);
    await tester.pump(const Duration(milliseconds: 500));

    final container = ProviderScope.containerOf(tester.element(find.byType(QuestionStep)));
    final warmup = container.read(onboardingAnswersProvider).value?.warmup;
    expect(warmup?.correct, isTrue);
    expect(warmup?.millis, 12000);
  });
}
