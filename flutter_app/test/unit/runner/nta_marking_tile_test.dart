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

/// The marking tile on the NTA instructions page: the same shape as the questions and minutes
/// tiles (a figure over its unit), and whole at every text size (bug hunt runner-nta-07).
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
    testWidgets('the marking tile has the shape of its neighbours and holds at ${scale}x text on a 360 dp phone', (tester) async {
      await pump(tester, scale);
      expect(tester.takeException(), isNull, reason: 'no overflow');
      final tile = find.byType(NtaMarkingTile);
      final tileRect = tester.getRect(tile);
      // A figure over its unit, like "50 questions" and "60 minutes" beside it.
      expect(find.descendant(of: tile, matching: find.text(NtaStartCopy.markingFigure)), findsOneWidget);
      final unit = find.descendant(of: tile, matching: find.text(NtaStartCopy.marking));
      expect(unit, findsOneWidget);
      for (final finder in [find.descendant(of: tile, matching: find.text(NtaStartCopy.markingFigure)), unit]) {
        final line = tester.renderObject<RenderParagraph>(find.descendant(of: finder, matching: find.byType(RichText)).first);
        expect(line.didExceedMaxLines, isFalse);
        final rect = MatrixUtils.transformRect(line.getTransformTo(null), Offset.zero & line.size);
        expect(rect.right, lessThanOrEqualTo(tileRect.right + 0.5), reason: 'inside the tile');
      }
      // Side by side the three tiles are one height (a row); from 1.3x text they stack, each as wide
      // as the page, so no figure is shrunk to a third of it.
      final tiles = [for (final t in find.byType(NtaFactTile).evaluate()) tester.getRect(find.byWidget(t.widget))];
      expect(tiles, hasLength(3));
      if (scale >= 1.3) {
        expect({for (final r in tiles) r.width.round()}.length, 1, reason: 'stacked tiles are the same width');
        expect(tiles.first.width, greaterThan(300));
      } else {
        expect({for (final r in tiles) r.height.round()}.length, 1, reason: 'the three tiles read as one row');
      }
      await tester.pump(const Duration(seconds: 2));
    });
  }

  testWidgets('the marking tile still says the whole marking to a screen reader', (tester) async {
    await pump(tester, 1.0);
    final handle = tester.ensureSemantics();
    expect(find.bySemanticsLabel('Marking: plus 5 for right, minus 1 for wrong, 0 for blank'), findsOneWidget);
    handle.dispose();
    await tester.pump(const Duration(seconds: 2));
  });
}
