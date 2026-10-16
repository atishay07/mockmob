import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/you/goal/goal_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Future<void> _pump(WidgetTester tester, FakeGoal goal, {bool reduced = true}) =>
    pumpMockmob(tester, const GoalScreen(), wrapInScaffold: false, disableAnimations: reduced, overrides: youOverrides(goal: goal));

Finder _day(int n) => find.bySemanticsLabel(RegExp('^$n days? a week'));

void main() {
  testWidgets('shows the saved goal, the rest-days line and a disabled Save', (tester) async {
    await _pump(tester, FakeGoal(goalState(4)));
    expect(find.bySemanticsLabel(RegExp('^Goal: 4 days a week')), findsOneWidget);
    expect(find.text('A study day is a day you finish a practice, a mock or a repair.'), findsOneWidget);
    expect(find.text('Study'), findsOneWidget);
    expect(find.text('Rest'), findsOneWidget);
    expect(tester.widget<KeyButton>(find.byType(KeyButton)).onPressed, isNull);
  });

  testWidgets('picking a day updates the figure and the study/rest split', (tester) async {
    await _pump(tester, FakeGoal(goalState(4)));
    await tester.tap(_day(6));
    await tester.pump();
    expect(find.bySemanticsLabel(RegExp('^Goal: 6 days a week')), findsOneWidget);
    await tester.tap(_day(1));
    await tester.pump();
    expect(find.bySemanticsLabel(RegExp('^Goal: 1 day a week')), findsOneWidget);
    await tester.tap(_day(7));
    await tester.pump();
    expect(find.text('Every day of the week. There are no rest days at this goal.'), findsOneWidget);
    expect(find.text('Rest'), findsNothing);
  });

  testWidgets('every day bubble is a labelled radio with a full-size target', (tester) async {
    await _pump(tester, FakeGoal(goalState(3)));
    for (var n = 1; n <= 7; n++) {
      expect(_day(n), findsOneWidget, reason: '$n');
    }
    final target = tester.getSize(_day(5));
    expect(target.height, greaterThanOrEqualTo(48));
    expect(target.width, greaterThanOrEqualTo(44));
    expect(find.bySemanticsLabel('3 days a week, selected'), findsOneWidget);
  });

  testWidgets('saving sends the days and keeps the pause, then prints a receipt after the server answers', (tester) async {
    final goal = FakeGoal(goalState(4, pausedUntil: '2026-10-26'));
    final analytics = quietAnalytics();
    await pumpMockmob(tester, const GoalScreen(), wrapInScaffold: false, disableAnimations: true, overrides: youOverrides(goal: goal, analytics: analytics));
    await tester.tap(_day(5));
    await tester.pump();
    expect(find.textContaining('Goal saved'), findsNothing);
    await tester.tap(find.text('Save goal'));
    await tester.pump();
    await tester.pump();
    expect(goal.saves, [(5, '2026-10-26')]);
    verify(() => analytics.track('goal_set', props: {'count': 5})).called(1);
    expect(find.text('Goal saved at 10:39 PM.'), findsOneWidget);
    expect(find.text('Study days are paused until 26 October. Changing the goal keeps the pause.'), findsOneWidget);
  });

  testWidgets('an offline save says nothing was changed and shows no receipt', (tester) async {
    await _pump(tester, FakeGoal(goalState(4), saveError: offlineError()));
    await tester.tap(_day(2));
    await tester.pump();
    await tester.tap(find.text('Save goal'));
    await tester.pump();
    await tester.pump();
    expect(find.text('You are offline. Your goal was not changed. Try again when you are connected.'), findsOneWidget);
    expect(find.textContaining('Goal saved'), findsNothing);
  });

  testWidgets('a rejected goal is explained', (tester) async {
    await _pump(tester, FakeGoal(goalState(4), saveError: validationError()));
    await tester.tap(_day(2));
    await tester.pump();
    await tester.tap(find.text('Save goal'));
    await tester.pump();
    await tester.pump();
    expect(find.text('That goal was not accepted. Pick a number from 1 to 7.'), findsOneWidget);
  });

  testWidgets('a failed first load offers Try again', (tester) async {
    final goal = FakeGoal(const RemoteState<Goal>(error: ApiError(kind: ApiErrorKind.network, code: 'network')));
    await _pump(tester, goal);
    expect(find.text('We could not load your goal'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    await tester.pump();
    expect(goal.refreshes, 1);
  });

  testWidgets('while the first load runs it shows a skeleton, not a number', (tester) async {
    await _pump(tester, FakeGoal(const RemoteState<Goal>(loading: true)));
    expect(find.bySemanticsLabel('Loading your goal'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('days a week')), findsNothing);
  });

  testWidgets('an offline cached goal is labelled as such', (tester) async {
    final stale = RemoteState<Goal>(
      value: const Goal(daysPerWeek: 4),
      fetchedAt: DateTime(2026, 10, 12),
      error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
    );
    await _pump(tester, FakeGoal(stale));
    expect(find.text('Showing the goal from the last time you were online.'), findsOneWidget);
  });
}
