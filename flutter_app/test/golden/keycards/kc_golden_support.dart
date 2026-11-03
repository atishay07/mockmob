import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// Runs [build] once per theme as `goldens/<name>_<night|day>.png`, at [size] (360 dp wide, the owner's
/// phone width). `MM_PREVIEW_DIR` also writes each frame there as a plain PNG to look at.
void kcGolden(
  String name,
  Widget Function() build, {
  required List<Override> Function() overrides,
  Size size = const Size(360, 800),
  double textScale = 1,
  Future<void> Function(WidgetTester tester)? after,
  Finder Function()? capture,
}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(key: boundary, child: build()),
        brightness: brightness,
        size: size,
        textScale: textScale,
        disableAnimations: true,
        overrides: overrides(),
        wrapInScaffold: false,
      );
      await kcSettle(tester);
      if (after != null) await after(tester);
      await settleImages(tester);
      await expectLater(capture?.call() ?? find.byKey(boundary), matchesGoldenFile('goldens/${name}_$tag.png'));
      if (capture == null) await _preview(tester, boundary, '${name}_$tag');
    });
  }
}

Future<void> kcSettle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

Finder kcKey(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Future<void> kcTap(WidgetTester tester, Finder f) async {
  // As a student would: the page moves only as far as the control needs to show, so a golden keeps the page where
  // the screen itself left it (tester.ensureVisible would pull every tapped control to the top).
  final element = tester.element(f.first);
  await Scrollable.ensureVisible(element, alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd);
  await Scrollable.ensureVisible(element, alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtStart);
  await tester.pump();
  await tester.tap(f.first);
  await kcSettle(tester);
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
