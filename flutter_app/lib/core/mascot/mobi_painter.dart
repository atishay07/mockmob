import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';

import 'mobi_details.dart';
import 'mobi_geometry.dart';
import 'mobi_palette.dart';
import 'mobi_parts.dart';
import 'mobi_rig.dart';

/// Paints Mobi from a [MobiRig]. The rigid parts are cached pictures; per frame the painter only
/// places them and draws the limbs, eyes and antenna, so it repaints cheaply at 60 fps.
class MobiPainter extends CustomPainter {
  MobiPainter({required this.rig, required this.palette, this.shadow = true, this.lite = false, this.head = false})
      : super(repaint: rig);

  final ValueListenable<MobiRig> rig;
  final MobiPalette palette;

  /// Draw the contact shadow under the boots.
  final bool shadow;

  /// Lite detail for small sizes and lists: one stroke per limb and no rim lines (sub-pixel below
  /// about 72 dp anyway), fewer draw calls per frame.
  final bool lite;

  /// Paint only the head (the folded body, visor, eyes and antenna), framed to fill the box.
  final bool head;

  /// The part of the design box the head-only framing shows.
  static const Rect headFrame = Rect.fromLTRB(8, 1, 138, 150);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    if (head) {
      const f = headFrame;
      final scale = math.min(size.width / f.width, size.height / f.height);
      canvas.translate((size.width - f.width * scale) / 2 - f.left * scale, (size.height - f.height * scale) / 2 - f.top * scale);
      canvas.scale(scale);
    } else {
      final scale = size.height / MobiGeo.height;
      canvas.translate((size.width - MobiGeo.width * scale) / 2, 0);
      canvas.scale(scale);
    }
    paintRig(canvas, rig.value, palette, shadow: shadow, lite: lite, head: head);
    canvas.restore();
  }

  @override
  bool shouldRepaint(MobiPainter old) =>
      old.rig != rig || old.palette != palette || old.shadow != shadow || old.lite != lite || old.head != head;
}

/// Paints [r] in design units (a 140 by 168 box). [lite] drops sub-pixel detail for small sizes;
/// [head] paints only the body, face and antenna (no limbs, boots or shadow).
void paintRig(Canvas c, MobiRig r, MobiPalette p, {bool shadow = true, bool lite = false, bool head = false}) {
  final parts = MobiParts.of(p);
  final body = _BodyXf(r);
  final lift = math.max(0.0, -r.y);

  if (shadow && !head) _contactShadow(c, r, lift, p);

  if (!head) {
    MobiDetails.landRings(c, r.burst, Offset(71 + r.x * 0.6, MobiGeo.ground + 0.5), p);
    MobiDetails.burst(c, r.burst, body.map(const Offset(71, 86)), p);
  }

  // Behind the body: antenna, arms tucked behind, legs and boots.
  c.save();
  body.apply(c);
  MobiDetails.antenna(c, r.antenna, p, glow: r.glow, lite: lite);
  if (!head) {
    if (r.armL.front < 0.5) _arm(c, r.armL, -1, p, lite);
    if (r.armR.front < 0.5) _arm(c, r.armR, 1, p, lite);
  }
  c.restore();

  if (!head) {
    _leg(c, body.map(MobiGeo.hipL), MobiGeo.ankleL, r.bootL, -1, p, lite);
    _leg(c, body.map(MobiGeo.hipR), MobiGeo.ankleR, r.bootR, 1, p, lite);
    _boot(c, parts, MobiGeo.ankleL, r.bootL, -1);
    _boot(c, parts, MobiGeo.ankleR, r.bootR, 1);
  }

  // The body, face and anything held in front.
  c.save();
  body.apply(c);
  c.drawPicture(parts.body);
  // The glint is a reflection on the glass, so it sits under the (lit) eyes and never crosses them.
  MobiDetails.glint(c, r.glint, tilt: r.tilt);
  MobiDetails.eyes(c, r);
  c.drawPicture(parts.gloss);
  if (!head) {
    // Front arms; a held sheet sits over the mittens, as if held from behind.
    if (r.armL.front >= 0.5) _arm(c, r.armL, -1, p, lite);
    if (r.armR.front >= 0.5) _arm(c, r.armR, 1, p, lite);
    if (r.sheet > 0.01) {
      c.save();
      c.translate(71, 116 + (1 - r.sheet) * 8);
      c.rotate(-0.06);
      c.scale(1.3 * (0.6 + 0.4 * r.sheet));
      c.drawPicture(parts.sheet);
      c.restore();
    }
  }
  MobiDetails.sparkle(c, r.sparkle, p);
  MobiDetails.answerBubble(c, r.bubble, p);
  c.restore();

  MobiDetails.zzz(c, r.zzz, body.map(const Offset(30, 28)), p);
}

