import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import 'logo_geometry.g.dart';

/// The arrangements of the logo.
enum BrandLogoForm {
  /// The whole word "mockmob", Mobi as the second o.
  wordmark,

  /// "mo" alone: the m before Mobi, and Mobi (the app icon's letters), no tile.
  mo,

  /// "mo" on the charcoal app-icon tile, cropped like the launcher icon.
  icon,
}

/// Where one letter of the word is during an animation. All values are font units in word
/// coordinates (y down, baseline at 0), so a pose holds at any painted size.
@immutable
class LogoGlyphPose {
  const LogoGlyphPose({this.offset = Offset.zero, this.opacity = 1, this.clip, this.scaleX = 1, this.hingeX = 0});

  /// Added to the letter's place in the word.
  final Offset offset;

  /// 0 to 1. Zero skips the letter.
  final double opacity;

  /// The letter shows only inside this rect (word coordinates), for clipped reveals.
  final Rect? clip;

  /// Horizontal scale about [hingeX], for a letter unfolding on a hinge like a paper flap (0 is
  /// folded flat, and skips the letter; 1 is open).
  final double scaleX;

  /// The hinge, in the letter's own units (x from its pen position).
  final double hingeX;

  static const LogoGlyphPose rest = LogoGlyphPose();
}

/// Mobi's face inside the logo.
@immutable
class MobiFacePose {
  const MobiFacePose({this.blink = 0, this.look = Offset.zero, this.ink, this.eyesToSmall, this.detail, this.bodyToSmall});

  /// 0 open, 1 closed.
  final double blink;

  /// Where the eyes look, -1 to 1 of the room they have inside the visor on each axis.
  final Offset look;

  /// How far the empty answer-bubble eye is inked, 0 to 1. Only the full master has a ring eye;
  /// null draws the static logo.
  final double? ink;

  /// When set (0 to 1), the eyes are drawn between the full master's narrow eyes (0) and the
  /// small master's (1) whatever the body's master, so an animation that crosses a size threshold
  /// does not pop.
  final double? eyesToSmall;

  /// Forces a detail master; null picks it by the painted size.
  final LogoDetail? detail;

  /// When set (0 to 1), the body crossfades from the full master's (the flap cut) to the small
  /// master's, whatever [detail] says, so an animation that crosses the size threshold does not
  /// pop. The eyes follow [eyesToSmall].
  final double? bodyToSmall;

  static const MobiFacePose rest = MobiFacePose();
}

/// A whole pose of the logo: the view (which part of the word fills the box) plus per-letter and
/// face poses. The default is the static logo.
@immutable
class LogoPose {
  const LogoPose({this.view, this.glyphs = const [], this.mobi = MobiFacePose.rest});

  /// The word-coordinate rect fitted (contain, centred) into the painted box. Null uses the
  /// form's own bounds ([BrandLogo.boundsOf]).
  final Rect? view;

  /// Indexed by position in "mockmob" (0 to 6; [LogoGeometry.mobiIndex] is Mobi). Missing entries
  /// are at rest.
  final List<LogoGlyphPose> glyphs;
  final MobiFacePose mobi;

  LogoGlyphPose glyph(int index) => index < glyphs.length ? glyphs[index] : LogoGlyphPose.rest;

  static const LogoPose rest = LogoPose();
}

/// The MockMob logo, final B "Closing Mobi", painted from [LogoGeometry] (no font, no image).
///
/// Letters take [color] (the theme's ink by default; warm white on the icon tile). Mobi is always
/// the volt body with the charcoal visor and warm-white eyes. The detail master follows the
/// painted size: full (flap cut, one inked eye and one empty bubble) when Mobi is at least 96
/// physical px tall, small (both eyes filled) from 11 px, micro (visor only) below.
class BrandLogo extends StatelessWidget {
  /// The word, [em] dp to the em (the font size); it is about 4.5 em wide and 0.7 em tall.
  const BrandLogo.wordmark({
    super.key,
    this.em = 32,
    this.color,
    this.pose = LogoPose.rest,
    this.detail,
    this.semanticLabel = 'MockMob',
  })  : form = BrandLogoForm.wordmark,
        size = null,
        tile = false;

