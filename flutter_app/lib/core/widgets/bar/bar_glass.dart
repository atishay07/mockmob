import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../materials/grain.dart';

/// The shape of a bar surface at a moment: the bar's shape follows its collapse, the capsule's
/// is fixed.
typedef BarShape = RRect Function(Size size);

/// The bar's and the live capsule's glass, in three tiers (NAV-1017 6.2, GLASS-1017 5.1):
///
/// * Full: one `BackdropFilter.grouped` per surface inside the shell's `BackdropGroup` (so the
///   capsule, the live capsule and a glass Start key share one backdrop snapshot), clipped to the
///   surface's own shape. What scrolls under it is lifted to 1.5 saturation, its luminosity is
///   compressed toward the glass (Night: scaled to 50%; Day: lifted to at least 45% white), then
///   blurred at sigma 32 ([MmBar.blurSigma], the owner's frost, L33), under a warm tint at 50%
///   (Night) or 55% (Daylight). Content shows through as soft colour and shape, never as an
///   opaque slab, and the labels stay above 5:1 over any backdrop from black to paper white or
///   volt (the luminosity step does the legibility work a heavier tint used to do).
/// * Lite: no live blur; a denser tint (86% Night, 88% Day) and the noise tile, so what scrolls
///   under the bar still shows through dimly as shape and colour (v13 device walk: at 97% the
///   Night bar read as an opaque charcoal pill). Labels stay above 6:1 over black, paper or volt.
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

  /// The live blur over the saturation lift and the luminosity step, per theme.
  static ui.ImageFilter filterFor({required bool night}) => night ? _nightFilter : _dayFilter;

  static final ui.ImageFilter _nightFilter = _filter(backdropMatrix(night: true));
  static final ui.ImageFilter _dayFilter = _filter(backdropMatrix(night: false));

  static ui.ImageFilter _filter(List<double> matrix) => ui.ImageFilter.compose(
    outer: ui.ImageFilter.blur(sigmaX: MmBar.blurSigma, sigmaY: MmBar.blurSigma),
    inner: ui.ColorFilter.matrix(matrix),
  );

  /// How far Night scales the backdrop's light down, and the white floor Day lifts it to.
  static const double nightLuminosity = 0.50;
  static const double dayFloor = 0.45;

  /// The colour matrix applied to the backdrop before the blur: saturation [MmBar.saturation]
  /// (Rec. 709 luma), then Night's scale or Day's lift.
  static List<double> backdropMatrix({required bool night}) {
    const s = MmBar.saturation;
    const r = 0.2126 * (1 - s), g = 0.7152 * (1 - s), b = 0.0722 * (1 - s);
    final sat = <List<double>>[
      [r + s, g, b],
      [r, g + s, b],
      [r, g, b + s],
    ];
    final k = night ? nightLuminosity : 1 - dayFloor;
    final offset = night ? 0.0 : dayFloor * 255;
    return [
      for (final row in sat) ...[row[0] * k, row[1] * k, row[2] * k, 0, offset],
      0, 0, 0, 1, 0,
    ];
  }

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
      pane = BackdropFilter.grouped(filter: BarGlass.filterFor(night: colors.isNight), child: pane);
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
        GlassQuality.full => const BarGlassSpec(tint: Color(0x801B1A16), edgeTop: edgeTop, edgeMid: edgeMid, shadow: shadow),
        GlassQuality.lite => const BarGlassSpec(tint: Color(0xDB1B1A16), edgeTop: edgeTop, edgeMid: edgeMid, shadow: shadow, noise: 0.04),
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
      GlassQuality.full => const BarGlassSpec(tint: Color(0x8CFFFDF8), edgeTop: edgeTop, edgeMid: edgeMid, shadow: shadow, hairline: hairline),
      GlassQuality.lite => const BarGlassSpec(
        tint: Color(0xE0FFFDF8),
        edgeTop: edgeTop,
        edgeMid: edgeMid,
        shadow: shadow,
        hairline: hairline,
        noise: 0.03,
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
