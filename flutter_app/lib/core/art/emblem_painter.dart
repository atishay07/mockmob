import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import 'emblem_palette.dart';
import 'emblem_subjects.dart';
import 'subject_identity.dart';

/// Records the static parts of emblems once and replays them. Keys are a subject, a theme and a
/// detail level, so the set is bounded (17 kinds, 2 themes, 3 levels, 3 layers).
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
  static void clear() {
    for (final picture in _cache.values) {
      picture.dispose();
    }
    _cache.clear();
  }

  /// How many pictures are cached (for tests).
  static int get length => _cache.length;

  static ui.Picture tile(SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('tile|${subject.kind.name}|${subject.id}|${b.name}|${d.name}', (c) => paintTile(c, p, d));

  static ui.Picture object(EmblemArt art, SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('object|${subject.kind.name}|${b.name}|${d.name}', (c) => art.object(Sketch(c, p, d)));

  static ui.Picture shadow(EmblemArt art, SubjectIdentity subject, EmblemPalette p, Brightness b, EmblemDetail d) =>
      _record('shadow|${subject.kind.name}|${b.name}|${d.name}', (c) {
        Sketch(c, p, d).softEllipse(Offset(50, art.groundY + 1.5), art.shadowRx, 4.6, p.shadow);
      });
}

/// The tile: the light field lit like the desk, the printed answer grid and timing track, and
/// the edge light. Drawn in the 100 by 100 design space.
void paintTile(Canvas canvas, EmblemPalette p, EmblemDetail d) {
  const rect = Rect.fromLTWH(0, 0, 100, 100);
  final shape = BorderRadius.circular(30).toRSuperellipse(rect);
  final shapePath = Path()..addRSuperellipse(shape);

  // Body: a 168 degree two-stop light, darker at the foot.
  canvas.drawPath(
    shapePath,
    Paint()
      ..shader = ui.Gradient.linear(const Offset(40, 0), const Offset(60, 100), [p.fieldTop, p.field, p.fieldBottom], const [0, 0.42, 1]),
  );
  // The lamp's pool from the upper left.
  canvas.save();
  canvas.clipPath(shapePath);
  canvas.drawCircle(
    const Offset(16, 8),
    78,
    Paint()..shader = ui.Gradient.radial(const Offset(16, 8), 78, [p.lamp, p.lamp.withValues(alpha: 0)]),
  );

  if (d != EmblemDetail.glyph) {
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
      for (var y = 18.0; y <= 82; y += 8) {
        canvas.drawRect(Rect.fromLTWH(91.5, y, 3.6, 1.7), track);
      }
    }
  }
  canvas.restore();

  // The edge light along the top and the rim at the foot.
  final edge = BorderRadius.circular(29.5).toRSuperellipse(rect.deflate(0.5));
  canvas.drawRSuperellipse(
    edge,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = d == EmblemDetail.glyph ? 1.6 : 1.0
      ..shader = ui.Gradient.linear(const Offset(0, 0), const Offset(0, 100), [p.edgeTop, p.edgeBottom, p.edgeBottom, p.rim], const [0, 0.35, 0.7, 1]),
  );
}

