// The daily goal, option A (H1, 19 Oct): the parser keeps any goal from 5 to 999 minutes (a custom
// goal is never reset to 20), the four bubbles with More, the More sheet (1 hour, 2 hours, your own
// in 15-minute steps with no cap), Mobi's line, the goal sheet's slot (only what the record says) and
// the server's study length (the nearest it holds, never a refusal).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/goal_copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/widgets/goal_bubbles.dart';
import 'package:mockmob/features/today/logic/pattern_fixtures.dart';
import 'package:mockmob/features/today/logic/study_pattern.dart';
import 'package:mockmob/features/you/data/study_length.dart';
import 'package:mockmob/features/you/goal/daily_goal_sheet.dart';

import '../../helpers/fonts.dart';

Future<void> _host(WidgetTester tester, Widget child, {Brightness brightness = Brightness.dark}) async {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    child: MaterialApp(
      theme: buildTheme(brightness),
      home: Scaffold(body: Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: child)),
    ),
  ));
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUpAll(loadAppFonts);

  group('the parser', () {
    test('keeps 10, 20 and 30, and any longer goal; only junk falls back to 20', () {
      for (final m in [5, 10, 20, 30, 45, 60, 90, 120, 240, 999]) {
        expect(parseGoalMinutes(m), m, reason: '$m');
      }
      expect(parseGoalMinutes(90.0), 90);
      expect(parseGoalMinutes('90'), 90);
      for (final junk in [null, 4, 0, -10, 1000, 12.5, 'soon', double.nan]) {
        expect(parseGoalMinutes(junk), isNull, reason: '$junk');
      }
    });

    test('60, 90 and 120 survive a save and a reload; a custom goal is never reset to 20', () {
      for (final m in [60, 90, 120, 15, 600]) {
        final back = OnboardingAnswers.fromJson(const OnboardingAnswers().copyWith(minutes: m).toJson());
        expect(back.minutes, m, reason: '$m');
      }
      expect(OnboardingAnswers.fromJson({'v': 1, 'minutes': 'x'}).minutes, 20);
    });
  });

  group('the words', () {
    test('a goal reads as minutes or hours, in the bubble and in a sentence', () {
      expect(GoalCopy.short(45), '45');
      expect(GoalCopy.short(60), '1h');
      expect(GoalCopy.short(90), '1h 30');
      expect(GoalCopy.short(120), '2h');
      expect(GoalCopy.words(90), '1 hour 30 minutes');
      expect(GoalCopy.words(120), '2 hours');
      expect(GoalCopy.caption(60), 'a mock a day');
      expect(GoalCopy.caption(120), 'two mocks a day');
      expect(GoalCopy.caption(90), 'a day');
      expect(GoalCopy.use(90), 'Use 1 hour 30 minutes a day');
      expect(GoalCopy.rowValue(60, 4), '1 hour a day, 4 days a week');
      expect(GoalCopy.rowValue(null, 1), '1 day a week');
    });

    test("Mobi's line under the bubbles follows the choice alone and claims nothing about the student", () {
      expect(GoalCopy.slotLine(20), 'Full mocks are in Practice whenever you want one. Tap More for an hour or longer.');
      expect(GoalCopy.slotLine(60), 'One hour fits a full mock, timed like the exam. You can change this any time in You.');
      expect(GoalCopy.slotLine(90), '1 hour 30 minutes fits a full mock, with time left to repair what it finds. You can change this any time in You.');
      expect(GoalCopy.slotLine(120), 'Two hours fits two full mocks. A short break between them helps.');
      expect(GoalCopy.slotLine(300), 'That is a big day. Short breaks between papers help the marks stick.');
      for (final m in [5, 10, 20, 30, 45, 60, 90, 120, 180, 300, 999]) {
        expect(GoalCopy.slotLine(m), isNot(contains('usually')), reason: 'no history in onboarding');
      }
    });
  });

  group('the goal sheet slot', () {
    final clock = DateTime.utc(2026, 10, 19, 16, 30);

    test('a new student gets the plain line for the choice, never a pattern', () {
      final slot = goalSlot(PatternFixtures.fresh().pattern(clock), 60);
      expect(slot.line, GoalCopy.slotLine(60));
      expect(slot.header, isNull);
      expect(slot.offer, isNull);
      expect(goalSlot(null, 30).line, GoalCopy.slotLine(30));
    });

    test('a regular student who keeps beating the goal is offered the raise, with its own numbers', () {
      final slot = goalSlot(PatternFixtures.regular(clock).pattern(clock), 30);
      expect(slot.offer, 40);
      expect(slot.line, 'You have done about 40 minutes on 5 of your last 7 study days. A 40-minute goal would match how you really study.');
      expect(slot.header, GoalCopy.fromRecord);
    });

    test('an irregular student is told nothing his record does not show', () {
      final p = PatternFixtures.irregular(clock).pattern(clock);
      final slot = goalSlot(p, 20);
      expect(slot.offer, isNull);
      expect(slot.line, GoalCopy.slotLine(20));
    });
  });

  test("the server's study length gets the nearest it holds, never a refusal", () {
    expect([for (final m in [5, 10, 15, 20, 25, 30, 60, 90, 999]) sessionMinutesForServer(m)], [10, 10, 20, 20, 30, 30, 30, 30, 30]);
  });

  group('the bubbles', () {
    testWidgets('10, 20, 30 and More; a long goal fills the fourth bubble', (tester) async {
      var value = 20;
      await _host(tester, StatefulBuilder(builder: (context, set) => GoalBubbles(value: value, onChanged: (m) => set(() => value = m))));
      expect(tester.takeException(), isNull);
      expect(find.text('10'), findsOneWidget);
      expect(find.text('20'), findsOneWidget);
      expect(find.text('30'), findsOneWidget);
      expect(find.text(GoalCopy.more), findsOneWidget);
      expect(find.bySemanticsLabel(GoalCopy.moreSpoken), findsOneWidget);
      await tester.tap(find.text('30'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(value, 30);

      // More opens the sheet; Use 1 hour a day picks it.
      await tester.tap(find.text(GoalCopy.more));
      await tester.pumpAndSettle();
      expect(find.text(GoalCopy.moreTitle), findsOneWidget);
      await tester.tap(find.text(GoalCopy.use(60)));
      await tester.pumpAndSettle();
      expect(value, 60);
      expect(find.text('1h'), findsOneWidget);
      expect(find.text('a mock a day'), findsOneWidget);
    });

    testWidgets('your own length: 15-minute steps, the minus stops at 15 and says why, no cap below the store bound', (tester) async {
      int? used;
      await _host(tester, SingleChildScrollView(child: GoalMoreSheet(current: 20, onUse: (m) => used = m)));
      expect(tester.takeException(), isNull);
      // Starts on 1 hour; the own length waits at 1h 30.
      expect(find.text(GoalCopy.use(60)), findsOneWidget);
      expect(find.text('1h 30'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(GoalCopy.longer));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('1h 45'), findsOneWidget);
      expect(find.text(GoalCopy.use(105)), findsOneWidget, reason: 'a step picks the own length');
      for (var k = 0; k < 6; k++) {
        await tester.tap(find.bySemanticsLabel(GoalCopy.shorter));
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('15'), findsOneWidget);
      expect(find.bySemanticsLabel(GoalCopy.shortest), findsOneWidget, reason: 'the minus says why it stops');
      await tester.tap(find.text(GoalCopy.twoHours));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.text(GoalCopy.use(120)));
      expect(used, 120);
      expect(GoalMoreSheet.longest, greaterThanOrEqualTo(990));
    });

    testWidgets('the More sheet fits 360 dp in Day too, with nothing overflowing', (tester) async {
      await _host(tester, SingleChildScrollView(child: GoalMoreSheet(current: 90, onUse: (_) {})), brightness: Brightness.light);
      expect(tester.takeException(), isNull);
      expect(find.text(GoalCopy.use(90)), findsOneWidget, reason: 'a custom goal opens on its own length');
    });
  });

  test('a goal set from You counts as set from then on (the pattern reads the goal only when set)', () {
    final p = StudyPattern.from(log: const [], now: DateTime.utc(2026, 10, 19, 16, 30), goalMinutes: 90);
    expect(p.remainingMinutes, 90);
    expect(adviseLength(p).target, 90);
  });
}
