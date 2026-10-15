import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/animation.dart' show Curves;

import 'mobi_geometry.dart';
import 'mobi_palette.dart';
import 'mobi_rig.dart';
import 'mobi_rig_eval.dart';

/// The small per-frame pieces of Mobi: eyes, hands, the antenna, celebration bubbles and sleepy
/// z's. Each draws in design units on a canvas already placed by the painter.
abstract final class MobiDetails {
  static double _smooth(double e0, double e1, double x) {
    final t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    return t * t * (3 - 2 * t);
  }

  // Mobi paints every frame, so the per-frame pieces reuse one stroke paint, one fill paint and a
  // few paths instead of allocating them. A draw call copies what it needs, so reconfiguring a
  // paint or resetting a path after drawing never changes what was drawn.
  static final Paint _strokePaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;
  static final Paint _fillPaint = Paint();
  static final Path _pathA = Path();
  static final Path _pathB = Path();
  static final Path _pathC = Path();

  static Paint _stroke(Color color, double width) => _strokePaint
    ..shader = null
    ..color = color
    ..strokeWidth = width;

  static Paint _fill(Color color) => _fillPaint
    ..shader = null
    ..color = color;

  // A shader paints through the paint's colour alpha, so a shaded fill resets it to opaque.
  static Paint _shaded(Shader shader) => _fillPaint
    ..color = const Color(0xFF000000)
    ..shader = shader;

  // ---- Legibility (rig table `paint`) --------------------------------------------------------

  static final Map<String, Object?> _paint = MobiBook.instance.section('paint');
  static double _p(String group, String k) => ((_paint[group]! as Map<String, Object?>)[k]! as num).toDouble();
  static final double _fullAt = _p('legibility', 'fullAt');
  static final double _maxAt = _p('legibility', 'maxAt');
  static final double _eyeGrow = _p('legibility', 'eyeGrow');
  static final double _strokeGrow = _p('legibility', 'strokeGrow');
  static final double _travelShrink = _p('legibility', 'travelShrink');
  static final double _lidFrom = _p('lidFollow', 'from');
  static final double _lidK = _p('lidFollow', 'k');

  /// How much the small-size face boost applies at [px] logical pixels per design unit: 0 at a
  /// hero size, 1 at a 32 dp avatar.
  static double legibility(double px) => ((_fullAt - px) / (_fullAt - _maxAt)).clamp(0.0, 1.0);

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

  /// The eyes on the visor. [legible] (0 to 1, see [legibility]) grows them and thickens their
  /// strokes for small sizes. [glow] lights a soft screen glow behind them (Night only). The upper
  /// lids follow the gaze down, as real lids do.
  static void eyes(Canvas c, MobiRig rig, {double legible = 0, bool glow = false}) {
    c.save();
    c.clipRRect(MobiGeo.visorRect.deflate(1.2));
    final travel = 1 - _travelShrink * legible;
    final base = MobiGeo.visor + Offset(rig.lookX * MobiGeo.lookTravel.dx * travel, MobiGeo.eyeDrop + rig.lookY * MobiGeo.lookTravel.dy * travel);
    final follow = _lidK * (rig.lookY - _lidFrom).clamp(0.0, 1.0);
    MobiEye lidded(MobiEye e) => follow > e.lid && e.slant.abs() <= 0.01 ? e.copyWith(lid: follow) : e;
    final grow = 1 + _eyeGrow * legible;
    final stroke = 1 + _strokeGrow * legible;
    final l = base + const Offset(-MobiGeo.eyeSpread, 0);
    final r = base + const Offset(MobiGeo.eyeSpread, 0);
    if (glow) {
      _eyeGlow(c, l, rig.eyeL, grow);
      _eyeGlow(c, r, rig.eyeR, grow);
    }
    _eye(c, l, lidded(rig.eyeL), -1, grow, stroke);
    _eye(c, r, lidded(rig.eyeR), 1, grow, stroke);
    c.restore();
  }

  static final Map<int, Shader> _glows = {};

  static Shader _newGlow(int q) {
    final a = q / 255;
    return Gradient.radial(Offset.zero, 1, [
      MobiPalette.eye.withValues(alpha: a),
      MobiPalette.eye.withValues(alpha: a * 0.35),
      MobiPalette.eye.withValues(alpha: 0),
    ], const [0, 0.45, 1]);
  }

