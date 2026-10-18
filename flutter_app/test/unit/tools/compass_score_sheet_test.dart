// The estimate on Compass (L26): nothing asks for a score up front, "Type an estimate" opens a
// sheet with no keyboard, a typed range reads "600 to 650" everywhere (never "600.0"), a bad
// figure keeps the sheet open with its reason, and Check a score keeps nothing until asked.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/tools/colleges/colleges_copy.dart';
import 'package:mockmob/features/tools/compass/compass_controller.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_helpers.dart';
import 'package:mockmob/features/tools/estimate/estimate_copy.dart';
import 'package:mockmob/features/tools/estimate/estimate_providers.dart';
import 'package:mockmob/features/tools/estimate/estimate_sheet.dart';

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

  Finder field(String label) => find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == label);

  Future<void> openCompass(WidgetTester tester) async {
    await pumpMockmob(
      tester,
      const CompassScreen(),
      size: const Size(384, 3200),
      wrapInScaffold: false,
      overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('Compass with no estimate shows no field, and "Type an estimate" opens the sheet without the keyboard', (tester) async {
    await openCompass(tester);
    expect(find.byType(TextField), findsOneWidget, reason: 'only the programme search');
    expect(find.text(ToolsCopy.whereYouStand), findsOneWidget);
    expect(find.text(CollegesCopy.noEstimate), findsOneWidget);
    expect(find.textContaining('CSAS'), findsNothing);
    expect(find.textContaining('CUET score'), findsNothing);
    await tester.tap(find.text(CollegesCopy.typeEstimate).first);
    await tester.pumpAndSettle();
    expect(find.byType(EstimateSheet), findsOneWidget);
    expect(field(CollegesCopy.from), findsOneWidget);
    expect(tester.testTextInput.isVisible, isFalse, reason: 'the fields focus only on a tap');
  });

  testWidgets('a typed 600 to 650 reads "600 to 650" on Compass, and Done closes the sheet', (tester) async {
    await openCompass(tester);
    await tester.tap(find.text(CollegesCopy.typeEstimate).first);
    await tester.pumpAndSettle();
    await tester.enterText(field(CollegesCopy.from), '600');
    await tester.enterText(field(CollegesCopy.to), '650');
    await tester.pump();
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await tester.pumpAndSettle();
    expect(find.byType(EstimateSheet), findsNothing);
    expect(find.textContaining('600 to 650'), findsWidgets);
    expect(find.textContaining('600.0'), findsNothing);
    final c = ProviderScope.containerOf(tester.element(find.byType(CompassScreen)));
    expect(c.read(estimateProvider)?.high, 650);
    expect(c.read(compassControllerProvider).value?.scoreAt, isNotNull);
  });

  testWidgets('a figure that is not 0 to 1000 keeps the sheet open, with the reason', (tester) async {
    await openCompass(tester);
    await tester.tap(find.text(CollegesCopy.typeEstimate).first);
    await tester.pumpAndSettle();
    await tester.enterText(field(CollegesCopy.from), '5..');
    await tester.pump();
    expect(find.text(EstimateCopy.fieldNotANumber), findsOneWidget);
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.done));
    await tester.pumpAndSettle();
    expect(find.byType(EstimateSheet), findsOneWidget);
  });

  testWidgets('Check a score keeps nothing until "Use as my estimate"', (tester) async {
    await pumpMockmob(
      tester,
      Builder(builder: (context) => Center(child: TextButton(onPressed: () => showCheckScoreSheet(context), child: const Text('open')))),
      size: const Size(384, 1600),
      overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')),
    );
    await tester.pumpAndSettle();
    final c = ProviderScope.containerOf(tester.element(find.text('open')));
    await c.read(compassControllerProvider.future);
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text(CollegesCopy.checkHeading), findsOneWidget);
    await tester.enterText(field(CollegesCopy.from), '700');
    await tester.pumpAndSettle();
    expect(c.read(estimateProvider), isNull, reason: 'a checked score is not the estimate');
    await tester.tap(find.widgetWithText(KeyButton, CollegesCopy.useAsEstimate));
    await tester.pumpAndSettle();
    expect(c.read(estimateProvider)?.low, 700);
    expect(find.text(CollegesCopy.savedEstimate), findsOneWidget);
  });
}
