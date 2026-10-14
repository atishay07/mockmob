import 'dart:math' as math;
import 'dart:ui';

/// Mobi's skeleton in design units. The character stands in a [width] by [height] box with its
/// soles on [ground]; everything else is placed relative to these points.
abstract final class MobiGeo {
  static const double width = 140;
  static const double height = 168;
  static const double ground = 162;

  // ---- Body: a square of paper folded into a slightly tilted diamond ----------------------
  static const Offset top = Offset(75, 30);
  static const Offset right = Offset(126, 84);
  static const Offset bottom = Offset(71, 142);
  static const Offset left = Offset(16, 79);

  /// The body pivots and squashes about this point (between the hips).
  static const Offset pivot = Offset(71, 136);

  /// The body is drawn this far below its design coordinates (so the boots tuck under it).
  static const double bodyDrop = 4;

  /// Where the visor sits, and its size.
  static const Offset visor = Offset(70, 82);
  static const Size visorSize = Size(66, 34);
  static const double visorRadius = 16;

  /// Eye centres at rest, relative to [visor], and their size.
  static const double eyeSpread = 13.5;
  static const double eyeDrop = 1.5;
  static const Size eyeSize = Size(7.6, 15);

  /// How far the eyes travel when looking (x, y).
  static const Offset lookTravel = Offset(9, 4.5);

  // ---- Limbs -------------------------------------------------------------------------------
  static const Offset shoulderL = Offset(35, 104);
  static const Offset shoulderR = Offset(108, 103);
  static const double armLength = 23;
  static const double armWidth = 9.6;
  static const double handScale = 1.22;

  static const Offset hipL = Offset(62, 131);
  static const Offset hipR = Offset(81, 131);
  static const double legWidth = 9.6;

  /// Ankle points of the boots at rest (top of the cuff).
  static const Offset ankleL = Offset(47, 142.5);
  static const Offset ankleR = Offset(96, 142.5);

  /// Boots are drawn at this scale of their picture.
  static const double bootScale = 1.3;

  // ---- Antenna -----------------------------------------------------------------------------
  static const Offset antennaBase = Offset(90, 50);
  static const Offset antennaTip = Offset(104, 9);
  static const double antennaBall = 5.8;

  /// A rounded polygon whose sides bulge outward by [bulge] (soft, pillowy paper).
  static Path pillow(List<Offset> pts, List<double> radii, {double bulge = 0}) {
    final n = pts.length;
    final path = Path();
    Offset unit(Offset v) => v / v.distance;
    final starts = <Offset>[];
    final ends = <Offset>[];
    for (var i = 0; i < n; i++) {
      final p = pts[i];
      final prev = pts[(i - 1 + n) % n];
      final next = pts[(i + 1) % n];
      starts.add(p + unit(prev - p) * radii[i]);
      ends.add(p + unit(next - p) * radii[i]);
    }
    path.moveTo(ends[0].dx, ends[0].dy);
    for (var k = 1; k <= n; k++) {
      final i = k % n;
      final a = ends[k - 1];
      final b = starts[i];
      if (bulge == 0) {
        path.lineTo(b.dx, b.dy);
      } else {
        final mid = (a + b) / 2;
        final d = b - a;
        final normal = Offset(d.dy, -d.dx) / d.distance;
        final c = mid + normal * bulge;
        path.quadraticBezierTo(c.dx, c.dy, b.dx, b.dy);
      }
      path.quadraticBezierTo(pts[i].dx, pts[i].dy, ends[i].dx, ends[i].dy);
    }
    path.close();
    return path;
  }

  /// The body outline (clockwise from the top).
  static final Path body = pillow(const [top, right, bottom, left], const [9, 16, 13, 16], bulge: 6);

  /// The visor rectangle.
  static final RRect visorRect = RRect.fromRectAndRadius(
    Rect.fromCenter(center: visor, width: visorSize.width, height: visorSize.height),
    const Radius.circular(visorRadius),
  );

  /// A point along a segment.
  static Offset along(Offset a, Offset b, double t) => Offset.lerp(a, b, t)!;

  /// The direction of an arm at [angle] (from straight down, outward positive) on [side] (-1
  /// left, 1 right).
  static Offset armDir(double angle, double side) => Offset(side * math.sin(angle), math.cos(angle));
}