/// The body transform: offset, lean about the hips, squash and stretch about the hips.
class _BodyXf {
  _BodyXf(MobiRig r)
      : dx = r.x,
        dy = r.y,
        tilt = r.tilt,
        sx = 1 - r.squash * 0.7,
        sy = 1 + r.squash;

  final double dx;
  final double dy;
  final double tilt;
  final double sx;
  final double sy;

  void apply(Canvas c) {
    const pv = MobiGeo.pivot;
    c.translate(dx + pv.dx, dy + pv.dy);
    c.rotate(tilt);
    c.scale(sx, sy);
    c.translate(-pv.dx, -pv.dy + MobiGeo.bodyDrop);
  }

  Offset map(Offset o) {
    const pv = MobiGeo.pivot;
    final x = (o.dx - pv.dx) * sx;
    final y = (o.dy + MobiGeo.bodyDrop - pv.dy) * sy;
    final s = math.sin(tilt);
    final k = math.cos(tilt);
    return Offset(pv.dx + dx + x * k - y * s, pv.dy + dy + x * s + y * k);
  }
}

/// Per-frame paint objects Mobi reuses instead of allocating each frame: the limb strokes (per
/// palette colour and width) and the contact-shadow shader (per quantised alpha). Output is the
/// same as building them fresh; [enabled] turns the cache off for that comparison in tests.
abstract final class MobiPaintCache {
  /// Off only in tests that compare cached and fresh painting.
  static bool enabled = true;

  static final Map<(Color, double), Paint> _limbs = {};
  static final Map<(Color, int), Shader> _shadows = {};

  /// Alphas are quantised to 1/255, the precision of an 8-bit channel.
  static int quantise(double alpha) => (alpha.clamp(0.0, 1.0) * 255).round();

  static Paint limb(Color color, double width) {
    if (!enabled) return _newLimb(color, width);
    return _limbs.putIfAbsent((color, width), () => _newLimb(color, width));
  }

