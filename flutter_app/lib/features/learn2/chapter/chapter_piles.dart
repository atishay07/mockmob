import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/count_up.dart';
import '../../../core/widgets/materials/edge_light.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/pressable.dart';
import '../../../core/widgets/skeleton.dart';
import 'chapter_model.dart';

/// What the paper of a pile has printed on its top sheet, faint, so the pile reads as that kind of paper before its label
/// is read: a Key card's two lines, a question's four option dots, a mistake's red margin, a lesson's lines by a spine.
enum PaperKind {
  cards,
  questions,
  mistakes,
  lesson,
  next;

  static PaperKind of(String pileId) => switch (pileId) {
    'questions' => questions,
    'mistakes' => mistakes,
    'lesson' => lesson,
    _ => cards,
  };
}

/// The colours of the paper, from the theme's tokens: the top sheet is the raised card surface; the two under it sit a step
/// darker on both themes, so the stack reads as paper you can pick up.
class PaperColors {
  PaperColors(MmColors c)
    : top = c.raised,
      // Night: the papers under the top one are a step less lit, each one darker toward the page; Day: toward the paper's
      // own grey.
      under = c.isNight ? Color.lerp(c.ground, c.raised, 0.55)! : c.ground,
      under2 = c.isNight ? Color.lerp(c.ground, c.raised, 0.25)! : c.sunken,
      edge = c.lineStrong,
      edgeHi = c.ink4,
      shadow = c.cardShadow,
      ink = c.ink,
      ink2 = c.ink2,
      ink3 = c.ink3,
      bad = c.badText,
      night = c.isNight,
      edgeTop = c.edgeTop,
      edgeBottom = c.edgeBottom;

  final Color top;
  final Color under;
  final Color under2;
  final Color edge;
  final Color edgeHi;
  final List<BoxShadow> shadow;
  final Color ink;
  final Color ink2;
  final Color ink3;
  final Color bad;
  final bool night;
  final Color edgeTop;
  final Color edgeBottom;
}

/// A rounded rectangle drawn with a dashed line (the empty paper of "Add the next chapter"), or only its top edge (Free's
/// held pile).
class DashedBorderPainter extends CustomPainter {
  const DashedBorderPainter({required this.color, required this.radius, this.width = 1.5, this.dash = 4, this.gap = 3, this.topOnly = false});

  final Color color;
  final double radius;
  final double width;
  final double dash;
  final double gap;
  final bool topOnly;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.butt;
    final path = Path();
    if (topOnly) {
      path
        ..moveTo(radius, width / 2)
        ..lineTo(size.width - radius, width / 2);
    } else {
      path.addRRect(RRect.fromRectAndRadius((Offset.zero & size).deflate(width / 2), Radius.circular(radius)));
    }
    for (final PathMetric m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + dash, m.length)), paint);
        d += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(DashedBorderPainter old) => old.color != color || old.radius != radius || old.width != width || old.topOnly != topOnly;
}

/// The faint print on a pile's top paper (the website's FaceHint, a 60 by 22 viewBox).
class FaceHintPainter extends CustomPainter {
  const FaceHintPainter({required this.kind, required this.color});

  final PaperKind kind;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 60;
    canvas.scale(k);
    final fill = Paint()..color = color;
    void line(double x, double y, double w) => canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, 1.6), const Radius.circular(0.8)), fill);
    switch (kind) {
      case PaperKind.questions || PaperKind.mistakes:
        line(0, 0, 52);
        line(0, 5, 34);
        final ring = Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.1;
        for (var i = 0; i < 4; i++) {
          final c = Offset(3 + i * 11, 16);
          if (kind == PaperKind.mistakes && i == 1) {
            canvas.drawCircle(c, 2.6, fill);
          } else {
            canvas.drawCircle(c, 2.6, ring);
          }
        }
      case PaperKind.lesson:
        for (var i = 0; i < 4; i++) {
          line(0, i * 5.0, i == 3 ? 30 : 56 - i * 4.0);
        }
      case PaperKind.cards || PaperKind.next:
        line(0, 0, 54);
        line(0, 5, 32);
    }
  }

  @override
  bool shouldRepaint(FaceHintPainter old) => old.kind != kind || old.color != color;
}

