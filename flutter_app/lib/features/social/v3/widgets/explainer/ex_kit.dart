// The Mob explainer's stage kit (MOB-EXPLAINER.md section 3). Every slide is a pure function of its
// clock in ms, so any frame can be drawn for a test or a frame strip ("seekable by design"); the
// prototype's timelines map one to one onto the helpers here. Reduced motion (system setting or the
// app's own switch) turns every move into a 120 ms fade at half the delay, with the order kept: no
// squash, hop, particles, sheen or loops (BRAND-MOTION-KIT 7).
//
// The pieces are the app's own: FoldPuppet for every Fold, the paper and lamp of the moments, the
// paper bits and glints (drawn here from a seed, so they are part of the frame, not a ticker).

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../core/motion/motion_tokens.g.dart';
import '../../../../../core/motion/springs.dart';
import '../../../../../core/theme/theme.dart';
import '../../data/mob_v3_models.dart';
import '../fold_manifest.dart';
import '../fold_puppet.dart';
import '../moment_kit.dart' show MomentCurves, SpringCurve, lerpD, seg, springSeg;
import '../paper_particles.dart' show drawGlint;

/// The design box every stage is drawn in: the prototype's phone, 360 dp wide, 404 dp of stage.
abstract final class ExStage {
  static const double w = 360;
  static const double h = 404;
}

/// The smooth spring as a curve of the slide clock (the number roll on slide 6, the length pick).
final Curve exSmooth = SpringCurve(Springs.smooth, MotionSprings.smoothDuration);

/// A slide's clock, read in ms, with the reduced forms.
class ExTime {
  const ExTime(this.ms, {this.reduced = false});

  final double ms;
  final bool reduced;

  /// When a beat starts: half the delay in reduced motion.
  double at(double t) => reduced ? t * 0.5 : t;

  /// A plain fade in.
  double fade(double t, [double d = 200]) => seg(ms, at(t), reduced ? 120 : d);

  /// A fade out (1 to 0).
  double fadeOut(double t, [double d = 200]) => 1 - seg(ms, at(t), reduced ? 120 : d);

  /// A rise: (opacity, lift in dp). The title and body rise 14 dp on emphasized 360.
  (double, double) rise(double t, {double dy = 14, double d = 360, Curve curve = MotionCurves.emphasized}) {
    if (reduced) return (seg(ms, at(t), 120), 0);
    final k = seg(ms, t, d, curve);
    return (seg(ms, t, d * 0.7).clamp(0.0, 1.0), (1 - k) * dy);
  }

  /// A pop on iconPop: (opacity, scale from [from]).
  (double, double) pop(double t, {double from = 0.92}) {
    if (reduced) return (seg(ms, at(t), 120), 1);
    return (seg(ms, t, 120), lerpD(from, 1, springSeg(ms, t, MotionSprings.iconPopDuration, MomentCurves.iconPop)));
  }

  /// A spring segment (may pass 1), or a cut in reduced motion.
  double spring(double t, Duration d, Curve curve) => reduced ? (ms >= at(t) ? 1 : 0) : springSeg(ms, t, d, curve);

  /// An engrave (280 ms on out): the share of the line revealed, left to right. Reduced: whole.
  double engrave(double t) => reduced ? (ms >= at(t) ? 1 : 0) : seg(ms, t, 280, MotionCurves.out);

  /// The opacity that goes with [engrave]: a reduced fade, else visible once it starts.
  double engraveO(double t) => reduced ? seg(ms, at(t), 120) : (ms > t ? 1 : 0);

  /// A stroke drawn on: (share of its length, opacity). Reduced: drawn whole and faded in.
  (double, double) draw(double t, double d) => reduced ? (1, seg(ms, at(t), 120)) : (seg(ms, t, d, MotionCurves.inOut), ms > t ? 1 : 0);

