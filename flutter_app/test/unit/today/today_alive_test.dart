// Today comes alive (15 Oct): the week rail's touchable days, the cues Mobi answers, the trend
// strip across recent papers, the road's scrub and walker, the sealed and resume heroes' small
// moments. Pure logic first, then the widgets that carry it.
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart' show kLongPressTimeout;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/features/rhythm/logic/plan_week.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/today_reactions.dart';
import 'package:mockmob/features/today/logic/week_chip.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';
import 'package:mockmob/features/today/widgets/resume_hero.dart';
import 'package:mockmob/features/today/widgets/road_timeline.dart';
import 'package:mockmob/features/today/widgets/sealed_hero.dart';
import 'package:mockmob/features/today/widgets/sheet_section.dart' show CountedMarks;
import 'package:mockmob/features/today/widgets/week_ledger.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

class _Haptics implements HapticDriver {
  int selections = 0;
  int lights = 0;

  @override
  Future<void> selectionClick() async => selections++;

  @override
  Future<void> lightImpact() async => lights++;

  @override
  Future<void> mediumImpact() async {}
}

const TodayWeek _tuesdayCounted = TodayWeek(
  studied: [true, true, false, false, false, false, false],
  todayIndex: 1,
  label: '2 of 4 study days',
  goal: 4,
  planned: {0, 1, 3, 5},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

void main() {
  setUpAll(loadAppFonts);

  final auth = authSnapshotProvider.overrideWithBuild(
    (ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'),
  );

  group('the chip a tapped day names itself with', () {
    test('says the weekday, the date and the state in plain words', () {
      expect(dayChipText(const PlanDay(index: 1, mark: PlanDayMark.done, date: 14)), 'Tue 14, counted');
      expect(dayChipText(const PlanDay(index: 5, mark: PlanDayMark.rest)), 'Sat, rest day');
      expect(dayChipText(const PlanDay(index: 3, mark: PlanDayMark.planned, date: 16)), 'Thu 16, planned');
      expect(dayChipText(const PlanDay(index: 0, mark: PlanDayMark.open, isPast: true, date: 12)), 'Mon 12, not studied');
      expect(dayChipText(const PlanDay(index: 1, mark: PlanDayMark.open, isToday: true, date: 13)), 'Tue 13, no study yet');
    });

    test('the bubble pops 1 to 1.35 and back', () {
      expect(WeekLedger.popScale(0), 1);
      expect(WeekLedger.popScale(0.45), closeTo(1.35, 0.001));
      expect(WeekLedger.popScale(1), 1);
      expect(WeekLedger.popScale(0.2), inExclusiveRange(1, 1.35));
    });
  });

  group('what Mobi answers', () {
    setUp(MobiRation.reset);

    test('an unchanged read changes nothing and gets no cue', () {
      final a = buildToday(ashaInputs());
      final b = buildToday(ashaInputs());
      final change = TodayReactions.compare(a, b);
      expect(change.changed, isFalse);
      expect(TodayReactions.actFor(change), isNull);
    });

    test('today newly counted is a correct, and is seen as a change', () {
      final before = buildToday(ashaInputs());
      final after = buildToday(ashaInputs(week: _tuesdayCounted));
      expect(TodayReactions.todayCounted(before), isFalse);
      expect(TodayReactions.todayCounted(after), isTrue);
      final change = TodayReactions.compare(before, after);
      expect(change.todayNewlyCounted, isTrue);
      expect(TodayReactions.actFor(change), MobiAct.correct);
    });

    test('a refresh that brought a new paper is a nod; the same view again is not', () {
      final before = buildToday(ashaInputs());
      final after = buildToday(ashaInputs(attempts: ashaRecord(tuesdayEvening).skip(1).toList()));
      expect(TodayReactions.compare(before, after).changed, isTrue);
      expect(TodayReactions.actFor(TodayReactions.compare(after, after)), isNull);
    });

    test('a failed read shrugs once, then stays calm while it keeps failing', () {
      final ok = buildToday(ashaInputs());
      final failed = buildToday(TodayInputs(now: tuesdayEvening, firstName: 'Asha', attemptsFailed: true));
      expect(TodayReactions.failedRead(failed), isTrue);
      final change = TodayReactions.compare(ok, failed);
      expect(change.failedRead, isTrue);
      expect(TodayReactions.actFor(change), MobiAct.oops);
      expect(TodayReactions.actFor(change), isNull, reason: 'a second failure in the same run does not shrug again');
    });

    test('the published cue tells its listeners about the same act twice', () {
      final cues = MobiCueNotifier();
      var heard = 0;
      cues.addListener(() => heard++);
      cues.cue(MobiAct.correct);
      cues.cue(MobiAct.correct);
      expect(heard, 2);
      expect(cues.count, 2);
      expect(cues.value, MobiAct.correct);
      cues.dispose();
    });

    testWidgets('picking a chip makes the hero Mobi listen, and today counted makes him nod', (tester) async {
      final start = todayMobiCue.count;
      var view = buildToday(ashaInputs());
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            set = setState;
            return TodayBody(
              view: view,
              callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {}, onMinutes: (_) {}),
              mobiController: MobiController(),
              skeletonDelay: Duration.zero,
            );
          },
        ),
        size: const Size(384, 1900),
        disableAnimations: true,
        overrides: [auth],
      );
      await tester.tap(find.text('5 min'));
      await tester.pump();
      expect(todayMobiCue.count, start + 1);
      expect(todayMobiCue.value, MobiAct.listen);
      set(() => view = buildToday(ashaInputs(week: _tuesdayCounted)));
      await tester.pump();
      await tester.pump();
      expect(todayMobiCue.count, start + 2);
      expect(todayMobiCue.value, MobiAct.correct);
      await tester.pump(const Duration(seconds: 3));
    });
  });

  group('the week rail', () {
    List<PlanDay> days({bool todayDone = false}) => planWeek(
          studied: [true, todayDone, false, false, false, false, false],
          todayIndex: 1,
          planned: const {0, 1, 3, 5},
          dates: const [12, 13, 14, 15, 16, 17, 18],
        );

    WeekModel week({bool todayDone = false}) => WeekModel(days: days(todayDone: todayDone), count: '1 of 4 study days', outlook: '3 more by Sunday');

    Future<(_Haptics, List<String>)> pumpLedger(WidgetTester tester, {bool reduced = false, WeekModel? model}) async {
      final haptics = _Haptics();
      final events = <String>[];
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: WeekLedger(week: model ?? week(), onTap: () => events.add('week'))),
        size: const Size(384, 600),
        disableAnimations: reduced,
        overrides: [auth, hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      );
      return (haptics, events);
    }

    testWidgets('each day is a button, a tap pops it with a tick and does not open the week', (tester) async {
      final semantics = tester.ensureSemantics();
      final (haptics, events) = await pumpLedger(tester);
      final thursday = find.bySemanticsLabel(RegExp('^Thursday'));
      expect(thursday, findsOneWidget);
      expect(tester.getSize(thursday).height, greaterThanOrEqualTo(48));
      await tester.tap(thursday);
      await tester.pump(const Duration(milliseconds: 130));
      expect(haptics.selections, 1);
      expect(events, isEmpty);
      // The chip holds for 2.2 s and is gone by 2.6 s; nothing is left running.
      await tester.pump(const Duration(milliseconds: 2800));
      expect(tester.hasRunningAnimations, isFalse);
      semantics.dispose();
    });

    testWidgets('the count row still opens the week, and a day under reduced motion still answers', (tester) async {
      final (haptics, events) = await pumpLedger(tester, reduced: true);
      await tester.tap(find.textContaining('study days'));
      await tester.pump();
      expect(events, ['week']);
      expect(haptics.selections, 1);
      await tester.tapAt(tester.getTopLeft(find.byType(WeekLedger)) + const Offset(120, 60));
      await tester.pump();
      expect(haptics.selections, 2);
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('today newly counted by the server ticks once, lightly; the first paint with it counted does not', (tester) async {
      final haptics = _Haptics();
      var model = week();
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            set = setState;
            return Padding(padding: const EdgeInsets.all(16), child: WeekLedger(week: model, onTap: () {}));
          },
        ),
        size: const Size(384, 600),
        overrides: [auth, hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      );
      expect(haptics.lights, 0);
      set(() => model = week(todayDone: true));
      await tester.pump();
      expect(haptics.lights, 1);
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('today breathes only where the ambient loops are on, and it settles when they are off', (tester) async {
      SubjectEmblem.idleEnabled = true;
      addTearDown(() => SubjectEmblem.idleEnabled = false);
      await pumpLedger(tester);
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.hasRunningAnimations, isTrue, reason: 'the 2.4 s ring is breathing');
      await pumpLedger(tester, model: week(todayDone: true));
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.hasRunningAnimations, isFalse, reason: 'a counted day has nothing left to breathe for');
    });
  });

  group('the trend across recent papers', () {
    test('the last six papers of the newest kind, oldest first, with their real marks', () {
      final trend = buildTrend(ashaInputs())!;
      expect(trend.mock, isTrue);
      expect(trend.points.map((p) => p.attemptId), ['m2', 'm3', 'm4', 'm5', 'm6', 'm7']);
      expect(trend.points.last.marks, 44 * 5 - 6);
      expect(trend.points.last.outOf, 250);
      expect(trend.subject, isNotEmpty);
    });

    test('it is skipped with fewer than three papers, or when any of them is sealed', () {
      final record = ashaRecord(tuesdayEvening);
      expect(buildTrend(ashaInputs(attempts: [record[0], record[1], record[2]])), isNull, reason: 'two mocks only');
      expect(buildTrend(ashaInputs(unopened: [(attemptId: 'm4', receivedAt: tuesdayEvening)])), isNull);
      expect(buildToday(ashaInputs()).trend, isNotNull);
    });

    testWidgets('the strip names itself, and a tap on a dot opens that paper', (tester) async {
      final semantics = tester.ensureSemantics();
      final events = <Object>[];
      await pumpMockmob(
        tester,
        TodayBody(
          view: buildToday(ashaInputs()),
          callbacks: TodayCallbacks(onAction: events.add, onTarget: events.add, onMinutes: (_) {}),
          skeletonDelay: Duration.zero,
        ),
        size: const Size(384, 2400),
        disableAnimations: true,
        overrides: [auth],
      );
      expect(find.text(TodayCopy.trendCaption(6, true)), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(RegExp('^Mock 5, .*Opens the result')), warnIfMissed: false);
      await tester.pump();
      expect(events.whereType<GoTo>().map((g) => g.location), contains(contains('m5')));
      semantics.dispose();
    });

    test('a paper\'s marks count from 0 to the real figure', () {
      expect(CountedMarks.at(130, 0), 0);
      expect(CountedMarks.at(130, 1), 130);
      expect(CountedMarks.at(130, 0.5), inExclusiveRange(0, 130));
      expect(CountedMarks.at(-12, 1), -12);
    });
  });

  group('the road', () {
    final today = DateTime.utc(2026, 10, 15);
    final exam = RoadStop(
      kind: RoadStopKind.exam,
      title: 'CUET UG',
      when: 'May 2027',
      start: DateTime.utc(2027, 5, 11),
      end: DateTime.utc(2027, 6, 5),
    );
    final registration = RoadStop(
      kind: RoadStopKind.registration,
      title: 'CUET registration',
      when: 'January to March 2027',
      start: DateTime.utc(2027, 1, 1),
      end: DateTime.utc(2027, 3, 31),
    );
    final end = DateTime.utc(2027, 7, 1);

    RoadFrame frameOf(List<RoadStop> stops, {double width = 340, TextScaler scaler = TextScaler.noScaling}) {
      const style = TextStyle(fontSize: 12, height: 1);
      return RoadFrame.measure(width: width, today: today, stops: stops, end: end, scaler: scaler, lane: style, exam: style, now: style, stretch: style);
    }

    test('the finger reads real days, and snaps to a stop\'s edge within 5 dp', () {
      final frame = frameOf([registration, exam]);
      expect(frame.days, DateTime.utc(2027, 7, 1).difference(DateTime.utc(2026, 10, 1)).inDays);
      final edge = frame.edges.firstWhere((e) => e == DateTime.utc(2027, 1, 1).difference(frame.start).inDays);
      final edgeX = frame.x(registration.start);
      expect(frame.dayAt(edgeX + 3, 340), edge, reason: 'inside the snap reach');
      expect(frame.dayAt(edgeX + 30, 340), isNot(edge));
      expect(frame.dayAt(-50, 340), 0);
      expect(frame.dayAt(900, 340), frame.days);
      expect(frame.edges, contains(today.difference(frame.start).inDays));
    });

    test('Mobi stands on the Now tick only where he covers nothing', () {
      expect(frameOf([exam]).walkerRect(30), isNotNull);
      // A first stop a few days out puts the bracket's pill where he would stand.
      final soon = RoadStop(kind: RoadStopKind.registration, title: 'Soon', when: 'x', start: DateTime.utc(2026, 10, 27), end: DateTime.utc(2026, 11, 30));
      expect(frameOf([soon, exam]).walkerRect(30), isNull);
    });

    testWidgets('a long press and a slide reads the road and ticks at an edge; nothing is left running', (tester) async {
      final haptics = _Haptics();
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: RoadTimeline(today: today, stops: [registration, exam], end: end)),
        size: const Size(372, 400),
        disableAnimations: true,
        overrides: [auth, hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      );
      final box = tester.getRect(find.byType(RoadTimeline));
      final frame = frameOf([registration, exam], width: box.width);
      final start = box.topLeft + Offset(frame.x(registration.start) - 40, 60);
      final gesture = await tester.startGesture(start);
      await tester.pump(kLongPressTimeout + const Duration(milliseconds: 50));
      await gesture.moveBy(const Offset(40, 0));
      await tester.pump(const Duration(milliseconds: 50));
      expect(haptics.selections, greaterThanOrEqualTo(1), reason: 'the finger landed on the edge of registration');
      await gesture.up();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.hasRunningAnimations, isFalse);
    });

    testWidgets('Mobi walks the road once per app run, then only stands; never at large text', (tester) async {
      SubjectEmblem.idleEnabled = true;
      addTearDown(() => SubjectEmblem.idleEnabled = false);
      RoadTimeline.debugResetWalker();
      Future<void> pumpRoad({double scale = 1}) => pumpMockmob(
            tester,
            Padding(padding: const EdgeInsets.all(16), child: RoadTimeline(today: today, stops: [exam], end: end)),
            size: const Size(372, 400),
            textScale: scale,
            overrides: [auth],
          );
      await pumpRoad();
      await tester.pump();
      expect(find.byType(MobiWalker), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      await pumpRoad();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(MobiWalker), findsNothing, reason: 'the walk is once per run');
      expect(find.byType(MobiCharacter), findsOneWidget);
      RoadTimeline.debugResetWalker();
      await pumpRoad(scale: 1.6);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(MobiCharacter), findsNothing, reason: 'hidden above 1.3x text');
    });
  });

  group('the hero answers touch', () {
    testWidgets('the stage light swells 20% on a tap, 12% on a chip, and eases back', (tester) async {
      final full = HeroReact(vsync: const TestVSync());
      final chip = HeroReact(vsync: const TestVSync());
      addTearDown(full.dispose);
      addTearDown(chip.dispose);
      expect(full.light, 0);
      full.fire(1);
      chip.fire(HeroReact.chipAmplitude);
      await tester.pump();
      await tester.pump(HeroReact.length ~/ 2);
      expect(full.light, closeTo(0.2, 0.01));
      expect(chip.light, closeTo(0.12, 0.01));
      await tester.pump(HeroReact.length);
      expect(full.light, closeTo(0, 0.001));
      expect(full.tapPulse.value, 1);
      expect(chip.chipPulse.value, 1);
    });

    testWidgets('picking a different length plays the object\'s chip reaction once', (tester) async {
      var minutes = 15;
      late StateSetter set;
      await pumpMockmob(
        tester,
        StatefulBuilder(
          builder: (context, setState) {
            set = setState;
            return TodayBody(
              view: buildToday(ashaInputs(selectedMinutes: minutes)),
              callbacks: noopCallbacks,
              skeletonDelay: Duration.zero,
            );
          },
        ),
        size: const Size(384, 1900),
        overrides: [auth],
      );
      set(() => minutes = 5);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(seconds: 2));
      expect(tester.takeException(), isNull);
    });
  });

  group('the sealed and resume heroes', () {
    setUp(SealedHeroCard.debugResetGlint);

    const sealed = SealedHero(attemptId: 'm7', title: 'Mock 7, Accountancy', line: 'Received at 8:40 PM. Your result is ready.', subjectId: 'accountancy');

    testWidgets('the foil glints once, the crack answers Open sheet, and no score or Mobi appears', (tester) async {
      var opened = 0;
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: SealedHeroCard(sealed: sealed, onOpen: () => opened++, onOpenDirectly: () {})),
        size: const Size(384, 900),
        overrides: [auth],
      );
      expect(find.byType(MobiCharacter), findsNothing);
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.text(TodayCopy.openSheet));
      await tester.pump(const Duration(milliseconds: 120));
      expect(opened, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(tester.hasRunningAnimations, isFalse, reason: 'the seal has healed and the glint is over');
      expect(find.byType(MobiCharacter), findsNothing);
    });

    test('Saved a minute ago is said from the real time, and stays true as it ages', () {
      expect(TodayCopy.savedAgo(const Duration(seconds: 10)), 'Saved just now');
      expect(TodayCopy.savedAgo(const Duration(seconds: 60)), 'Saved a minute ago');
      expect(TodayCopy.savedAgo(const Duration(minutes: 7)), 'Saved 7 minutes ago');
      expect(TodayCopy.savedAgo(const Duration(minutes: 61)), 'Saved an hour ago');
      expect(TodayCopy.savedAgo(const Duration(hours: 5)), 'Saved 5 hours ago');
      expect(TodayCopy.savedAgo(const Duration(hours: 30)), 'Saved yesterday');
    });

    testWidgets('resume shows the real answered share, the real save time, and one edge pulse on Continue', (tester) async {
      var continued = 0;
      final saved = DateTime(2026, 10, 14, 20, 38);
      final hero = ResumeHero(
        sessionId: 's1',
        title: 'Mock 8, Accountancy',
        answered: 12,
        total: 50,
        line: 'Ends at 9:10 PM. Saved on the server at 8:38 PM.',
        lead: 'Ends at 9:10 PM.',
        savedAt: saved,
        subjectId: 'accountancy',
      );
      await pumpMockmob(
        tester,
        SingleChildScrollView(child: ResumeHeroCard(resume: hero, onContinue: () => continued++, now: () => saved.add(const Duration(seconds: 70)))),
        size: const Size(384, 900),
        overrides: [auth],
      );
      expect(find.byType(AnsweredLine), findsOneWidget);
      expect(find.text('Saved a minute ago'), findsOneWidget);
      expect(find.text('Ends at 9:10 PM.'), findsOneWidget);
      expect(find.textContaining('Saved on the server'), findsNothing);
      await tester.tap(find.text(hero.keyLabel));
      await tester.pump(const Duration(milliseconds: 200));
      expect(continued, 1);
      await tester.pump(const Duration(seconds: 1));
      expect(tester.hasRunningAnimations, isFalse);
    });

    test('the builder carries the real save time of the draft', () {
      final view = buildToday(ashaInputs(
        draft: TodayDraft(
          sessionId: 's1',
          subject: 'accountancy',
          isMock: true,
          mockNumber: 8,
          total: 50,
          answered: 12,
          acknowledgedAnswered: 12,
          endsAt: tuesdayEvening.add(const Duration(minutes: 30)),
          lastAckAt: tuesdayEvening.subtract(const Duration(minutes: 2)),
          resumable: true,
        ),
      ));
      final resume = view.hero! as ResumeHero;
      expect(resume.savedAt, tuesdayEvening.subtract(const Duration(minutes: 2)));
      expect(resume.lead, startsWith('Ends at'));
      expect(resume.line, contains('Saved on the server at'));
    });
  });
}
