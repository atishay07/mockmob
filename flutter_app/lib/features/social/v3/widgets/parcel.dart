// The weekly quest parcel (spec 0.4, 5.6 M9 and M10, CHARACTER-WORLD 7.3): one physical object made
// of kraft paper. A box seen a little from above: the front wall, and a lid of four triangular flaps
// meeting in the middle under a SQUARE scalloped paper seal (never a coin disc, craft judge). Opening,
// each flap swings out on its own hinge (front over the wall, back up behind, the sides out like
// petals), the inside lights with a warm leak, and the Fold climbs out between the back and the front
// layers. Nothing here draws rays.
//
// The spec's three generated stills (`parcel-sealed`, `parcel-pop`, `parcel-open`, 5.7) drop in with no
// code change: [ParcelStills] checks the asset manifest once, and the reveal uses the stills when they
// are bundled (the painted flaps still fold over the open still). Until then the painter is the parcel.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/theme.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';

// ---------------------------------------------------------------------------------------------------
// The generated stills, when bundled
// ---------------------------------------------------------------------------------------------------

abstract final class ParcelStills {
  static const String sealed = 'assets/art/parcel-sealed.webp';
  static const String pop = 'assets/art/parcel-pop.webp';
  static const String open = 'assets/art/parcel-open.webp';
  static const List<String> all = [sealed, pop, open];

  /// The square scalloped paper seal with a tick (K2, spec 5.7 `stamp-seal.webp`, 256 px).
  static const String seal = 'assets/art/stamp-seal.webp';

  static bool? _available;

  /// Known after [resolve]; false until then (the painter draws).
  static bool get available => _available ?? false;

  /// Reads the bundle's asset manifest once. True only when all three stills are bundled.
  static Future<bool> resolve([AssetBundle? bundle]) async {
    if (_available != null) return _available!;
    try {
      final m = await AssetManifest.loadFromAssetBundle(bundle ?? rootBundle);
      final have = m.listAssets().toSet();
      _available = all.every(have.contains);
    } on Object {
      _available = false;
    }
    return _available!;
  }

  @visibleForTesting
  static void setForTest(bool? v) => _available = v;
}

// ---------------------------------------------------------------------------------------------------
// Geometry (unit box: the parcel's width is 1; everything is a fraction of it)
// ---------------------------------------------------------------------------------------------------

/// Where the parcel is at one moment of the reveal.
class ParcelPose {
  const ParcelPose({this.flaps = const [0, 0, 0, 0], this.sealPop = 0, this.leak = 0});

  /// Open progress 0..1 of the front, left, right and back flaps.
  final List<double> flaps;

  /// 0 the seal sits on the lid; 1 it has popped (scaled to 1.2 and faded).
  final double sealPop;

  /// The warm leak from the seam, 0..1.
  final double leak;

  static const ParcelPose sealed = ParcelPose();
  static const ParcelPose open = ParcelPose(flaps: [1, 1, 1, 1], sealPop: 1, leak: 0.5);

  bool get anyOpen => flaps.any((f) => f > 0.001);
}

abstract final class ParcelGeo {
  /// Height of the drawing per unit width.
  static const double aspect = 1.0;

  // The front wall.
  static const double wallL = 0.08, wallR = 0.92, wallT = 0.50, wallB = 0.93;

  // The lid: the front edge is the wall's top; the back edge is narrower and higher.
  static const double backT = 0.28, backL = 0.17, backR = 0.83;
  static const Offset centre = Offset(0.5, 0.39);

  static const Offset fl = Offset(wallL, wallT), fr = Offset(wallR, wallT), bl = Offset(backL, backT), br = Offset(backR, backT);

