// Compass's Category and score sheet: a typed whole score reads "720", never "720.0", and the
// sheet closes from a Done key or the keyboard's action key (with a bad score it stays open).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_helpers.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

void main() {
  setUpAll(loadAppFonts);

  test('a whole score has no decimal; a fractional one keeps one', () {
    expect(duFormatScore(720), '720');
    expect(duFormatScore(720.0), '720');
    expect(duFormatScore(1000), '1,000');
    expect(duFormatScore(0), '0');
    expect(duFormatScore(719.96), '720');
    expect(duFormatScore(732.2243), '732.2');
    expect(duFormatScore(null), '–');
  });

  final scoreField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == ToolsCopy.scoreHint);

  Future<void> openSheet(WidgetTester tester) async {
    await pumpMockmob(
      tester,
      const CompassScreen(),
      size: const Size(384, 2400),
      wrapInScaffold: false,
      overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text(ToolsCopy.categoryHeading));
    await tester.pumpAndSettle();
    expect(scoreField, findsOneWidget);
  }

  testWidgets('a typed 720 reads "Score 720" on Compass, and the Done key closes the sheet', (tester) async {
    await openSheet(tester);
    await tester.enterText(scoreField, '720');
    await tester.pump();
    final done = find.widgetWithText(KeyButton, ToolsCopy.done);
    expect(done, findsOneWidget);
    await tester.tap(done);
    await tester.pumpAndSettle();
    expect(scoreField, findsNothing, reason: 'Done closes the sheet');
    expect(find.textContaining('Score 720'), findsWidgets);
    expect(find.textContaining('720.0'), findsNothing);
  });

  testWidgets('the keyboard action key closes the sheet', (tester) async {
    await openSheet(tester);
    await tester.enterText(scoreField, '650');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(scoreField, findsNothing);
  });

  testWidgets('a score that is not a number from 0 to 1000 keeps the sheet open, with the error', (tester) async {
    await openSheet(tester);
    await tester.enterText(scoreField, '5..');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(scoreField, findsOneWidget);
    expect(find.text(ToolsCopy.scoreInvalid), findsOneWidget);
    expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, ToolsCopy.done)).onPressed, isNull);
  });
}