  /// A lit screen behind the eye on the dark visor glass: a faint glow, strongest when the eye
  /// is wide open, gone when it is shut or smiling.
  static void _eyeGlow(Canvas c, Offset center, MobiEye e, double grow) {
    // Only round, open eyes glow: a lid, a slope or a smile would leave the glow showing where
    // the eye is cut, like a grey brow.
    final shown = (e.open.clamp(0.0, 1.2) - 0.25).clamp(0.0, 1.0) *
        (1 - _smooth(0.0, 0.6, e.happy)) *
        (1 - _smooth(0.0, 0.12, e.lid)) *
        (1 - _smooth(0.0, 0.12, e.slant.abs())) *
        (1 - _smooth(0.05, 0.3, e.smile));
    if (shown <= 0.02) return;
    final q = (0.2 * shown * 255).round();
    if (q <= 0) return;
    final shader = cacheShaders ? _glows.putIfAbsent(q, () => _newGlow(q)) : _newGlow(q);
    c.save();
    c.translate(center.dx, center.dy);
    c.scale(MobiGeo.eyeSize.width * 1.35 * grow, MobiGeo.eyeSize.height * 0.85 * grow);
    c.drawCircle(Offset.zero, 1, _shaded(shader));
    c.restore();
  }

  static void _eye(Canvas c, Offset center, MobiEye e, double side, [double grow = 1, double stroke = 1]) {
    final w = MobiGeo.eyeSize.width * grow;
    final fullH = MobiGeo.eyeSize.height * grow;
    // The oval closes as the smiling arc comes in, like a blink into a smile, so the two shapes
    // never sit on top of each other half-faded.
    final arc = _smooth(0.4, 0.72, e.happy);
    final closing = 1 - 0.85 * _smooth(0.0, 0.5, e.happy);
    // Warm eyes (rig v2): the lower lid rises into the oval as a curve, so a smiling eye is
    // always one solid shape, from a hint of warmth to a full dome, and never a half-faded
    // ghost of two shapes. The eye widens a little as it smiles.
    final lift = _smooth(0.0, 0.7, e.smile);
    // A shut eye is a soft lid line curving down, not a slit: asleep, the peak of a blink, the
    // eyes before they blink on.
    final shut = 1 - _smooth(0.05, 0.22, e.open);
    final lidLine = shut * (1 - arc);
    if (lidLine > 0.01) {
      final y = center.dy + fullH * 0.16;
      final path = _pathA
        ..reset()
        ..moveTo(center.dx - w * 0.82, y - 0.6 * grow)
        ..quadraticBezierTo(center.dx, y + 4.6 * grow, center.dx + w * 0.82, y - 0.6 * grow);
      c.drawPath(path, _stroke(MobiPalette.eye.withValues(alpha: lidLine), 2.9 * stroke));
    }
    if (arc < 1 && shut < 1) {
      // A smiling eye is wider and a touch shorter: a content, solid dome.
      final h = math.max(2.4 * stroke, fullH * e.open.clamp(0.0, 1.2) * closing * (1 - 0.06 * lift));
      final rect = Rect.fromCenter(center: center + Offset(0, (fullH - h) * 0.18), width: w * (1 + 0.5 * lift), height: h);
      c.save();
      if (lift > 0.01) {
        // The warm lower lid: a curve rising in the middle, low at the corners.
        final edge = rect.bottom - lift * h * 0.08;
        final ctrl = rect.bottom - lift * h * 0.5;
        c.clipPath(_pathC
          ..reset()
          ..moveTo(rect.left - 3, rect.top - 3)
          ..lineTo(rect.right + 3, rect.top - 3)
          ..lineTo(rect.right + 3, edge)
          ..quadraticBezierTo(rect.center.dx, ctrl, rect.left - 3, edge)
          ..close());
      }
      if (e.lid > 0.01 && e.slant.abs() <= 0.01) {
        // A heavy lid that sags in the middle: drowsy, never cross.
        final y = rect.top + rect.height * e.lid.clamp(0.0, 0.92);
        final sag = rect.height * 0.22 * e.lid;
        c.clipPath(_pathB
          ..reset()
          ..moveTo(rect.left - 2, y - sag)
          ..quadraticBezierTo(rect.center.dx, y + sag, rect.right + 2, y - sag)
          ..lineTo(rect.right + 2, rect.bottom + 2)
          ..lineTo(rect.left - 2, rect.bottom + 2)
          ..close());
      } else if (e.slant.abs() > 0.01) {
        // A sloped lid (the mood's brow): lower at the outer corner, so the eye reads soft and
        // sympathetic. It stays gentle (at most about a third of the eye) so it is never sad.
        final s = e.slant.clamp(-1.0, 1.0);
        final base = rect.top + rect.height * e.lid.clamp(0.0, 0.92);
        final outer = base + rect.height * 0.34 * s;
        final inner = base - rect.height * 0.04 * s;
        final yLeft = side < 0 ? outer : inner;
        final yRight = side < 0 ? inner : outer;
        c.clipPath(_pathB
          ..reset()
          ..moveTo(rect.left - 2, yLeft)
          ..quadraticBezierTo(rect.center.dx, (yLeft + yRight) / 2 + rect.height * 0.05 * e.lid, rect.right + 2, yRight)
          ..lineTo(rect.right + 2, rect.bottom + 2)
          ..lineTo(rect.left - 2, rect.bottom + 2)
          ..close());
      }
      final alpha = (1 - arc) * (1 - shut);
      c.drawRRect(
        RRect.fromRectXY(rect, rect.width / 2, math.min(h / 2, fullH / 2)),
        _shaded(cacheShaders
            ? _eyeShader(rect, alpha)
            // The reference: a fresh shader every frame (what the cache must match).
            : Gradient.linear(rect.topCenter, rect.bottomCenter, [
                MobiPalette.eye.withValues(alpha: alpha),
                MobiPalette.eye.withValues(alpha: alpha),
                MobiPalette.eyeShade.withValues(alpha: alpha),
              ], const [0, 0.55, 1])),
      );
      // The catchlight: the lamp in the eye. Dropped at small sizes, where it is under a pixel
      // and only greys the eye.
      if (h > 6 && e.lid < 0.4 && e.slant < 0.5 && stroke < 1.3 && lift < 0.5) {
        c.drawOval(
          Rect.fromCenter(center: rect.topCenter + Offset(-w * 0.12, h * 0.24), width: w * 0.34, height: h * 0.16),
          _fill(const Color(0xFFFFFFFF).withValues(alpha: 0.9 * alpha)),
        );
      }
      c.restore();
    }
    if (arc > 0) {
      final path = _pathA
        ..reset()
        ..moveTo(center.dx - w * 0.82, center.dy + 3 * grow)
        ..quadraticBezierTo(center.dx, center.dy - 7.5 * grow, center.dx + w * 0.82, center.dy + 3 * grow);
      c.drawPath(path, _stroke(MobiPalette.eye.withValues(alpha: arc), 3.4 * stroke));
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
      if (!lite) {
        // The knuckle crease where the finger leaves the fist.
        c.drawLine(Offset(-2.1, 9.8 + 1.4 * point), Offset(2.1, 9.8 + 1.4 * point), _stroke(p.limbLo.withValues(alpha: 0.7 * point), 0.9));
      }
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
    final stem = _pathA
      ..reset()
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
    final lit = p.lit;
    if (glow > 0.01 && lit == null) {
      // The bulb lights up: a soft volt halo, a unit circle scaled so the shader is reused.
      final g = glow.clamp(0.0, 1.0);
      c.save();
      c.translate(tip.dx, tip.dy);
      c.scale(r * (2.2 + (p.night ? 3.4 : 4.0) * g));
      c.drawCircle(Offset.zero, 1, _shaded(_haloShader(g * (p.night ? 0.7 : 0.8), p.night)));
      c.restore();
    }
    // The bulb: a shader centred on the origin, reused every frame (the bulb is placed by a
    // translate, not by a new gradient).
    c.save();
    c.translate(tip.dx, tip.dy);
    c.drawCircle(Offset.zero, r, _shaded(cacheShaders ? _bulb : _newBulb()));
    c.restore();
    if (glow > 0.01) {
      final g = glow.clamp(0.0, 1.0);
      c.drawCircle(tip, r * 0.62, _fill(MobiPalette.limeHi.withValues(alpha: 0.85 * g)));
      // Daylight: no glow on paper. The lit bulb carries a crisp olive edge instead, a little
      // wider the brighter it is, so "lit" still reads on cream.
      if (lit != null) c.drawCircle(tip, r + 1.2 + 1.6 * g, _stroke(lit.withValues(alpha: g), 1));
    }
    c.drawCircle(tip + const Offset(-1.9, -2.1), 1.3, _fill(const Color(0xFFFFFFFF).withValues(alpha: 0.8)));
  }

  static final Shader _bulb = _newBulb();

  static Shader _newBulb() => Gradient.radial(const Offset(-1.8, -2), MobiGeo.antennaBall * 1.5, const [
        MobiPalette.limeHi,
        MobiPalette.lime,
        MobiPalette.limeLo,
      ], const [0, 0.5, 1]);

  static final Map<(bool, int), Shader> _halos = {};

  /// The bulb's halo on a unit circle: a pale volt glow. The Day palette draws no halo (it has a
  /// [MobiPalette.lit] edge instead); the Day shader is kept for a palette without one.
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
    _glows.clear();
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
      final path = _pathA
        ..reset()
        ..moveTo(o.dx - s / 2, o.dy - s / 2)
        ..lineTo(o.dx + s / 2, o.dy - s / 2)
        ..lineTo(o.dx - s / 2, o.dy + s / 2)
        ..lineTo(o.dx + s / 2, o.dy + s / 2);
      c.drawPath(path, _stroke(p.zzz.withValues(alpha: alpha), 2.4));
    }
  }
}