  /// A Fold hopping into its seat (440 ms): it rises from [rise] dp below to half of it above (out),
  /// then lands (leave); the shadow grows 0.3 to 1. The squash follows at +430.
  ExMove hopIn(double t, {double rise = 36}) {
    if (reduced) {
      final o = seg(ms, at(t), 120);
      return ExMove(o: o, shadowO: o);
    }
    if (ms <= t) return const ExMove(o: 0, dy: 0, shadow: 0.3, shadowO: 0);
    final k = ((ms - t) / 440).clamp(0.0, 1.0);
    double dy;
    double sh;
    double so;
    if (k < 0.55) {
      final a = MotionCurves.out.transform(k / 0.55);
      dy = lerpD(rise, -rise / 2, a);
      sh = lerpD(0.3, 0.6, k / 0.55);
      so = lerpD(0, 0.5, k / 0.55);
    } else {
      final a = MotionCurves.leave.transform((k - 0.55) / 0.45);
      dy = lerpD(-rise / 2, 0, a);
      sh = lerpD(0.6, 1, (k - 0.55) / 0.45);
      so = lerpD(0.5, 1, (k - 0.55) / 0.45);
    }
    final o = (k / 0.55).clamp(0.0, 1.0);
    final (sx, sy) = squash(t + 430);
    return ExMove(o: o, dy: dy, shadow: sh, shadowO: so, sx: sx, sy: sy);
  }

  /// A Fold dropped onto a plinth from [from] dp above (leave 240), then a squash at +230.
  ExMove drop(double t, {double from = 60}) {
    if (reduced) {
      final o = seg(ms, at(t), 120);
      return ExMove(o: o, shadowO: o);
    }
    if (ms <= t) return ExMove(o: 0, dy: -from, shadow: 0.4, shadowO: 0);
    final k = seg(ms, t, 240, MotionCurves.leave);
    final (sx, sy) = squash(t + 230);
    return ExMove(o: seg(ms, t, 12), dy: -from * (1 - k), shadow: lerpD(0.4, 1, k), shadowO: k, sx: sx, sy: sy);
  }

  /// The squash at the boots (spec mob.squash 1.08 x 0.88, held 90 ms): 520 ms, then still.
  (double, double) squash(double t) {
    if (reduced || ms <= t || ms >= t + 520) return (1, 1);
    final k = (ms - t) / 520;
    double lx(double a, double b, double s, double e) => lerpD(a, b, ((k - s) / (e - s)).clamp(0.0, 1.0));
    if (k < 0.16) return (lx(1, 1.08, 0, 0.16), lx(1, 0.88, 0, 0.16));
    if (k < 0.34) return (1.08, 0.88);
    if (k < 0.62) return (lx(1.08, 0.97, 0.34, 0.62), lx(0.88, 1.035, 0.34, 0.62));
    return (lx(0.97, 1, 0.62, 1), lx(1.035, 1, 0.62, 1));
  }

  /// One extra hop of [h] dp (380 ms: out up, leave down).
  double hop(double t, double h) {
    if (reduced || ms <= t || ms >= t + 380) return 0;
    final k = (ms - t) / 380;
    if (k < 0.45) return h * MotionCurves.out.transform(k / 0.45);
    return h * (1 - MotionCurves.leave.transform((k - 0.45) / 0.55));
  }
}

/// Where a Fold is in its entrance.
class ExMove {
  const ExMove({this.o = 1, this.dy = 0, this.shadow = 1, this.shadowO = 1, this.sx = 1, this.sy = 1});
  final double o;
  final double dy;
  final double shadow;
  final double shadowO;
  final double sx;
  final double sy;
}

// ---------------------------------------------------------------------------------------------------
// Colours of the paper world (brand kit 2: Night and Day)
// ---------------------------------------------------------------------------------------------------

class ExPaper {
  const ExPaper({required this.paper, required this.ink, required this.ink2, required this.back, required this.line, required this.shadowA, required this.lampA, required this.voltLine, required this.good, required this.sil});

  factory ExPaper.of(BuildContext context) {
    final night = context.mmColors.isNight;
    return night
        ? const ExPaper(
            paper: Color(0xFFECE3CF),
            ink: Color(0xFF2A261E),
            ink2: Color(0xFF5D5545),
            back: Color(0xFFD9CFB8),
            line: Color(0x292A261E),
            shadowA: 0.42,
            lampA: 0.26,
            voltLine: Color(0xFFD2F000),
            good: Color(0xFFC6E86E),
            sil: Color(0xFF4B473E),
          )
        : const ExPaper(
            paper: Color(0xFFFFFDF8),
            ink: Color(0xFF17150F),
            ink2: Color(0xFF5C564A),
            back: Color(0xFFECE6D8),
            line: Color(0x2917150F),
            shadowA: 0.22,
            lampA: 0.17,
            voltLine: Color(0xFF7A9400),
            good: Color(0xFF5E8A12),
            sil: Color(0xFFCFC8B8),
          );
  }

