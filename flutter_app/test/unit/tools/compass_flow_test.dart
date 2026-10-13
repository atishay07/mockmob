import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

void main() {
  setUpAll(loadAppFonts);

  testWidgets('adding a suggested subject opens programmes and is saved on the phone', (tester) async {
    final prefs = savedCompass('english,business_studies,economics');
    await pumpMockmob(tester, const CompassScreen(), size: const Size(384, 2400), wrapInScaffold: false, overrides: toolsOverrides(prefs: prefs));
    await tester.pump();
    expect(find.text('No programme is open to these subjects yet.'), findsOneWidget);

    await tester.tap(find.textContaining('Mathematics').first);
    await tester.pumpAndSettle();
    expect(find.text('41 open to you'), findsOneWidget);
    expect(prefs.values['mm.tools.compass.v1'] as String, contains('mathematics'));
  });

  testWidgets('the sheet subjects seed Compass when nothing is saved', (tester) async {
    await pumpMockmob(tester, const CompassScreen(), size: const Size(384, 1600), wrapInScaffold: false, overrides: toolsOverrides());
    await tester.pump();
    expect(find.text('Ticked from your sheet.'), findsOneWidget);
    expect(find.text('35 open to you'), findsOneWidget);
  });

  testWidgets('Combo shows the website best fit for B.Com. (Hons.) and Economics', (tester) async {
    await pumpMockmob(
      tester,
      const ComboScreen(),
      size: const Size(384, 2400),
      wrapInScaffold: false,
      overrides: toolsOverrides(
        prefs: savedCombo(
          ['b-com-hons', 'b-a-hons-economics'],
          ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Best fit'), findsOneWidget);
    expect(find.text('5 papers'), findsOneWidget);
    expect(find.text('Option 2'), findsOneWidget);
  });
}
