import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';

/// The lens's colours per theme (NAV-1017 6.2, GLASS-1017 5.1). Never volt: the one lime in the
/// bar is the Start key.
@immutable
class BarLensStyle {
  const BarLensStyle({
    required this.fill,
    required this.liftedFill,
    required this.edge,
    required this.liftedShadow,
    this.hairline,
    this.shadow,
  });

  /// The lens at rest, and lifted under a finger (clearer glass rising out of the bar).
  final Color fill;
  final Color liftedFill;

  /// The 1 dp top edge (fades to nothing by mid-height); 1.6 times brighter while lifted.
  final Color edge;
  final Color? hairline;

  /// The resting contact shadow (Day), and the lifted lens's soft shadow (0 6 16).
  final Color? shadow;
  final Color liftedShadow;

  factory BarLensStyle.of(MmColors colors) => colors.isNight
      ? const BarLensStyle(
          fill: Color(0x1FF4F0E6),
          liftedFill: Color(0x2EF4F0E6),
          edge: Color(0x33FFFFFF),
          liftedShadow: Color(0x4D000000),
        )
      : const BarLensStyle(
          fill: Color(0xFFFFFFFF),
          liftedFill: Color(0xF2FFFDF8),
          edge: Color(0xE6FFFFFF),
          hairline: Color(0xFFD8D1C2),
          shadow: Color(0x1A17150F),
          liftedShadow: Color(0x2E3A3020),
        );

  @override
  bool operator ==(Object other) =>
      other is BarLensStyle &&
      other.fill == fill &&
      other.liftedFill == liftedFill &&
      other.edge == edge &&
      other.hairline == hairline &&
      other.shadow == shadow &&
      other.liftedShadow == liftedShadow;

  @override
  int get hashCode => Object.hash(fill, liftedFill, edge, hairline, shadow, liftedShadow);
}

/// The lens's shape at one moment: its rect in the capsule's 64 dp box and its corner radius.
@immutable
class LensShape {
  const LensShape(this.rect, this.radius);

  final Rect rect;
  final double radius;

  RSuperellipse get superellipse => RSuperellipse.fromRectAndRadius(rect, Radius.circular(radius));
  RRect get rrect => RRect.fromRectAndRadius(rect, Radius.circular(radius));
}

/// The bar's active indicator: a pane of clearer glass under the open tab, painted between its
/// two edges ([left] and [right], in dp from the capsule's left edge).
///
/// **It never cuts into what it holds** (the owner, 17 Oct: the old round lens "feels weird"
/// over Practice, because a 56 dp circle crossed the corners of the word under the icon). Its
/// corners are a continuous curve whose radius is the largest that still keeps every corner of
/// the icon box and of the widest label at least [contentClearance] inside the curve
/// ([cornerRadiusFor]). Compact, with the labels gone, it rounds into a full pill around the icon.
///
/// * Travelling, the edges are apart: the lens stretches and thins up to 8%, a drop of light
///   rather than a sliding block; it squashes a little as its trailing edge lands ([trailVelocity]).
/// * Lifted ([lift] 0 to 1, a finger on the capsule): it grows 8% about its centre, its fill
///   clears, its top light brightens 1.6 times, it casts a soft shadow, and a hairline chromatic
///   fringe (0.5 dp cyan and magenta, 18%) shows its rim bending light (GLASS-1017 5.5).
/// * Reduced motion: the bar cross-fades a [ghost] lens out where the lens was while the lens
///   fades in on the new tab ([ghostFade] 0 to 1, 120 ms).
///
/// At rest it is clipped inside the capsule, so on the first and last tab its outer corners take
/// the capsule's own curve. No layout per frame; this painter sits in its own repaint boundary.
class BarLensPainter extends CustomPainter {
  BarLensPainter({
    required this.left,
    required this.right,
    required this.collapse,
    required this.labelsOut,
    required this.lift,
    required this.restWidth,
    required this.labelWidth,
    required this.capsule,
    required this.style,
    this.trailVelocity,
    this.ghost,
    this.ghostFade,
    this.fringe = true,
  }) : super(repaint: Listenable.merge([left, right, collapse, labelsOut, lift, ?ghostFade]));

