// Round 2 of the Start sheet (device walk-through, 14 Oct): the selected subject chip is scrolled
// into view when the sheet opens, and the hero's repair glyph is no longer a red cross in a ring.
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';

const _subjects = ['accountancy', 'business_studies', 'economics', 'english', 'general_test'];

Future<void> _openSheet(WidgetTester tester, {required String defaultSubject}) async {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        resumeDraftProvider.overrideWith((ref) => null),
        resumeOfferProvider.overrideWith((ref) async => null),
        startSubjectsProvider.overrideWith((ref) => _subjects),
        startDefaultSubjectProvider.overrideWith((ref) => defaultSubject),
      ],
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Scaffold(
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
    ),
  );
  await tester.tap(find.text('Start'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 800));
}

void main() {
  testWidgets('a subject chip changes what Quick 10 and Full mock start', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final started = <Uri>[];
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
          path: '/practice/setup/:mode',
          builder: (_, state) {
            started.add(state.uri);
            return const Scaffold(body: Text('setup'));
          },
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
          startSubjectsProvider.overrideWith((ref) => _subjects),
          startDefaultSubjectProvider.overrideWith((ref) => 'accountancy'),
        ],
        child: MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router),
      ),
    );
    await tester.tap(find.text('Start'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
    // Tonight's subject is the one the sheet opens on, and the Quick 10 hero starts in it (v13: the
    // hero sits under the rail and names the subject).
    expect(find.textContaining('10 Accountancy questions'), findsOneWidget);
    await tester.ensureVisible(find.text('Economics'));
    await tester.pump();
    await tester.tap(find.text('Economics'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.textContaining('10 Economics questions'), findsOneWidget, reason: 'the hero says what will start, in the chosen subject');
    await tester.tap(find.text('10 Economics questions'));
    await tester.pumpAndSettle();
    expect(started.single.path, '/practice/setup/quick');
    expect(started.single.queryParameters, {'count': '10', 'subject': 'economics'});
  });

  testWidgets('the selected chip is fully in view when the sheet opens, even the last one', (tester) async {
    await _openSheet(tester, defaultSubject: 'general_test');
    final chip = find.text('General Test');
    expect(chip, findsOneWidget);
    final rect = tester.getRect(chip);
    expect(rect.left, greaterThanOrEqualTo(0));
    expect(rect.right, lessThanOrEqualTo(360 - 16 + 0.5), reason: 'inside the sheet gutter, not cut at the edge');
  });

  testWidgets('a pick made while the chip is off to the side brings it into view', (tester) async {
    await _openSheet(tester, defaultSubject: 'accountancy');
    expect(tester.getRect(find.text('Accountancy')).left, greaterThanOrEqualTo(0));
    ProviderScope.containerOf(tester.element(find.byType(QuickStartSheet))).read(startSubjectProvider.notifier).select('general_test');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 400));
    final rect = tester.getRect(find.text('General Test'));
    expect(rect.left, greaterThanOrEqualTo(0));
    expect(rect.right, lessThanOrEqualTo(360));
  });

  for (final brightness in [Brightness.dark, Brightness.light]) {
    testWidgets('the repair glyph draws no coral cross, ${brightness.name}', (tester) async {
      final colors = MmColors.forBrightness(brightness);
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(brightness),
          home: Center(
            child: RepaintBoundary(
              key: key,
              child: const ChoiceGlyph(kind: ChoiceGlyphKind.repair, size: 96, lit: true),
            ),
          ),
        ),
      );
      final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final bytes = await tester.runAsync(() async {
        final image = await boundary.toImage();
        final data = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
        image.dispose();
        return data!.buffer.asUint8List();
      });
      final wrong = colors.wrongMark;
      var coral = 0;
      var tick = 0;
      for (var i = 0; i < bytes!.length; i += 4) {
        if (bytes[i + 3] < 250) continue;
        final dr = (bytes[i] - (wrong.r * 255).round()).abs();
        final dg = (bytes[i + 1] - (wrong.g * 255).round()).abs();
        final db = (bytes[i + 2] - (wrong.b * 255).round()).abs();
        if (dr + dg + db < 40) coral++;
        final vr = (bytes[i] - (colors.voltInk.r * 255).round()).abs();
        final vg = (bytes[i + 1] - (colors.voltInk.g * 255).round()).abs();
        final vb = (bytes[i + 2] - (colors.voltInk.b * 255).round()).abs();
        if (vr + vg + vb < 30) tick++;
      }
      expect(coral, 0, reason: 'a coral disc with a cross read as a close button');
      expect(tick, greaterThan(20), reason: 'the tick is drawn in the volt ink');
    });
  }
}
