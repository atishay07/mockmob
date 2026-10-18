// D96 final fix pass (18 Oct, final walk): the onboarding items.
// - The post-sign-in line says the plan now uses today's answers (an account that had subjects).
// - Subjects: rating a row never re-sorts the list under the finger (11-rated, 12-rated-up).
// - Save: a sign-in key tapped before the age answers at once, in words, where the age is (22-noage).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart' show Steps;
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/colleges_move.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/onboarding/steps/save_step.dart';
import 'package:mockmob/features/onboarding/steps/subjects_step.dart';
import 'package:mockmob/features/onboarding/widgets/sheet_status.dart';
import 'package:mockmob/features/onboarding/widgets/subject_row.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  group('after sign-in, an account that already had subjects', () {
    testWidgets("says in one plain line that the plan now uses today's answers, and what changed", (tester) async {
      await pumpMockmob(tester, const SheetStatus(phase: SheetSyncPhase.updated), size: kPhone, overrides: onboardingOverrides());
      expect(find.text(OnboardingCopy.updatedSheet), findsOneWidget);
      expect(find.text(OnboardingCopy.updatedWhat), findsOneWidget);
      expect(find.text(OnboardingCopy.keptExisting), findsNothing, reason: 'never "we kept them" once the answers were written');
    });

    testWidgets('names the colleges only once the server list has them', (tester) async {
      await pumpMockmob(tester, const SheetStatus(phase: SheetSyncPhase.updated, colleges: CollegesMove.moved), size: kPhone, overrides: onboardingOverrides());
      expect(find.text(OnboardingCopy.updatedWhatColleges), findsOneWidget);
    });

    test('the words are plain: no exclamation, sentence case, the subjects are said to stay', () {
      for (final s in [OnboardingCopy.updatedSheet, OnboardingCopy.updatedWhat, OnboardingCopy.updatedWhatColleges, OnboardingCopy.ageFirstLine]) {
        expect(s, isNot(contains('!')));
        expect(s[0], s[0].toUpperCase());
      }
      expect(OnboardingCopy.updatedWhat, contains('Your subjects stay as they were'));
    });

    test('only a sheet sealed in the last day counts as answers just given', () {
      final now = DateTime(2026, 10, 18, 22, 0);
      expect(SheetSync.justGiven(OnboardingAnswers(sealedAt: DateTime(2026, 10, 18, 21, 40)), now), isTrue);
      expect(SheetSync.justGiven(OnboardingAnswers(sealedAt: DateTime(2026, 10, 16, 21, 40)), now), isFalse);
      expect(SheetSync.justGiven(const OnboardingAnswers(), now), isFalse);
    });
  });

  testWidgets('subjects: rating a row Shaky never moves it; the list keeps its order while the student rates', (tester) async {
    const subjects = [SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics];
    const start = OnboardingAnswers(step: Steps.subjects, courseId: 'b-com-hons', subjects: subjects, subjectsTouched: true);
    await pumpMockmob(
      tester,
      Consumer(
        builder: (context, ref, _) {
          final a = ref.watch(onboardingAnswersProvider).value;
          return a == null ? const SizedBox() : SubjectsStep(answers: a, onNext: () {});
        },
      ),
      size: kPhone,
      disableAnimations: true,
      overrides: onboardingOverrides(answers: start),
    );
    await tester.pumpAndSettle();

    List<SheetSubject> shown() {
      final rows = find.byType(SubjectRow).evaluate().toList()
        ..sort((a, b) => tester.getTopLeft(find.byWidget(a.widget)).dy.compareTo(tester.getTopLeft(find.byWidget(b.widget)).dy));
      return [for (final r in rows) if ((r.widget as SubjectRow).included) (r.widget as SubjectRow).subject];
    }

    expect(shown(), subjects);
    final container = ProviderScope.containerOf(tester.element(find.byType(SubjectsStep)));
    final economicsAt = tester.getTopLeft(find.byWidgetPredicate((w) => w is SubjectRow && w.subject == SheetSubject.economics));
    container.read(onboardingAnswersProvider.notifier).setConfidence(SheetSubject.economics, Confidence.shaky);
    await tester.pumpAndSettle();

    final a = container.read(onboardingAnswersProvider).value!;
    expect(a.ranked.first, SheetSubject.economics, reason: 'weakest first is still what the plan uses');
    expect(shown(), subjects, reason: 'the step itself keeps the order the student sees');
    expect(
      tester.getTopLeft(find.byWidgetPredicate((w) => w is SubjectRow && w.subject == SheetSubject.economics)),
      economicsAt,
      reason: 'the row stays under the finger',
    );
  });

  group('save: a key tapped before the age', () {
    Future<List<String>> pumpSave(WidgetTester tester, {AgeAnswer? age}) async {
      final calls = <String>[];
      await pumpMockmob(
        tester,
        SaveView(
          age: age,
          onAge: (_) => calls.add('age'),
          onGoogle: () => calls.add('google'),
          onEmail: () => calls.add('email'),
          onNotNow: () => calls.add('not now'),
        ),
        size: kPhone,
        disableAnimations: true,
        overrides: onboardingOverrides(),
      );
      await tester.pumpAndSettle();
      return calls;
    }

    String ageLine(WidgetTester tester) => tester.widget<Text>(find.byKey(SaveView.ageLineKey).last).data!;

    testWidgets('the email key answers at once: the line under the age says what is needed, and nothing opens', (tester) async {
      final calls = await pumpSave(tester);
      expect(ageLine(tester), OnboardingCopy.ageNote);
      await tester.tap(find.text(OnboardingCopy.useEmailCode));
      await tester.pumpAndSettle();
      expect(calls, isEmpty, reason: 'no sign-in before the age');
      expect(ageLine(tester), OnboardingCopy.ageFirstLine);
    });

    testWidgets('the Google key does the same', (tester) async {
      final calls = await pumpSave(tester);
      await tester.tap(find.text(OnboardingCopy.continueWithGoogle));
      await tester.pumpAndSettle();
      expect(calls, isEmpty);
      expect(ageLine(tester), OnboardingCopy.ageFirstLine);
    });

    testWidgets('once the age is answered the keys work and the line goes back to the note', (tester) async {
      final calls = await pumpSave(tester, age: AgeAnswer.adult);
      expect(ageLine(tester), OnboardingCopy.ageNote);
      await tester.tap(find.text(OnboardingCopy.useEmailCode));
      await tester.pumpAndSettle();
      expect(calls, ['email']);
      expect(ageLine(tester), OnboardingCopy.ageNote);
    });

    testWidgets('the line under the age takes the same place: the keys do not move when it changes', (tester) async {
      await pumpSave(tester);
      final before = tester.getTopLeft(find.text(OnboardingCopy.useEmailCode));
      await tester.tap(find.text(OnboardingCopy.useEmailCode));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.text(OnboardingCopy.useEmailCode)), before);
    });
  });
}