  final Animation<double> left;
  final Animation<double> right;
  final Animation<double> collapse;
  final Animation<double> labelsOut;
  final Animation<double> lift;

  /// The lens's width at rest (a slot less 2 dp each side).
  final double restWidth;

  /// The widest tab label as laid out (after the text-scale clamp and the fit), for the corners.
  final double labelWidth;

  /// The capsule's outline at a collapse (the lens is clipped inside it at rest).
  final RRect Function(double collapse) capsule;
  final BarLensStyle style;

  /// The trailing edge's speed in dp per second, read while painting (the landing squash).
  final double Function()? trailVelocity;

  /// Reduced motion: where the lens was ([ghost], left and right, read while painting) and the
  /// cross-fade (0 to 1).
  final (double, double)? Function()? ghost;
  final Animation<double>? ghostFade;

  /// The chromatic fringe while lifted (off under high contrast).
  final bool fringe;

  /// How far inside the lens's curve every corner of its content stays.
  static const double contentClearance = 2.5;

  /// The smallest corner radius the lens ever takes.
  static const double minRadius = 10;

  /// The largest corner radius r for which a point [mx] in from the lens's side and [my] in from
  /// its top or bottom sits at least [clearance] inside the corner's curve: the solution of
  /// `(r - mx)^2 + (r - my)^2 = (r - clearance)^2`. Infinity when the point is clear of any corner.
  static double cornerBound(double mx, double my, {double clearance = contentClearance}) {
    final b = mx + my - clearance;
    final c = mx * mx + my * my - clearance * clearance;
    final disc = b * b - c;
    if (disc < 0) return minRadius;
    return b + math.sqrt(disc);
  }

  /// The lens's corner radius for a lens [width] by [height], holding a 24 dp icon and (until
  /// [labelsOut] reaches 1) a label [labelWidth] wide in the 42 dp icon-and-label group.
  static double cornerRadiusFor({required double width, required double height, required double labelWidth, required double labelsOut}) {
    final pill = height / 2;
    final group = MmBar.labelTop + MmBar.labelHeight - MmBar.iconTop;
    final groupMy = (height - group) / 2;
    final withLabel = math.min(
      cornerBound((width - labelWidth) / 2, groupMy),
      cornerBound((width - MmBar.icon) / 2, groupMy),
    );
    final iconOnly = cornerBound((width - MmBar.icon) / 2, (height - MmBar.icon) / 2);
    final expanded = math.min(pill, math.max(minRadius, withLabel));
    final compact = math.min(pill, math.max(minRadius, iconOnly));
    return ui.lerpDouble(expanded, compact, labelsOut.clamp(0.0, 1.0))!;
  }

