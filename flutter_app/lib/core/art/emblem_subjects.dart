import 'dart:math' as math;
import 'dart:ui' as ui show Gradient;
import 'dart:ui' show PathMetric;

import 'package:flutter/widgets.dart';

import 'emblem_palette.dart';
import 'subject_identity.dart';

/// What is printed on a mark once it is inked.
enum MarkGlyph { none, equals, slot }

/// The form the one volt mark takes. A bubble is the answer sheet's own mark; the others are the
/// same idea made from the subject's object, so twelve emblems do not wear the same dot.
enum MarkStyle {
  /// A round OMR bubble.
  bubble,

  /// A rounded key (the calculator's equals key).
  key,

  /// A horizontal pill (a clasp, a run button).
  pill,

  /// An ink drop hanging from a nib.
  drop,

  /// A printed ring that fills with a ring of volt, centre left open (a cell).
  halo,

  /// A bubble with cross hair ticks (a point on a graph).
  reticle,

  /// A sector that sweeps open (the angle being measured).
  wedge,

  /// A row of three printed dots, the last one inked (a reply on its way).
  row,
}

/// Where the one volt mark sits, in the 100 by 100 design space.
@immutable
class EmblemMark {
  const EmblemMark(this.center, this.radius, {this.glyph = MarkGlyph.none, this.style = MarkStyle.bubble});

  final Offset center;
  final double radius;
  final MarkGlyph glyph;
  final MarkStyle style;
}

/// One subject's drawing. [object] is recorded once into a cached picture; [live] and the mark
/// are drawn each frame on top of it, so they must stay a handful of shapes.
abstract class EmblemArt {
  const EmblemArt();

  /// The static object, lit from the upper left. Drawn into a cached picture.
  void object(Sketch s);

  /// The moving detail at idle phase [t] (0 to 1 over 7.2 s). At rest [t] is 0.
  void live(Sketch s, double t) {}

  /// The mark at idle phase [t].
  EmblemMark mark(double t);

  /// The mark for a given detail level. Motion that would be too small to see at 24 dp is
  /// larger there; most subjects need no difference.
  EmblemMark markAt(double t, EmblemDetail detail) => mark(t);

  /// The line the object rests on (its float pivots here and its contact shadow sits here).
  double get groundY => 80;

  /// Half width of the contact shadow.
  double get shadowRx => 30;

  /// The colours that carry this object's silhouette at 24 dp, for the contrast check against the
  /// glyph plate ([EmblemPalette.glyphField]). Empty where the object is light paper on a plate
  /// that has no other dark to compare with.
  List<Color> glyphInks(EmblemPalette p) => const [];

  /// True where the widget lays text over the drawing (the initials card). The object then holds
  /// still and is not scaled, so the text and the card never drift apart.
  bool get overlaysText => false;

  /// The fallback for a subject with no object: a printed card for its initials, with the one volt
  /// tick inked underneath.
  static const EmblemArt monogram = _Monogram();

  static EmblemArt? forKind(EmblemKind kind) => switch (kind) {
        EmblemKind.accountancy => const _Accountancy(),
        EmblemKind.businessStudies => const _Business(),
        EmblemKind.economics => _Economics.instance,
        EmblemKind.english => const _English(),
        EmblemKind.generalTest => const _GeneralTest(),
        EmblemKind.mathematics => const _Mathematics(),
        EmblemKind.physics => _Physics.instance,
        EmblemKind.chemistry => _Chemistry.instance,
        EmblemKind.biology => const _Biology(),
        EmblemKind.history => const _History(),
        EmblemKind.politicalScience => const _Ballot(),
        EmblemKind.geography => const _Geography(),
        EmblemKind.psychology => _Psychology.instance,
        EmblemKind.sociology => const _Sociology(),
        EmblemKind.computerScience => const _Code(),
        EmblemKind.language => const _Language(),
        // The thirteen subjects added on 15 Oct 2026 have a photo-real object from 40 dp up and no
        // vector drawing: at 24 dp (a chip or a dense row) they keep the initials card.
        EmblemKind.environmentalStudies ||
        EmblemKind.massMedia ||
        EmblemKind.homeScience ||
        EmblemKind.physicalEducation ||
        EmblemKind.legalStudies ||
        EmblemKind.knowledgeTradition ||
        EmblemKind.anthropology ||
        EmblemKind.fineArts ||
        EmblemKind.performingArts ||
        EmblemKind.engineeringGraphics ||
        EmblemKind.entrepreneurship ||
        EmblemKind.agriculture ||
        EmblemKind.teachingAptitude ||
        EmblemKind.other =>
          null,
      };
}

// ---------------------------------------------------------------------------------------------
// Accountancy: a ledger sheet with a T account, and a calculator whose equals key is the mark.

class _Accountancy extends EmblemArt {
  const _Accountancy();

  static const _calcPivot = Offset(64, 60);
  static const _calcTilt = 7.0;

  @override
  void object(Sketch s) {
    final p = s.p;
    final c = s.canvas;
    // The ledger sheet, turned a little left.
    c.save();
    c.translate(42, 50);
    c.rotate(-9 * math.pi / 180);
    c.translate(-42, -50);
    final sheet = Path()..addPolygon(const [Offset(18, 18), Offset(56, 18), Offset(64, 26), Offset(64, 76), Offset(18, 76)], true);
    s.slab(sheet, const Offset(1.4, 1.8), p.lit, p.shade);
    // Folded down the T account: the right half turns from the lamp.
    s.fold(sheet, Path()..addRect(const Rect.fromLTRB(41, 0, 100, 100)), Color.lerp(p.lit, p.shade, 0.5)!);
    s.poly(const [Offset(56, 18), Offset(64, 26), Offset(56, 26)], p.shade);
    if (s.fine) {
      s.rect(const Rect.fromLTRB(22, 23, 46, 27), p.deep.withValues(alpha: 0.85));
      s.line(const Offset(22, 32), const Offset(60, 32), p.deep, 1.5, cap: StrokeCap.butt);
      s.line(const Offset(41, 32), const Offset(41, 72), p.deep, 1.5, cap: StrokeCap.butt);
      for (var i = 0; i < 6; i++) {
        final y = 38.0 + i * 6;
        s.line(Offset(22, y), Offset(i.isEven ? 37 : 33, y), p.mid.withValues(alpha: p.isNight ? 0.9 : 0.7), 1.3);
        s.line(Offset(45, y), Offset(i.isEven ? 52 : 57, y), p.mid.withValues(alpha: p.isNight ? 0.9 : 0.7), 1.3);
      }
    }
    s.sheen(sheet);
    c.restore();

    // The calculator, turned a little right.
    c.save();
    c.translate(_calcPivot.dx, _calcPivot.dy);
    c.rotate(_calcTilt * math.pi / 180);
    c.translate(-_calcPivot.dx, -_calcPivot.dy);
    final body = Path()..addRRect(RRect.fromLTRBR(47, 35, 81, 81, const Radius.circular(6)));
    s.fill(body.shift(const Offset(2, 2.6)), p.deep);
    s.folded(body, Path()..addRect(const Rect.fromLTRB(66, 0, 100, 100)), p.mid, p.midShade);
    s.rrect(const Rect.fromLTRB(51, 40, 77, 51), 2.5, p.deep);
    if (s.fine) {
      for (var i = 0; i < 4; i++) {
        s.rect(Rect.fromLTRB(61.0 + i * 3.8, 43.5, 63.6 + i * 3.8, 47.5), p.mid.withValues(alpha: 0.95));
      }
    }
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        if (row == 2 && col == 2) continue;
        final cx = 56.0 + col * 8, cy = 58.0 + row * 8;
        s.rrect(Rect.fromCenter(center: Offset(cx, cy + 0.9), width: 6.4, height: 5.2), 1.6, p.midShade);
        s.rrect(Rect.fromCenter(center: Offset(cx, cy), width: 6.4, height: 5.2), 1.6, col == 2 ? p.shade : p.lit);
      }
    }
    s.sheen(body);
    c.restore();
  }

  @override
  EmblemMark mark(double t) => EmblemMark(rotateAround(const Offset(72, 74), _calcPivot, _calcTilt), 4.0, glyph: MarkGlyph.equals, style: MarkStyle.key);
}

