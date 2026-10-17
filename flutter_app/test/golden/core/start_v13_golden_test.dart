// The Start sheet, v13 (owner, 17 Oct, F4 to F7): the subject rail with large objects, the hero that
// follows the subject under it, pressable session rows with go marks. Night and Day, 390 wide.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'night_support.dart';

const _openerKey = ValueKey('golden-opener');

Widget _opener() {
  return GoldenRoom(
    child: Builder(
      builder: (context) => Align(
        alignment: const Alignment(0, -0.2),
        child: GestureDetector(
          key: _openerKey,
          behavior: HitTestBehavior.opaque,
          onTap: () => Navigator.of(context).push(
            MorphSheetRoute<void>(
              origin: Rect.fromCenter(center: const Offset(384 / 2, 853 - MmBar.lift - MmBar.height / 2), width: 60, height: 40),
              scrim: context.mmColors.sheetScrim,
              reduced: false,
              builder: (context) => const QuickStartSheet(),
            ),
          ),
          child: const SizedBox(width: 120, height: 48),
        ),
      ),
    ),
  );
}

const _subjects = ['accountancy', 'business_studies', 'economics', 'english', 'general_test', 'mathematics'];

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    for (final (name, pick, move) in [
      ('following', 'accountancy', const StartMove(title: 'Practise', location: '/practice/start?mode=quick&subject=accountancy&count=10', kind: 'practice')),
      ('following_picked', 'business_studies', const StartMove(title: 'Practise', location: '/practice/start?mode=quick&subject=accountancy&count=10', kind: 'practice')),
      ('fixed', 'accountancy', const StartMove(title: 'Repair 4 mistakes in Ledgers', location: '/review/repair/a/q?count=4', kind: 'repair')),
    ]) {
      testWidgets('start sheet v13 $name, $tag', (tester) async {
        await pumpMockmob(
          tester,
          _opener(),
          brightness: brightness,
          size: kNightSize,
          overrides: [
            resumeDraftProvider.overrideWith((ref) => null),
            resumeOfferProvider.overrideWith((ref) async => null),
            nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 10)),
            startSubjectsProvider.overrideWithValue(_subjects),
            startDefaultSubjectProvider.overrideWithValue(pick),
            startTonightMoveProvider.overrideWithValue(move),
            quickStartRepairProvider.overrideWithValue(const QuickRepair(location: '/review', chapter: 'Partnership fundamentals')),
            quickStartNtaProvider.overrideWithValue(const QuickNta(location: '/exam/nta', subject: 'accountancy', proOnly: true)),
          ],
        );
        await tester.tap(find.byKey(_openerKey));
        for (var i = 0; i < 10; i++) {
          await tester.pump(const Duration(milliseconds: 60));
        }
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/start_v13_${name}_$tag.png'));
      });
    }
  }
}