  /// Flap hinges (A, B), the projected direction from the hinge to the closed tip (u), the up
  /// direction of a standing flap (v), and the open angle.
  static const List<(Offset, Offset, Offset, Offset, double)> flaps = [
    // front: swings out over the wall and hangs.
    (fl, fr, Offset(0, -0.11), Offset(0, -0.22), 214),
    // left: flares out like a petal.
    (fl, bl, Offset(0.375, 0), Offset(0, -0.26), 128),
    // right.
    (br, fr, Offset(-0.375, 0), Offset(0, -0.26), 128),
    // back: stands up behind and leans back.
    (bl, br, Offset(0, 0.11), Offset(0, -0.21), 138),
  ];

  /// The flap's tip at open progress [p] (0 closed on the lid, 1 open).
  static (Offset, Offset, Offset, double) flap(int i, double p) {
    final (a, b, u, v, end) = flaps[i];
    final mid = (a + b) / 2;
    final th = end * p.clamp(0.0, 1.2) * math.pi / 180;
    final tip = mid + u * math.cos(th) + v * math.sin(th);
    return (a, b, tip, th);
  }
}

// ---------------------------------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------------------------------

abstract final class _Kraft {
  static const Color lidBack = Color(0xFFEFE2C4);
  static const Color lidSide = Color(0xFFE5D4B1);
  static const Color lidFront = Color(0xFFDCC8A1);
  static const Color wallTop = Color(0xFFE6D5B2);
  static const Color wallBottom = Color(0xFFC8B086);
  static const Color inner = Color(0xFFF6ECD6);
  static const Color crease = Color(0xFF9E8458);
  static const Color insideDark = Color(0xFF3B2B18);
  static const Color insideWarm = Color(0xFFB9853F);
}

/// Everything behind the Fold: the contact shadow, the inside of the box with its warm leak, and the
/// flaps that have swung out behind (the back flap standing, the side petals).
class ParcelBackPainter extends CustomPainter {
  ParcelBackPainter(this.pose, {required this.night});

  final ParcelPose pose;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    Offset p(Offset u) => Offset(u.dx * w, u.dy * w);

    // Contact shadow on the floor.
    final shadow = Paint()
      ..shader = RadialGradient(colors: [Colors.black.withValues(alpha: night ? 0.42 : 0.2), Colors.black.withValues(alpha: 0)])
          .createShader(Rect.fromCenter(center: p(const Offset(0.5, 0.95)), width: w * 0.95, height: w * 0.16));
    canvas.drawOval(Rect.fromCenter(center: p(const Offset(0.5, 0.95)), width: w * 0.95, height: w * 0.16), shadow);

    if (!pose.anyOpen) return;

    // The inside of the box, through the lid opening: dark paper, warmed by the leak.
    final lid = Path()
      ..moveTo(p(ParcelGeo.bl).dx, p(ParcelGeo.bl).dy)
      ..lineTo(p(ParcelGeo.br).dx, p(ParcelGeo.br).dy)
      ..lineTo(p(ParcelGeo.fr).dx, p(ParcelGeo.fr).dy)
      ..lineTo(p(ParcelGeo.fl).dx, p(ParcelGeo.fl).dy)
      ..close();
    final leak = pose.leak.clamp(0.0, 1.0);
    canvas.drawPath(lid, Paint()..color = Color.lerp(_Kraft.insideDark, _Kraft.insideWarm, 0.25 + 0.6 * leak)!);
    final glow = Paint()
      ..shader = RadialGradient(colors: [const Color(0xFFFFE2A6).withValues(alpha: 0.9 * leak), const Color(0xFFF2A93B).withValues(alpha: 0)])
          .createShader(Rect.fromCircle(center: p(ParcelGeo.centre), radius: w * 0.42));
    canvas.save();
    canvas.clipPath(lid);
    canvas.drawRect(Offset.zero & size, glow);
    // The inner back wall's top edge catches the light.
    canvas.drawLine(p(ParcelGeo.bl), p(ParcelGeo.br), Paint()
      ..color = const Color(0xFFFFE9C2).withValues(alpha: 0.35 + 0.5 * leak)
      ..strokeWidth = 1.5);
    canvas.restore();