// ---------------------------------------------------------------------------------------------
// Business Studies: an organisation chart behind a briefcase; the clasp is the mark.

class _Business extends EmblemArt {
  const _Business();

  @override
  void object(Sketch s) {
    final p = s.p;
    final c = s.canvas;
    c.save();
    c.translate(52, 34);
    c.rotate(6 * math.pi / 180);
    c.translate(-52, -34);
    final chart = Path()..addRRect(RRect.fromLTRBR(32, 13, 72, 50, const Radius.circular(2)));
    s.slab(chart, const Offset(1.2, 1.4), p.lit, p.shade);
    s.fold(chart, Path()..addRect(const Rect.fromLTRB(52, 0, 100, 100)), Color.lerp(p.lit, p.shade, 0.5)!);
    s.rrect(const Rect.fromLTRB(46, 18, 58, 24.5), 1.5, p.mid);
    if (s.fine) {
      s.line(const Offset(52, 24.5), const Offset(52, 29), p.deep, 1.3);
      s.line(const Offset(39, 29), const Offset(65, 29), p.deep, 1.3);
      for (final x in [39.0, 52.0, 65.0]) {
        s.line(Offset(x, 29), Offset(x, 32), p.deep, 1.3);
      }
    }
    for (final x in [39.0, 52.0, 65.0]) {
      s.rrect(Rect.fromCenter(center: Offset(x, 35.5), width: 9, height: 5.5), 1.4, x == 52 ? p.deep : p.shade);
    }
    s.sheen(chart);
    c.restore();

    // The handle.
    final handle = Path()
      ..moveTo(39, 46)
      ..lineTo(39, 37)
      ..arcToPoint(const Offset(44, 32), radius: const Radius.circular(5))
      ..lineTo(56, 32)
      ..arcToPoint(const Offset(61, 37), radius: const Radius.circular(5))
      ..lineTo(61, 46);
    s.stroke(handle.shift(const Offset(0.8, 1)), p.deep, 4.6, cap: StrokeCap.butt);
    s.stroke(handle, p.midShade, 4.6, cap: StrokeCap.butt);

    // The case: lid lit from the lamp, body turned down.
    final body = Path()..addRRect(RRect.fromLTRBR(17, 44, 83, 80, const Radius.circular(7)));
    s.fill(body.shift(const Offset(0, 2.6)), p.deep);
    s.folded(body, Path()..addRect(const Rect.fromLTRB(0, 56, 100, 100)), p.lit, p.shade);
    for (final x in [29.0, 66.0]) {
      s.folded(Path()..addRect(Rect.fromLTRB(x, 44, x + 5, 80)), Path()..addRect(const Rect.fromLTRB(0, 56, 100, 100)), p.mid, p.midShade);
    }
    s.line(const Offset(17, 56), const Offset(83, 56), p.deep.withValues(alpha: 0.8), 1.4, cap: StrokeCap.butt);
    if (s.fine) {
      s.rrect(const Rect.fromLTRB(17, 77, 25, 80), 1.5, p.deep.withValues(alpha: 0.6));
      s.rrect(const Rect.fromLTRB(75, 77, 83, 80), 1.5, p.deep.withValues(alpha: 0.6));
    }
    s.sheen(body);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(50, 56), 4.6, glyph: MarkGlyph.slot, style: MarkStyle.pill);
}

// ---------------------------------------------------------------------------------------------
// Economics: supply and demand on graph paper; the equilibrium is the mark.

class _Economics extends EmblemArt {
  _Economics._() {
    demand = Path()
      ..moveTo(30, 30)
      ..cubicTo(36, 52, 50, 62, 75, 65);
    supply = Path()
      ..moveTo(30, 67)
      ..cubicTo(50, 62, 62, 48, 72, 28);
    equilibrium = _intersect(demand, supply);
  }

  static final _Economics instance = _Economics._();
  static const _pivot = Offset(50, 50);
  static const _tilt = -4.0;

  late final Path demand;
  late final Path supply;
  late final Offset equilibrium;

  static Offset _intersect(Path a, Path b) {
    final ma = a.computeMetrics().first, mb = b.computeMetrics().first;
    var best = Offset.zero;
    var bestD = double.infinity;
    for (var i = 0; i <= 200; i++) {
      final pa = ma.getTangentForOffset(ma.length * i / 200)!.position;
      for (var j = 0; j <= 200; j += 2) {
        final pb = mb.getTangentForOffset(mb.length * j / 200)!.position;
        final d = (pa - pb).distanceSquared;
        if (d < bestD) {
          bestD = d;
          best = Offset.lerp(pa, pb, 0.5)!;
        }
      }
    }
    return best;
  }

  @override
  void object(Sketch s) {
    final p = s.p;
    final c = s.canvas;
    c.save();
    c.translate(_pivot.dx, _pivot.dy);
    c.rotate(_tilt * math.pi / 180);
    c.translate(-_pivot.dx, -_pivot.dy);
    final sheet = Path()..addPolygon(const [Offset(18, 19), Offset(74, 19), Offset(82, 27), Offset(82, 80), Offset(18, 80)], true);
    s.slab(sheet, const Offset(1.4, 2), p.lit, p.shade);
    // Folded in half down the middle of the graph.
    s.fold(sheet, Path()..addRect(const Rect.fromLTRB(52, 0, 100, 100)), Color.lerp(p.lit, p.shade, 0.5)!);
    s.poly(const [Offset(74, 19), Offset(82, 27), Offset(74, 27)], p.shade);
    if (s.fine) {
      final g = p.mid.withValues(alpha: p.isNight ? 0.45 : 0.35);
      for (var x = 34.0; x <= 74; x += 8) {
        s.line(Offset(x, 25), Offset(x, 72), g, 0.7, cap: StrokeCap.butt);
      }
      for (var y = 32.0; y <= 72; y += 8) {
        s.line(Offset(26, y), Offset(76, y), g, 0.7, cap: StrokeCap.butt);
      }
    }
    // Axes.
    s.polyline(const [Offset(26, 26), Offset(26, 73), Offset(77, 73)], p.deep, 2.4);
    if (s.fine) {
      s.poly(const [Offset(26, 22.5), Offset(23.2, 27.5), Offset(28.8, 27.5)], p.deep);
      s.poly(const [Offset(80.5, 73), Offset(75.5, 70.2), Offset(75.5, 75.8)], p.deep);
      final e = equilibrium;
      s.dashed(Offset(e.dx, e.dy + 5), Offset(e.dx, 73), p.deep.withValues(alpha: 0.7), 1.1);
      s.dashed(Offset(e.dx - 5, e.dy), Offset(26, e.dy), p.deep.withValues(alpha: 0.7), 1.1);
    }
    final w = s.fine ? 3.4 : 4.6;
    s.stroke(demand, p.isNight ? p.mid : p.mid, w);
    s.stroke(supply, p.deep, w);
    s.sheen(sheet);
    c.restore();
  }

