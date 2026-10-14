import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../motion/scroll_effects.dart';
import '../../theme/theme.dart';
import '../bubbles/bubble_painter.dart';

/// The desk at night, drawn in code: a lamp pooling light from the upper right, its cone falling
/// across a slab of glass that carries an answer sheet, some bubbles inked in volt. It replaces
/// the pasted desk photograph behind a screen's top (the owner: the picture "doesn't look good at
/// all"), costs no image memory, and takes both themes.
///
/// Static: one painter, one RepaintBoundary, nothing animates by itself. Inside a scrollable the
/// sheet drifts against the scroll through [MmParallax] (off under reduced motion). Fades into
/// the ground at its bottom edge so it can sit under a title or a hero without a seam.
class LampBackdrop extends StatelessWidget {
  const LampBackdrop({super.key, this.height = 360, this.parallax = true, this.strength = 1});

  final double height;

  /// Move the sheet against the scroll when inside a scrollable.
  final bool parallax;

  /// Scales the lamp's strength (1 is the resting scene).
  final double strength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final scene = RepaintBoundary(
      child: CustomPaint(
        size: Size.fromHeight(height),
        painter: LampBackdropPainter(colors: colors, strength: strength),
      ),
    );
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: parallax ? MmParallax(factor: 0.16, child: scene) : scene,
      ),
    );
  }
}

/// Paints the [LampBackdrop] scene. Public so it can be drawn into a golden or another painter.
class LampBackdropPainter extends CustomPainter {
  const LampBackdropPainter({required this.colors, this.strength = 1});

  final MmColors colors;
  final double strength;

  /// The inked bubbles of the sheet, as (column, row) of a 4 by 8 grid.
  static const List<(int, int)> _inked = [(0, 0), (1, 1), (2, 2), (1, 4), (3, 5), (0, 6), (2, 7)];

  @override
  void paint(Canvas canvas, Size size) {
    final night = colors.isNight;
    final w = size.width;
    final h = size.height;
    final rect = Offset.zero & size;

    // The lamp's pool, from the upper right, and a wide faint wash so the whole top is warm.
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(0.95, -1.05),
          radius: 0.95,
          colors: [
            colors.lamp.withValues(alpha: (night ? 0.42 : 0.3) * strength),
            colors.lamp.withValues(alpha: (night ? 0.1 : 0.07) * strength),
            colors.lamp.withValues(alpha: 0),
          ],
          stops: const [0, 0.5, 1],
        ).createShader(Rect.fromLTWH(0, 0, w * 1.4, h * 1.25)),
    );

    // The lamp head: a flat ellipse of light with a bright core, so the pool has a source.
    final head = Offset(w * 0.86, h * 0.07);
    canvas.drawOval(
      Rect.fromCenter(center: head, width: w * 0.34, height: h * 0.07),
      Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xFFFFF1CC).withValues(alpha: (night ? 0.92 : 0.8) * strength),
            colors.lamp.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromCenter(center: head, width: w * 0.34, height: h * 0.07)),
    );

    // The slab of glass, tilted a few degrees, lit from its upper right.
    final slabW = w * 0.34;
    final slabH = math.min(h * 0.74, slabW * 2.1);
    final slabCenter = Offset(w * 0.64, h * 0.52);
    canvas.save();
    canvas.translate(slabCenter.dx, slabCenter.dy);
    canvas.rotate(-0.05);
    final slab = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: slabW, height: slabH), const Radius.circular(18));

    // The cone of light falling toward the slab (behind it).
    canvas.save();
    canvas.rotate(0.05);
    canvas.translate(-slabCenter.dx, -slabCenter.dy);
    final cone = Path()
      ..moveTo(head.dx - w * 0.12, head.dy)
      ..lineTo(head.dx + w * 0.12, head.dy)
      ..lineTo(slabCenter.dx + slabW * 0.62, slabCenter.dy + slabH * 0.5)
      ..lineTo(slabCenter.dx - slabW * 0.9, slabCenter.dy + slabH * 0.5)
      ..close();
    canvas.drawPath(
      cone,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colors.lamp.withValues(alpha: (night ? 0.14 : 0.1) * strength), colors.lamp.withValues(alpha: 0)],
        ).createShader(cone.getBounds()),
    );
    canvas.restore();

    // A soft shadow, then the glass.
    canvas.drawRRect(
      slab.shift(const Offset(0, 10)),
      Paint()
        ..color = const Color(0xFF000000).withValues(alpha: night ? 0.45 : 0.16)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14),
    );
    canvas.drawRRect(
      slab,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: night
              ? [colors.raised2.withValues(alpha: 0.95), colors.raised.withValues(alpha: 0.9)]
              : [const Color(0xFFFFFFFF).withValues(alpha: 0.92), colors.raised2.withValues(alpha: 0.85)],
        ).createShader(slab.outerRect),
    );

    // The bubbles: a grid of rings, some inked.
    final bubbles = BubblePaint(colors);
    const cols = 4;
    const rows = 8;
    final cellW = slabW * 0.76 / cols;
    final cellH = slabH * 0.86 / rows;
    final r = math.min(cellW, cellH) * 0.3;
    final origin = Offset(-slabW * 0.76 / 2 + cellW / 2, -slabH * 0.86 / 2 + cellH / 2);
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        final c = origin + Offset(col * cellW, row * cellH);
        final inked = _inked.contains((col, row));
        if (inked && night) {
          canvas.drawCircle(
            c,
            r * 2.1,
            Paint()
              ..color = colors.volt.withValues(alpha: 0.22 * strength)
              ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
          );
        }
        bubbles.paint(canvas, c, r, inked ? BubbleState.filled : BubbleState.hollow, dim: inked ? 1 : 0.75);
      }
    }

    // The glass's edge light, and the volt rim along its top that the lamp catches.
    canvas.drawRRect(
      slab.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colors.edgeTop.withValues(alpha: math.min(1, colors.edgeTop.a * 2)), colors.edgeBottom],
        ).createShader(slab.outerRect),
    );
    final rim = Path()
      ..moveTo(slab.left + 20, slab.top + 0.75)
      ..lineTo(slab.right - 20, slab.top + 0.75);
    canvas.drawPath(
      rim,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round
        ..color = (night ? colors.volt : colors.accentText).withValues(alpha: 0.8 * strength),
    );
    canvas.restore();

    // The desk surface: the pool of light across the bottom, then the fade into the ground.
    canvas.drawRect(
      Rect.fromLTWH(0, h * 0.7, w, h * 0.3 + 1),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colors.ground.withValues(alpha: 0), colors.ground],
        ).createShader(Rect.fromLTWH(0, h * 0.7, w, h * 0.3)),
    );
  }

  @override
  bool shouldRepaint(LampBackdropPainter old) => old.colors != colors || old.strength != strength;
}
