import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'emblem_palette.dart';
import 'emblem_subjects.dart';
import 'subject_identity.dart';

/// Records the static parts of emblems once and replays them. Keys are a subject id, a theme and a
/// detail level, so the set is bounded: the 16 known ids, 2 themes, 3 levels and 4 layers, plus
/// one shared set for every id the art does not know (they all print the same initials card in
/// the same ink, so a new unknown id never adds a picture).
class EmblemPictures {
  EmblemPictures._();

  static final Map<String, ui.Picture> _cache = {};

  static ui.Picture _record(String key, void Function(Canvas canvas) draw) {
    return _cache.putIfAbsent(key, () {
      final recorder = ui.PictureRecorder();
      draw(Canvas(recorder, const Rect.fromLTWH(-10, -10, 120, 120)));
      return recorder.endRecording();
    });
  }

  /// Drops every recorded picture (tests, or a theme change on a low-memory device).
  ///
  /// The pictures are released to the garbage collector, not disposed: an emblem that is on
  /// screen still holds the one it last painted, and painting a disposed picture throws.
  static void clear() => _cache.clear();

  /// The cache id of [subject]: its own id for every identity that has an object (the fifteen, the
  /// language papers and the thirteen added on 15 Oct 2026), one shared id for any subject that only
  /// has initials.
  static String idOf(SubjectIdentity subject) => subject.hasEmblem ? subject.id : 'other';

  /// How many pictures are cached (for tests).
  static int get length => _cache.length;

