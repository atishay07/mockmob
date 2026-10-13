import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/domain/repair_candidates.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/art/mm_art.dart';
import 'package:mockmob/core/widgets/bubbles/bubble_painter.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

MoveHero _move(TodayInputs i) => buildMove(i);

void main() {
  final now = tuesdayEvening;

  group('next-move state from the record (spec 5.3 precedence)', () {
    final cleanMock = accountancyMock('clean', daysBefore(now, 1));
    final staleMock = accountancyMock('old', daysBefore(now, 20), wrongAt: {1, 2, 3});
    final shortQuick = paper(
      id: 'q5',
      completedAt: daysBefore(now, 1),
      mode: 'quick',
      runs: const [('Partnership fundamentals', V.right, 4), ('Partnership fundamentals', V.wrong, 1)],
    );
    final cases = <(String, TodayInputs, NextMoveState)>[
      ('nothing loaded and the read failed', TodayInputs(now: now, attemptsFailed: true), NextMoveState.historyUnavailable),
      (
        'the plan says the record is unavailable',
        TodayInputs(now: now, attempts: ashaRecord(now), plan: LearningPlan.fromJson({'primary': {}, 'recordState': 'unavailable'})),
        NextMoveState.historyUnavailable,
      ),
      ('no attempts yet', ashaInputs(attempts: const []), NextMoveState.newUser),
      (
        'subjects changed and nothing in the new set',
        TodayInputs(now: now, attempts: ashaRecord(now), subjects: const ['economics']),
        NextMoveState.subjectChanged,
      ),
      ('the last mock is older than 14 days', ashaInputs(attempts: [staleMock]), NextMoveState.stale),
      ('only a five-question practice', ashaInputs(attempts: [shortQuick]), NextMoveState.thinHistory),
      ('a recent mock with mistakes', ashaInputs(), NextMoveState.ready),
      (
        'every mistake repaired on this phone',
        ashaInputs(repaired: {'m7': {for (final q in [3, 5, 7, 8, 22, 31]) 'm7-q$q'}}),
        NextMoveState.repairedCheckNotDue,
      ),
      ('a recent mock with no mistakes', ashaInputs(attempts: [cleanMock]), NextMoveState.noStrongWeakness),
    ];
    for (final (name, inputs, state) in cases) {
      test(name, () => expect(_move(inputs).state, state));
    }
  });

  group('the ready repair', () {
    test('names the chapter that holds most mistakes and defaults to 20 minutes in the evening', () {
      final m = _move(ashaInputs());
      expect(m.number, '6');
      expect(m.numberLabel, 'mistakes\nfrom Mock 7');
      expect(m.meaning, 'Partnership fundamentals holds 4 of them.');
      expect(m.selectedMinutes, 20);
      expect(m.durations.map((d) => d.minutes), [5, 10, 20]);
      expect(m.evidenceId, 'm7');
      expect((m.primary.target as GoTo).location, startsWith(AppRoutes.reviewRepair('m7', 'm7-q3')));
      expect(m.primary.label, TodayCopy.startRepair(20));
    });

    test('a shorter chip shrinks the task and the number', () {
      final m = _move(ashaInputs(selectedMinutes: 5));
      expect(m.number, '2');
      expect(m.meaning, 'Partnership fundamentals holds 4 of the 6 waiting.');
      expect((m.primary.target as GoTo).location, endsWith('count=2'));
    });

    test('late at night the default is shorter and Mobi is sleepy', () {
      final m = _move(ashaInputs(now: tuesdayLate));
      expect(m.mood, TodayMood.lateNight);
      expect(m.selectedMinutes, 10);
      expect(m.number, '3');
      expect(m.art.art, MmArt.mobiSleepy);
      expect(m.headline, TodayCopy.lateNight);
    });

    test('returning after days away asks how long, greets by name, says nothing was lost', () {
      final m = _move(ashaInputs(returning: true));
      expect(m.mood, TodayMood.returning);
      expect(m.headline, 'Welcome back, Asha.');
      expect(m.durationPrompt, TodayCopy.howLong);
      expect(m.selectedMinutes, 10);
      expect(m.meaning, contains('Its 6 mistakes are still here.'));
      expect(m.art.art, MmArt.mobiGreet);
    });

    test('"Not today" hides the repair and says where the mistakes are', () {
      final record = ashaRecord(now);
      final m = _move(ashaInputs(attempts: record, dismissed: {dismissalKeyFor(record.first)}));
      expect(m.state, NextMoveState.noStrongWeakness);
      expect(m.dismissedLine, TodayCopy.hiddenUntilTomorrow);
    });

    test('an unopened result is never the basis, so its mistakes are not spoiled', () {
      final m = _move(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: now)]));
      expect(m.evidenceId, isNot('m7'));
      expect(m.numberLabel, isNot(contains('Mock 7')));
    });

    test('a chapter is named only when it holds two or more', () {
      const one = RepairCandidate(questionId: 'a', number: 1, chapter: 'Ratio analysis');
      const two = RepairCandidate(questionId: 'b', number: 2, chapter: 'Cash flow statement');
      expect(topChapter(const [one, two]), isNull);
      expect(topChapter(const [one, one, two]), ('Ratio analysis', 2));
    });
  });

  group('day one', () {
    test('ten questions to the starting point in the weakest subject, Mobi greets', () {
      final m = _move(ashaInputs(attempts: const []));
      expect(m.mood, TodayMood.dayOne);
      expect(m.number, '10');
      expect(m.subjectLine, 'Accountancy');
      expect(m.art.isMobi, isTrue);
      expect(m.mobiLine, TodayCopy.mobiDayOne);
      final link = Uri.parse((m.primary.target as GoTo).location);
      expect(link.path, AppRoutes.practiceStart);
      expect(link.queryParameters, containsPair('purpose', 'baseline'));
      expect(link.queryParameters, containsPair('subject', 'accountancy'));
    });

    test('a first check scheduled for tonight is stated', () {
      final m = _move(ashaInputs(
        now: DateTime.utc(2026, 10, 13, 13),
        attempts: const [],
        profile: ashaProfileWith(firstMoveAt: DateTime.utc(2026, 10, 13, 14, 30)),
      ));
      expect(m.headline, 'Your check is set for 8:00 PM.');
    });
  });

  group('hero precedence', () {
    final draft = TodayDraft(
      sessionId: 's8',
      subject: 'accountancy',
      isMock: true,
      mockNumber: 8,
      total: 50,
      answered: 23,
      acknowledgedAnswered: 21,
      endsAt: now.add(const Duration(minutes: 30)),
      lastAckAt: now.subtract(const Duration(minutes: 2)),
      resumable: true,
    );

    test('an open session wins, and the sealed result and the move follow as slots', () {
      final view = buildToday(ashaInputs(draft: draft, unopened: [(attemptId: 'm7', receivedAt: now)]));
      expect(view.hero, isA<ResumeHero>());
      expect((view.hero! as ResumeHero).line, 'Ends at 9:10 PM. Saved on the server at 8:38 PM.');
      expect(view.also.map((s) => s.action.label), [TodayCopy.openSheet, 'Start repair']);
    });

    test('an unopened result takes over the hero as the sealed sheet', () {
      final view = buildToday(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: now)]));
      final sealed = view.hero! as SealedHero;
      expect(sealed.title, 'Mock 7, Accountancy');
      expect(sealed.line, 'Received at 8:40 PM. Your result is ready.');
    });

    test('the sealed paper keeps its marks off "Your sheet"', () {
      final view = buildToday(ashaInputs(unopened: [(attemptId: 'm7', receivedAt: now)]));
      final row = view.sheet.first;
      expect(row.sealed, isTrue);
      expect(row.marks, isNull);
      expect(row.states.toSet(), {BubbleState.hollow});
      expect((row.target as GoTo).location, AppRoutes.resultSealed('m7'));
    });

    test('nothing loaded yet shows the skeleton', () {
      expect(buildToday(TodayInputs(now: now)).loading, isTrue);
    });
  });

  group('a mock that ended while away (three copies from real state)', () {
    TodayDraft ended({bool? exists, Duration ago = const Duration(hours: 2)}) => TodayDraft(
          sessionId: 's8',
          subject: 'accountancy',
          isMock: true,
          mockNumber: 8,
          total: 50,
          answered: 31,
          acknowledgedAnswered: 31,
          endsAt: now.subtract(ago),
          resumable: false,
          attemptExists: exists,
        );

    test('recorded on the server', () {
      final hero = buildToday(ashaInputs(draft: ended(exists: true))).hero! as EndedHero;
      expect(hero.line, 'Mock 8 ended at 6:40 PM. Your 31 answers sent before then were recorded.');
      expect(hero.action.label, TodayCopy.openResult);
    });

    test('still being sent inside the window', () {
      final hero = buildToday(ashaInputs(draft: ended(exists: false, ago: const Duration(seconds: 30)))).hero! as EndedHero;
      expect(hero.line, contains('are on this phone and are being sent'));
    });

    test('the window closed', () {
      final hero = buildToday(ashaInputs(draft: ended(exists: false))).hero! as EndedHero;
      expect(hero.line, startsWith('The submission window for Mock 8 has ended'));
      expect(hero.action.target, isA<OpenAlternatives>());
    });

    test('a recorded mock waiting to be opened is left to the sealed sheet', () {
      final view = buildToday(ashaInputs(draft: ended(exists: true), unopened: [(attemptId: 's8', receivedAt: now)]));
      expect(view.hero, isA<SealedHero>());
    });
  });

  group('header and road', () {
    test('greets by first name and the time of day', () {
      expect(TodayCopy.greeting(8, 'Asha'), 'Morning, Asha');
      expect(TodayCopy.greeting(20, 'Asha'), 'Evening, Asha');
      expect(TodayCopy.greeting(1, 'Asha'), 'Up late, Asha');
      expect(TodayCopy.greeting(14, null), 'Good afternoon');
    });

    test('offline shows the time of the cached data', () {
      final header = buildHeader(ashaInputs(offline: true));
      expect(header.updatedLine, 'Updated 7:30 PM. You are offline.');
      expect(buildHeader(ashaInputs()).updatedLine, isNull);
    });

    test('chosen rest days are drawn as rest', () {
      final week = buildHeader(ashaInputs()).week!;
      expect(week.last.mark.name, 'rest');
      expect(week[1].isToday, isTrue);
    });

    test('weeks to the expected May 2027 window, then gone once it starts', () {
      expect(buildRoad(ashaInputs())!.weeks, 28);
      expect(buildRoad(ashaInputs(now: DateTime.utc(2027, 5, 2)))?.weeks, isNull);
    });

    test('the ladder is only real picks, dream first', () {
      final road = buildRoad(ashaInputs())!;
      expect(road.ladder.first.college, 'Shri Ram College of Commerce');
      expect(road.ladder.first.dream, isTrue);
      expect(road.ladder.first.score, '924.3');
      expect(buildRoad(ashaInputs(profile: null))!.ladder, isEmpty);
    });
  });
}
