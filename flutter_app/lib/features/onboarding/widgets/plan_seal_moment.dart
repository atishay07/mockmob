import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/art/scene_art.dart';

/// The state of the plan's seal moment, written by the plan step and read by the full-screen
/// backdrop the onboarding flow lays behind the deck (the step itself sits inside the gutter, so
/// the room has to live a layer up).
///
/// - [reveal]: 0 to 1, the room coming up as the hold starts (the card gives way to the sheet).
/// - [press]: 0 to 1, the seal coming down onto the sheet while the student holds.
/// - [land]: 0 to 1, the seal striking (a press past the sheet and back).
/// - [burst]: 0 to 1, the foil flecks thrown from the rim once (Full celebrations only).
class PlanSealMoment extends ChangeNotifier {
  double _reveal = 0, _press = 0, _land = 0, _burst = 0;

  double get reveal => _reveal;
  double get press => _press;
  double get land => _land;
  double get burst => _burst;

  void set({double? reveal, double? press, double? land, double? burst}) {
    final r = reveal ?? _reveal, p = press ?? _press, l = land ?? _land, b = burst ?? _burst;
    if (r == _reveal && p == _press && l == _land && b == _burst) return;
    _reveal = r;
    _press = p;
    _land = l;
    _burst = b;
    notifyListeners();
  }

  void reset() => set(reveal: 0, press: 0, land: 0, burst: 0);

  /// Back to dark without telling listeners: for a step being torn down, when the tree is locked.
  /// The room is rebuilt from these values the next time it is shown.
  void clear() => _reveal = _press = _land = _burst = 0;
}

/// Where the seal sits on a screen of [screen]: the painted sheet (`scene-plan-seal-night`,
/// 1080 by 2340) covers the screen aligned to the top, and its blind impression is at (540,
/// 1170) with a 115 px disc and 146 px teeth. The code seal is drawn with those radii, scaled
/// with the painting, so it lands exactly in the impression.
@immutable
class SealGeometry {
  const SealGeometry._(this.image, this.centre, this.scale);

  factory SealGeometry.of(Size screen) {
    final art = SceneArt.planSeal;
    final w = math.max(screen.width, screen.height / art.aspect);
    final h = w * art.aspect;
    final left = (screen.width - w) / 2;
    return SealGeometry._(Rect.fromLTWH(left, 0, w, h), Offset(left + 0.5 * w, 0.5 * h), w / art.pxWidth);
  }

  final Rect image;
  final Offset centre;

  /// Screen dp per painting px.
  final double scale;

  double get disc => 115 * scale;
  double get teeth => 146 * scale;
}

/// The full-screen room of the seal moment, under the plan step. Night: the painted answer
/// sheet with its empty impression, and the volt seal drawn live onto it. Day: the same seal
/// pressing into a blind impression drawn on the paper ground (no painted room in Day, so no
/// dark slab on cream). Draws nothing until the moment starts.
class PlanSealBackdrop extends StatelessWidget {
  const PlanSealBackdrop({super.key, required this.moment});

