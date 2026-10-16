import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../materials/grain.dart';

/// The shape of a bar surface at a moment: the bar's shape follows its collapse, the capsule's
/// is fixed.
typedef BarShape = RRect Function(Size size);

/// The bar's and the capsule's glass, in three tiers (DOCK.md section 4):
///
/// * Full: one `BackdropFilter.grouped` per surface inside the shell's `BackdropGroup`, clipped
///   to the surface's own shape: a 24 sigma blur over a 1.15 saturation lift (HIGH's "juicy"
///   frost), under a warm tint at 60% (Night) or 68% (Daylight).
/// * Lite: no live blur; a thicker tint and the noise tile.
/// * Off: solid, with a hairline.
///
/// One analytic rounded-rect shadow sits outside the clip. Every part repaints from [shape] on
/// [repaint] (the collapse), with no layout.
class BarGlass extends StatefulWidget {
  const BarGlass({super.key, required this.shape, required this.repaint, this.quality, this.child});

  final BarShape shape;
  final Listenable repaint;

  /// Overrides the inherited `GlassScope` (goldens draw all three tiers).
  final GlassQuality? quality;
  final Widget? child;

  /// The live blur and its saturation lift.
  static final ui.ImageFilter filter = ui.ImageFilter.compose(
    outer: ui.ImageFilter.blur(sigmaX: MmElevation.sigmaDock, sigmaY: MmElevation.sigmaDock),
    inner: const ui.ColorFilter.matrix(_saturate115),
  );

  static const List<double> _saturate115 = [
    // A 1.15 saturation matrix (Rec. 709 luma).
    0.2126 * -0.15 + 1.15, 0.7152 * -0.15, 0.0722 * -0.15, 0, 0,
    0.2126 * -0.15, 0.7152 * -0.15 + 1.15, 0.0722 * -0.15, 0, 0,
    0.2126 * -0.15, 0.7152 * -0.15, 0.0722 * -0.15 + 1.15, 0, 0,
    0, 0, 0, 1, 0,
  ];

  @override
  State<BarGlass> createState() => _BarGlassState();
}

class _BarGlassState extends State<BarGlass> {
  bool _counted = false;

  void _count(bool live) {
    if (live == _counted) return;
    _counted = live;
    live ? GlassActivity.glassMounted() : GlassActivity.glassUnmounted();
  }

  @override
  void dispose() {
    _count(false);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final quality = widget.quality ?? GlassScope.of(context);
    final spec = BarGlassSpec.of(colors, quality);
    _count(quality == GlassQuality.full);

    Widget pane = CustomPaint(
      painter: _TintPainter(shape: widget.shape, spec: spec, repaint: widget.repaint),
      foregroundPainter: _EdgePainter(shape: widget.shape, spec: spec, repaint: widget.repaint),
      child: widget.child ?? const SizedBox.expand(),
    );
    if (quality == GlassQuality.full) {
      pane = BackdropFilter.grouped(filter: BarGlass.filter, child: pane);
    }
    return CustomPaint(
      painter: _ShadowPainter(shape: widget.shape, color: spec.shadow, repaint: widget.repaint),
      child: ClipRRect(clipper: _ShapeClipper(widget.shape, widget.repaint), child: pane),
    );
  }
}

/// The colours of one tier in one theme.
@immutable
class BarGlassSpec {
  const BarGlassSpec({
    required this.tint,
    required this.edgeTop,
    required this.edgeMid,
    required this.shadow,
    this.hairline,
    this.noise = 0,
  });

  final Color tint;
  final Color edgeTop;
  final Color edgeMid;
  final Color shadow;
  final Color? hairline;
  final double noise;

