// App polish 2 (v15 walk, 18 Oct): words that change in place never show two at once, the Practice ticket does not
// blink on a changed length, the runner says "More below", the offline words fit one line, the Sunday week makes
// no promise of a day that is gone, a Quick 10 is named so, the plan sheet's last question clears its footer, and Today
// reads the plan again by itself when only the plan failed.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/repositories/plan_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/bubbles/week_bubbles.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/widgets/get_panel.dart';
import 'package:mockmob/features/review/widgets/page_header.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/widgets/plan_flow_sheet.dart';
import 'package:mockmob/features/today/widgets/road_glance.dart';
import 'package:mockmob/features/today/widgets/road_section.dart' show RoadActions;
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/hub/sheet_fields.dart' show SheetWeek, WeekField;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../practice/support/harness.dart' show dailyFree;
import '../runner/support/fake_session.dart';
import '../runner/support/harness.dart';
import '../today/support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

/// Friday, Saturday and Sunday counted; Sunday is today. Three of the four days the goal asks for, and no day left.
const TodayWeek _sundayCounted = TodayWeek(
  studied: [false, false, false, false, true, true, true],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

class _CountingPlan extends PlanRepository {
  _CountingPlan(super.minutes, this.log);

  final List<String> log;

  @override
  RemoteState<LearningPlan> build() => const RemoteState<LearningPlan>.idle();

  @override
  Future<void> refresh({bool force = false}) async => log.add('plan');
}

void main() {
  setUpAll(loadAppFonts);

  group('words that change in place (MmFadeThrough)', () {
    Widget swap(String word) => Center(child: MmFadeThrough(rise: 4, child: Text(word, key: ValueKey(word))));

    double opacityOf(WidgetTester tester, String word) {
      final found = find.ancestor(of: find.text(word), matching: find.byType(Opacity));
      return found.evaluate().isEmpty ? 0 : tester.widget<Opacity>(found.first).opacity;
    }

    testWidgets('the old words leave first and the new ones arrive after: never both readable', (tester) async {
      late StateSetter set;
      var word = 'Skip';
      await pumpMockmob(tester, StatefulBuilder(builder: (context, setState) {
        set = setState;
        return swap(word);
      }));
      expect(opacityOf(tester, 'Skip'), 1);
      set(() => word = 'Done');
      await tester.pump();
      var worst = 0.0;
      for (var ms = 0; ms <= 240; ms += 10) {
        final both = opacityOf(tester, 'Skip') < opacityOf(tester, 'Done') ? opacityOf(tester, 'Skip') : opacityOf(tester, 'Done');
        if (both > worst) worst = both;
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(worst, 0, reason: 'at no frame are both words drawn');
      expect(find.text('Skip'), findsNothing);
      expect(opacityOf(tester, 'Done'), 1);
    });

    testWidgets('under reduced motion the words swap at once', (tester) async {
      late StateSetter set;
      var word = 'Skip';
      await pumpMockmob(tester, StatefulBuilder(builder: (context, setState) {
        set = setState;
        return swap(word);
      }), disableAnimations: true);
      set(() => word = 'Done');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 20));
      expect(find.text('Skip'), findsNothing);
      expect(find.text('Done'), findsOneWidget);
    });
  });

  group('the Practice ticket does not blink when the length changes', () {
    Widget panel({required AsyncValue<PracticeQuote>? quote, required bool pending, int count = 10}) => Padding(
          padding: const EdgeInsets.all(16),
          child: GetPanel(
            selection: PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: count),
            subjectName: 'Accountancy',
            quote: quote,
            pending: pending,
            offline: false,
            onRetry: () {},
            onUseDailyCount: () {},
            onOpenConcepts: () {},
            onOpenReview: () {},
          ),
        );

    testWidgets('a changed selection keeps the rows, quieter, until the new quote lands; no skeleton, no second rise', (tester) async {
      late StateSetter set;
      AsyncValue<PracticeQuote>? quote = AsyncData(dailyFree(count: 10));
      var pending = false;
      var count = 10;
      await pumpMockmob(tester, StatefulBuilder(builder: (context, setState) {
        set = setState;
        return panel(quote: quote, pending: pending, count: count);
      }), disableAnimations: true);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(PracticeCopy.whatYouGet), findsOneWidget);
      expect(find.textContaining('10 questions'), findsWidgets);
      // The tap on 20: the quote is asked again.
      set(() {
        count = 20;
        quote = null;
        pending = true;
      });
      await tester.pump();
      expect(find.text(PracticeCopy.whatYouGet), findsOneWidget, reason: 'the ticket stays; the body does not turn into a skeleton');
      expect(find.textContaining('10 questions'), findsWidgets, reason: 'the old figures hold while the new quote is read');
      final held = tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity).first);
      expect(held.opacity, lessThan(1), reason: 'held a step lighter');
      // The new quote lands: the figures change in place.
      set(() {
        quote = AsyncData(dailyFree(count: 20));
        pending = false;
      });
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.textContaining('20 questions'), findsWidgets);
      expect(find.textContaining('10 questions'), findsNothing);
      expect(tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity).first).opacity, 1);
    });
  });

  group('the runner says there is more below, until the first scroll', () {
    double cue(WidgetTester tester) => tester.widget<AnimatedOpacity>(find.byKey(const ValueKey('runner-more-options'))).opacity;

    testWidgets('a short window: "More below" shows; the first scroll takes it away', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, size: const Size(360, 520), disableAnimations: true);
      await settle(tester);
      expect(find.text(RunnerCopy.moreOptions), findsOneWidget);
      expect(cue(tester), 1);
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -60));
      await settle(tester);
      expect(cue(tester), 0, reason: 'the student who has scrolled knows');
    });

    testWidgets('a tall window with everything in view shows nothing', (tester) async {
      final s = FakeRunnerSession(questions: accountancyQuestions(10), mode: 'quick', mockNumber: null);
      await pumpRunner(tester, session: s, size: const Size(384, 1400), disableAnimations: true);
      await settle(tester);
      expect(cue(tester), 0);
    });
  });

  group('the offline words fit one line', () {
    test('the retry line names the last good read and is short enough for a phone', () {
      final header = buildToday(ashaInputs(attemptsStale: true, lastTriedAt: DateTime.utc(2026, 10, 13, 14, 10)));
      final line = header.header.updatedLine!;
      expect(line, startsWith('Still not loading. Last loaded '));
      expect(line.length, lessThan(44), reason: 'the old "Tried 10:18 AM, still not loading. Last loaded 10:14 AM." was 59 characters and cut the time');
    });

    for (final width in [360.0, 320.0]) {
      testWidgets('on Review, beside the Ask pill at $width dp, the line stays on one line and the header keeps its height', (tester) async {
        Future<double> heightWith(String? notice) async {
          await pumpMockmob(tester, ReviewTabHeader(title: 'Review', notice: notice, onAsk: () {}), size: Size(width, 400), disableAnimations: true);
          return tester.getSize(find.byType(ReviewTabHeader)).height;
        }

        final plain = await heightWith(null);
        final offline = await heightWith('Offline. Last loaded 10:12 AM.');
        expect(offline, plain, reason: 'the card under the header does not move when the line appears');
        expect(find.text('Offline. Last loaded 10:12 AM.'), findsOneWidget);
      });
    }
  });

  group('the Sunday week promises no day that is gone', () {
    SheetWeek week({required List<WeekDayMark> marks, required int today, required int done, int goal = 4}) => SheetWeek.ready(
          days: [for (var d = 0; d < 7; d++) WeekBubbleDay(mark: marks[d], isToday: d == today)],
          count: '$done of $goal study days',
          description: 'week',
          done: done,
          goal: goal,
        );

    Future<void> pumpWeek(WidgetTester tester, SheetWeek w) => pumpMockmob(tester, WeekField(week: w, onOpen: () {}), disableAnimations: true);

    testWidgets('You: Friday, Saturday, Sunday counted and Sunday is today: no day left', (tester) async {
      const o = WeekDayMark.open;
      const d = WeekDayMark.done;
      await pumpWeek(tester, week(marks: [o, o, o, o, d, d, d], today: 6, done: 3));
      expect(find.text(YouCopy.weekNoDaysLeft), findsOneWidget);
      expect(find.textContaining('more study day'), findsNothing);
    });

    testWidgets('You: Sunday still open, one study day reaches the goal', (tester) async {
      const o = WeekDayMark.open;
      const d = WeekDayMark.done;
      await pumpWeek(tester, week(marks: [o, o, o, d, d, d, o], today: 6, done: 3));
      expect(find.text(YouCopy.weekToGo(1)), findsOneWidget);
    });

    testWidgets('You: Wednesday, two done of four, five days still open', (tester) async {
      const o = WeekDayMark.open;
      const d = WeekDayMark.done;
      await pumpWeek(tester, week(marks: [d, d, o, o, o, o, o], today: 2, done: 2));
      expect(find.text(YouCopy.weekToGo(2)), findsOneWidget);
    });

    testWidgets('Today: the week line on Sunday, counted, says no study days are left; open, it still says one is', (tester) async {
      final done = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _sundayCounted));
      expect(done.glance!.road!.weekDaysOpen, 0);
      await pumpMockmob(tester, SingleChildScrollView(child: RoadGlance(layers: done.glance!.road!, road: done.road!, onOpen: (_) {})), size: const Size(412, 2400), disableAnimations: true);
      expect(find.textContaining('Left: 1 study day'), findsNothing);
      expect(find.textContaining('No study days left this week'), findsOneWidget);

      const open = TodayWeek(
        studied: [true, false, false, true, false, true, false],
        todayIndex: 6,
        label: '3 of 4 study days',
        goal: 4,
        planned: {0, 3, 5, 6},
        dates: [12, 13, 14, 15, 16, 17, 18],
      );
      final still = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: open));
      expect(still.glance!.road!.weekDaysOpen, 1);
      await pumpMockmob(tester, SingleChildScrollView(child: RoadGlance(layers: still.glance!.road!, road: still.road!, onOpen: (_) {})), size: const Size(412, 2400), disableAnimations: true);
      expect(find.text('Left: 1 study day by Sun.'), findsOneWidget);
    });
  });

  group('the badge line names a quick set as the app names it', () {
    test('Quick 10, Smart 5, full mock; "practice set" only when the size is not known', () {
      expect(RhythmCopy.paperKind('quick', total: 10), 'Quick 10');
      expect(RhythmCopy.paperKind('chapter', total: 20), 'Quick 20');
      expect(RhythmCopy.paperKind('smart', total: 5), 'Smart 5');
      expect(RhythmCopy.paperKind('full'), 'full mock');
      expect(RhythmCopy.paperKind('nta'), 'NTA mode paper');
      expect(RhythmCopy.paperKind('quick'), 'practice set');
      expect(RhythmCopy.paperKind('quick', total: 0), 'practice set');
    });
  });

  group('Change plan, the last question, on the owner\'s phone', () {
    testWidgets('"Your own number" clears the fade above the pinned footer at 360 by 800', (tester) async {
      final view = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _sundayCounted, reviseDue: 6));
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showPlanFlow(
                context,
                layers: view.glance!.road!,
                road: view.road!,
                initialStep: 2,
                actions: RoadActions(savePace: (_) async {}, setExamDate: (_) async {}, setMockTarget: (_) async {}),
              ),
              child: const Text('open plan'),
            ),
          ),
        ),
        size: const Size(360, 800),
        disableAnimations: true,
        overrides: [authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'))],
      );
      await tester.tap(find.text('open plan'));
      await tester.pumpAndSettle();
      final card = tester.getRect(find.byKey(const ValueKey('plan-pace-own')));
      final footerTop = tester.getRect(find.byType(PlanFooterHost)).top;
      // The footer's 8 dp pad, then the 40 dp the body dissolves over.
      expect(card.bottom, lessThanOrEqualTo(footerTop - 8 - 40), reason: 'the card is whole, not inside the dissolve');
    });
  });

  group('Today reads the plan again by itself when only the plan failed', () {
    TodayInputs inputs({bool planStale = true, bool attemptsStale = false, bool offline = false}) =>
        TodayInputs(now: _sunday, planStale: planStale, attemptsStale: attemptsStale, offline: offline);

    testWidgets('two quiet tries, 20 s and 75 s after the failure, then no more', (tester) async {
      final log = <String>[];
      final container = ProviderContainer(overrides: [
        todayInputsProvider.overrideWithValue(inputs()),
        planRepositoryProvider.overrideWith2((minutes) => _CountingPlan(minutes, log)),
      ]);
      addTearDown(container.dispose);
      container.listen(todayQuietPlanRetryProvider, (_, _) {});
      await tester.pump(const Duration(seconds: 19));
      expect(log, isEmpty);
      await tester.pump(const Duration(seconds: 2));
      expect(log, ['plan']);
      await tester.pump(const Duration(seconds: 73));
      expect(log, ['plan']);
      await tester.pump(const Duration(seconds: 2));
      expect(log, ['plan', 'plan']);
      await tester.pump(const Duration(minutes: 10));
      expect(log, hasLength(2), reason: 'never a timer that runs for ever');
    });

    for (final (name, i) in [
      ('a fresh plan', TodayInputs(now: DateTime.utc(2026, 10, 18, 14, 10))),
      ('papers that are stale too (the header already runs Try again)', TodayInputs(now: DateTime.utc(2026, 10, 18, 14, 10), planStale: true, attemptsStale: true)),
      ('a phone that is offline', TodayInputs(now: DateTime.utc(2026, 10, 18, 14, 10), planStale: true, offline: true)),
    ]) {
      testWidgets('nothing is read for $name', (tester) async {
        final log = <String>[];
        final container = ProviderContainer(overrides: [
          todayInputsProvider.overrideWithValue(i),
          planRepositoryProvider.overrideWith2((minutes) => _CountingPlan(minutes, log)),
        ]);
        addTearDown(container.dispose);
        container.listen(todayQuietPlanRetryProvider, (_, _) {});
        await tester.pump(const Duration(minutes: 5));
        expect(log, isEmpty);
      });
    }
  });
}
