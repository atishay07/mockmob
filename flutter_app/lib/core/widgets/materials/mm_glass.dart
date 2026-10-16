import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';
import 'edge_light.dart';
import 'glass_shader.dart';
import 'grain.dart';
import 'shape.dart';

/// MockMob Glass (GLASS-1017, packet G2): one regular material for the navigation layer only.
///
/// It goes on chrome that floats over content: the bar, the Start key, the live capsule, sheets,
/// floating controls and menu bubbles. Never on cards, rows, question text, the result or
/// Today's sections (LG-2, T-082); those keep `FakeGlass`.
///
/// What it draws, bottom to top:
/// 1. a soft shadow outside the shape (bigger glass reads thicker);
/// 2. the live backdrop, clipped to the shape: the lens (`mm_glass.frag`: rim bend, core blur and
///    a luminosity clamp) on the Full tier when [GlassShader.ready], otherwise a blur with a 1.15
///    saturation lift ("Full without the shader");
/// 3. the tint, dense in a sheet's reading core and thinner at its rim, with grain on Lite;
/// 4. a radial sheen at the top and the rim light: bright along the top, fading by 42% of the
///    height, with a faint return along the bottom (light catching a thick pane).
///
/// The tier follows the student's Glass setting, the phone and high-contrast text
/// ([GlassScope.tierOf]). Off, and high contrast, are solid with a hairline: the app's Reduce
/// Transparency.
///
/// **For the bar (the navigation packet owns its files):** take the numbers from
/// [GlassMaterialSpec.of] with [GlassKind.bar], the live filter from [MmGlass.basicFilter] (or wrap
/// the bar's pane in [GlassBackdrop]), and paint the light with [GlassLight.paintRim] and
/// [GlassLight.paintSheen] from the bar's own painters. Everything takes a shape, so the bar's
/// collapse keeps working.
enum GlassKind {
  /// The bottom bar, the Start key's ground and the live capsule.
  bar,

  /// A floating control: a header pill or a back key over scrolling content.
  control,

  /// A sheet at its partial detent.
  sheet,

  /// A menu or popover bubble.
  bubble,
}

/// The material's numbers (GLASS-1017 section 5.1). Sizes are dp.
abstract final class GlassTokens {
  /// The bar's live blur without the shader, and the shader's extra core blur radius.
  static const double barCoreBlur = 12;

  /// The light blur the lens samples, under its own core taps.
  static const double preBlur = 4;

  /// The old heavy frost (L33). Kept so the owner's answer to open question 1 is one switch.
  static const double frostBlurSigma = 32;

  static const double barRimBand = 18;
  static const double barRimBend = 14;
  static const double controlRimBand = 8;
  static const double controlRimBend = 6;
  static const double sheetBlur = 30;
  static const double sheetRimBand = 22;
  static const double sheetRimBend = 16;
  static const double bubbleBlur = 24;
  static const double bubbleRimBand = 12;
  static const double bubbleRimBend = 10;

  /// The saturation lift of every live tier.
  static const double saturation = 1.15;

  /// A sheet's tint runs from its rim density to its reading density between these two depths,
  /// so text (which sits at least 20 dp in) always lies on the dense core.
  static const double featherFrom = 12;
  static const double featherTo = 20;

  /// The tint a sheet or bubble starts from as it materialises.
  static const double materializeFrom = 0.3;

  /// The share of a sheet's rise over which it materialises (blur, bend and tint together).
  static const double materializeShare = 0.6;

  /// A floating control's lift under the finger: scale, and its critically damped spring
  /// (`Springs.lensLift` in the motion pass: 180 ms, no bounce).
  static const double liftScale = 1.04;
  static final SpringDescription liftSpring = SpringDescription.withDurationAndBounce(
    duration: const Duration(milliseconds: 180),
  );

  /// The touch light: a bloom under the finger that rises fast and spreads as it leaves.
  static const double touchLightRadius = 56;
  static const double touchLightSpread = 96;
  static const Duration touchLightIn = Duration(milliseconds: 80);
  static const Duration touchLightOut = Duration(milliseconds: 360);
}

