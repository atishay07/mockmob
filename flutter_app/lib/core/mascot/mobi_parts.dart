import 'dart:math' as math;
import 'dart:ui';

import 'mobi_geometry.dart';
import 'mobi_palette.dart';

/// The parts of Mobi that never change shape, recorded once per palette as pictures in design
/// units and replayed under a transform every frame: the folded body with its visor recess, the
/// visor gloss, a boot and the little answer sheet. Animation then costs only transforms.
class MobiParts {
  MobiParts._(MobiPalette p)
      : body = _record((c) => _body(c, p)),
        gloss = _record(_gloss),
        boot = _record((c) => _boot(c, p)),
        bootLip = _record((c) => _bootLip(c, p, lite: false)),
        bootLipLite = _record((c) => _bootLip(c, p, lite: true)),
        sheet = _record(_sheet);

  final Picture body;
  final Picture gloss;

  /// A right boot with its ankle at the origin and its toe toward +x. Mirror it for the left.
  final Picture boot;

  /// The front lip of the boot's cuff, drawn over the leg where it goes in (and a soft shadow on
  /// the leg just inside it). [bootLipLite] is the lip alone, for small sizes.
  final Picture bootLip;
  final Picture bootLipLite;

  /// Where the cuff opening sits in the boot's own frame (its ankle at the origin).
  static const Rect cuff = Rect.fromLTRB(-7.9, -1.6, 7.5, 2.8);

  /// The part of a leg that shows, in the boot's frame: everything above the middle of the cuff
  /// opening, and the opening itself.
  static final Path legWindow = Path.combine(
    PathOperation.union,
    Path()..addRect(Rect.fromLTRB(-400, -400, 400, cuff.center.dy)),
    Path()..addOval(cuff),
  );

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

  static void _body(Canvas c, MobiPalette p) {
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

    // Form (rig v2): the lamp sits up and to the left, as it does over the subject objects, so
    // the planes turn away from it toward the lower right into a soft core shadow...
    c.drawCircle(
      const Offset(134, 128),
      82,
      Paint()
        ..shader = Gradient.radial(const Offset(134, 128), 82, [
          MobiPalette.limeShade.withValues(alpha: 0.34),
          MobiPalette.limeShade.withValues(alpha: 0.12),
          MobiPalette.limeShade.withValues(alpha: 0),
        ], const [0, 0.55, 1]),
    );
    // ...and a broad, soft specular bloom sits on the upper-left plane where the lamp hits it.
    c.save();
    c.translate(47, 57);
    c.rotate(-0.72);
    c.scale(1, 0.58);
    c.drawCircle(
      Offset.zero,
      22,
      Paint()
        ..shader = Gradient.radial(Offset.zero, 22, [
          const Color(0xFFFFFFFF).withValues(alpha: p.night ? 0.42 : 0.34),
          const Color(0xFFFFFFFF).withValues(alpha: p.night ? 0.12 : 0.1),
          const Color(0xFFFFFFFF).withValues(alpha: 0),
        ], const [0, 0.45, 1]),
    );
    c.restore();
    // The warm lamp catching the top-left edges (at Night the lamp is amber; in Daylight the
    // room light is white and the rim is quieter).
    c.drawPath(
      outline,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..shader = Gradient.linear(const Offset(22, 50), const Offset(70, 98), [
          (p.night ? p.rim : const Color(0xFFFFFFFF)).withValues(alpha: p.night ? 0.42 : 0.4),
          (p.night ? p.rim : const Color(0xFFFFFFFF)).withValues(alpha: 0),
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
    // Cuff opening where the leg goes in: a dark well with the cuff's back rim catching light.
    c.drawOval(cuff, Paint()..color = const Color(0xFF0C0B0A));
    c.drawArc(cuff, math.pi + 0.15, math.pi - 0.3, false, _stroke(p.limbHi.withValues(alpha: 0.55), 0.8));
  }

  static void _bootLip(Canvas c, MobiPalette p, {required bool lite}) {
    if (!lite) {
      // The leg in shadow just inside the cuff.
      c.save();
      c.clipPath(Path()..addOval(cuff));
      c.drawArc(cuff.shift(const Offset(0, 0.9)), 0.15, math.pi - 0.3, false, _stroke(const Color(0xFF000000).withValues(alpha: 0.55), 2.2));
      c.restore();
    }
    // The cuff's front lip, a rolled edge over the leg.
    c.drawArc(cuff, 0.12, math.pi - 0.24, false, _stroke(p.limb, 2.0));
    c.drawArc(cuff, 0.3, math.pi - 0.6, false, _stroke(Color.lerp(p.limbHi, p.rim, p.night ? 0.25 : 0.05)!, 0.9));
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
