// The bar (NAV-1017 section 6, Option A1: five tabs in a glass capsule and the round volt Start
// key beside it on one 64 dp row; GLASS-1017 5.4 to 5.6): contact sheets
// of its states and of the lens travelling, Night and Day. Each sheet stacks the bottom of a phone (content behind the glass,
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
    this.ruler = false,
    this.behind = false,
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

  /// Draws the measuring lines of NAV-1017 6.1 over the bar: the icon centre line (y 23), the
  /// row's centre (y 32, compact 38), the label centre line (y 46), the capsule's and the key's
  /// top and bottom edges, every slot's centre and the key's centre.
  final bool ruler;

  /// Puts real content right under the bar (a line of text, a volt key and a card's edge), so the
  /// frost is judged over something (L33; GLASS-1017 check A3: no volt behind a label at full
  /// strength, no glyph readable through the glass).
  final bool behind;
}

/// What scrolls under the bar on a [_Shot.behind] row.
class _Behind extends StatelessWidget {
  const _Behind();

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Business Studies, 162 questions in the bank', style: type.body.copyWith(color: c.ink)),
          const SizedBox(height: 10),
          Container(
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: c.volt, borderRadius: BorderRadius.circular(26)),
            child: Text('Start 10 questions', style: type.body.copyWith(color: c.voltInk, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 10),
          Text('Partnership: 4 mistakes to repair', style: type.body.copyWith(color: c.ink2)),
        ],
      ),
    );
  }
}

/// The ruler of [_Shot.ruler]: hairlines in a colour no part of the bar uses.
class _RulerPainter extends CustomPainter {
  _RulerPainter({required this.geo, required this.compact});

