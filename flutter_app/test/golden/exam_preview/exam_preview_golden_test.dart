import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/exam_preview/exam_preview_controller.dart';
import 'package:mockmob/features/exam_preview/exam_preview_routes.dart';
import 'package:mockmob/features/exam_preview/exam_preview_screen.dart';
import 'package:mockmob/features/runner/nta/nta_integrity.dart' show ntaPrefsProvider;
import 'package:mockmob/features/runner/nta/nta_paper_theme.dart' show NtaStyle, NtaStyleNotifier, ntaStyleProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;
import '../../unit/runner/support/exam_font.dart';

/// The 390 by 844 phone frame the owner reviews at.
const Size _phone = Size(390, 844);

class _MockmobLook extends NtaStyleNotifier {
  @override
  NtaStyle build() => NtaStyle.mockmob;
}

String _suffix(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Future<ExamPreviewController> _pump(WidgetTester tester, Brightness b, {bool mockmobLook = false}) async {
  tester.view.physicalSize = _phone * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final c = ExamPreviewController(runClock: false);
  addTearDown(c.dispose);
  final router = GoRouter(
    initialLocation: '/start',
    routes: [
      GoRoute(path: '/start', builder: (_, _) => const Scaffold(body: SizedBox.shrink())),
      GoRoute(path: ExamPreviewRoutes.path, builder: (_, _) => ExamPreviewScreen(controller: c)),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ntaPrefsProvider.overrideWithValue(MemoryPrefsStore()),
        if (mockmobLook) ntaStyleProvider.overrideWith(_MockmobLook.new),
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp.router(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: b == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          routerConfig: router,
        ),
      ),
    ),
  );
  router.go(ExamPreviewRoutes.path);
  await tester.pump();
  await _settle(tester);
  return c;
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _shot(WidgetTester tester, String name, Brightness b) =>
    expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${_suffix(b)}.png'));

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadExamFont();
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    group(_suffix(b), () {
      testWidgets('exam look, first look', (tester) async {
        await _pump(tester, b);
        await _shot(tester, 'preview_first', b);
      });

      testWidgets('exam look, answered and marked, on the palette step', (tester) async {
        final c = await _pump(tester, b);
        c
          ..select(1)
          ..markAndNext()
          ..select(2)
          ..saveAndNext()
          ..saveAndNext();
        await _settle(tester);
        await _shot(tester, 'preview_mid', b);
      });

      testWidgets('exam look, palette drawer', (tester) async {
        final c = await _pump(tester, b);
        c
          ..select(1)
          ..markAndNext()
          ..select(2)
          ..saveAndNext()
          ..markAndNext()
          ..select(0);
        await _settle(tester);
        await tester.tap(find.byIcon(LucideIcons.layoutGrid));
        await _settle(tester);
        await _shot(tester, 'preview_palette', b);
      });

      testWidgets('exam look, another section with the last minute on the clock', (tester) async {
        final c = await _pump(tester, b);
        c
          ..select(1)
          ..switchSection(2)
          ..select(1)
          ..toggleLastMinute();
        await _settle(tester);
        await _shot(tester, 'preview_section_low', b);
      });

      testWidgets('MockMob look, mid walk', (tester) async {
        final c = await _pump(tester, b, mockmobLook: true);
        c
          ..select(1)
          ..markAndNext()
          ..select(0);
        await _settle(tester);
        await _shot(tester, 'preview_mockmob_mid', b);
      });

      testWidgets('MockMob look, all five tried, palette drawer', (tester) async {
        final c = await _pump(tester, b, mockmobLook: true);
        c
          ..select(1)
          ..markAndNext()
          ..switchSection(1)
          ..select(0)
          ..toggleLastMinute();
        await _settle(tester);
        await tester.tap(find.byIcon(LucideIcons.layoutGrid));
        await _settle(tester);
        await _shot(tester, 'preview_mockmob_palette', b);
      });

      testWidgets('end sheet', (tester) async {
        final c = await _pump(tester, b);
        c
          ..select(1)
          ..markAndNext()
          ..select(3)
          ..switchSection(2)
          ..jump(4);
        await _settle(tester);
        await tester.tap(find.text('Submit Test'));
        await _settle(tester);
        await _shot(tester, 'preview_end', b);
      });
    });
  }
}