  // Keys name the subject id, not its kind: a picture is painted in the subject's own ink, so two
  // subjects that share a drawing must not share a picture.
  static ui.Picture tile(SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('tile|${idOf(subject)}|${b.name}|${d.name}', (c) => paintTile(c, p, d));

  static ui.Picture pool(SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('pool|${idOf(subject)}|${b.name}|${d.name}', (c) => paintPool(c, p));

  static ui.Picture object(EmblemArt art, SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('object|${idOf(subject)}|${b.name}|${d.name}', (c) => art.object(Sketch(c, p, d)));

  static ui.Picture shadow(EmblemArt art, SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('shadow|${idOf(subject)}|${b.name}|${d.name}', (c) {
        Sketch(c, p, d).softEllipse(Offset(50, art.groundY + 1.5), art.shadowRx, 4.6, p.shadow);
      });
}

double _dogEar(EmblemDetail d) => d == EmblemDetail.glyph ? 0 : 24;

/// The tile is a piece of an answer sheet, not an app icon: three rounded corners and one corner
/// folded down, like the sheets drawn on it. At 24 dp the fold is dropped: a plain rounded plate
/// keeps the silhouette clean.
Path _sheetPath(EmblemDetail d) {
  const r = 26.0;
  final cut = _dogEar(d);
  if (cut == 0) return Path()..addRRect(RRect.fromLTRBR(0, 0, 100, 100, const Radius.circular(r)));
  return Path()
    ..moveTo(r, 0)
    ..lineTo(100 - cut, 0)
    ..lineTo(100, cut)
    ..lineTo(100, 100 - r)
    ..arcToPoint(const Offset(100 - r, 100), radius: const Radius.circular(r))
    ..lineTo(r, 100)
    ..arcToPoint(const Offset(0, 100 - r), radius: const Radius.circular(r))
    ..lineTo(0, r)
    ..arcToPoint(const Offset(r, 0), radius: const Radius.circular(r))
    ..close();
}

/// The warm pool an unframed emblem stands on: one hue per subject at one strength, fading into
/// the screen well inside the emblem's box so it never bleeds under a label.
void paintPool(Canvas canvas, EmblemPalette p) {
  const c = Offset(50, 54);
  final core = p.pool;
  final top = p.isNight ? 0.70 : 0.78;
  canvas.save();
  canvas.translate(c.dx, c.dy);
  canvas.scale(1, 0.88);
  canvas.drawCircle(
    Offset.zero,
    44,
    Paint()
      ..shader = ui.Gradient.radial(
        Offset.zero,
        44,
        [core.withValues(alpha: top), core.withValues(alpha: top * 0.5), core.withValues(alpha: top * 0.14), core.withValues(alpha: 0)],
        const [0, 0.45, 0.78, 1],
      ),
  );
  canvas.restore();
}

/// The 24 dp plate: one flat, lifted colour with a crisp rim, so the object reads as a clean
/// silhouette. No grid, no fold, no lamp pool.
void _paintGlyphTile(Canvas canvas, EmblemPalette p, Path shapePath) {
  final base = p.glyphField;
  canvas.drawPath(
    shapePath,
    Paint()
      ..shader = ui.Gradient.linear(
        const Offset(0, 0),
        const Offset(0, 100),
        [Color.lerp(base, const Color(0xFFFFFFFF), p.isNight ? 0.10 : 0.12)!, base, Color.lerp(base, const Color(0xFF000000), p.isNight ? 0.16 : 0.08)!],
        const [0, 0.5, 1],
      ),
  );
  canvas.drawPath(
    shapePath,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..shader = ui.Gradient.linear(const Offset(0, 0), const Offset(0, 100), [p.edgeTop, p.edgeBottom, p.edgeBottom, p.rim], const [0, 0.35, 0.7, 1]),
  );
}

/// The folded corner: the back of the sheet catching the lamp, a clean shadow cast on the sheet
/// below it, and a lit crease. Paper, not a grey patch.
void _paintDogEar(Canvas canvas, EmblemPalette p, double cut) {
  final flap = Path()
    ..moveTo(100 - cut, 0)
    ..lineTo(100, cut)
    ..lineTo(100 - cut, cut)
    ..close();
  // The shadow the flap casts on the sheet: soft, offset down and to the left.
  canvas.drawPath(
    flap.shift(const Offset(-1.4, 2.6)),
    Paint()
      ..color = p.isNight ? const Color(0x73000000) : p.deep.withValues(alpha: 0.26)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.4),
  );
  const cream = Color(0xFFFFF6E4);
  final near = p.isNight ? Color.lerp(p.field, cream, 0.58)! : Color.lerp(p.field, const Color(0xFFFFFFFF), 0.92)!;
  final far = p.isNight ? Color.lerp(p.field, cream, 0.34)! : Color.lerp(p.field, const Color(0xFFFFFFFF), 0.64)!;
  canvas.drawPath(
    flap,
    Paint()..shader = ui.Gradient.linear(Offset(100 - cut * 0.5, cut * 0.5), Offset(100 - cut, cut), [near, far]),
  );
  // The flap's own two edges, thin and dark, so it has a defined shape.
  final edge = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 0.9
    ..strokeCap = StrokeCap.round
    ..color = p.isNight ? const Color(0x59000000) : p.deep.withValues(alpha: 0.22);
  canvas.drawPath(
    Path()
      ..moveTo(100 - cut, 0.6)
      ..lineTo(100 - cut, cut)
      ..lineTo(99.4, cut),
    edge,
  );
  // The lit crease along the fold.
  canvas.drawLine(
    Offset(100 - cut, 0),
    Offset(100, cut),
    Paint()
      ..strokeWidth = 1.3
      ..strokeCap = StrokeCap.round
      ..color = p.isNight ? const Color(0x99FFF6E4) : const Color(0xE6FFFFFF),
  );
}

/// The tile: the light field lit like the desk, the printed answer grid and timing track, the
/// folded corner and the edge light. Drawn in the 100 by 100 design space.
void paintTile(Canvas canvas, EmblemPalette p, EmblemDetail d) {
  final shapePath = _sheetPath(d);
  if (d == EmblemDetail.glyph) {
    _paintGlyphTile(canvas, p, shapePath);
    return;
  }
  final cut = _dogEar(d);

  // Body: a 168 degree two-stop light, darker at the foot.
  canvas.drawPath(
    shapePath,
    Paint()..shader = ui.Gradient.linear(const Offset(40, 0), const Offset(60, 100), [p.fieldTop, p.field, p.fieldBottom], const [0, 0.42, 1]),
  );
  // The lamp's pool from the upper left.
  canvas.save();
  canvas.clipPath(shapePath);
  canvas.drawCircle(
    const Offset(16, 8),
    78,
    Paint()..shader = ui.Gradient.radial(const Offset(16, 8), 78, [p.lamp, p.lamp.withValues(alpha: 0)]),
  );

  // The printed answer grid: strongest at the lower right, gone under the lamp.
  const cols = [10.0, 22.0, 34.0, 46.0, 58.0, 70.0, 82.0];
  final ringPaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = d == EmblemDetail.plate ? 0.8 : 1.0;
  for (final y in cols) {
    for (final x in cols) {
      final k = ((x + y - 74) / 70).clamp(0.0, 1.0);
      if (k <= 0.02) continue;
      ringPaint.color = p.grid.withValues(alpha: p.grid.a * k);
      canvas.drawCircle(Offset(x, y + 2), 3.2, ringPaint);
    }
  }
  if (d == EmblemDetail.plate) {
    // The OMR timing track down the right edge.
    final track = Paint()..color = p.grid.withValues(alpha: p.grid.a * 1.2);
    for (var y = 32.0; y <= 82; y += 8) {
      canvas.drawRect(Rect.fromLTWH(91.5, y, 3.6, 1.7), track);
    }
  }
  _paintDogEar(canvas, p, cut);
  canvas.restore();

  // The edge light along the top and the rim at the foot.
  canvas.drawPath(
    shapePath,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..strokeJoin = StrokeJoin.round
      ..shader = ui.Gradient.linear(const Offset(0, 0), const Offset(0, 100), [p.edgeTop, p.edgeBottom, p.edgeBottom, p.rim], const [0, 0.35, 0.7, 1]),
  );
}

/// The picked state of a framed tile: a volt ring around the sheet with a soft light on Night, and
/// on Daylight a dark hairline under it so the volt holds on paper. [k] is 0 to 1 as it inks.
/// [shape] rings another tile outline in the same 100 unit space (the object art's plain well).
void paintSelectionRing(Canvas canvas, EmblemPalette p, EmblemDetail d, double k, {Path? shape}) {
  if (k <= 0) return;
  final path = shape ?? _sheetPath(d);
  final glyph = d == EmblemDetail.glyph;
  final w = glyph ? 5.0 : 3.4;
  if (p.isNight) {
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 2.2
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, glyph ? 3.2 : 4.4)
        ..color = p.volt.withValues(alpha: 0.42 * k),
    );
  } else {
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w + 1.6
        ..strokeJoin = StrokeJoin.round
        ..color = p.voltRing.withValues(alpha: p.voltRing.a * k),
    );
  }
  canvas.drawPath(
    path,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = w
      ..strokeJoin = StrokeJoin.round
      ..color = p.volt.withValues(alpha: k),
  );
}

