import 'dart:math' as math;
import 'dart:ui';

import 'mobi_geometry.dart';
import 'mobi_palette.dart';
import 'mobi_rig.dart';

/// The small per-frame pieces of Mobi: eyes, hands, the antenna, celebration bubbles and sleepy
/// z's. Each draws in design units on a canvas already placed by the painter.
abstract final class MobiDetails {
  static double _smooth(double e0, double e1, double x) {
    final t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    return t * t * (3 - 2 * t);
  }

  static Paint _stroke(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..color = color;

  // ---- Eyes --------------------------------------------------------------------------------

  static void eyes(Canvas c, MobiRig rig) {
    c.save();
    c.clipRRect(MobiGeo.visorRect.deflate(1.2));
    final base = MobiGeo.visor + Offset(rig.lookX * MobiGeo.lookTravel.dx, MobiGeo.eyeDrop + rig.lookY * MobiGeo.lookTravel.dy);
    _eye(c, base + const Offset(-MobiGeo.eyeSpread, 0), rig.eyeL);
    _eye(c, base + const Offset(MobiGeo.eyeSpread, 0), rig.eyeR);
    c.restore();
  }

  static void _eye(Canvas c, Offset center, MobiEye e) {
    final w = MobiGeo.eyeSize.width;
    final fullH = MobiGeo.eyeSize.height;
    final arc = _smooth(0.3, 0.7, e.happy);
    if (arc < 1) {
      final h = math.max(2.4, fullH * e.open.clamp(0.0, 1.2) * (1 - 0.25 * e.happy));
      final rect = Rect.fromCenter(center: center + Offset(0, (fullH - h) * 0.18), width: w, height: h);
      c.save();
      if (e.lid > 0.01) {
        // A heavy lid that sags in the middle: drowsy, never cross.
        final y = rect.top + rect.height * e.lid.clamp(0.0, 0.92);
        final sag = rect.height * 0.22 * e.lid;
        c.clipPath(Path()
          ..moveTo(rect.left - 2, y - sag)
          ..quadraticBezierTo(rect.center.dx, y + sag, rect.right + 2, y - sag)
          ..lineTo(rect.right + 2, rect.bottom + 2)
          ..lineTo(rect.left - 2, rect.bottom + 2)
          ..close());
      }
      final alpha = 1 - arc;
      c.drawRRect(
        RRect.fromRectXY(rect, w / 2, math.min(h / 2, fullH / 2)),
        Paint()
          ..shader = Gradient.linear(rect.topCenter, rect.bottomCenter, [
            MobiPalette.eye.withValues(alpha: alpha),
            MobiPalette.eye.withValues(alpha: alpha),
            MobiPalette.eyeShade.withValues(alpha: alpha),
          ], const [0, 0.55, 1]),
      );
      if (h > 6 && e.lid < 0.4) {
        c.drawOval(
          Rect.fromCenter(center: rect.topCenter + Offset(-w * 0.12, h * 0.24), width: w * 0.34, height: h * 0.16),
          Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.9 * alpha),
        );
      }
      c.restore();
    }
    if (arc > 0) {
      final path = Path()
        ..moveTo(center.dx - w * 0.82, center.dy + 3)
        ..quadraticBezierTo(center.dx, center.dy - 7.5, center.dx + w * 0.82, center.dy + 3);
      c.drawPath(path, _stroke(MobiPalette.eye.withValues(alpha: arc), 3.4));
    }
  }

  // ---- Hands -------------------------------------------------------------------------------

  /// A hand with its wrist at the origin pointing toward +y, thumb toward -x. [point] morphs the
  /// mitten into a fist with the index finger out.
  static void hand(Canvas c, double point, MobiPalette p) {
    final fill = Paint()
      ..shader = Gradient.radial(const Offset(-2.5, 5), 14, [p.limbHi, p.limb, p.limbLo], const [0, 0.5, 1]);
    final rx = 7.8 - 1.2 * point;
    final ry = 8.8 - 2 * point;
    final palm = Rect.fromCenter(center: Offset(0, 8.6 - 1.4 * point), width: rx * 2, height: ry * 2);
    if (point > 0.02) {
      final len = 13.5 * point;
      final finger = RRect.fromLTRBR(-2.5, 9, 2.5, 9 + len, const Radius.circular(2.5));
      c.drawRRect(finger, fill);
      c.drawRRect(finger.deflate(0.4), _stroke(p.rim.withValues(alpha: p.rimAlpha * 0.6), 0.8));
    }
    c.drawOval(palm, fill);
    c.save();
    c.translate(-6.6 + 0.8 * point, 5.2);
    c.rotate(0.55);
    c.drawOval(Rect.fromCenter(center: Offset.zero, width: 6.8, height: 9.6 - 2 * point), fill);
    c.restore();
    c.drawArc(palm.deflate(0.9), math.pi * 1.0, math.pi * 0.55, false, _stroke(p.rim.withValues(alpha: p.rimAlpha * 0.8), 0.8));
  }