  static Paint _newLimb(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..color = color;

  /// The contact shadow's radial shader on a unit circle, for a palette shadow colour.
  static Shader shadow(Color color, double alpha) {
    final q = quantise(alpha);
    if (_shadows.length > 256) _shadows.clear();
    return _shadows.putIfAbsent((color, q), () => _newShadow(color, q));
  }

  static Shader _newShadow(Color color, int q) {
    final a = q / 255;
    return RadialGradient(colors: [
      color.withValues(alpha: a),
      color.withValues(alpha: a * 0.45),
      color.withValues(alpha: 0),
    ], stops: const [0, 0.5, 1])
        .createShader(Rect.fromCircle(center: Offset.zero, radius: 1));
  }

  /// Forgets everything (tests).
  static void clear() {
    _limbs.clear();
    _shadows.clear();
  }
}

Paint _limb(Color color, double width) => MobiPaintCache.limb(color, width);

/// A rubber hose with a lamp-lit edge: a lighter copy under the dark stroke, offset toward the
/// light, reads as a rounded tube without gradients along the curve.
void _hose(Canvas c, Path path, double width, MobiPalette p, [bool lite = false]) {
  if (lite) {
    c.drawPath(path, _limb(p.limb, width));
    return;
  }
  c.drawPath(path, _limb(p.limbLo, width));
  c.save();
  c.translate(-0.8, -0.8);
  c.drawPath(path, _limb(Color.lerp(p.limbHi, p.rim, p.night ? 0.3 : 0.08)!, width * 0.72));
  c.restore();
  c.save();
  c.translate(0.45, 0.45);
  c.drawPath(path, _limb(p.limb, width * 0.66));
  c.restore();
}

void _arm(Canvas c, MobiArm a, double side, MobiPalette p, bool lite) {
  final shoulder = side < 0 ? MobiGeo.shoulderL : MobiGeo.shoulderR;
  final dir = MobiGeo.armDir(a.angle, side);
  final len = MobiGeo.armLength * a.reach;
  final wrist = shoulder + dir * len;
  final outward = Offset(dir.dy * side, -dir.dx * side);
  final ctrl = (shoulder + wrist) / 2 + outward * a.bend * 9;
  final path = Path()
    ..moveTo(shoulder.dx, shoulder.dy)
    ..quadraticBezierTo(ctrl.dx, ctrl.dy, wrist.dx, wrist.dy);
  _hose(c, path, MobiGeo.armWidth, p, lite);

  final tangent = wrist - ctrl;
  final theta = math.atan2(-tangent.dx, tangent.dy) + a.twist * side;
  c.save();
  c.translate(wrist.dx, wrist.dy);
  c.rotate(theta);
  c.scale(side, 1);
  c.scale(MobiGeo.handScale);
  c.translate(0, -2.5);
  MobiDetails.hand(c, a.point, p, lite: lite);
  c.restore();
}

void _leg(Canvas c, Offset hip, Offset ankle, MobiBoot b, double side, MobiPalette p, bool lite) {
  final end = ankle + Offset(b.dx, b.dy);
  final mid = (hip + end) / 2 + Offset(side * 1.5, 0);
  final path = Path()
    ..moveTo(hip.dx, hip.dy)
    ..quadraticBezierTo(mid.dx, mid.dy, end.dx, end.dy + 2);
  _hose(c, path, MobiGeo.legWidth, p, lite);
}

void _boot(Canvas c, MobiParts parts, Offset ankle, MobiBoot b, double side) {
  c.save();
  c.translate(ankle.dx + b.dx, ankle.dy + b.dy);
  c.rotate(-b.rot * side);
  c.scale(side * MobiGeo.bootScale, MobiGeo.bootScale);
  c.drawPicture(parts.boot);
  c.restore();
}

void _contactShadow(Canvas c, MobiRig r, double lift, MobiPalette p) {
  final k = (1 - lift / 70).clamp(0.35, 1.0);
  final center = Offset(71 + r.x * 0.6, MobiGeo.ground + 0.5);
  // A wide soft pool, and under it a tighter, firmer contact core where the boots meet the floor
  // (a single faint ellipse reads as a smudge, not as weight). Together they reach the palette's
  // [MobiPalette.shadowAlpha] under the boots and no more.
  final peak = p.shadowAlpha;
  final pool = peak / 2;
  final core = 1 - (1 - peak) / (1 - pool);
  _shadowEllipse(c, center, 104 * k, 12 * k, pool * k, p);
  _shadowEllipse(c, center, 66 * k, 6.5 * k, core * k, p);
}

void _shadowEllipse(Canvas c, Offset center, double width, double height, double alpha, MobiPalette p) {
  if (!MobiPaintCache.enabled) {
    // The reference: a fresh shader every frame (what the cache must match).
    c.save();
    c.translate(center.dx, center.dy);
    c.scale(1, height / width);
    c.drawCircle(
      Offset.zero,
      width / 2,
      Paint()
        ..shader = RadialGradient(colors: [
          p.shadow.withValues(alpha: alpha),
          p.shadow.withValues(alpha: alpha * 0.45),
          p.shadow.withValues(alpha: 0),
        ], stops: const [0, 0.5, 1])
            .createShader(Rect.fromCircle(center: Offset.zero, radius: width / 2)),
    );
    c.restore();
    return;
  }
  // A unit circle scaled to the ellipse, so the shader depends only on the alpha.
  c.save();
  c.translate(center.dx, center.dy);
  c.scale(width / 2, height / 2);
  c.drawCircle(Offset.zero, 1, Paint()..shader = MobiPaintCache.shadow(p.shadow, alpha));
  c.restore();
}