/// One surface's glass in one theme and tier. [GlassMaterialSpec.of] holds the table.
@immutable
class GlassMaterialSpec {
  const GlassMaterialSpec({
    required this.tier,
    required this.tint,
    required this.rimLightTop,
    required this.rimLightMid,
    required this.rimLightBottom,
    required this.sheen,
    required this.shadow,
    this.rimTint,
    this.blur = 0,
    this.core = 0,
    this.band = 0,
    this.bend = 0,
    this.lumMax = 1,
    this.lumMin = 0,
    this.saturation = 1,
    this.hairline,
    this.noise = 0,
  });

  final GlassTier tier;

  /// The resting tint: a sheet's reading core, or the whole pane.
  final Color tint;

  /// A sheet's or bubble's thinner tint at its rim, feathered into [tint] between
  /// [GlassTokens.featherFrom] and [GlassTokens.featherTo]. Null is one even tint.
  final Color? rimTint;

  /// The system blur sigma read from the backdrop (the lens's pre-blur on Full).
  final double blur;

  /// The lens's extra core blur radius, in dp (0 when the system blur is the core).
  final double core;

  /// The lens's rim band and how far it bends at the edge, in dp.
  final double band;
  final double bend;

  /// The lens's luminosity clamp: Night's ceiling and Day's floor (1 and 0 are off).
  final double lumMax;
  final double lumMin;
  final double saturation;

  final Color rimLightTop;
  final Color rimLightMid;
  final Color rimLightBottom;

  /// The radial sheen pooled under the top edge.
  final Color sheen;
  final List<BoxShadow> shadow;
  final Color? hairline;

  /// The grain on Lite.
  final double noise;

  /// The same glass with one even tint (see [MmGlass.evenTint]).
  GlassMaterialSpec withoutRim() => GlassMaterialSpec(
    tier: tier,
    tint: tint,
    blur: blur,
    core: core,
    band: band,
    bend: bend,
    lumMax: lumMax,
    lumMin: lumMin,
    saturation: saturation,
    rimLightTop: rimLightTop,
    rimLightMid: rimLightMid,
    rimLightBottom: rimLightBottom,
    sheen: sheen,
    shadow: shadow,
    hairline: hairline,
    noise: noise,
  );

  /// True when the pane reads the backdrop live.
  bool get live => tier.live;

  /// True when the pane runs the lens.
  bool get lens => tier == GlassTier.full;

  /// True when the pane is solid (Off and high contrast).
  bool get opaque => tier == GlassTier.off;

  static const Color _nightBar = Color(0xFF1B1A16);
  static const Color _nightSheet = Color(0xFF1C1A16);
  static const Color _day = Color(0xFFFFFDF8);