    // Flaps swung past upright are behind the Fold: back, then the side petals.
    for (final i in const [3, 1, 2]) {
      final (a, b, tip, th) = ParcelGeo.flap(i, pose.flaps[i]);
      if (th <= math.pi / 2) continue;
      _drawFlap(canvas, p(a), p(b), p(tip), th, i, leak);
    }
  }

  @override
  bool shouldRepaint(ParcelBackPainter old) => !_samePose(old.pose, pose) || old.night != night;
}

/// Everything in front of the Fold: the front wall, the flaps still lying on the lid, the front flap
/// when it hangs over the wall, and the seal.
class ParcelFrontPainter extends CustomPainter {
  ParcelFrontPainter(this.pose, {required this.night, this.drawWall = true});

  final ParcelPose pose;
  final bool night;

  /// False when a generated still draws the body (only the moving flaps and the seal are painted).
  final bool drawWall;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    Offset p(Offset u) => Offset(u.dx * w, u.dy * w);
    final leak = pose.leak.clamp(0.0, 1.0);

    if (drawWall) {
      final wall = RRect.fromRectAndCorners(
        Rect.fromLTRB(ParcelGeo.wallL * w, ParcelGeo.wallT * w, ParcelGeo.wallR * w, ParcelGeo.wallB * w),
        bottomLeft: Radius.circular(w * 0.025),
        bottomRight: Radius.circular(w * 0.025),
        topLeft: Radius.circular(w * 0.006),
        topRight: Radius.circular(w * 0.006),
      );
      canvas.drawRRect(
        wall,
        Paint()
          ..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [_Kraft.wallTop, _Kraft.wallBottom]).createShader(wall.outerRect),
      );
      // Crease shading: the wall's two folded side panels and a pressed fold across.
      final side = Paint()..color = Colors.black.withValues(alpha: 0.06);
      canvas.drawRect(Rect.fromLTRB(ParcelGeo.wallL * w, ParcelGeo.wallT * w, (ParcelGeo.wallL + 0.07) * w, ParcelGeo.wallB * w - w * 0.02), side);
      canvas.drawRect(Rect.fromLTRB((ParcelGeo.wallR - 0.07) * w, ParcelGeo.wallT * w, ParcelGeo.wallR * w, ParcelGeo.wallB * w - w * 0.02), side);
      final crease = Paint()
        ..color = _Kraft.crease.withValues(alpha: 0.35)
        ..strokeWidth = math.max(0.8, w * 0.004);
      canvas.drawLine(p(const Offset(ParcelGeo.wallL + 0.07, ParcelGeo.wallT)), p(const Offset(ParcelGeo.wallL + 0.07, ParcelGeo.wallB - 0.02)), crease);
      canvas.drawLine(p(const Offset(ParcelGeo.wallR - 0.07, ParcelGeo.wallT)), p(const Offset(ParcelGeo.wallR - 0.07, ParcelGeo.wallB - 0.02)), crease);
      canvas.drawLine(p(const Offset(ParcelGeo.wallL + 0.07, 0.72)), p(const Offset(ParcelGeo.wallR - 0.07, 0.72)), crease..color = _Kraft.crease.withValues(alpha: 0.18));
      // Paper fibres, seeded so every frame is the same.
      final rng = math.Random(7);
      final fibre = Paint()
        ..color = _Kraft.crease.withValues(alpha: 0.16)
        ..strokeWidth = math.max(0.6, w * 0.003)
        ..strokeCap = StrokeCap.round;
      for (var i = 0; i < 14; i++) {
        final x = ParcelGeo.wallL + 0.03 + rng.nextDouble() * (ParcelGeo.wallR - ParcelGeo.wallL - 0.06);
        final y = ParcelGeo.wallT + 0.04 + rng.nextDouble() * (ParcelGeo.wallB - ParcelGeo.wallT - 0.08);
        final l = 0.015 + rng.nextDouble() * 0.03;
        final a = (rng.nextDouble() - 0.5) * 0.8;
        canvas.drawLine(p(Offset(x, y)), p(Offset(x + math.cos(a) * l, y + math.sin(a) * l)), fibre);
      }
      // The lamp-lit top edge of the wall.
      canvas.drawLine(p(ParcelGeo.fl), p(ParcelGeo.fr), Paint()
        ..color = const Color(0xFFFFF3DA).withValues(alpha: 0.8)
        ..strokeWidth = math.max(1, w * 0.008));
    }

    // Flaps still on the lid (closed or rising), back to front: back, left, right, front.
    for (final i in const [3, 1, 2, 0]) {
      final (a, b, tip, th) = ParcelGeo.flap(i, pose.flaps[i]);
      final behind = i != 0 && th > math.pi / 2;
      if (behind) continue;
      _drawFlap(canvas, p(a), p(b), p(tip), th, i, leak);
    }

    // The seal on the lid, where the four flaps meet.
    if (pose.sealPop < 1) {
      final k = pose.sealPop.clamp(0.0, 1.0);
      final s = w * 0.2 * (1 + 0.2 * k);
      canvas.save();
      canvas.translate(ParcelGeo.centre.dx * w, ParcelGeo.centre.dy * w);
      canvas.scale(1, 0.82);
      canvas.rotate(-4 * math.pi / 180);
      canvas.translate(-s / 2, -s / 2);
      PaperSealPainter.paintSeal(canvas, Size.square(s), opacity: 1 - k, tick: true);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(ParcelFrontPainter old) => !_samePose(old.pose, pose) || old.night != night || old.drawWall != drawWall;
}

