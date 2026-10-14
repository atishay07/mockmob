// The bar (docs/brain/ui-phase2/DOCK.md 9.3): contact sheets of its states and of the lens
// travelling, Night and Day. Each sheet stacks the bottom of a phone (content behind the glass,
// the scrim, the capsule and the bar) for one state per row, so the bar is judged over real
// content, not on a flat ground.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../you/you_golden_kit.dart' show loadMaterialIcons;
import 'frame_sequence.dart';
import 'night_support.dart';

/// The gesture inset under the bar on these frames.
const double _inset = 20;

/// How much of the bottom of the frame each row shows: the bar, the capsule and some content.
const double _cropHeight = 196;

/// The sheets are captured at 2x, near a phone's density, so the 24 dp icons are judged as a
/// student sees them.
const double _ratio = 2;

/// The app's type and the Material icon font the bar's glyphs come from.
Future<void> _loadFonts() async {
  await loadAppFonts();
  await loadMaterialIcons();
}

/// One state of the bar.
class _Shot {
  const _Shot({
    this.branch = 0,
    this.badges = BarBadges.none,
    this.live,
    this.compact = false,
    this.startPressed = false,
    this.quality,
    this.textScale = 1,
    this.width,
    this.youInitial = 'A',
  });

  final int branch;
  final BarBadges badges;
  final BarLive? live;
  final bool compact;
  final bool startPressed;
  final GlassQuality? quality;
  final double textScale;

  /// A narrower phone (the bar is laid out for this width, at the left of the frame).
  final double? width;

  /// You's initial; null draws the person glyph.
  final String? youInitial;
}

/// The bottom of a phone in one [_Shot]: the room behind, the bar's scrim, the capsule and the bar.
class _Scene extends StatelessWidget {
  const _Scene({required this.shot, this.branch});

  final _Shot shot;

  /// Overrides [shot]'s branch (the travel frames move it).
  final ValueNotifier<int>? branch;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = shot.width ?? media.size.width;
    final capsule = shot.live != null;
    final geo = BarGeometry(width);
    Widget bar(int b) => MmBottomBar(
          key: const ValueKey('bar'),
          currentBranch: b,
          badges: shot.badges,
          compact: shot.compact ? _alwaysCompact : null,
          startPressed: shot.startPressed,
          quality: shot.quality,
          youInitial: shot.youInitial,
          onTab: (_) {},
          onStart: (_) {},
        );
    final scene = BackdropGroup(
      child: GoldenRoom(
        artHeight: 420,
        child: Stack(
          children: [
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: BarScrim.heightFor(_inset, capsule: capsule),
              child: BarScrim(bottomInset: _inset, capsule: capsule),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: _inset + MmBar.lift + MmBar.height + MmBar.capsuleGap - 2,
              child: Center(
                child: LiveCapsule(
                  live: shot.live,
                  width: geo.width - 32,
                  collapse: shot.compact ? kAlwaysCompleteAnimation : kAlwaysDismissedAnimation,
                  quality: shot.quality,
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: _inset + MmBar.lift,
              child: Center(
                child: branch == null ? bar(shot.branch) : ValueListenableBuilder<int>(valueListenable: branch!, builder: (context, b, _) => bar(b)),
              ),
            ),
          ],
        ),
      ),
    );
    return MediaQuery(
      data: media.copyWith(
        size: Size(width, media.size.height),
        textScaler: TextScaler.linear(shot.textScale),
        padding: const EdgeInsets.only(bottom: _inset),
        viewPadding: const EdgeInsets.only(bottom: _inset),
      ),
      child: Align(alignment: Alignment.centerLeft, child: SizedBox(width: width, child: scene)),
    );
  }
}

final ValueNotifier<bool> _alwaysCompact = ValueNotifier(true);

/// A contact sheet named `<name>_<night|day>.png`: one row per shot, top to bottom.
void _barSheet(String name, List<_Shot> shots, {Size size = kNightSize}) {
  setUpAll(_loadFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final shot = ValueNotifier(0);
      addTearDown(shot.dispose);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<int>(
          valueListenable: shot,
          // A fresh bar per shot, so each state is drawn as it mounts.
          builder: (context, i, _) => KeyedSubtree(key: ValueKey(i), child: _Scene(shot: shots[i])),
        ),
        brightness: brightness,
        size: size,
        disableAnimations: true,
      );
      final sheet = await frameSheet(
        tester,
        root: find.byType(Scaffold).first,
        atMs: [for (var i = 0; i < shots.length; i++) 0],
        crop: Rect.fromLTWH(0, size.height - _cropHeight, size.width, _cropHeight),
        pixelRatio: _ratio,
        beforeFrame: (i) async {
          shot.value = i;
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 300));
        },
      );
      await expectLater(sheet, matchesGoldenFile('goldens/${name}_$tag.png'));
    });
  }
}