  static GlassMaterialSpec of(MmColors colors, GlassKind kind, GlassTier tier, {bool highContrast = false}) {
    final night = colors.isNight;
    if (highContrast) tier = GlassTier.off;
    final base = night ? (kind == GlassKind.sheet || kind == GlassKind.bubble ? _nightSheet : _nightBar) : _day;
    Color a(double alpha) => base.withValues(alpha: alpha);

    // The light. Sheets and bubbles are larger glass: their rim catches 1.2 times the light.
    final lightScale = kind == GlassKind.sheet || kind == GlassKind.bubble ? 1.2 : 1.0;
    Color l(Color c, double alpha) => c.withValues(alpha: (alpha * lightScale).clamp(0.0, 1.0));
    const warm = Color(0xFFFFF6E4);
    const white = Color(0xFFFFFFFF);
    final rimTop = night ? l(warm, 0.30) : l(white, 0.95);
    final rimMid = night ? l(warm, 0.06) : l(white, 0.35);
    final rimBottom = night ? l(warm, 0.10) : l(white, 0.10);
    final sheen = tier == GlassTier.off || highContrast
        ? const Color(0x00000000)
        : (night ? warm.withValues(alpha: 0.07) : white.withValues(alpha: 0.55));

    final shadow = _shadow(colors, kind);
    // Daylight keeps a faint hairline on live glass so the pane's edge holds on paper.
    final dayEdge = night ? null : const Color(0x99D8D1C2);
    final hairline = highContrast
        ? colors.lineStrong
        : tier == GlassTier.off
        ? (night ? const Color(0xFF312E27) : const Color(0xFFD8D1C2))
        : dayEdge;

    final (lumMax, lumMin) = switch (kind) {
      GlassKind.bar || GlassKind.control => night ? (0.14, 0.0) : (1.0, 0.50),
      GlassKind.sheet || GlassKind.bubble => night ? (0.16, 0.0) : (1.0, 0.50),
    };

    GlassMaterialSpec spec({
      required Color tint,
      Color? rimTint,
      double blur = 0,
      double core = 0,
      double band = 0,
      double bend = 0,
      bool clamp = false,
      double noise = 0,
    }) => GlassMaterialSpec(
      tier: tier,
      tint: tint,
      rimTint: rimTint,
      blur: blur,
      core: core,
      band: band,
      bend: bend,
      lumMax: clamp ? lumMax : 1,
      lumMin: clamp ? lumMin : 0,
      saturation: tier.live ? GlassTokens.saturation : 1,
      rimLightTop: rimTop,
      rimLightMid: rimMid,
      rimLightBottom: rimBottom,
      sheen: sheen,
      shadow: shadow,
      hairline: hairline,
      noise: noise,
    );

    return switch ((tier, kind)) {
      (GlassTier.off, _) => spec(tint: colors.raised),
      // The lens: the clamp keeps labels at 4.5:1, so the tint can be thin and content shows.
      (GlassTier.full, GlassKind.bar) => spec(
        tint: a(night ? 0.52 : 0.40),
        blur: GlassTokens.preBlur,
        core: GlassTokens.barCoreBlur,
        band: GlassTokens.barRimBand,
        bend: GlassTokens.barRimBend,
        clamp: true,
      ),
      (GlassTier.full, GlassKind.control) => spec(
        tint: a(night ? 0.50 : 0.56),
        blur: GlassTokens.preBlur,
        core: GlassTokens.barCoreBlur,
        band: GlassTokens.controlRimBand,
        bend: GlassTokens.controlRimBend,
        clamp: true,
      ),
      (GlassTier.full, GlassKind.sheet) => spec(
        tint: a(night ? 0.86 : 0.88),
        rimTint: a(0.50),
        blur: GlassTokens.sheetBlur,
        band: GlassTokens.sheetRimBand,
        bend: GlassTokens.sheetRimBend,
        clamp: true,
      ),
      (GlassTier.full, GlassKind.bubble) => spec(
        tint: a(night ? 0.86 : 0.88),
        rimTint: a(0.50),
        blur: GlassTokens.bubbleBlur,
        band: GlassTokens.bubbleRimBand,
        bend: GlassTokens.bubbleRimBend,
        clamp: true,
      ),
      // Full without the shader: no clamp, so the tint carries legibility.
      (GlassTier.fullBasic, GlassKind.bar || GlassKind.control) => spec(
        tint: a(night ? 0.82 : 0.84),
        blur: GlassTokens.barCoreBlur,
      ),
      // The reading core stays at the 0.985 of device finding 1 (glyphs behind never read); the
      // rim band, where no text sits, thins to 0.72 (Day 0.80, where a thinner rim read as a
      // frame) so the blurred page shows at the edge and the sheet reads as glass rather than a
      // dark panel (build decision 2 in GLASS-1017).
      (GlassTier.fullBasic, GlassKind.sheet) => spec(
        tint: a(0.985),
        rimTint: a(night ? 0.72 : 0.80),
        blur: GlassTokens.sheetBlur,
      ),
      (GlassTier.fullBasic, GlassKind.bubble) => spec(
        tint: a(night ? 0.92 : 0.93),
        blur: GlassTokens.bubbleBlur,
      ),
      (GlassTier.lite, GlassKind.bar || GlassKind.control) => spec(
        tint: a(night ? 0.96 : 0.97),
        noise: night ? 0.03 : 0.02,
      ),
      (GlassTier.lite, _) => spec(tint: a(0.985)),
    };
  }