/// The picked tick in the lower right corner of a framed tile (tile and plate sizes).
void paintSelectedBadge(Canvas canvas, EmblemPalette p, double k) {
  if (k <= 0.02) return;
  const c = Offset(80, 80);
  final pop = Curves.easeOutBack.transform(k.clamp(0.0, 1.0));
  canvas.save();
  canvas.translate(c.dx, c.dy);
  canvas.scale(pop);
  canvas.drawCircle(Offset.zero, 11.2, Paint()..color = p.isNight ? const Color(0xFF0E0C09) : p.voltRing);
  canvas.drawCircle(Offset.zero, 9, Paint()..color = p.volt);
  canvas.drawPath(
    Path()
      ..moveTo(-4.2, 0.2)
      ..lineTo(-1.1, 3.3)
      ..lineTo(4.4, -3.2),
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = p.voltInk,
  );
  canvas.restore();
}

Path _markShape(MarkStyle style, Offset c, double r) {
  switch (style) {
    case MarkStyle.key:
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: r * 1.7, height: r * 1.35), Radius.circular(r * 0.34)));
    case MarkStyle.pill:
      return Path()..addRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: r * 2.5, height: r * 1.15), Radius.circular(r * 0.575)));
    case MarkStyle.drop:
      final apex = c + Offset(0, -r * 1.55);
      return Path()
        ..moveTo(apex.dx, apex.dy)
        ..cubicTo(c.dx + r * 0.35, c.dy - r * 0.8, c.dx + r * 0.95, c.dy - r * 0.25, c.dx + r * 0.95, c.dy + r * 0.3)
        ..arcToPoint(Offset(c.dx - r * 0.95, c.dy + r * 0.3), radius: Radius.circular(r * 0.95))
        ..cubicTo(c.dx - r * 0.95, c.dy - r * 0.25, c.dx - r * 0.35, c.dy - r * 0.8, apex.dx, apex.dy)
        ..close();
    case MarkStyle.wedge:
      final big = r * 3;
      return Path()
        ..moveTo(c.dx, c.dy)
        ..arcTo(Rect.fromCircle(center: c, radius: big), -50 * math.pi / 180, 50 * math.pi / 180, false)
        ..close();
    case MarkStyle.reticle:
      return Path()..addOval(Rect.fromCircle(center: c, radius: r * 0.9));
    case MarkStyle.bubble:
    case MarkStyle.halo:
    case MarkStyle.row:
      return Path()..addOval(Rect.fromCircle(center: c, radius: r));
  }
}

