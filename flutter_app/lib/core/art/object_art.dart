import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../motion/motion.dart';
import 'emblem_painter.dart';
import 'emblem_palette.dart';
import 'subject_identity.dart';

/// A subject's photo-real object: the lamp-lit render in `assets/art/obj-*.webp` (a red ledger
/// tied with string for Accountancy, a brass stamp for Business Studies, a scale with an onion for
/// Economics, ...). Fifteen subjects have their own; the CUET language papers share the open
/// notebook. A subject the art does not know has none and keeps its initials card, never a wrong
/// object.
///
/// Each entry knows its pixel size (so the box is laid out before the file is decoded and nothing
/// shifts when it arrives) and where its foot stands, so the contact shadow sits under the object
/// and not under the empty corner of its picture.
@immutable
class SubjectRender {
  const SubjectRender._(this.name, this.width, this.height, {required this.footX, required this.footWidth, required this.ground});

  /// The file name without `obj-` and `.webp` (`business`, `generaltest`, `language`).
  final String name;

  /// The render's size in pixels.
  final int width;
  final int height;

  /// The centre of the object's footprint, as a share of [width].
  final double footX;

  /// How wide the footprint is, as a share of [width].
  final double footWidth;

  /// Where the object meets the ground, as a share of [height].
  final double ground;

  /// The asset path.
  String get asset => 'assets/art/obj-$name.webp';

  /// Width over height.
  double get aspect => width / height;

  /// The render for [kind], or null for [EmblemKind.other].
  static SubjectRender? forKind(EmblemKind kind) => switch (kind) {
        EmblemKind.accountancy => accountancy,
        EmblemKind.businessStudies => business,
        EmblemKind.economics => economics,
        EmblemKind.english => english,
        EmblemKind.generalTest => generalTest,
        EmblemKind.mathematics => mathematics,
        EmblemKind.physics => physics,
        EmblemKind.chemistry => chemistry,
        EmblemKind.biology => biology,
        EmblemKind.history => history,
        EmblemKind.politicalScience => politicalScience,
        EmblemKind.geography => geography,
        EmblemKind.psychology => psychology,
        EmblemKind.sociology => sociology,
        EmblemKind.computerScience => computerScience,
        EmblemKind.language => language,
        EmblemKind.other => null,
      };

  /// The render for any subject id the app meets, normalised as [SubjectIdentity.of] does
  /// (`business_studies` and `bst` to the stamp, `gat` to the cube, `hindi` to the notebook).
  /// Null for no id and for a subject the art does not know.
  static SubjectRender? of(String? subjectId) {
    final identity = SubjectIdentity.of(subjectId);
    return identity == null ? null : forKind(identity.kind);
  }

  // Sizes are the files' own; feet were measured from each file's alpha (the lowest opaque rows),
  // widened a little for the objects drawn in three-quarter view, whose foot is a slanted plane.
  static const accountancy = SubjectRender._('accountancy', 512, 338, footX: 0.53, footWidth: 0.80, ground: 0.90);
  static const business = SubjectRender._('business', 456, 512, footX: 0.50, footWidth: 0.88, ground: 0.955);
  static const economics = SubjectRender._('economics', 403, 512, footX: 0.50, footWidth: 0.88, ground: 0.96);
  static const english = SubjectRender._('english', 512, 316, footX: 0.48, footWidth: 0.80, ground: 0.88);
  static const generalTest = SubjectRender._('generaltest', 512, 406, footX: 0.50, footWidth: 0.86, ground: 0.93);
  static const mathematics = SubjectRender._('mathematics', 512, 355, footX: 0.52, footWidth: 0.80, ground: 0.90);
  static const physics = SubjectRender._('physics', 512, 461, footX: 0.50, footWidth: 0.88, ground: 0.95);
  static const chemistry = SubjectRender._('chemistry', 504, 512, footX: 0.50, footWidth: 0.88, ground: 0.955);
  static const biology = SubjectRender._('biology', 298, 512, footX: 0.50, footWidth: 0.86, ground: 0.955);
  static const history = SubjectRender._('history', 512, 352, footX: 0.50, footWidth: 0.88, ground: 0.92);
  static const politicalScience = SubjectRender._('politicalscience', 512, 393, footX: 0.50, footWidth: 0.84, ground: 0.94);
  static const geography = SubjectRender._('geography', 363, 512, footX: 0.50, footWidth: 0.58, ground: 0.955);
  static const psychology = SubjectRender._('psychology', 512, 509, footX: 0.53, footWidth: 0.72, ground: 0.955);
  static const sociology = SubjectRender._('sociology', 512, 410, footX: 0.50, footWidth: 0.90, ground: 0.945);
  static const computerScience = SubjectRender._('computerscience', 512, 389, footX: 0.52, footWidth: 0.80, ground: 0.90);
  static const language = SubjectRender._('language', 512, 300, footX: 0.56, footWidth: 0.74, ground: 0.90);