  final Color paper;
  final Color ink;
  final Color ink2;
  final Color back;
  final Color line;
  final double shadowA;
  final double lampA;
  final Color voltLine;
  final Color good;
  final Color sil;

  static const Color lamp = Color(0xFFF2A93B);
  static const Color volt = Color(0xFFD2F000);

  /// A sheet of paper on the desk.
  BoxDecoration sheet({double radius = 6}) => BoxDecoration(
        color: paper,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: shadowA * 0.6), blurRadius: 24, offset: const Offset(0, 10))],
      );

  /// A raised card (the app's card on the stage).
  static BoxDecoration card(BuildContext context, {double radius = 18}) {
    final c = context.mmColors;
    return BoxDecoration(
      color: c.raised,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: c.line),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: c.isNight ? 0.16 : 0.06), blurRadius: 18, offset: const Offset(0, 6))],
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Folds on the stage
// ---------------------------------------------------------------------------------------------------

/// A Fold standing with its boots at ([x], [base]) in stage coordinates, [size] dp tall, moved by
/// [move] and an extra lift [lift]. The floor shadow stays on the floor while the Fold hops.
List<Widget> exFold({
  required FoldKey fold,
  required double x,
  required double base,
  required double size,
  FoldPose pose = FoldPose.idle,
  ExMove move = const ExMove(),
  double lift = 0,
  double rotate = 0,
  bool ghost = false,
  bool breathe = false,
  bool shadow = true,
  bool large = false,
  int phase = 0,
  required bool night,
}) {
  final w = size * 1.6;
  return [
    if (shadow)
      Positioned(
        left: x - size * 0.34,
        top: base - size * 0.05,
        width: size * 0.68,
        height: size * 0.1,
        child: Opacity(
          opacity: move.shadowO.clamp(0.0, 1.0),
          child: Transform.scale(scale: move.shadow, child: CustomPaint(painter: _FloorShadow(night: night, dashed: ghost))),
        ),
      ),
    Positioned(
      left: x - w / 2,
      top: base - size,
      width: w,
      height: size,
      child: Opacity(
        opacity: move.o.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, move.dy - lift),
          child: Transform(
            alignment: Alignment.bottomCenter,
            transform: Matrix4.identity()
              ..rotateZ(rotate)
              ..scaleByDouble(move.sx, move.sy, 1, 1),
            child: Align(
              alignment: Alignment.bottomCenter,
              child: FoldPuppet(fold: fold, size: size, pose: pose, ghost: ghost, shadow: false, breathe: breathe, phase: phase, large: large),
            ),
          ),
        ),
      ),
    ),
  ];
}

class _FloorShadow extends CustomPainter {
  _FloorShadow({required this.night, this.dashed = false});
  final bool night;
  final bool dashed;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final colour = night ? const Color(0x52000000) : const Color(0x2E3B2A12);
    if (dashed) {
      final p = Paint()
        ..color = colour
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2;
      const n = 14;
      for (var i = 0; i < n; i++) {
        canvas.drawArc(rect, i * 2 * math.pi / n, math.pi / n, false, p);
      }
      return;
    }
    canvas.drawOval(
      rect,
      Paint()
        ..color = colour
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.height * 0.3),
    );
  }

  @override
  bool shouldRepaint(_FloorShadow old) => old.night != night || old.dashed != dashed;
}

// ---------------------------------------------------------------------------------------------------
// Tags, reveals and small marks
// ---------------------------------------------------------------------------------------------------

enum ExTagKind { plain, you, dim, eldest }

