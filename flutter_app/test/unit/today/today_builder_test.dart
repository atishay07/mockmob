import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/cuet_dates.dart';
import 'package:mockmob/core/domain/tonight_pick.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/domain/repair_candidates.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/widgets/art/mm_art.dart';
import 'package:mockmob/core/widgets/bubbles/bubble_painter.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/road_builder.dart' show roadEndFor, roadStops;
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';

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
    test('tonight is one chapter of the newest paper: the chapter with the most open mistakes', () {
      final m = _move(ashaInputs());
      // Partnership holds 4 of Mock 7's 6; a repair run covers one chapter, and the longest chip
      // holds the whole chapter, as Review offers it.
      expect(m.number, '4');
      expect(m.numberLabel, 'to repair\ntonight');
      expect(m.meaning, 'All 4 in Partnership fundamentals, from Mock 7 on 11 Oct.');
      expect(m.selectedMinutes, 15);
      expect(m.durations.map((d) => d.minutes), [5, 10, 15]);
      expect(m.evidenceId, 'm7');
      expect((m.primary.target as GoTo).location, startsWith(AppRoutes.reviewRepair('m7', 'm7-q3')));
      expect(m.primary.label, TodayCopy.startRepair(15));
      expect(m.meaning, isNot(contains('holds')), reason: '"Holds" is kept for a passed fresh check');
    });

    test('a shorter chip shrinks the task and the number', () {
      final m = _move(ashaInputs(selectedMinutes: 5));
      expect(m.number, '2');
      expect(m.meaning, '2 of the 4 in Partnership fundamentals, from Mock 7 on 11 Oct.');
      expect((m.primary.target as GoTo).location, endsWith('count=2'));
    });

    test('in the morning it says today, never tonight', () {
      final m = _move(ashaInputs(now: DateTime.utc(2026, 10, 13, 2, 0)));
      expect(m.numberLabel, 'to repair\ntoday');
      expect(m.overline, "Today's move");
    });

    test('late at night the default is shorter and Mobi is sleepy', () {
      final m = _move(ashaInputs(now: tuesdayLate));
      expect(m.mood, TodayMood.lateNight);
      expect(m.selectedMinutes, 10);
      expect(m.number, '3');
      expect(m.art.art, MmArt.mobiSleepy);
      expect(m.headline, isNull);
      expect(MoveHeroCard.moodLine(m), TodayCopy.lateNight);
    });

    test('returning after days away asks how long without repeating the name, says nothing was lost', () {
      final m = _move(ashaInputs(returning: true));
      expect(m.mood, TodayMood.returning);
      expect(m.headline, isNull);
      expect(MoveHeroCard.moodLine(m), TodayCopy.mobiWelcomeBack);
      expect(m.headline, isNot(contains('Asha')), reason: 'the greeting above already says the name');
      expect(m.durationPrompt, 'How long have you got tonight?');
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

    test("tonight's chapter: most open mistakes, ties to the earliest question", () {
      const a = RepairCandidate(questionId: 'a', number: 9, chapter: 'Ratio analysis');
      const b = RepairCandidate(questionId: 'b', number: 2, chapter: 'Cash flow statement');
      const c = RepairCandidate(questionId: 'c', number: 4, chapter: 'Ratio analysis');
      final tie = pickTonightChapter(const [a, b], chapterOf: (x) => x.chapter, numberOf: (x) => x.number)!;
      expect(tie.chapter, 'Cash flow statement');
      final most = pickTonightChapter(const [a, b, c], chapterOf: (x) => x.chapter, numberOf: (x) => x.number)!;
      expect(most.chapter, 'Ratio analysis');
      expect([for (final x in most.items) x.number], [4, 9]);
      expect(most.paperOpen, 3);
    });
  });

  group('practice moves offer 5, 10 and 20 questions and start the one chosen', () {
    int countIn(MoveHero m) => int.parse(Uri.parse((m.primary.target as GoTo).location).queryParameters['count']!);

    final clean = accountancyMock('clean', daysBefore(now, 1));
    final staleMock = accountancyMock('old', daysBefore(now, 20), wrongAt: {1, 2, 3});
    final shortQuick = paper(
      id: 'q5',
      completedAt: daysBefore(now, 1),
      mode: 'quick',
      runs: const [('Partnership fundamentals', V.right, 4), ('Partnership fundamentals', V.wrong, 1)],
    );

    final moves = <String, MoveHero Function(int? chosen)>{
      'mixed practice': (c) => _move(ashaInputs(attempts: [clean], selectedMinutes: c)),
      'a stale record': (c) => _move(ashaInputs(attempts: [staleMock], selectedMinutes: c)),
      'a thin record': (c) => _move(ashaInputs(attempts: [shortQuick], selectedMinutes: c)),
      'a repaired record': (c) => _move(ashaInputs(
            repaired: {'m7': {for (final q in [3, 5, 7, 8, 22, 31]) 'm7-q$q'}},
            selectedMinutes: c,
          )),
    };
    for (final entry in moves.entries) {
      test('${entry.key}: the chips are 5, 10 and 20 and the key matches the chip', () {
        final fresh = entry.value(null);
        expect(fresh.durations.map((d) => d.questions), [5, 10, 20]);
        expect(fresh.durations.length, greaterThan(1), reason: 'the chooser shows whenever there is a choice');
        expect(fresh.selectedMinutes, 10);
        expect(countIn(fresh), 10);
        for (final n in [5, 20]) {
          final m = entry.value(n);
          expect(m.selectedMinutes, n);
          expect(countIn(m), n, reason: 'the started session is the chip');
          expect(m.primary.label, endsWith('$n questions'));
        }
        // The repair's 15 is not a practice length.
        expect(countIn(entry.value(15)), 10);
      });
    }

    test('the mixed number is the question count', () {
      final m = _move(ashaInputs(attempts: [clean], selectedMinutes: 5));
      expect(m.number, '5');
      expect(m.numberLabel, TodayCopy.questionsOfMixed);
      expect(m.primary.label, TodayCopy.startMixed(5));
    });

    test('a repair keeps its own chips in minutes and shows them too', () {
      final m = _move(ashaInputs());
      expect(m.durations.length, greaterThan(1));
      expect(m.durations.map((d) => d.label), ['5 min', '10 min', '15 min']);
      expect(m.durationPrompt, isNull, reason: 'the chips carry their unit, so no prompt line on an ordinary day');
    });
  });

  group('header Mobi cheers only for a result that improved or held', () {
    final todayAt = daysBefore(now, 0);
    final record = ashaRecord(now);

    HeaderMobiCue? cue(List<Attempt> attempts, {List<({String attemptId, DateTime receivedAt})> unopened = const []}) =>
        buildToday(ashaInputs(attempts: attempts, unopened: unopened)).header.mobi;

    // Mock 7 scored 6 wrong and 2 blank. Mock 8 today: fewer wrong is up, the same is held.
    Attempt mock8(Set<int> wrongAt, Set<int> blankAt) => accountancyMock('m8', todayAt, wrongAt: wrongAt, blankAt: blankAt);

    test('a sealed paper from today gets a neutral wave that says nothing about the marks', () {
      final c = cue([mock8(const {}, const {}), ...record], unopened: [(attemptId: 'm8', receivedAt: now)])!;
      expect(c.kind, HeaderMobiKind.idle);
      expect(c.lines, TodayCopy.mobiSealed);
    });

    test('a lower result gets a neutral wave, not a cheer', () {
      final c = cue([mock8({for (var q = 1; q <= 20; q++) q}, const {}), ...record])!;
      expect(c.kind, HeaderMobiKind.idle);
      expect(c.lines, TodayCopy.mobiRecorded);
    });

    test('a first paper has nothing to beat, so it gets the neutral wave', () {
      final c = cue([mock8(const {}, const {})])!;
      expect(c.kind, HeaderMobiKind.idle);
    });

    test('an improved result cheers', () {
      final c = cue([mock8({3}, const {}), ...record])!;
      expect(c.kind, HeaderMobiKind.cheer);
      expect(c.lines, TodayCopy.mobiCheer);
    });

    test('a held result cheers', () {
      final c = cue([mock8({3, 5, 7, 8, 22, 31}, {40, 47}), ...record])!;
      expect(c.kind, HeaderMobiKind.cheer);
    });

    test('no line for a sealed or lower result says Nice', () {
      for (final lines in [TodayCopy.mobiSealed, TodayCopy.mobiRecorded, TodayCopy.mobiCheer]) {
        expect(lines.any((l) => l.contains('Nice')), isFalse);
      }
    });

    test('no paper today: Mobi points at the move', () {
      expect(buildToday(ashaInputs()).header.mobi!.kind, HeaderMobiKind.point);
    });
  });

  group('plain copy: no verdict hedges', () {
    test('the thin and early lines say what to do next', () {
      expect(TodayCopy.thinLine, 'From one paper. Ten more questions sharpen this.');
      for (final line in [TodayCopy.thinLine, TodayCopy.whyEarly, TodayCopy.earlySignal]) {
        expect(line.toLowerCase(), isNot(contains('verdict')));
        expect(line.toLowerCase(), isNot(contains('signal')));
        expect(line.toLowerCase(), isNot(contains('not a pattern')));
      }
    });

    test('the thin count stays visible', () {
      final m = _move(ashaInputs(attempts: [
        paper(id: 'q5', completedAt: daysBefore(now, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 4), ('Partnership fundamentals', V.wrong, 1)]),
      ]));
      expect(m.numberLabel, TodayCopy.thinLabel(5));
      expect(m.meaning, TodayCopy.thinLine);
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
      expect(TodayCopy.greeting(8, 'Asha'), 'Good morning, Asha');
      expect(TodayCopy.greeting(14, 'Asha'), 'Good afternoon, Asha');
      expect(TodayCopy.greeting(20, 'Asha'), 'Good evening, Asha');
      expect(TodayCopy.greeting(23, 'Asha'), 'Up late, Asha');
      expect(TodayCopy.greeting(1, 'Asha'), 'Up late, Asha');
      expect(TodayCopy.greeting(14, null), 'Good afternoon');
      expect(TodayCopy.greeting(1, null), 'Up late tonight');
    });

    test('the sessions line says the pace plainly and never counts zero', () {
      expect(TodayCopy.sessionsLine(40, 5), 'About 40 study sessions at 5 a week.');
      expect(TodayCopy.sessionsLine(1, 3), 'About 1 study session at 3 a week.');
      expect(TodayCopy.sessionsLine(0, 5), 'Your first session starts the count.');
    });

    test('offline shows the time of the cached data', () {
      final header = buildHeader(ashaInputs(offline: true));
      expect(header.updatedLine, 'Updated 7:30 PM. You are offline.');
      expect(buildHeader(ashaInputs()).updatedLine, isNull);
    });

    test('the week row draws the plan: counted, planned, rest', () {
      final week = buildHeader(ashaInputs()).week!;
      expect(week.days.map((d) => d.mark.name), ['done', 'planned', 'rest', 'planned', 'rest', 'planned', 'rest']);
      expect(week.days[1].isToday, isTrue);
      expect(week.count, '1 of 4 study days');
      expect(week.outlook, '3 more by Sunday');
    });

    test('without a saved plan the onboarding rest days still draw it', () {
      const week = TodayWeek(studied: [true, false, false, false, false, false, false], todayIndex: 1, label: '1 of 4 study days', goal: 4);
      final days = buildHeader(TodayInputs(now: now, week: week, profile: ashaProfile)).week!.days;
      expect(days.last.mark.name, 'rest');
      expect(days[2].mark.name, 'planned');
    });

    test('a planned day that passed without study is open, never a miss', () {
      const week = TodayWeek(studied: [false, false, false, false, false, false, false], todayIndex: 3, label: '0 of 4', goal: 4, planned: {0, 1, 3, 5});
      final days = buildHeader(TodayInputs(now: now, week: week)).week!.days;
      expect(days[0].mark.name, 'open');
      expect(days[3].mark.name, 'planned');
    });

    test('recent papers carry the split and the change from the last comparable paper', () {
      final rows = buildToday(ashaInputs()).sheet;
      final m7 = rows.first;
      expect((m7.right, m7.wrong, m7.blank), (42, 6, 2));
      expect(m7.change, '+33 on Mock 6');
      expect(rows[1].change, isNull);
    });

    test('the change never names a paper that is still sealed', () {
      final rows = buildToday(ashaInputs(unopened: [(attemptId: 'm6', receivedAt: now)])).sheet;
      expect(rows.first.change, isNull);
    });

    test('weeks to the expected May 2027 window', () {
      final road = buildRoad(ashaInputs())!;
      expect(road.weeks, 28);
      expect(road.phase, RoadPhase.countdown);
    });

    test('the exam window is a state of its own: open, with the days left', () {
      final first = buildRoad(ashaInputs(now: DateTime.utc(2027, 5, 1, 8)))!;
      expect(first.phase, RoadPhase.window);
      expect(first.daysLeft, 31);
      expect(first.stops.map((s) => s.kind.name), ['exam']);
      final last = buildRoad(ashaInputs(now: DateTime.utc(2027, 5, 31, 8)))!;
      expect(last.phase, RoadPhase.window);
      expect(last.daysLeft, 1);
      expect(last.ladder, isNotEmpty, reason: 'the colleges ladder stays through the window');
    });

    test('the road ends with the exam window, and the card is gone once it closes', () {
      final road = buildRoad(ashaInputs())!;
      expect(road.stops.last.kind, RoadStopKind.exam, reason: 'no stop after the exam window');
      expect(road.end, DateTime.utc(2027, 6, 1));
      expect(roadEndFor(road.stops), road.end);
      expect(roadEndFor([road.stops.first]), DateTime.utc(2027, 4, 1), reason: 'derived from the last stop, not a constant');
      expect(buildRoad(ashaInputs(now: DateTime.utc(2027, 5, 31, 8))), isNotNull, reason: 'the last day of the window');
      for (final day in [DateTime.utc(2027, 6, 1, 8), DateTime.utc(2027, 6, 5, 8), DateTime.utc(2027, 9, 29, 8)]) {
        expect(buildRoad(ashaInputs(now: day)), isNull, reason: '$day');
        expect(buildToday(ashaInputs(now: day)).road, isNull, reason: '$day');
      }
    });

    test('no road copy or date names the CSAS rounds', () {
      final copy = File('lib/features/today/copy.dart').readAsStringSync();
      expect(copy, isNot(contains('CSAS')));
      expect(copy, isNot(contains('Round 1')));
      expect(TodayCopy.ladderCaption(null), 'Last year${String.fromCharCode(39)}s DU closing scores, unreserved, out of 1000');
      expect(TodayCopy.ladderCaption('OBC'), 'Last year${String.fromCharCode(39)}s DU closing scores, OBC, out of 1000');
      final dates = File('lib/core/domain/cuet_dates.dart').readAsStringSync();
      expect(dates, isNot(contains('CSAS')));
      expect(dates.toLowerCase(), isNot(contains('counselling')));
    });

    test('the registration window reads the same everywhere Today states it', () {
      final reg = roadStops.firstWhere((s) => s.kind == RoadStopKind.registration);
      expect(reg.start, CuetDates.registrationStart);
      expect(reg.end, CuetDates.registrationEnd);
      expect(reg.when, CuetDates.registrationMonths, reason: 'the Expected tag carries the word, so the line is the months');
      expect(TodayCopy.whenRegistration, CuetDates.registrationMonths);
      // The words name the same months and year the dates do.
      const months = ['January', 'February', 'March', 'April', 'May', 'June'];
      expect(CuetDates.registrationMonths, '${months[CuetDates.registrationStart.month - 1]} to ${months[CuetDates.registrationEnd.month - 1]} ${CuetDates.registrationEnd.year}');
      final exam = roadStops.firstWhere((s) => s.kind == RoadStopKind.exam);
      expect(exam.when, '${months[exam.start.month - 1]} ${exam.start.year}');
      expect(roadStops.every((s) => s.expected), isTrue, reason: 'no 2027 date is published yet');
      expect(TodayCopy.weeksLabel(3), contains(CuetDates.windowMonth));
      // No Today string types the window again.
      final copy = File('lib/features/today/copy.dart').readAsStringSync();
      expect(copy, isNot(contains('January to March')));
      expect(copy, isNot(contains('February to March')));
    });

    test('the ladder is only real picks, dream first', () {
      final road = buildRoad(ashaInputs())!;
      expect(road.ladder.first.college, 'Shri Ram College of Commerce');
      expect(road.ladder.first.dream, isTrue);
      expect(road.ladder.first.score, '924.3');
      expect(buildRoad(ashaInputs(profile: null))!.ladder, isEmpty);
    });

    test('the road is calendar arithmetic on real dates and the student goal', () {
      final road = buildRoad(ashaInputs())!;
      expect(road.weeksToBoards, 17);
      // The onboarding count: board weeks hold two sessions at most.
      expect(road.studyDays, lessThan(28 * 4));
      expect(road.weekNeeds, isNull, reason: 'the week strip at the top already says it');
      expect(road.stops.map((s) => s.kind.name), ['registration', 'boards', 'exam']);
      final march = buildRoad(ashaInputs(now: DateTime.utc(2027, 3, 1)))!;
      expect(march.weeksToBoards, 0);
      expect(march.stops.first.kind.name, 'registration');
      final april = buildRoad(ashaInputs(now: DateTime.utc(2027, 4, 10)))!;
      expect(april.stops.map((s) => s.kind.name), ['exam']);
    });

    test('the road weeks line never counts a week it does not have', () {
      expect(TodayCopy.weeksLabel(1), startsWith('week to'));
      expect(TodayCopy.windowDaysLeft(1), startsWith('day left'));
    });
  });
}
