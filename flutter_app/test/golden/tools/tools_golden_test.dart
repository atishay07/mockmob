// Goldens for the CUET tools at 384 by 853 logical px, DPR 2, Night and Daylight. Long screens
// also get a tall frame so everything below the fold is looked at.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/programme_screen.dart';
import 'package:mockmob/features/tools/guide/guide_2027_screen.dart';
import 'package:mockmob/features/tools/hub/tools_hub_screen.dart';
import 'package:mockmob/features/tools/pro/compass_pro_repository.dart';

import '../../unit/tools/tools_test_support.dart';
import '../you/you_golden_kit.dart';

const Size _tall = Size(384, 2400);

/// A Pro account's Compass: a projection with a full four-paper total and two shortlist targets.
final Map<String, Object?> _proComplete = {
  ...compassProReady,
  'projection': {
    ...(compassProReady['projection']! as Map).cast<String, Object?>(),
    'total': {'papers': ['english', 'accountancy', 'economics', 'business_studies'], 'count': 4, 'complete': true, 'max': 1000, 'mid': 640, 'low': 560, 'high': 720},
  },
};

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
  sheetGolden(
    'compass_pro',
    () => const CompassScreen(),
    size: const Size(384, 3600),
    overrides: () => [
      ...toolsOverrides(
        prefs: savedCompass('english,business_studies,economics')
          ..values['mm.tools.compass.shortlist.v1.u1'] =
              '[{"g":"b-com-hons","c":"Aryabhatta College"},{"g":"b-com-hons","c":"Acharya Narendra Dev College"}]',
        pro: true,
      ),
      compassProRepositoryProvider.overrideWith(() => FakeCompassPro(_proComplete)),
    ],
  );
  sheetGolden('compass_error', () => const CompassScreen(), overrides: () => toolsOverrides(source: FakeSource()));
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

  sheetGolden(
    'combo_checking',
    () => const ComboScreen(),
    size: _tall,
    overrides: () => toolsOverrides(
      prefs: savedCombo(
        ['b-com-hons', 'b-a-hons-economics'],
        ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'],
      ),
      comboRunner: (groups, pool, targets, maxPapers) => Completer<DuComboPlan>().future,
    ),
  );

  // CUET 2027.
  sheetGolden('guide', () => const Guide2027Screen(), overrides: () => toolsOverrides(now: DateTime(2026, 10, 13)));
  sheetGolden('guide_full', () => const Guide2027Screen(), size: _tall, overrides: () => toolsOverrides(now: DateTime(2026, 10, 13)));
}