  @override
  EmblemMark mark(double t) => EmblemMark(rotateAround(equilibrium, _pivot, _tilt), 4.8, style: MarkStyle.reticle);
}

// ---------------------------------------------------------------------------------------------
// English: an open book and a fountain pen nib; the ink at the nib is the mark.

class _English extends EmblemArt {
  const _English();

  static const _tip = Offset(61, 62);
  static const _nibTilt = 36.0;

  @override
  void object(Sketch s) {
    final p = s.p;
    final c = s.canvas;
    Path page({required bool left, double drop = 0, double grow = 0}) {
      final dir = left ? -1.0 : 1.0;
      return Path()
        ..moveTo(50, 36 + drop)
        ..quadraticBezierTo(50 + dir * 16, 26 + drop, 50 + dir * (33 + grow), 30 + drop)
        ..lineTo(50 + dir * (33 + grow), 70 + drop + grow * 0.6)
        ..quadraticBezierTo(50 + dir * 16, 66 + drop + grow * 0.6, 50, 74 + drop + grow * 0.8)
        ..close();
    }

    // Cover, then the page block's edges, then the pages.
    s.fill(page(left: true, drop: 4, grow: 4), p.midShade);
    s.fill(page(left: false, drop: 4, grow: 4), p.midShade);
    s.fill(page(left: true, drop: 2.2, grow: 1.5), p.shade);
    s.fill(page(left: false, drop: 2.2, grow: 1.5), p.shade);
    final leftPage = page(left: true);
    final rightPage = page(left: false);
    s.fill(leftPage, p.lit);
    s.fill(rightPage, Color.lerp(p.lit, p.shade, 0.55)!);
    if (s.fine) {
      final ink = p.mid.withValues(alpha: p.isNight ? 0.85 : 0.6);
      for (var i = 0; i < 5; i++) {
        final y = 36.0 + i * 6.4;
        s.stroke(
          Path()
            ..moveTo(22, y - 1.5)
            ..quadraticBezierTo(34, y - 4.5, i == 4 ? 38 : 45, y + (i == 4 ? -2.6 : 0.8)),
          ink,
          1.3,
        );
      }
      for (var i = 0; i < 3; i++) {
        final y = 36.0 + i * 6.4;
        s.stroke(
          Path()
            ..moveTo(55, y + 0.8)
            ..quadraticBezierTo(62, y - 3.2, 70, y - 3.6),
          ink.withValues(alpha: ink.a * 0.8),
          1.3,
        );
      }
      s.line(const Offset(50, 37), const Offset(50, 73), p.deep.withValues(alpha: 0.35), 1.2);
    }
    s.sheen(leftPage);

    // The nib, tip on the right page.
    c.save();
    c.translate(_tip.dx, _tip.dy);
    c.rotate(_nibTilt * math.pi / 180);
    final nib = Path()
      ..moveTo(0, 0)
      ..cubicTo(-3, -6, -8.5, -13, -8.5, -22)
      ..lineTo(-8.5, -31)
      ..lineTo(8.5, -31)
      ..lineTo(8.5, -22)
      ..cubicTo(8.5, -13, 3, -6, 0, 0)
      ..close();
    s.fill(nib.shift(const Offset(1.6, 1.2)), p.deep.withValues(alpha: p.isNight ? 0.9 : 0.35));
    s.folded(nib, Path()..addRect(const Rect.fromLTRB(0, -40, 20, 5)), p.mid, p.midShade);
    s.rect(const Rect.fromLTRB(-8.5, -36, 8.5, -30), p.deep);
    s.circle(const Offset(0, -17), s.fine ? 2.2 : 2.6, p.deep);
    s.line(const Offset(0, -15), const Offset(0, -3.5), p.deep, s.fine ? 1.1 : 1.6);
    s.sheen(nib);
    c.restore();
  }

  @override
  EmblemMark mark(double t) => EmblemMark(_tip + const Offset(-0.6, 5.6), 4.4, style: MarkStyle.drop);
}

// ---------------------------------------------------------------------------------------------
// General Test: a three by three pattern; the missing answer is the mark.

class _GeneralTest extends EmblemArt {
  const _GeneralTest();

  @override
  void object(Sketch s) {
    final p = s.p;
    final card = Path()..addRRect(RRect.fromLTRBR(19, 19, 81, 79, const Radius.circular(7)));
    s.slab(card, const Offset(0, 2.8), p.lit, p.shade);
    if (s.fine) {
      s.fill(Path.combine(PathOperation.intersect, card, Path()..addPolygon(const [Offset(100, 0), Offset(100, 100), Offset(0, 100)], true)),
          p.shade.withValues(alpha: 0.28));
    }
    const shapes = [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, -1],
    ];
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        final center = Offset(31.0 + col * 19, 31.0 + row * 18);
        if (s.fine) {
          s.rrect(Rect.fromCenter(center: center, width: 15, height: 14), 3.5, p.shade.withValues(alpha: p.isNight ? 0.35 : 0.45));
        }
        final kind = shapes[row][col];
        if (kind < 0) continue;
        final colour = [p.deep, p.mid, p.midShade][kind];
        switch (kind) {
          case 0:
            s.circle(center, 4.6, colour);
          case 1:
            s.rrect(Rect.fromCenter(center: center, width: 8.6, height: 8.6), 1.2, colour);
          default:
            s.poly([center + const Offset(0, -5.4), center + const Offset(5.4, 4.2), center + const Offset(-5.4, 4.2)], colour);
        }
      }
    }
    s.sheen(card);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(69, 67), 5.2);
}

// ---------------------------------------------------------------------------------------------
// Mathematics: a protractor measuring an angle and a set square; the centre point is the mark.

class _Mathematics extends EmblemArt {
  const _Mathematics();

  static const _c = Offset(41, 68);
  static const _r = 30.0;

