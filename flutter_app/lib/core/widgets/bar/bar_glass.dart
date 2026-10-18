import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../theme/theme.dart';
import '../materials/glass_shader.dart';
import '../materials/grain.dart';
import '../materials/mm_glass.dart' show GlassContrast, GlassTokens, MmGlass;

/// The shape of a bar surface at a moment: the bar's shape follows its collapse, the capsule's
/// is fixed.
typedef BarShape = RRect Function(Size size);

/// The bar's and the live capsule's glass, in three tiers (NAV-1017 6.2, GLASS-1017 5.1):
///
/// * Full: one `BackdropFilter.grouped` per surface inside the shell's `BackdropGroup` (so the
///   capsule, the live capsule and a glass Start key share one backdrop snapshot), clipped to the
///   surface's own shape. What scrolls under it is lifted to 1.5 saturation, its luminosity is
///   compressed toward the glass (Night: scaled to 45%; Day: lifted to at least 45% white), then
///   blurred at sigma 16 ([MmBar.blurSigma], frost that keeps shape, L33 and F3), under a warm tint at 40%
///   in both themes (v14: 50% Night and 55% Day read as an opaque pill on the device walk).
///   Content shows through as soft colour and shape, never as an opaque slab, and the labels
///   stay at 4.5:1 or better over any backdrop from black to paper white or a solid volt key
///   under the bar's scrim (the luminosity step does the legibility work a heavier tint used to
///   do; test/unit/a11y/bar_guidelines_test.dart).
///
///   The lens (D57, 18 Oct): where the engine runs shader filters ([GlassShader.barReady]) and the
///   phone has not stepped it down ([GlassScope.lensOf]), Full draws `mm_glass.frag` instead:
///   content bends as it crosses the rim (18 dp band, up to 14 dp of bend), a 4 + 12 core blur,
///   saturation 1.15 and the luminosity clamp in linear light with the hue kept (Night at most
///   0.14, Day at least 0.50), under GLASS-1017's bar tint (52% Night, 40% Day). A slow phone
///   drops the lens first and keeps the frost above ([GlassStep]).
///
///   Every live tier also carries GLASS-1017's light, which v14's bar never adopted and which is
///   what makes a pane read as glass over a plain ground: a fine rim (bright along the top, fading
///   by 42% of the height, a faint return along the bottom) and a radial sheen under the top
///   edge, gone by mid-height so no label sits on it.
/// * Lite: no live blur; a denser tint (94% Night and Day) and the noise tile, so what scrolls
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

  /// The tier the bar draws: [quality], with the lens when the phone can run it ([lensReady]) and
  /// has not stepped it down ([lensAllowed]).
  static GlassTier tierFor(GlassQuality quality, {required bool lensReady, required bool lensAllowed}) =>
      GlassTier.resolve(quality, shaderReady: lensReady && lensAllowed);

  /// The live blur over the saturation lift and the luminosity step, per theme.
  static ui.ImageFilter filterFor({required bool night}) => night ? _nightFilter : _dayFilter;

  static final ui.ImageFilter _nightFilter = _filter(backdropMatrix(night: true));
  static final ui.ImageFilter _dayFilter = _filter(backdropMatrix(night: false));

  static ui.ImageFilter _filter(List<double> matrix) => ui.ImageFilter.compose(
    outer: ui.ImageFilter.blur(sigmaX: MmBar.blurSigma, sigmaY: MmBar.blurSigma),
    inner: ui.ColorFilter.matrix(matrix),
  );

  /// How far Night scales the backdrop's light down, and the white floor Day lifts it to.
  static const double nightLuminosity = 0.45;
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
    final tier = BarGlass.tierFor(quality, lensReady: GlassShader.barReady, lensAllowed: GlassScope.lensOf(context));
    final spec = BarGlassSpec.of(colors, quality, lens: tier == GlassTier.full);
    _count(quality == GlassQuality.full);

    Widget pane = CustomPaint(
      painter: _TintPainter(shape: widget.shape, spec: spec, repaint: widget.repaint),
      foregroundPainter: _EdgePainter(shape: widget.shape, spec: spec, repaint: widget.repaint),
      child: widget.child ?? const SizedBox.expand(),
    );
    if (tier == GlassTier.full) {
      pane = _BarLens(
        shape: widget.shape,
        repaint: widget.repaint,
        devicePixelRatio: MediaQuery.maybeDevicePixelRatioOf(context) ?? 1,
        backdropKey: BackdropGroup.of(context)?.backdropKey,
        lens: BarGlassSpec.lensFor(colors),
        fallback: BarGlass.filterFor(night: colors.isNight),
        child: pane,
      );
    } else if (quality == GlassQuality.full) {
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
    this.edgeBottom = const Color(0x00000000),
    this.sheen = const Color(0x00000000),
    this.hairline,
    this.noise = 0,
  });

  final Color tint;

  /// The fine rim: [edgeTop] along the top, [edgeMid] by 42% of the height, [edgeBottom] (the
  /// light returning through a thick pane) along the bottom.
  final Color edgeTop;
  final Color edgeMid;
  final Color edgeBottom;

  /// The radial sheen under the top edge (GLASS-1017 5.4); transparent on Off.
  final Color sheen;
  final Color shadow;
  final Color? hairline;
  final double noise;

  // GLASS-1017 5.1, the bar's rim light and sheen.
  static const Color _nightRimTop = Color(0x4DFFF6E4); // warm white 30%
  static const Color _nightRimMid = Color(0x0FFFF6E4); // 6%
  static const Color _nightRimBottom = Color(0x1AFFF6E4); // 10%
  static const Color _nightSheen = Color(0x12FFF6E4); // 7%
  static const Color _dayRimTop = Color(0xF2FFFFFF); // white 95%
  static const Color _dayRimMid = Color(0x59FFFFFF); // 35%
  static const Color _dayRimBottom = Color(0x1AFFFFFF); // 10%
  static const Color _daySheen = Color(0x8CFFFFFF); // 55%

  /// [quality]'s colours; [lens] picks the lens's thinner-or-equal tint (GLASS-1017 5.1), which
  /// is legible only with the shader's luminosity clamp.
  static BarGlassSpec of(MmColors colors, GlassQuality quality, {bool lens = false}) {
    if (colors.isNight) {
      const shadow = Color(0x66000000); // black 40%
      return switch (quality) {
        GlassQuality.full => BarGlassSpec(
          tint: lens ? const Color(0x851B1A16) : const Color(0x661B1A16),
          edgeTop: _nightRimTop,
          edgeMid: _nightRimMid,
          edgeBottom: _nightRimBottom,
          sheen: _nightSheen,
          shadow: shadow,
        ),
        GlassQuality.lite => const BarGlassSpec(
          tint: Color(0xF01B1A16),
          edgeTop: _nightRimTop,
          edgeMid: _nightRimMid,
          edgeBottom: _nightRimBottom,
          sheen: _nightSheen,
          shadow: shadow,
          noise: 0.04,
        ),
        GlassQuality.off => const BarGlassSpec(
          tint: Color(0xFF1B1A16),
          edgeTop: Color(0x29FFFFFF),
          edgeMid: Color(0x08FFFFFF),
          shadow: shadow,
          hairline: Color(0xFF312E27),
        ),
      };
    }
    const shadow = Color(0x1F3A3020); // #3A3020 at 12%
    const hairline = Color(0x99D8D1C2); // #D8D1C2 at 60%
    return switch (quality) {
      GlassQuality.full => const BarGlassSpec(
        tint: Color(0x66FFFDF8),
        edgeTop: _dayRimTop,
        edgeMid: _dayRimMid,
        edgeBottom: _dayRimBottom,
        sheen: _daySheen,
        shadow: shadow,
        hairline: hairline,
      ),
      GlassQuality.lite => const BarGlassSpec(
        tint: Color(0xF0FFFDF8),
        edgeTop: _dayRimTop,
        edgeMid: _dayRimMid,
        edgeBottom: _dayRimBottom,
        sheen: _daySheen,
        shadow: shadow,
        hairline: hairline,
        noise: 0.03,
      ),
      GlassQuality.off => const BarGlassSpec(
        tint: Color(0xFFFFFDF8),
        edgeTop: Color(0xE6FFFFFF),
        edgeMid: Color(0x00FFFFFF),
        shadow: shadow,
        hairline: Color(0xFFD8D1C2),
      ),
    };
  }

  /// The lens's settings for the bar, in dp (the render object scales them to pixels).
  static BarLensSettings lensFor(MmColors colors) => BarLensSettings(
    band: GlassTokens.barRimBand,
    bend: GlassTokens.barRimBend,
    core: GlassTokens.barCoreBlur,
    preBlur: GlassTokens.preBlur,
    lumMax: colors.isNight ? 0.14 : 1,
    lumMin: colors.isNight ? 0 : 0.50,
  );

  /// What the backdrop becomes through the lens before the tint (for the contrast tests).
  static Color lensed(MmColors colors, Color backdrop) {
    final l = lensFor(colors);
    return GlassContrast.lensed(backdrop, saturation: l.saturation, lumMax: l.lumMax, lumMin: l.lumMin);
  }

  @override
  bool operator ==(Object other) =>
      other is BarGlassSpec &&
      other.tint == tint &&
      other.edgeTop == edgeTop &&
      other.edgeMid == edgeMid &&
      other.edgeBottom == edgeBottom &&
      other.sheen == sheen &&
      other.shadow == shadow &&
      other.hairline == hairline &&
      other.noise == noise;

  @override
  int get hashCode => Object.hash(tint, edgeTop, edgeMid, edgeBottom, sheen, shadow, hairline, noise);
}