/// Paints the one volt mark. [m] is how inked it is (0 open, 1 filled); [inking] adds the
/// ring that spreads while it fills. Its form follows [EmblemMark.style].
void paintMark(Canvas canvas, EmblemPalette p, EmblemMark mark, double m, {required EmblemDetail detail, bool inking = false}) {
  final isGlyph = detail == EmblemDetail.glyph;
  final ringWidth = isGlyph ? 1.8 : 1.3;
  var style = mark.style;
  var c = mark.center;
  var r = isGlyph ? mark.radius * 1.3 : mark.radius;

  // The reply row: two printed dots, then the one that gets inked. At 24 dp only the last shows.
  if (style == MarkStyle.row) {
    final gap = mark.radius * 2.35;
    if (!isGlyph) {
      final dot = Paint()..color = p.lit;
      final ring = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = ringWidth
        ..color = p.ring;
      for (final dx in [-gap, 0.0]) {
        canvas.drawCircle(c + Offset(dx, 0), mark.radius * 0.92, dot);
        canvas.drawCircle(c + Offset(dx, 0), mark.radius * 0.92 - 0.6, ring);
      }
    }
    c = c + Offset(gap, 0);
    r = isGlyph ? mark.radius * 1.7 : mark.radius * 1.1;
    style = MarkStyle.bubble;
  }

  final k = Curves.easeOut.transform(m.clamp(0.0, 1.0));
  final halo = style == MarkStyle.halo;
  final haloR = r * 1.25;
  final shape = halo ? null : _markShape(style, c, r);

  if (m < 1) {
    final fill = Paint()
      ..isAntiAlias = true
      ..color = p.lit;
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = ringWidth
      ..color = p.ring
      ..isAntiAlias = true;
    if (halo) {
      canvas.drawCircle(c, haloR, fill);
      canvas.drawCircle(c, haloR - 0.6, line);
      canvas.drawCircle(c, haloR * 0.42, line..strokeWidth = ringWidth * 0.8);
    } else {
      canvas.drawPath(shape!, fill);
      canvas.drawPath(shape, line);
    }
  }
  if (m <= 0) return;

  if (p.isNight && !isGlyph) {
    canvas.drawCircle(
      c,
      r * 2.7,
      Paint()..shader = ui.Gradient.radial(c, r * 2.7, [p.voltGlow.withValues(alpha: p.voltGlow.a * m), p.voltGlow.withValues(alpha: 0)]),
    );
  }
  final volt = Paint()
    ..color = p.volt
    ..isAntiAlias = true;
  final rim = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = p.isNight ? 0.9 : (isGlyph ? 1.4 : 1.0)
    ..color = p.voltRing
    ..isAntiAlias = true;

  if (halo) {
    final outer = haloR * k;
    canvas.drawCircle(c, outer, volt);
    // The cell's open middle with its nucleus.
    final hole = haloR * 0.52 * k;
    canvas.drawCircle(c, hole, Paint()..color = p.lit);
    if (m >= 0.98) {
      canvas.drawCircle(c, haloR - 0.45, rim);
      canvas.drawCircle(c, hole, rim);
      canvas.drawCircle(c, haloR * 0.2, Paint()..color = p.voltInk.withValues(alpha: 0.85));
    }
  } else {
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.scale(k);
    canvas.translate(-c.dx, -c.dy);
    canvas.drawPath(shape!, volt);
    if (m >= 0.98) canvas.drawPath(shape, rim);
    canvas.restore();
    if (m >= 0.98 && !isGlyph && (style == MarkStyle.bubble || style == MarkStyle.reticle)) {
      final rr = style == MarkStyle.reticle ? r * 0.9 : r;
      canvas.drawCircle(c + Offset(-rr * 0.34, -rr * 0.38), rr * 0.26, Paint()..color = const Color(0x8CFFFFFF));
    }
  }

  if (style == MarkStyle.reticle && !isGlyph) {
    final tick = Paint()
      ..color = p.deep.withValues(alpha: p.isNight ? 0.9 : 0.8)
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    for (final d in const [Offset(1, 0), Offset(-1, 0), Offset(0, 1), Offset(0, -1)]) {
      canvas.drawLine(c + d * (r * 1.4), c + d * (r * 1.95), tick);
    }
  }

  if (inking && m < 1) {
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.scale(1 + 0.35 * m);
    canvas.translate(-c.dx, -c.dy);
    canvas.drawPath(
      halo ? (Path()..addOval(Rect.fromCircle(center: c, radius: haloR))) : shape!,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2 / (1 + 0.35 * m)
        ..color = p.volt.withValues(alpha: (1 - m) * 0.8),
    );
    canvas.restore();
  }
  if (m > 0.6 && !isGlyph && (style == MarkStyle.bubble || style == MarkStyle.key || style == MarkStyle.pill)) {
    _paintGlyph(canvas, p.voltInk.withValues(alpha: ((m - 0.6) / 0.4).clamp(0.0, 1.0)), mark.glyph, c, r);
  }
}