  static List<BoxShadow> _shadow(MmColors colors, GlassKind kind) {
    final night = colors.isNight;
    const black = Color(0xFF000000);
    const umber = Color(0xFF3A3020);
    BoxShadow s(double y, double blur, Color c, double alpha) =>
        BoxShadow(offset: Offset(0, y), blurRadius: blur, color: c.withValues(alpha: alpha));
    return switch (kind) {
      GlassKind.bar => night
          ? [s(10, 28, black, 0.42), s(1, 2, black, 0.30)]
          : [s(10, 28, umber, 0.16), s(1, 2, umber, 0.12)],
      GlassKind.control => night ? [s(4, 12, black, 0.30)] : [s(4, 12, umber, 0.12)],
      GlassKind.sheet => colors.glassShadow,
      GlassKind.bubble => night
          ? [s(12, 32, black, 0.45), s(1, 2, black, 0.30)]
          : [s(12, 32, umber, 0.18), s(1, 2, umber, 0.12)],
    };
  }

  @override
  bool operator ==(Object other) =>
      other is GlassMaterialSpec &&
      other.tier == tier &&
      other.tint == tint &&
      other.rimTint == rimTint &&
      other.blur == blur &&
      other.core == core &&
      other.band == band &&
      other.bend == bend &&
      other.lumMax == lumMax &&
      other.lumMin == lumMin &&
      other.saturation == saturation &&
      other.rimLightTop == rimLightTop &&
      other.rimLightMid == rimLightMid &&
      other.rimLightBottom == rimLightBottom &&
      other.sheen == sheen &&
      listEquals(other.shadow, shadow) &&
      other.hairline == hairline &&
      other.noise == noise;

  @override
  int get hashCode => Object.hash(
    tier,
    tint,
    rimTint,
    blur,
    core,
    band,
    bend,
    lumMax,
    lumMin,
    saturation,
    rimLightTop,
    rimLightMid,
    rimLightBottom,
    sheen,
    Object.hashAll(shadow),
    hairline,
    noise,
  );
}

/// The legibility arithmetic behind section 5.3's table: what a label's contrast becomes when the
/// glass sits over a large field of one colour (a blur averages a big area into its own colour,
/// which is the worst case). Mirrors the shader: saturation, then the luminosity clamp in linear
/// light with the hue kept, then the tint composited on top.
abstract final class GlassContrast {
  /// The backdrops a label must survive: black, paper white and volt.
  static const List<Color> worstBackdrops = [Color(0xFF000000), Color(0xFFFFFFFF), Color(0xFFD2F000)];

  static double _toLinear(double c) => math.pow(math.max(c, 0), 2.2).toDouble();
  static double _toSrgb(double c) => math.pow(math.max(c, 0), 1 / 2.2).toDouble();

  /// [backdrop] after the lens's saturation lift and clamp.
  static Color lensed(Color backdrop, {double saturation = 1, double lumMax = 1, double lumMin = 0}) {
    var r = backdrop.r, g = backdrop.g, b = backdrop.b;
    final l0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = (l0 + (r - l0) * saturation).clamp(0.0, 1.0);
    g = (l0 + (g - l0) * saturation).clamp(0.0, 1.0);
    b = (l0 + (b - l0) * saturation).clamp(0.0, 1.0);
    var lr = _toLinear(r), lg = _toLinear(g), lb = _toLinear(b);
    final lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    if (lum > lumMax) {
      final k = lumMax / math.max(lum, 0.0001);
      lr *= k;
      lg *= k;
      lb *= k;
    }
    if (lum < lumMin) {
      final lift = (lumMin - lum) / math.max(1 - lum, 0.0001);
      lr += (1 - lr) * lift;
      lg += (1 - lg) * lift;
      lb += (1 - lb) * lift;
    }
    return Color.from(alpha: 1, red: _toSrgb(lr).clamp(0, 1), green: _toSrgb(lg).clamp(0, 1), blue: _toSrgb(lb).clamp(0, 1));
  }

