import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmPressable;
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/goal_copy.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/features/onboarding/data/calendar.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/data/subject_sets.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/model/plan.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/state/mobi_cues.dart';
import 'package:mockmob/features/onboarding/widgets/course_list_sheet.dart';
import 'package:mockmob/features/onboarding/widgets/runway_strip.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Future<(ProviderContainer, AnswersController)> _controller() async {
  final c = ProviderContainer(overrides: [answersStoreProvider.overrideWithValue(AnswersStore(MemoryPrefsStore()))]);
  addTearDown(c.dispose);
  await c.read(onboardingAnswersProvider.future);
  return (c, c.read(onboardingAnswersProvider.notifier));
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

/// The flow at a step, on a 360 by 800 phone, signed out.
Future<ProviderContainer> _flowAt(WidgetTester tester, OnboardingAnswers answers, {double textScale = 1}) async {
  tester.view.physicalSize = const Size(720, 1600);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: onboardingOverrides(answers: answers),
    child: DefaultAssetBundle(
      bundle: FileAssetBundle(),
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: child!),
        home: const OnboardingFlow(skipColdOpen: true, startInDeck: true),
      ),
    ),
  ));
  await _settle(tester);
  return ProviderScope.containerOf(tester.element(find.byType(OnboardingFlow)));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pump();
  await tester.tap(f);
  await _settle(tester);
}

OnboardingAnswers _answers(ProviderContainer c) => c.read(onboardingAnswersProvider).value!;