  /// "mo" alone at [em] dp to the em.
  const BrandLogo.mo({
    super.key,
    this.em = 32,
    this.color,
    this.pose = LogoPose.rest,
    this.detail,
    this.semanticLabel = 'MockMob',
  })  : form = BrandLogoForm.mo,
        size = null,
        tile = false;

  /// The app icon: "mo" in a [size] dp square, cropped like the launcher icon, on the charcoal
  /// tile unless [tile] is false.
  const BrandLogo.icon({
    super.key,
    double this.size = 64,
    this.tile = true,
    this.color,
    this.pose = LogoPose.rest,
    this.detail,
    this.semanticLabel,
  })  : form = BrandLogoForm.icon,
        em = 0;

  final BrandLogoForm form;
  final double em;
  final double? size;
  final bool tile;

  /// Letter colour. Null: warm white on the tile, the theme's ink elsewhere.
  final Color? color;
  final LogoPose pose;

  /// Forces a detail master; null picks it by size.
  final LogoDetail? detail;

  /// Null hides the logo from screen readers (when a neighbour already says the name).
  final String? semanticLabel;

  /// The "mo" ink: the left of the m before Mobi to Mobi's right, Mobi's top to its bottom.
  static Rect get moBounds {
    final m = LogoGeometry.iconM;
    final mobi = LogoGeometry.mobiSmall;
    return Rect.fromLTRB(m.x + m.bounds.left, mobi.bounds.top, mobi.x + mobi.bounds.right, mobi.bounds.bottom);
  }

  /// The word-coordinate rect a form fills.
  static Rect boundsOf(BrandLogoForm form) => switch (form) {
        BrandLogoForm.wordmark => LogoGeometry.wordBounds,
        BrandLogoForm.mo => moBounds,
        BrandLogoForm.icon => LogoGeometry.iconCrop,
      };

  /// The box the logo takes for a form at [em] dp to the em.
  static Size sizeFor(BrandLogoForm form, double em) => boundsOf(form).size * (em / LogoGeometry.unitsPerEm);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final onTile = form == BrandLogoForm.icon && tile;
    final box = form == BrandLogoForm.icon ? Size.square(size!) : sizeFor(form, em);
    final painted = CustomPaint(
      size: box,
      painter: BrandLogoPainter(
        form: form,
        letterColor: color ?? (onTile ? LogoGeometry.warmWhite : colors.ink),
        devicePixelRatio: MediaQuery.maybeDevicePixelRatioOf(context) ?? 2,
        pose: detail == null ? pose : LogoPose(view: pose.view, glyphs: pose.glyphs, mobi: _withDetail(pose.mobi, detail!)),
        tile: onTile,
        tileEdge: colors.isNight ? colors.edgeTop : null,
      ),
    );
    if (semanticLabel == null) return ExcludeSemantics(child: painted);
    return Semantics(image: true, label: semanticLabel, excludeSemantics: true, child: painted);
  }

  static MobiFacePose _withDetail(MobiFacePose p, LogoDetail d) =>
      MobiFacePose(blink: p.blink, look: p.look, ink: p.ink, eyesToSmall: p.eyesToSmall, detail: d, bodyToSmall: p.bodyToSmall);
}

/// Paints the logo. Paths are parsed once and cached; a frame only transforms and fills them, so
/// an animation driving [poseOf] through [repaint] costs paint, never layout.
class BrandLogoPainter extends CustomPainter {
  BrandLogoPainter({
    required this.form,
    required this.letterColor,
    required this.devicePixelRatio,
    this.pose = LogoPose.rest,
    this.poseOf,
    this.tile = false,
    this.tileEdge,
    super.repaint,
  });

  final BrandLogoForm form;
  final Color letterColor;
  final double devicePixelRatio;
  final LogoPose pose;

  /// Read at paint time instead of [pose] (with [repaint], for animations).
  final LogoPose Function(Size size)? poseOf;
  final bool tile;

  /// A hairline round the tile so it holds its shape on a ground of the same charcoal.
  final Color? tileEdge;

  static final Expando<Path> _paths = Expando<Path>('logo paths');
  static final Expando<Rect> _holes = Expando<Rect>('ring holes');

  static Path _path(LogoPathData d) => _paths[d] ??= d.toPath();