/// The bar lens's numbers in dp (GLASS-1017 5.1, the bar row).
@immutable
class BarLensSettings {
  const BarLensSettings({
    required this.band,
    required this.bend,
    required this.core,
    required this.preBlur,
    required this.lumMax,
    required this.lumMin,
    this.saturation = GlassTokens.saturation,
  });

  final double band;
  final double bend;
  final double core;
  final double preBlur;
  final double lumMax;
  final double lumMin;
  final double saturation;

  @override
  bool operator ==(Object other) =>
      other is BarLensSettings &&
      other.band == band &&
      other.bend == bend &&
      other.core == core &&
      other.preBlur == preBlur &&
      other.lumMax == lumMax &&
      other.lumMin == lumMin &&
      other.saturation == saturation;

  @override
  int get hashCode => Object.hash(band, bend, core, preBlur, lumMax, lumMin, saturation);
}

/// The lens as a backdrop filter over the bar's pane: writes the surface's rect (from [shape], in
/// the filter's pixel space) into `mm_glass.frag` each paint and pushes one backdrop layer,
/// compose(lens, pre-blur), in the shell's backdrop group. Repaints on [repaint] (the collapse).
class _BarLens extends SingleChildRenderObjectWidget {
  const _BarLens({
    required this.shape,
    required this.repaint,
    required this.devicePixelRatio,
    required this.backdropKey,
    required this.lens,
    required this.fallback,
    required super.child,
  });