  @override
  void object(Sketch s) {
    final p = s.p;
    // Set square behind on the right.
    final square = Path.combine(
      PathOperation.difference,
      Path()..addPolygon(const [Offset(53, 76), Offset(86, 76), Offset(86, 24)], true),
      Path()..addPolygon(const [Offset(67, 71), Offset(81.5, 71), Offset(81.5, 47)], true),
    );
    s.fill(square.shift(const Offset(1.4, 2)), p.deep);
    s.folded(square, Path()..addPolygon(const [Offset(53, 76), Offset(86, 24), Offset(100, 24), Offset(100, 100), Offset(53, 100)], true), p.mid,
        p.midShade);
    if (s.fine) {
      for (var i = 0; i < 8; i++) {
        final y = 72.0 - i * 6;
        s.line(Offset(86, y), Offset(i.isEven ? 82.5 : 84, y), p.deep, 1);
      }
    }

    // The protractor.
    final outer = Path()
      ..moveTo(_c.dx - _r, _c.dy)
      ..arcTo(Rect.fromCircle(center: _c, radius: _r), math.pi, math.pi, false)
      ..close();
    final inner = Path()
      ..moveTo(_c.dx - 12, _c.dy)
      ..arcTo(Rect.fromCircle(center: _c, radius: 12), math.pi, math.pi, false)
      ..close();
    final protractor = Path.combine(PathOperation.difference, outer, inner);
    s.fill(protractor.shift(const Offset(1.2, 1.6)), p.deep.withValues(alpha: p.isNight ? 1 : 0.5));
    s.folded(protractor, Path()..addRect(Rect.fromLTRB(_c.dx, 0, 100, 100)), p.lit, Color.lerp(p.lit, p.shade, 0.6)!);
    s.rrect(Rect.fromLTRB(_c.dx - _r - 2, _c.dy - 0.5, _c.dx + _r + 2, _c.dy + 4), 1.4, p.midShade);
    if (s.fine) {
      for (var deg = 0; deg <= 180; deg += s.plate ? 10 : 15) {
        final a = math.pi + deg * math.pi / 180;
        final long = deg % 30 == 0;
        final dir = Offset(math.cos(a), math.sin(a));
        s.line(_c + dir * (_r - 1), _c + dir * (_r - (long ? 6.5 : 3.6)), p.deep, long ? 1.3 : 0.9, cap: StrokeCap.butt);
      }
      // The angle being measured.
      const a = -50 * math.pi / 180;
      s.line(_c, _c + Offset(math.cos(a), math.sin(a)) * (_r + 4), p.deep, 1.7);
      s.stroke(
        Path()..addArc(Rect.fromCircle(center: _c, radius: 16.5), a, -a),
        p.mid,
        2.2,
        cap: StrokeCap.butt,
      );
    }
    s.sheen(outer);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(_c, 4.9, style: MarkStyle.wedge);
}

// ---------------------------------------------------------------------------------------------
// Physics: three orbits; the nucleus is the mark and one electron travels.

class _Physics extends EmblemArt {
  _Physics._() {
    for (final deg in const [0.0, 60.0, -60.0]) {
      final o = Path()..addOval(Rect.fromCenter(center: _c, width: 70, height: 25));
      orbits.add(rotatedPath(o, _c, deg));
    }
    metrics = [for (final o in orbits) o.computeMetrics().first];
  }

  static final _Physics instance = _Physics._();
  static const _c = Offset(50, 50);

  final List<Path> orbits = [];
  late final List<PathMetric> metrics;

  @override
  double get groundY => 86;

  @override
  double get shadowRx => 22;

  /// How far the atom has swept at idle phase [t]: one full turn per cycle, slow at the ends and
  /// quick in the middle (the speed is 1 - cos, so it is zero at t = 0 and t = 1 and the loop
  /// closes without a jolt).
  static double sweepDegrees(double t) => 360 * (t - math.sin(2 * math.pi * t) / (2 * math.pi));

  @override
  void object(Sketch s) {}

  Offset _at(int orbit, double f) {
    final m = metrics[orbit];
    return m.getTangentForOffset(m.length * (f % 1.0))!.position;
  }

  @override
  void live(Sketch s, double t) {
    final p = s.p;
    final c = s.canvas;
    final w = s.fine ? 3.0 : 4.2;
    final orbitInk = [
      p.isNight ? p.lit : Color.lerp(p.lit, p.mid, 0.3)!,
      Color.lerp(p.lit, p.mid, p.isNight ? 0.35 : 0.6)!,
      Color.lerp(p.lit, p.mid, p.isNight ? 0.35 : 0.6)!,
    ];
    final sweep = sweepDegrees(t) * math.pi / 180;

    // The orbits, turning as one: their shadow first (the lamp stays where it is), then the rings.
    c.save();
    c.translate(0.6, 1.6);
    c.translate(_c.dx, _c.dy);
    c.rotate(sweep);
    c.translate(-_c.dx, -_c.dy);
    for (final o in orbits) {
      s.stroke(o, p.isNight ? p.deep : p.shade, w);
    }
    c.restore();
    c.save();
    c.translate(_c.dx, _c.dy);
    c.rotate(sweep);
    c.translate(-_c.dx, -_c.dy);
    for (var i = 0; i < orbits.length; i++) {
      s.stroke(orbits[i], orbitInk[i], w);
    }
    // The electrons ride their own orbits; the lit one is quick and leaves a tail.
    if (s.fine) {
      for (final (i, f, k) in const [(1, 0.18, -1.0), (2, 0.62, 1.0)]) {
        final pos = _at(i, f + k * t);
        s.circle(pos + const Offset(0.4, 1), 3.2, p.deep.withValues(alpha: 0.6));
        s.circle(pos, 3.2, p.mid);
      }
    }
    final main = (t * 2 + 0.36) % 1.0;
    if (s.fine) {
      for (var k = 5; k >= 1; k--) {
        final pos = _at(0, main - k * 0.022);
        s.circle(pos, 4.2 - k * 0.55, p.lit.withValues(alpha: (s.plate ? 0.2 : 0.16) * (6 - k)));
      }
    }
    final pos = _at(0, main);
    final r = s.fine ? 4.0 : 5.0;
    s.circle(pos + const Offset(0.4, 1), r, p.deep.withValues(alpha: 0.7));
    s.circle(pos, r, p.lit);
    c.restore();
  }

  /// The nucleus beats twice a cycle.
  @override
  EmblemMark mark(double t) => EmblemMark(_c, 7.4 * (1 + 0.1 * (1 - math.cos(t * 4 * math.pi)) / 2));
}

// ---------------------------------------------------------------------------------------------
// Chemistry: a conical flask; the bubble rising through it is the mark.

class _Chemistry extends EmblemArt {
  _Chemistry._() {
    final neck = Path()..addRect(const Rect.fromLTRB(42.5, 21, 57.5, 42));
    final body = Path()
      ..moveTo(42.5, 40)
      ..lineTo(42.5, 44)
      ..lineTo(23, 71)
      ..quadraticBezierTo(19, 80, 29, 80)
      ..lineTo(71, 80)
      ..quadraticBezierTo(81, 80, 77, 71)
      ..lineTo(57.5, 44)
      ..lineTo(57.5, 40)
      ..close();
    flask = Path.combine(PathOperation.union, neck, body);
  }

  static final _Chemistry instance = _Chemistry._();

  late final Path flask;

  static final _rightHalf = Path()..addRect(const Rect.fromLTRB(50, 0, 100, 100));