  final BarGeometry geo;
  final bool compact;

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = const Color(0xCCFF2D95)
      ..strokeWidth = 0.5;
    final e = compact ? 1.0 : 0.0;
    final ys = <double>[
      geo.iconRect(0, collapse: e).center.dy,
      geo.capsuleShape(e).center.dy,
      if (!compact) MmBar.labelTop + MmBar.labelHeight / 2,
      geo.capsuleShape(e).top,
      geo.capsuleShape(e).bottom - 0.5,
    ];
    for (final y in ys) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), line);
    }
    for (var i = 0; i < kBarSlots; i++) {
      final x = geo.slotCenter(i);
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), line);
    }
    final k = geo.keyBox.center.dx;
    canvas.drawLine(Offset(k, 0), Offset(k, size.height), line);
  }

  @override
  bool shouldRepaint(_RulerPainter old) => old.geo.width != geo.width || old.compact != compact;
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
          onTab: (_) {},
          onStart: (_) {},
        );
    final scene = BackdropGroup(
      child: GoldenRoom(
        artHeight: 420,
        child: Stack(
          children: [
            if (shot.behind) const Positioned(left: 0, right: 0, bottom: _inset - 4, child: _Behind()),
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
                  width: geo.width,
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
                child: Stack(
                  children: [
                    branch == null ? bar(shot.branch) : ValueListenableBuilder<int>(valueListenable: branch!, builder: (context, b, _) => bar(b)),
                    if (shot.ruler)
                      Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _RulerPainter(geo: geo, compact: shot.compact)))),
                  ],
                ),
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
  // Each place on the bar (Today, Practice, Review, Colleges, You), compact (scrolled down) on
  // Review and on You, then Start held down.
  _barSheet('bar_tabs', const [
    _Shot(branch: 0),
    _Shot(branch: 1),
    _Shot(branch: 2),
    _Shot(branch: 3),
    _Shot(branch: 4),
    _Shot(branch: 2, compact: true),
    _Shot(branch: 4, compact: true),
    _Shot(branch: 0, startPressed: true),
  ]);

  // NAV-1017 6.1 and check A3: the split row at 320, 360, 390 and 412 dp. Today expanded with the
  // ruler (icon line, row centre, label line, capsule and key edges, every slot centre and the
  // key's); Practice with Review's count and Colleges' dot; You; Review compact with the ruler;
  // Colleges compact; Practice and Colleges at text scale 1.2 (the bar's clamp), where the lens
  // must still hold the icon and the whole word.
  for (final width in const [320.0, 360.0, 390.0, 412.0]) {
    _barSheet('bar_split_${width.toInt()}', [
      _Shot(branch: 0, width: width, ruler: true),
      _Shot(branch: 1, width: width, badges: const BarBadges(reviewCount: 3, collegesDot: true)),
      _Shot(branch: 4, width: width),
      _Shot(branch: 2, width: width, compact: true, ruler: true),
      _Shot(branch: 3, width: width, compact: true),
      _Shot(branch: 1, width: width, textScale: 1.2, badges: const BarBadges(reviewCount: 3)),
      _Shot(branch: 3, width: width, textScale: 1.2),
    ], size: Size(width, kNightSize.height));
  }

  // Real counts only: Review's 3 and 9+, the dot after a dismissed Marked capsule, Review's
  // count with You's dot, and Colleges' dot (new cutoffs for a saved college).
  _barSheet('bar_badges', const [
    _Shot(branch: 0, badges: BarBadges(reviewCount: 3)),
    _Shot(branch: 2, badges: BarBadges(reviewCount: 12)),
    _Shot(branch: 1, badges: BarBadges(reviewDot: true)),
    _Shot(branch: 0, badges: BarBadges(reviewCount: 3, youDot: true)),
    _Shot(branch: 0, badges: BarBadges(collegesDot: true)),
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

  // The frost over real content (L33): a line of text, a volt key and a muted line pass under the
  // bar. Full (blurred, the volt dimmed to olive at Night and paled at Day), compact, then Lite
  // and Off.
  _barSheet('bar_frost', const [
    _Shot(branch: 1, behind: true, quality: GlassQuality.full),
    _Shot(branch: 1, behind: true, quality: GlassQuality.full, compact: true),
    _Shot(branch: 1, behind: true, quality: GlassQuality.lite),
    _Shot(branch: 1, behind: true, quality: GlassQuality.off),
  ]);

  // Glass tiers: Full (live blur), Lite (tint and noise), Off (solid with a hairline).
  _barSheet('bar_tiers', const [
    _Shot(branch: 1, quality: GlassQuality.full),
    _Shot(branch: 1, quality: GlassQuality.lite),
    _Shot(branch: 1, quality: GlassQuality.off),
  ]);

  // Large text (labels scale down, never clip, the bar keeps its height; the icons never scale)
  // and a 320 dp phone (8 dp gutters, five 45.6 dp slots), expanded and compact.
  _barSheet('bar_text', [
    const _Shot(branch: 1, textScale: 1.3, badges: BarBadges(reviewCount: 3)),
    const _Shot(branch: 1, textScale: 2, badges: BarBadges(reviewCount: 3)),
    const _Shot(branch: 1, width: 320, badges: BarBadges(reviewCount: 3)),
    _Shot(branch: 1, width: 320, textScale: 1.3, live: BarMove(title: 'Business Studies practice', detail: '20 min', onStart: () {})),
    const _Shot(branch: 4, width: 320, textScale: 2, compact: true, badges: BarBadges(reviewCount: 3)),
  ]);

  setUpAll(_loadFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';

    // GLASS-1017 5.5, the strip: Today open, a finger lands on Practice at 0 ms and lifts at
    // 70 ms. Frames at 0 (rest), 70 (the lens lifted, wider and clearer, Today's icon magnified,
    // the light under the finger), 150 (travelling, still lifted), 230, 330 (landing, the lift
    // sinking) and 480 ms (at rest on Practice).
    testWidgets('bar lift (frames), $tag', (tester) async {
      await pumpMockmob(tester, const _Scene(shot: _Shot()), brightness: brightness, size: kNightSize);
      await tester.pump(const Duration(milliseconds: 500));
      TestGesture? finger;
      final sheet = await frameSheet(
        tester,
        root: find.byType(Scaffold).first,
        atMs: const [0, 70, 150, 230, 330, 480],
        crop: const Rect.fromLTWH(0, 853 - _inset - MmBar.lift - MmBar.height - 8, 384, MmBar.height + 16),
        pixelRatio: _ratio,
        beforeFrame: (i) async {
          // A frame at once after each event, so the tickers start at the event, not a frame later.
          if (i == 1) finger = await tester.startGesture(tester.getCenter(find.text('Practice')));
          if (i == 2) await finger!.up();
          if (i == 1 || i == 2) await tester.pump();
        },
      );
      await expectLater(sheet, matchesGoldenFile('goldens/bar_lift_$tag.png'));
      await tester.pumpAndSettle();
    });

    // The lens from Practice to Review at 0, 40, 80, 130, 200 and 420 ms (top to bottom): the
    // leading edge runs ahead, the trailing edge follows, the old icon empties to its outline
    // (160 ms), and the new one fills (200 ms) only once the lens has nearly arrived (past 70%
    // of its travel). Then Review back to Today, leftward. The key never moves.
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
