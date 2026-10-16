// The evening return loop: one reminder a day at the student's study window that names tonight's
// move (the one Today names), none on a day already studied, never inside quiet hours, and a
// Sunday line with the real week. Built only from the student's own record.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/notifications/notification_channels.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/timezones.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/notifications/copy.dart';
import 'package:mockmob/features/notifications/data/reminder_state.dart';
import 'package:mockmob/features/notifications/logic/evening_move.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';
import 'package:mockmob/features/notifications/services/reminder_taps.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import '../today/support/today_fixtures.dart';
import 'support.dart';

Rhythm _rhythm({String weekStart = '2026-10-12', int studied = 4, int goal = 5, bool paused = false, List<String> dates = const []}) => Rhythm(
      timeZone: 'Asia/Kolkata',
      weekStart: weekStart,
      studyDays: studied,
      studyDayDates: dates,
      daysGoal: goal,
      metThisWeek: studied >= goal,
      paused: paused,
      weeksMetStreak: 0,
      bestRun: 0,
    );

/// The same record with the attempts list not read yet (null, not empty).
TodayInputs _notLoaded(DateTime now) => TodayInputs(now: now, subjects: const ['accountancy'], attempts: null);

void main() {
  final location = locationFor('Asia/Kolkata');
  // Monday 12 October 2026, 6:00 PM in Kolkata. Asha's newest mock, two days old, left mistakes
  // (four of them in one chapter), so tonight's move is a repair.
  final now = kolkata(2026, 10, 12, 18).toUtc();
  final inputs = ashaInputs(now: now);
  const slot = (hour: 20, minute: 0);

  EveningFacts factsOf({Rhythm? rhythm, TodayInputs? from}) =>
      eveningFactsFrom(inputs: from ?? inputs, repairs: const [], location: location, slot: slot, now: now, rhythm: rhythm);

  group('tonight\'s move is the one Today names', () {
    test('a repair names its count, chapter and time, and opens the repair Today opens', () {
      final move = eveningMoveFrom(inputs, kolkata(2026, 10, 12, 20))!;
      final hero = buildMove(inputs);
      expect(move.kind, EveningMoveKind.repair);
      expect(move.route, (hero.primary.target as GoTo).location);
      expect(move.mistakes, int.parse(hero.number!));
      expect(move.minutes, hero.selectedMinutes);
      expect(move.line, matches(RegExp(r'^\d+ Partnership fundamentals mistakes? to repair, about \d+ minutes$')));
    });

    test('nothing to repair: a practice run of the length Today offers, in the subject Today names', () {
      final calm = ashaInputs(now: now, repaired: repairedAll(ashaRecord(now)));
      final move = eveningMoveFrom(calm, kolkata(2026, 10, 12, 20))!;
      final hero = buildMove(calm);
      expect(move.kind, EveningMoveKind.practice);
      expect(move.route, (hero.primary.target as GoTo).location);
      expect(move.line, '${hero.selectedMinutes} ${hero.subjectLine} questions, about ${hero.selectedMinutes} minutes');
    });

    test('no data, no move: a record still loading is never read as a new student', () {
      expect(eveningMoveFrom(_notLoaded(now), kolkata(2026, 10, 12, 20)), isNull);
      // A student with no attempts at all is real, and gets their first move.
      expect(eveningMoveFrom(ashaInputs(now: now, attempts: const []), kolkata(2026, 10, 12, 20)), isNotNull);
    });

    test('a record that could not be read names no move', () {
      final failed = TodayInputs(now: now, attempts: null, attemptsFailed: true);
      expect(eveningMoveFrom(failed, kolkata(2026, 10, 12, 20)), isNull);
    });

    test('the move is judged at the reminder\'s own time, so late night shortens it as Today does', () {
      final evening = eveningMoveFrom(inputs, kolkata(2026, 10, 12, 20))!;
      final lateAt = kolkata(2026, 10, 12, 23, 40);
      final late = eveningMoveFrom(inputs, lateAt)!;
      expect(late.minutes! <= evening.minutes!, isTrue);
      expect(late.minutes, buildMove(ashaInputs(now: lateAt.toUtc())).selectedMinutes);
    });

    test('"Not today" on Today speaks for today only', () {
      final basis = ashaRecord(now).first;
      final dismissed = ashaInputs(now: now, dismissed: {dismissalKeyFor(basis)});
      final today = eveningMoveFrom(dismissed, kolkata(2026, 10, 12, 20))!;
      final later = eveningMoveFrom(dismissed, kolkata(2026, 10, 13, 20), keepToday: false)!;
      expect(today.kind, isNot(EveningMoveKind.repair));
      expect(later.kind, EveningMoveKind.repair);
    });
  });

  group('studied today', () {
    bool studied({List<DateTime> attempts = const [], List<RepairLocalRecord> repairs = const [], Rhythm? rhythm}) =>
        studiedOn(day: '2026-10-12', timezone: 'Asia/Kolkata', attemptsCompleted: attempts, repairs: repairs, rhythm: rhythm, location: location);

    test('a session finished today, a repair acknowledged today, or a server study day', () {
      expect(studied(), isFalse);
      expect(studied(attempts: [kolkata(2026, 10, 12, 9).toUtc()]), isTrue);
      expect(studied(attempts: [kolkata(2026, 10, 11, 23, 59).toUtc()]), isFalse);
      // 12:10 AM in Kolkata is still the 11th in UTC: the student's own date decides.
      expect(studied(attempts: [kolkata(2026, 10, 12, 0, 10).toUtc()]), isTrue);
      final repaired = RepairLocalRecord(
        attemptId: 'm7',
        questionId: 'q',
        requestId: 'r',
        status: RepairLocalStatus.stored,
        ackedAt: kolkata(2026, 10, 12, 15).toUtc(),
      );
      expect(studied(repairs: [repaired]), isTrue);
      const pending = RepairLocalRecord(attemptId: 'm7', questionId: 'q', requestId: 'r', status: RepairLocalStatus.pending);
      expect(studied(repairs: [pending]), isFalse);
      expect(studied(rhythm: _rhythm(dates: ['2026-10-12'])), isTrue);
      expect(studied(rhythm: _rhythm(dates: ['2026-10-11'])), isFalse);
    });

    test('the facts carry it for the day they were taken on', () {
      final facts = factsOf(rhythm: _rhythm(dates: ['2026-10-12']));
      expect(facts.day, '2026-10-12');
      expect(facts.studiedToday, isTrue);
      expect(factsOf().studiedToday, isFalse);
    });
  });

  group('the Sunday line', () {
    final sunday = kolkata(2026, 10, 18, 18);
    test('the real week with its denominator', () {
      final line = weeklyLineFor(WeekLine.fromRhythm(_rhythm()), sunday)!;
      expect(line.title, 'Your week');
      expect(line.body, 'You studied 4 of 5 planned days this week.');
    });

    test('a week above the plan says both numbers, never a verdict', () {
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm(studied: 6, goal: 5)), sunday)!.body, 'You studied 6 days this week, with 5 planned.');
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm(studied: 1, goal: 1)), sunday)!.body, 'You studied 1 of 1 planned day this week.');
    });

    test('nothing true to say, so nothing is said: no week, paused, none studied, another week', () {
      expect(weeklyLineFor(null, sunday), isNull);
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm(paused: true)), sunday), isNull);
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm(studied: 0)), sunday), isNull);
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm(goal: 0)), sunday), isNull);
      // A Sunday that falls in the next week is not the week these numbers belong to.
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm()), kolkata(2026, 10, 25, 18)), isNull);
      expect(weeklyLineFor(WeekLine.fromRhythm(_rhythm(weekStart: '2026-10-19')), sunday), isNull);
    });
  });

  group('copy', () {
    test('plain words: no exclamation, em dash, middle dot or pressure', () {
      final lines = [
        NotificationsCopy.moveRepair(1, null, null),
        NotificationsCopy.moveRepair(3, 'Partnership', 10),
        NotificationsCopy.movePractice(10, 'Accountancy'),
        NotificationsCopy.movePractice(1, null),
        NotificationsCopy.movePlan('Repair three mistakes.'),
        NotificationsCopy.weeklyPersonalBody(4, 5),
        NotificationsCopy.weeklyPersonalBody(6, 5),
        NotificationsCopy.weeklyPersonalTitle,
      ];
      for (final l in lines) {
        expect(l, isNot(contains('!')));
        expect(l, isNot(contains('—')));
        expect(l, isNot(contains('·')));
        expect(l.toLowerCase(), isNot(anyOf(contains('streak'), contains('miss'), contains('lost'), contains('don\'t'))));
      }
      expect(NotificationsCopy.moveRepair(3, 'Partnership', 10), '3 Partnership mistakes to repair, about 10 minutes');
      expect(NotificationsCopy.moveRepair(1, null, null), '1 mistake to repair');
      expect(NotificationsCopy.movePractice(10, 'Accountancy'), '10 Accountancy questions, about 10 minutes');
      expect(NotificationsCopy.movePlan('Repair three mistakes.'), 'Repair three mistakes');
    });
  });

  group('the plan', () {
    final prefs = prefsWith(weeklyOn: false);
    const state = ReminderState();

    test('a study slot says tonight\'s move and opens exactly it', () {
      final facts = factsOf();
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state, evening: facts);
      final first = plan.first;
      expect(first.at, kolkata(2026, 10, 12, 20));
      expect(first.title, 'Tonight');
      expect(first.body, facts.today!.line);
      expect(decodeReminderPayload(first.payload!).route, facts.today!.route);
      expect(decodeReminderPayload(first.payload!).taskId, 'study_window:2026-10-12');
      // Later evenings use the ordinary pick for that evening.
      expect(plan[1].body, facts.later!.line);
      expect(decodeReminderPayload(plan[1].payload!).route, facts.later!.route);
    });

    test('a morning window says Today, not Tonight', () {
      final morning = prefsWith(weeklyOn: false, window: const StudyWindow(start: ClockTime(7, 30), end: ClockTime(9, 0)));
      final early = kolkata(2026, 10, 12, 6).toUtc();
      final facts = eveningFactsFrom(
        inputs: ashaInputs(now: early),
        repairs: const [],
        location: location,
        slot: (hour: 7, minute: 30),
        now: early,
      );
      final plan = buildReminderPlan(now: early, prefs: morning, state: state, evening: facts);
      expect(plan.first.title, 'Today');
    });

    test('a day already studied gets none, and the next day gets its reminder', () {
      final base = factsOf();
      final studiedFacts = EveningFacts(day: '2026-10-12', today: base.today, later: base.later, studiedToday: true);
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state, evening: studiedFacts);
      expect(plan.first.at, kolkata(2026, 10, 13, 20));
      expect(plan.length, 6);
      expect(plan.any((r) => r.taskId == 'study_window:2026-10-12'), isFalse);
    });

    test('facts from another day are not used: every reminder says its ordinary line', () {
      final base = factsOf();
      final stale = EveningFacts(day: '2026-10-11', today: base.today, later: base.later, studiedToday: true);
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state, evening: stale);
      expect(plan.length, 7);
      expect(plan.first.body, NotificationsCopy.studyBody);
      expect(plan.first.title, NotificationsCopy.studyTitle);
      expect(decodeReminderPayload(plan.first.payload!).route, AppRoutes.today);
    });

    test('no data at all: the ordinary line, still one a day', () {
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state);
      expect(plan.length, 7);
      expect(plan.every((r) => r.body == NotificationsCopy.studyBody), isTrue);
    });

    test('a repair waiting rides the first slot with Today\'s own count and route', () {
      final facts = factsOf();
      const waiting = RepairReady(attemptId: 'm7', mistakes: 6, minutes: 20);
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state, repair: waiting, evening: facts);
      final first = plan.first;
      expect(first.taskId, 'repair_ready:m7');
      // Today says tonight's chapter (not all six mistakes of the paper), and so does the reminder.
      expect(first.body, facts.today!.line);
      expect(decodeReminderPayload(first.payload!).route, facts.today!.route);
      expect(plan.where((r) => r.taskId.startsWith('repair_ready:')).length, 1);
      expect(plan.length, 7);
    });

    test('a repair does not push when Today\'s move for that evening is not that repair', () {
      final basis = ashaRecord(now).first;
      final dismissed = ashaInputs(now: now, dismissed: {dismissalKeyFor(basis)});
      final facts = factsOf(from: dismissed);
      const waiting = RepairReady(attemptId: 'm7', mistakes: 6, minutes: 20);
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state, repair: waiting, evening: facts);
      // Today the student said "Not today", so the first slot is the ordinary pick; tomorrow's
      // slot carries the repair.
      expect(plan.first.taskId, 'study_window:2026-10-12');
      expect(plan.first.body, facts.today!.line);
      expect(plan[1].taskId, 'repair_ready:m7');
      expect(plan.length, 7);
    });

    test('with no study window the repair evening still skips a studied day', () {
      final noWindow = prefsWith(weeklyOn: false, window: null);
      const waiting = RepairReady(attemptId: 'm7', mistakes: 3, minutes: 10);
      final base = factsOf();
      final studiedFacts = EveningFacts(day: '2026-10-12', today: base.today, later: base.later, studiedToday: true);
      final plan = buildReminderPlan(now: now, prefs: noWindow, state: state, repair: waiting, evening: studiedFacts);
      expect(plan.single.at, kolkata(2026, 10, 13, 19));
    });

    test('the Sunday line carries the real week, and the ordinary line when it cannot', () {
      final weeklyPrefs = prefsWith();
      const weeklyOn = ReminderState(weeklyPlanOn: true);
      final plan = buildReminderPlan(now: now, prefs: weeklyPrefs, state: weeklyOn, evening: factsOf(rhythm: _rhythm()));
      final weekly = plan.firstWhere((r) => r.taskId.startsWith('weekly_plan:'));
      expect(weekly.at, kolkata(2026, 10, 18, 18));
      expect(weekly.title, 'Your week');
      expect(weekly.body, 'You studied 4 of 5 planned days this week.');
      expect(decodeReminderPayload(weekly.payload!).route, AppRoutes.todayWeeklyEnding);

      final none = buildReminderPlan(now: now, prefs: weeklyPrefs, state: weeklyOn, evening: factsOf());
      expect(none.firstWhere((r) => r.taskId.startsWith('weekly_plan:')).body, NotificationsCopy.weeklyBody);
    });

    test('the evening reminder rides the study window channel, never a new one', () {
      final plan = buildReminderPlan(now: now, prefs: prefs, state: state, evening: factsOf());
      expect(plan.every((r) => r.channel == NotificationChannels.studyReminders), isTrue);
    });
  });

  group('the payload', () {
    test('a route with its own query survives the trip, beside the task id', () {
      const route = '/practice/start?mode=quick&subject=accountancy&count=10';
      final back = decodeReminderPayload(encodeReminderPayload(route, 'study_window:2026-10-12'));
      expect(back.taskId, 'study_window:2026-10-12');
      expect(Uri.parse(back.route).path, '/practice/start');
      expect(Uri.parse(back.route).queryParameters, {'mode': 'quick', 'subject': 'accountancy', 'count': '10'});
    });

    test('a plain route and an old payload still decode', () {
      expect(decodeReminderPayload(encodeReminderPayload('/today', 'a:1')), (route: '/today', taskId: 'a:1'));
      expect(decodeReminderPayload('/today?nx=study_window:2026-10-12'), (route: '/today', taskId: 'study_window:2026-10-12'));
      expect(decodeReminderPayload('/result/abc'), (route: '/result/abc', taskId: null));
    });
  });

  group('a tap opens exactly that move', () {
    final opened = <String>[];
    final counted = <String>[];
    late ReminderTapHandler handler;
    setUp(() {
      opened.clear();
      counted.clear();
      handler = ReminderTapHandler(
        opened: (id) async => counted.add(id),
        declined: (_) async {},
        mute: () async {},
        open: opened.add,
      );
    });

    test('the repair link opens with its count, and the tap is counted', () async {
      final route = AppRoutes.reviewRepair('m7', 'm7-q3');
      final payload = encodeReminderPayload('$route?count=3', 'repair_ready:m7');
      await handler.handle(NotificationTap(payload: payload));
      expect(opened, ['$route?count=3']);
      expect(counted, ['repair_ready:m7']);
    });

    test('a practice run opens with the subject and count, read through the action router', () async {
      final payload = encodeReminderPayload('/practice/start?mode=quick&subject=accountancy&count=10', 'study_window:2026-10-12');
      await handler.handle(NotificationTap(payload: payload));
      expect(opened.single, startsWith('/practice/start?'));
      final q = Uri.parse(opened.single).queryParameters;
      expect(q['subject'], 'accountancy');
      expect(q['count'], '10');
    });

    test('a payload that is not one of the app\'s own screens opens nothing', () async {
      await handler.handle(NotificationTap(payload: encodeReminderPayload('https://evil.example/steal', 'study_window:x')));
      await handler.handle(NotificationTap(payload: encodeReminderPayload('/pricing', 'study_window:x')));
      expect(opened, isEmpty);
    });
  });

  group('the scheduler, with the real engine', () {
    test('the reminder that is scheduled says tonight\'s move and opens it', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: slot, now: rig.now);
      await rig.scheduler.sync();
      final first = rig.gateway.scheduled.first;
      expect(first.at, kolkata(2026, 10, 12, 20));
      expect(first.title, 'Tonight');
      expect(first.body, rig.evening!.today!.line);
      expect(decodeReminderPayload(first.payload!).route, rig.evening!.today!.route);
    });

    test('a day already studied: re-planning after studying removes today\'s and leaves the next evenings', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: slot, now: rig.now);
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.first.at, kolkata(2026, 10, 12, 20));
      // The student studies at 7 PM: the record changes and the plan is made again.
      rig.now = kolkata(2026, 10, 12, 19).toUtc();
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: slot, now: rig.now, rhythm: _rhythm(dates: ['2026-10-12']));
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.map((s) => s.at).toList(), [kolkata(2026, 10, 13, 20), kolkata(2026, 10, 14, 20), kolkata(2026, 10, 15, 20)]);
    });

    test('at most one a day: on a Sunday with the weekly line on, the study slot gives way', () async {
      final rig = Rig(prefs: prefsWith(), start: kolkata(2026, 10, 18, 10).toUtc());
      await rig.store.update((s) => s.copyWith(weeklyPlanOn: true));
      rig.evening = eveningFactsFrom(
        inputs: ashaInputs(now: rig.now),
        repairs: const [],
        location: location,
        slot: slot,
        now: rig.now,
        rhythm: _rhythm(),
      );
      await rig.scheduler.sync();
      final sunday = rig.gateway.scheduled.where((s) => s.at.day == 18).toList();
      expect(sunday.length, 1);
      expect(sunday.single.at, kolkata(2026, 10, 18, 18));
      expect(sunday.single.body, 'You studied 4 of 5 planned days this week.');
    });

    test('quiet hours: a window that starts inside them waits for 7:00 AM and still says the move', () async {
      final prefs = prefsWith(weeklyOn: false, window: const StudyWindow(start: ClockTime(6, 0), end: ClockTime(8, 0)));
      final rig = Rig(prefs: prefs);
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: (hour: 6, minute: 0), now: rig.now);
      await rig.scheduler.sync();
      final first = rig.gateway.scheduled.first;
      expect(first.at, kolkata(2026, 10, 13, 7));
      expect(first.title, 'Today');
      expect(first.body, rig.evening!.later!.line);
    });

    test('quiet hours: a window that ends inside them after they began is dropped', () async {
      final prefs = prefsWith(weeklyOn: false, window: const StudyWindow(start: ClockTime(23, 30), end: ClockTime(23, 59)));
      final rig = Rig(prefs: prefs);
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: (hour: 23, minute: 30), now: rig.now);
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });

    test('quiet hours follow the student\'s own setting', () async {
      // Quiet from 8 PM: the 8:30 PM window falls inside it.
      final prefs = prefsWith(
        weeklyOn: false,
        quietStart: const ClockTime(20, 0),
        window: const StudyWindow(start: ClockTime(20, 30), end: ClockTime(21, 0)),
      );
      final rig = Rig(prefs: prefs);
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: (hour: 20, minute: 30), now: rig.now);
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });

    test('permission off: nothing is scheduled, however much the record could say', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.gateway.enabled = false;
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: slot, now: rig.now);
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });

    test('no data: the ordinary reminder, with no invented move', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.first.body, NotificationsCopy.studyBody);
      expect(rig.gateway.scheduled.first.title, NotificationsCopy.studyTitle);
    });

    test('a record that cannot be read costs no reminder: the ordinary line is planned', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false));
      rig.eveningFails = true;
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled.first.body, NotificationsCopy.studyBody);
    });

    test('the study channel off: nothing, whatever the record says', () async {
      final rig = Rig(prefs: prefsWith(weeklyOn: false, studyOn: false));
      rig.evening = eveningFactsFrom(inputs: inputs, repairs: const [], location: location, slot: slot, now: rig.now);
      await rig.scheduler.sync();
      expect(rig.gateway.scheduled, isEmpty);
    });
  });

  test('facts compare equal when nothing a reminder would say has changed', () {
    expect(factsOf(), factsOf());
    expect(factsOf().hashCode, factsOf().hashCode);
    expect(factsOf(rhythm: _rhythm()) == factsOf(rhythm: _rhythm(studied: 5)), isFalse);
  });
}
