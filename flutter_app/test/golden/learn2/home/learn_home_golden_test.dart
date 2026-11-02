// Learn home at 360 x 800, Night and Day (APP-1101 section 7, APP-1102-A section 3): a returning Pro student (the pick-up offer
// and the top of the page, the roadmap, the part switch, sorted by what needs work), a new Pro and a new Free student, Free with its
// day used, Economics (Today's 10 minutes), loading, failed, Find open (the student's sets as rows; a new student's words to try;
// typing), a set open, the subject sheet and a subject with no chapter that has cards; the returning Pro page again at 412 dp
// and at text scale 1.3. The page is plain: LearnHome is embedded content, and Practice owns the title, the pull and the scroll.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';

import '../../../helpers/fonts.dart';
import '../../../helpers/golden_harness.dart';
import '../../../unit/learn2/home/home_support.dart';

/// Runs [build] once per theme as `goldens/home_<name>_<night|day>.png`. `MM_PREVIEW_DIR` also writes each frame there.
void _golden(
  String name, {
  required List<Override> Function() overrides,
  Size size = const Size(360, 800),
  double textScale = 1,
  Future<void> Function(WidgetTester tester)? after,
  String? subject,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(key: boundary, child: HomePage(subject: subject)),
        brightness: brightness,
        size: size,
        textScale: textScale,
        disableAnimations: true,
        overrides: overrides(),
        wrapInScaffold: false,
      );
      await _settle(tester);
      if (after != null) await after(tester);
      await settleImages(tester);
      await expectLater(find.byKey(boundary), matchesGoldenFile('goldens/home_${name}_$tag.png'));
      await _preview(tester, boundary, 'home_${name}_$tag');
    });
  }
}

Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
  await settleImages(tester);
}

Future<void> _scrollTo(WidgetTester tester, Finder f) async {
  await Scrollable.ensureVisible(tester.element(f.first), alignment: 0.04);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.tap(f.first);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _preview(WidgetTester tester, GlobalKey key, String name) async {
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

void main() {
  setUpAll(loadAppFonts);
  setUp(() => SubjectEmblem.objectArt = true);
  tearDown(() => SubjectEmblem.objectArt = false);

  _golden('pro_returning', overrides: () => homeOverrides(HomeLearnApi()));
  _golden(
    'pro_returning_chapters',
    overrides: () => homeOverrides(HomeLearnApi()),
    after: (tester) => _scrollTo(tester, find.text('Your roadmap')),
  );
  _golden(
    'pro_returning_part_switch',
    overrides: () => homeOverrides(HomeLearnApi()),
    after: (tester) => _scrollTo(tester, find.byKey(const ValueKey('lh-switch-p2'))),
  );
  _golden(
    'pro_returning_sorted',
    overrides: () => homeOverrides(HomeLearnApi()),
    after: (tester) async {
      await _scrollTo(tester, find.text('Your roadmap'));
      await _tap(tester, find.byKey(const ValueKey('lh-sort')));
      await tester.tap(find.byKey(const ValueKey('lh-sort-needs')));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(milliseconds: 600));
      await _scrollTo(tester, find.text('Your roadmap'));
    },
  );
  _golden('pro_returning_412', size: const Size(412, 892), overrides: () => homeOverrides(HomeLearnApi()));
  _golden('pro_returning_text13', textScale: 1.3, overrides: () => homeOverrides(HomeLearnApi()));
  _golden('new_pro', overrides: () => homeOverrides(HomeLearnApi(newStudent: true)));
  _golden('new_free', overrides: () => homeOverrides(HomeLearnApi(pro: false, newStudent: true)));
  _golden('free_day_used', overrides: () => homeOverrides(HomeLearnApi(pro: false, freeUsed: true), nudges: true));
  _golden('economics', overrides: () => homeOverrides(HomeLearnApi(), subject: 'economics'));
  _golden('loading', overrides: () => homeOverrides(HoldLearnApi()));
  _golden('error', overrides: () => homeOverrides(HomeLearnApi(error: true)));
  _golden(
    'find_open',
    overrides: () => homeOverrides(HomeLearnApi()),
    after: (tester) => _tap(tester, find.byKey(const ValueKey('lh-search'))),
  );
  _golden(
    'find_new',
    overrides: () => homeOverrides(HomeLearnApi(newStudent: true)),
    after: (tester) => _tap(tester, find.byKey(const ValueKey('lh-search'))),
  );
  _golden(
    'find_typing',
    overrides: () => homeOverrides(HomeLearnApi()),
    after: (tester) async {
      await tester.enterText(find.byKey(const ValueKey('lh-search')), 'goodwill');
      await tester.pump(const Duration(milliseconds: 400));
    },
  );
  _golden(
    'set_due',
    overrides: () => homeOverrides(HomeLearnApi()),
    after: (tester) async {
      await _tap(tester, find.byKey(const ValueKey('lh-search')));
      await _tap(tester, find.byKey(const ValueKey('lh-find-due')));
    },
  );
  _golden(
    'no_chapters',
    overrides: () => homeOverrides(
      HomeLearnApi(
        thin: true,
        edit: (j) {
          for (final p in (j['parts'] as List).cast<Map<String, dynamic>>()) {
            p['option'] = null;
          }
        },
      ),
    ),
  );

  // The subject sheet, over the page (the whole frame: the sheet is above the page's own boundary).
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('picker_open, $tag', (tester) async {
      await pumpMockmob(
        tester,
        const HomePage(),
        brightness: brightness,
        size: const Size(360, 800),
        disableAnimations: true,
        overrides: homeOverrides(HomeLearnApi()),
        wrapInScaffold: false,
      );
      await _settle(tester);
      await _tap(tester, find.byKey(const ValueKey('lh-picker')));
      await tester.pump(const Duration(milliseconds: 600));
      await settleImages(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/home_picker_open_$tag.png'));
    });
  }
}
