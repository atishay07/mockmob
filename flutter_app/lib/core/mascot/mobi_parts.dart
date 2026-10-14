import 'dart:ui';

import 'mobi_geometry.dart';
import 'mobi_palette.dart';

/// The parts of Mobi that never change shape, recorded once per palette as pictures in design
/// units and replayed under a transform every frame: the folded body with its visor recess, the
/// visor gloss, a boot and the little answer sheet. Animation then costs only transforms.
class MobiParts {
  MobiParts._(MobiPalette p)
      : body = _record((c) => _body(c)),
        gloss = _record(_gloss),
        boot = _record((c) => _boot(c, p)),
        sheet = _record(_sheet);

  final Picture body;
  final Picture gloss;

  /// A right boot with its ankle at the origin and its toe toward +x. Mirror it for the left.
  final Picture boot;

  /// The answer sheet Mobi reads, centred on the origin.
  final Picture sheet;

  static final Map<bool, MobiParts> _cache = {};

  /// The parts for [palette], recorded on first use.
  static MobiParts of(MobiPalette palette) => _cache.putIfAbsent(palette.night, () => MobiParts._(palette));

  static Picture _record(void Function(Canvas) draw) {
    final recorder = PictureRecorder();
    draw(Canvas(recorder));
    return recorder.endRecording();
  }

  // ---- Body --------------------------------------------------------------------------------

  static void _body(Canvas c) {
    final outline = MobiGeo.body;
    c.drawPath(
      outline,
      Paint()
        ..shader = Gradient.linear(const Offset(28, 34), const Offset(118, 140), const [
          MobiPalette.limeLight,
          MobiPalette.lime,
          MobiPalette.limeMid,
          MobiPalette.limeLo,
        ], const [0, 0.38, 0.72, 1]),
    );

    c.save();
    c.clipPath(outline);

    // Lamp sheen on the upper-left plane.
    c.drawCircle(
      const Offset(46, 58),
      58,
      Paint()
        ..shader = Gradient.radial(const Offset(46, 58), 58, [
          MobiPalette.limeHi.withValues(alpha: 0.7),
          MobiPalette.limeHi.withValues(alpha: 0),
        ]),
    );

    // The narrow flap folded along the top-right edge, facing away from the light.
    final flap = Path()
      ..moveTo(73, 26)
      ..lineTo(132, 84)
      ..lineTo(121, 86)
      ..quadraticBezierTo(97, 63, 74, 33)
      ..close();
    c.drawPath(
      flap,
      Paint()
        ..shader = Gradient.linear(const Offset(96, 58), const Offset(106, 48), const [
          MobiPalette.limeMid,
          MobiPalette.limeLo,
        ]),
    );
    final flapCrease = Path()
      ..moveTo(74.5, 33)
      ..quadraticBezierTo(97, 63, 121, 86);
    c.drawPath(flapCrease, _stroke(MobiPalette.limeDeep.withValues(alpha: 0.22), 3.2));
    c.drawPath(flapCrease, _stroke(MobiPalette.limeHi.withValues(alpha: 0.85), 1.1));

    // The big lower fold: a flap of paper lying over the body from the right corner down to
    // the lower-left edge, its folded edge catching the lamp.
    const p1 = Offset(44, 113);
    final fold = Path()
      ..moveTo(134, 82)
      ..lineTo(121, 86)
      ..quadraticBezierTo(86, 101, p1.dx, p1.dy)
      ..lineTo(10, 132)
      ..lineTo(72, 176)
      ..lineTo(140, 112)
      ..close();
    final crease = Path()
      ..moveTo(121, 86)
      ..quadraticBezierTo(86, 101, p1.dx, p1.dy);
    // Shadow the fold casts on the plane above it.
    c.save();
    c.translate(0, -1.6);
    c.drawPath(crease, _stroke(MobiPalette.limeDeep.withValues(alpha: 0.2), 5));
    c.restore();
    c.drawPath(
      fold,
      Paint()
        ..shader = Gradient.linear(const Offset(84, 100), const Offset(96, 138), const [
          MobiPalette.limeLight,
          MobiPalette.lime,
          MobiPalette.limeLo,
        ], const [0, 0.35, 1]),
    );
    c.drawPath(crease, _stroke(MobiPalette.limeHi, 1.3));

    // Soft occlusion toward the bottom corner, where the legs go in.
    c.drawCircle(
      const Offset(72, 146),
      42,
      Paint()
        ..shader = Gradient.radial(const Offset(72, 146), 42, [
          MobiPalette.limeShade.withValues(alpha: 0.42),
          MobiPalette.limeShade.withValues(alpha: 0),
        ]),
    );

    // Bevel: a lit rim on the upper-left edges, a shaded rim on the lower-right.
    c.drawPath(
      outline,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.6
        ..shader = Gradient.linear(const Offset(30, 40), const Offset(116, 132), [
          MobiPalette.limeHi,
          MobiPalette.limeHi.withValues(alpha: 0.2),
          MobiPalette.limeDeep.withValues(alpha: 0.65),
        ], const [0, 0.5, 1]),
    );
    c.restore();

    _visorBase(c);
  }