  /// The plain frost's filter, if the lens cannot make a shader after all.
  final ui.ImageFilter fallback;
  final BarShape shape;
  final Listenable repaint;
  final double devicePixelRatio;
  final BackdropKey? backdropKey;
  final BarLensSettings lens;

  @override
  _RenderBarLens createRenderObject(BuildContext context) => _RenderBarLens(shape, repaint, devicePixelRatio, backdropKey, lens, fallback);

  @override
  void updateRenderObject(BuildContext context, _RenderBarLens renderObject) {
    renderObject
      ..shape = shape
      ..repaint = repaint
      ..devicePixelRatio = devicePixelRatio
      ..backdropKey = backdropKey
      ..lens = lens
      ..fallback = fallback;
  }
}

class _RenderBarLens extends RenderProxyBox {
  _RenderBarLens(this._shape, this._repaint, this._dpr, this._backdropKey, this._lens, this._fallback);

  ui.ImageFilter _fallback;
  set fallback(ui.ImageFilter v) {
    if (identical(v, _fallback)) return;
    _fallback = v;
    markNeedsPaint();
  }

  BarShape _shape;
  set shape(BarShape v) {
    if (identical(v, _shape)) return;
    _shape = v;
    markNeedsPaint();
  }

  Listenable _repaint;
  set repaint(Listenable v) {
    if (identical(v, _repaint)) return;
    if (attached) _repaint.removeListener(markNeedsPaint);
    _repaint = v;
    if (attached) _repaint.addListener(markNeedsPaint);
    markNeedsPaint();
  }