  /// The ring eye's hole, from the second contour of its path.
  static Rect _hole(LogoPathData ring) => _holes[ring] ??= () {
        final metrics = _path(ring).computeMetrics().toList();
        return metrics.length > 1 ? metrics[1].extractPath(0, metrics[1].length).getBounds() : Rect.zero;
      }();

  static final int _iconMIndex = LogoGeometry.mobiIndex - 1;

  /// The physical-pixel scale at which the logo will be painted for [view] in [size].
  static double scaleFor(Rect view, Size size) => math.min(size.width / view.width, size.height / view.height);

  /// The detail master [paint] picks for [form] in [size] at [devicePixelRatio], unless a pose
  /// forces one.
  static LogoDetail detailFor(BrandLogoForm form, Size size, double devicePixelRatio, {LogoPose pose = LogoPose.rest}) =>
      pose.mobi.detail ?? LogoGeometry.detailForScale(scaleFor(pose.view ?? BrandLogo.boundsOf(form), size) * devicePixelRatio);

  @override
  void paint(Canvas canvas, Size size) {
    final p = poseOf?.call(size) ?? pose;
    if (tile) _paintTile(canvas, size);
    paintPose(canvas, size, p, form: form, letterColor: letterColor, devicePixelRatio: devicePixelRatio);
  }

  void _paintTile(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final shape = BorderRadius.circular(size.shortestSide * 0.2236).toRSuperellipse(rect);
    canvas.drawRSuperellipse(shape, Paint()..color = LogoGeometry.charcoal);
    if (tileEdge != null) {
      canvas.drawRSuperellipse(
        BorderRadius.circular(size.shortestSide * 0.2236).toRSuperellipse(rect.deflate(0.5)),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = tileEdge!,
      );
    }
  }

  /// Paints [p] into [size]. Shared with the opening, which paints two poses in a crossfade.
  static void paintPose(
    Canvas canvas,
    Size size,
    LogoPose p, {
    required BrandLogoForm form,
    required Color letterColor,
    required double devicePixelRatio,
  }) {
    final view = p.view ?? BrandLogo.boundsOf(form);
    if (view.isEmpty || size.isEmpty) return;
    final s = scaleFor(view, size);
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(s);
    canvas.translate(-view.center.dx, -view.center.dy);

    final fill = _fill;
    final wholeWord = form == BrandLogoForm.wordmark;
    for (final letter in LogoGeometry.letters) {
      if (!wholeWord && letter.index != _iconMIndex) continue;
      final g = p.glyph(letter.index);
      if (g.opacity <= 0 || g.scaleX <= 0) continue;
      fill.color = letterColor.withValues(alpha: letterColor.a * g.opacity.clamp(0.0, 1.0));
      canvas.save();
      if (g.clip != null) canvas.clipRect(g.clip!);
      canvas.translate(letter.x + g.offset.dx, g.offset.dy);
      if (g.scaleX != 1) {
        canvas.translate(g.hingeX, 0);
        canvas.scale(g.scaleX, 1);
        canvas.translate(-g.hingeX, 0);
      }
      canvas.drawPath(_path(letter.outline), fill);
      canvas.restore();
    }

    final mobiPose = p.glyph(LogoGeometry.mobiIndex);
    if (mobiPose.opacity > 0) {
      final toSmall = p.mobi.bodyToSmall;
      final detail = toSmall == null
          ? detailFor(form, size, devicePixelRatio, pose: p)
          : (toSmall < 0.5 ? LogoDetail.full : LogoDetail.small);
      _paintMobi(canvas, LogoGeometry.mobi(detail), mobiPose, p.mobi);
    }
    canvas.restore();
  }

  // Reused by every frame (painting is single-threaded), so an animation allocates no paints.
  static final Paint _fill = Paint()..isAntiAlias = true;
  static final Paint _volt = Paint()..color = LogoGeometry.volt;
  static final Paint _voltOver = Paint();
  static final Paint _charcoal = Paint()..color = LogoGeometry.charcoal;
  static final Paint _white = Paint()..color = LogoGeometry.warmWhite;
  static final Paint _layer = Paint();