/// A pile's fan: three papers, the top one level, the two under it leaning 3 and -4 degrees and peeking out above it. A new
/// count (or a pile put back or left out) closes the two under papers behind the top one and opens them again in 220 ms;
/// a left-out pile keeps them open.
class PileFan extends StatelessWidget {
  const PileFan({
    super.key,
    required this.kind,
    required this.animateKey,
    this.count,
    this.of,
    this.plusMinutes,
    this.leftText,
    this.ticked = false,
    this.ring = false,
    this.busy = false,
    this.dashedTop = false,
    this.emptyDashed = false,
    this.spreadAnimated = true,
    this.plusIcon = false,
  });

  final PaperKind kind;

  /// A change of this value plays the re-spread.
  final String animateKey;
  final int? count;
  final int? of;

  /// "+3" with "min" beside it (an added chapter).
  final int? plusMinutes;

  /// "Left out" or "Tomorrow" in place of the count.
  final String? leftText;

  /// The small check on the paper (in the run).
  final bool ticked;

  /// An empty ring on the paper (left out).
  final bool ring;
  final bool busy;
  final bool dashedTop;

  /// The empty dashed paper of "Add the next chapter".
  final bool emptyDashed;
  final bool spreadAnimated;
  final bool plusIcon;

  /// Width over height of the fan on a phone.
  static const double aspect = 4 / 3;
  static const double radius = 12;

  @override
  Widget build(BuildContext context) {
    final paper = PaperColors(context.mmColors);
    final reduced = Motion.reduced(context);
    final top = _top(context, paper);
    if (emptyDashed) return AspectRatio(aspectRatio: aspect, child: top);
    return AspectRatio(
      aspectRatio: aspect,
      child: TweenAnimationBuilder<double>(
        key: ValueKey(animateKey),
        tween: Tween<double>(begin: spreadAnimated && !reduced ? 0 : 1, end: 1),
        duration: spreadAnimated && !reduced ? const Duration(milliseconds: 220) : Duration.zero,
        curve: Motion.out,
        builder: (context, spread, _) => Stack(
          clipBehavior: Clip.none,
          fit: StackFit.expand,
          children: [
            _sheet(paper, paper.under2, spread, const Offset(5, -7), 3, shadow: true),
            _sheet(paper, paper.under, spread, const Offset(-5, -4), -4, shadow: true),
            top,
          ],
        ),
      ),
    );
  }

  /// An under paper: its own place and lean, about the point 50% across and 60% down.
  Widget _sheet(PaperColors paper, Color fill, double spread, Offset shift, double degrees, {required bool shadow}) => Transform(
    alignment: const Alignment(0, 0.2),
    transform: Matrix4.translationValues(shift.dx * spread, shift.dy * spread, 0)..rotateZ(degrees * spread * math.pi / 180),
    child: DecoratedBox(
      decoration: ShapeDecoration(
        color: fill,
        shape: mmShapeBorder(BorderRadius.circular(radius), side: BorderSide(color: paper.edge)),
        shadows: shadow ? paper.shadow : null,
      ),
    ),
  );

  /// The print's size: 58% of the paper's width (42 to 104 dp), made smaller, and left out under half size, when the count
  /// under it would not fit otherwise ([bottom] is the height of what stands under it).
  static Size? _hintSize(BoxConstraints box, double bottom) {
    final w = (box.maxWidth * 0.58).clamp(42.0, 104.0);
    final h = w * 22 / 60;
    final room = box.maxHeight - bottom - 3;
    if (room >= h) return Size(w, h);
    final k = room / h;
    return k < 0.5 ? null : Size(w * k, room);
  }

