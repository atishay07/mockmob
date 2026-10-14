import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import 'subject_identity.dart';

/// How much an emblem draws, chosen from its size like the optical sizes of a type family.
enum EmblemDetail {
  /// Under 40 dp: the silhouette, its fold and the mark. Nothing that would turn to mud.
  glyph,

  /// 40 to 95 dp: the printed grid and the object's main detail.
  tile,

  /// 96 dp and up: the OMR timing track, hairline highlights and fine rules.
  plate;

  static EmblemDetail forSize(double size) => size < 40 ? glyph : (size < 96 ? tile : plate);
}

/// The colours one emblem is drawn in: the subject's form ink on the Night or Daylight sheet,
/// plus warm paper for lit planes and volt for the one mark.
@immutable
class EmblemPalette {
  const EmblemPalette._({
    required this.isNight,
    required this.field,
    required this.fieldTop,
    required this.fieldBottom,
    required this.lamp,
    required this.edgeTop,
    required this.edgeBottom,
    required this.rim,
    required this.grid,
    required this.lit,
    required this.shade,
    required this.mid,
    required this.midShade,
    required this.deep,
    required this.shadow,
    required this.volt,
    required this.voltInk,
    required this.voltRing,
    required this.voltGlow,
    required this.ring,
  });

  factory EmblemPalette.of(SubjectIdentity subject, Brightness brightness) {
    final night = brightness == Brightness.dark;
    final field = subject.field(brightness);
    final mid = subject.formInk(brightness);
    final deep = subject.formInkDeep(brightness);
    const lamp = Color(0xFFF2A93B);
    if (night) {
      const lit = Color(0xFFEFE8D9);
      return EmblemPalette._(
        isNight: true,
        field: field,
        fieldTop: Color.lerp(Color.lerp(field, lamp, 0.10)!, const Color(0xFFFFFFFF), 0.05)!,
        fieldBottom: Color.lerp(field, const Color(0xFF050403), 0.42)!,
        lamp: lamp.withValues(alpha: 0.22),
        edgeTop: const Color(0x3DFFF6E4),
        edgeBottom: const Color(0x00FFF6E4),
        rim: const Color(0x52000000),
        grid: mid.withValues(alpha: 0.30),
        lit: lit,
        shade: Color.lerp(lit, deep, 0.42)!,
        mid: mid,
        midShade: Color.lerp(mid, deep, 0.48)!,
        deep: deep,
        shadow: const Color(0x99000000),
        volt: const Color(0xFFD2F000),
        voltInk: const Color(0xFF0B1000),
        voltRing: const Color(0xFF9DB400),
        voltGlow: const Color(0x52D2F000),
        ring: Color.lerp(mid, lit, 0.15)!,
      );
    }
    const lit = Color(0xFFFFFDF8);
    return EmblemPalette._(
      isNight: false,
      field: field,
      fieldTop: Color.lerp(field, const Color(0xFFFFFFFF), 0.24)!,
      fieldBottom: Color.lerp(field, mid, 0.26)!,
      lamp: lamp.withValues(alpha: 0.16),
      edgeTop: const Color(0xE6FFFFFF),
      edgeBottom: const Color(0x00FFFFFF),
      rim: deep.withValues(alpha: 0.16),
      grid: deep.withValues(alpha: 0.20),
      lit: lit,
      shade: Color.lerp(lit, mid, 0.30)!,
      mid: mid,
      midShade: Color.lerp(mid, deep, 0.45)!,
      deep: deep,
      shadow: Color.lerp(deep, const Color(0xFF000000), 0.35)!.withValues(alpha: 0.38),
      volt: const Color(0xFFD2F000),
      voltInk: const Color(0xFF0B1000),
      voltRing: const Color(0xD917150F),
      voltGlow: const Color(0x00D2F000),
      ring: deep,
    );
  }

  final bool isNight;

  /// The tile: the subject's light field, lit from the upper left, darker at the foot.
  final Color field;
  final Color fieldTop;
  final Color fieldBottom;

  /// The desk lamp's pool on the tile (environment light only).
  final Color lamp;

  /// The edge light along the tile's top, fading down its sides.
  final Color edgeTop;
  final Color edgeBottom;

  /// The tile's rim at its foot (Night: a dark lip; Daylight: a printed hairline).
  final Color rim;

  /// The printed answer grid and timing track.
  final Color grid;

  /// Lit paper: the planes that face the lamp.
  final Color lit;

  /// Paper turned away from the lamp, tinted by the subject.
  final Color shade;

  /// The form ink: the object's coloured parts.
  final Color mid;

  /// Form ink turned away from the lamp.
  final Color midShade;

  /// Deep form ink: printed detail and the darkest parts.
  final Color deep;

  /// The contact shadow under the object.
  final Color shadow;

  final Color volt;
  final Color voltInk;

  /// The rim of the inked mark (a darker volt on Night, ink on Daylight so it holds on paper).
  final Color voltRing;

  /// The volt glow under the mark (Night only).
  final Color voltGlow;

  /// An unmarked bubble's printed ring.
  final Color ring;
}