  /// Every render, one per file.
  static const List<SubjectRender> all = [
    accountancy, business, economics, english, generalTest, mathematics, physics, chemistry, //
    biology, history, politicalScience, geography, psychology, sociology, computerScience, language,
  ];

  /// Where the picture sits in a [side] box: centred and wholly inside it, with room under it for
  /// the contact shadow and above it for the idle float. On a framed tile it stands inside the
  /// tile's margin. Never cropped.
  Rect rectIn(double side, {required bool framed}) {
    final inner = framed
        ? Rect.fromLTRB(side * 0.13, side * 0.11, side * 0.87, side * 0.85)
        : Rect.fromLTRB(side * 0.03, side * 0.04, side * 0.97, side * 0.92);
    final fitted = applyBoxFit(BoxFit.contain, Size(width.toDouble(), height.toDouble()), inner.size).destination;
    return Alignment.center.inscribe(fitted, inner);
  }

  /// The decode width for a [side] box at [devicePixelRatio]: the drawn width in device pixels,
  /// never more than the file holds.
  int cacheWidth(double side, double devicePixelRatio, {required bool framed}) {
    final px = (rectIn(side, framed: framed).width * devicePixelRatio).round();
    return px.clamp(1, width);
  }

  /// The image the emblem draws at [side] (decoded at the drawn size). Precache this exact
  /// provider to have the object on the first frame.
  ImageProvider provider(double side, double devicePixelRatio, {required bool framed}) =>
      ResizeImage.resizeIfNeeded(cacheWidth(side, devicePixelRatio, framed: framed), null, AssetImage(asset));

  /// Decodes [subjectId]'s object for a [size] emblem ahead of time, so a hero shows it on its
  /// first frame. Completes at once for a subject without a render.
  static Future<void> precache(BuildContext context, String? subjectId, double size, {bool framed = true}) {
    final render = of(subjectId);
    if (render == null || !size.isFinite || size <= 0) return Future<void>.value();
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? View.of(context).devicePixelRatio;
    return precacheImage(render.provider(size, dpr, framed: framed), context);
  }

  @override
  String toString() => 'SubjectRender($name)';
}

/// How high an object floats at [idle] (0 to 1 over the cycle; 0 means still) with its subject's
/// [phase]: 0 on the ground, 1 at the top of the float.
double objectLift(double idle, double phase) {
  if (idle == 0) return 0;
  final t = (idle + phase) % 1.0;
  return (1 - math.cos(t * 2 * math.pi)) / 2;
}

/// The photo-real object of a subject emblem: the render, centred and contained in its box with
/// a soft contact shadow under it, on a quiet well when [framed] (warm dark on Night, warm paper
/// on Daylight). The subject's colour is not painted behind it: the object is the colour.
///
/// [SubjectEmblem] builds this when [SubjectEmblem.objectArt] is on and the size is 40 dp or
/// more; it owns the controllers and the semantics.
class ObjectEmblem extends StatelessWidget {
  const ObjectEmblem({
    super.key,
    required this.render,
    required this.size,
    required this.palette,
    required this.framed,
    required this.selectable,
    required this.idle,
    required this.ink,
    required this.phase,
    required this.reduced,
    required this.onMissing,
  });

  final SubjectRender render;
  final double size;
  final EmblemPalette palette;
  final bool framed;
  final bool selectable;

  /// 0 to 1 over the idle cycle; stays at 0 when the object is still.
  final ValueListenable<double> idle;

  /// How marked the emblem is (0 to 1).
  final Animation<double> ink;
  final double phase;
  final bool reduced;

  /// Called once when the file cannot be loaded; the emblem then draws its vector object.
  final VoidCallback onMissing;

  /// How far the object floats at the top of its cycle, as a share of the box.
  static const double rise = 0.03;

  /// How far it leans as it floats, in degrees.
  static const double tilt = 1.2;