  static void _visorBase(Canvas c) {
    final rect = MobiGeo.visorRect;
    // The recess the visor sits in: shaded lip on top, lit lip below.
    c.drawRRect(
      rect.inflate(2.2),
      Paint()
        ..shader = Gradient.linear(rect.outerRect.topCenter, rect.outerRect.bottomCenter, const [
          MobiPalette.limeShade,
          MobiPalette.limeLo,
          MobiPalette.limeHi,
        ], const [0, 0.55, 1]),
    );
    c.drawRRect(
      rect,
      Paint()
        ..shader = Gradient.linear(rect.outerRect.topCenter, rect.outerRect.bottomCenter, const [
          MobiPalette.visorTop,
          Color(0xFF151413),
          MobiPalette.visorBottom,
        ], const [0, 0.45, 1]),
    );
  }

  static void _gloss(Canvas c) {
    final rect = MobiGeo.visorRect;
    final r = rect.outerRect;
    // Inner edge light.
    c.drawRRect(
      rect.deflate(0.7),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.1
        ..shader = Gradient.linear(r.topCenter, r.bottomCenter, [
          const Color(0xFFFFFFFF).withValues(alpha: 0.2),
          const Color(0xFFFFFFFF).withValues(alpha: 0),
          const Color(0xFFFFFFFF).withValues(alpha: 0.06),
        ], const [0, 0.5, 1]),
    );
    // A curved glossy band across the top.
    final band = RRect.fromLTRBR(r.left + 6, r.top + 2.2, r.right - 6, r.top + 12, const Radius.circular(8));
    c.drawRRect(
      band,
      Paint()
        ..shader = Gradient.linear(Offset(0, band.top), Offset(0, band.bottom), [
          const Color(0xFFFFFFFF).withValues(alpha: 0.2),
          const Color(0xFFFFFFFF).withValues(alpha: 0),
        ]),
    );
    // Specular glint of the lamp.
    c.drawRRect(
      RRect.fromLTRBR(r.left + 9, r.top + 4, r.left + 19, r.top + 6.6, const Radius.circular(2)),
      Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.55),
    );
    c.drawCircle(Offset(r.left + 22.5, r.top + 5.3), 1.2, Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.4));
  }

  // ---- Boot --------------------------------------------------------------------------------

  static Path bootPath() => Path()
    ..moveTo(-9, 1)
    ..cubicTo(-14.5, 3, -15, 13.8, -9, 15)
    ..lineTo(13, 15)
    ..cubicTo(20, 15, 21, 8, 15, 6.2)
    ..cubicTo(11, 5, 9.2, 3, 8.6, 1)
    ..cubicTo(8, -2, -8, -2, -9, 1)
    ..close();

  static void _boot(Canvas c, MobiPalette p) {
    final path = bootPath();
    c.drawPath(
      path,
      Paint()
        ..shader = Gradient.radial(const Offset(-3, 2), 24, [
          p.limbHi,
          p.limb,
          p.limbLo,
        ], const [0, 0.45, 1]),
    );
    c.save();
    c.clipPath(path);
    // Rubber sole.
    c.drawRect(const Rect.fromLTRB(-16, 12.4, 22, 16), Paint()..color = p.limbLo);
    c.drawLine(const Offset(-14, 12.4), const Offset(20, 12.4), _stroke(p.limbHi.withValues(alpha: 0.8), 0.8));
    // Toe cap highlight.
    c.drawOval(
      Rect.fromCenter(center: const Offset(10.5, 8.2), width: 10, height: 4.4),
      Paint()
        ..shader = Gradient.radial(const Offset(10.5, 8.2), 5, [
          const Color(0xFFFFFFFF).withValues(alpha: 0.16),
          const Color(0xFFFFFFFF).withValues(alpha: 0),
        ]),
    );
    c.restore();
    // Lamp rim on the upper-left of the boot.
    c.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.9
        ..shader = Gradient.linear(const Offset(-12, 0), const Offset(4, 10), [
          p.rim.withValues(alpha: p.rimAlpha),
          p.rim.withValues(alpha: 0),
        ]),
    );
    // Cuff opening where the leg goes in.
    c.drawOval(Rect.fromCenter(center: const Offset(-0.2, 0.6), width: 15.4, height: 4.4), Paint()..color = const Color(0xFF0C0B0A));
    c.drawArc(
      Rect.fromCenter(center: const Offset(-0.2, 0.6), width: 15.4, height: 4.4),
      0.2,
      2.7,
      false,
      _stroke(p.limbHi, 0.9),
    );
  }

  // ---- Answer sheet prop -------------------------------------------------------------------

  static void _sheet(Canvas c) {
    const rect = Rect.fromLTRB(-18, -13, 18, 13);
    c.drawRRect(RRect.fromRectAndRadius(rect.shift(const Offset(0.8, 1.4)), const Radius.circular(3)),
        Paint()..color = const Color(0x40000000));
    c.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(3)),
      Paint()
        ..shader = Gradient.linear(rect.topLeft, rect.bottomRight, const [Color(0xFFFFFBF1), Color(0xFFE9E1CF)]),
    );
    final ring = _stroke(const Color(0xFF3A362F).withValues(alpha: 0.55), 0.8);
    const filled = {1, 6, 8};
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 4; col++) {
        final o = Offset(-10.5 + col * 7, -6.5 + row * 6.5);
        final i = row * 4 + col;
        if (i == 6) {
          c.drawCircle(o, 2.3, Paint()..color = MobiPalette.lime);
          c.drawCircle(o, 2.3, _stroke(MobiPalette.limeDeep, 0.6));
        } else if (filled.contains(i)) {
          c.drawCircle(o, 2.3, Paint()..color = const Color(0xFF2B2824));
        } else {
          c.drawCircle(o, 2.1, ring);
        }
      }
    }
  }

  static Paint _stroke(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..color = color;
}