  final PlanSealMoment moment;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return LayoutBuilder(
      builder: (context, box) {
        final geo = SealGeometry.of(box.biggest);
        final room = Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned.fill(child: ColoredBox(color: colors.ground)),
            if (colors.isNight)
              Positioned.fromRect(rect: geo.image, child: SceneImage(SceneArt.planSeal, width: geo.image.width, height: geo.image.height))
            else
              Positioned.fill(
                child: CustomPaint(painter: _ImpressionPainter(geo: geo, ground: colors.ground, paper: colors.raised, line: colors.lineStrong)),
              ),
          ],
        );
        return IgnorePointer(
          child: ExcludeSemantics(
            child: ListenableBuilder(
              listenable: moment,
              child: RepaintBoundary(child: room),
              builder: (context, child) {
                final r = moment.reveal;
                if (r <= 0) return const SizedBox.shrink();
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    Opacity(opacity: r.clamp(0.0, 1.0), child: child),
                    RepaintBoundary(
                      child: CustomPaint(
                        painter: SealPainter(
                          geo: geo,
                          moment: moment,
                          volt: colors.volt,
                          edge: colors.voltEdge,
                          ink: colors.voltInk,
                          night: colors.isNight,
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }
}

/// Day's sheet, drawn in code where Night has the painting: the same answer sheet seen square-on
/// (perforated left edge, four groups of bubble columns) on the paper ground, with a blind
/// impression in its middle (a toothed ring and a disc pressed in, lit from the top left) and two
/// faint rings around it. It sits exactly where the Night sheet does, so the seal lands the same.
class _ImpressionPainter extends CustomPainter {
  const _ImpressionPainter({required this.geo, required this.ground, required this.paper, required this.line});

  final SealGeometry geo;
  final Color ground;
  final Color paper;
  final Color line;

  /// The Night painting's sheet, as shares of the painting.
  static const Rect sheetShare = Rect.fromLTRB(0.045, 0.215, 0.95, 0.765);

  void _sheet(Canvas canvas) {
    final img = geo.image;
    final r = Rect.fromLTRB(
      img.left + sheetShare.left * img.width,
      img.top + sheetShare.top * img.height,
      img.left + sheetShare.right * img.width,
      img.top + sheetShare.bottom * img.height,
    );
    // A soft contact shadow, then the sheet.
    canvas.drawRect(r.shift(const Offset(0, 6)).inflate(2), Paint()..color = const Color(0x14000000));
    canvas.drawRect(r.shift(const Offset(0, 2)), Paint()..color = const Color(0x12000000));
    canvas.drawRect(r, Paint()..color = paper);
    final ink = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = line.withValues(alpha: 0.55);
    // Perforations down the left edge.
    final holes = Paint()..color = Color.lerp(ground, line, 0.5)!;
    final step = r.height / 34;
    for (var y = r.top + step; y < r.bottom - step / 2; y += step) {
      canvas.drawCircle(Offset(r.left + r.width * 0.035, y), r.width * 0.008, holes);
    }
    // Four groups of four bubble columns.
    final left = r.left + r.width * 0.11;
    final groupW = (r.right - r.width * 0.04 - left) / 4;
    const rows = 26;
    final rowStep = (r.height * 0.86) / rows;
    final bubbleR = math.min(groupW / 11, rowStep * 0.32);
    for (var g = 0; g < 4; g++) {
      final gx = left + g * groupW;
      if (g > 0) {
        canvas.drawLine(Offset(gx - groupW * 0.06, r.top + r.height * 0.06), Offset(gx - groupW * 0.06, r.bottom - r.height * 0.06), ink);
      }
      for (var col = 0; col < 4; col++) {
        final x = gx + groupW * (0.14 + col * 0.2);
        for (var row = 0; row < rows; row++) {
          final y = r.top + r.height * 0.07 + row * rowStep;
          canvas.drawCircle(Offset(x, y), bubbleR, ink);
        }
      }
    }
    // The impression sits on clean paper: the bubbles stop short of it.
    canvas.drawCircle(geo.centre, geo.teeth * 1.22, Paint()..color = paper);
  }

  @override
  void paint(Canvas canvas, Size size) {
    _sheet(canvas);
    final c = geo.centre;
    final shade = Color.lerp(paper, const Color(0xFF8A7E66), 0.35)!;
    final light = Color.lerp(paper, const Color(0xFFFFFFFF), 0.7)!;
    for (final k in [1.55, 2.05]) {
      canvas.drawCircle(
        c,
        geo.teeth * k,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = shade.withValues(alpha: 0.35 / k),
      );
    }
    final teeth = SealPainter.teethPath(c, geo.teeth, geo.teeth * 0.9);
    canvas.drawPath(teeth.shift(const Offset(1.2, 1.6)), Paint()..color = shade.withValues(alpha: 0.55));
    canvas.drawPath(teeth.shift(const Offset(-1, -1.2)), Paint()..color = light);
    canvas.drawPath(teeth, Paint()..color = Color.lerp(paper, shade, 0.18)!);
    canvas.drawCircle(c, geo.disc, Paint()..color = Color.lerp(paper, shade, 0.08)!);
    canvas.drawCircle(
      c,
      geo.disc,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = shade.withValues(alpha: 0.5),
    );
  }

  @override
  bool shouldRepaint(_ImpressionPainter old) =>
      old.geo.centre != geo.centre || old.geo.image != geo.image || old.ground != ground || old.paper != paper || old.line != line;
}

/// The volt seal: 40 teeth, a pressed rim, a disc and an embossed check. While the student
/// holds it hangs over the impression and comes down with the hold (larger, with a loose
/// shadow, then tight); on the strike it presses 3% past the sheet and settles, and Full
/// celebrations throw 18 foil flecks from its rim once (one painter, MOTION.md 1.2 T3).
class SealPainter extends CustomPainter {
  SealPainter({required this.geo, required this.moment, required this.volt, required this.edge, required this.ink, required this.night})
      : super(repaint: moment);

  final SealGeometry geo;
  final PlanSealMoment moment;
  final Color volt;
  final Color edge;
  final Color ink;
  final bool night;

  static const int teethCount = 40;
  static const int flecks = 18;

  /// How big the seal is at [press] (0 to 1) and [land] (0 to 1).
  static double scaleAt(double press, double land) {
    if (land > 0) {
      // 1.06 down to 0.97 in the first 30% of the strike, then back to 1.
      if (land < 0.3) return 1.06 - 0.09 * Motion.inOut.transform(land / 0.3);
      return 0.97 + 0.03 * Motion.out.transform((land - 0.3) / 0.7);
    }
    return 1.32 - 0.26 * Motion.out.transform(press.clamp(0.0, 1.0));
  }

  /// A toothed rosette between [inner] and [outer].
  static Path teethPath(Offset c, double outer, double inner) {
    final path = Path();
    const steps = teethCount * 8;
    for (var i = 0; i <= steps; i++) {
      final a = i / steps * 2 * math.pi;
      final wave = math.pow((math.cos(a * teethCount) + 1) / 2, 0.7).toDouble();
      final rr = inner + (outer - inner) * wave;
      final p = c + Offset(math.cos(a) * rr, math.sin(a) * rr);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    return path..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final press = moment.press, land = moment.land;
    if (press <= 0 && land <= 0) return;
    final c = geo.centre;
    final appear = land > 0 ? 1.0 : (press * 5).clamp(0.0, 1.0);
    final s = scaleAt(press, land);
    final lift = land > 0 ? 0.0 : 1 - Motion.out.transform(press.clamp(0.0, 1.0));

    // The shadow: loose and far while the seal hangs, tight under it once it strikes.
    final sr = geo.teeth * (1.02 + 0.18 * lift);
    final so = c + Offset(0, geo.teeth * (0.04 + 0.16 * lift));
    canvas.drawCircle(
      so,
      sr,
      Paint()
        ..shader = RadialGradient(
          colors: [Color.fromRGBO(0, 0, 0, (night ? 0.55 : 0.28) * (1 - 0.5 * lift) * appear), const Color(0x00000000)],
          stops: const [0.72, 1],
        ).createShader(Rect.fromCircle(center: so, radius: sr)),
    );

    _flecks(canvas, c);

    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.scale(s);
    canvas.translate(-c.dx, -c.dy);
    final base = geo.teeth;
    final pale = Color.lerp(volt, const Color(0xFFFFFDE8), 0.5)!;
    final teeth = teethPath(c, base, base * 0.9);
    canvas.drawPath(
      teeth,
      Paint()
        ..shader = SweepGradient(
          transform: const GradientRotation(-math.pi / 3),
          colors: [volt, pale, volt, Color.lerp(volt, edge, 0.35)!, volt, pale, volt],
        ).createShader(Rect.fromCircle(center: c, radius: base))
        ..color = Color.fromRGBO(0, 0, 0, appear),
    );
    canvas.drawPath(
      teeth,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(1, base * 0.012)
        ..color = edge.withValues(alpha: 0.8 * appear),
    );
    // The pressed rim and the disc, lit from the top left.
    final disc = geo.disc;
    canvas.drawCircle(c, disc + base * 0.035, Paint()..color = edge.withValues(alpha: 0.55 * appear));
    canvas.drawCircle(
      c,
      disc,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [pale.withValues(alpha: appear), volt.withValues(alpha: appear), Color.lerp(volt, edge, 0.5)!.withValues(alpha: appear)],
        ).createShader(Rect.fromCircle(center: c, radius: disc)),
    );
    canvas.drawCircle(
      c,
      disc * 0.86,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = math.max(1, base * 0.012)
        ..color = ink.withValues(alpha: 0.2 * appear),
    );
    // The embossed check: a pale edge up-left, then the ink.
    final check = Path()
      ..moveTo(c.dx - disc * 0.40, c.dy + disc * 0.02)
      ..lineTo(c.dx - disc * 0.10, c.dy + disc * 0.32)
      ..lineTo(c.dx + disc * 0.44, c.dy - disc * 0.28);
    final w = disc * 0.16;
    canvas.drawPath(
      check.shift(Offset(-w * 0.12, -w * 0.14)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = const Color(0xFFFFFFFF).withValues(alpha: 0.45 * appear),
    );
    canvas.drawPath(
      check,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = ink.withValues(alpha: 0.86 * appear),
    );
    canvas.restore();
  }

  /// 18 foil flecks thrown out from the rim and falling back, fading by the end.
  void _flecks(Canvas canvas, Offset c) {
    final b = moment.burst;
    if (b <= 0 || b >= 1) return;
    final t = Motion.out.transform(b);
    final fade = 1 - Curves.easeIn.transform(b);
    final paint = Paint();
    final rim = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = edge.withValues(alpha: fade);
    for (var i = 0; i < flecks; i++) {
      // Spread evenly with a fixed jitter, so every run (and every golden) is the same.
      final a = (i / flecks) * 2 * math.pi + (i.isEven ? 0.09 : -0.07);
      final reach = geo.teeth * (1.15 + 0.55 * t * (0.75 + 0.25 * ((i * 7) % 5) / 4));
      final p = c + Offset(math.cos(a) * reach, math.sin(a) * reach + geo.teeth * 0.25 * b * b);
      final len = geo.teeth * 0.07 * (1 - 0.4 * b);
      canvas.save();
      canvas.translate(p.dx, p.dy);
      canvas.rotate(a + b * 3);
      final rect = Rect.fromCenter(center: Offset.zero, width: len, height: len * 0.45);
      paint.color = (i % 3 == 0 ? const Color(0xFFFFFDE8) : volt).withValues(alpha: fade);
      canvas.drawRect(rect, paint);
      // On paper the flecks carry a 1 dp olive rim, so they read (MOTION.md 1.4).
      if (!night) canvas.drawRect(rect, rim);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(SealPainter old) =>
      old.geo.centre != geo.centre || old.volt != volt || old.night != night || old.moment != moment;
}
