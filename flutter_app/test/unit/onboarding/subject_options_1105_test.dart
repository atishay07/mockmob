// Owner, 5 Nov 2026 (LK94): "Wherever we have subjects like this where they have multiple options or they have to select only
// one, while onboarding, they should be asked just right there and all this should be clarified." The subjects step asks a
// chosen subject's option under its ratings: the question, two options with one line each, the default ticked, "You can change
// this later in Learn."; Next keeps the ticked one, default or picked, as the answer the account gets.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/subject_options.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmPressable;
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart' show Steps;
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/steps/subjects_step.dart';
import 'package:mockmob/features/onboarding/widgets/subject_option_picker.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

const _subjects = [SheetSubject.english, SheetSubject.accountancy, SheetSubject.economics, SheetSubject.mathematics];

Future<ProviderContainer> _pumpStep(WidgetTester tester, {OnboardingAnswers? answers, List<OnboardingAnswers>? next}) async {
  final start = answers ?? const OnboardingAnswers(step: Steps.subjects, courseId: 'b-com-hons', subjects: _subjects, subjectsTouched: true);
  await pumpMockmob(
    tester,
    Consumer(
      builder: (context, ref, _) {
        final a = ref.watch(onboardingAnswersProvider).value;
        return a == null ? const SizedBox() : SubjectsStep(answers: a, onNext: () => next?.add(ref.read(onboardingAnswersProvider).value!));
      },
    ),
    size: kPhone,
    disableAnimations: true,
    overrides: onboardingOverrides(answers: start),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(SubjectsStep)));
}

bool _ticked(WidgetTester tester, String subject, String id) =>
    tester.widget<MmPressable>(find.descendant(of: find.byKey(SubjectOptionPicker.choiceKey(subject, id)), matching: find.byType(MmPressable))).selected == true;

void main() {
  setUpAll(loadAppFonts);

  group('the answers', () {
    test('an option is kept per subject, read back the same, and anything not one of its choices is dropped', () {
      const a = OnboardingAnswers(subjects: _subjects, options: {SheetSubject.accountancy: 'CAS', SheetSubject.mathematics: 'B2'});
      final back = OnboardingAnswers.fromJson(a.toJson());
      expect(back.options, {SheetSubject.accountancy: 'CAS', SheetSubject.mathematics: 'B2'});
      final odd = OnboardingAnswers.fromJson({
        ...a.toJson(),
        'options': {'accountancy': 'cas', 'mathematics': 'B3', 'economics': 'B1', 'nonsense': 'AFS', 'computer_science': 7},
      });
      expect(odd.options, {SheetSubject.accountancy: 'CAS'}, reason: 'normalised like the website; the rest dropped');
      expect(OnboardingAnswers.fromJson({...a.toJson()}..remove('options')).options, isEmpty, reason: 'a sheet from before keeps none');
    });

    test('the ticked option is the answered one, else the default; Next keeps them as answers', () {
      const a = OnboardingAnswers(subjects: _subjects, options: {SheetSubject.accountancy: 'CAS'});
      expect(a.optionFor(SheetSubject.accountancy), 'CAS');
      expect(a.optionFor(SheetSubject.mathematics), 'B1');
      expect(a.optionFor(SheetSubject.economics), isNull);
      expect(a.withShownOptions().options, {SheetSubject.accountancy: 'CAS', SheetSubject.mathematics: 'B1'});
      expect(const OnboardingAnswers().blank, isTrue, reason: 'no options is still a blank sheet');
    });
  });

  group('the subjects step', () {
    testWidgets('a chosen subject with options asks it right there: the question, two options with one line each, the default ticked', (tester) async {
      await _pumpStep(tester);
      for (final id in ['accountancy', 'mathematics']) {
        final set = kSubjectOptions[id]!;
        expect(find.byKey(SubjectOptionPicker.keyFor(id)), findsOneWidget, reason: id);
        expect(find.text(set.question), findsOneWidget);
        for (final c in set.choices) {
          expect(find.text(c.label), findsOneWidget);
          expect(find.text(c.note), findsOneWidget);
        }
        expect(_ticked(tester, id, set.defaultId), isTrue, reason: '$id: its default is ticked');
      }
      expect(find.text(kSubjectOptionLater), findsNWidgets(2), reason: 'once under each question');
      expect(find.byKey(SubjectOptionPicker.keyFor('economics')), findsNothing, reason: 'a subject without options asks nothing');
    });

    testWidgets('picking the other option ticks it and keeps it on the sheet; Next keeps every ticked one', (tester) async {
      final passed = <OnboardingAnswers>[];
      final c = await _pumpStep(tester, next: passed);
      await tester.ensureVisible(find.byKey(SubjectOptionPicker.choiceKey('accountancy', 'CAS')));
      await tester.tap(find.byKey(SubjectOptionPicker.choiceKey('accountancy', 'CAS')));
      await tester.pumpAndSettle();
      expect(_ticked(tester, 'accountancy', 'CAS'), isTrue);
      expect(_ticked(tester, 'accountancy', 'AFS'), isFalse);
      expect(c.read(onboardingAnswersProvider).value!.options, {SheetSubject.accountancy: 'CAS'});

      await tester.ensureVisible(find.text(OnboardingCopy.next));
      await tester.tap(find.text(OnboardingCopy.next));
      await tester.pumpAndSettle();
      expect(passed, hasLength(1));
      expect(passed.single.options, {SheetSubject.accountancy: 'CAS', SheetSubject.mathematics: 'B1'}, reason: 'the default Maths showed is kept too');
    });

    testWidgets('a subject taken off the sheet takes its question with it', (tester) async {
      final c = await _pumpStep(tester);
      c.read(onboardingAnswersProvider.notifier).toggleSubject(SheetSubject.mathematics);
      await tester.pumpAndSettle();
      expect(find.byKey(SubjectOptionPicker.keyFor('mathematics')), findsNothing);
      expect(find.byKey(SubjectOptionPicker.keyFor('accountancy')), findsOneWidget);
    });

    testWidgets('each option is a 48 dp target read as a choice in a group, the question with the subject', (tester) async {
      final handle = tester.ensureSemantics();
      await _pumpStep(tester);
      for (final c in kSubjectOptions['accountancy']!.choices) {
        final f = find.byKey(SubjectOptionPicker.choiceKey('accountancy', c.id));
        expect(tester.getSize(f).height, greaterThanOrEqualTo(48));
        final data = tester.getSemantics(f).getSemanticsData();
        expect(data.label, '${c.label}. ${c.note}');
        expect(data.flagsCollection.isInMutuallyExclusiveGroup, isTrue);
      }
      // The group is read with its subject and question first (its note follows in the same node).
      expect(find.bySemanticsLabel(RegExp(r'^Accountancy, Which Part B does your school teach\?')), findsOneWidget);
      handle.dispose();
    });
  });
}
