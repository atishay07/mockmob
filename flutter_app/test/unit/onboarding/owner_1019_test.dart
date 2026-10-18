import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/my_colleges.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/choices_copy.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/course_rule.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/model/plan.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/steps/subjects_step.dart';
import 'package:mockmob/features/you/edit_copy.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The owner's 19 Oct hand check, onboarding and colleges (PLAN-1019: G1, G4, G5, G6/D103, G9).

// ---- G1: whole sentences, never telegram English ------------------------------------------------

/// Every sentence Mobi says during the onboarding and every support line under a step title.
/// These are the strings the copy rule below holds to (list them, PLAN-1019 G1 DONE WHEN).
List<String> get onboardingSentences => [
      OnboardingCopy.welcomeHeadline,
      OnboardingCopy.welcomeSupport,
      OnboardingCopy.lateNight,
      OnboardingCopy.mobiWelcome,
      OnboardingCopy.mobiWelcomeBack,
      OnboardingCopy.mobiRight(1),
      OnboardingCopy.mobiRight(14),
      OnboardingCopy.mobiTrap,
      OnboardingCopy.mobiStillYours,
      OnboardingCopy.mobiSealed,
      OnboardingCopy.mobiSave,
      OnboardingCopy.mobiRateNow,
      ...OnboardingCopy.mobiArrive.values,
      OnboardingCopy.mobiFirstMove,
      OnboardingCopy.mobiAgeFirst,
      OnboardingCopy.stageTitle,
      OnboardingCopy.stageSupport,
      OnboardingCopy.classElevenNote,
      OnboardingCopy.boardsNote,
      OnboardingCopy.courseTitle,
      OnboardingCopy.courseSupport,
      ChoicesCopy.courseSupport,
      OnboardingCopy.notSureNote,
      OnboardingCopy.ladderTitle,
      OnboardingCopy.ladderSupport,
      OnboardingCopy.categoryNote,
      OnboardingCopy.pickedTail,
      OnboardingCopy.eightIsMost,
      OnboardingCopy.barLine('SRCC', '924.3', 231),
      OnboardingCopy.noSeatsFor('UR'),
      OnboardingCopy.pickCollege,
      OnboardingCopy.subjectsTitle,
      ChoicesCopy.subjectsSupportOpen,
      OnboardingCopy.fiveMax,
      OnboardingCopy.pickOne,
      OnboardingCopy.registryOffline,
      OnboardingCopy.worryTitle,
      OnboardingCopy.worrySupport,
      ChoicesCopy.worrySupport,
      ChoicesCopy.worrySwapped,
      ChoicesCopy.worrySwappedOut('the last 10 questions'),
      for (final w in Worry.values) ...[w.mobiLine, w.mobiShort],
      OnboardingCopy.questionTitle('Accountancy'),
      OnboardingCopy.questionSupport,
      OnboardingCopy.rightIn(1),
      OnboardingCopy.rightIn(14),
      '14 ${OnboardingCopy.rightSeconds(14)}',
      OnboardingCopy.trapLead,
      OnboardingCopy.rhythmTitle,
      ChoicesCopy.mobiFewDays(1),
      ChoicesCopy.mobiFewDays(2),
      ChoicesCopy.mobiEveryDay,
      ChoicesCopy.fullMocksLine,
      OnboardingCopy.sealedHeadline('Partnership'),
      PlanSummary.rhythmLine(const OnboardingAnswers()),
      PlanSummary.aimLine(const OnboardingAnswers(courseId: 'b-com-hons', colleges: ['Shri Ram College of Commerce']))!,
      OnboardingCopy.planLead,
      OnboardingCopy.planLeadDefaults,
      OnboardingCopy.sharpens,
      OnboardingCopy.saveTitle,
      OnboardingCopy.saveSupport,
      OnboardingCopy.ageQuestion,
      OnboardingCopy.ageNote,
      ChoicesCopy.courseListCount(67),
      EditCopy.courseNote,
      for (final c in DuCatalog.courses) CourseRule.sentence(c)!,
    ];