  // ---- Antenna -----------------------------------------------------------------------------

  static void antenna(Canvas c, double sway, MobiPalette p) {
    const base = MobiGeo.antennaBase;
    Offset rot(Offset o, double a) {
      final d = o - base;
      final s = math.sin(a);
      final k = math.cos(a);
      return base + Offset(d.dx * k - d.dy * s, d.dx * s + d.dy * k);
    }

    final tip = rot(MobiGeo.antennaTip, sway);
    final c1 = rot(const Offset(88, 26), sway * 0.35);
    final c2 = rot(const Offset(92, 9), sway * 0.75);
    final stem = Path()
      ..moveTo(base.dx, base.dy)
      ..cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, tip.dx, tip.dy);
    c.drawPath(stem, _stroke(p.limb, 4.4));
    c.save();
    c.translate(-0.7, -0.4);
    c.drawPath(stem, _stroke(p.rim.withValues(alpha: p.rimAlpha * 0.7), 1));
    c.restore();

    const r = MobiGeo.antennaBall;
    c.drawCircle(
      tip,
      r,
      Paint()
        ..shader = Gradient.radial(tip + const Offset(-1.8, -2), r * 1.5, const [
          MobiPalette.limeHi,
          MobiPalette.lime,
          MobiPalette.limeLo,
        ], const [0, 0.5, 1]),
    );
    c.drawCircle(tip + const Offset(-1.9, -2.1), 1.3, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.8));
  }

  // ---- Celebration bubbles -----------------------------------------------------------------

  static const List<(double angle, double dist, double radius)> _bubbles = [
    (-2.55, 70, 5.4),
    (-2.05, 82, 4.2),
    (-1.7, 66, 6.2),
    (-1.35, 86, 4.6),
    (-0.95, 72, 5.8),
    (-0.6, 64, 4.4),
    (-2.9, 52, 3.8),
    (-0.25, 50, 4),
  ];

  static void burst(Canvas c, double progress, Offset origin) {
    if (progress < 0) return;
    for (var i = 0; i < _bubbles.length; i++) {
      final (angle, dist, radius) = _bubbles[i];
      final q = ((progress - i * 0.045) / 0.62).clamp(0.0, 1.0);
      if (q <= 0 || q >= 1) continue;
      final travel = 1 - math.pow(1 - math.min(q / 0.7, 1), 3);
      final pos = origin + Offset(math.cos(angle), math.sin(angle)) * dist * travel.toDouble();
      if (q < 0.74) {
        final grow = _smooth(0, 0.2, q);
        final r = radius * (0.4 + 0.6 * grow);
        c.drawCircle(pos, r, Paint()..color = MobiPalette.lime);
        c.drawCircle(pos, r, _stroke(MobiPalette.limeDeep, 0.9));
        c.drawCircle(pos + Offset(-r * 0.32, -r * 0.32), r * 0.28, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.75));
      } else {
        final pop = (q - 0.74) / 0.26;
        final fade = 1 - pop;
        c.drawCircle(pos, radius * (1 + pop * 0.9), _stroke(MobiPalette.lime.withValues(alpha: fade), 1.6 * fade + 0.3));
        for (var k = 0; k < 4; k++) {
          final a = angle + k * math.pi / 2 + 0.4;
          final d = radius * (1.2 + pop * 1.4);
          c.drawCircle(pos + Offset(math.cos(a), math.sin(a)) * d, 1.3 * fade, Paint()..color = MobiPalette.lime.withValues(alpha: fade));
        }
      }
    }
  }

  // ---- Sleepy z's --------------------------------------------------------------------------

  static void zzz(Canvas c, double progress, Offset from, MobiPalette p) {
    if (progress < 0) return;
    for (var i = 0; i < 2; i++) {
      final q = (progress + i * 0.5) % 1;
      final alpha = math.sin(math.pi * q) * 0.85;
      final s = 4.6 + 3 * q + i;
      final o = from + Offset(8 * q + i * 3, -24 * q);
      final path = Path()
        ..moveTo(o.dx - s / 2, o.dy - s / 2)
        ..lineTo(o.dx + s / 2, o.dy - s / 2)
        ..lineTo(o.dx - s / 2, o.dy + s / 2)
        ..lineTo(o.dx + s / 2, o.dy + s / 2);
      c.drawPath(path, _stroke(p.zzz.withValues(alpha: alpha), 1.7));
    }
  }
}
