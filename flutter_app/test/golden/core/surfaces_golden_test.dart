import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import 'frame_sequence.dart';
import '../../helpers/golden_harness.dart';
import 'night_support.dart';

/// The three surface tiers and the grouped list in one Today-like composition: a hero with the
/// monumental number and an inset (not a third border) for the minutes, a plain card, and a
/// grouped list instead of a stack of identical boxes.
Widget _surfaces() {
  return Builder(builder: (context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget glyph(IconData icon) => DecoratedBox(
          decoration: ShapeDecoration(color: colors.raised2, shape: RoundedSuperellipseBorder(borderRadius: BorderRadius.circular(12))),
          child: SizedBox.square(dimension: 40, child: Icon(icon, size: 20, color: colors.ink)),
        );
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmSurface.hero(
            lit: true,
            light: SubjectLight.accountancy.of(Theme.of(context).brightness),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Tonight's move", style: type.caption.copyWith(color: colors.ink2)),
                const SizedBox(height: 2),
                Text('Accountancy', style: type.cardTitle),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    MonumentalNumber(value: '3', style: type.hero.copyWith(fontSize: 88, height: 0.9), roll: false),
                    const SizedBox(width: 12),
                    Expanded(child: Text('to repair tonight', style: type.title)),
                  ],
                ),
                const SizedBox(height: 12),
                MmSurface.inset(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Text('3 of the 4 in Admission of a partner, from Mock 7 on 12 Oct.', style: type.body.copyWith(color: colors.ink2)),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmRhythm.section),
          MmSection(
            title: 'Your sheet',
            caption: 'The last three papers',
            child: MmRowGroup(children: [
              MmRow(leading: glyph(LucideIcons.timer), title: 'Mock 7', subtitle: 'Accountancy, 12 October. 183 of 250', onTap: () {}),
              MmRow(leading: glyph(LucideIcons.timer), title: 'Mock 6', subtitle: 'Accountancy, 8 October. 171 of 250', onTap: () {}),
              MmRow(leading: glyph(LucideIcons.zap), title: 'Quick 10', subtitle: 'Business Studies, 6 October. 7 of 10', onTap: () {}),
            ]),
          ),
          const SizedBox(height: MmRhythm.group),
          MmSurface.plain(
            child: Row(
              children: [
                Expanded(child: Text('28 weeks to the expected CUET window, May 2027', style: type.body)),
              ],
            ),
          ),
        ],
      ),
    );
  });
}

Widget _skeletons() {
  return const Padding(
    padding: EdgeInsets.fromLTRB(16, 24, 16, 16),
    child: SkeletonGroup(
      shimmer: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [MmSkeletonCard(hero: true), SizedBox(height: 24), MmSkeletonRows(), SizedBox(height: 12), MmSkeletonCard()],
      ),
    ),
  );
}

void main() {
  nightGolden('surfaces', _surfaces);
  // Mid-sweep: the one warm band crossing every block as a single light.
  nightGolden('skeleton_shimmer', _skeletons, disableAnimations: false);

  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    // The shimmer across time: the band early in a sweep, mid sweep, late, at rest between
    // sweeps, and after the fourth sweep when it has stopped for good (left to right).
    testWidgets('skeleton shimmer (frames), $tag', (tester) async {
      await pumpMockmob(
        tester,
        Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: _skeletons())),
        brightness: brightness,
        size: kNightSize,
      );
      final sheet = await frameSheet(
        tester,
        root: find.byType(Scaffold).first,
        atMs: const [0, 300, 700, 1000, 7500],
        crop: const Rect.fromLTWH(0, 0, 384, 540),
        scale: 0.5,
        columns: 5,
      );
      await expectLater(sheet, matchesGoldenFile('goldens/skeleton_frames_$tag.png'));
      await tester.pumpAndSettle();
    });

    // Today to Review, 110 ms in: the leading edge has reached Review, the trailing edge is still
    // leaving Today, so the lit tile is a stretched, thinner drop of light.
    // The liquid tile across its whole travel, both ways (frames 0, 40, 80, 130, 200 and 420 ms,
    // top to bottom): the volt edge must follow the tile's own corners at every stretch, at both
    // ends of the dock, and never be cut by the pill.
    for (final (name, from, to) in const [('right', 0, 2), ('left', 2, 0)]) {
      testWidgets('dock travel $name (frames), $tag', (tester) async {
        final index = ValueNotifier(from);
        addTearDown(index.dispose);
        await pumpMockmob(
          tester,
          GoldenRoom(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: BackdropGroup(
                child: ValueListenableBuilder<int>(
                  valueListenable: index,
                  builder: (context, i, _) => SplitDock(currentIndex: i, onTab: (_) {}, onStart: (_) {}),
                ),
              ),
            ),
          ),
          brightness: brightness,
          size: kNightSize,
        );
        await tester.pump(StartButton.breathDuration);
        index.value = to;
        await tester.pump();
        final sheet = await frameSheet(
          tester,
          root: find.byType(Scaffold).first,
          atMs: const [0, 40, 80, 130, 200, 420],
          crop: const Rect.fromLTWH(0, 853 - 104, 384, 104),
        );
        await expectLater(sheet, matchesGoldenFile('goldens/dock_travel_${name}_$tag.png'));
        await tester.pumpAndSettle();
      });
    }

    testWidgets('dock mid-switch (liquid tile), $tag', (tester) async {
      final index = ValueNotifier(0);
      addTearDown(index.dispose);
      await pumpMockmob(
        tester,
        GoldenRoom(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: BackdropGroup(
              child: ValueListenableBuilder<int>(
                valueListenable: index,
                builder: (context, i, _) => SplitDock(currentIndex: i, onTab: (_) {}, onStart: (_) {}),
              ),
            ),
          ),
        ),
        brightness: brightness,
        size: kNightSize,
      );
      await tester.pump(StartButton.breathDuration);
      index.value = 2;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 110));
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/dock_liquid_mid_$tag.png'));
      await tester.pumpAndSettle();
    });
  }
}
