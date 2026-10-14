// The Night Sheet golden frame for the You, rhythm and notifications screens: 384 by 853
// logical px at DPR 2, Night and Daylight, named `<name>_night.png` and `<name>_day.png`.

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

const Size kSheetSize = Size(384, 853);

typedef GoldenInteract = Future<void> Function(WidgetTester tester);

/// Loads the app fonts and the Material icon font (the switch thumb's check glyph).
void setUpGoldenFonts() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });
}

/// One golden per theme of a whole screen.
void sheetGolden(
  String name,
  Widget Function() screen, {
  required List<Override> Function() overrides,
  Size size = kSheetSize,
  GoldenInteract? interact,
  bool settle = true,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      await pumpMockmob(
        tester,
        screen(),
        brightness: brightness,
        size: size,
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: overrides(),
      );
      await tester.pump();
      if (interact != null) await interact(tester);
      // Let a switch thumb or a sheet finish moving before the picture is taken.
      if (settle) await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_$tag.png'));
    });
  }
}

/// The check glyph on a switch thumb comes from the Material icon font, which the test font
/// loader does not include. Load it from the Flutter SDK so the golden shows what a phone shows.
Future<void> loadMaterialIcons() async {
  final root = Platform.environment['FLUTTER_ROOT'];
  if (root == null) return;
  final file = File('$root/bin/cache/artifacts/material_fonts/materialicons-regular.otf');
  if (!file.existsSync()) return;
  final bytes = await file.readAsBytes();
  final loader = FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
  await loader.load();
}
