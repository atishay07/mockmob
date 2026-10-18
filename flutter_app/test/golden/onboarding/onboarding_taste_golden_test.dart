import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/data/subject_sets.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';

import 'support.dart';

/// The v15 taste pass (owner, 18 Oct 7:40 pm, D89-D90; OWNER-TASTE-PROFILE.md), on the owner's
/// phone (360 by 800) and a tall 412 by 915, Night and Day, and at 1.3x text.
Widget _flow() => const OnboardingFlow(skipColdOpen: true, startInDeck: true);

const Map<String, Size> _sizes = {'360': Size(360, 800), '412': Size(412, 915)};

OnboardingAnswers _notSure(String step) => studentUpTo(Steps.stage, step: step).copyWith(courseUndecided: true).mark(Steps.course);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

void main() {
  for (final e in _sizes.entries) {
    // Subjects: a set tap brings the ratings up under the chosen set; the other sets fold.
    onboardingGolden(
      'taste_subjects_set_${e.key}',
      _flow,
      size: e.value,
      overrides: () => onboardingOverrides(answers: _notSure(Steps.subjects)),
      act: (tester) => _tap(tester, find.text(SubjectSets.commerce.title)),
    );
  }
  onboardingGolden(
    'taste_subjects_set_large_text',
    _flow,
    size: _sizes['360']!,
    textScale: 1.3,
    overrides: () => onboardingOverrides(answers: _notSure(Steps.subjects)),
    act: (tester) => _tap(tester, find.text(SubjectSets.commerce.title)),
  );
}