void main() {
  setUpAll(loadAppFonts);

  group('D42 no assumed subjects', () {
    test('"Not sure yet" leaves the sheet without subjects; a course ticks only what it needs', () async {
      final (c, answers) = await _controller();
      answers.setCourse(null, undecided: true);
      answers.ensureSubjects();
      expect(_answers(c).subjects, isEmpty);

      answers.setCourse('bachelor-of-management-studies-bms');
      expect(_answers(c).subjects, [SheetSubject.mathematics, SheetSubject.generalTest]);
      answers.setCourse('b-com-hons');
      expect(_answers(c).subjects, isEmpty, reason: 'Maths or Accountancy: neither is needed by every combination');
    });

    test('a common set ticks in one tap and a second tap takes it off again', () async {
      final (c, answers) = await _controller();
      answers.setCourse('b-a-hons-economics');
      answers.applySubjectSet(SubjectSets.commerceMaths.subjects);
      expect(_answers(c).subjects.toSet(), SubjectSets.commerceMaths.subjects.toSet());
      expect(_answers(c).subjectsTouched, isTrue);
      answers.applySubjectSet(SubjectSets.commerceMaths.subjects);
      expect(_answers(c).subjects, [SheetSubject.mathematics], reason: 'back to what the course needs');
    });

    test('sets keep the course open: BMS gets Maths and General Test; a science course gets none', () {
      expect(SubjectSets.forCourse(null).length, 3);
      expect(SubjectSets.forCourse(DuCatalog.course('bachelor-of-management-studies-bms')), [SubjectSets.mathsTest]);
      expect(SubjectSets.forCourse(DuCatalog.course('b-sc-hons-physics')), isEmpty);
      expect(SubjectSets.forCourse(DuCatalog.course('b-com-hons')).length, 3);
    });

    testWidgets('the subjects step opens with Add a subject on top, the sets as suggestions and nothing ticked', (tester) async {
      final start = studentUpTo(Steps.stage, step: Steps.subjects).copyWith(courseUndecided: true).mark(Steps.course);
      final c = await _flowAt(tester, start);
      expect(_answers(c).subjects, isEmpty);
      final add = tester.getTopLeft(find.text(OnboardingCopy.addSubject).first).dy;
      final set = tester.getTopLeft(find.text(SubjectSets.commerce.title)).dy;
      expect(add, lessThan(set), reason: 'Add a subject leads');
      expect(find.text(OnboardingCopy.commonPicks), findsNothing, reason: 'no single picks before a subject is chosen');
      await _tap(tester, find.text(SubjectSets.commerceTest.title));
      expect(_answers(c).subjects.toSet(), SubjectSets.commerceTest.subjects.toSet());
    });

    for (final scale in const [1.0, 1.3]) {
      testWidgets('the Add a subject card holds its note inside its border at ${scale}x text (v15 final walk)', (tester) async {
        final start = studentUpTo(Steps.stage, step: Steps.subjects).copyWith(courseUndecided: true).mark(Steps.course);
        await _flowAt(tester, start, textScale: scale);
        final card = tester.getRect(find.ancestor(of: find.text(OnboardingCopy.addSubject).first, matching: find.byType(MmPressable)).first);
        final title = tester.getRect(find.text(OnboardingCopy.addSubject).first);
        final note = tester.getRect(find.text(OnboardingCopy.addSubjectNote));
        expect(title.top, greaterThanOrEqualTo(card.top + 7), reason: 'air above the title');
        expect(note.bottom, lessThanOrEqualTo(card.bottom - 7), reason: 'air under the note: it never sits on the border');
        expect(note.right, lessThanOrEqualTo(card.right - 16 - 18), reason: 'the note stops before the chevron');
        if (scale == 1) expect(note.height, lessThan(20), reason: 'one line on a 360 dp phone');
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('with a course, the needed subjects say so', (tester) async {
      final start = studentUpTo(Steps.stage, step: Steps.subjects).copyWith(courseId: 'bachelor-of-management-studies-bms', subjects: const []).mark(Steps.course);
      await _flowAt(tester, start);
      expect(find.text(ChoicesCopy.neededFor('BMS')), findsNWidgets(2));
    });
  });

  group('D41 courses', () {
    testWidgets('each tile carries its Bulletin combination; More courses finds and picks any course', (tester) async {
      final c = await _flowAt(tester, studentUpTo(Steps.stage, step: Steps.course));
      expect(find.text('A language + Maths or Accountancy + any 2 subjects'), findsOneWidget);
      expect(find.text(OnboardingCopy.notSure), findsOneWidget);
      await _tap(tester, find.text(ChoicesCopy.moreCourses));
      expect(find.byType(CourseList), findsOneWidget);
      await tester.enterText(find.descendant(of: find.byType(CourseList), matching: find.byType(TextField)), 'physics');
      await _settle(tester);
      expect(find.text('B.Sc (Hons) Physics'), findsOneWidget);
      expect(find.descendant(of: find.byType(CourseList), matching: find.text('B.Com (Hons)')), findsNothing, reason: 'the search narrows the list');
      await _tap(tester, find.text('B.Sc (Hons) Physics'));
      expect(_answers(c).courseId, 'b-sc-hons-physics');
      expect(find.text(OnboardingCopy.ladderTitle), findsOneWidget, reason: 'its college ladder unfolds');
    });
  });

  group('D45 up to three picks', () {
    test('a fourth pick replaces the Third, never the First; the first is the primary', () async {
      final (c, answers) = await _controller();
      expect(answers.toggleWorry(Worry.time), isNull);
      answers.toggleWorry(Worry.numericals);
      answers.toggleWorry(Worry.passages);
      expect(_answers(c).worries, [Worry.time, Worry.numericals, Worry.passages]);
      expect(_answers(c).worry, Worry.time);
      expect(answers.toggleWorry(Worry.knewIt), Worry.passages, reason: 'the step names the pick that went');
      expect(_answers(c).worries, [Worry.time, Worry.numericals, Worry.knewIt]);
      expect(_answers(c).worry, Worry.time, reason: 'the pick that sets the start never changes silently');
      answers
        ..toggleWorry(Worry.numericals)
        ..toggleWorry(Worry.time)
        ..toggleWorry(Worry.knewIt);
      expect(_answers(c).worries, isEmpty);
      expect(_answers(c).isDone(Steps.worry), isFalse, reason: 'nothing picked: unanswered again');
    });

    test('stored with every pick; a sheet from before D45 still loads its one worry', () {
      final a = const OnboardingAnswers().copyWith(worries: const [Worry.syllabus, Worry.time]);
      final back = OnboardingAnswers.fromJson(jsonDecode(jsonEncode(a.toJson())) as Map<String, Object?>);
      expect(back.worries, [Worry.syllabus, Worry.time]);
      final old = {...const OnboardingAnswers().toJson()..remove('worries'), 'worry': 'numericals'};
      expect(OnboardingAnswers.fromJson(old).worries, [Worry.numericals]);
      // The You editor's single pick becomes the primary and keeps the rest.
      expect(a.copyWith(worry: Worry.time).worries, [Worry.time, Worry.syllabus]);
    });

    test('Mobi answers the newest pick and stays quiet on a drop', () {
      final before = studentUpTo(Steps.subjects, step: Steps.worry).copyWith(worries: const [Worry.time]);
      expect(mobiCueFor(before, before.copyWith(worries: const [Worry.time, Worry.passages]))?.line, Worry.passages.mobiShort);
      expect(mobiCueFor(before.copyWith(worries: const [Worry.time, Worry.passages]), before), isNull);
    });

    test('the plan uses every pick: the first that names a subject decides it, and the plan says them all', () {
      final a = studentUpTo(Steps.worry).copyWith(worries: const [Worry.time, Worry.passages]);
      expect(FirstMove.of(a).subject, SheetSubject.english);
      expect(FirstMove.of(a).framing, 'Answer at exam pace, about a minute each.', reason: 'the primary frames it');
      expect(PlanSummary.worriesLine(a), 'You said you lose marks on the last 10 questions first, then on English passages.');
      expect(
        PlanSummary.worriesLine(a.copyWith(worries: const [Worry.passages, Worry.knewIt])),
        "You said you lose marks on English passages first, then on 'knew it, still got it wrong'.",
        reason: "the student's own words, never 'traps'",
      );
      expect(PlanSummary.of(a, kNow).lines, contains(PlanSummary.worriesLine(a)));
      expect(PlanSummary.worriesLine(a.copyWith(worries: const [Worry.time])), isNull);
    });

    test('a swap: Mobi names the pick that went', () {
      final before = studentUpTo(Steps.subjects, step: Steps.worry).copyWith(worries: const [Worry.knewIt, Worry.passages, Worry.time]);
      final after = before.copyWith(worries: const [Worry.knewIt, Worry.passages, Worry.syllabus]);
      expect(mobiCueFor(before, after)?.line, "I swapped out 'The last 10 questions'. You can pick three at most.");
    });

    testWidgets('the step marks each pick with its place and Mobi names a swap', (tester) async {
      final c = await _flowAt(tester, studentUpTo(Steps.subjects, step: Steps.worry));
      for (final w in [Worry.time, Worry.numericals, Worry.passages]) {
        await _tap(tester, find.text(w.option));
      }
      expect(find.text('First'), findsOneWidget);
      expect(find.text('Third'), findsOneWidget);
      final swapLine = ChoicesCopy.worrySwappedOut(Worry.passages.words);
      expect(find.text(swapLine, findRichText: true), findsNothing);
      await _tap(tester, find.text(Worry.syllabus.option));
      expect(find.text(swapLine, findRichText: true), findsOneWidget, reason: "in Mobi's bubble, always in view");
      expect(_answers(c).worries, [Worry.time, Worry.numericals, Worry.syllabus]);
    });
  });

  group('D46, D47 pace', () {
    test('the slider lights the usual days first (Mon to Fri, then Sat, then Sun) and unlights in reverse', () async {
      final (c, answers) = await _controller();
      answers.setDayCount(1);
      expect(_answers(c).days, {0}, reason: 'from Mon, Tue, Thu, Sat: Sat, Thu, Tue go first');
      answers.setDayCount(5);
      expect(_answers(c).days, {0, 1, 2, 3, 4});
      answers.setDayCount(6);
      expect(_answers(c).days, {0, 1, 2, 3, 4, 5});
      answers.setDayCount(7);
      expect(_answers(c).days.length, 7);
      answers.toggleDay(2);
      answers.setDayCount(5);
      expect(_answers(c).days, {0, 1, 3, 4, 5}, reason: 'a day the student took off stays off');
    });

    test('the runway is the sessions, week by week', () {
      final weeks = CuetCalendar.weeklySessions(2027, kNow, daysPerWeek: 4, boards: true);
      expect(weeks.length, CuetCalendar.weeksTo(2027, kNow));
      expect(weeks.fold(0, (a, b) => a + b), CuetCalendar.sessionsBefore(2027, kNow, daysPerWeek: 4, boards: true));
      expect(weeks.where((w) => w == 2), isNotEmpty, reason: 'board weeks hold two');
    });

    test('Mobi speaks at the ends only', () {
      final at = studentUpTo(Steps.question, step: Steps.rhythm);
      expect(mobiCueFor(at, at.copyWith(days: const {0, 3}))?.line, ChoicesCopy.mobiFewDays(2));
      expect(mobiCueFor(at, at.copyWith(days: const {0}))?.act, MobiAct.nod);
      expect(mobiCueFor(at, at.copyWith(days: const {0, 1, 2, 3, 4, 5, 6}))?.line, ChoicesCopy.mobiEveryDay);
      expect(mobiCueFor(at, at.copyWith(days: const {0, 1, 2, 3, 4})), isNull);
    });

    test('the readout counts hours from the session length and says about', () {
      expect(
        ChoicesCopy.sessionsLine(sessions: 110, minutes: 20, estimate: true, year: 2027, boards: false),
        'About 37 hours of practice before May, if you keep this.',
      );
    });

    testWidgets('slider and day bubbles move together; the full-mocks line sits under the minutes', (tester) async {
      final c = await _flowAt(tester, studentUpTo(Steps.question, step: Steps.rhythm));
      // H1 (19 Oct): the line is Mobi's slot now; at 10 to 30 minutes it still says full mocks are in Practice.
      expect(find.text(GoalCopy.slotLine(20)), findsOneWidget);
      expect(GoalCopy.slotLine(20), startsWith(ChoicesCopy.fullMocksLine));
      expect(find.byType(RunwayStrip), findsOneWidget);
      final slider = find.byType(Slider);
      await tester.ensureVisible(slider);
      await tester.pump();
      expect(tester.widget<Slider>(slider).value, 4);
      // The far right of the track is 7.
      final box = tester.getRect(slider);
      await tester.tapAt(Offset(box.right - 4, box.center.dy));
      await _settle(tester);
      expect(_answers(c).days.length, 7);
      expect(find.text(ChoicesCopy.mobiEveryDay, findRichText: true), findsOneWidget, reason: 'Mobi says keep a day to rest');
      // A tapped day moves the slider.
      await _tap(tester, find.bySemanticsLabel(RegExp(r'^Sunday, study day')));
      expect(tester.widget<Slider>(slider).value, 6);
    });
  });
}