  Widget _top(BuildContext context, PaperColors paper) {
    final type = context.mmType;
    final br = BorderRadius.circular(radius);
    final mistakes = kind == PaperKind.mistakes;
    final lesson = kind == PaperKind.lesson;
    // The count and the words on the paper belong to the picture: they keep their size under a larger system text size (the
    // label under the pile, and its spoken form, carry the full size), and the print gives way before anything overflows.
    final inner = MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1,
      child: Builder(
        builder: (context) {
          final countStyle = type.figureCompact.copyWith(fontSize: 34, height: 0.95, letterSpacing: -0.5, color: paper.ink);
          final Widget bottom;
          if (leftText != null) {
            bottom = Text(leftText!, style: type.label.copyWith(fontSize: 13, height: 1.15, color: paper.ink2, fontWeight: FontWeight.w600));
          } else if (plusMinutes != null) {
            bottom = Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(plusMinutes! > 0 ? '+$plusMinutes' : '+', style: countStyle),
                const SizedBox(width: 4),
                Text('min', style: type.label.copyWith(fontSize: 14, color: paper.ink3, fontWeight: FontWeight.w600)),
              ],
            );
          } else if (count != null) {
            bottom = AnimatedOpacity(
              opacity: busy ? 0.72 : 1,
              duration: Motion.of(context, const Duration(milliseconds: 150)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                mainAxisSize: MainAxisSize.min,
                children: [
                  MmCountUp(value: count!, duration: const Duration(milliseconds: 180), fromZeroOnFirstBuild: false, style: countStyle),
                  if (of != null) ...[
                    const SizedBox(width: 4),
                    Text('of $of', style: type.label.copyWith(fontSize: 14, color: paper.ink3, fontWeight: FontWeight.w600)),
                  ],
                ],
              ),
            );
          } else {
            bottom = const SizedBox.shrink();
          }
          return Padding(
            padding: EdgeInsets.fromLTRB(mistakes ? 16 : (lesson ? 17 : 10), 9, 10, 9),
            child: Stack(
              fit: StackFit.expand,
              clipBehavior: Clip.none,
              children: [
                LayoutBuilder(
                  builder: (context, box) {
                    final hint = plusIcon ? null : _hintSize(box, leftText != null ? 15 : 32.3);
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: plusIcon ? MainAxisAlignment.end : MainAxisAlignment.spaceBetween,
                      children: [
                        if (hint != null)
                          CustomPaint(
                            size: hint,
                            painter: FaceHintPainter(kind: kind, color: (mistakes ? paper.bad : paper.ink3).withValues(alpha: mistakes ? 0.6 : 0.55)),
                          ),
                        if (plusIcon) Icon(LucideIcons.plus, size: 22, color: paper.ink2) else FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.bottomLeft, child: bottom),
                      ],
                    );
                  },
                ),
                if (ticked || ring)
                  Positioned(
                    top: -2,
                    right: -3,
                    child: _Tick(paper: paper, ring: ring),
                  ),
              ],
            ),
          );
        },
      ),
    );

    if (emptyDashed) {
      return CustomPaint(foregroundPainter: DashedBorderPainter(color: paper.edgeHi, radius: radius), child: inner);
    }
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: paper.top,
        shape: mmShapeBorder(br, side: BorderSide(color: paper.edge)),
        shadows: paper.shadow,
      ),
      child: CustomPaint(
        foregroundPainter: _TopEdge(radius: br, paper: paper, dashedTop: dashedTop),
        child: MmClip(
          borderRadius: br,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // A mistake's red margin, and a lesson's spine.
              if (mistakes)
                Positioned(left: 8, top: 0, bottom: 0, width: 1.5, child: ColoredBox(color: paper.bad.withValues(alpha: 0.55))),
              if (lesson)
                Positioned(left: 0, top: 0, bottom: 0, width: 6, child: ColoredBox(color: paper.edge)),
              inner,
            ],
          ),
        ),
      ),
    );
  }
}