/// Small drawing helpers in the emblem's 100 by 100 design space.
class Sketch {
  Sketch(this.canvas, this.p, this.detail);

  final Canvas canvas;
  final EmblemPalette p;
  final EmblemDetail detail;

  /// True above the glyph size: fine detail is drawn.
  bool get fine => detail != EmblemDetail.glyph;

  /// True at plate size: hairlines and printed rules.
  bool get plate => detail == EmblemDetail.plate;

  Paint _f(Color c) => Paint()
    ..color = c
    ..isAntiAlias = true;

  Paint _s(Color c, double w, {StrokeCap cap = StrokeCap.round, StrokeJoin join = StrokeJoin.round}) => Paint()
    ..color = c
    ..style = PaintingStyle.stroke
    ..strokeWidth = w
    ..strokeCap = cap
    ..strokeJoin = join
    ..isAntiAlias = true;

  void fill(Path path, Color c) => canvas.drawPath(path, _f(c));

  void poly(List<Offset> points, Color c) => fill(Path()..addPolygon(points, true), c);

  void rect(Rect r, Color c) => canvas.drawRect(r, _f(c));

  void rrect(Rect r, double radius, Color c) => canvas.drawRRect(RRect.fromRectAndRadius(r, Radius.circular(radius)), _f(c));

  void circle(Offset o, double r, Color c) => canvas.drawCircle(o, r, _f(c));

  void ring(Offset o, double r, Color c, double w) => canvas.drawCircle(o, r, _s(c, w));

  void line(Offset a, Offset b, Color c, double w, {StrokeCap cap = StrokeCap.round}) => canvas.drawLine(a, b, _s(c, w, cap: cap));

  void stroke(Path path, Color c, double w, {StrokeCap cap = StrokeCap.round, StrokeJoin join = StrokeJoin.round}) =>
      canvas.drawPath(path, _s(c, w, cap: cap, join: join));

  void polyline(List<Offset> points, Color c, double w) => stroke(Path()..addPolygon(points, false), c, w);

  void dashed(Offset a, Offset b, Color c, double w, {double dash = 2.2, double gap = 2.0}) {
    final d = b - a;
    final length = d.distance;
    if (length == 0) return;
    final unit = d / length;
    var at = 0.0;
    final paint = _s(c, w, cap: StrokeCap.butt);
    while (at < length) {
      final end = math.min(at + dash, length);
      canvas.drawLine(a + unit * at, a + unit * end, paint);
      at = end + gap;
    }
  }

  /// [shape] in [a], with the part inside [half] in [b]: a plane folded along a crease.
  void folded(Path shape, Path half, Color a, Color b) {
    fill(shape, a);
    fill(Path.combine(PathOperation.intersect, shape, half), b);
  }

  /// A paper slab: [face] drawn over its own thickness, offset by [depth] in [edge].
  void slab(Path face, Offset depth, Color faceColor, Color edge) {
    fill(face.shift(depth), edge);
    fill(face, faceColor);
  }

  /// Overlays [c] on the part of [face] inside [half]: a plane folded along a crease, drawn on a
  /// face that has already been filled in its lit colour.
  void fold(Path face, Path half, Color c) => fill(Path.combine(PathOperation.intersect, face, half), c);

  /// Plate only: a hairline of lamp light along the lit (upper left) edge of [path].
  void sheen(Path path, {double width = 0.9}) {
    if (!plate) return;
    final b = path.getBounds();
    final paint = _s(const Color(0xFFFFFFFF), width)
      ..shader = ui.Gradient.linear(
        b.topLeft,
        b.bottomRight,
        [Color.fromARGB(p.isNight ? 150 : 220, 255, 255, 255), const Color(0x00FFFFFF)],
        const [0.0, 0.55],
      );
    canvas.drawPath(path, paint);
  }

  /// A soft radial ellipse: contact shadows and glows.
  void softEllipse(Offset center, double rx, double ry, Color color) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(1, ry / rx);
    canvas.drawCircle(
      Offset.zero,
      rx,
      Paint()
        ..shader = ui.Gradient.radial(Offset.zero, rx, [color, color.withValues(alpha: color.a * 0.45), color.withValues(alpha: 0)], const [0, 0.5, 1]),
    );
    canvas.restore();
  }
}

/// Rotates [point] around [pivot] by [degrees] (clockwise on screen).
Offset rotateAround(Offset point, Offset pivot, double degrees) {
  final a = degrees * math.pi / 180;
  final d = point - pivot;
  return pivot + Offset(d.dx * math.cos(a) - d.dy * math.sin(a), d.dx * math.sin(a) + d.dy * math.cos(a));
}

/// Paths in [path] rotated around [pivot] by [degrees].
Path rotatedPath(Path path, Offset pivot, double degrees) {
  final a = degrees * math.pi / 180;
  final c = math.cos(a), s = math.sin(a);
  final m = Float64List.fromList([
    c, s, 0, 0, //
    -s, c, 0, 0, //
    0, 0, 1, 0, //
    pivot.dx - c * pivot.dx + s * pivot.dy, pivot.dy - s * pivot.dx - c * pivot.dy, 0, 1,
  ]);
  return path.transform(m);
}
