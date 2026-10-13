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
  MobiPainter({required this.rig, required this.palette, this.shadow = true}) : super(repaint: rig);

  final ValueListenable<MobiRig> rig;
  final MobiPalette palette;

  /// Draw the contact shadow under the boots.
  final bool shadow;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.height / MobiGeo.height;
    canvas.save();
    canvas.translate((size.width - MobiGeo.width * scale) / 2, 0);
    canvas.scale(scale);
    paintRig(canvas, rig.value, palette, shadow: shadow);
    canvas.restore();
  }

  @override
  bool shouldRepaint(MobiPainter old) => old.rig != rig || old.palette != palette || old.shadow != shadow;
}

/// Paints [r] in design units (a 140 by 168 box).
void paintRig(Canvas c, MobiRig r, MobiPalette p, {bool shadow = true}) {
  final parts = MobiParts.of(p);
  final body = _BodyXf(r);
  final lift = math.max(0.0, -r.y);

  if (shadow) _contactShadow(c, r, lift, p);

  MobiDetails.burst(c, r.burst, body.map(const Offset(71, 86)));

  // Behind the body: antenna, arms tucked behind, legs and boots.
  c.save();
  body.apply(c);
  MobiDetails.antenna(c, r.antenna, p);
  if (r.armL.front < 0.5) _arm(c, r.armL, -1, p);
  if (r.armR.front < 0.5) _arm(c, r.armR, 1, p);
  c.restore();

  _leg(c, body.map(MobiGeo.hipL), MobiGeo.ankleL, r.bootL, -1, p);
  _leg(c, body.map(MobiGeo.hipR), MobiGeo.ankleR, r.bootR, 1, p);
  _boot(c, parts, MobiGeo.ankleL, r.bootL, -1);
  _boot(c, parts, MobiGeo.ankleR, r.bootR, 1);

  // The body, face and anything held in front.
  c.save();
  body.apply(c);
  c.drawPicture(parts.body);
  MobiDetails.eyes(c, r);
  c.drawPicture(parts.gloss);
  // Front arms; a held sheet sits over the mittens, as if held from behind.
  if (r.armL.front >= 0.5) _arm(c, r.armL, -1, p);
  if (r.armR.front >= 0.5) _arm(c, r.armR, 1, p);
  if (r.sheet > 0.01) {
    c.save();
    c.translate(71, 116 + (1 - r.sheet) * 8);
    c.rotate(-0.06);
    c.scale(1.3 * (0.6 + 0.4 * r.sheet));
    c.drawPicture(parts.sheet);
    c.restore();
  }
  c.restore();

  MobiDetails.zzz(c, r.zzz, body.map(const Offset(108, 18)), p);
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

Paint _limb(Color color, double width) => Paint()
  ..style = PaintingStyle.stroke
  ..strokeWidth = width
  ..strokeCap = StrokeCap.round
  ..color = color;

/// A rubber hose with a lamp-lit edge: a lighter copy under the dark stroke, offset toward the
/// light, reads as a rounded tube without gradients along the curve.
void _hose(Canvas c, Path path, double width, MobiPalette p) {
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

void _arm(Canvas c, MobiArm a, double side, MobiPalette p) {
  final shoulder = side < 0 ? MobiGeo.shoulderL : MobiGeo.shoulderR;
  final dir = MobiGeo.armDir(a.angle, side);
  final len = MobiGeo.armLength * a.reach;
  final wrist = shoulder + dir * len;
  final outward = Offset(dir.dy * side, -dir.dx * side);
  final ctrl = (shoulder + wrist) / 2 + outward * a.bend * 9;
  final path = Path()
    ..moveTo(shoulder.dx, shoulder.dy)
    ..quadraticBezierTo(ctrl.dx, ctrl.dy, wrist.dx, wrist.dy);
  _hose(c, path, MobiGeo.armWidth, p);

  final tangent = wrist - ctrl;
  final theta = math.atan2(-tangent.dx, tangent.dy) + a.twist * side;
  c.save();
  c.translate(wrist.dx, wrist.dy);
  c.rotate(theta);
  c.scale(side, 1);
  c.scale(MobiGeo.handScale);
  c.translate(0, -2.5);
  MobiDetails.hand(c, a.point, p);
  c.restore();
}

void _leg(Canvas c, Offset hip, Offset ankle, MobiBoot b, double side, MobiPalette p) {
  final end = ankle + Offset(b.dx, b.dy);
  final mid = (hip + end) / 2 + Offset(side * 1.5, 0);
  final path = Path()
    ..moveTo(hip.dx, hip.dy)
    ..quadraticBezierTo(mid.dx, mid.dy, end.dx, end.dy + 2);
  _hose(c, path, MobiGeo.legWidth, p);
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
  final rect = Rect.fromCenter(center: center, width: 104 * k, height: 12 * k);
  final alpha = (p.night ? 0.62 : 0.26) * k;
  c.save();
  c.translate(center.dx, center.dy);
  c.scale(1, rect.height / rect.width);
  c.drawCircle(
    Offset.zero,
    rect.width / 2,
    Paint()
      ..shader = RadialGradient(colors: [
        p.shadow.withValues(alpha: alpha),
        p.shadow.withValues(alpha: alpha * 0.45),
        p.shadow.withValues(alpha: 0),
      ], stops: const [0, 0.5, 1])
          .createShader(Rect.fromCircle(center: Offset.zero, radius: rect.width / 2)),
  );
  c.restore();
}