  @override
  void object(Sketch s) {
    final p = s.p;
    s.fill(flask.shift(const Offset(1.4, 2)), p.deep.withValues(alpha: p.isNight ? 1 : 0.45));
    s.folded(flask, _rightHalf, p.lit, Color.lerp(p.lit, p.shade, 0.7)!);
    s.rrect(const Rect.fromLTRB(39.5, 16.5, 60.5, 22.5), 2, p.midShade);
    if (s.fine) {
      for (final y in const [27.0, 32.0, 37.0]) {
        s.line(Offset(44.5, y), Offset(y == 32 ? 49 : 47.5, y), p.deep.withValues(alpha: 0.7), 1);
      }
      s.line(const Offset(46.5, 50), const Offset(50.5, 50), p.deep.withValues(alpha: 0.6), 1);
    }
  }

  /// The liquid slops with a travelling wave (two swells a cycle), and bubbles rise through it.
  @override
  void live(Sketch s, double t) {
    final p = s.p;
    final c = s.canvas;
    final amp = s.fine ? 2.6 : 3.4;
    double surface(double x) => 57 + amp * math.sin((x - 20) / 60 * 2 * math.pi + t * 4 * math.pi);

    final top = Path()..moveTo(14, surface(14));
    for (var x = 16.0; x <= 86; x += 2) {
      top.lineTo(x, surface(x));
    }
    final liquid = Path.from(top)
      ..lineTo(86, 100)
      ..lineTo(14, 100)
      ..close();

    c.save();
    c.clipPath(flask);
    s.fill(liquid, p.mid);
    c.save();
    c.clipPath(_rightHalf);
    s.fill(liquid, p.midShade);
    c.restore();
    s.stroke(top, Color.lerp(p.mid, p.lit, 0.55)!, 1.7, cap: StrokeCap.butt);
    if (s.fine) {
      for (final y in const [62.0, 70.0]) {
        final x = 42.5 - (y - 44) * 0.72 + 2.5;
        s.line(Offset(x, y), Offset(x + 4, y), p.deep.withValues(alpha: 0.6), 1);
      }
      for (final (x, off, r) in const [(38.0, 0.0, 2.2), (62.0, 0.5, 1.7), (47.0, 0.75, 1.3)]) {
        final u = (t * 3 + off) % 1.0;
        final y = 77 - u * 18;
        final fade = math.min(1.0, math.min(u / 0.14, (1 - u) / 0.2));
        final rr = r * (0.7 + 0.5 * u) * (s.fine ? 1 : 1.35);
        s.ring(Offset(x + math.sin(u * math.pi * 2 + off * 6) * 1.2, y), rr, Color.lerp(p.mid, p.lit, 0.8)!.withValues(alpha: fade), s.fine ? 1.1 : 1.6);
      }
    }
    c.restore();
    s.sheen(flask);
  }

  @override
  EmblemMark mark(double t) {
    final u = (t * 3 + 0.42) % 1.0;
    final y = 70 - u * 44;
    final grow = u < 0.12 ? u / 0.12 : (u > 0.9 ? (1 - u) / 0.1 : 1.0);
    final sway = math.sin(u * math.pi * 3) * 2.0 * (1 - u * 0.5);
    return EmblemMark(Offset(50 + sway, y), 4.4 * (0.35 + 0.65 * grow));
  }
}

// ---------------------------------------------------------------------------------------------
// Biology: a leaf folded on its midrib; a cell on the lit half is the mark.

class _Biology extends EmblemArt {
  const _Biology();

  static const _base = Offset(33, 73);
  static const _tipPoint = Offset(79, 21);

  @override
  void object(Sketch s) {
    final p = s.p;
    final upper = Path()
      ..moveTo(_base.dx, _base.dy)
      ..cubicTo(17, 52, 38, 20, _tipPoint.dx, _tipPoint.dy)
      ..quadraticBezierTo(53, 46, _base.dx, _base.dy)
      ..close();
    final lower = Path()
      ..moveTo(_tipPoint.dx, _tipPoint.dy)
      ..cubicTo(84, 50, 62, 78, _base.dx, _base.dy)
      ..quadraticBezierTo(53, 46, _tipPoint.dx, _tipPoint.dy)
      ..close();
    final whole = Path.combine(PathOperation.union, upper, lower);
    // Stem.
    s.stroke(
      Path()
        ..moveTo(_base.dx + 2, _base.dy - 2)
        ..quadraticBezierTo(30, 78, 24, 84),
      p.midShade,
      3.4,
    );
    s.fill(whole.shift(const Offset(1.2, 2.2)), p.deep.withValues(alpha: p.isNight ? 1 : 0.4));
    s.fill(upper, Color.lerp(p.lit, p.mid, p.isNight ? 0.5 : 0.52)!);
    s.fill(lower, Color.lerp(p.mid, p.midShade, p.isNight ? 0.62 : 0.5)!);
    if (s.fine) {
      // The leaf's cells, a honeycomb under the nucleus, cut to the lit half.
      s.canvas.save();
      s.canvas.clipPath(upper);
      const cell = Offset(41, 47);
      final wall = p.deep.withValues(alpha: p.isNight ? 0.55 : 0.4);
      for (final o in const [Offset(0, 0), Offset(11.2, 0), Offset(-11.2, 0), Offset(5.6, 9.7), Offset(-5.6, 9.7), Offset(5.6, -9.7), Offset(-5.6, -9.7), Offset(16.8, 9.7), Offset(11.2, -19.4), Offset(0, -19.4), Offset(0, 19.4)]) {
        final hex = Path();
        for (var i = 0; i < 6; i++) {
          final a = (i * 60 + 30) * math.pi / 180;
          final pt = cell + o + Offset(math.cos(a), math.sin(a)) * 6.1;
          i == 0 ? hex.moveTo(pt.dx, pt.dy) : hex.lineTo(pt.dx, pt.dy);
        }
        hex.close();
        s.stroke(hex, wall, 1.0);
      }
      s.canvas.restore();
      final rib = (Path()
            ..moveTo(_base.dx, _base.dy)
            ..quadraticBezierTo(53, 46, _tipPoint.dx, _tipPoint.dy))
          .computeMetrics()
          .first;
      for (final f in const [0.28, 0.48, 0.68]) {
        final tan = rib.getTangentForOffset(rib.length * f)!;
        final at = tan.position;
        final fwd = tan.vector;
        final normal = Offset(fwd.dy, -fwd.dx);
        final reach = 15 * (1 - f * 0.6);
        s.line(at, at + (fwd * 0.55 - normal) * reach, p.mid.withValues(alpha: p.isNight ? 0.9 : 0.75), 1.2);
        s.line(at, at + (fwd * 0.55 + normal) * reach, p.lit.withValues(alpha: p.isNight ? 0.35 : 0.55), 1.2);
      }
      s.stroke(
        Path()
          ..moveTo(_base.dx, _base.dy)
          ..quadraticBezierTo(53, 46, _tipPoint.dx, _tipPoint.dy),
        p.midShade,
        1.6,
      );
    }
    s.sheen(upper);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(41, 47), 4.4, style: MarkStyle.halo);
}

// ---------------------------------------------------------------------------------------------
// History: a columned hall; the medallion in the pediment is the mark.

class _History extends EmblemArt {
  const _History();