  static void _paintMobi(Canvas canvas, MobiGlyph m, LogoGlyphPose g, MobiFacePose face) {
    final layered = g.opacity < 1;
    if (layered) {
      final bounds = m.bounds.shift(Offset(m.x + g.offset.dx, g.offset.dy)).inflate(2);
      canvas.saveLayer(bounds, _layer..color = Color.fromRGBO(0, 0, 0, g.opacity.clamp(0.0, 1.0)));
    } else {
      canvas.save();
    }
    if (g.clip != null) canvas.clipRect(g.clip!);
    canvas.translate(m.x + g.offset.dx, g.offset.dy);
    final toSmall = face.bodyToSmall?.clamp(0.0, 1.0);
    if (toSmall == null || toSmall <= 0 || toSmall >= 1) {
      canvas.drawPath(_path(m.body), _volt);
    } else {
      // The flap cut fills in: the full body, then the small (uncut) body over it, fading in.
      // Outside the cut both are the same volt, so only the cut changes.
      canvas.drawPath(_path(LogoGeometry.mobiFull.body), _volt);
      canvas.drawPath(_path(LogoGeometry.mobiSmall.body), _voltOver..color = LogoGeometry.volt.withValues(alpha: toSmall));
    }
    canvas.drawPath(_path(m.visor), _charcoal);
    _paintEyes(canvas, m, face);
    canvas.restore();
  }

  static void _paintEyes(Canvas canvas, MobiGlyph m, MobiFacePose face) {
    var left = m.eyeLeftRect;
    var right = m.eyeRightRect;
    final morph = face.eyesToSmall;
    if (morph != null) {
      final k = morph.clamp(0.0, 1.0);
      left = Rect.lerp(LogoGeometry.mobiFull.eyeLeftRect, LogoGeometry.mobiSmall.eyeLeftRect, k);
      right = Rect.lerp(LogoGeometry.mobiFull.eyeRightRect, LogoGeometry.mobiSmall.eyeRightRect, k);
    }
    if (left == null || right == null) return;

    // The room the eyes have inside the visor's rounded ends, less a small margin.
    final visor = m.visorRect;
    final capR = visor.height / 2;
    final halfH = right.height / 2;
    final reach = visor.right - capR + math.sqrt(math.max(0, capR * capR - halfH * halfH));
    final roomX = math.max(0.0, reach - right.right - visor.height * 0.06);
    final roomY = math.max(0.0, visor.bottom - right.bottom - visor.height * 0.08);
    final shift = Offset(face.look.dx.clamp(-1.0, 1.0) * roomX, face.look.dy.clamp(-1.0, 1.0) * roomY);
    final open = 1 - 0.9 * face.blink.clamp(0.0, 1.0);

    final white = _white;
    Rect lid(Rect r) => Rect.fromCenter(center: r.center + shift, width: r.width, height: r.height * open);

    canvas.drawOval(lid(left), white);

    final ring = m.eyeRightRing;
    final ink = face.ink;
    final showRing = ring != null && morph == null && (ink == null || ink < 1);
    if (!showRing) {
      canvas.drawOval(lid(right), white);
      return;
    }
    // The empty answer bubble, squashed with the blink, and inked from its centre.
    canvas.save();
    canvas.translate(right.center.dx + shift.dx, right.center.dy + shift.dy);
    canvas.scale(1, open);
    canvas.translate(-right.center.dx, -right.center.dy);
    canvas.drawPath(_path(ring), white);
    final t = (ink ?? 0).clamp(0.0, 1.0);
    if (t > 0) {
      // A pencil dot that spreads: a round dot grows from the centre until it is as wide as the
      // bubble, then fills it top and bottom (a tall sliver read as a slashed zero on the device).
      final full = _hole(ring).inflate(0.5);
      final width = full.width * Curves.easeOut.transform(math.min(1.0, t / 0.45));
      final height = math.max(width, full.height * t);
      canvas.drawOval(Rect.fromCenter(center: full.center, width: width, height: height), white);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(BrandLogoPainter old) =>
      poseOf != null ||
      old.pose != pose ||
      old.form != form ||
      old.letterColor != letterColor ||
      old.devicePixelRatio != devicePixelRatio ||
      old.tile != tile ||
      old.tileEdge != tileEdge;
}
