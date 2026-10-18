import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/data/warmup_pool.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/model/plan.dart';
import 'package:mockmob/features/onboarding/widgets/sheet_lines.dart';

final _now = DateTime(2026, 10, 13, 21, 40);

OnboardingAnswers _student({Worry? worry, Stage stage = Stage.classTwelve}) => OnboardingAnswers(
  stage: stage,
  courseId: 'b-com-hons',
  colleges: const ['Shri Ram College of Commerce', 'Hindu College'],
  subjects: const [SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics],
  confidence: const {
    SheetSubject.economics: Confidence.shaky,
    SheetSubject.accountancy: Confidence.okay,
    SheetSubject.english: Confidence.strong,
  },
  worries: [?worry],
);

void main() {
  group('the step deck', () {
    test('every step says what changes now and where it pays off', () {
      final ids = <String>{};
      for (final s in kOnboardingDeck.steps) {
        expect(ids.add(s.id), isTrue, reason: 'duplicate ${s.id}');
        expect(s.changesNow.trim(), isNotEmpty, reason: s.id);
        expect(s.paysOffLater.trim(), isNotEmpty, reason: s.id);
        expect(s.writes, isNotEmpty, reason: s.id);
      }
    });

    test('seven bubbles on the sheet; save and the first move come after the seal', () {
      expect([for (final s in kOnboardingDeck.sheetSteps) s.bubble], ['CUET', 'Aim', 'Subjects', 'Marks', 'Try', 'Pace', 'Plan']);
      expect(kOnboardingDeck.visible(OnboardingAnswers.empty).map((s) => s.id), isNot(contains(Steps.firstMove)));
      expect(kOnboardingDeck.visible(const OnboardingAnswers(notNow: true)).last.id, Steps.firstMove);
    });

    test('the plan step cannot be skipped; stage to rhythm can', () {
      for (final s in kOnboardingDeck.steps) {
        final early = [Steps.stage, Steps.course, Steps.subjects, Steps.worry, Steps.question, Steps.rhythm].contains(s.id);
        expect(s.skippable, early, reason: s.id);
      }
    });
  });

  group('the stored sheet', () {
    test('round-trips through JSON', () {
      final a = _student(worry: Worry.time)
          .copyWith(
            warmup: const WarmupResult(questionId: 'eco-1', chosen: 2, correct: true, millis: 14200),
            minutes: 30,
            days: {0, 2, 4},
            window: StudyTime.late,
            category: 'OBC-NCL',
            sealedAt: _now,
            age: AgeAnswer.minor,
            step: Steps.save,
          )
          .mark(Steps.stage)
          .skip(Steps.question);
      final b = OnboardingAnswers.fromJson(a.toJson());
      expect(b.toJson(), a.toJson());
      expect(b.ranked.first, SheetSubject.economics);
    });

    test('a newer store version or junk starts fresh, and bad values fall back to defaults', () {
      expect(OnboardingAnswers.fromJson({'v': 99, 'stage': 'classTwelve'}).stage, isNull);
      final junk = OnboardingAnswers.fromJson({
        'v': 1,
        'course': 'nope',
        'minutes': 17,
        'days': <int>[],
        'category': 'XYZ',
        'subjects': ['physics', 'astrology', 'english'],
      });
      expect(junk.courseId, isNull);
      expect(junk.minutes, 20);
      expect(junk.days, {0, 1, 3, 5});
      expect(junk.category, 'UR');
      // Unknown subject ids are dropped; every one of the 15 practice subjects is kept.
      expect(junk.subjects, [SheetSubject.physics, SheetSubject.english]);
    });
  });

  group('the first move', () {
    test('starts with the weakest subject that has a starting point', () {
      final move = FirstMove.of(_student());
      expect(move.subject, SheetSubject.economics);
      expect(move.chapter, 'Money and Banking');
      expect(move.route, '/practice/setup/quick?subject=economics&count=10&purpose=baseline');
    });

    test('the worry really changes it', () {
      expect(FirstMove.of(_student(worry: Worry.numericals)).subject, SheetSubject.accountancy);
      expect(FirstMove.of(_student(worry: Worry.passages)).subject, SheetSubject.english);
      final framings = {for (final w in Worry.values) FirstMove.of(_student(worry: w)).framing};
      expect(framings.length, Worry.values.length);
    });

    test('Maths or General Test marked weakest still starts in a subject with a free check', () {
      final a = _student().copyWith(
        subjects: [...SheetSubject.values.where((s) => s != SheetSubject.businessStudies)],
        confidence: {SheetSubject.mathematics: Confidence.shaky, SheetSubject.generalTest: Confidence.shaky},
      );
      expect(FirstMove.of(a).subject.hasStartingPoint, isTrue);
    });

    test('a physics-only student gets honest practice, not a starting point', () {
      final a = _student().copyWith(subjects: const [SheetSubject.physics], confidence: const {});
      final move = FirstMove.of(a);
      expect(move.subject, SheetSubject.physics);
      expect(move.isStartingPoint, isFalse);
      expect(move.startLabel, 'Start with 10 questions in Physics');
      expect(move.line, 'First practice: 10 questions in Physics');
      expect(move.unit, isNot(contains('starting point')));
      expect(move.title, isNot(contains('starting point')));
      expect(move.route, '/practice/setup/quick?subject=physics&count=10', reason: 'the plain practice path, no baseline allowance');
      expect(PlanSummary.of(a, _now).lines.join(' '), isNot(contains('starting point')));
    });

    test('a Political Science-only student gets the same, whatever the worry', () {
      for (final w in [null, ...Worry.values]) {
        final a = _student(worry: w).copyWith(subjects: const [SheetSubject.politicalScience], confidence: const {});
        final move = FirstMove.of(a);
        expect(move.subject, SheetSubject.politicalScience, reason: '$w');
        expect(move.isStartingPoint, isFalse);
        expect(move.startLabel, 'Start with 10 questions in Political Science');
        expect(move.route, isNot(contains('baseline')));
      }
    });

    test('one starting-point subject among science ones is the one used', () {
      final a = _student().copyWith(
        subjects: const [SheetSubject.physics, SheetSubject.chemistry, SheetSubject.english],
        confidence: const {SheetSubject.physics: Confidence.shaky, SheetSubject.english: Confidence.strong},
      );
      final move = FirstMove.of(a);
      expect(move.subject, SheetSubject.english);
      expect(move.isStartingPoint, isTrue);
      expect(move.startLabel, OnboardingCopy.startNow);
      expect(move.route, contains('purpose=baseline'));
    });

    test('later is tonight before the window opens and tomorrow after', () {
      final move = FirstMove.of(_student());
      expect(move.laterLabel(DateTime(2026, 10, 13, 18)), 'Tonight at 8:00 PM');
      expect(move.laterLabel(_now), 'Tomorrow at 8:00 PM');
    });
  });

  group('the plan', () {
    test('Class 12 gets the board-season taper; a gap year does not', () {
      final twelve = PlanSummary.of(_student(), _now).lines;
      final gap = PlanSummary.of(_student(stage: Stage.passedTwelve), _now).lines;
      expect(twelve, contains('Boards end in early April. The plan goes lighter from mid-February.'));
      expect(gap.any((l) => l.startsWith('Boards')), isFalse);
    });

    test('names the first chapter without claiming how often it appears', () {
      final plan = PlanSummary.of(_student(), _now);
      expect(plan.headline, 'Week one starts with Money and Banking.');
      expect(plan.lines.join(' '), isNot(matches(RegExp(r'\d+%|most often|usually|always'))));
    });

    test('the aim line carries the real figures, the source and the scale', () {
      expect(PlanSummary.aimLine(_student()), 'Aim: SRCC. It took 924.3 of\u00A01000 in Round 1, 2026, about 231 a paper.');
      expect(PlanSummary.alsoLine(_student()), 'Also on your list: Hindu 919.9.');
    });

    test('the eligibility line counts the subjects and colleges the set keeps the course open at', () {
      expect(PlanSummary.eligibilityLine(_student()), 'Your 4 subjects open B.Com (Hons) at both your colleges.');
    });

    test('the rhythm line and the sessions count', () {
      expect(PlanSummary.rhythmLine(_student()), '4 evenings a week, 20 minutes, around 8:00\u00A0PM.');
      expect(PlanSummary.sessionsLine(_student(), _now), 'That\'s about 100 sessions before May.');
    });
  });

  group('copy rules', () {
    final banned = RegExp(
      r'unlock|supercharge|level up|your chances|mastered|join thousands|not affiliated|diagnosis|guarantee',
      caseSensitive: false,
    );
    final all = <String>[
      OnboardingCopy.welcomeHeadline,
      OnboardingCopy.welcomeSupport,
      OnboardingCopy.stageTitle,
      OnboardingCopy.courseTitle,
      OnboardingCopy.courseSupport,
      OnboardingCopy.ladderTitle,
      OnboardingCopy.ladderSupport,
      OnboardingCopy.subjectsTitle,
      OnboardingCopy.subjectsSupport,
      OnboardingCopy.worryTitle,
      OnboardingCopy.rhythmTitle,
      OnboardingCopy.saveTitle,
      OnboardingCopy.saveSupport,
      OnboardingCopy.savedSheet,
      OnboardingCopy.savedWhat,
      OnboardingCopy.savedWhatColleges,
      OnboardingCopy.savedWhatCollegesLater,
      OnboardingCopy.eightIsMost,
      OnboardingCopy.notSureNote,
      OnboardingCopy.checkNeedsAccount,
      for (final w in Worry.values) ...[w.option, w.mobiLine],
      for (final s in Stage.values) ...[s.option, s.sheetLine],
      for (final q in kWarmupPool) ...[q.stem, ...q.options, q.fix],
    ];

    test('no hype, no defensive footers, no exclamation marks', () {
      for (final line in all) {
        expect(banned.hasMatch(line), isFalse, reason: line);
        expect(line.contains('!'), isFalse, reason: line);
      }
    });

    test('the welcome words are the brief\'s', () {
      expect(OnboardingCopy.welcomeHeadline, 'Every lost mark has a pattern.');
      expect(
        OnboardingCopy.welcomeSupport,
        'MockMob finds yours, helps you repair it, and checks the repair holds. Two minutes to set up.',
      );
      expect(OnboardingCopy.buildPlan, 'Build my plan');
      expect(OnboardingCopy.haveAccount, 'I already have an account');
    });

    test('"Rather not say" keeps usage data off, like under 18', () {
      expect(AgeAnswer.ratherNot.band, AgeBand.unknown);
      expect(AgeAnswer.minor.band, AgeBand.minor);
    });
  });

  group('sheet lines', () {
    test('a right answer faster than half a second still reads as about a second, never 0 s', () {
      const quick = OnboardingAnswers(warmup: WarmupResult(questionId: 'q', chosen: 0, correct: true, millis: 320));
      expect(sheetLines(quick), contains('Warm-up: right in 1 s'));
      const slow = OnboardingAnswers(warmup: WarmupResult(questionId: 'q', chosen: 0, correct: true, millis: 41600));
      expect(sheetLines(slow), contains('Warm-up: right in 42 s'));
    });
  });
}