/// The old lines the owner read as broken English (19 Oct), and the telegram habits behind them.
final List<RegExp> _banned = [
  RegExp(r'Late one tonight'),
  RegExp(r'then sleep\.'),
  RegExp(r'find yours', caseSensitive: false),
  RegExp(r'finds yours', caseSensitive: false),
  RegExp(r'the repair holds'),
  RegExp(r'Two minutes to set up'),
  RegExp(r'Clock on'),
  RegExp(r'Fix below'),
  RegExp(r'^Classic trap'),
  RegExp(r'^(Clean|Fair|Sealed|Right)[.,]'),
  RegExp(r'\bQuick one\b'),
  RegExp(r'\bOne quick one\b'),
  RegExp(r'^(Still|Swapped|Offline|Under 18|No dates)\b'),
];

/// Words that make a sentence a sentence (a finite verb or an auxiliary). Contractions count too.
final Set<String> _verbs = {
  'is', 'are', 'am', 'was', 'were', 'be', 'has', 'have', 'had', 'do', 'does', 'did', 'can', 'will', 'would',
  'should', 'may', 'must', 'need', 'needs', 'needed', 'let', 'find', 'finds', 'help', 'helps', 'check', 'checks',
  'holds', 'takes', 'took', 'take', 'show', 'shows', 'keep', 'keeps', 'go', 'goes', 'get', 'gets', 'got', 'win', 'tell',
  'pick', 'tap', 'drop', 'add', 'answer', 'sit', 'study', 'rest', 'sign', 'follows', 'work', 'works', 'change', 'clears',
  'belong', 'build', 'train', 'beat', 'decides', 'costs', 'stings', 'won', 'offered', 'went', 'stays', 'starts', 'start',
  'reward', 'swapped', 'made', 'sharpens', 'land', 'lands', 'changes', 'tracking', 'read', 'type', 'means', 'say',
  'writing', 'stand', 'aim', 'come', 'comes', 'slip', 'losing', 'offers', 'knew', 'lost', 'left', 'tells',
  'pays', 'counts', 'opens', 'took', 'win', 'fix',
};

bool _hasVerb(String sentence) {
  final words = sentence.toLowerCase().replaceAll(RegExp(r'[^a-z0-9\s’]'), ' ').split(RegExp(r'\s+'));
  if (RegExp(r"\w('s|'re|'m|'ll|'ve|'d|n't)\b").hasMatch(sentence)) return true;
  return words.any(_verbs.contains);
}

/// "First, tell me where you are now." -> ["First, tell me where you are now."]
List<String> _sentences(String text) => [
      for (final s in text.split(RegExp(r'(?<=[.?!])\s+(?=[A-Z0-9"\x27])')))
        if (s.trim().isNotEmpty) s.trim(),
    ];

// ---- G6: last year's closing marks --------------------------------------------------------------

final DuCourse _bcomHons = DuCatalog.course('b-com-hons')!;

Future<(ProviderContainer, AnswersController)> _controller() async {
  final c = ProviderContainer(overrides: [answersStoreProvider.overrideWithValue(AnswersStore(MemoryPrefsStore()))]);
  addTearDown(c.dispose);
  await c.read(onboardingAnswersProvider.future);
  return (c, c.read(onboardingAnswersProvider.notifier));
}