  /// The WCAG contrast ratio of two opaque colours.
  static double ratio(Color a, Color b) {
    final la = a.computeLuminance(), lb = b.computeLuminance();
    return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
  }

  /// The surface a label sits on: [spec]'s reading tint over [backdrop] seen through the glass.
  static Color surface(GlassMaterialSpec spec, Color backdrop) {
    if (spec.opaque) return spec.tint;
    final seen = spec.lens
        ? lensed(backdrop, saturation: spec.saturation, lumMax: spec.lumMax, lumMin: spec.lumMin)
        : spec.live
        ? lensed(backdrop, saturation: spec.saturation)
        : backdrop;
    return Color.alphaBlend(spec.tint, seen);
  }

  /// The lowest contrast [label] reaches on [spec] over any of [backdrops].
  static double worst(Color label, GlassMaterialSpec spec, {Iterable<Color> backdrops = worstBackdrops}) =>
      backdrops.map((b) => ratio(label, surface(spec, b))).reduce(math.min);
}

/// The static light on a pane, as functions of a shape so the bar's painters can call them.
abstract final class GlassLight {
  /// The 1 dp rim light: bright along the top, fading by 42% of the height, a faint return at the
  /// bottom, and the hairline. [boost] brightens it (a press, a nearby finger); [fill] (a sheet
  /// filling the screen) leaves only the top.
  static void paintRim(Canvas canvas, Rect rect, BorderRadius radius, GlassMaterialSpec spec, {double boost = 1, double fill = 0}) {
    if (rect.isEmpty) return;
    final edge = rect.deflate(0.5);
    final hairline = spec.hairline;
    if (hairline != null) {
      drawMmShape(
        canvas,
        radius,
        edge,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = hairline,
      );
    }
    Color s(Color c, double k) => c.withValues(alpha: (c.a * boost * k).clamp(0.0, 1.0));
    drawMmShape(
      canvas,
      radius,
      edge,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = ui.Gradient.linear(
          rect.topCenter,
          rect.bottomCenter,
          [s(spec.rimLightTop, 1), s(spec.rimLightMid, 1 - fill), s(spec.rimLightBottom, 1 - fill)],
          const [0, 0.42, 1],
        ),
    );
  }

  /// The radial sheen under the top edge, gone by mid-height so labels never sit on it.
  static void paintSheen(Canvas canvas, Rect rect, BorderRadius radius, GlassMaterialSpec spec, {double strength = 1}) {
    if (rect.isEmpty || spec.sheen.a == 0 || strength <= 0) return;
    final rx = rect.width * 0.5;
    final ry = math.min(rect.height * 0.5, 72.0);
    canvas.save();
    clipMmShape(canvas, radius, rect);
    canvas.translate(rect.center.dx, rect.top);
    canvas.scale(1, ry / rx);
    canvas.drawCircle(
      Offset.zero,
      rx,
      Paint()
        ..shader = ui.Gradient.radial(Offset.zero, rx, [
          spec.sheen.withValues(alpha: spec.sheen.a * strength),
          spec.sheen.withValues(alpha: 0),
        ]),
    );
    canvas.restore();
  }
}

/// A pane of MockMob Glass with a [borderRadius] shape (sheets, controls, bubbles, the Start
/// key's ground). See the library comment for what it draws.
class MmGlass extends StatefulWidget {
  const MmGlass({
    super.key,
    required this.child,
    this.kind = GlassKind.control,
    this.borderRadius = MmRadius.pillAll,
    this.tier,
    this.quality,
    this.materialize = 1,
    this.fill = 0,
    this.boost = 1,
    this.shadow = true,
    this.evenTint = false,
  });

