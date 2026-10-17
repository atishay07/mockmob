import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../logic/tokens.dart';

/// A milestone not earned yet: a dashed coin outline with the milestone's glyph, quiet, so it
/// reads as "this goes here" rather than a grey blur of the medal. With [arc] it is the next badge
/// of the badge home: a thin solid ring over the dashes shows how far along an exact count is (0 to 1).
/// Never a padlock.
class LockedCoin extends StatelessWidget {
  const LockedCoin(this.token, {super.key, this.size = 64, this.arc});

  final MilestoneToken token;
  final double size;

  /// How far along the next badge is, only where the count is exact; null draws the dashes alone.
  final double? arc;

  static IconData glyphOf(MilestoneToken token) => switch (token) {
        MilestoneToken.firstMock => LucideIcons.fileText,
        MilestoneToken.firstRepair => LucideIcons.wrench,
        MilestoneToken.firstWeek => LucideIcons.rotateCw,
        MilestoneToken.bestWork => LucideIcons.trendingUp,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: _DashedRing(colors.ink.withValues(alpha: 0.24), arc: arc, arcColor: colors.accentText),
          child: Center(child: Icon(glyphOf(token), size: size * 0.36, color: colors.ink.withValues(alpha: 0.4))),
        ),
      ),
    );
  }
}

class _DashedRing extends CustomPainter {
  const _DashedRing(this.color, {this.arc, this.arcColor});

  final Color color;
  final double? arc;
  final Color? arcColor;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..color = color;
    final r = size.shortestSide / 2 - 2;
    final c = size.center(Offset.zero);
    const dashes = 28;
    const sweep = 2 * math.pi / dashes;
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), i * sweep, sweep * 0.55, false, paint);
    }
    final a = arc;
    if (a != null && a > 0 && arcColor != null) {
      // The real progress: a thin solid arc from twelve o'clock over the dashes.
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: r),
        -math.pi / 2,
        2 * math.pi * a.clamp(0.0, 1.0),
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4
          ..strokeCap = StrokeCap.round
          ..color = arcColor!,
      );
    }
  }

  @override
  bool shouldRepaint(_DashedRing old) => old.color != color || old.arc != arc || old.arcColor != arcColor;
}
