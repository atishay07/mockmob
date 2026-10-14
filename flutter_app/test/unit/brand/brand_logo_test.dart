import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_logo.dart';
import 'package:mockmob/core/widgets/brand/logo_geometry.g.dart';
import 'package:mockmob/core/widgets/brand/mark.dart';
import 'package:mockmob/core/widgets/brand/wordmark.dart';

Future<void> _pump(WidgetTester tester, Widget child, {double dpr = 2, Brightness brightness = Brightness.dark}) async {
  tester.view.devicePixelRatio = dpr;
  tester.view.physicalSize = const Size(400, 800) * dpr;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(theme: buildTheme(brightness), home: Scaffold(body: Center(child: child))));
}

BrandLogoPainter _painterOf(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((c) => c.painter).whereType<BrandLogoPainter>().single;

LogoDetail _detailOf(WidgetTester tester) {
  final painter = _painterOf(tester);
  final paint = find.byWidgetPredicate((w) => w is CustomPaint && w.painter is BrandLogoPainter);
  return BrandLogoPainter.detailFor(painter.form, tester.getSize(paint), painter.devicePixelRatio, pose: painter.pose);
}

void main() {
  group('detail master by painted size', () {
    testWidgets('a 22 dp wordmark on a 3x phone uses the small master', (tester) async {
      await _pump(tester, const Wordmark(height: 22), dpr: 3);
      // Mobi is 0.558 em: 12.3 dp, 37 physical px.
      expect(_detailOf(tester), LogoDetail.small);
    });

    testWidgets('a large wordmark uses the full master (ring eye, flap cut)', (tester) async {
      await _pump(tester, const Wordmark(height: 80), dpr: 3);
      // 0.558 x 80 x 3 = 134 px, above the 96 px threshold.
      expect(_detailOf(tester), LogoDetail.full);
    });

    testWidgets('a tiny wordmark uses the micro master', (tester) async {
      await _pump(tester, const Wordmark(height: 8), dpr: 1);
      expect(_detailOf(tester), LogoDetail.micro);
    });

    testWidgets('the 40 dp icon tile uses the small master', (tester) async {
      await _pump(tester, const MmMark(size: 40), dpr: 2.625);
      expect(_detailOf(tester), LogoDetail.small);
    });

    testWidgets('a forced master wins over size', (tester) async {
      await _pump(tester, const BrandLogo.wordmark(em: 8, detail: LogoDetail.full), dpr: 1);
      expect(_detailOf(tester), LogoDetail.full);
    });

    test('thresholds follow the geometry file', () {
      expect(LogoGeometry.detailForMobiPx(96), LogoDetail.full);
      expect(LogoGeometry.detailForMobiPx(95.9), LogoDetail.small);
      expect(LogoGeometry.detailForMobiPx(11), LogoDetail.small);
      expect(LogoGeometry.detailForMobiPx(10.9), LogoDetail.micro);
    });
  });

  group('size and colour', () {
    testWidgets('the wordmark box is the word ink at the em', (tester) async {
      await _pump(tester, const Wordmark(height: 40));
      final size = tester.getSize(find.byType(Wordmark));
      expect(size.width, closeTo(LogoGeometry.wordBounds.width * 0.04, 0.01));
      expect(size.height, closeTo(LogoGeometry.wordBounds.height * 0.04, 0.01));
    });

    testWidgets('letters take the theme ink; on the tile they are warm white', (tester) async {
      await _pump(tester, const Wordmark(height: 30), brightness: Brightness.light);
      expect(_painterOf(tester).letterColor, MmColors.light.ink);
      await _pump(tester, const MmMark(size: 48), brightness: Brightness.light);
      expect(_painterOf(tester).letterColor, LogoGeometry.warmWhite);
      expect(_painterOf(tester).tile, isTrue);
    });

    testWidgets('every form paints without errors at every master', (tester) async {
      for (final detail in LogoDetail.values) {
        for (final w in [
          BrandLogo.wordmark(em: 60, detail: detail),
          BrandLogo.mo(em: 60, detail: detail),
          BrandLogo.icon(size: 120, detail: detail),
          BrandLogo.wordmark(em: 60, detail: detail, pose: const LogoPose(mobi: MobiFacePose(ink: 0.5, blink: 0.5, look: Offset(-1, 0)))),
        ]) {
          await _pump(tester, w);
          expect(tester.takeException(), isNull);
        }
      }
    });
  });

  group('semantics', () {
    testWidgets('the wordmark reads as MockMob, once', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const Wordmark(height: 30));
      expect(find.bySemanticsLabel('MockMob'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the mark is silent unless it is given a label', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const MmMark(size: 40));
      expect(find.bySemanticsLabel('MockMob'), findsNothing);
      await _pump(tester, const MmMark(size: 40, semanticLabel: 'MockMob'));
      expect(find.bySemanticsLabel('MockMob'), findsOneWidget);
      handle.dispose();
    });
  });
}