  @override
  void object(Sketch s) {
    final p = s.p;
    final shadeHalf = Path()..addRect(const Rect.fromLTRB(50, 0, 100, 100));
    // Steps.
    s.rect(const Rect.fromLTRB(16, 74, 84, 80), p.midShade);
    s.rect(const Rect.fromLTRB(16, 72.5, 84, 74), Color.lerp(p.mid, p.lit, 0.3)!);
    s.rect(const Rect.fromLTRB(21, 68, 79, 72.5), p.shade);
    s.rect(const Rect.fromLTRB(21, 67, 79, 68), p.lit);
    // Columns.
    for (var i = 0; i < 4; i++) {
      final cx = 29.0 + i * 14;
      s.rect(Rect.fromLTRB(cx - 3.6, 46, cx + 0.6, 67), p.lit);
      s.rect(Rect.fromLTRB(cx + 0.6, 46, cx + 3.6, 67), p.shade);
      s.rect(Rect.fromLTRB(cx - 5, 43.5, cx + 5, 46.5), Color.lerp(p.lit, p.shade, 0.25)!);
      if (s.plate) {
        s.line(Offset(cx - 1.6, 48), Offset(cx - 1.6, 65), p.deep.withValues(alpha: 0.25), 0.7);
      }
    }
    // Architrave and frieze.
    s.rect(const Rect.fromLTRB(19, 37, 81, 43.5), p.lit);
    s.rect(const Rect.fromLTRB(19, 41.5, 81, 43.5), p.shade);
    if (s.fine) {
      for (var x = 22.0; x < 79; x += 5) {
        s.rect(Rect.fromLTRB(x, 38.6, x + 2.4, 40.6), p.mid.withValues(alpha: 0.75));
      }
    }
    // Pediment, folded at the apex.
    final pediment = Path()..addPolygon(const [Offset(16, 37), Offset(50, 18), Offset(84, 37)], true);
    s.folded(pediment, shadeHalf, p.lit, p.shade);
    final tympanum = Path()..addPolygon(const [Offset(27, 34.5), Offset(50, 22.5), Offset(73, 34.5)], true);
    s.folded(tympanum, shadeHalf, p.mid, p.midShade);
    s.sheen(pediment);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(50, 30), 4.0);
}

// ---------------------------------------------------------------------------------------------
// Political Science: a ballot going into the box; the filled choice is the mark.

class _Ballot extends EmblemArt {
  const _Ballot();

  @override
  void object(Sketch s) {
    final p = s.p;
    // The box.
    final front = Path()..addRect(const Rect.fromLTRB(20, 49, 66, 80));
    final top = Path()..addPolygon(const [Offset(20, 49), Offset(33, 40), Offset(79, 40), Offset(66, 49)], true);
    final side = Path()..addPolygon(const [Offset(66, 49), Offset(79, 40), Offset(79, 71), Offset(66, 80)], true);
    s.fill(top, Color.lerp(p.lit, p.shade, 0.2)!);
    s.fill(front, p.lit);
    s.fill(side, p.shade);
    s.rect(const Rect.fromLTRB(20, 59, 66, 66), p.mid);
    s.poly(const [Offset(66, 59), Offset(79, 50), Offset(79, 57), Offset(66, 66)], p.midShade);
    if (s.fine) {
      s.rrect(const Rect.fromLTRB(36, 70, 50, 74), 1, p.deep.withValues(alpha: 0.35));
    }
    s.poly(const [Offset(37, 46.4), Offset(41.6, 43.2), Offset(64, 43.2), Offset(59.4, 46.4)], p.deep);
    s.sheen(front);

    // The ballot, half into the slot.
    final paper = Path()..addPolygon(const [Offset(39, 13), Offset(62, 11), Offset(63.6, 44.6), Offset(40.4, 45.6)], true);
    s.folded(paper, Path()..addRect(const Rect.fromLTRB(55, 0, 100, 100)), p.lit, Color.lerp(p.lit, p.shade, 0.55)!);
    s.line(const Offset(40, 45.8), const Offset(64, 44.8), p.deep, 1.6, cap: StrokeCap.butt);
    s.ring(const Offset(46, 21), s.fine ? 3.3 : 3.8, p.ring, s.fine ? 1.2 : 1.6);
    if (s.fine) {
      s.line(const Offset(51.5, 20.6), const Offset(58, 20.3), p.deep.withValues(alpha: 0.6), 1.3);
      s.line(const Offset(51.8, 32), const Offset(58.4, 31.7), p.deep.withValues(alpha: 0.6), 1.3);
    }
    s.sheen(paper);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(46.4, 32.4), 4.2);
}

// ---------------------------------------------------------------------------------------------
// Geography: a map folded in three, with contours; the summit pin is the mark.

class _Geography extends EmblemArt {
  const _Geography();

  static const _summit = Offset(55, 49);

  @override
  void object(Sketch s) {
    final p = s.p;
    final a = Path()..addPolygon(const [Offset(17, 30), Offset(39, 24), Offset(39, 74), Offset(17, 80)], true);
    final b = Path()..addPolygon(const [Offset(39, 24), Offset(61, 30), Offset(61, 80), Offset(39, 74)], true);
    final c = Path()..addPolygon(const [Offset(61, 30), Offset(83, 24), Offset(83, 74), Offset(61, 80)], true);
    final map = Path.combine(PathOperation.union, Path.combine(PathOperation.union, a, b), c);
    s.fill(map.shift(const Offset(0.8, 2.4)), p.deep.withValues(alpha: p.isNight ? 1 : 0.4));
    s.fill(a, p.lit);
    s.fill(b, Color.lerp(p.lit, p.shade, 0.75)!);
    s.fill(c, Color.lerp(p.lit, p.shade, 0.18)!);

    if (s.fine) {
      s.canvas.save();
      s.canvas.clipPath(map);
      // The river.
      s.stroke(
        Path()
          ..moveTo(14, 66)
          ..cubicTo(30, 70, 36, 56, 48, 64)
          ..cubicTo(60, 72, 70, 48, 88, 52),
        p.mid,
        2.6,
      );
      final ink = p.deep.withValues(alpha: p.isNight ? 0.55 : 0.45);
      for (var k = 1; k <= (s.plate ? 4 : 3); k++) {
        final r = 6.0 + k * 6.5;
        final path = Path();
        for (var i = 0; i <= 48; i++) {
          final th = i / 48 * 2 * math.pi;
          final wob = 1 + 0.13 * math.sin(th * 3 + k) + 0.07 * math.cos(th * 5 - k * 0.7);
          final pt = _summit + Offset(math.cos(th) * r * 1.15 * wob, math.sin(th) * r * 0.82 * wob);
          i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
        }
        path.close();
        s.stroke(path, ink, 1.1);
      }
      s.canvas.restore();
      // The middle panel is turned away from the lamp: dim what is printed on it.
      s.fill(b, p.deep.withValues(alpha: p.isNight ? 0.12 : 0.06));
    }
    s.sheen(a);
  }

