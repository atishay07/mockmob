// The line under the rating keys (4 Nov walk, I3): the coach line fades out in place over 120 ms on the ease-out before the
// "Back in ..." stamp lands, so the two never sit on top of each other.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/run/run_controller.dart';
import 'package:mockmob/features/learn2/run/run_copy.dart';
import 'package:mockmob/features/learn2/run/run_parts.dart';

import '../../../helpers/fonts.dart';

Widget _app(RunStatusLine? line) => MaterialApp(theme: buildTheme(Brightness.light), home: Scaffold(body: Center(child: RunStatusView(line: line))));

double _opacityOfCoach(WidgetTester tester) {
  final o = find.ancestor(of: find.text(RunCopy.coachRate), matching: find.byType(Opacity));
  return o.evaluate().isEmpty ? 1 : tester.widget<Opacity>(o.first).opacity;
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a leaving coach line fades to nothing in 120 ms, in place, and a stamp can then land', (tester) async {
    await tester.pumpWidget(_app(const RunStatusLine(RunCopy.coachRate)));
    expect(_opacityOfCoach(tester), 1);
    await tester.pumpWidget(_app(const RunStatusLine(RunCopy.coachRate, leaving: true)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 40));
    final mid = _opacityOfCoach(tester);
    expect(mid, inExclusiveRange(0.0, 1.0));
    // Ease-out: well past linear at a third of the way.
    expect(mid, lessThan(1 - 40 / 120), reason: 'the ease-out leaves quickly at first');
    await tester.pump(const Duration(milliseconds: 90));
    expect(_opacityOfCoach(tester), 0, reason: 'gone after 120 ms');
    expect(RunController.coachFade, const Duration(milliseconds: 120));
    expect(find.text(RunCopy.coachRate), findsOneWidget, reason: 'never swapped for another widget mid-fade');
    await tester.pumpWidget(_app(const RunStatusLine('Back in 3 days', stamp: true, n: 1)));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Back in 3 days'), findsOneWidget);
    await tester.pumpAndSettle();
  });
}
