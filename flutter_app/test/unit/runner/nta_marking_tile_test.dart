import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_quote.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_parts.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_screen.dart';
import 'package:mockmob/features/runner/nta/nta_integrity.dart';
import 'package:mockmob/features/runner/nta/nta_runner_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;

/// The marking tile on the NTA instructions page (bug hunt runner-nta-07): with large system
/// text each line keeps its words ("+5 right", not just "+5").
void main() {
  setUpAll(loadAppFonts);

  final quote = PracticeQuote.fromJson({'state': 'available', 'launchable': true, 'reasonCode': 'included', 'count': 50, 'durationSec': 3600});

  Future<void> pump(WidgetTester tester, double textScale) async {
    tester.view.physicalSize = const Size(360, 800) * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ntaCandidateNameProvider.overrideWithValue('Asha Verma'),
          ntaPrefsProvider.overrideWithValue(MemoryPrefsStore()),
          practiceQuoteProvider.overrideWith((ref, query) async => quote),
        ],
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
              child: child!,
            ),
            home: const NtaInstructionsScreen(subject: 'accountancy'),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }

  for (final scale in [1.0, 1.3, 1.6, 2.0]) {
    testWidgets('every marking line keeps its words at ${scale}x text on a 360 dp phone', (tester) async {
      await pump(tester, scale);
      expect(tester.takeException(), isNull, reason: 'no overflow');
      final tile = find.byType(NtaMarkingTile);
      final tileRect = tester.getRect(tile);
      final lines = tester.renderObjectList<RenderParagraph>(find.descendant(of: tile, matching: find.byType(RichText))).toList();
      expect(lines, hasLength(NtaStartCopy.markingLines.length));
      for (final (i, line) in lines.indexed) {
        final (figure, word) = NtaStartCopy.markingLines[i];
        expect(line.text.toPlainText(), '$figure $word');
        expect(line.didExceedMaxLines, isFalse, reason: '"$figure $word" lost its word');
        final rect = MatrixUtils.transformRect(line.getTransformTo(null), Offset.zero & line.size);
        expect(rect.right, lessThanOrEqualTo(tileRect.right + 0.5), reason: 'the line stays inside the tile');
      }
      await tester.pump(const Duration(seconds: 2));
    });
  }
}