  /// The lens between edges [left] and [right] in the capsule's 64 dp box (bottom anchored: y 4
  /// to 60 expanded, 16 to 60 compact), before any lift.
  static LensShape shapeFor({
    required double left,
    required double right,
    required double collapse,
    required double labelsOut,
    required double restWidth,
    required double labelWidth,
    double lift = 0,
    double squash = 0,
  }) {
    final l = math.min(left, right);
    final r = math.max(left, right);
    final full = ui.lerpDouble(MmBar.lensHeight, MmBar.compactLensHeight, collapse)!;
    final width = r - l;
    final stretch = restWidth <= 0 ? 0.0 : (width / restWidth - 1).clamp(0.0, 1.0);
    var h = full * (1 - 0.08 * stretch);
    var w = width;
    if (squash > 0) {
      w *= 1 + squash;
      h *= 1 - squash;
    }
    final s = 1 + 0.08 * lift.clamp(0.0, 1.2);
    w *= s;
    h *= s;
    final bottom = MmBar.height - (MmBar.height - MmBar.lensHeight) / 2;
    final center = Offset((l + r) / 2, bottom - full / 2);
    final radius = cornerRadiusFor(width: restWidth, height: full, labelWidth: labelWidth, labelsOut: labelsOut) * h / full;
    return LensShape(Rect.fromCenter(center: center, width: w, height: h), math.min(radius, math.min(w, h) / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final e = collapse.value;
    final lifted = lift.value.clamp(0.0, 1.2);
    final v = trailVelocity?.call() ?? 0;
    final stretch = restWidth <= 0 ? 0.0 : ((right.value - left.value).abs() / restWidth - 1).clamp(0.0, 1.0);
    final squash = (v.abs() / 2000).clamp(0.0, 1.0) * 0.05 * (1 - stretch);
    final shape = shapeFor(
      left: left.value,
      right: right.value,
      collapse: e,
      labelsOut: labelsOut.value,
      restWidth: restWidth,
      labelWidth: labelWidth,
      lift: lifted,
      squash: squash,
    );

    canvas.save();
    // At rest inside the capsule (the end tabs take its curve); a lifted lens rises out of it.
    canvas.clipRRect(capsule(e).inflate(6 * lifted.clamp(0.0, 1.0) - 1.5));
    final ghostEdges = ghost?.call();
    final fade = ghostFade?.value ?? 1;
    if (ghostEdges != null && fade < 1) {
      final g = shapeFor(
        left: ghostEdges.$1,
        right: ghostEdges.$2,
        collapse: e,
        labelsOut: labelsOut.value,
        restWidth: restWidth,
        labelWidth: labelWidth,
      );
      _paintLens(canvas, g, 0, 1 - fade);
    }
    _paintLens(canvas, shape, lifted.clamp(0.0, 1.0), fade);
    canvas.restore();
  }

  void _paintLens(Canvas canvas, LensShape shape, double lifted, double alpha) {
    if (alpha <= 0) return;
    Color a(Color c) => c.withValues(alpha: c.a * alpha);
    final body = shape.superellipse;
    final bounds = shape.rect;

    final rest = style.shadow;
    if (lifted > 0) {
      canvas.drawRSuperellipse(
        body.shift(Offset(0, 6 * lifted)),
        Paint()
          ..color = a(style.liftedShadow.withValues(alpha: style.liftedShadow.a * lifted))
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, ui.Shadow.convertRadiusToSigma(16)),
      );
    } else if (rest != null) {
      canvas.drawRSuperellipse(
        body.shift(const Offset(0, 1)),
        Paint()
          ..color = a(rest)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5),
      );
    }

    canvas.drawRSuperellipse(body, Paint()..color = a(Color.lerp(style.fill, style.liftedFill, lifted)!));

    final hairline = style.hairline;
    if (hairline != null) {
      canvas.drawRSuperellipse(
        RSuperellipse.fromRectAndRadius(bounds.deflate(0.25), Radius.circular(shape.radius - 0.25)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5
          ..color = a(hairline),
      );
    }

    if (fringe && lifted > 0.01) {
      // Light bending at the rim: a hairline of cyan just outside and of magenta just inside.
      for (final (color, offset) in const [(Color(0xFF7FE3FF), -0.5), (Color(0xFFFF7FD1), 0.5)]) {
        canvas.drawRSuperellipse(
          RSuperellipse.fromRectAndRadius(bounds.deflate(offset), Radius.circular(math.max(0, shape.radius - offset))),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 0.5
            ..color = a(color.withValues(alpha: 0.18 * lifted)),
        );
      }
    }

    // The top edge light: bright on the upper rim, gone by mid-height; 1.6 times while lifted.
    final edge = style.edge.withValues(alpha: (style.edge.a * (1 + 0.6 * lifted)).clamp(0.0, 1.0));
    canvas.drawRSuperellipse(
      RSuperellipse.fromRectAndRadius(bounds.deflate(0.5), Radius.circular(math.max(0, shape.radius - 0.5))),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = ui.Gradient.linear(bounds.topCenter, bounds.center, [a(edge), a(edge.withValues(alpha: 0))]),
    );
  }

  @override
  bool shouldRepaint(BarLensPainter old) =>
      old.left != left ||
      old.right != right ||
      old.collapse != collapse ||
      old.labelsOut != labelsOut ||
      old.lift != lift ||
      old.restWidth != restWidth ||
      old.labelWidth != labelWidth ||
      old.style != style ||
      old.ghost != ghost ||
      old.ghostFade != ghostFade ||
      old.fringe != fringe ||
      old.capsule != capsule;
}
