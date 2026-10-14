// The week dial, the run ribbon and the medal trail (you-rhythm spec section 2): what they say,
// what a tap does, and that every state draws without overflowing a 320 dp phone.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/week_view.dart';
import 'package:mockmob/features/rhythm/widgets/medal.dart';
import 'package:mockmob/features/rhythm/widgets/run_ribbon.dart';
import 'package:mockmob/features/rhythm/widgets/week_dial.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

const _history = [
  RhythmWeek(weekStart: '2026-10-05', studyDays: 4, goal: 4, met: true),
  RhythmWeek(weekStart: '2026-09-28', studyDays: 5, goal: 4, met: true),
  RhythmWeek(weekStart: '2026-09-21', studyDays: 2, goal: 4, met: false),
];

void main() {
  setUpAll(loadAppFonts);

  group('ribbon data', () {
    test('no closed week, no ribbon', () {
      final rhythm = rhythmFixture();
      expect(ribbonWeeks(rhythm, buildWeekView(rhythm)), isEmpty);
    });

    test('weeks run oldest to newest and this week is last', () {
      final rhythm = rhythmFixture(history: _history);
      final weeks = ribbonWeeks(rhythm, buildWeekView(rhythm));
      expect([for (final w in weeks) w.label], ['21 Sep', '28 Sep', '5 Oct', 'Now']);
      expect(weeks.last.current, isTrue);
      expect(weeks.first.studyDays, 2);
    });

    test('the summary counts closed weeks only and needs two of them', () {
      final rhythm = rhythmFixture(history: _history);
      final weeks = ribbonWeeks(rhythm, buildWeekView(rhythm));
      expect(ribbonSummary(weeks), 'Goal met in 2 of the last 3 weeks.');
      expect(ribbonSummary(weeks.sublist(weeks.length - 2)), isNull);
    });

    test('a met week says so in words for a screen reader', () {
      final rhythm = rhythmFixture(history: _history);
      final weeks = ribbonWeeks(rhythm, buildWeekView(rhythm));
      expect(weeks[2].words, 'Week of 5 October, 4 of 4 days. Goal met.');
      expect(weeks[0].words, 'Week of 21 September, 2 of 4 days.');
    });
  });

  group('widgets', () {
    testWidgets('tapping a week says it in words and a second tap puts the summary back', (tester) async {
      final rhythm = rhythmFixture(history: _history);
      await pumpMockmob(
        tester,
        Padding(padding: const EdgeInsets.all(16), child: RunRibbon(weeks: ribbonWeeks(rhythm, buildWeekView(rhythm)))),
        disableAnimations: true,
        overrides: rhythmOverrides(rhythm: loaded(rhythm)),
      );
      expect(find.text('Goal met in 2 of the last 3 weeks.'), findsOneWidget);
      await tester.tap(find.text('21 Sep'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Week of 21 September, 2 of 4 days.'), findsOneWidget);
      await tester.tap(find.text('21 Sep'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Goal met in 2 of the last 3 weeks.'), findsOneWidget);
    });

    testWidgets('every ribbon week is at least a 40 dp target', (tester) async {
      final rhythm = rhythmFixture(history: _history);
      await pumpMockmob(
        tester,
        RunRibbon(weeks: ribbonWeeks(rhythm, buildWeekView(rhythm))),
        disableAnimations: true,
        overrides: rhythmOverrides(rhythm: loaded(rhythm)),
      );
      final size = tester.getSize(find.bySemanticsLabel('Week of 5 October, 4 of 4 days. Goal met.'));
      expect(size.width, greaterThanOrEqualTo(40));
      expect(size.height, greaterThanOrEqualTo(76));
    });

    for (final (name, done, goal, paused) in const [
      ('goal 7, none counted', 0, 7, false),
      ('goal 1, met', 1, 1, false),
      ('past the goal', 6, 4, false),
      ('paused', 2, 4, true),
    ]) {
      testWidgets('the dial draws $name on a 320 dp phone without overflowing', (tester) async {
        await pumpMockmob(
          tester,
          Center(child: WeekDial(done: done, goal: goal, size: 184, paused: paused)),
          size: const Size(320, 640),
          overrides: rhythmOverrides(rhythm: loaded(rhythmFixture())),
        );
        await tester.pump(const Duration(seconds: 2));
        expect(tester.takeException(), isNull);
        if (!paused) expect(find.text('$done'), findsOneWidget);
      });
    }

    testWidgets('a medal engraves its numeral and settles without a ticker leak', (tester) async {
      await pumpMockmob(
        tester,
        const Row(children: [
          Medal(status: MedalStatus.landed, text: '25', animateLanding: true),
          Medal(status: MedalStatus.next, text: '10'),
          Medal(status: MedalStatus.later, text: '5'),
          Medal.plain(status: MedalStatus.landed),
        ]),
        overrides: rhythmOverrides(rhythm: loaded(rhythmFixture())),
      );
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('25'), findsOneWidget);
      expect(find.text('10'), findsOneWidget);
    });
  });
}