/// The light on the top paper's upper edge, and the dashed top of a pile Free holds.
class _TopEdge extends CustomPainter {
  const _TopEdge({required this.radius, required this.paper, required this.dashedTop});

  final BorderRadius radius;
  final PaperColors paper;
  final bool dashedTop;

  @override
  void paint(Canvas canvas, Size size) {
    EdgeLightPainter(borderRadius: radius, top: paper.edgeTop, bottom: paper.edgeBottom.withValues(alpha: 0), sheen: false).paint(canvas, size);
    if (dashedTop) DashedBorderPainter(color: paper.edgeHi, radius: radius.topLeft.x, topOnly: true).paint(canvas, size);
  }

  @override
  bool shouldRepaint(_TopEdge old) => old.paper.night != paper.night || old.dashedTop != dashedTop || old.radius != radius;
}

/// The mark on the paper itself: a small filled check while the pile is in, an empty ring when it is left out.
class _Tick extends StatelessWidget {
  const _Tick({required this.paper, required this.ring});

  final PaperColors paper;
  final bool ring;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: ring ? Colors.transparent : paper.ink.withValues(alpha: 0.12),
        border: Border.all(color: ring ? paper.ink3 : paper.ink.withValues(alpha: 0.22), width: ring ? 1.5 : 1),
      ),
      child: SizedBox(width: 18, height: 18, child: ring ? null : Icon(LucideIcons.check, size: 12, color: paper.ink2, weight: 3)),
    ),
  );
}

/// One pile: the fan, its label, the minutes under it and the server's note. The whole cell is one target. A pile left out
/// dims to 35%; a held one is not a button; the last one in shakes and says so (the page's quiet line).
class PileCell extends StatelessWidget {
  const PileCell({super.key, required this.pile, required this.view, required this.busy, required this.onTap, this.refuses = false, this.shakeKey, this.describedBy});

  final ChapterPile pile;
  final PileView view;
  final bool busy;
  final VoidCallback onTap;

  /// This is the last pile in: a tap shakes it (no tick) and the page says why.
  final bool refuses;

  /// Shakes the cell once (the last pile in was tapped).
  final GlobalKey<MmShakeState>? shakeKey;

  /// The quiet line a held pile is described by.
  final String? describedBy;

  /// What a pile left out or held is drawn at.
  static const double dim = 0.35;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final held = view.state == PileState.held;
    final left = view.state != PileState.inRun;
    final fan = PileFan(
      kind: PaperKind.of(pile.id),
      animateKey: '${pile.count}-${view.state.wire}',
      count: left ? null : pile.count,
      of: view.of,
      leftText: held ? 'Tomorrow' : (left ? 'Left out' : null),
      ticked: !left,
      ring: view.state == PileState.left,
      busy: busy,
      dashedTop: held,
      spreadAnimated: !left,
    );
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(pile.label, style: type.label.copyWith(fontSize: 14, height: 1.25, color: colors.ink)),
        Text(view.line, style: type.caption.copyWith(fontSize: 12.5, height: 1.3, color: colors.ink3)),
        if (view.note != null) Text(view.note!, style: type.label.copyWith(fontSize: 12.5, height: 1.3, color: colors.warnText)),
      ],
    );
    final body = AnimatedOpacity(
      opacity: left ? dim : 1,
      duration: Motion.of(context, const Duration(milliseconds: 220)),
      curve: Motion.out,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(2, 6, 2, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 8), child: fan),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: words),
          ],
        ),
      ),
    );
    Widget cell = held
        ? Semantics(container: true, enabled: false, label: view.aria, hint: describedBy, excludeSemantics: true, child: body)
        : MmPressable(
            onTap: onTap,
            pressedScale: 0.98,
            lift: false,
            focusRadius: BorderRadius.circular(16),
            // The last pile in cannot be taken out: it shakes, with no tick.
            haptic: refuses ? MmPressHaptic.none : MmPressHaptic.selection,
            semanticsLabel: view.aria,
            checked: !pile.left,
            builder: (context, pressed, focused) => body,
          );
    if (shakeKey != null) cell = MmShake(key: shakeKey, haptic: false, size: 4, cycles: 1, length: const Duration(milliseconds: 300), child: cell);
    return cell;
  }
}