bool _samePose(ParcelPose a, ParcelPose b) {
  if (a.sealPop != b.sealPop || a.leak != b.leak) return false;
  for (var i = 0; i < 4; i++) {
    if (a.flaps[i] != b.flaps[i]) return false;
  }
  return true;
}

void _drawFlap(Canvas canvas, Offset a, Offset b, Offset tip, double th, int i, double leak) {
  final path = Path()
    ..moveTo(a.dx, a.dy)
    ..lineTo(b.dx, b.dy)
    ..lineTo(tip.dx, tip.dy)
    ..close();
  final outer = switch (i) { 0 => _Kraft.lidFront, 3 => _Kraft.lidBack, _ => _Kraft.lidSide };
  final inside = th > math.pi / 2;
  // Light falls from the lamp above: an outer face darkens as it turns away, an inner face catches
  // the warm leak.
  final c = inside
      ? Color.lerp(_Kraft.inner, const Color(0xFFFFE0A8), 0.5 * leak)!
      : Color.lerp(outer, const Color(0xFF8C734C), (math.sin(th).abs() * 0.25).clamp(0.0, 0.25))!;
  canvas.drawPath(path, Paint()..color = c);
  final edge = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = math.max(0.8, (b - a).distance * 0.006)
    ..strokeJoin = StrokeJoin.round
    ..color = _Kraft.crease.withValues(alpha: 0.55);
  canvas.drawPath(path, edge);
  // A soft crease from the hinge's middle to the tip.
  final mid = (a + b) / 2;
  canvas.drawLine(mid, tip, Paint()
    ..color = _Kraft.crease.withValues(alpha: 0.14)
    ..strokeWidth = edge.strokeWidth);
}

// ---------------------------------------------------------------------------------------------------
// The square scalloped paper seal (M10, and the parcel's seal)
// ---------------------------------------------------------------------------------------------------

/// A square paper seal with scalloped edges, a stamped tick and a lamp-lit top edge. Never a disc.
class PaperSealPainter extends CustomPainter {
  const PaperSealPainter({this.opacity = 1, this.glow = 0});

  final double opacity;

  /// A warm bloom behind the seal as it lands, 0..1.
  final double glow;