  final Widget child;
  final GlassKind kind;
  final BorderRadius borderRadius;

  /// Forces a tier (goldens, the lab). High contrast still wins.
  final GlassTier? tier;

  /// Overrides the inherited Glass setting (the lab shows all three side by side).
  final GlassQuality? quality;

  /// How far the glass has materialised, 0 to 1: blur, rim bend and tint grow together (LG-1:
  /// glass arrives by modulating its lensing, never by a flat fade).
  final double materialize;

  /// How far a sheet has filled the screen, 0 to 1: the glass turns into the opaque `raised`
  /// surface and the shadow goes (LG-3).
  final double fill;

  /// Brightens the rim light (a press, a lifted control).
  final double boost;
  final bool shadow;

  /// One density edge to edge, no thinner rim: for a sheet whose content paints an opaque band
  /// to its edges (the Start sheet's title band), where a thinner rim would show a seam.
  final bool evenTint;

  /// The live filter without the lens: a blur over a saturation lift.
  static ui.ImageFilter basicFilter(double sigma, {double saturation = GlassTokens.saturation}) {
    final sat = ui.ColorFilter.matrix(saturationMatrix(saturation));
    if (sigma < 0.05) return sat;
    return ui.ImageFilter.compose(outer: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma), inner: sat);
  }

  /// A saturation matrix (Rec. 709 luma).
  static List<double> saturationMatrix(double s) {
    final k = 1 - s;
    return [
      0.2126 * k + s, 0.7152 * k, 0.0722 * k, 0, 0, //
      0.2126 * k, 0.7152 * k + s, 0.0722 * k, 0, 0,
      0.2126 * k, 0.7152 * k, 0.0722 * k + s, 0, 0,
      0, 0, 0, 1, 0,
    ];
  }

  @override
  State<MmGlass> createState() => _MmGlassState();
}

class _MmGlassState extends State<MmGlass> {
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
    final highContrast = MediaQuery.maybeHighContrastOf(context) ?? false;
    var tier = widget.tier ?? GlassScope.tierOf(context, quality: widget.quality);
    // Full's thin tint is only legible with the lens's clamp: without the lens it is always the
    // thicker "Full without the shader", even when a tier was forced.
    if (tier == GlassTier.full && !GlassShader.ready) tier = GlassTier.fullBasic;
    var spec = GlassMaterialSpec.of(colors, widget.kind, tier, highContrast: highContrast);
    if (widget.evenTint && spec.rimTint != null) spec = spec.withoutRim();
    final m = widget.materialize.clamp(0.0, 1.0);
    final f = widget.fill.clamp(0.0, 1.0);
    final live = spec.live && m > 0 && f < 1;
    _count(live);

    Widget pane = CustomPaint(
      painter: _GlassFillPainter(spec: spec, radius: widget.borderRadius, materialize: m, fill: f, solid: colors.raised),
      foregroundPainter: _GlassRimPainter(spec: spec, radius: widget.borderRadius, boost: widget.boost, fill: f),
      child: widget.child,
    );
    if (live) {
      pane = GlassBackdrop(spec: spec, borderRadius: widget.borderRadius, strength: m * (1 - f), child: pane);
    }
    pane = MmClip(borderRadius: widget.borderRadius, child: pane);

    final shadowK = m * (1 - f);
    if (!widget.shadow || spec.shadow.isEmpty || shadowK <= 0) return pane;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: isPillRadius(widget.borderRadius) ? MmRadius.pillAll : widget.borderRadius,
        boxShadow: [for (final s in spec.shadow) s.copyWith(color: s.color.withValues(alpha: s.color.a * shadowK))],
      ),
      child: pane,
    );
  }
}