  @override
  Widget build(BuildContext context) {
    final side = size;
    final rect = render.rectIn(side, framed: framed);
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 1.0;
    final night = palette.isNight;
    // The ground point in the picture's own box: the float leans about it.
    final foot = Offset(rect.width * render.footX, rect.height * render.ground);

    final image = Image.asset(
      render.asset,
      width: rect.width,
      height: rect.height,
      fit: BoxFit.contain,
      cacheWidth: render.cacheWidth(side, dpr, framed: framed),
      filterQuality: FilterQuality.medium,
      gaplessPlayback: true,
      excludeFromSemantics: true,
      frameBuilder: (context, child, frame, synchronous) {
        if (synchronous || reduced) return child;
        // First decode off the cache: the object settles in rather than popping.
        return AnimatedOpacity(opacity: frame == null ? 0 : 1, duration: Motion.ui, curve: Motion.out, child: child);
      },
      errorBuilder: (context, error, stack) {
        onMissing();
        return const SizedBox.shrink();
      },
    );

    Widget stack = Stack(
      clipBehavior: Clip.none,
      children: [
        if (framed) Positioned.fill(child: CustomPaint(painter: _WellPainter(palette: palette, ink: ink, side: side))),
        Positioned.fill(
          child: CustomPaint(
            painter: _ContactShadowPainter(
              night: night,
              framed: framed,
              center: rect.topLeft + foot,
              footWidth: rect.width * render.footWidth,
              idle: idle,
              phase: phase,
            ),
          ),
        ),
        Positioned.fromRect(
          rect: rect,
          child: AnimatedBuilder(
            animation: idle,
            child: image,
            builder: (context, child) {
              final lift = objectLift(idle.value, phase);
              final matrix = Matrix4.translationValues(0, -side * rise * lift, 0)..rotateZ(-tilt * math.pi / 180 * lift);
              return Transform(transform: matrix, origin: foot, child: child);
            },
          ),
        ),
        Positioned.fill(
          child: CustomPaint(painter: _MarkPainter(palette: palette, ink: ink, framed: framed, object: rect, side: side)),
        ),
      ],
    );

    if (selectable) {
      // Unmarked it sits slightly small and dimmed; marked it lifts to full size.
      stack = AnimatedBuilder(
        animation: ink,
        child: stack,
        builder: (context, child) {
          final k = ink.value.clamp(0.0, 1.0);
          return Opacity(
            opacity: 0.6 + 0.4 * k,
            child: Transform.scale(scale: framed ? 0.92 + 0.06 * k : 0.94 + 0.08 * k, child: child),
          );
        },
      );
    }
    return SizedBox.square(dimension: side, child: stack);
  }
}

/// The tile's plain outline in the 100 unit space: a rounded square, no fold, no print.
Path objectWellPath() => Path()..addRRect(RRect.fromLTRBR(0, 0, 100, 100, const Radius.circular(24)));

/// The quiet surface under a framed object: a warm dark well on Night (lit from the upper left by
/// the desk lamp, darker at its rim, a faint lip at its foot) and warm paper on Daylight (a
/// hairline edge, white light along its top). It carries no subject colour, so the object is the
/// only colour in the tile. The volt ring is drawn here when the emblem is marked.
class _WellPainter extends CustomPainter {
  _WellPainter({required this.palette, required this.ink, required this.side}) : super(repaint: ink);

  final EmblemPalette palette;
  final Animation<double> ink;
  final double side;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide / 100;
    canvas.save();
    canvas.scale(s);
    final path = objectWellPath();
    final hair = 1 / s; // one dp in the 100 unit space
    if (palette.isNight) {
      canvas.drawPath(
        path,
        Paint()
          ..shader = ui.Gradient.linear(const Offset(0, 0), const Offset(0, 100), const [Color(0xFF1D1A15), Color(0xFF16140F), Color(0xFF100E0B)], const [0, 0.55, 1]),
      );
      canvas.save();
      canvas.clipPath(path);
      // The lamp's pool, behind the object.
      canvas.drawCircle(
        const Offset(34, 30),
        74,
        Paint()..shader = ui.Gradient.radial(const Offset(34, 30), 74, const [Color(0x2BF2A93B), Color(0x0FF2A93B), Color(0x00F2A93B)], const [0, 0.45, 1]),
      );
      // The well's inner shade: the rim sits above the floor, so the floor darkens toward it.
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 9
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5)
          ..color = const Color(0x8C000000),
      );
      canvas.restore();
      // The rim: dark along the top where it overhangs, a faint warm lip at the foot.
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = hair
          ..shader = ui.Gradient.linear(
            const Offset(0, 0),
            const Offset(0, 100),
            const [Color(0x66000000), Color(0x14FFF6E4), Color(0x29FFF6E4)],
            const [0, 0.6, 1],
          ),
      );
    } else {
      canvas.drawPath(
        path,
        Paint()
          ..shader = ui.Gradient.linear(const Offset(0, 0), const Offset(0, 100), const [Color(0xFFFCF8F0), Color(0xFFF5EFE3), Color(0xFFEDE5D5)], const [0, 0.5, 1]),
      );
      canvas.save();
      canvas.clipPath(path);
      canvas.drawCircle(
        const Offset(34, 30),
        74,
        Paint()..shader = ui.Gradient.radial(const Offset(34, 30), 74, const [Color(0x1FF2A93B), Color(0x00F2A93B)]),
      );
      canvas.restore();
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = hair
          ..shader = ui.Gradient.linear(
            const Offset(0, 0),
            const Offset(0, 100),
            const [Color(0xFFE6DFD0), Color(0xFFD8D1C2), Color(0xFFC9C0AE)],
            const [0, 0.5, 1],
          ),
      );
      // White light along the top edge.
      canvas.drawPath(
        path.shift(Offset(0, hair)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = hair
          ..shader = ui.Gradient.linear(const Offset(0, 0), const Offset(0, 30), const [Color(0xE6FFFFFF), Color(0x00FFFFFF)]),
      );
    }
    paintSelectionRing(canvas, palette, EmblemDetail.tile, ink.value.clamp(0.0, 1.0), shape: path);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_WellPainter old) => old.palette != palette || old.ink != ink || old.side != side;
}

