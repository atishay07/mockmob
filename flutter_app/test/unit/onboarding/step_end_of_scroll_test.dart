import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/widgets/step_layout.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// On every step with a pinned key, scrolled to its end, the last control stands clear of the fade
/// above the key (nothing is half-dimmed or cut at rest). 360 by 640 is the shortest phone.
Future<void> _atEnd(WidgetTester tester, OnboardingAnswers answers, {Size size = const Size(360, 640), double scale = 1}) async {
  tester.view.padding = const FakeViewPadding(top: 48, bottom: 32);
  await pumpMockmob(
    tester,
    const OnboardingFlow(skipColdOpen: true, startInDeck: true),
    brightness: Brightness.dark,
    size: size,
    textScale: scale,
    disableAnimations: true,
    overrides: onboardingOverrides(answers: answers),
  );
  for (var i = 0; i < 3; i++) {
    await tester.pump(const Duration(milliseconds: 400));
  }
  final scroll = find.byType(SingleChildScrollView).first;
  await tester.drag(scroll, const Offset(0, -4000));
  await tester.pumpAndSettle();
  final viewport = tester.getRect(scroll);
  final content = tester.getRect(find.descendant(of: scroll, matching: find.byType(Column)).first);
  expect(
    content.bottom,
    lessThanOrEqualTo(viewport.bottom - StepLayout.fade + 0.5),
    reason: 'the last control ends ${content.bottom - (viewport.bottom - StepLayout.fade)} dp under the fade',
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final entry in {
    'stage': studentUpTo(Steps.stage, step: Steps.stage).copyWith(done: const {}),
    'course ladder': studentUpTo(Steps.course),
    'course ladder with eight picks': studentUpTo(Steps.course).copyWith(
      colleges: [for (final o in DuCatalog.course('b-com-hons')!.ladder('UR').take(8)) o.college],
    ),
    'subjects': studentUpTo(Steps.subjects),
    'rhythm': studentUpTo(Steps.rhythm),
  }.entries) {
    testWidgets('${entry.key}: the last control clears the fade at the end of the scroll', (tester) async {
      await _atEnd(tester, entry.value);
    });
    testWidgets('${entry.key}: also at 1.3x text', (tester) async {
      await _atEnd(tester, entry.value, scale: 1.3);
    });
  }

  testWidgets('with the keyboard up on the college search, the pinned key and the sheet strip step aside', (tester) async {
    tester.view.padding = const FakeViewPadding(top: 48, bottom: 32);
    await pumpMockmob(
      tester,
      const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      brightness: Brightness.dark,
      size: const Size(360, 640),
      disableAnimations: true,
      overrides: onboardingOverrides(answers: studentUpTo(Steps.course)),
    );
    for (var i = 0; i < 3; i++) {
      await tester.pump(const Duration(milliseconds: 400));
    }
    final field = find.byType(TextField);
    expect(find.text('Continue'), findsOneWidget, reason: 'the key is there while the keyboard is down');
    await tester.tap(field);
    await tester.pump();
    tester.view.viewInsets = const FakeViewPadding(bottom: 600); // a 300 dp keyboard
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    expect(find.text('Continue'), findsNothing, reason: 'the key would sit on the keyboard');
    // The field and at least three rungs are in view above the keyboard (the body ends at 640 - 300).
    final above = 640.0 - 300.0;
    final rung = find.text('Shri Ram College of Commerce');
    expect(tester.getRect(field).bottom, lessThanOrEqualTo(above));
    await tester.enterText(field, 'college');
    await tester.pumpAndSettle();
    final visible = [for (final n in ['Shri Ram College of Commerce', 'Hindu College', 'Lady Shri Ram College for Women', 'Hansraj College']) if (find.text(n).evaluate().isNotEmpty && tester.getRect(find.text(n)).bottom <= above) n];
    expect(rung, findsOneWidget);
    expect(visible.length, greaterThanOrEqualTo(3), reason: 'rungs in view: $visible');
  });
}
