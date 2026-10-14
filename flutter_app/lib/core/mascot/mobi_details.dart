import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/animation.dart' show Curves;

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

  /// Eye shaders by the eye's rect and quantised alpha; an idle Mobi (eyes still between blinks
  /// and glances) reuses the same two every frame.
  static final Map<(Rect, int), Shader> _eyeShaders = {};

  /// Off only in tests that compare cached and fresh painting.
  static bool cacheShaders = true;

  static Shader _eyeShader(Rect rect, double alpha) {
    final q = (alpha.clamp(0.0, 1.0) * 255).round();
    if (_eyeShaders.length > 64) _eyeShaders.clear();
    return _eyeShaders.putIfAbsent((rect, q), () {
      final a = q / 255;
      return Gradient.linear(rect.topCenter, rect.bottomCenter, [
        MobiPalette.eye.withValues(alpha: a),
        MobiPalette.eye.withValues(alpha: a),
        MobiPalette.eyeShade.withValues(alpha: a),
      ], const [0, 0.55, 1]);
    });
  }

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
    // The oval closes as the smiling arc comes in, like a blink into a smile, so the two shapes
    // never sit on top of each other half-faded.
    final arc = _smooth(0.4, 0.72, e.happy);
    final closing = 1 - 0.85 * math.max(_smooth(0.0, 0.5, e.happy), _smooth(0.15, 0.45, e.smile));
    // Warm eyes: the oval gives way to a soft, full crescent (a smile that is not a squeeze).
    final cres = (1 - arc) * _smooth(0.3, 0.5, e.smile);
    if (cres > 0) {
      final k = e.open.clamp(0.0, 1.2);
      final top = center.dy - 1 - 12.5 * k;
      final foot = center.dy + 3.2;
      final inner = center.dy + 0.6 - 4.8 * k;
      final path = Path()
        ..moveTo(center.dx - w * 0.9, foot)
        ..quadraticBezierTo(center.dx, top, center.dx + w * 0.9, foot)
        ..quadraticBezierTo(center.dx, inner, center.dx - w * 0.9, foot)
        ..close();
      c.drawPath(path, Paint()..color = MobiPalette.eye.withValues(alpha: cres));
    }
    if (arc < 1 && cres < 1) {
      final h = math.max(2.4, fullH * e.open.clamp(0.0, 1.2) * closing);
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
      final alpha = (1 - arc) * (1 - cres / (1 - arc).clamp(0.001, 1.0));
      c.drawRRect(
        RRect.fromRectXY(rect, w / 2, math.min(h / 2, fullH / 2)),
        Paint()
          ..shader = cacheShaders
              ? _eyeShader(rect, alpha)
              // The reference: a fresh shader every frame (what the cache must match).
              : Gradient.linear(rect.topCenter, rect.bottomCenter, [
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
  static final Map<bool, Paint> _handFills = {};

  static Paint _newHandFill(MobiPalette p) =>
      Paint()..shader = Gradient.radial(const Offset(-2.5, 5), 14, [p.limbHi, p.limb, p.limbLo], const [0, 0.5, 1]);

  static void hand(Canvas c, double point, MobiPalette p, {bool lite = false}) {
    final fill = cacheShaders ? _handFills.putIfAbsent(p.night, () => _newHandFill(p)) : _newHandFill(p);
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
    if (!lite) c.drawArc(palm.deflate(0.9), math.pi * 1.0, math.pi * 0.55, false, _stroke(p.rim.withValues(alpha: p.rimAlpha * 0.8), 0.8));
  }

  // ---- Antenna -----------------------------------------------------------------------------

  static void antenna(Canvas c, double sway, MobiPalette p, {double glow = 0, bool lite = false}) {
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
    if (!lite) {
      c.save();
      c.translate(-0.7, -0.4);
      c.drawPath(stem, _stroke(p.rim.withValues(alpha: p.rimAlpha * 0.7), 1));
      c.restore();
    }

    const r = MobiGeo.antennaBall;
    if (glow > 0.01) {
      // The bulb lights up: a soft volt halo, a unit circle scaled so the shader is reused.
      final g = glow.clamp(0.0, 1.0);
      c.save();
      c.translate(tip.dx, tip.dy);
      c.scale(r * (2.4 + 1.6 * g));
      c.drawCircle(Offset.zero, 1, Paint()..shader = _haloShader(g * (p.night ? 0.55 : 0.4)));
      c.restore();
    }
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
    if (glow > 0.01) {
      c.drawCircle(tip, r * 0.62, Paint()..color = MobiPalette.limeHi.withValues(alpha: 0.85 * glow.clamp(0.0, 1.0)));
    }
    c.drawCircle(tip + const Offset(-1.9, -2.1), 1.3, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.8));
  }

  static final Map<int, Shader> _halos = {};

  static Shader _newHalo(int q) {
    final a = q / 255;
    return Gradient.radial(Offset.zero, 1, [
      MobiPalette.limeHi.withValues(alpha: a),
      MobiPalette.lime.withValues(alpha: a * 0.35),
      MobiPalette.lime.withValues(alpha: 0),
    ], const [0, 0.45, 1]);
  }

  static Shader _haloShader(double alpha) {
    final q = (alpha.clamp(0.0, 1.0) * 255).round();
    if (!cacheShaders) return _newHalo(q);
    return _halos.putIfAbsent(q, () => _newHalo(q));
  }

  // ---- Visor glint -------------------------------------------------------------------------

  /// A band of lamp light sweeping across the visor, left to right, at [progress] 0 to 1.
  static void glint(Canvas c, double progress) {
    if (progress < 0 || progress > 1) return;
    final rect = MobiGeo.visorRect.outerRect;
    final x = rect.left - 18 + (rect.width + 36) * Curves.easeInOut.transform(progress);
    final a = math.sin(math.pi * progress);
    c.save();
    c.clipRRect(MobiGeo.visorRect.deflate(0.8));
    Path band(double x0, double w) => Path()
      ..moveTo(x0 + 7, rect.top)
      ..lineTo(x0 + 7 + w, rect.top)
      ..lineTo(x0 - 7 + w, rect.bottom)
      ..lineTo(x0 - 7, rect.bottom)
      ..close();
    c.drawPath(band(x, 9), Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.16 * a));
    c.drawPath(band(x + 12, 3.5), Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.22 * a));
    c.restore();
  }

  // ---- Proud glints ------------------------------------------------------------------------

  static const List<(Offset, double, double)> _sparks = [
    (Offset(20, 40), 7, 0),
    (Offset(134, 44), 9, 0.12),
    (Offset(124, 4), 5.5, 0.24),
    (Offset(8, 78), 5, 0.34),
  ];

  /// Four-point glints twinkling around the head at [progress] 0 to 1.
  static void sparkle(Canvas c, double progress, MobiPalette p) {
    if (progress < 0) return;
    for (final (at, size, delay) in _sparks) {
      final q = ((progress - delay) / 0.62).clamp(0.0, 1.0);
      if (q <= 0 || q >= 1) continue;
      final s = size * math.sin(math.pi * q);
      c.save();
      c.translate(at.dx, at.dy);
      c.rotate(0.6 * q);
      final star = Path()
        ..moveTo(0, -s)
        ..quadraticBezierTo(0, 0, s, 0)
        ..quadraticBezierTo(0, 0, 0, s)
        ..quadraticBezierTo(0, 0, -s, 0)
        ..quadraticBezierTo(0, 0, 0, -s)
        ..close();
      c.drawPath(star, Paint()..color = p.night ? MobiPalette.limeHi : MobiPalette.lime);
      if (!p.night) c.drawPath(star, _stroke(MobiPalette.limeDeep, 0.7));
      c.restore();
    }
  }

  // ---- The answer bubble (a right answer) --------------------------------------------------

  /// Where the answer bubble inks, in design units (beside the head, right of the antenna).
  static const Offset bubbleAt = Offset(130, 36);

  /// An answer-sheet bubble beside the head: the ring draws, the volt fill inks from the centre,
  /// it holds, then lifts and pops. [progress] 0 to 1.
  static void answerBubble(Canvas c, double progress, MobiPalette p) {
    if (progress < 0 || progress > 1) return;
    const r = 8.5;
    final lift = 10 * _smooth(0.72, 1, progress);
    final o = bubbleAt + Offset(0, -lift);
    final ring = _smooth(0, 0.22, progress);
    final ink = _smooth(0.18, 0.46, progress);
    final pop = _smooth(0.84, 1, progress);
    final fade = 1 - pop;
    final scale = 0.7 + 0.3 * Curves.easeOutBack.transform(ring) + 0.5 * pop;
    final edge = p.night ? const Color(0xFFF4F0E6) : const Color(0xFF17150F);
    c.save();
    c.translate(o.dx, o.dy);
    c.scale(scale);
    if (ink > 0) {
      c.drawCircle(Offset.zero, r * ink, Paint()..color = MobiPalette.lime.withValues(alpha: fade));
      c.drawCircle(Offset(-r * 0.32, -r * 0.34), r * 0.24 * ink, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.7 * fade));
    }
    if (ring > 0) {
      c.drawArc(
        Rect.fromCircle(center: Offset.zero, radius: r),
        -math.pi / 2,
        2 * math.pi * ring,
        false,
        _stroke((ink > 0.5 ? MobiPalette.limeDeep : edge).withValues(alpha: (0.85 * fade).clamp(0.0, 1.0)), 1.6),
      );
    }
    c.restore();
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

  /// Forgets cached shaders (tests).
  static void clearCache() {
    _eyeShaders.clear();
    _handFills.clear();
    _halos.clear();
  }

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
