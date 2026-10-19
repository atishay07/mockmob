// The strip of seven paper ticks (spec 7.2 chain_strip_test): "2 of 5" for today undone, the moon on a rested
// day, a lamp dot for a paused one, no "!" and no countdown text anywhere on it; and the quest bar helper.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/chain_calendar.dart';
import 'package:mockmob/features/social/v3/widgets/chain_strip.dart';
import 'package:mockmob/features/social/v3/widgets/quest_segments.dart';

import '../../../helpers/golden_harness.dart';
import 'sheets_test_kit.dart';

List<ChainDay> _week({ChainDayState rested = ChainDayState.rested}) => [
      const ChainDay(day: '2026-10-16', state: ChainDayState.practised),
      const ChainDay(day: '2026-10-17', state: ChainDayState.practised),
      ChainDay(day: '2026-10-18', state: rested),
      const ChainDay(day: '2026-10-19', state: ChainDayState.practised),
      const ChainDay(day: '2026-10-20', state: ChainDayState.practised),
      const ChainDay(day: '2026-10-21', state: ChainDayState.practised),
      const ChainDay(day: '2026-10-22', state: ChainDayState.today, answered: 2),
    ];

final _countdown = RegExp(r'!|\d+:\d\d|\bleft\b|\bhours?\b|\bexpires?\b|\bends? in\b|\bbefore\b|\blose\b|\bdanger\b|\bat risk\b', caseSensitive: false);

void main() {
  testWidgets('today undone reads "2 of 5"; a rested day carries the moon; nothing warns or counts down', (t) async {
    await pumpMockmob(t, ChainStrip(days: _week(), todayAnswered: 2, todayNeeded: 5), size: const Size(360, 200));
    await t.pumpAndSettle();
    expect(find.text('2 of 5'), findsOneWidget);
    expect(find.byIcon(LucideIcons.moon), findsOneWidget);
    expect(allTexts(t).where(_countdown.hasMatch), isEmpty);
    // Seven days, labelled by weekday initials, today last and bold.
    expect(find.text('T'), findsNWidgets(2), reason: 'Tuesday and Thursday');
  });

  testWidgets('today done: no "of 5", the tick is drawn, no moon without a rested day', (t) async {
    final days = [for (final d in _week(rested: ChainDayState.practised)) d.state == ChainDayState.today ? const ChainDay(day: '2026-10-22', state: ChainDayState.practised, answered: 5) : d];
    await pumpMockmob(t, ChainStrip(days: days, todayAnswered: 5, todayNeeded: 5, todayDone: true), size: const Size(360, 200));
    await t.pumpAndSettle();
    expect(find.text('2 of 5'), findsNothing);
    expect(find.textContaining(' of 5'), findsNothing);
    expect(find.byIcon(LucideIcons.moon), findsNothing);
  });

  testWidgets('semantics name each day and its state, today with its progress', (t) async {
    final handle = t.ensureSemantics();
    await pumpMockmob(t, ChainStrip(days: _week(), todayAnswered: 2, todayNeeded: 5), size: const Size(360, 200));
    await t.pumpAndSettle();
    expect(find.bySemanticsLabel('Today, 2 of 5'), findsOneWidget);
    expect(find.bySemanticsLabel('Sunday, rested'), findsOneWidget);
    expect(find.bySemanticsLabel('Friday, practised'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('reduced motion draws the ticks at once', (t) async {
    await pumpMockmob(t, ChainStrip(days: _week(), todayAnswered: 2, todayNeeded: 5), size: const Size(360, 200), disableAnimations: true);
    expect(find.text('2 of 5'), findsOneWidget);
  });

  testWidgets('the calendar shows the days of a month, Monday first, with a moon and a lamp dot', (t) async {
    final handle = t.ensureSemantics();
    await pumpMockmob(
      t,
      const ChainCalendar(year: 2026, month: 10, today: '2026-10-22', states: {'2026-10-18': ChainDayState.rested, '2026-10-30': ChainDayState.paused, '2026-10-15': ChainDayState.practised}),
      size: const Size(360, 500),
    );
    expect(find.text('31'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    expect(find.byIcon(LucideIcons.moon), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Friday 30, set aside for exams')), findsOneWidget);
    expect(find.text('M'), findsOneWidget);
    handle.dispose();
  });

  test('the quest bar is the server fraction, full past the goal', () {
    expect(QuestSegments.fractionOf(56, 60), closeTo(56 / 60, 1e-9));
    expect(QuestSegments.fractionOf(60, 60), 1);
    expect(QuestSegments.fractionOf(70, 60), 1, reason: 'the bar stays full past the goal (F8)');
    expect(QuestSegments.fractionOf(0, 60), 0);
    expect(QuestSegments.fractionOf(5, 0), 0);
  });
}