/// "Add the next chapter" (a short chapter): one dashed, empty paper with a plus, the size of a pile; once added, a solid
/// paper with "+3 min" and the chapter's ref, which a tap takes out again.
class NextPileCell extends StatelessWidget {
  const NextPileCell({super.key, required this.ref, required this.title, required this.added, required this.plus, required this.minutes, required this.busy, required this.onTap});

  /// "Ch 3".
  final String? ref;
  final String title;
  final bool added;
  final int plus;
  final int minutes;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = added ? '${ref ?? 'Next chapter'} added' : 'Add the next chapter';
    final line = added ? 'Tap to remove' : '${ref != null ? '$ref, fills' : 'Fills'} your $minutes min';
    final semantics = added ? '$title added to this run. Tap to remove it' : 'Add the next chapter, $title, to fill your $minutes minutes';
    final fan = PileFan(
      kind: PaperKind.next,
      animateKey: added ? 'added-$plus' : 'empty',
      plusMinutes: added ? plus : null,
      ticked: added,
      busy: busy,
      emptyDashed: !added,
      plusIcon: !added,
      spreadAnimated: added,
    );
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.98,
      lift: false,
      focusRadius: BorderRadius.circular(16),
      haptic: MmPressHaptic.selection,
      semanticsLabel: semantics,
      checked: added,
      builder: (context, pressed, focused) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 6, 2, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 8), child: fan),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label, style: type.label.copyWith(fontSize: 14, height: 1.25, color: colors.ink)),
                  Text(line, style: type.caption.copyWith(fontSize: 12.5, height: 1.3, color: colors.ink3)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The piles in their grid: three columns (a pile left out keeps its place, so leaving one out never moves the others), or
/// two by two when four papers are drawn (three piles and the next chapter). A pile rises in when the answer lands, 40 ms
/// after the one before it.
class PileGrid extends StatelessWidget {
  const PileGrid({super.key, required this.cells});

  final List<Widget> cells;

  @override
  Widget build(BuildContext context) {
    final columns = cells.length == 4 ? 2 : 3;
    final hGap = columns == 2 ? 14.0 : 12.0;
    final rows = <Widget>[];
    for (var start = 0; start < cells.length; start += columns) {
      final row = <Widget>[];
      for (var c = 0; c < columns; c++) {
        if (c > 0) row.add(SizedBox(width: hGap));
        final i = start + c;
        row.add(Expanded(child: i < cells.length ? MmStaggerItem(index: i, rise: 8, child: cells[i]) : const SizedBox.shrink()));
      }
      if (rows.isNotEmpty) rows.add(const SizedBox(height: 16));
      rows.add(Row(crossAxisAlignment: CrossAxisAlignment.start, children: row));
    }
    return MmStagger(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows));
  }
}

/// Before the first dry run: three piles in outline at their real size, so nothing moves when the answer lands.
class PileGridSkeleton extends StatelessWidget {
  const PileGridSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final paper = PaperColors(context.mmColors);
    Widget cell() => Padding(
      padding: const EdgeInsets.fromLTRB(2, 6, 2, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: AspectRatio(
              aspectRatio: PileFan.aspect,
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: paper.under2,
                  shape: mmShapeBorder(BorderRadius.circular(PileFan.radius), side: BorderSide(color: paper.edge)),
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [Skeleton.line(width: 72, height: 12), SizedBox(height: 6), Skeleton.line(width: 44, height: 12)],
            ),
          ),
        ],
      ),
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 12),
          Expanded(child: cell()),
        ],
      ],
    );
  }
}
