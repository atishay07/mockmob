import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subject_registry.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/widgets/subject_picker.dart';
import 'package:mockmob/features/onboarding/widgets/subject_row.dart' show SubjectLine;

import '../../golden/onboarding/subject_rows.dart';
import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';

Future<ProviderContainer> _pump(WidgetTester tester, OnboardingAnswers answers) async {
  tester.view.physicalSize = const Size(768, 3000);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: onboardingOverrides(answers: answers),
    child: MaterialApp(
      theme: buildTheme(Brightness.dark),
      home: const Scaffold(body: SingleChildScrollView(child: SubjectPicker())),
    ),
  ));
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 200));
  }
  return ProviderScope.containerOf(tester.element(find.byType(SubjectPicker)));
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a subject line is 56 dp at least: a selectable row (SPACING 4.3)', (tester) async {
    tester.view.physicalSize = const Size(768, 800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.dark),
      home: const Scaffold(
        body: Column(children: [SubjectLine(subject: SheetSubject.accountancy, chosen: true)]),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.getSize(find.byType(SubjectLine)).height, greaterThanOrEqualTo(56));
  });

  test('the live list: 15 practice subjects, languages apart, merged and retired rows left out', () {
    final r = SubjectRegistry.fromRows(kSubjectRows);
    expect(r.live, isTrue);
    expect(r.offered, SheetSubject.values);
    final ids = r.unoffered.map((u) => u.id).toSet();
    expect(ids, containsAll(['hindi', 'agriculture', 'fine_arts', 'sanskrit']));
    expect(ids, isNot(contains('applied_mathematics')), reason: 'merged into Mathematics');
    expect(ids, isNot(contains('legal_studies')), reason: 'retired from the 2026 list');
    expect(r.unoffered.firstWhere((u) => u.id == 'hindi').language, isTrue);
    expect(r.unoffered.firstWhere((u) => u.id == 'sanskrit').language, isFalse, reason: 'Sanskrit is a domain paper (325)');
    expect(r.unoffered.firstWhere((u) => u.id == 'fine_arts').name, 'Fine Arts');
  });

  testWidgets('every group shows, search narrows it, and not-offered subjects cannot be chosen', (tester) async {
    final c = await _pump(tester, const OnboardingAnswers(step: Steps.subjects));
    for (final s in SheetSubject.values) {
      expect(find.text(s.label), findsOneWidget, reason: s.id);
    }
    expect(find.text(OnboardingCopy.notOfferedTitle), findsOneWidget);
    expect(find.text(OnboardingCopy.languagesLabel), findsOneWidget);
    expect(find.text('Hindi'), findsOneWidget);

    await tester.tap(find.text('Agriculture'));
    await tester.pump();
    expect(c.read(onboardingAnswersProvider).value!.subjects, isEmpty);

    await tester.enterText(find.byType(TextField), 'pol');
    await tester.pump();
    expect(find.text('Political Science'), findsOneWidget);
    expect(find.text('Physics'), findsNothing);

    await tester.tap(find.text('Political Science'));
    await tester.pump();
    expect(c.read(onboardingAnswersProvider).value!.subjects, [SheetSubject.politicalScience]);
    expect(find.text(OnboardingCopy.pickerCount(1)), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pump();
    expect(find.text(OnboardingCopy.noMatch('zzz')), findsOneWidget);
  });

  testWidgets('a sixth subject is refused with the reason, and nothing changes', (tester) async {
    const five = [
      SheetSubject.english,
      SheetSubject.accountancy,
      SheetSubject.economics,
      SheetSubject.businessStudies,
      SheetSubject.generalTest,
    ];
    final c = await _pump(tester, const OnboardingAnswers(step: Steps.subjects, subjects: five));
    await tester.tap(find.text('History'));
    await tester.pump();
    expect(find.text(OnboardingCopy.fiveMax), findsOneWidget);
    expect(c.read(onboardingAnswersProvider).value!.subjects, five);
  });
}