  @override
  void live(Sketch s, double t) {
    final m = markAt(t, s.detail);
    final p = s.p;
    final lift = (_summit.dy - 2) - (m.center.dy + m.radius * 0.6);
    s.softEllipse(_summit, 5 - lift * 0.15, 1.8, p.deep.withValues(alpha: p.isNight ? 0.6 : 0.35));
    final tip = Offset(m.center.dx, m.center.dy + m.radius + 6.5);
    s.poly([m.center + Offset(-m.radius * 0.72, m.radius * 0.5), tip, m.center + Offset(m.radius * 0.72, m.radius * 0.5)], p.deep);
  }

  @override
  EmblemMark mark(double t) => markAt(t, EmblemDetail.tile);

  @override
  EmblemMark markAt(double t, EmblemDetail detail) {
    final bob = (1 - math.cos(t * 4 * math.pi)) / 2;
    return EmblemMark(Offset(_summit.dx, _summit.dy - 12.5 - bob * (detail == EmblemDetail.glyph ? 4.6 : 2.2)), 5.4);
  }
}

// ---------------------------------------------------------------------------------------------
// Psychology: a head in profile with a spiral of thought; its centre is the mark.

class _Psychology extends EmblemArt {
  _Psychology._() {
    head = Path()
      ..moveTo(36, 84)
      ..cubicTo(36, 76, 27, 70, 25.5, 56)
      ..cubicTo(23, 34, 36, 18, 54, 18)
      ..cubicTo(70, 18, 78, 30, 76.5, 42)
      ..cubicTo(76.5, 45, 79, 49, 81.5, 53)
      ..cubicTo(82.5, 55, 81, 56, 78, 56)
      ..cubicTo(78.6, 58, 77.6, 59.2, 76.6, 59.6)
      ..cubicTo(77.6, 61.4, 77, 63, 75.2, 63.6)
      ..cubicTo(75.6, 67.4, 73, 70.4, 68, 70.4)
      ..lineTo(64.5, 70.6)
      ..lineTo(63, 84)
      ..close();
    back = Path()
      ..moveTo(0, 0)
      ..lineTo(52, 0)
      ..cubicTo(40, 30, 50, 60, 47, 100)
      ..lineTo(0, 100)
      ..close();
    final sp = Path();
    const turns = 2.35;
    for (var i = 0; i <= 120; i++) {
      final th = i / 120 * turns * 2 * math.pi;
      final r = 1.2 + th * 1.02;
      final pt = Offset(math.cos(th) * r, math.sin(th) * r);
      i == 0 ? sp.moveTo(pt.dx, pt.dy) : sp.lineTo(pt.dx, pt.dy);
    }
    spiral = sp;
  }

  static final _Psychology instance = _Psychology._();
  static const _mind = Offset(52, 41);

  late final Path head;
  late final Path back;
  late final Path spiral;

  @override
  void object(Sketch s) {
    final p = s.p;
    s.fill(head.shift(const Offset(1.4, 2)), p.deep.withValues(alpha: p.isNight ? 1 : 0.4));
    s.folded(head, back, p.lit, Color.lerp(p.lit, p.shade, 0.75)!);
    // Daylight: lit paper on a pale plate needs a printed rim to hold its profile.
    if (!p.isNight) s.stroke(head, p.deep.withValues(alpha: 0.85), s.fine ? 1.2 : 1.8);
    if (s.fine) {
      s.stroke(
        Path()
          ..moveTo(70, 41)
          ..quadraticBezierTo(72, 39.6, 74, 40.4),
        p.deep.withValues(alpha: 0.6),
        1.2,
      );
    }
    s.sheen(head);
  }

  @override
  List<Color> glyphInks(EmblemPalette p) => [p.isNight ? p.lit : p.deep];

  @override
  void live(Sketch s, double t) {
    final c = s.canvas;
    c.save();
    c.translate(_mind.dx, _mind.dy);
    c.rotate(t * 2 * math.pi);
    s.stroke(spiral, s.p.isNight ? s.p.mid : s.p.deep, s.fine ? 2.3 : 3.2);
    c.restore();
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(_mind, 4.2);
}

// ---------------------------------------------------------------------------------------------
// Sociology: three people whose heads are a row of answer bubbles; one is inked.

class _Sociology extends EmblemArt {
  const _Sociology();

  static Path _body(double cx, double top, double halfWidth, double base) => Path()
    ..addRRect(RRect.fromLTRBAndCorners(cx - halfWidth, top, cx + halfWidth, base,
        topLeft: Radius.circular(halfWidth), topRight: Radius.circular(halfWidth)));

  /// The two figures behind. Dark ink on Daylight (a tan figure on a tan plate disappears), the
  /// lit tan on Night.
  static Color sideLit(EmblemPalette p) => p.isNight ? p.shade : Color.lerp(p.mid, p.deep, 0.62)!;
  static Color sideShade(EmblemPalette p) => p.isNight ? p.midShade : p.deep;

  /// How far a head rises at its nod. The bodies follow at about half.
  static double amplitude(EmblemDetail d) => d == EmblemDetail.glyph ? 5.6 : 4.4;

  static double _nod(double t, double offset) => (1 - math.cos((t * 2 + offset) * 2 * math.pi)) / 2;

  @override
  void object(Sketch s) {}

  @override
  List<Color> glyphInks(EmblemPalette p) => [sideLit(p), sideShade(p)];

  @override
  void live(Sketch s, double t) {
    final p = s.p;
    final c = s.canvas;
    final amp = amplitude(s.detail);
    final shadowInk = p.deep.withValues(alpha: p.isNight ? 1 : 0.4);

    for (final (cx, offset) in const [(29.0, 0.0), (71.0, 0.33)]) {
      final nod = _nod(t, offset);
      c.save();
      c.translate(0, -nod * amp * 0.5);
      final body = _body(cx, 52, 11.5, 78);
      s.fill(body.shift(const Offset(1, 1.8)), shadowInk);
      s.folded(body, Path()..addRect(Rect.fromLTRB(cx, 0, 100, 100)), sideLit(p), sideShade(p));
      c.restore();
      final center = Offset(cx, 41 - nod * amp);
      s.circle(center + const Offset(0.6, 1.2), 7, p.deep.withValues(alpha: p.isNight ? 0.9 : 0.4));
      s.circle(center, 7, p.lit);
      s.ring(center, 7 - 0.7, p.isNight ? p.ring : p.deep, s.fine ? 1.4 : 1.8);
    }

    // The front figure: its head is the one inked bubble (the mark).
    final nod = _nod(t, 0.66);
    c.save();
    c.translate(0, -nod * amp * 0.5);
    final front = _body(50, 51, 15, 81);
    s.fill(front.shift(const Offset(1.2, 2)), shadowInk);
    s.folded(front, Path()..addRect(const Rect.fromLTRB(50, 0, 100, 100)), p.lit, Color.lerp(p.lit, p.shade, 0.6)!);
    if (!p.isNight) {
      s.stroke(front, p.deep.withValues(alpha: 0.7), s.fine ? 1.1 : 1.5);
    }
    if (s.fine) {
      s.poly(const [Offset(45, 51.6), Offset(50, 59), Offset(55, 51.6)], p.mid);
    }
    s.sheen(front);
    c.restore();
  }

  @override
  EmblemMark mark(double t) => markAt(t, EmblemDetail.tile);

