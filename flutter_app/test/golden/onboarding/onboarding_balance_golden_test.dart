import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';

import 'support.dart';

/// D40, D43, D44, D48 (owner, 18 Oct, on a 20:9 phone): every onboarding step in the shared frame
/// at the four phone sizes, Night and Day. The group (Mobi, his bubble, the title, the answers)
/// sits balanced in the free height, Mobi sized to the phone, Back left of the primary key.
void main() {
  Widget flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

  final steps = <String, List<Override> Function()>{
    'stage': () => onboardingOverrides(answers: const OnboardingAnswers(step: Steps.stage)),
    'course': () => onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)),
    'subjects': () => onboardingOverrides(answers: studentUpTo(Steps.subjects)),
    'worry': () => onboardingOverrides(answers: studentUpTo(Steps.worry)),
    'question': () => onboardingOverrides(answers: studentUpTo(Steps.worry, step: Steps.question)),
    'rhythm': () => onboardingOverrides(answers: studentUpTo(Steps.rhythm)),
    'plan': () => onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)),
    'save': () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)),
    'first_move': () => onboardingOverrides(
          answers: studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(age: AgeAnswer.minor, notNow: true),
        ),
  };
  const sizes = {
    '360x800': Size(360, 800),
    '390x844': Size(390, 844),
    '412x915': Size(412, 915),
    '360x640': Size(360, 640),
  };

  for (final size in sizes.entries) {
    onboardingGolden('balance_welcome_${size.key}', () => const OnboardingFlow(skipColdOpen: true), size: size.value);
    for (final step in steps.entries) {
      onboardingGolden('balance_${step.key}_${size.key}', flow, size: size.value, overrides: step.value);
    }
  }
}