  /// The seal's outline in a box of [size]: a square whose four sides are each a row of scallops.
  static Path outline(Size size) {
    final s = math.min(size.width, size.height);
    const n = 7;
    final inset = s * 0.05;
    final side = s - inset * 2;
    final step = side / n;
    final r = Radius.circular(step / 2);
    final path = Path()..moveTo(inset, inset);
    // Clockwise: top, right, bottom, left; each scallop bulges outward.
    for (var i = 1; i <= n; i++) {
      path.arcToPoint(Offset(inset + step * i, inset), radius: r);
    }
    for (var i = 1; i <= n; i++) {
      path.arcToPoint(Offset(s - inset, inset + step * i), radius: r);
    }
    for (var i = 1; i <= n; i++) {
      path.arcToPoint(Offset(s - inset - step * i, s - inset), radius: r);
    }
    for (var i = 1; i <= n; i++) {
      path.arcToPoint(Offset(inset, s - inset - step * i), radius: r);
    }
    return path..close();
  }

  static void paintSeal(Canvas canvas, Size size, {double opacity = 1, double glow = 0, bool tick = true}) {
    if (opacity <= 0.001) return;
    final s = math.min(size.width, size.height);
    final rect = Offset.zero & Size.square(s);
    final o = opacity.clamp(0.0, 1.0);
    if (glow > 0.001) {
      canvas.drawCircle(
        rect.center,
        s * 0.95,
        Paint()
          ..shader = RadialGradient(colors: [const Color(0xFFF2A93B).withValues(alpha: 0.35 * glow * o), const Color(0xFFF2A93B).withValues(alpha: 0)])
              .createShader(Rect.fromCircle(center: rect.center, radius: s * 0.95)),
      );
    }
    final path = outline(Size.square(s));
    if (o < 1) canvas.saveLayer(rect.inflate(s * 0.2), Paint()..color = Colors.white.withValues(alpha: o));
    // A soft drop shadow under the paper. Not `drawShadow`: Skia's shadow tessellation of this
    // 28-scallop concave outline never finished on the software rasteriser (the K2 golden hung).
    canvas.drawPath(
      path.shift(Offset(0, s * 0.025)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.24)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, s * 0.03),
    );
    canvas.drawPath(
      path,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFF4DC), Color(0xFFF1E2C2), Color(0xFFDCC7A0)],
          stops: [0, 0.45, 1],
        ).createShader(rect),
    );
    // Embossed inner square: a dark line with a light line under it.
    final inner = RRect.fromRectAndRadius(rect.deflate(s * 0.2), Radius.circular(s * 0.03));
    canvas.drawRRect(inner.shift(Offset(0, s * 0.008)), Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.012
      ..color = const Color(0xFFFFFBEF).withValues(alpha: 0.9));
    canvas.drawRRect(inner, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.012
      ..color = const Color(0xFFB0935D).withValues(alpha: 0.75));
    if (tick) {
      final t = Path()
        ..moveTo(s * 0.34, s * 0.52)
        ..lineTo(s * 0.46, s * 0.63)
        ..lineTo(s * 0.67, s * 0.39);
      canvas.drawPath(t, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.075
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = const Color(0xFF2E2416));
    }
    // The lamp-lit top edge: a warm highlight along the top scallops.
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, s, s * 0.16));
    canvas.drawPath(path, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.02
      ..color = const Color(0xFFFFF8E8).withValues(alpha: 0.95));
    canvas.restore();
    // The paper's soft edge.
    canvas.drawPath(path, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(0.6, s * 0.006)
      ..color = const Color(0xFF9E8458).withValues(alpha: 0.5));
    if (o < 1) canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final s = math.min(size.width, size.height);
    canvas.translate((size.width - s) / 2, (size.height - s) / 2);
    paintSeal(canvas, Size.square(s), opacity: opacity, glow: glow);
  }

  @override
  bool shouldRepaint(PaperSealPainter old) => old.opacity != opacity || old.glow != glow;
}