/// Paints the one volt bubble. [m] is how inked it is (0 open, 1 filled); [inking] adds the
/// ring that spreads while it fills.
void paintMark(Canvas canvas, EmblemPalette p, EmblemMark mark, double m, {required EmblemDetail detail, bool inking = false}) {
  final c = mark.center;
  final r = detail == EmblemDetail.glyph ? mark.radius * 1.3 : mark.radius;
  final paint = Paint()..isAntiAlias = true;
  if (m < 1) {
    paint.color = p.lit;
    canvas.drawCircle(c, r, paint);
    canvas.drawCircle(
      c,
      r - 0.6,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = detail == EmblemDetail.glyph ? 1.8 : 1.3
        ..color = p.ring,
    );
  }
  if (m <= 0) return;
  final fill = r * Curves.easeOut.transform(m.clamp(0.0, 1.0));
  if (p.isNight && detail != EmblemDetail.glyph) {
    canvas.drawCircle(
      c,
      r * 2.7,
      Paint()..shader = ui.Gradient.radial(c, r * 2.7, [p.voltGlow.withValues(alpha: p.voltGlow.a * m), p.voltGlow.withValues(alpha: 0)]),
    );
  }
  paint.color = p.volt;
  canvas.drawCircle(c, fill, paint);
  if (m >= 0.98) {
    canvas.drawCircle(
      c,
      r - 0.45,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = p.isNight ? 0.9 : (detail == EmblemDetail.glyph ? 1.4 : 1.0)
        ..color = p.voltRing,
    );
    if (detail != EmblemDetail.glyph) {
      canvas.drawCircle(c + Offset(-r * 0.34, -r * 0.38), r * 0.26, Paint()..color = const Color(0x8CFFFFFF));
    }
  }
  if (inking && m < 1) {
    canvas.drawCircle(
      c,
      r * (1 + 0.35 * m),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = p.volt.withValues(alpha: (1 - m) * 0.8),
    );
  }
  if (m > 0.6 && detail != EmblemDetail.glyph) _paintGlyph(canvas, p.voltInk.withValues(alpha: ((m - 0.6) / 0.4).clamp(0.0, 1.0)), mark.glyph, c, r);
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
      canvas.drawLine(c + Offset(0, -r * 0.34), c + Offset(0, r * 0.34), stroke);
    case MarkGlyph.dot:
      canvas.drawCircle(c + Offset(r * 0.12, r * 0.1), r * 0.28, Paint()..color = ink.withValues(alpha: ink.a * 0.7));
    case MarkGlyph.question:
      final q = Path()
        ..moveTo(c.dx - r * 0.34, c.dy - r * 0.22)
        ..cubicTo(c.dx - r * 0.34, c.dy - r * 0.66, c.dx + r * 0.38, c.dy - r * 0.66, c.dx + r * 0.36, c.dy - r * 0.24)
        ..cubicTo(c.dx + r * 0.34, c.dy + r * 0.02, c.dx, c.dy, c.dx, c.dy + r * 0.24);
      canvas.drawPath(q, stroke);
      canvas.drawCircle(c + Offset(0, r * 0.56), stroke.strokeWidth * 0.62, Paint()..color = ink);
  }
}

/// Paints one emblem: the cached tile, then the object floating on its idle phase with its
/// contact shadow, the live detail and the mark.
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
  }) : super(repaint: Listenable.merge([idle, ink]));

  final SubjectIdentity subject;
  final EmblemArt? art;
  final EmblemPalette palette;
  final Brightness brightness;
  final EmblemDetail detail;
  final bool framed;

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
    if (framed) canvas.drawPicture(EmblemPictures.tile(subject, palette, brightness, detail));
    final a = art;
    if (a != null) {
      final moving = idle.value != 0;
      final t = moving ? (idle.value + phase) % 1.0 : 0.0;
      final lift = moving ? (1 - math.cos(t * 2 * math.pi)) / 2 : 0.0;
      if (detail == EmblemDetail.glyph) {
        canvas.translate(50, 50);
        canvas.scale(1.08);
        canvas.translate(-50, -50);
      } else if (!framed) {
        canvas.translate(50, 50);
        canvas.scale(1.06);
        canvas.translate(-50, -50);
      }
      // Contact shadow: tighter and lighter as the object rises.
      canvas.save();
      canvas.translate(50, a.groundY);
      canvas.scale(1 - 0.12 * lift, 1 - 0.12 * lift);
      canvas.translate(-50, -a.groundY);
      canvas.drawPicture(EmblemPictures.shadow(a, subject, palette, brightness, detail));
      canvas.restore();
      // The object floats: up to 1.8 units and -1.2 degrees, pivoting on its ground.
      canvas.translate(50, a.groundY);
      canvas.rotate(-1.2 * math.pi / 180 * lift);
      canvas.translate(-50, -a.groundY - 1.8 * lift);
      canvas.drawPicture(EmblemPictures.object(a, subject, palette, brightness, detail));
      final sketch = Sketch(canvas, palette, detail);
      a.live(sketch, t);
      paintMark(canvas, palette, a.mark(t), ink.value, detail: detail, inking: inking());
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(EmblemPainter old) =>
      old.subject != subject ||
      old.brightness != brightness ||
      old.detail != detail ||
      old.framed != framed ||
      old.idle != idle ||
      old.ink != ink ||
      old.phase != phase;
}