/// A name tag under a Fold, centred on [x] (the den's tag: "You" is the one volt thing).
Widget exTag(BuildContext context, String text, {required double x, required double top, ExTagKind kind = ExTagKind.plain, double reveal = 1, double opacity = 1}) {
  final c = context.mmColors;
  final paper = ExPaper.of(context);
  final (bg, fg) = switch (kind) {
    ExTagKind.you => (c.volt, c.voltInk),
    ExTagKind.dim => (Colors.transparent, c.ink3),
    ExTagKind.eldest => (paper.paper, paper.ink),
    ExTagKind.plain => (c.raised2, c.ink),
  };
  return Positioned(
    left: x - 90,
    top: top,
    width: 180,
    child: Center(
      child: Opacity(
        opacity: opacity.clamp(0.0, 1.0),
        child: ClipRect(
          clipper: ExRevealClipper(reveal),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(7), border: kind == ExTagKind.plain ? Border.all(color: c.line) : null),
            child: Text(text, maxLines: 1, style: context.mmType.label.copyWith(fontSize: 12, height: 16 / 12, color: fg)),
          ),
        ),
      ),
    ),
  );
}

/// Reveals [share] of the child from the left (an engrave).
class ExRevealClipper extends CustomClipper<Rect> {
  const ExRevealClipper(this.share);
  final double share;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(-2, -4, (size.width + 4) * share.clamp(0.0, 1.0), size.height + 8);

  @override
  bool shouldReclip(ExRevealClipper old) => old.share != share;
}

/// A tick stroked on ([share] of its length).
class ExTickPainter extends CustomPainter {
  ExTickPainter({required this.share, required this.colour, this.width = 3, this.edge});
  final double share;
  final Color colour;
  final double width;
  final Color? edge;

  @override
  void paint(Canvas canvas, Size size) {
    if (share <= 0) return;
    final s = size.width / 24;
    final path = Path()
      ..moveTo(4 * s, 12.5 * s)
      ..lineTo(9 * s, 17.5 * s)
      ..lineTo(20 * s, 6 * s);
    final m = path.computeMetrics().first;
    final drawn = m.extractPath(0, m.length * share.clamp(0.0, 1.0));
    if (edge != null) {
      canvas.drawPath(drawn, Paint()
        ..color = edge!
        ..style = PaintingStyle.stroke
        ..strokeWidth = width + 1.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round);
    }
    canvas.drawPath(drawn, Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round);
  }

  @override
  bool shouldRepaint(ExTickPainter old) => old.share != share || old.colour != colour;
}

/// A straight stroke from [a] to [b] drawn on to [share]; dashed when [dash] is set.
class ExLinePainter extends CustomPainter {
  ExLinePainter({required this.a, required this.b, required this.share, required this.colour, this.width = 1.4, this.dash});
  final Offset a;
  final Offset b;
  final double share;
  final Color colour;
  final double width;
  final (double, double)? dash;

  @override
  void paint(Canvas canvas, Size size) {
    if (share <= 0) return;
    final p = Paint()
      ..color = colour
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round;
    final end = Offset.lerp(a, b, share.clamp(0.0, 1.0))!;
    final d = dash;
    if (d == null) {
      canvas.drawLine(a, end, p);
      return;
    }
    final total = (end - a).distance;
    final dir = (b - a) / (b - a).distance;
    for (var s = 0.0; s < total; s += d.$1 + d.$2) {
      canvas.drawLine(a + dir * s, a + dir * math.min(s + d.$1, total), p);
    }
  }

  @override
  bool shouldRepaint(ExLinePainter old) => old.share != share || old.colour != colour || old.a != a || old.b != b;
}

// ---------------------------------------------------------------------------------------------------
// Light: the desk lamp (shade and cone) and the lamp pool. Never rays.
// ---------------------------------------------------------------------------------------------------

class ExLampPainter extends CustomPainter {
  ExLampPainter({required this.cx, required this.coneW, required this.coneH, required this.lampA, this.scaleX = 1, this.cone = 1, this.bright = 1, this.shade = 1, this.shadeDy = 0});

  final double cx;
  final double coneW;
  final double coneH;
  final double lampA;
  final double scaleX;
  final double cone;
  final double bright;
  final double shade;
  final double shadeDy;

