// The app's pull to refresh (MOTION.md C10, GLASS-1017 5.9): the page travels down with the
// finger, and while the data loads it holds a gap open under the status bar so the ring never
// sits over the first line of the page; when the data lands the page returns.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/mm_scroll_behavior.dart';
import 'package:mockmob/core/motion/motion.dart' show MmPullRefresh;
import 'package:mockmob/core/theme/theme.dart';

Widget _app(Future<void> Function() onRefresh, {bool reduced = false}) => ProviderScope(
  child: MaterialApp(
    scrollBehavior: const MmScrollBehavior(),
    theme: buildTheme(Brightness.dark),
    builder: (context, app) => MediaQuery(
      data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
      child: app!,
    ),
    home: Scaffold(
      body: MmPullRefresh(
        onRefresh: onRefresh,
        child: CustomScrollView(
          physics: MmScrollBehavior.page,
          slivers: [
            SliverList.list(children: [for (var i = 0; i < 40; i++) SizedBox(height: 60, child: Text('Row $i'))]),
          ],
        ),
      ),
    ),
  ),
);

double _firstRowTop(WidgetTester tester) => tester.getTopLeft(find.text('Row 0')).dy;

/// Time passing in frames, as on a phone: the gap's tween starts on the frame after the refresh
/// begins, so one long pump would not play it (a ring that spins never settles either).
Future<void> _frames(WidgetTester tester, {int count = 12}) async {
  for (var i = 0; i < count; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _pullPastThreshold(WidgetTester tester) async {
  final gesture = await tester.startGesture(const Offset(200, 300));
  for (var i = 0; i < 26; i++) {
    await gesture.moveBy(const Offset(0, 14));
    await tester.pump(const Duration(milliseconds: 16));
  }
  await gesture.up();
  await tester.pump();
}

void main() {
  testWidgets('a pull moves the page with the finger; below the threshold nothing refreshes', (tester) async {
    var refreshes = 0;
    await tester.pumpWidget(_app(() async => refreshes++));
    final rest = _firstRowTop(tester);
    final gesture = await tester.startGesture(const Offset(200, 300));
    for (var i = 0; i < 4; i++) {
      await gesture.moveBy(const Offset(0, 14));
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(_firstRowTop(tester), greaterThan(rest + 10));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(refreshes, 0);
    expect(_firstRowTop(tester), closeTo(rest, 0.5));
  });

  testWidgets('while refreshing the page holds a gap for the ring, and returns when the data lands', (tester) async {
    final done = Completer<void>();
    await tester.pumpWidget(_app(() => done.future));
    final rest = _firstRowTop(tester);

    await _pullPastThreshold(tester);
    await _frames(tester);
    expect(_firstRowTop(tester), closeTo(rest + MmPullRefresh.holdExtent, 1), reason: 'the first line starts below the ring, not under it');

    done.complete();
    await tester.pump();
    await tester.pumpAndSettle();
    expect(_firstRowTop(tester), closeTo(rest, 0.5), reason: 'the page returns as the ring lifts away');
  });

  testWidgets('reduced motion: the gap is there at once and has room for the word under the ring', (tester) async {
    final done = Completer<void>();
    await tester.pumpWidget(_app(() => done.future, reduced: true));
    final rest = _firstRowTop(tester);
    await _pullPastThreshold(tester);
    await _frames(tester);
    expect(find.text('Refreshing'), findsOneWidget);
    expect(_firstRowTop(tester), closeTo(rest + MmPullRefresh.holdExtentWithWords, 1));
    done.complete();
    await tester.pumpAndSettle();
    expect(_firstRowTop(tester), closeTo(rest, 0.5));
  });

  testWidgets('a failed refresh gives the gap back too', (tester) async {
    final failed = Completer<void>();
    await tester.pumpWidget(_app(() => failed.future));
    final rest = _firstRowTop(tester);
    await _pullPastThreshold(tester);
    await _frames(tester);
    failed.completeError(StateError('offline'));
    await tester.pump();
    await tester.pumpAndSettle();
    expect(_firstRowTop(tester), closeTo(rest, 0.5));
  });

  testWidgets('a refresh still running when the page is scrolled away from the top takes its ring with it, never over content (v13 walk, 2)', (tester) async {
    final done = Completer<void>();
    await tester.pumpWidget(_app(() => done.future, reduced: true));
    await _pullPastThreshold(tester);
    await _frames(tester);

    double shown() {
      var opacity = 1.0;
      for (final o in tester.widgetList<Opacity>(find.ancestor(of: find.text('Refreshing'), matching: find.byType(Opacity)))) {
        opacity *= o.opacity;
      }
      return opacity;
    }

    expect(find.text('Refreshing'), findsOneWidget);
    expect(shown(), 1);

    // The student scrolls down the page while it is still loading.
    await tester.drag(find.byType(CustomScrollView), const Offset(0, -400));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(shown(), 0, reason: 'no ring or words over the rows below the top');

    // Back at the top it is there again.
    await tester.drag(find.byType(CustomScrollView), const Offset(0, 600));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(shown(), greaterThan(0.9));
    done.complete();
    await tester.pumpAndSettle();
  });
}