  @override
  EmblemMark markAt(double t, EmblemDetail detail) => EmblemMark(Offset(50, 37 - _nod(t, 0.66) * amplitude(detail)), 8.6);
}

// ---------------------------------------------------------------------------------------------
// Computer Science: a code window; the first title-bar bubble is the mark, the cursor blinks.

class _Code extends EmblemArt {
  const _Code();

  @override
  void object(Sketch s) {
    final p = s.p;
    final window = Path()..addRRect(RRect.fromLTRBR(15, 23, 85, 77, const Radius.circular(7)));
    s.slab(window, const Offset(1.6, 2.8), p.lit, p.deep);
    final bar = Path.combine(PathOperation.intersect, window, Path()..addRect(const Rect.fromLTRB(0, 0, 100, 36)));
    s.fill(bar, p.mid);
    s.fill(Path.combine(PathOperation.intersect, bar, Path()..addRect(const Rect.fromLTRB(50, 0, 100, 100))), p.midShade);
    s.circle(const Offset(35.5, 29.5), 3.1, Color.lerp(p.lit, p.mid, 0.25)!);
    s.circle(const Offset(45, 29.5), 3.1, Color.lerp(p.lit, p.mid, 0.5)!);
    // Body fold: the right half turned from the lamp.
    s.fill(Path.combine(PathOperation.intersect, window, Path()..addRect(const Rect.fromLTRB(50, 36, 100, 100))), p.shade.withValues(alpha: 0.55));
    final w = s.fine ? 3.8 : 5.0;
    s.polyline(const [Offset(37, 45), Offset(28, 54), Offset(37, 63)], p.deep, w);
    s.line(const Offset(46, 65), const Offset(54, 43), p.mid, w);
    s.polyline(const [Offset(63, 45), Offset(72, 54), Offset(63, 63)], p.deep, w);
    if (s.fine) {
      s.rrect(const Rect.fromLTRB(24, 68.5, 44, 71), 1.2, p.mid.withValues(alpha: 0.55));
      s.rrect(const Rect.fromLTRB(47, 68.5, 55, 71), 1.2, p.mid.withValues(alpha: 0.4));
    }
    s.sheen(window);
  }

  static final _body = Path()..addRRect(RRect.fromLTRBAndCorners(15, 36, 85, 77, bottomLeft: const Radius.circular(7), bottomRight: const Radius.circular(7)));

  /// The scan: a lit band sweeps the code from the title bar to the last line and back, easing
  /// at each end (a cosine, so the loop closes). Behind it a line types itself out under a steady
  /// cursor and is deleted again; the cursor blinks eight times a cycle while it rests.
  @override
  void live(Sketch s, double t) {
    final p = s.p;
    final c = s.canvas;
    final sweep = (1 - math.cos(t * 2 * math.pi)) / 2;
    final bandH = s.fine ? 11.0 : 13.0;
    final y = 36 - bandH * 0.4 + sweep * (41 + bandH * 0.4);
    c.save();
    c.clipPath(_body);
    final band = Rect.fromLTRB(15, y, 85, y + bandH);
    c.drawRect(
      band,
      Paint()
        ..shader = ui.Gradient.linear(
          band.topCenter,
          band.bottomCenter,
          [p.mid.withValues(alpha: 0), p.mid.withValues(alpha: p.isNight ? 0.5 : 0.42), p.mid.withValues(alpha: 0)],
          const [0, 0.55, 1],
        ),
    );
    c.drawLine(Offset(15, y + bandH * 0.55), Offset(85, y + bandH * 0.55), Paint()
      ..strokeWidth = s.fine ? 1.2 : 1.6
      ..color = p.isNight ? p.lit.withValues(alpha: 0.9) : p.deep.withValues(alpha: 0.85));
    c.restore();
    if (!s.fine) return;
    double smooth(double a, double b) {
      final x = ((t - a) / (b - a)).clamp(0.0, 1.0);
      return x * x * (3 - 2 * x);
    }

    final typed = 22 * (smooth(0.05, 0.55) - smooth(0.88, 1.0));
    if (typed > 0.3) s.rrect(Rect.fromLTRB(58, 68.5, 58 + typed, 71), 1.2, p.mid.withValues(alpha: 0.8));
    final typing = typed > 0.3 && typed < 21.7;
    final blink = (t * 8).floor().isEven;
    if (typing || blink) s.rect(Rect.fromLTRB(59 + typed, 65.5, 62.4 + typed, 73.5), p.deep);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(70, 29.5), 4.2, style: MarkStyle.pill);
}

// ---------------------------------------------------------------------------------------------
// The language papers: two speech bubbles; the mark is the reply waiting.

class _Language extends EmblemArt {
  const _Language();

  @override
  void object(Sketch s) {
    final p = s.p;
    final backBubble = Path()
      ..addRRect(RRect.fromLTRBR(38, 20, 84, 54, const Radius.circular(13)))
      ..addPolygon(const [Offset(66, 52), Offset(76, 63), Offset(74, 52)], true);
    s.fill(backBubble.shift(const Offset(1, 2)), p.deep.withValues(alpha: p.isNight ? 1 : 0.4));
    s.fill(backBubble, p.mid);
    s.fill(Path.combine(PathOperation.intersect, backBubble, Path()..addRect(const Rect.fromLTRB(0, 38, 100, 100))), p.midShade);
    final front = Path()
      ..addRRect(RRect.fromLTRBR(16, 38, 64, 72, const Radius.circular(13)))
      ..addPolygon(const [Offset(26, 70), Offset(22, 81), Offset(36, 70)], true);
    s.fill(front.shift(const Offset(1.2, 2.2)), p.deep.withValues(alpha: p.isNight ? 1 : 0.4));
    s.folded(front, Path()..addRect(const Rect.fromLTRB(0, 56, 100, 100)), p.lit, Color.lerp(p.lit, p.shade, 0.55)!);
    s.line(const Offset(25, 50), const Offset(53, 50), p.deep, s.fine ? 2.2 : 3);
    s.line(const Offset(25, 59), const Offset(44, 59), p.mid, s.fine ? 2.2 : 3);
    s.sheen(front);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(60, 29.5), 3.1, style: MarkStyle.row);
}

// ---------------------------------------------------------------------------------------------
// A subject the art does not know: a printed card for its initials with the one volt tick inked
// under them. The initials are set by the widget (they are text); this draws everything else.

class _Monogram extends EmblemArt {
  const _Monogram();

  @override
  bool get overlaysText => true;

  @override
  void object(Sketch s) {
    final p = s.p;
    final card = Path()..addRRect(RRect.fromLTRBR(19, 20, 81, 76, const Radius.circular(10)));
    s.slab(card, const Offset(0, 3), p.lit, p.deep.withValues(alpha: p.isNight ? 1 : 0.5));
    if (s.fine) {
      s.fill(Path.combine(PathOperation.intersect, card, Path()..addPolygon(const [Offset(100, 0), Offset(100, 100), Offset(0, 100)], true)),
          p.shade.withValues(alpha: 0.3));
    }
    s.sheen(card);
  }

  @override
  EmblemMark mark(double t) => const EmblemMark(Offset(50, 64), 3.6, style: MarkStyle.pill);
}