  static BarGlassSpec of(MmColors colors, GlassQuality quality) {
    if (colors.isNight) {
      const edgeTop = Color(0x29FFFFFF); // white 16%
      const edgeMid = Color(0x08FFFFFF); // white 3%
      const shadow = Color(0x66000000); // black 40%
      return switch (quality) {
        GlassQuality.full => const BarGlassSpec(tint: Color(0x991B1A16), edgeTop: edgeTop, edgeMid: edgeMid, shadow: shadow),
        GlassQuality.lite => const BarGlassSpec(tint: Color(0xEB1B1A16), edgeTop: edgeTop, edgeMid: edgeMid, shadow: shadow, noise: 0.03),
        GlassQuality.off => const BarGlassSpec(
          tint: Color(0xFF1B1A16),
          edgeTop: edgeTop,
          edgeMid: edgeMid,
          shadow: shadow,
          hairline: Color(0xFF312E27),
        ),
      };
    }
    const edgeTop = Color(0xE6FFFFFF); // white 90%
    const edgeMid = Color(0x00FFFFFF);
    const shadow = Color(0x1F3A3020); // #3A3020 at 12%
    const hairline = Color(0x99D8D1C2); // #D8D1C2 at 60%
    return switch (quality) {
      GlassQuality.full => const BarGlassSpec(tint: Color(0xAEFFFDF8), edgeTop: edgeTop, edgeMid: edgeMid, shadow: shadow, hairline: hairline),
      GlassQuality.lite => const BarGlassSpec(
        tint: Color(0xF0FFFDF8),
        edgeTop: edgeTop,
        edgeMid: edgeMid,
        shadow: shadow,
        hairline: hairline,
        noise: 0.02,
      ),
      GlassQuality.off => const BarGlassSpec(
        tint: Color(0xFFFFFDF8),
        edgeTop: edgeTop,
        edgeMid: edgeMid,
        shadow: shadow,
        hairline: Color(0xFFD8D1C2),
      ),
    };
  }

  @override
  bool operator ==(Object other) =>
      other is BarGlassSpec &&
      other.tint == tint &&
      other.edgeTop == edgeTop &&
      other.edgeMid == edgeMid &&
      other.shadow == shadow &&
      other.hairline == hairline &&
      other.noise == noise;

  @override
  int get hashCode => Object.hash(tint, edgeTop, edgeMid, shadow, hairline, noise);
}

class _ShapeClipper extends CustomClipper<RRect> {
  _ShapeClipper(this.shape, Listenable repaint) : super(reclip: repaint);

  final BarShape shape;

  @override
  RRect getClip(Size size) => shape(size);

  @override
  bool shouldReclip(_ShapeClipper old) => old.shape != shape;
}

/// One shadow, 0 8 24, drawn as a blurred rounded rect (the analytic fast path).
class _ShadowPainter extends CustomPainter {
  _ShadowPainter({required this.shape, required this.color, required Listenable repaint}) : super(repaint: repaint);

  final BarShape shape;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRRect(
      shape(size).shift(const Offset(0, 8)),
      Paint()
        ..color = color
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, Shadow.convertRadiusToSigma(24)),
    );
  }

  @override
  bool shouldRepaint(_ShadowPainter old) => old.shape != shape || old.color != color;
}

class _TintPainter extends CustomPainter {
  _TintPainter({required this.shape, required this.spec, required Listenable repaint}) : super(repaint: repaint);

  final BarShape shape;
  final BarGlassSpec spec;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = shape(size);
    canvas.drawRRect(rrect, Paint()..color = spec.tint);
    if (spec.noise > 0) {
      canvas.save();
      canvas.clipRRect(rrect);
      GrainPainter(opacity: spec.noise).paint(canvas, size);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_TintPainter old) => old.shape != shape || old.spec != spec;
}

/// The 1 dp edge light (bright at the top, fading by mid-height) and Daylight's hairline.
class _EdgePainter extends CustomPainter {
  _EdgePainter({required this.shape, required this.spec, required Listenable repaint}) : super(repaint: repaint);

  final BarShape shape;
  final BarGlassSpec spec;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = shape(size);
    final hairline = spec.hairline;
    if (hairline != null) {
      canvas.drawRRect(
        rrect.deflate(0.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = hairline,
      );
    }
    final bounds = rrect.outerRect;
    canvas.drawRRect(
      rrect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = ui.Gradient.linear(
          bounds.topCenter,
          bounds.bottomCenter,
          [spec.edgeTop, spec.edgeMid, spec.edgeMid.withValues(alpha: 0)],
          const [0, 0.5, 1],
        ),
    );
  }

  @override
  bool shouldRepaint(_EdgePainter old) => old.shape != shape || old.spec != spec;
}
