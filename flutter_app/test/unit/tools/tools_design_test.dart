// The tools design pass: no overflow at 360 dp and 1.3x text on the changed screens, a long
// programme group folds behind "Show more", a programme the subjects do not open folds its
// cutoffs, and the small actions are real 48 dp targets.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/cutoff_table.dart';
import 'package:mockmob/features/tools/compass/programme_rows.dart';
import 'package:mockmob/features/tools/compass/programme_screen.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/guide/guide_2027_screen.dart';
import 'package:mockmob/features/tools/hub/tools_hub_screen.dart';
import 'package:mockmob/features/tools/widgets/tools_parts.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

void main() {
  setUpAll(loadAppFonts);

  Future<void> pump(WidgetTester tester, Widget screen, {required List<dynamic> overrides, double scale = 1, Size size = const Size(360, 3000)}) async {
    await pumpMockmob(
      tester,
      screen,
      size: size,
      textScale: scale,
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: overrides.cast(),
    );
    await tester.pumpAndSettle();
  }

  group('360 dp at 1.3x text: nothing overflows', () {
    final sheet = 'english,accountancy,business_studies,economics';
    testWidgets('hub', (tester) async {
      await pump(tester, const ToolsHubScreen(), overrides: toolsOverrides(), scale: 1.3);
      expect(tester.takeException(), isNull);
    });
    testWidgets('compass', (tester) async {
      await pump(tester, const CompassScreen(), overrides: toolsOverrides(prefs: savedCompass(sheet)), scale: 1.3);
      expect(tester.takeException(), isNull);
    });
    testWidgets('programme with a score', (tester) async {
      await pump(
        tester,
        const ProgrammeScreen(groupId: 'b-com-hons'),
        overrides: toolsOverrides(prefs: savedCompass(sheet, score: '650')),
        scale: 1.3,
      );
      expect(tester.takeException(), isNull);
      expect(find.byType(SeatRow), findsWidgets);
    });
    testWidgets('a programme the subjects do not open', (tester) async {
      await pump(
        tester,
        const ProgrammeScreen(groupId: 'b-a-hons-economics'),
        overrides: toolsOverrides(prefs: savedCompass('english,business_studies,economics')),
        scale: 1.3,
      );
      expect(tester.takeException(), isNull);
    });
    testWidgets('combo', (tester) async {
      await pump(
        tester,
        const ComboScreen(),
        overrides: toolsOverrides(
          prefs: savedCombo(
            ['b-com-hons', 'b-a-hons-economics'],
            ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'],
          ),
        ),
        scale: 1.3,
      );
      expect(tester.takeException(), isNull);
    });
    testWidgets('guide', (tester) async {
      await pump(tester, const Guide2027Screen(), overrides: toolsOverrides(now: DateTime(2026, 10, 13)), scale: 1.3);
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets('a long stream group opens on six programmes and Show more brings the rest', (tester) async {
    await pump(tester, const CompassScreen(), overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')), size: const Size(384, 6000));
    final before = find.byType(ProgrammeRow).evaluate().length;
    final more = find.textContaining('Show ').first;
    expect(more, findsOneWidget);
    await tester.tap(more);
    await tester.pumpAndSettle();
    expect(find.byType(ProgrammeRow).evaluate().length, greaterThan(before));
    expect(find.text(ToolsCopy.showFewerRows), findsOneWidget);
  });

  testWidgets('a programme the subjects do not open folds its cutoffs until asked', (tester) async {
    await pump(
      tester,
      const ProgrammeScreen(groupId: 'b-a-hons-economics'),
      overrides: toolsOverrides(prefs: savedCompass('english,business_studies,economics')),
      size: const Size(384, 4000),
    );
    expect(find.byType(CutoffTable), findsNothing);
    expect(find.text(ToolsCopy.seeCutoffsAnyway), findsOneWidget);
    await tester.tap(find.text(ToolsCopy.seeCutoffsAnyway));
    await tester.pumpAndSettle();
    expect(find.byType(CutoffTable), findsOneWidget);
  });

  testWidgets('a programme the subjects open shows its cutoffs at once, with a 48 dp Change', (tester) async {
    await pump(
      tester,
      const ProgrammeScreen(groupId: 'b-com-hons'),
      overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics', score: '650')),
      size: const Size(384, 4000),
    );
    expect(find.byType(CutoffTable), findsOneWidget);
    final change = tester.getSize(find.ancestor(of: find.text(ToolsCopy.change), matching: find.byType(ToolsInlineAction)).first);
    expect(change.height, greaterThanOrEqualTo(48));
    expect(change.width, greaterThanOrEqualTo(48));
  });
}