  @override
  void paint(Canvas canvas, Size size) {
    if (cone > 0.001) {
      final top = 26.0;
      final half = coneW / 2 * scaleX;
      final path = Path()
        ..moveTo(cx - half * 0.18, top)
        ..lineTo(cx + half * 0.18, top)
        ..lineTo(cx + half, top + coneH)
        ..lineTo(cx - half, top + coneH)
        ..close();
      final a = (lampA * 1.5 * bright * cone).clamp(0.0, 0.85);
      canvas.drawPath(
        path,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [ExPaper.lamp.withValues(alpha: a), ExPaper.lamp.withValues(alpha: 0)],
            stops: const [0, 0.92],
          ).createShader(Rect.fromLTWH(cx - half, top, half * 2, coneH)),
      );
    }
    if (shade > 0.001) {
      canvas.save();
      canvas.translate(cx - 32, shadeDy);
      final o = shade.clamp(0.0, 1.0);
      canvas.drawRect(const Rect.fromLTWH(30.5, -40, 3, 46), Paint()..color = const Color(0xFF5B4A2E).withValues(alpha: o));
      final body = Path()
        ..moveTo(14, 30)
        ..lineTo(22, 6)
        ..quadraticBezierTo(32, 2, 42, 6)
        ..lineTo(50, 30)
        ..close();
      canvas.drawPath(body, Paint()..color = const Color(0xFFB8893F).withValues(alpha: o));
      canvas.drawPath(
        body,
        Paint()
          ..shader = LinearGradient(colors: [
            Colors.black.withValues(alpha: 0.35 * o),
            Colors.white.withValues(alpha: 0.18 * o),
            Colors.black.withValues(alpha: 0.4 * o),
          ], stops: const [0, 0.45, 1]).createShader(const Rect.fromLTWH(14, 2, 36, 28)),
      );
      canvas.drawOval(Rect.fromCenter(center: const Offset(32, 30), width: 36, height: 6.4), Paint()..color = const Color(0xFFFFE2A8).withValues(alpha: o));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(ExLampPainter old) =>
      old.scaleX != scaleX || old.cone != cone || old.bright != bright || old.shade != shade || old.shadeDy != shadeDy || old.lampA != lampA || old.coneW != coneW;
}

/// The warm pool of lamp light on a floor or wall: an ellipse, brightest in the middle.
class ExPoolPainter extends CustomPainter {
  ExPoolPainter({required this.lampA, this.strength = 1});
  final double lampA;
  final double strength;

  @override
  void paint(Canvas canvas, Size size) {
    final a = (lampA * 1.6 * strength).clamp(0.0, 0.9);
    if (a <= 0.001) return;
    final rect = Offset.zero & size;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(1, size.height / size.width);
    canvas.drawCircle(
      Offset.zero,
      size.width / 2,
      Paint()..shader = RadialGradient(colors: [ExPaper.lamp.withValues(alpha: a), ExPaper.lamp.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: Offset.zero, radius: size.width / 2)),
    );
    canvas.restore();
    // Keep the rect used (the pool fills its box).
    assert(rect.width >= 0);
  }

  @override
  bool shouldRepaint(ExPoolPainter old) => old.lampA != lampA || old.strength != strength;
}

// ---------------------------------------------------------------------------------------------------
// Paper bits and glints, drawn from a seed as a function of the clock (brand kit 6: 4 to 8 dp
// rectangles with a fold line, gravity and drag, floored; at most 60 on screen, 26 in one burst)
// ---------------------------------------------------------------------------------------------------

class ExBurst {
  const ExBurst({required this.x, required this.y, required this.n, required this.at, this.floor, this.seed = 7, this.up = 160, this.spread = 1});
  final double x;
  final double y;
  final int n;
  final double at;
  final double? floor;
  final int seed;
  final double up;
  final double spread;
}

class ExGlints {
  const ExGlints({required this.x, required this.y, required this.n, required this.r, required this.at, this.colour = const Color(0xFFF2D9A0), this.rot = 0});
  final double x;
  final double y;
  final int n;
  final double r;
  final double at;
  final Color colour;
  final double rot;
}

class ExSparkPainter extends CustomPainter {
  ExSparkPainter({required this.ms, this.bursts = const [], this.glints = const []});

  final double ms;
  final List<ExBurst> bursts;
  final List<ExGlints> glints;

