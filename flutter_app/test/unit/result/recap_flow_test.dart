import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

RecapData _data(RecapModel m, [AttemptDetail? d]) {
  final det = d ?? detail();
  return RecapData(model: m, attempt: det.attempt, detail: det);
}

String _at(GoRouter r) => r.routerDelegate.currentConfiguration.uri.toString();

/// One frame to start tickers, then [ms] of time in 16 ms frames.
Future<void> _run(WidgetTester tester, int ms) async {
  await tester.pump();
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  setUpAll(loadAppFonts);

  late ResultLog actions;
  late FakeHaptics haptics;

  Future<GoRouter> pump(
    WidgetTester tester,
    String location, {
    RecapModel? model,
    AttemptDetail? d,
    RecapRitual ritual = const RecapRitual(sheetsOpened: 1),
    bool reduced = false,
  }) async {
    actions = ResultLog();
    haptics = FakeHaptics();
    final m = model ?? mock7();
    final router = await pumpResultRoute(
      tester,
      location: location,
      disableAnimations: reduced,
      overrides: resultOverrides(attemptId: m.attemptId, data: _data(m, d), ritual: ritual, haptics: haptics, log: actions),
    );
    await _run(tester, 50);
    return router;
  }

  Future<void> drag(WidgetTester tester, double dy) async {
    // A steady, unhurried drag (about 450 dp/s), so release velocity never counts as a flick.
    final g = await tester.startGesture(tester.getCenter(find.text('Open your result')));
    const steps = 24;
    for (var i = 1; i <= steps; i++) {
      await g.moveBy(Offset(0, -dy / steps), timeStamp: Duration(milliseconds: 16 * i));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await g.up();
    await _run(tester, 600);
  }

  group('the sealed sheet', () {
    testWidgets('a tap on the tab lifts it open, with the open haptic, and marks the result opened', (tester) async {
      await pump(tester, '/result/a7/sealed');
      expect(find.text('Your sheet is back.'), findsOneWidget);
      expect(find.text('Marked on the server.'), findsOneWidget);
      // The effort line is said once, by Mobi on card 4, never on the sealed sheet.
      expect(find.textContaining('full paper this month'), findsNothing);
      await tester.tap(find.text('Open your result'));
      await _run(tester, 700);
      expect(haptics.calls, containsAllInOrder(['light', 'medium']));
      expect(actions.opened, ['a7']);
      await _run(tester, 2000);
      expect(find.bySemanticsLabel('115 out of 250 marks'), findsWidgets);
      expect(find.text('Where the marks went'), findsOneWidget);
    });

    testWidgets('a drag past 60% completes, with ticks at 25, 50 and 75%', (tester) async {
      await pump(tester, '/result/a7/sealed');
      await drag(tester, 172);
      expect(haptics.calls.where((c) => c == 'selection').length, 3);
      expect(haptics.calls.last, 'medium');
      expect(actions.opened, ['a7']);
      await _run(tester, 2000);
    });

    testWidgets('a long drag that lays the flap flat stays on the reveal, not card 2', (tester) async {
      await pump(tester, '/result/a7/sealed');
      // Well past the 180 dp of travel: the flap is flat before the finger lifts.
      await drag(tester, 320);
      expect(actions.opened, ['a7']);
      await _run(tester, 2000);
      expect(find.bySemanticsLabel('115 out of 250 marks'), findsWidgets);
      expect(find.text('Where the other 135 marks went'), findsNothing);
    });

    testWidgets('a drag under 60% settles back with no open haptic', (tester) async {
      await pump(tester, '/result/a7/sealed');
      await drag(tester, 80);
      expect(haptics.calls, isNot(contains('medium')));
      expect(actions.opened, isEmpty);
      expect(find.text('Open your result'), findsOneWidget);
    });

    testWidgets('a lower result opens with no ticks', (tester) async {
      final d = detail(recap: {'tone': 'lower'});
      await pump(
        tester,
        '/result/a7/sealed',
        model: mock7(withDetail: d),
        d: d,
      );
      await drag(tester, 160);
      expect(haptics.calls, ['medium']);
      await _run(tester, 1000);
      expect(find.text('Your result is ready. Start with one repeated pattern.'), findsOneWidget);
      expect(find.text('Show me the first thing to fix'), findsOneWidget);
    });

    testWidgets('Open without the reveal goes straight to the full result', (tester) async {
      final router = await pump(tester, '/result/a7/sealed');
      await tester.tap(find.text('Open without the reveal'));
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
      expect(_at(router), '/result/a7');
      expect(actions.opened, ['a7']);
    });

    testWidgets('TalkBack has a custom action that skips the reveal', (tester) async {
      final semantics = tester.ensureSemantics();
      await pump(tester, '/result/a7/sealed');
      final node = tester.getSemantics(find.bySemanticsLabel(RegExp('Mock 7 result, sealed')).first);
      final actionsList = node.getSemanticsData().customSemanticsActionIds ?? const <int>[];
      expect(actionsList, isNotEmpty);
      expect(CustomSemanticsAction.getAction(actionsList.first)!.label, 'Open without the reveal');
      semantics.dispose();
    });

    testWidgets('from the fourth sheet one tap fades it open, no travel', (tester) async {
      await pump(tester, '/result/a7/sealed', ritual: const RecapRitual(sheetsOpened: 3));
      await tester.tap(find.text('Open your result'));
      await _run(tester, 200);
      expect(actions.opened, ['a7']);
      expect(haptics.calls, ['medium']);
      await _run(tester, 2000);
    });

    testWidgets('reduced motion shows the figure at once after opening', (tester) async {
      await pump(tester, '/result/a7/sealed', reduced: true);
      await tester.tap(find.text('Open your result'));
      await _run(tester, 250);
      expect(actions.opened, ['a7']);
      expect(find.bySemanticsLabel('115 out of 250 marks'), findsWidgets);
    });

    testWidgets('a result opened before goes to the full result, never the seal', (tester) async {
      final router = await pump(tester, '/result/a7/sealed', ritual: const RecapRitual(alreadyOpened: true));
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
      expect(_at(router), '/result/a7');
    });

    testWidgets('"Open results directly" goes to the full result', (tester) async {
      final router = await pump(tester, '/result/a7/sealed', ritual: const RecapRitual(openDirectly: true));
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
      expect(_at(router), '/result/a7');
      expect(actions.seen, contains('a7'));
    });

    testWidgets('the first-ever sheet nudges the flap once, then rests', (tester) async {
      await pump(tester, '/result/a7/sealed', ritual: const RecapRitual());
      await _run(tester, 1300);
      await _run(tester, 500);
      expect(actions.opened, isEmpty);
      expect(find.text('Open your result'), findsOneWidget);
    });
  });

  group('the cards', () {
    testWidgets('swipe up moves on, skip goes to the full result', (tester) async {
      final router = await pump(tester, '/result/a7/recap/2');
      await _run(tester, 1000);
      expect(find.text('Where the other 135 marks went'), findsOneWidget);
      expect(find.bySemanticsLabel('Card 2 of 4'), findsOneWidget);
      await tester.fling(find.text('Where the other 135 marks went'), const Offset(0, -300), 1200);
      await tester.pumpAndSettle();
      expect(find.text('Start with Admission of a partner'), findsOneWidget);
      await tester.tap(find.text('Skip to full result'));
      await tester.pumpAndSettle();
      expect(_at(router), '/result/a7');
      expect(actions.events.map((e) => e.$1), contains('recap_skipped'));
    });

    testWidgets('card 2 shows the arithmetic on request, every number from the counts', (tester) async {
      await pump(tester, '/result/a7/recap/2');
      await _run(tester, 1000);
      expect(find.text('115 marks'), findsOneWidget);
      expect(find.text('75 marks'), findsOneWidget);
      expect(find.text('5 for each of 9'), findsOneWidget);
      await tester.tap(find.text('Show the arithmetic'));
      await tester.pump();
      expect(find.text('26 × 5 − 15 = 115'), findsOneWidget);
    });

    testWidgets('held marks skip card 2 and show no figure', (tester) async {
      final d = detail(
        reviews: {
          'q3': {'state': 'under_review'},
        },
      );
      await pump(
        tester,
        '/result/a7/recap/1',
        model: mock7(withDetail: d),
        d: d,
      );
      await _run(tester, 2000);
      expect(find.text('Marks held'), findsOneWidget);
      expect(find.bySemanticsLabel('115 out of 250 marks'), findsNothing);
      await tester.tap(find.text('The first thing to fix'));
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Card 2 of 3'), findsOneWidget);
      expect(find.textContaining('Start with'), findsOneWidget);
    });

    testWidgets('card 4 sizes the repair with the chips and starts it', (tester) async {
      final router = await pump(tester, '/result/a7/recap/4');
      await _run(tester, 1000);
      expect(find.text('Mock 7 is in your record.'), findsOneWidget);
      expect(find.text('Saved on the server at 10:44 PM.'), findsOneWidget);
      expect(find.text('Fresh check: not available yet.'), findsNothing);
      expect(find.text('Third full paper this month.'), findsOneWidget);
      await tester.tap(find.text('5 min'));
      await tester.pump();
      expect(find.text('Start 5-minute repair'), findsOneWidget);
      await tester.tap(find.text('Start 5-minute repair'));
      await tester.pumpAndSettle();
      expect(_at(router), startsWith('/review/repair/a7/'));
      expect(_at(router), contains('count=2'));
    });

    testWidgets('Finish for now ends with one line, then Today', (tester) async {
      final router = await pump(tester, '/result/a7/recap/4');
      await _run(tester, 1000);
      await tester.tap(find.text('Finish for now'));
      await _run(tester, 100);
      expect(find.text('Mock 7 is in your record. Your 15 mistakes are waiting in Review.'), findsOneWidget);
      await _run(tester, 3000);
      await tester.pumpAndSettle();
      expect(_at(router), '/today');
      expect(actions.progress, contains(4));
    });

    testWidgets('system back from a card lands on the full result', (tester) async {
      final router = await pump(tester, '/result/a7/recap/3');
      await _run(tester, 1000);
      final popped = await tester.binding.handlePopRoute();
      expect(popped, isTrue);
      await tester.pumpAndSettle();
      expect(_at(router), '/result/a7');
    });

    testWidgets('a question tile opens that answer in the full result', (tester) async {
      final router = await pump(tester, '/result/a7/recap/3');
      await _run(tester, 1000);
      await tester.tap(find.bySemanticsLabel(RegExp('Question 23, wrong')));
      await tester.pumpAndSettle();
      expect(_at(router), '/result/a7?q=23');
    });
  });
}