void main() {
  // Each place on the bar, then You with no name (the person glyph), compact (scrolled down)
  // on Review and on You, then Start held down.
  _barSheet('bar_tabs', const [
    _Shot(branch: 0),
    _Shot(branch: 1),
    _Shot(branch: 2),
    _Shot(branch: 3),
    _Shot(branch: 3, youInitial: null),
    _Shot(branch: 2, compact: true),
    _Shot(branch: 3, compact: true),
    _Shot(branch: 0, startPressed: true),
  ]);

  // Real counts only: Review's 3 and 9+, the dot after a dismissed Marked capsule, and the two
  // badges the bar allows at most (Review's count and You's dot).
  _barSheet('bar_badges', const [
    _Shot(branch: 0, badges: BarBadges(reviewCount: 3)),
    _Shot(branch: 2, badges: BarBadges(reviewCount: 12)),
    _Shot(branch: 1, badges: BarBadges(reviewDot: true)),
    _Shot(branch: 0, badges: BarBadges(reviewCount: 3, youDot: true)),
  ]);

  // Every capsule state, highest priority first, and tonight's move (Today only).
  _barSheet('bar_capsule', [
    const _Shot(live: BarSending(paper: 'Accountancy mock')),
    _Shot(live: BarSaved(at: DateTime(2026, 10, 14, 23, 51), paper: 'Accountancy mock')),
    const _Shot(live: BarMarked(attemptId: 'a8', paper: 'Mock 8', subject: 'Accountancy')),
    _Shot(
      live: BarResume(
        sessionId: 's1',
        paper: 'Accountancy mock',
        total: 50,
        answered: 23,
        endsAt: DateTime(2026, 10, 14, 22, 41),
        now: DateTime(2026, 10, 14, 22, 0),
      ),
    ),
    const _Shot(live: BarOffline(answers: 3)),
    const _Shot(live: BarSynced()),
    _Shot(live: BarMove(title: 'Accountancy repair', detail: '15 min', onStart: () {})),
  ]);

  // Glass tiers: Full (live blur), Lite (tint and noise), Off (solid with a hairline).
  _barSheet('bar_tiers', const [
    _Shot(branch: 1, quality: GlassQuality.full),
    _Shot(branch: 1, quality: GlassQuality.lite),
    _Shot(branch: 1, quality: GlassQuality.off),
  ]);

  // Large text (labels scale down, never clip, the bar keeps its height; the icons never scale)
  // and a 320 dp phone, where the Start slot narrows to 68 and the tabs to 52, expanded and
  // compact.
  _barSheet('bar_text', [
    const _Shot(branch: 1, textScale: 1.3, badges: BarBadges(reviewCount: 3)),
    const _Shot(branch: 1, textScale: 2, badges: BarBadges(reviewCount: 3)),
    const _Shot(branch: 1, width: 320, badges: BarBadges(reviewCount: 3)),
    _Shot(branch: 1, width: 320, textScale: 1.3, live: BarMove(title: 'Business Studies practice', detail: '20 min', onStart: () {})),
    const _Shot(branch: 3, width: 320, textScale: 2, compact: true, badges: BarBadges(reviewCount: 3)),
  ]);

  setUpAll(_loadFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    // The lens from Practice to Review, across Start, at 0, 40, 80, 130, 200 and 420 ms (top to
    // bottom): the leading edge runs ahead, the trailing edge follows, the lens slides under
    // Start (which dips), the old icon empties to its outline (160 ms), and the new one fills
    // (200 ms) only once the lens has nearly arrived (no volt on the target before the leading
    // edge passes 70% of its travel). Then Review back to Today, leftward.
    for (final (name, from, to) in const [('right', 1, 2), ('left', 2, 0)]) {
      testWidgets('bar travel $name (frames), $tag', (tester) async {
        final branch = ValueNotifier(from);
        addTearDown(branch.dispose);
        await pumpMockmob(
          tester,
          _Scene(shot: const _Shot(), branch: branch),
          brightness: brightness,
          size: kNightSize,
        );
        await tester.pump(const Duration(milliseconds: 500));
        branch.value = to;
        await tester.pump();
        final sheet = await frameSheet(
          tester,
          root: find.byType(Scaffold).first,
          atMs: const [0, 40, 80, 130, 200, 420],
          crop: const Rect.fromLTWH(0, 853 - _inset - MmBar.lift - MmBar.height - 8, 384, MmBar.height + 16),
          pixelRatio: _ratio,
        );
        await expectLater(sheet, matchesGoldenFile('goldens/bar_travel_${name}_$tag.png'));
        await tester.pumpAndSettle();
      });
    }
  }
}
