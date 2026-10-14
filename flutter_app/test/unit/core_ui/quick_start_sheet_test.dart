import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/materials/glass_surface.dart';

import '../core_data/support/fixtures.dart';

Future<GoRouter> _pump(WidgetTester tester, {double textScale = 1, bool crowded = false, QuickRepair? repair}) async {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final draft = draftOf(endsAtWallMs: DateTime(2026, 10, 13, 22, 40).millisecondsSinceEpoch, count: 50);
  final router = GoRouter(
    initialLocation: '/today',
    routes: [
      GoRoute(
        path: '/today',
        builder: (_, _) => Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const Material(child: QuickStartSheet()),
              ),
              child: const Text('Start'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/ask',
        builder: (_, _) => const Scaffold(body: Text('ask screen')),
      ),
      GoRoute(
        path: '/exam/nta',
        builder: (_, _) => const Scaffold(body: Text('nta screen')),
      ),
      GoRoute(
        path: '/review/repair/a/q',
        builder: (_, _) => const Scaffold(body: Text('repair screen')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        resumeDraftProvider.overrideWith((ref) => crowded ? draft : null),
        resumeOfferProvider.overrideWith((ref) async => crowded ? ResumeOffer(draft: draft, answered: 12) : null),
        if (crowded) quickStartNtaProvider.overrideWith((ref) => const QuickNta(location: '/exam/nta', subject: 'english', proOnly: true)),
        if (crowded)
          quickStartRepairProvider.overrideWith((ref) => const QuickRepair(location: '/review/repair/a/q', chapter: 'Cash flow'))
        else if (repair != null)
          quickStartRepairProvider.overrideWith((ref) => repair),
      ],
      child: MaterialApp.router(
        theme: buildTheme(Brightness.light),
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.tap(find.text('Start'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
  return router;
}

void main() {
  testWidgets('five rows at 1.3x text on a 360 x 640 phone: no overflow and the last row is reachable', (tester) async {
    await _pump(tester, textScale: 1.3, crowded: true);
    expect(tester.takeException(), isNull, reason: 'the sheet scrolls instead of overflowing');

    final last = find.text('Repair the next mistake');
    await tester.scrollUntilVisible(last, 120, scrollable: find.byType(Scrollable).last);
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(tester.getRect(last).bottom, lessThanOrEqualTo(640));
    // The header (title and grab handle) stays in place while the rows scroll.
    expect(find.text('Resume Accountancy mock'), findsOneWidget);
  });

  testWidgets('Ask your record opens over the tab, so Back returns to it', (tester) async {
    final router = await _pump(tester);
    await tester.tap(find.text('Ask your record'));
    await tester.pumpAndSettle();
    expect(find.text('ask screen'), findsOneWidget);
    expect(router.canPop(), isTrue, reason: 'there is a screen to go back to');
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('Start'), findsOneWidget);
  });

  testWidgets('NTA mode opens over the tab', (tester) async {
    final router = await _pump(tester, crowded: true);
    final nta = find.text('NTA mode, with Pro');
    await tester.scrollUntilVisible(nta, 80, scrollable: find.byType(Scrollable).last);
    await tester.tap(nta);
    await tester.pumpAndSettle();
    expect(find.text('nta screen'), findsOneWidget);
    expect(router.canPop(), isTrue);
  });

  group('Repair the next mistake (U3-1)', () {
    testWidgets('opens the ten-minute run, like the launcher shortcut', (tester) async {
      final router = await _pump(
        tester,
        repair: const QuickRepair(location: '/review/repair/a/q', chapter: 'Cash flow', tenMinuteLocation: '/review/repair/a/q?count=3'),
      );
      final row = find.text('Repair the next mistake');
      await tester.scrollUntilVisible(row, 80, scrollable: find.byType(Scrollable).last);
      await tester.tap(row);
      await tester.pumpAndSettle();
      expect(find.text('repair screen'), findsOneWidget);
      expect(router.routerDelegate.currentConfiguration.uri.queryParameters['count'], '3');
    });

    testWidgets('without a ten-minute count it opens the first mistake alone', (tester) async {
      final router = await _pump(tester, repair: const QuickRepair(location: '/review/repair/a/q', chapter: 'Cash flow'));
      final row = find.text('Repair the next mistake');
      await tester.scrollUntilVisible(row, 80, scrollable: find.byType(Scrollable).last);
      await tester.tap(row);
      await tester.pumpAndSettle();
      expect(find.text('repair screen'), findsOneWidget);
      expect(router.routerDelegate.currentConfiguration.uri.toString(), '/review/repair/a/q');
    });
  });

  test('only top-level screens are pushed', () {
    expect(QuickStartSheet.opensOutsideShell('/ask'), isTrue);
    expect(QuickStartSheet.opensOutsideShell('/exam/nta'), isTrue);
    expect(QuickStartSheet.opensOutsideShell('/run/abc'), isTrue);
    expect(QuickStartSheet.opensOutsideShell('/practice/setup/quick?count=10'), isFalse);
    expect(QuickStartSheet.opensOutsideShell('/review/repair/a/q'), isFalse);
  });

  group('row surface', () {
    test('is opaque in both themes, resting and pressed', () {
      for (final colors in [MmColors.dark, MmColors.light]) {
        for (final pressed in [false, true]) {
          expect(QuickStartRow.surfaceFor(colors, pressed: pressed).a, 1.0, reason: 'night: ${colors.isNight}, pressed: $pressed');
        }
      }
    });

    for (final brightness in [Brightness.light, Brightness.dark]) {
      for (final quality in [GlassQuality.full, GlassQuality.lite, GlassQuality.off]) {
        testWidgets('the page behind the sheet never shows inside a row, ${brightness.name}, ${quality.name}', (tester) async {
          tester.view.physicalSize = const Size(360, 400);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.reset);
          final key = GlobalKey();
          final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
          Widget app(bool withPage) => MaterialApp(
            theme: buildTheme(brightness),
            home: RepaintBoundary(
              key: key,
              child: GlassScope(
                quality: quality,
                child: Stack(
                  children: [
                    Positioned.fill(child: ColoredBox(color: colors.ground)),
                    // The worst page: solid ink under the whole sheet (as if glyphs filled it).
                    if (withPage) Positioned.fill(child: ColoredBox(color: colors.ink)),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: GlassSurface(
                        role: GlassRole.sheet,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Material(
                            type: MaterialType.transparency,
                            child: QuickStartRow(glyph: SheetGlyph.quick, title: 'Quick 10', note: '10 questions, about 10 minutes.', onTap: () {}),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );

          Future<ByteData> pixels(bool withPage) async {
            await tester.pumpWidget(app(withPage));
            await tester.pump();
            return (await tester.runAsync(() async {
              final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
              final image = await boundary.toImage();
              return (await image.toByteData())!;
            }))!;
          }

          final plain = await pixels(false);
          final over = await pixels(true);
          // The row's inner area (clear of its border, glyph tile and text): same pixels with or
          // without the page behind. Sample the strip between the text column and the right edge.
          await tester.pumpWidget(app(true));
          await tester.pump();
          final row = tester.getRect(find.byType(QuickStartRow));
          var worst = 0;
          for (var x = (row.right - 28).toInt(); x < (row.right - 10).toInt(); x += 2) {
            for (var y = (row.top + 12).toInt(); y < (row.bottom - 12).toInt(); y += 2) {
              final i = (y * 360 + x) * 4;
              for (var c = 0; c < 3; c++) {
                final d = (plain.getUint8(i + c) - over.getUint8(i + c)).abs();
                if (d > worst) worst = d;
              }
            }
          }
          expect(worst, 0, reason: 'the row is opaque, so the page behind it cannot show');
        });
      }
    }
  });
  group('title band', () {
    test('is opaque in both themes and at every glass level', () {
      for (final colors in [MmColors.dark, MmColors.light]) {
        for (final quality in GlassQuality.values) {
          expect(
            QuickStartSheet.titleBandFor(colors, quality).a,
            1.0,
            reason: 'night: ${colors.isNight}, quality: ${quality.name}',
          );
        }
      }
    });

    for (final brightness in [Brightness.light, Brightness.dark]) {
      for (final quality in [GlassQuality.full, GlassQuality.lite, GlassQuality.off]) {
        testWidgets('the page behind the sheet never shows under the title, ${brightness.name}, ${quality.name}', (tester) async {
          tester.view.physicalSize = const Size(360, 640);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.reset);
          final key = GlobalKey();
          final colors = brightness == Brightness.dark ? MmColors.dark : MmColors.light;
          Widget app(bool withPage) => ProviderScope(
            overrides: [
              resumeDraftProvider.overrideWith((ref) => null),
              resumeOfferProvider.overrideWith((ref) async => null),
            ],
            child: MaterialApp(
              theme: buildTheme(brightness),
              home: RepaintBoundary(
                key: key,
                child: GlassScope(
                  quality: quality,
                  child: Stack(
                    children: [
                      Positioned.fill(child: ColoredBox(color: colors.ground)),
                      // The worst page: solid ink under the whole sheet (as if its text filled it).
                      if (withPage) Positioned.fill(child: ColoredBox(color: colors.ink)),
                      Align(
                        alignment: Alignment.bottomCenter,
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: GlassSurface(
                            role: GlassRole.sheet,
                            borderRadius: const BorderRadius.all(Radius.circular(30)),
                            child: const Material(type: MaterialType.transparency, child: QuickStartSheet()),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );

          Future<ByteData> pixels(bool withPage) async {
            await tester.pumpWidget(app(withPage));
            await tester.pump(const Duration(milliseconds: 600));
            return (await tester.runAsync(() async {
              final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
              final image = await boundary.toImage();
              return (await image.toByteData())!;
            }))!;
          }

          final plain = await pixels(false);
          final over = await pixels(true);
          await tester.pumpWidget(app(true));
          await tester.pump(const Duration(milliseconds: 600));
          final band = tester.getRect(find.byKey(const ValueKey('quick-start-title-band')));
          // Two strips with no content in them: above the grab handle, and the gap under the title.
          // Both sit well inside the sheet's rounded corners.
          var worst = 0;
          var sampled = 0;
          for (final (top, bottom) in [(band.top + 2, band.top + 10), (band.bottom - 10, band.bottom - 2)]) {
            for (var x = (band.left + 40).toInt(); x < (band.right - 40).toInt(); x += 3) {
              for (var y = top.toInt(); y < bottom.toInt(); y += 2) {
                final i = (y * 360 + x) * 4;
                sampled++;
                for (var c = 0; c < 3; c++) {
                  final d = (plain.getUint8(i + c) - over.getUint8(i + c)).abs();
                  if (d > worst) worst = d;
                }
              }
            }
          }
          expect(sampled, greaterThan(100));
          expect(worst, 0, reason: 'the title band is opaque, so the page behind it cannot show');
        });
      }
    }
  });
}