/// The live backdrop of one pane, already clipped by its parent: the lens when [spec] asks for it
/// and the phone can run it, otherwise [MmGlass.basicFilter]. Shares the shell's backdrop snapshot
/// when there is a `BackdropGroup` above it. [strength] (0 to 1) scales the blur, the bend and the
/// clamp while the pane materialises.
class GlassBackdrop extends StatelessWidget {
  const GlassBackdrop({super.key, required this.spec, required this.borderRadius, required this.child, this.strength = 1});

  final GlassMaterialSpec spec;
  final BorderRadius borderRadius;
  final double strength;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = strength.clamp(0.0, 1.0);
    if (spec.lens && GlassShader.ready) {
      return _LensBackdrop(
        spec: spec,
        radius: borderRadius,
        strength: k,
        devicePixelRatio: MediaQuery.maybeDevicePixelRatioOf(context) ?? 1,
        backdropKey: BackdropGroup.of(context)?.backdropKey,
        child: child,
      );
    }
    // Without the lens, Full's pre-blur plus core becomes one blur of the core's strength.
    final sigma = spec.lens ? spec.blur + spec.core : spec.blur;
    return BackdropFilter.grouped(filter: MmGlass.basicFilter(sigma * k, saturation: 1 + (spec.saturation - 1) * k), child: child);
  }
}

class _LensBackdrop extends SingleChildRenderObjectWidget {
  const _LensBackdrop({
    required this.spec,
    required this.radius,
    required this.strength,
    required this.devicePixelRatio,
    required this.backdropKey,
    required super.child,
  });

  final GlassMaterialSpec spec;
  final BorderRadius radius;
  final double strength;
  final double devicePixelRatio;
  final BackdropKey? backdropKey;

  @override
  _RenderLens createRenderObject(BuildContext context) => _RenderLens(spec, radius, strength, devicePixelRatio, backdropKey);

  @override
  void updateRenderObject(BuildContext context, _RenderLens renderObject) {
    renderObject
      ..spec = spec
      ..radius = radius
      ..strength = strength
      ..devicePixelRatio = devicePixelRatio
      ..backdropKey = backdropKey;
  }
}

/// Writes the pane's rect into the lens each paint (the rect is in the filter's pixel space) and
/// pushes one backdrop layer: compose(lens, blur).
class _RenderLens extends RenderProxyBox {
  _RenderLens(this._spec, this._radius, this._strength, this._dpr, this._backdropKey);

  GlassMaterialSpec _spec;
  set spec(GlassMaterialSpec v) {
    if (v == _spec) return;
    _spec = v;
    markNeedsPaint();
  }

  BorderRadius _radius;
  set radius(BorderRadius v) {
    if (v == _radius) return;
    _radius = v;
    markNeedsPaint();
  }