MyCollege _mine(String college, {String programme = 'b-com-hons'}) => MyCollege(programmeId: programme, college: college);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('G1 first-open copy: whole, grammatical sentences', () {
    test('the welcome promise and Mobi\'s first lines are the rewritten ones', () {
      expect(OnboardingCopy.welcomeHeadline, 'Every lost mark has a pattern.', reason: 'the owner said the headline is fine');
      expect(OnboardingCopy.mobiWelcome, "Hi, I'm Mobi. Let's find the marks you're losing and win them back before CUET.");
      expect(OnboardingCopy.welcomeSupport,
          'MockMob finds where your marks slip, helps you fix each mistake, and checks that the fix sticks. Setup takes about two minutes.');
      expect(OnboardingCopy.lateNight, "It's late, so I'll keep this quick. Then you can get some sleep.");
    });

    test('no listed onboarding line uses an old telegram phrase', () {
      for (final line in onboardingSentences) {
        for (final s in _sentences(line)) {
          for (final b in _banned) {
            expect(b.hasMatch(s), isFalse, reason: '"$s" matches the banned pattern ${b.pattern}');
          }
        }
      }
    });

    test('every sentence has a verb and at least three words (no dropped subjects or articles)', () {
      for (final line in onboardingSentences) {
        for (final s in _sentences(line)) {
          // A contraction is two words ("That's fair." is "That is fair.").
          final words = s.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length + RegExp(r"\w'(s|re|m|ll|ve|d)(?![a-z])|n't(?![a-z])").allMatches(s).length;
          expect(words, greaterThanOrEqualTo(3), reason: 'fragment: "$s" (in "$line")');
          expect(_hasVerb(s), isTrue, reason: 'no verb: "$s" (in "$line")');
          expect(RegExp(r'^[A-Z0-9"\x27]').hasMatch(s), isTrue, reason: 'not a sentence start: "$s"');
          expect(RegExp(r'[.?!]$').hasMatch(s), isTrue, reason: 'no full stop: "$s"');
        }
      }
    });

    test('the copy rules of the app hold: no middle dot, no exclamation mark, no arrow', () {
      for (final line in onboardingSentences) {
        expect(line.contains('·'), isFalse, reason: line);
        expect(line.contains('!'), isFalse, reason: line);
        expect(line.contains('→'), isFalse, reason: line);
      }
    });
  });

  group('G4 course order: by aspirant demand, never "top"', () {
    test('the six tiles stand in the planned order', () {
      expect([for (final c in DuCatalog.courses) c.short],
          ['B.Com (Hons)', 'B.A. (Hons) Economics', 'B.Com', 'BMS', 'BBA (FIA)', 'B.A. (Hons) Business Economics']);
    });

    test('"More courses" starts with the same six, so its Commerce group leads in the same order', () {
      expect([for (final c in DuCatalog.all.take(6)) c.id], [for (final c in DuCatalog.courses) c.id]);
    });

    test('no course is ever labelled "top", and the course step says the course can change', () {
      for (final line in [ChoicesCopy.courseSupport, OnboardingCopy.courseSupport, ChoicesCopy.moreCoursesNote(67), for (final c in DuCatalog.all) c.short]) {
        expect(RegExp(r'\btop\b', caseSensitive: false).hasMatch(line), isFalse, reason: line);
      }
      expect(ChoicesCopy.courseSupport, contains('You can change your course any time.'));
      expect(EditCopy.courseNote, startsWith('You can change your course any time.'), reason: 'G5: You says it too');
    });
  });

  group('G6 colleges in order of last year\'s closing marks (D103)', () {
    test('the data source: CSAS UG 2026-27 Round 1, B.Com (Hons), unreserved', () {
      // The figures the owner asked about, as published (public/du/2026, Round 1).
      final ur = {for (final o in _bcomHons.ladder('UR')) o.short: DuCatalog.format(o.scoreFor('UR')!)};
      expect(ur['SRCC'], '924.3');
      expect(ur['Hindu'], '919.9');
      expect(ur['LSR'], '912.5');
      expect(ur['Hansraj'], '907.5');
      expect(ur['Kirori Mal'], '903.7');
      expect(ur['Ramjas'], '895.6');
      final order = [for (final o in _bcomHons.ladder('UR')) o.short];
      expect(order.indexOf('LSR'), lessThan(order.indexOf('Hansraj')), reason: 'the 2026 data puts LSR above Hansraj for B.Com (Hons), UR');
    });

    test('picks stand in order of the marks, not the order tapped', () async {
      final (container, c) = await _controller();
      c.setCourse('b-com-hons');
      for (final name in ['Hansraj College', 'Lady Shri Ram College for Women (W)', 'Shri Ram College of Commerce', 'Hindu College', 'Ramjas College']) {
        c.toggleCollege(name);
      }
      final a = container.read(onboardingAnswersProvider).value!;
      expect(a.colleges, [
        'Shri Ram College of Commerce',
        'Hindu College',
        'Lady Shri Ram College for Women (W)',
        'Hansraj College',
        'Ramjas College',
      ]);
    });

    test('a category change orders the picks by that category\'s marks', () async {
      final (container, c) = await _controller();
      c.setCourse('b-com-hons');
      c.toggleCollege('Lady Shri Ram College for Women (W)');
      c.toggleCollege('Hansraj College');
      c.setCategory('OBC-NCL');
      // OBC-NCL, Round 1 2026: LSR 833.5, Hansraj 828.8.
      expect(container.read(onboardingAnswersProvider).value!.colleges, ['Lady Shri Ram College for Women (W)', 'Hansraj College']);
      c.setCategory('SC');
      // SC: Hansraj 764.5, LSR 756.5.
      expect(container.read(onboardingAnswersProvider).value!.colleges, ['Hansraj College', 'Lady Shri Ram College for Women (W)']);
    });

    test('a sheet stored in the order tapped reads back in order of the marks', () {
      final a = OnboardingAnswers.fromJson({
        ...const OnboardingAnswers(courseId: 'b-com-hons').toJson(),
        'colleges': ['Ramjas College', 'Hindu College', 'Hansraj College'],
      });
      expect(a.colleges, ['Hindu College', 'Hansraj College', 'Ramjas College']);
    });

    test('My colleges sorts by closing marks: highest first, no number last, ties keep the student\'s order', () {
      const mine = MyColleges(colleges: [
        MyCollege(programmeId: 'b-com-hons', college: 'Ramjas College', position: 1),
        MyCollege(programmeId: 'b-com-hons', college: 'Unknown College', position: 2),
        MyCollege(programmeId: 'b-com-hons', college: 'Shri Ram College of Commerce', position: 3),
        MyCollege(programmeId: 'b-com-hons', college: 'Hansraj College', position: 4),
        MyCollege(programmeId: 'b-com-hons', college: 'Lady Shri Ram College for Women (W)', position: 5),
      ]);
      final sorted = mine.byClosing(DuCatalog.closingFor('UR'));
      expect([for (final c in sorted.colleges) c.college], [
        'Shri Ram College of Commerce',
        'Lady Shri Ram College for Women (W)',
        'Hansraj College',
        'Ramjas College',
        'Unknown College',
      ]);
      expect([for (final c in sorted.colleges) c.position], [1, 2, 3, 4, 5]);
      expect([for (final c in mine.ladderBy(DuCatalog.closingFor('UR'))) c.college],
          ['Shri Ram College of Commerce', 'Lady Shri Ram College for Women (W)', 'Hansraj College'], reason: 'Today\'s top 3 (D104)');
      expect(sorted.more, 2);
      expect(mine.colleges.first.college, 'Ramjas College', reason: 'the list itself is unchanged');
      // Equal numbers (none here) and missing numbers keep the order given.
      final ties = MyColleges(colleges: [_mine('A'), _mine('B'), _mine('C')]).byClosing((c) => c.college == 'B' ? 1 : null);
      expect([for (final c in ties.colleges) c.college], ['B', 'A', 'C']);
    });

    test('every number comes from the published list for that course and category, never estimated', () {
      expect(DuCatalog.closing('b-com-hons', 'Hansraj College', 'UR'), closeTo(907.5044, 1e-6));
      expect(DuCatalog.closing('b-com-hons', 'Lady Shri Ram College for Women (W)', 'UR'), closeTo(912.5385, 1e-6));
      expect(DuCatalog.closing('b-com-hons', 'Jesus & Mary College (W)', 'OBC-NCL'), isNull, reason: 'no OBC seat in Round 1');
      expect(DuCatalog.closing('b-com-hons', 'Nowhere College', 'UR'), isNull);
    });

    testWidgets('on the ladder, picks are numbered down the marks and the three highest carry On Today, each with its number', (tester) async {
      final semantics = tester.ensureSemantics();
      tester.view.physicalSize = const Size(720, 3200);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final answers = studentUpTo(Steps.stage, step: Steps.course).copyWith(
        courseId: 'b-com-hons',
        // Stored as tapped: Hansraj first, then LSR, Ramjas, SRCC.
        colleges: const ['Hansraj College', 'Lady Shri Ram College for Women (W)', 'Ramjas College', 'Shri Ram College of Commerce'],
      );
      await tester.pumpWidget(ProviderScope(
        overrides: onboardingOverrides(answers: OnboardingAnswers.fromJson(answers.toJson())),
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp(theme: buildTheme(Brightness.dark), home: const OnboardingFlow(skipColdOpen: true, startInDeck: true)),
        ),
      ));
      await _settle(tester);
      expect(find.text(OnboardingCopy.ladderTitle), findsOneWidget);
      // The semantics label of a rung: "<name>, <figure>, pick <n>[, on Today]".
      final srcc = find.bySemanticsLabel(RegExp(r'^Shri Ram College of Commerce, 924\.3, pick 1, on Today$'));
      final lsr = find.bySemanticsLabel(RegExp(r'^Lady Shri Ram College for Women, 912\.5, pick 2, on Today$'));
      final hansraj = find.bySemanticsLabel(RegExp(r'^Hansraj College, 907\.5, pick 3, on Today$'));
      final ramjas = find.bySemanticsLabel(RegExp(r'^Ramjas College, 895\.6, pick 4$'));
      expect(srcc, findsOneWidget);
      expect(lsr, findsOneWidget);
      expect(hansraj, findsOneWidget);
      expect(ramjas, findsOneWidget);
      expect(find.text(OnboardingCopy.onToday), findsNWidgets(3));
      semantics.dispose();
    });
  });

  group('G9 the course rule, up front', () {
    test('each of the six courses has one plain sentence built from its Bulletin combinations', () {
      String rule(String id) => CourseRule.sentence(DuCatalog.course(id)!)!;
      expect(rule('b-com-hons'),
          'B.Com (Hons) needs a language, usually English, plus Maths or Accountancy and any two other subjects, such as Business Studies and Economics.');
      expect(rule('b-a-hons-economics'),
          'B.A. (Hons) Economics needs a language, usually English, plus Maths and any two other subjects, such as Accountancy, Business Studies or Economics.');
      expect(rule('b-com'),
          'B.Com needs a language, usually English, plus either any three subjects, such as Accountancy, Business Studies and Economics, or one subject and the General Test.');
      expect(rule('bachelor-of-management-studies-bms'),
          'BMS needs a language, usually English, plus Maths, one other subject, such as Accountancy or Economics, and the General Test.');
    });

    test('every course in the catalogue gets a sentence, and none is a fragment', () {
      for (final c in DuCatalog.all) {
        final s = CourseRule.sentence(c);
        expect(s, isNotNull, reason: c.id);
        expect(s, startsWith('${c.short} needs '), reason: c.id);
        expect(s!.endsWith('.'), isTrue, reason: s);
        expect(s.contains('+'), isFalse, reason: 'no telegram plus signs: $s');
      }
    });

    testWidgets('the line shows on the subjects step before the first pick, above the common sets', (tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final answers = studentUpTo(Steps.course, step: Steps.subjects).copyWith(courseId: 'b-com-hons', subjects: const [], subjectsTouched: true);
      await tester.pumpWidget(ProviderScope(
        overrides: onboardingOverrides(answers: answers),
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp(theme: buildTheme(Brightness.dark), home: const OnboardingFlow(skipColdOpen: true, startInDeck: true)),
        ),
      ));
      await _settle(tester);
      expect(find.text(OnboardingCopy.subjectsTitle), findsOneWidget);
      final container = ProviderScope.containerOf(tester.element(find.byType(OnboardingFlow)));
      expect(container.read(onboardingAnswersProvider).value!.subjects, isEmpty, reason: 'nothing picked yet');
      final rule = find.byKey(SubjectsStep.ruleKey);
      expect(rule, findsOneWidget);
      expect(find.text(CourseRule.sentence(DuCatalog.course('b-com-hons')!)!), findsOneWidget);
      final sets = find.text(ChoicesCopy.quickSetsLabel);
      expect(sets, findsOneWidget, reason: 'the common sets are kept');
      expect(tester.getRect(rule).bottom, lessThanOrEqualTo(tester.getRect(sets).top), reason: 'the rule leads the sets');
    });
  });
}
