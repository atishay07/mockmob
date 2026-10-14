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
    // Warm eyes: the oval gives way to a filled dome (flat-ish base, a soft rise in the lower
    // lid, blunt rounded ends), so it reads as a content, solid shape and not as the thin
    // smiling arc of a happy eye.
    final cres = (1 - arc) * _smooth(0.3, 0.5, e.smile);
    if (cres > 0) {
      final k = e.open.clamp(0.0, 1.2);
      final rx = w * 0.74;
      final ry = fullH * 0.5 * k + 0.6;
      final foot = center.dy + 3.4;
      final path = Path()
        ..moveTo(center.dx - rx, foot)
        ..arcToPoint(Offset(center.dx + rx, foot), radius: Radius.elliptical(rx, math.max(ry, 0.1)))
        ..quadraticBezierTo(center.dx, foot - ry * 0.46, center.dx - rx, foot)
        ..close();
      final ink = MobiPalette.eye.withValues(alpha: cres);
      c.drawPath(path, Paint()..color = ink);
      // Round the corners: thick, blunt ends.
      c.drawPath(path, _stroke(ink, 2.2));
    }
    // A shut eye is a soft lid line curving down, not a slit: asleep, the peak of a blink, the
    // eyes before they blink on.
    final shut = 1 - _smooth(0.05, 0.22, e.open);
    final lidLine = shut * (1 - arc) * (1 - cres);
    if (lidLine > 0.01) {
      final y = center.dy + fullH * 0.16;
      final path = Path()
        ..moveTo(center.dx - w * 0.82, y - 0.6)
        ..quadraticBezierTo(center.dx, y + 4.6, center.dx + w * 0.82, y - 0.6);
      c.drawPath(path, _stroke(MobiPalette.eye.withValues(alpha: lidLine), 2.9));
    }
    if (arc < 1 && cres < 1 && shut < 1) {
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
      final alpha = (1 - arc) * (1 - cres / (1 - arc).clamp(0.001, 1.0)) * (1 - shut);
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
      final len = 9 * point;
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
      c.scale(r * (2.2 + (p.night ? 3.4 : 4.0) * g));
      c.drawCircle(Offset.zero, 1, Paint()..shader = _haloShader(g * (p.night ? 0.7 : 0.8), p.night));
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

  static final Map<(bool, int), Shader> _halos = {};

  /// The bulb's halo on a unit circle. At Night it is a pale volt glow; on the cream Day ground
  /// pale volt vanishes, so the halo is a deeper, warmer volt that still reads as light.
  static Shader _newHalo(bool night, int q) {
    final a = q / 255;
    final inner = night ? MobiPalette.limeHi : MobiPalette.limeLight;
    final mid = night ? MobiPalette.lime : MobiPalette.limeMid;
    return Gradient.radial(Offset.zero, 1, [
      inner.withValues(alpha: a),
      mid.withValues(alpha: a * (night ? 0.35 : 0.5)),
      mid.withValues(alpha: 0),
    ], const [0, 0.45, 1]);
  }

  static Shader _haloShader(double alpha, bool night) {
    final q = (alpha.clamp(0.0, 1.0) * 255).round();
    if (!cacheShaders) return _newHalo(night, q);
    return _halos.putIfAbsent((night, q), () => _newHalo(night, q));
  }

  // ---- Visor glint -------------------------------------------------------------------------

  /// A soft band of lamp light sweeping across the visor glass, left to right, at [progress] 0 to
  /// 1. It is a reflection, so it fades in and out at its edges (no hard line), is painted under
  /// the eyes (the eyes are lit, they are never crossed by it) and is stronger the more the head
  /// [tilt]s toward the lamp.
  static void glint(Canvas c, double progress, {double tilt = 0}) {
    if (progress < 0 || progress > 1) return;
    final rect = MobiGeo.visorRect.outerRect;
    final x = rect.left - 22 + (rect.width + 44) * Curves.easeInOut.transform(progress);
    final lean = 0.5 + 0.5 * (tilt.abs() / 0.06).clamp(0.0, 1.0);
    final a = math.sin(math.pi * progress) * lean;
    c.save();
    c.clipRRect(MobiGeo.visorRect.deflate(0.8));
    void band(double x0, double w, double alpha) {
      final path = Path()
        ..moveTo(x0 + 7, rect.top)
        ..lineTo(x0 + 7 + w, rect.top)
        ..lineTo(x0 - 7 + w, rect.bottom)
        ..lineTo(x0 - 7, rect.bottom)
        ..close();
      const white = Color(0xFFFFFFFF);
      c.drawPath(
        path,
        Paint()
          ..shader = Gradient.linear(Offset(x0 - 7, 0), Offset(x0 + 7 + w, 0), [
            white.withValues(alpha: 0),
            white.withValues(alpha: alpha),
            white.withValues(alpha: 0),
          ], const [0, 0.5, 1]),
      );
    }

    band(x, 16, 0.14 * a);
    band(x + 14, 6, 0.1 * a);
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

  /// Where the answer bubble sits, in design units: its centre, beside the head, right of the
  /// antenna (it reaches the right edge of the design box, a little above the shoulder).
  static const Offset bubbleAt = Offset(122, 33);

  /// Radius of the bubble body in design units (about 40 dp across at the usual 160 dp Mobi).
  static const double bubbleRadius = 13;

  /// A real answer bubble beside the head: a bright volt disc with a tail toward Mobi, inked in,
  /// and an ink tick that draws itself. It pops in from a smaller disc (scale 0.3 to 1 with a
  /// small overshoot), holds, then shrinks away and lifts. The disc is solid volt for its whole
  /// life, only fading in the last few frames: a half-faded volt disc over charcoal turns olive,
  /// so it leaves by scale, not by a slow fade. [progress] 0 to 1.
  static void answerBubble(Canvas c, double progress, MobiPalette p) {
    if (progress < 0 || progress > 1) return;
    const r = bubbleRadius;
    final inT = _smooth(0, 0.045, progress);
    final popT = _smooth(0, 0.18, progress);
    final outT = _smooth(0.8, 1, progress);
    final alpha = (inT * (1 - _smooth(0.94, 1, progress))).clamp(0.0, 1.0);
    if (alpha <= 0.01) return;
    final lift = 9 * outT;
    final scale = (0.3 + 0.7 * Curves.easeOutBack.transform(popT)) * (1 - Curves.easeInCubic.transform(outT) * 0.9);
    final tick = _smooth(0.1, 0.3, progress);
    const ink = Color(0xFF17150F);

    c.save();
    c.translate(bubbleAt.dx, bubbleAt.dy - lift);
    c.scale(scale);

    // The disc and its tail (pointing down and left, toward the head), one shape.
    final tail = Path()
      ..moveTo(-r * 0.62, r * 0.62)
      ..quadraticBezierTo(-r * 0.92, r * 1.2, -r * 1.55, r * 1.42)
      ..quadraticBezierTo(-r * 0.78, r * 1.46, -r * 0.18, r * 0.98)
      ..close();
    final shape = Path.combine(PathOperation.union, Path()..addOval(Rect.fromCircle(center: Offset.zero, radius: r)), tail);
    c.drawPath(
      shape,
      Paint()
        ..shader = Gradient.radial(Offset(-r * 0.3, -r * 0.35), r * 1.7, [
          MobiPalette.limeLight.withValues(alpha: alpha),
          MobiPalette.lime.withValues(alpha: alpha),
          MobiPalette.lime.withValues(alpha: alpha),
        ], const [0, 0.45, 1]),
    );
    c.drawPath(shape, _stroke((p.night ? MobiPalette.limeLight : ink).withValues(alpha: alpha), p.night ? 1.0 : 1.6));
    c.drawCircle(Offset(-r * 0.4, -r * 0.42), r * 0.18, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.7 * alpha));

    // The tick, drawn from its short stroke to its long one.
    if (tick > 0) {
      final pts = [Offset(-r * 0.42, r * 0.04), Offset(-r * 0.1, r * 0.38), Offset(r * 0.46, -r * 0.34)];
      final first = (pts[1] - pts[0]).distance;
      final second = (pts[2] - pts[1]).distance;
      final len = tick * (first + second);
      final path = Path()..moveTo(pts[0].dx, pts[0].dy);
      if (len <= first) {
        final q = Offset.lerp(pts[0], pts[1], len / first)!;
        path.lineTo(q.dx, q.dy);
      } else {
        final q = Offset.lerp(pts[1], pts[2], (len - first) / second)!;
        path.lineTo(pts[1].dx, pts[1].dy);
        path.lineTo(q.dx, q.dy);
      }
      c.drawPath(path, _stroke(ink.withValues(alpha: alpha), 2.8));
    }
    c.restore();
  }

  // ---- Celebration bubbles -----------------------------------------------------------------

  /// Confetti: angle from the body centre (screen angles, up is negative), how far it flies, and
  /// its radius. All of it lands outside the head (at least 74 units out), and none of it flies
  /// along the antenna (up and to the right, about -1.17 rad), so the face and the bulb stay clear.
  static const List<(double angle, double dist, double radius)> _bubbles = [
    (-2.85, 76, 4.6),
    (-2.45, 90, 4.0),
    (-2.05, 74, 5.8),
    (-1.68, 94, 4.2),
    (-0.72, 78, 5.6),
    (-0.42, 92, 4.2),
    (-3.05, 88, 3.8),
    (-0.12, 84, 4.0),
  ];

  /// Volt confetti bursting out behind Mobi at [progress] 0 to 1 from [origin]. Each piece is a
  /// bubble that grows, flies and ends in a solid shockwave ring that widens and fades. On the
  /// cream Day ground the pieces carry a dark olive rim so they hold their shape.
  static void burst(Canvas c, double progress, Offset origin, MobiPalette p) {
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
        c.drawCircle(
          pos,
          r,
          Paint()
            ..shader = Gradient.radial(pos + Offset(-r * 0.3, -r * 0.3), r * 1.6, [
              MobiPalette.limeHi,
              MobiPalette.lime,
              p.night ? MobiPalette.limeLo : MobiPalette.limeMid,
            ], const [0, 0.5, 1]),
        );
        c.drawCircle(pos, r, _stroke(p.night ? MobiPalette.limeDeep : MobiPalette.limeShade, p.night ? 0.9 : 1.3));
        c.drawCircle(pos + Offset(-r * 0.32, -r * 0.32), r * 0.28, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.75));
      } else {
        // The pop: a solid ring that widens and thins as it fades. No loose dots.
        final pop = (q - 0.74) / 0.26;
        final fade = math.pow(1 - pop, 0.7).toDouble();
        final ringR = radius * (1 + pop * 1.4);
        if (!p.night) c.drawCircle(pos, ringR, _stroke(MobiPalette.limeShade.withValues(alpha: 0.6 * fade), 2.6 * fade + 0.9));
        c.drawCircle(pos, ringR, _stroke((p.night ? MobiPalette.limeHi : MobiPalette.lime).withValues(alpha: fade), 1.9 * fade + 0.4));
      }
    }
  }

  /// The shockwaves a landing sends along the floor (celebrate's two landings), drawn flat on
  /// the ground at [center] from the burst's [progress]: solid volt rings that widen and fade.
  static void landRings(Canvas c, double progress, Offset center, MobiPalette p) {
    if (progress < 0) return;
    for (final (start, length, scale) in const [(0.40, 0.4, 1.0), (0.69, 0.3, 0.55)]) {
      final q = (progress - start) / length;
      if (q <= 0 || q >= 1) continue;
      final out = 1 - math.pow(1 - q, 3).toDouble();
      final fade = math.pow(1 - q, 1.4).toDouble();
      final rx = (20 + 44 * out) * scale;
      final rect = Rect.fromCenter(center: center, width: rx * 2, height: rx * 2 * 0.16);
      final width = (2.8 * fade + 0.5) * (0.6 + 0.4 * scale);
      if (!p.night) c.drawOval(rect, _stroke(MobiPalette.limeShade.withValues(alpha: 0.55 * fade), width + 1.1));
      c.drawOval(rect, _stroke((p.night ? MobiPalette.limeHi : MobiPalette.lime).withValues(alpha: 0.95 * fade), width));
    }
  }

  // ---- Sleepy z's --------------------------------------------------------------------------

  /// Forgets cached shaders (tests).
  static void clearCache() {
    _eyeShaders.clear();
    _handFills.clear();
    _halos.clear();
  }

  /// The sleepy z's, rising from [from] (the top left of the head).
  static void zzz(Canvas c, double progress, Offset from, MobiPalette p) {
    if (progress < 0) return;
    for (var i = 0; i < 2; i++) {
      final q = (progress + i * 0.5) % 1;
      final alpha = math.min(1.0, math.sin(math.pi * q) * 1.5);
      final s = 7 + 4.5 * q + 1.5 * i;
      // Drifting up and away to the left of the head, where the antenna and its bulb never are
      // (the antenna leans right when sleepy, and a z on the right ran into the bulb).
      final o = from + Offset(-8 * q - i * 4, -24 * q);
      final path = Path()
        ..moveTo(o.dx - s / 2, o.dy - s / 2)
        ..lineTo(o.dx + s / 2, o.dy - s / 2)
        ..lineTo(o.dx - s / 2, o.dy + s / 2)
        ..lineTo(o.dx + s / 2, o.dy + s / 2);
      c.drawPath(path, _stroke(p.zzz.withValues(alpha: alpha), 2.4));
    }
  }
}