  double _dpr;
  set devicePixelRatio(double v) {
    if (v == _dpr) return;
    _dpr = v;
    markNeedsPaint();
  }

  BackdropKey? _backdropKey;
  set backdropKey(BackdropKey? v) {
    if (v == _backdropKey) return;
    _backdropKey = v;
    markNeedsPaint();
  }

  BarLensSettings _lens;
  set lens(BarLensSettings v) {
    if (v == _lens) return;
    _lens = v;
    markNeedsPaint();
  }

  ui.FragmentShader? _shader;

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _repaint.addListener(markNeedsPaint);
  }

  @override
  void detach() {
    _repaint.removeListener(markNeedsPaint);
    super.detach();
  }

  @override
  bool get alwaysNeedsCompositing => child != null;

  @override
  BackdropFilterLayer? get layer => super.layer as BackdropFilterLayer?;

  @override
  void paint(PaintingContext context, Offset offset) {
    if (child == null) return;
    final shader = _shader ??= GlassShader.newBarShader();
    if (shader == null) {
      // No shader after all: the plain frost's filter instead.
      final l = layer ?? BackdropFilterLayer();
      l
        ..filter = _fallback
        ..blendMode = BlendMode.srcOver
        ..backdropKey = _backdropKey;
      layer = l;
      context.pushLayer(l, super.paint, offset);
      return;
    }
    final rrect = _shape(size);
    final origin = localToGlobal(rrect.outerRect.topLeft);
    final rect = Rect.fromLTWH(origin.dx * _dpr, origin.dy * _dpr, rrect.width * _dpr, rrect.height * _dpr);
    GlassLens(
      rect: rect,
      radius: rrect.tlRadiusX * _dpr,
      band: _lens.band * _dpr,
      bend: _lens.bend * _dpr,
      core: _lens.core * _dpr,
      lumMax: _lens.lumMax,
      lumMin: _lens.lumMin,
      saturation: _lens.saturation,
      grid: kDebugMode && GlassShader.gridByDefine ? 24 * _dpr : 0,
    ).apply(shader);
    final l = layer ?? BackdropFilterLayer();
    l
      ..filter = ui.ImageFilter.compose(outer: ui.ImageFilter.shader(shader), inner: MmGlass.basicFilter(_lens.preBlur, saturation: 1))
      ..blendMode = BlendMode.srcOver
      ..backdropKey = _backdropKey;
    layer = l;
    context.pushLayer(l, super.paint, offset);
  }

  @override
  void dispose() {
    _shader?.dispose();
    _shader = null;
    super.dispose();
  }
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
    if (spec.sheen.a > 0) {
      // A radial under the top edge, as wide as the pane and gone by mid-height, so the labels in
      // the lower half never sit on it.
      final bounds = rrect.outerRect;
      final rx = bounds.width / 2;
      final ry = bounds.height / 2;
      if (rx <= 0 || ry <= 0) return;
      canvas.save();
      canvas.clipRRect(rrect);
      canvas.translate(bounds.center.dx, bounds.top);
      canvas.scale(1, ry / rx);
      canvas.drawCircle(
        Offset.zero,
        rx,
        Paint()..shader = ui.Gradient.radial(Offset.zero, rx, [spec.sheen, spec.sheen.withValues(alpha: 0)]),
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_TintPainter old) => old.shape != shape || old.spec != spec;
}

/// The fine 1 dp rim (bright at the top, fading by 42% of the height, a faint return along the
/// bottom) and Daylight's hairline.
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
          [spec.edgeTop, spec.edgeMid, spec.edgeBottom],
          const [0, 0.42, 1],
        ),
    );
  }

  @override
  bool shouldRepaint(_EdgePainter old) => old.shape != shape || old.spec != spec;
}
