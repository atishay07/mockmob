import 'package:flutter/material.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';

import 'support.dart';

/// The owner's 19 Oct hand check and the fresh-account walk of the same night (PLAN-1019 G1, G3,
/// G4, G6, G9 and BASELINE-FINDINGS 10-20), on a 360 dp phone and a 412 dp one, Night and Day,
/// and at 1.3x text where the line is long.
///
/// - the course tiles in the order of aspirant demand (G4);
/// - the college ladder with five picks numbered down last year's marks, each with its number (G6);
/// - the subjects step with the course's rule before any pick (G9), then with picks that say Okay is
///   only a guess (#16);
/// - the plan with whole-sentence lines and "Hold to confirm" (G1, #18);
/// - the timed question with its progress in the bar (#19);
/// - the save step with the keys waiting in the glass style until the age is answered (#17).
Widget _flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

const Map<String, Size> _sizes = {'360x800': Size(360, 800), '412x915': Size(412, 915)};

/// The five colleges of the walk, picked in this order (Hansraj first, as a student would).
const List<String> _walkPicks = [
  'Hansraj College',
  'Shri Ram College of Commerce',
  'Hindu College',
  'Lady Shri Ram College for Women (W)',
  'Kirori Mal College',
];

OnboardingAnswers _picks() => OnboardingAnswers.fromJson(
      studentUpTo(Steps.stage, step: Steps.course).copyWith(courseId: 'b-com-hons', colleges: _walkPicks).toJson(),
    );

void main() {
  for (final e in _sizes.entries) {
    final size = e.value;
    final tag = e.key;

    onboardingGolden('o1019_course_$tag', _flow, size: size, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)));

    onboardingGolden('o1019_ladder_five_$tag', _flow, size: size, overrides: () => onboardingOverrides(answers: _picks()));

    onboardingGolden(
      'o1019_subjects_rule_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(
        answers: studentUpTo(Steps.course, step: Steps.subjects).copyWith(courseId: 'b-com-hons', subjects: const [], subjectsTouched: true),
      ),
    );

    onboardingGolden(
      'o1019_subjects_guess_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(
        answers: studentUpTo(Steps.course, step: Steps.subjects).copyWith(courseId: 'b-com-hons', subjectsTouched: true, confidence: const {}),
      ),
    );

    onboardingGolden('o1019_plan_$tag', _flow, size: size, overrides: () => onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan)));

    onboardingGolden(
      'o1019_question_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.worry, step: Steps.question)),
    );

    onboardingGolden(
      'o1019_save_waiting_$tag',
      _flow,
      size: size,
      overrides: () => onboardingOverrides(answers: studentUpTo(Steps.plan, step: Steps.save)),
    );

    onboardingGolden('o1019_welcome_$tag', () => const OnboardingFlow(skipColdOpen: true), size: size);
  }

  // The long lines at 1.3x text, on the shortest common phone.
  const small = Size(360, 800);
  onboardingGolden(
    'o1019_subjects_rule_360_x13',
    _flow,
    size: small,
    textScale: 1.3,
    overrides: () => onboardingOverrides(
      answers: studentUpTo(Steps.course, step: Steps.subjects).copyWith(courseId: 'b-com-hons', subjects: const [], subjectsTouched: true),
    ),
  );
  onboardingGolden(
    'o1019_plan_360_x13',
    _flow,
    size: small,
    textScale: 1.3,
    overrides: () => onboardingOverrides(answers: studentUpTo(Steps.rhythm, step: Steps.plan).copyWith(worries: const [Worry.time, Worry.passages, Worry.knewIt])),
  );
  onboardingGolden('o1019_welcome_360_x13', () => const OnboardingFlow(skipColdOpen: true), size: small, textScale: 1.3);
}
