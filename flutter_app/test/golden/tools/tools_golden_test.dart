// Goldens for the CUET tools at 384 by 853 logical px, DPR 2, Night and Daylight. Long screens
// also get a tall frame so everything below the fold is looked at.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/programme_screen.dart';
import 'package:mockmob/features/tools/guide/guide_2027_screen.dart';
import 'package:mockmob/features/tools/hub/tools_hub_screen.dart';

import '../../unit/tools/tools_test_support.dart';
import '../you/you_golden_kit.dart';

const Size _tall = Size(384, 2400);

void main() {
  setUpGoldenFonts();

  // Hub.
  sheetGolden('hub', () => const ToolsHubScreen(), overrides: () => toolsOverrides());
  sheetGolden('hub_no_subjects', () => const ToolsHubScreen(), overrides: () => toolsOverrides(sheet: const []));

  // Compass.
  sheetGolden('compass_sheet_subjects', () => const CompassScreen(), overrides: () => toolsOverrides());
  sheetGolden('compass_full', () => const CompassScreen(), size: _tall, overrides: () => toolsOverrides());
  sheetGolden(
    'compass_score_full',
    () => const CompassScreen(),
    size: _tall,
    overrides: () => toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics', category: 'OBC-NCL', score: '650')),
  );
  sheetGolden('compass_empty', () => const CompassScreen(), overrides: () => toolsOverrides(sheet: const []));
  sheetGolden(
    'compass_none_open',
    () => const CompassScreen(),
    size: _tall,
    overrides: () => toolsOverrides(prefs: savedCompass('english,business_studies,economics')),
  );
  sheetGolden('compass_loading', () => const CompassScreen(), settle: false, overrides: () => toolsOverrides(neverLoads: true));
  sheetGolden('compass_offline', () => const CompassScreen(), overrides: () => toolsOverrides(source: FakeSource(offline: true)));
  sheetGolden(
    'compass_picker',
    () => const CompassScreen(),
    overrides: () => toolsOverrides(),
    interact: (tester) async {
      await tester.tap(find.text('Edit subjects').first);
      await tester.pumpAndSettle();
    },
  );

  sheetGolden(
    'compass_category_sheet',
    () => const CompassScreen(),
    overrides: () => toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics', score: '650')),
    interact: (tester) async {
      await tester.tap(find.text('Category and score').first);
      await tester.pumpAndSettle();
    },
  );

  // Programme.
  sheetGolden(
    'programme_bcom_score',
    () => const ProgrammeScreen(groupId: 'b-com-hons'),
    size: _tall,
    overrides: () => toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics', score: '650')),
  );
  sheetGolden(
    'programme_bcom',
    () => const ProgrammeScreen(groupId: 'b-com-hons'),
    overrides: () => toolsOverrides(),
  );
  sheetGolden(
    'programme_not_eligible',
    () => const ProgrammeScreen(groupId: 'b-a-hons-economics'),
    overrides: () => toolsOverrides(prefs: savedCompass('english,business_studies,economics')),
  );
  sheetGolden(
    'programme_cutoffs_offline',
    () => const ProgrammeScreen(groupId: 'b-com-hons'),
    overrides: () => toolsOverrides(source: FakeSource(server: {'index.json': duIndexJson})),
  );

  // Combo.
  sheetGolden('combo_empty', () => const ComboScreen(), overrides: () => toolsOverrides());
  sheetGolden(
    'combo_full',
    () => const ComboScreen(),
    size: _tall,
    overrides: () => toolsOverrides(
      prefs: savedCombo(
        ['b-com-hons', 'b-a-hons-economics'],
        ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'],
      ),
    ),
  );

  // CUET 2027.
  sheetGolden('guide', () => const Guide2027Screen(), overrides: () => toolsOverrides(now: DateTime(2026, 10, 13)));
  sheetGolden('guide_full', () => const Guide2027Screen(), size: _tall, overrides: () => toolsOverrides(now: DateTime(2026, 10, 13)));
}
