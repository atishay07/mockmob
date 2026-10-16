// Compass, one first move: a single primary under the hero that always opens a course, never
// asks for a score (L26), the best options drawn as a cutoff bar with the score
// pinned, and the stream and unlock chips on the shared ChipRail (nothing cut through a letter).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show ChipRail, KeyButton;
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/cutoff_bar.dart';
import 'package:mockmob/features/tools/copy.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

void main() {
  setUpAll(loadAppFonts);

  group('cutoff bar', () {
    test('the pin sits where the score falls along the range, held at the ends outside it', () {
      expect(CutoffBar.fraction(600, 800, 700), closeTo(0.5, 1e-9));
      expect(CutoffBar.fraction(600, 800, 500), 0);
      expect(CutoffBar.fraction(600, 800, 900), 1);
      expect(CutoffBar.fraction(600, 600, 650), 1);
      expect(CutoffBar.fraction(600, 600, 550), 0);
    });
  });

  Future<void> compass(WidgetTester tester, {String score = ''}) async {
    await pumpMockmob(
      tester,
      const CompassScreen(),
      size: const Size(384, 3000),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics', score: score)),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('without a score the one primary still opens a course, and the best options carry bars without a pin', (tester) async {
    await compass(tester);
    final primary = find.byKey(const ValueKey('compass-first-move'));
    expect(primary, findsOneWidget);
    expect(find.descendant(of: primary, matching: find.textContaining('Open ')), findsOneWidget);
    expect(find.descendant(of: primary, matching: find.text(ToolsCopy.addScore)), findsNothing);
    expect(find.textContaining('CUET score'), findsNothing);
    expect(find.textContaining('CSAS'), findsNothing);
    expect(find.byType(CutoffBar), findsNWidgets(3));
    expect(find.byKey(const ValueKey('cutoff-pin')), findsNothing);
    // Under the hero, above the best options.
    expect(tester.getTopLeft(primary).dy, lessThan(tester.getTopLeft(find.text(ToolsCopy.bestHeading)).dy));
    // The figures stay, as the bar's two ends.
    expect(find.text('645.3'), findsWidgets);
    expect(find.text('924.3'), findsWidgets);
  });

  testWidgets('with a score the primary opens the best programme and every bar pins the score', (tester) async {
    await compass(tester, score: '650');
    final primary = find.byKey(const ValueKey('compass-first-move'));
    expect(primary, findsOneWidget);
    expect(find.descendant(of: primary, matching: find.textContaining('Open ')), findsOneWidget);
    expect(find.descendant(of: primary, matching: find.text(ToolsCopy.addScore)), findsNothing);
    expect(find.byKey(const ValueKey('cutoff-pin')), findsNWidgets(3));
  });

  testWidgets('the stream chips and the unlock chips are on the shared rail', (tester) async {
    await compass(tester);
    expect(find.byType(ChipRail), findsWidgets);
    expect(find.descendant(of: find.byType(ChipRail), matching: find.byType(KeyButton)), findsNothing);
    expect(tester.getSize(find.byType(ChipRail).first).height, 48);
  });
}