void _paintGlyph(Canvas canvas, Color ink, MarkGlyph glyph, Offset c, double r) {
  final stroke = Paint()
    ..color = ink
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeWidth = math.max(1.0, r * 0.2);
  switch (glyph) {
    case MarkGlyph.none:
      return;
    case MarkGlyph.equals:
      canvas.drawLine(c + Offset(-r * 0.42, -r * 0.2), c + Offset(r * 0.42, -r * 0.2), stroke);
      canvas.drawLine(c + Offset(-r * 0.42, r * 0.24), c + Offset(r * 0.42, r * 0.24), stroke);
    case MarkGlyph.slot:
      canvas.drawLine(c + Offset(0, -r * 0.26), c + Offset(0, r * 0.26), stroke);
  }
}

/// Paints one emblem: the cached tile, then the object floating on its idle phase with its
/// contact shadow, the live detail and the mark.
///
/// When [selectable] the emblem stands for a choice: unmarked it sits slightly small and dimmed;
/// marked it lifts to full size, a volt ring and tick show on a framed tile, and the mark is inked.
class EmblemPainter extends CustomPainter {
  EmblemPainter({
    required this.subject,
    required this.art,
    required this.palette,
    required this.brightness,
    required this.detail,
    required this.framed,
    required this.idle,
    required this.ink,
    required this.inking,
    required this.phase,
    this.selectable = false,
  }) : super(repaint: Listenable.merge([idle, ink]));

