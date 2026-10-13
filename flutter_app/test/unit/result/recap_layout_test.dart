import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/features/result/copy.dart' show ResultCopy;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/recap/first_fix_card.dart';
import 'package:mockmob/features/result/sheet/folded_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

Future<void> _run(WidgetTester tester, int ms) async {
  await tester.pump();
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('the sealed sheet on a short phone (result-review-02)', () {
    for (final (size, scale) in [(const Size(360, 640), 1.0), (const Size(360, 720), 1.3), (const Size(360, 640), 1.3)]) {
      testWidgets('stays above the counts at ${size.width.toInt()}x${size.height.toInt()}, text x$scale', (tester) async {
        final m = mock7();
        final d = detail();
        await pumpResultRoute(
          tester,
          location: '/result/a7/sealed',
          size: size,
          textScale: scale,
          disableAnimations: true,
          overrides: resultOverrides(
            attemptId: m.attemptId,
            data: RecapData(model: m, attempt: d.attempt, detail: d),
            ritual: const RecapRitual(sheetsOpened: 1),
          ),
        );
        await _run(tester, 100);
        expect(tester.takeException(), isNull);
        final sheet = find.byType(FoldedSheet);
        expect(sheet, findsOneWidget);
        // The painted bottom and top of the sheet, with the scale it is drawn at.
        final bottom = tester.getBottomRight(sheet).dy;
        final top = tester.getTopLeft(sheet).dy;
        final controls = tester.getTopLeft(find.text(ResultCopy.openWithoutReveal)).dy;
        expect(top, greaterThanOrEqualTo(0));
        expect(bottom, lessThanOrEqualTo(controls), reason: 'the bubbles must not paint under the controls');
        expect(tester.getBottomRight(sheet).dx, lessThanOrEqualTo(size.width));
      });
    }
  });

  group('the sealed reveal waits for the attempt detail (result-review-01)', () {
    Future<void> pumpSealed(WidgetTester tester, RecapData data) async {
      final m = data.model!;
      await pumpResultRoute(
        tester,
        location: '/result/a7/sealed',
        disableAnimations: true,
        overrides: resultOverrides(attemptId: m.attemptId, data: data, ritual: const RecapRitual(sheetsOpened: 1)),
      );
      await _run(tester, 100);
    }

    testWidgets('a model built from the list alone shows the skeleton, not a sheet to open', (tester) async {
      final d = detail();
      await pumpSealed(tester, RecapData(model: mock7(), attempt: d.attempt, detailPending: true));
      expect(find.byType(FoldedSheet), findsNothing);
      expect(find.text('Open your result'), findsNothing);
    });

    testWidgets('once the detail has arrived the sheet is there', (tester) async {
      final d = detail(recap: {'tone': 'lower'});
      await pumpSealed(tester, RecapData(model: mock7(withDetail: d), attempt: d.attempt, detail: d));
      expect(find.byType(FoldedSheet), findsOneWidget);
      expect(find.text('Open your result'), findsOneWidget);
    });

    testWidgets('a failed detail read does not hold the sheet back', (tester) async {
      final d = detail();
      await pumpSealed(
        tester,
        RecapData(model: mock7(), attempt: d.attempt, error: const ApiError(kind: ApiErrorKind.network, code: 'network')),
      );
      expect(find.byType(FoldedSheet), findsOneWidget);
    });
  });

  group('question tiles on card 3 (result-review-09)', () {
    test('six to a row only while each tile is at least 48 dp wide', () {
      expect(firstFixTileColumns(352), 6);
      expect(firstFixTileColumns(320), 5);
      expect(firstFixTileColumns(280), 5);
      expect(firstFixTileColumns(240), 4);
      expect(firstFixTileColumns(30), 1);
      for (final w in [200.0, 240.0, 280.0, 320.0, 336.0, 352.0]) {
        final n = firstFixTileColumns(w);
        expect((w - (n - 1) * 8) / n, greaterThanOrEqualTo(48), reason: 'width $w');
      }
    });

    testWidgets('each tile is at least 48 dp wide on a 360 dp phone at 1.3x text', (tester) async {
      final m = mock7();
      await pumpMockmob(
        tester,
        FirstFixCard(model: m, onNext: () {}, onBack: () {}),
        brightness: Brightness.dark,
        size: const Size(360, 720),
        textScale: 1.3,
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: resultOverrides(attemptId: m.attemptId, data: RecapData(model: m)),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
      final tiles = find.bySemanticsLabel(RegExp(r'^Question \d+'));
      expect(tiles, findsWidgets);
      for (final e in tiles.evaluate()) {
        final box = e.renderObject! as RenderBox;
        expect(box.size.width, greaterThanOrEqualTo(48));
        expect(box.size.height, greaterThanOrEqualTo(48));
      }
    });
  });
}
