// The Papers door's reveals (4 Nov walk, I1): the marks chart and the rows' count-ups play when the door is on stage,
// never behind a door that was still fading out, and a reveal that was missed shows its final values, never 0.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/router/router.dart' show papersLocationFor, practiceDoorFor;
import 'package:mockmob/features/practice/practice_routes.dart';

import 'package:mockmob/features/today/widgets/paper_trend.dart' show TrendPainter;
import 'package:mockmob/features/today/widgets/sheet_section.dart' show CountedMarks;
import '../../golden/review/review_golden_support.dart' show reviewOverrides;
import '../../helpers/fonts.dart';
import '../review/support/review_fixtures.dart';
import 'support/harness.dart';

const _phone = Size(360, 780);

List<Attempt> _mocks() => [
  for (var i = 1; i <= 7; i++)
    Attempt.fromJson(
      mockJson(id: 'm$i', completedAt: DateTime.utc(2026, 9, 10 + i * 2, 15, 45), wrong: {for (var q = 0; q < 12 - i; q++) q}),
    ),
];

List<GoRoute> _routes() => [
  GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
  GoRoute(path: '/review', redirect: (c, s) => papersLocationFor(s.uri)),
  GoRoute(path: '/practice/papers', redirect: (c, s) => practiceDoorFor(s.uri), builder: (c, s) => const SizedBox()),
  stubRoute('/practice/setup/:mode'),
  stubRoute('/practice/start'),
  stubRoute('/run/:sessionId'),
];

List<Override> _overrides(List<Attempt> attempts) {
  final practice = practiceOverrides(attempts: attempts);
  final taken = {for (final o in practice) o.origin};
  return [...practice, for (final o in reviewOverrides(attempts: attempts)) if (!taken.contains(o.origin)) o];
}

/// Every count-up on the page has counted, and the marks chart has drawn to its last dot.
void _expectRevealed(WidgetTester tester) {
  // Rows below the fold wait for the student to scroll to them; the ones in view have counted.
  final inView = [
    for (final e in find.byType(CountedMarks).evaluate())
      if (tester.getTopLeft(find.byWidget(e.widget)).dy < _phone.height - 80) e.widget as CountedMarks,
  ];
  expect(inView, isNotEmpty, reason: 'the first rows show marks');
  for (final c in inView) {
    expect(c.progress.value, 1, reason: 'a rows marks (${c.marks}) are counted, never left at 0');
  }
  final chart = tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((p) => p.painter).whereType<TrendPainter>().toList();
  expect(chart, hasLength(1), reason: 'the marks chart is there');
  expect(chart.single.draw.value, 1, reason: 'the chart has drawn in');
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('switching to Papers shows the real marks, not 0, without scrolling', (tester) async {
    final attempts = _mocks();
    await pumpRouted(tester, location: '/practice', routes: _routes(), overrides: _overrides(attempts), size: _phone, brightness: Brightness.dark);
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.byKey(const ValueKey('practice-door-papers')));
    await tester.pump();
    // Past the 90 ms out-half, the 210 ms in-half and every reveal's own length.
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(find.textContaining('Marks in your latest 6 of 7'), findsOneWidget);
    _expectRevealed(tester);
  });
}