  final SubjectIdentity subject;
  final EmblemArt? art;
  final EmblemPalette palette;
  final Brightness brightness;
  final EmblemDetail detail;
  final bool framed;
  final bool selectable;

  /// 0 to 1 over the 7.2 s idle cycle; stays at 0 when idle motion is off.
  final ValueListenable<double> idle;

  /// How inked the mark is.
  final ValueListenable<double> ink;

  /// True while the mark is being inked (the spreading ring shows).
  final bool Function() inking;

  /// Idle phase offset for this subject.
  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 100;
    canvas.save();
    canvas.translate((size.width - size.shortestSide) / 2, (size.height - size.shortestSide) / 2);
    canvas.scale(scale);

    // The picked state: small and dim until chosen, then lifted to full size.
    final k = selectable ? ink.value.clamp(0.0, 1.0) : 0.0;
    var dimmed = false;
    if (selectable) {
      if (k < 1) {
        canvas.saveLayer(const Rect.fromLTWH(-10, -10, 120, 120), Paint()..color = Color.fromRGBO(0, 0, 0, 0.6 + 0.4 * k));
        dimmed = true;
      }
      final lift = framed ? 0.92 + 0.06 * k : 0.94 + 0.08 * k;
      canvas.translate(50, 50);
      canvas.scale(lift);
      canvas.translate(-50, -50);
    }

    if (framed) {
      canvas.drawPicture(EmblemPictures.tile(subject, palette, brightness, detail));
      if (selectable) paintSelectionRing(canvas, palette, detail, k);
    } else {
      canvas.drawPicture(EmblemPictures.pool(subject, palette, brightness, detail));
    }
    final a = art;
    if (a != null) {
      canvas.save();
      final moving = idle.value != 0 && !a.overlaysText;
      final t = moving ? (idle.value + phase) % 1.0 : 0.0;
      final lift = moving ? (1 - math.cos(t * 2 * math.pi)) / 2 : 0.0;
      // The drift is a fixed share of a dp, so at 24 dp it needs more of the 100 unit space.
      final rise = switch (detail) { EmblemDetail.glyph => 6.0, EmblemDetail.tile => 3.4, EmblemDetail.plate => 3.0 };
      final tilt = detail == EmblemDetail.glyph ? 3.0 : 2.0;
      if (a.overlaysText) {
        // The initials are text laid over this: nothing here scales or floats.
      } else if (detail == EmblemDetail.glyph) {
        canvas.translate(50, 50);
        canvas.scale(1.14);
        canvas.translate(-50, -50);
      } else if (!framed) {
        canvas.translate(50, 50);
        canvas.scale(1.06);
        canvas.translate(-50, -50);
      }
      // Contact shadow: tighter and lighter as the object rises.
      canvas.save();
      canvas.translate(50, a.groundY);
      canvas.scale(1 - 0.16 * lift, 1 - 0.16 * lift);
      canvas.translate(-50, -a.groundY);
      canvas.drawPicture(EmblemPictures.shadow(a, subject, palette, brightness, detail));
      canvas.restore();
      // The object floats on its ground: up and over a degree or two each way.
      canvas.translate(50, a.groundY);
      canvas.rotate(-tilt * math.pi / 180 * lift);
      canvas.translate(-50, -a.groundY - rise * lift);
      canvas.drawPicture(EmblemPictures.object(a, subject, palette, brightness, detail));
      final sketch = Sketch(canvas, palette, detail);
      a.live(sketch, t);
      paintMark(canvas, palette, a.markAt(t, detail), ink.value, detail: detail, inking: inking());
      canvas.restore();
    }
    if (selectable && framed && detail != EmblemDetail.glyph) paintSelectedBadge(canvas, palette, k);
    if (dimmed) canvas.restore();
    canvas.restore();
  }

  @override
  bool shouldRepaint(EmblemPainter old) =>
      old.subject != subject ||
      old.brightness != brightness ||
      old.detail != detail ||
      old.framed != framed ||
      old.selectable != selectable ||
      old.idle != idle ||
      old.ink != ink ||
      old.phase != phase;
}