/// The soft shadow the object casts where it stands: a tight dark contact under its foot and a
/// wider, fainter occlusion, both nudged to the lower right (the lamp is upper left). On Daylight
/// they are sepia, not grey, so the object sits on the paper instead of looking pasted on it. As
/// the object floats the shadow tightens and fades.
class _ContactShadowPainter extends CustomPainter {
  _ContactShadowPainter({
    required this.night,
    required this.framed,
    required this.center,
    required this.footWidth,
    required this.idle,
    required this.phase,
  }) : super(repaint: idle);

  final bool night;
  final bool framed;
  final Offset center;
  final double footWidth;
  final ValueListenable<double> idle;
  final double phase;

  static const Color _nightShade = Color(0xFF000000);
  static const Color _dayShade = Color(0xFF3B2A14);

  void _ellipse(Canvas canvas, Offset c, double rx, double ry, Color color) {
    if (rx <= 0 || ry <= 0) return;
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.scale(1, ry / rx);
    canvas.drawCircle(
      Offset.zero,
      rx,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset.zero,
          rx,
          [color, color.withValues(alpha: color.a * 0.55), color.withValues(alpha: color.a * 0.18), color.withValues(alpha: 0)],
          const [0, 0.4, 0.72, 1],
        ),
    );
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final lift = objectLift(idle.value, phase);
    final spread = 1 - 0.14 * lift;
    final fade = 1 - 0.35 * lift;
    final shade = night ? _nightShade : _dayShade;
    final occlusion = (night ? (framed ? 0.62 : 0.55) : 0.20) * fade;
    final contact = (night ? 0.80 : 0.34) * fade;
    final w = footWidth * spread;
    _ellipse(canvas, center + Offset(w * 0.04, w * 0.015), w * 0.64, w * 0.12, shade.withValues(alpha: occlusion));
    _ellipse(canvas, center + Offset(w * 0.02, -w * 0.005), w * 0.47, w * 0.055, shade.withValues(alpha: contact));
  }

  @override
  bool shouldRepaint(_ContactShadowPainter old) =>
      old.night != night || old.framed != framed || old.center != center || old.footWidth != footWidth || old.idle != idle || old.phase != phase;
}

/// The mark: on a framed tile the volt tick in its lower right corner (the ring is on the well);
/// on an open emblem one inked volt bubble at the object's lower right, the sheet's mark.
class _MarkPainter extends CustomPainter {
  _MarkPainter({required this.palette, required this.ink, required this.framed, required this.object, required this.side}) : super(repaint: ink);

  final EmblemPalette palette;
  final Animation<double> ink;
  final bool framed;
  final Rect object;
  final double side;

  @override
  void paint(Canvas canvas, Size size) {
    final k = ink.value.clamp(0.0, 1.0);
    if (k <= 0.02) return;
    if (framed) {
      final s = size.shortestSide / 100;
      canvas.save();
      canvas.scale(s);
      paintSelectedBadge(canvas, palette, k);
      canvas.restore();
      return;
    }
    final p = palette;
    final r = math.max(3.5, side * 0.07);
    final c = Offset(math.min(object.right, side - r - 1) - r * 0.4, math.min(object.bottom, side - r - 1) - r * 0.3);
    final pop = Curves.easeOutBack.transform(k);
    if (p.isNight) {
      canvas.drawCircle(c, r * 2.6, Paint()..shader = ui.Gradient.radial(c, r * 2.6, [p.voltGlow.withValues(alpha: p.voltGlow.a * k), p.voltGlow.withValues(alpha: 0)]));
    }
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.scale(pop);
    // A dark seat under the bubble so it holds on any part of the render.
    canvas.drawCircle(Offset.zero, r + 1.4, Paint()..color = p.isNight ? const Color(0xE60E0C09) : p.voltRing);
    canvas.drawCircle(Offset.zero, r, Paint()..color = p.volt);
    canvas.drawCircle(Offset(-r * 0.34, -r * 0.38), r * 0.26, Paint()..color = const Color(0x8CFFFFFF));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarkPainter old) => old.palette != palette || old.ink != ink || old.framed != framed || old.object != object || old.side != side;
}
