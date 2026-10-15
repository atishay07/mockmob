// The Today open as a frame sheet (MOTION.md 4.3, build item P0-9): the header at 0 ms, the
// hero rising at 120 ms, the object scaling in place about its own centre at 300 ms, the number
// landing at about 640 ms, and the screen at rest at 900 ms. The object must sit at its resting
// place in every frame after 580 ms and never glide in from the side. Night and Day.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/count_up.dart' show MmNumberMemory;
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/hero_stage.dart';

import '../../helpers/fonts.dart';
import '../../unit/today/support/today_fixtures.dart';
import '../core/frame_sequence.dart';
import 'today_golden_support.dart';

void main() {
  setUpAll(loadAppFonts);
  // Each sheet is a fresh app run: the hero's number remembers what it showed (a rebuilt hero
  // rolls on from it), so the Night run must not make the Day one start at rest.
  setUp(MmNumberMemory.clear);

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('today open (frames), $tag', (tester) async {
      debugResetHeroSweep();
      tester.view.physicalSize = kTodaySize * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      // No settle: the frames start at the first one the student sees.
      await tester.pumpWidget(
        ProviderScope(
          overrides: todayOverrides,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: buildTheme(Brightness.light),
            darkTheme: buildTheme(Brightness.dark),
            themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
            home: Scaffold(
              body: RepaintBoundary(
                child: TodayBody(view: buildToday(ashaInputs()), callbacks: noopCallbacks, skeletonDelay: Duration.zero),
              ),
            ),
          ),
        ),
      );
      final sheet = await frameSheet(
        tester,
        root: find.byType(TodayBody),
        atMs: const [0, 120, 300, 640, 900],
        crop: const Rect.fromLTWH(0, 0, 384, 600),
        scale: 0.5,
        columns: 5,
      );
      await expectLater(sheet, matchesGoldenFile('goldens/today_open_frames_$tag.png'));
      // Let the rest of the open (the sweep, Mobi's first beat) finish before teardown.
      await tester.pump(const Duration(seconds: 10));
    });
  }
}