  static const List<Color> _colours = [Color(0xFFECE3CF), Color(0xFFF2A93B), Color(0xFFD2F000), Color(0xFFFF7A8A), Color(0xFF56B8F0)];

  @override
  void paint(Canvas canvas, Size size) {
    for (final b in bursts) {
      if (ms < b.at) continue;
      final r = math.Random(b.seed);
      for (var i = 0; i < b.n; i++) {
        final w = 4 + r.nextDouble() * 4;
        final h = 3 + r.nextDouble() * 3;
        final colour = _colours[i % _colours.length];
        var vx = (r.nextDouble() - 0.5) * 260 * b.spread;
        var vy = -b.up - r.nextDouble() * 200;
        final life = 700 + r.nextDouble() * 700;
        final rot0 = r.nextDouble() * 360;
        final vr = (r.nextDouble() - 0.5) * 900;
        final delay = r.nextDouble() * 60;
        final local = ms - b.at - delay;
        if (local <= 0 || local >= life) continue;
        var x = b.x;
        var y = b.y;
        const dt = 1 / 60;
        final steps = (local / 1000 / dt).floor();
        for (var s = 0; s < steps; s++) {
          vy += 900 * dt;
          vx *= 1 - 0.72 * dt;
          vy *= 1 - 0.24 * dt;
          x += vx * dt;
          y += vy * dt;
          final f = b.floor;
          if (f != null && y > f) {
            y = f;
            vy = 0;
            vx *= 0.4;
          }
        }
        final k = local / life;
        final o = k < 0.08 ? k / 0.08 : (k > 0.8 ? (1 - k) / 0.2 : 1.0);
        final ang = (rot0 + vr * local / 1000) * math.pi / 180;
        final flutter = math.cos(ang * 180 / math.pi / 40) * 0.5 + 0.7;
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(ang);
        canvas.scale(flutter, 1);
        final rect = Rect.fromCenter(center: Offset.zero, width: w, height: h);
        canvas.drawRect(Rect.fromLTRB(rect.left, rect.top, rect.left + w * 0.52, rect.bottom), Paint()..color = colour.withValues(alpha: o));
        canvas.drawRect(Rect.fromLTRB(rect.left + w * 0.52, rect.top, rect.right, rect.bottom), Paint()..color = Color.lerp(colour, Colors.black, 0.28)!.withValues(alpha: o));
        canvas.restore();
      }
    }
    for (final g in glints) {
      for (var i = 0; i < g.n; i++) {
        final start = g.at + i * 30;
        if (ms <= start || ms >= start + 520) continue;
        final k = (ms - start) / 520;
        final ang = i / g.n * math.pi * 2 + g.rot;
        final out = k > 0.4 ? (k - 0.4) / 0.6 * 8 : 0.0;
        final c = Offset(g.x + math.cos(ang) * (g.r + out), g.y + math.sin(ang) * (g.r + out));
        final scale = k < 0.4 ? MotionCurves.out.transform(k / 0.4) : lerpD(1, 0.3, (k - 0.4) / 0.6);
        final o = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
        canvas.save();
        canvas.translate(c.dx, c.dy);
        canvas.rotate((k * 60) * math.pi / 180);
        drawGlint(canvas, Offset.zero, 7 * scale, g.colour.withValues(alpha: o.clamp(0.0, 1.0)));
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(ExSparkPainter old) => old.ms != ms || old.bursts != bursts || old.glints != glints;
}

/// A head disc for the fixture people (a Fold head, ringed in a member colour or a quiet edge).
class ExHead extends StatelessWidget {
  const ExHead({super.key, required this.fold, this.size = 40, this.ring, this.ghost = false});
  final FoldKey fold;
  final double size;
  final Color? ring;
  final bool ghost;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final head = FoldManifest.cached?[fold]?.head ?? 'assets/folds/fold-${fold.name}-head@128.webp';
    return Opacity(
      opacity: ghost ? 0.6 : 1,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: c.raised2,
          border: Border.all(color: ring ?? c.line, width: ring == null ? 1 : 2.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset(head, width: size, height: size, fit: BoxFit.cover, excludeFromSemantics: true, filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => const SizedBox.shrink()),
      ),
    );
  }
}