  double _strength;
  set strength(double v) {
    if (v == _strength) return;
    _strength = v;
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

  ui.FragmentShader? _shader;

  @override
  bool get alwaysNeedsCompositing => child != null;

  @override
  BackdropFilterLayer? get layer => super.layer as BackdropFilterLayer?;

  @override
  void paint(PaintingContext context, Offset offset) {
    if (child == null) return;
    final shader = _shader ??= GlassShader.newShader();
    if (shader == null) {
      layer = null;
      super.paint(context, offset);
      return;
    }
    final k = _strength;
    final origin = localToGlobal(Offset.zero);
    final rect = Rect.fromLTWH(origin.dx * _dpr, origin.dy * _dpr, size.width * _dpr, size.height * _dpr);
    final r = isPillRadius(_radius) ? size.shortestSide / 2 : _radius.topLeft.x;
    GlassLens(
      rect: rect,
      radius: r * _dpr,
      band: _spec.band * _dpr,
      bend: _spec.bend * _dpr * k,
      core: _spec.core * _dpr * k,
      lumMax: 1 + (_spec.lumMax - 1) * k,
      lumMin: _spec.lumMin * k,
      saturation: 1 + (_spec.saturation - 1) * k,
      grid: kDebugMode && GlassShader.gridByDefine ? 24 * _dpr : 0,
    ).apply(shader);
    final filter = ui.ImageFilter.compose(outer: ui.ImageFilter.shader(shader), inner: MmGlass.basicFilter(_spec.blur * k, saturation: 1));
    final l = layer ?? BackdropFilterLayer();
    l
      ..filter = filter
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

/// The tint (feathered from rim to core on sheets), Lite's grain and the sheen.
class _GlassFillPainter extends CustomPainter {
  const _GlassFillPainter({required this.spec, required this.radius, required this.materialize, required this.fill, required this.solid});

  final GlassMaterialSpec spec;
  final BorderRadius radius;
  final double materialize;
  final double fill;
  final Color solid;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    final m = materialize;
    final f = fill;

    // The tint grows from thin to its resting density as the glass materialises, then turns into
    // the opaque surface as a sheet fills the screen.
    double ramp(double alpha) {
      final from = math.min(GlassTokens.materializeFrom, alpha);
      final a = from + (alpha - from) * m;
      return a + (1 - a) * f;
    }

    Color tone(Color c) => Color.lerp(c.withValues(alpha: 1), solid, f)!;

    final core = spec.tint;
    final rim = spec.rimTint;
    if (spec.opaque) {
      drawMmShape(canvas, radius, rect, Paint()..color = core);
    } else if (rim == null || f >= 1) {
      drawMmShape(canvas, radius, rect, Paint()..color = tone(core).withValues(alpha: ramp(core.a)));
    } else {
      final rimA = ramp(rim.a);
      final coreA = ramp(core.a);
      drawMmShape(canvas, radius, rect, Paint()..color = tone(rim).withValues(alpha: rimA));
      if (coreA > rimA) {
        // Painting the same colour again at a' over the rim gives coreA where it is solid:
        // rimA + a' (1 - rimA) = coreA. A blurred inner shape feathers it across 12 to 20 dp.
        final inner = (coreA - rimA) / (1 - rimA);
        const mid = (GlassTokens.featherFrom + GlassTokens.featherTo) / 2;
        const sigma = (GlassTokens.featherTo - GlassTokens.featherFrom) / 2;
        final innerRect = rect.deflate(mid);
        if (!innerRect.isEmpty) {
          final rr = RRect.fromRectAndCorners(
            innerRect,
            topLeft: _shrink(radius.topLeft, mid),
            topRight: _shrink(radius.topRight, mid),
            bottomLeft: _shrink(radius.bottomLeft, mid),
            bottomRight: _shrink(radius.bottomRight, mid),
          );
          canvas.save();
          clipMmShape(canvas, radius, rect);
          canvas.drawRRect(
            rr,
            Paint()
              ..color = tone(core).withValues(alpha: inner)
              ..maskFilter = const MaskFilter.blur(BlurStyle.normal, sigma),
          );
          canvas.restore();
        }
      }
    }

    if (spec.noise > 0 && f < 1) {
      canvas.save();
      clipMmShape(canvas, radius, rect);
      GrainPainter(opacity: spec.noise * (1 - f)).paint(canvas, size);
      canvas.restore();
    }
    GlassLight.paintSheen(canvas, rect, radius, spec, strength: m * (1 - f));
  }

  static Radius _shrink(Radius r, double by) => Radius.circular(math.max(0, math.min(r.x, 400) - by));

  @override
  bool shouldRepaint(_GlassFillPainter old) =>
      old.spec != spec || old.radius != radius || old.materialize != materialize || old.fill != fill || old.solid != solid;
}

class _GlassRimPainter extends CustomPainter {
  const _GlassRimPainter({required this.spec, required this.radius, required this.boost, required this.fill});

  final GlassMaterialSpec spec;
  final BorderRadius radius;
  final double boost;
  final double fill;

  @override
  void paint(Canvas canvas, Size size) => GlassLight.paintRim(canvas, Offset.zero & size, radius, spec, boost: boost, fill: fill);

  @override
  bool shouldRepaint(_GlassRimPainter old) => old.spec != spec || old.radius != radius || old.boost != boost || old.fill != fill;
}