// ---------------------------------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------------------------------

/// The sealed parcel as an icon (the den's quest strip, the chains screen, K2): it shows the true
/// contents' silhouette in advance (spec 0.4): a Fold peeks over the back of the lid as a silhouette,
/// an item's shape is pressed into a paper label on the wall, and a stitch shows as a dashed thread.
class ParcelIcon extends StatelessWidget {
  const ParcelIcon({super.key, required this.kind, this.fold, this.item, this.size = 56, this.semanticLabel});

  final ParcelKind kind;
  final FoldKey? fold;
  final String? item;

  /// The parcel's width in dp (it is as tall as it is wide).
  final double size;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final night = context.mmColors.isNight;
    final head = kind == ParcelKind.fold && fold != null ? (FoldManifest.cached?[fold]?.head) : null;
    final silhouette = context.mmColors.isNight ? const Color(0xFF5E5545) : const Color(0xFF7B6E58);
    final body = SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(child: CustomPaint(painter: ParcelBackPainter(ParcelPose.sealed, night: night))),
          if (head != null)
            Positioned(
              left: size * 0.32,
              width: size * 0.36,
              top: size * 0.04,
              height: size * 0.36,
              child: ColorFiltered(
                colorFilter: ColorFilter.mode(silhouette, BlendMode.srcIn),
                child: Image.asset(head, fit: BoxFit.contain, excludeFromSemantics: true, errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
            ),
          Positioned.fill(child: CustomPaint(painter: ParcelFrontPainter(ParcelPose.sealed, night: night))),
          if (kind != ParcelKind.fold)
            Positioned(
              left: size * 0.34,
              width: size * 0.32,
              top: size * 0.62,
              height: size * 0.2,
              child: CustomPaint(painter: _LabelPainter(kind == ParcelKind.stitch)),
            ),
        ],
      ),
    );
    return Semantics(label: semanticLabel, image: semanticLabel != null, excludeSemantics: true, child: RepaintBoundary(child: body));
  }
}

class _LabelPainter extends CustomPainter {
  _LabelPainter(this.stitch);
  final bool stitch;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(size.height * 0.12));
    canvas.drawRRect(r, Paint()..color = const Color(0xFFF8EFDB));
    canvas.drawRRect(r, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(0.6, size.height * 0.05)
      ..color = const Color(0xFF9E8458).withValues(alpha: 0.6));
    final ink = Paint()
      ..color = const Color(0xFF6B5A3E)
      ..strokeWidth = math.max(0.8, size.height * 0.1)
      ..strokeCap = StrokeCap.round;
    if (stitch) {
      // A dashed thread: the week's stitch.
      final y = size.height / 2;
      for (var x = size.width * 0.16; x < size.width * 0.84; x += size.width * 0.14) {
        canvas.drawLine(Offset(x, y), Offset(x + size.width * 0.07, y), ink);
      }
    } else {
      // A small bell shape: the den object.
      final c = Offset(size.width / 2, size.height * 0.62);
      final dome = Path()
        ..moveTo(c.dx - size.height * 0.4, c.dy)
        ..quadraticBezierTo(c.dx - size.height * 0.4, c.dy - size.height * 0.42, c.dx, c.dy - size.height * 0.42)
        ..quadraticBezierTo(c.dx + size.height * 0.4, c.dy - size.height * 0.42, c.dx + size.height * 0.4, c.dy)
        ..close();
      canvas.drawPath(dome, Paint()..color = const Color(0xFF6B5A3E));
      canvas.drawLine(Offset(c.dx - size.height * 0.5, c.dy + size.height * 0.08), Offset(c.dx + size.height * 0.5, c.dy + size.height * 0.08), ink);
    }
  }

  @override
  bool shouldRepaint(_LabelPainter old) => old.stitch != stitch;
}
