// The seven stages of the Mob explainer (MOB-EXPLAINER.md section 3, with K9's slide 3 and slide 4
// highlights). Each stage is drawn in a 360 x 404 box as a pure function of its clock; the times are
// the spec's, in ms from the moment the slide lands. Layers are listed back to front.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../core/motion/motion_tokens.g.dart';
import '../../../../../dev/mob_explainer_sample.dart';
import '../../../../../core/theme/theme.dart';
import '../../../widgets/mob_ring.dart' show MobColours;
import '../../copy_v3.dart';
import '../../data/mob_v3_models.dart';
import '../fold_puppet.dart';
import '../mob_fx.dart';
import '../moment_kit.dart' show MomentCurves, RollNumber, lerpD, seg;
import '../moment_stitched.dart' show PennantPainter;
import '../moment_reveal.dart' show RevealGeo;
import '../parcel.dart' show ParcelStills;
import '../pennant.dart';
import '../podium_stage.dart' show PlinthPainter;
import 'ex_kit.dart';

/// What a stage needs besides its clock.
class ExFx {
  const ExFx({required this.night, required this.lite, required this.billingOn, required this.now});

  factory ExFx.of(BuildContext context, {required bool billingOn, DateTime? now}) => ExFx(night: context.mmColors.isNight, lite: MobFx.lite(context), billingOn: billingOn, now: now ?? DateTime.now());

  final bool night;
  final bool lite;
  final bool billingOn;
  final DateTime now;

  /// Paper bits for one burst: halved on Lite, never over 26 (brand kit 6 caps 60 on screen).
  int bits(int n) => (lite ? (n / 2).ceil() : n).clamp(0, 26);
}

abstract final class ExSlides {
  /// Each slide's timeline, in ms (the last beat plus its settle).
  static const List<double> lengthMs = [1650, 4400, 3000, 4900, 4400, 4300, 2950];

  static Widget stage(BuildContext context, int i, ExTime t, ExFx fx) => switch (i) {
    0 => _SlideDen(t: t, fx: fx),
    1 => _SlideFold(t: t, fx: fx),
    2 => _SlideGames(t: t, fx: fx),
    3 => _SlidePodium(t: t, fx: fx),
    4 => _SlideFix(t: t, fx: fx),
    5 => _SlideStitch(t: t, fx: fx),
    _ => _SlideShelf(t: t, fx: fx),
  };
}

// ---------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------

const double _deg = math.pi / 180;

/// Piecewise-linear keyframes: [values] at [offsets] (0..1), read at [k].
double _kf(double k, List<double> offsets, List<double> values) {
  if (k <= offsets.first) return values.first;
  for (var i = 1; i < offsets.length; i++) {
    if (k <= offsets[i]) return lerpD(values[i - 1], values[i], (k - offsets[i - 1]) / (offsets[i] - offsets[i - 1]));
  }
  return values.last;
}

/// The pennant's swing in (from −9 degrees, then 2.4, −1.2, 0.4, 0; out 900): (opacity, dy, angle).
(double, double, double) _swingIn(ExTime t, double at) {
  if (t.reduced) return (t.fade(at), 0, 0);
  if (t.ms <= at) return (0, -16, -9 * _deg);
  final k = seg(t.ms, at, 900, MotionCurves.out);
  const off = [0.0, 0.32, 0.56, 0.8, 1.0];
  final rot = _kf(k, off, const [-9, 2.4, -1.2, 0.4, 0]) * _deg;
  return ((k / 0.32).clamp(0.0, 1.0), k < 0.32 ? -16 * (1 - k / 0.32) : 0, rot);
}

Widget _o(double o, Widget child) => Opacity(opacity: o.clamp(0.0, 1.0), child: child);

Widget _pos(double left, double top, double w, double h, Widget child) => Positioned(left: left, top: top, width: w, height: h, child: child);

/// Text in a fixed role for the stage (no text scaling inside the art).
TextStyle _hanken(BuildContext context, double size, {FontWeight w = FontWeight.w400, Color? colour, double? height}) =>
    context.mmType.body.copyWith(fontSize: size, height: (height ?? size * 1.38) / size, fontWeight: w, color: colour);

TextStyle _figure(BuildContext context, double size, Color colour) => context.mmType.figureCompact.copyWith(fontSize: size, height: 1, color: colour);

/// A burst and glints layer over the whole stage.
Widget _sparks(ExTime t, {List<ExBurst> bursts = const [], List<ExGlints> glints = const []}) => t.reduced
    ? const SizedBox.shrink()
    : Positioned.fill(
        child: IgnorePointer(
          child: CustomPaint(
            painter: ExSparkPainter(ms: t.ms, bursts: bursts, glints: glints),
          ),
        ),
      );

/// A brightness filter (the room comes up from 0.3: light first).
Widget _bright(double b, Widget child) {
  if (b >= 0.999) return child;
  return ColorFiltered(colorFilter: ColorFilter.matrix(<double>[b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0]), child: child);
}

// ---------------------------------------------------------------------------------------------------
// 1. This is your Mob: the lamp comes on, the pennant swings in, friends hop into their seats.
// ---------------------------------------------------------------------------------------------------

class _SlideDen extends StatelessWidget {
  const _SlideDen({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final p = ExPaper.of(context);
    final scene = fx.night ? 'assets/art/scene-empty-nothing-night.webp' : 'assets/art/scene-empty-nothing-day.webp';
    final room = t.reduced ? 1.0 : lerpD(0.3, 1, seg(t.ms, 0, 420, MotionCurves.glide));
    final roomO = t.reduced ? t.fade(0) : 1.0;
    final poolK = t.reduced ? 1.0 : seg(t.ms, 80, 420, MotionCurves.glide);
    final poolO = t.reduced ? t.fade(80) : poolK;
    final (po, pdy, prot) = _swingIn(t, 160);
    const seats = [
      (FoldKey.kandil, 'Zoya', 52.0, 334.0, 64.0),
      (FoldKey.dogear, 'Riya', 118.0, 356.0, 72.0),
      (FoldKey.dart, MobExplainerCopy.you, 186.0, 376.0, 82.0),
      (FoldKey.hexa, 'Kabir', 256.0, 356.0, 72.0),
    ];
    final landed = t.ms >= ExSlides.lengthMs[0] - 1;
    final (so, ss) = t.pop(700);
    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: _o(
            roomO,
            _bright(
              room,
              Image.asset(
                scene,
                fit: BoxFit.cover,
                alignment: const Alignment(0.12, 0.2),
                filterQuality: FilterQuality.medium,
                errorBuilder: (_, _, _) => ColoredBox(color: c.sunken),
              ),
            ),
          ),
        ),
        _pos(
          40,
          296,
          290,
          96,
          _o(
            poolO,
            Transform.scale(
              scale: lerpD(0.55, 1, poolK),
              child: CustomPaint(painter: ExPoolPainter(lampA: p.lampA)),
            ),
          ),
        ),
        // The art meets the ground (a functional scrim).
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 60,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.ground.withValues(alpha: 0), c.ground]),
            ),
          ),
        ),
        Positioned(
          left: 271,
          top: 8,
          child: _o(
            po,
            Transform.translate(
              offset: Offset(0, pdy),
              child: Transform.rotate(angle: prot, alignment: Alignment.topCenter, child: const Pennant(weeks: 3, width: 58)),
            ),
          ),
        ),
        // The open seat.
        _pos(
          296,
          278,
          46,
          56,
          _o(
            so,
            Transform.scale(
              scale: ss,
              child: _OpenSeat(
                colour: c.ink3,
                fill: c.ground.withValues(alpha: fx.night ? 0.25 : 0.35),
                icon: c.ink2,
              ),
            ),
          ),
        ),
        for (var i = 0; i < seats.length; i++)
          ...exFold(
            fold: seats[i].$1,
            x: seats[i].$3,
            base: seats[i].$4,
            size: seats[i].$5,
            pose: seats[i].$1 == FoldKey.dart && t.ms >= t.at(1250) ? FoldPose.wave : FoldPose.idle,
            move: t.hopIn(300 + i * 90.0),
            breathe: landed && !t.reduced,
            phase: i,
            night: fx.night,
          ),
        for (var i = 0; i < seats.length; i++)
          exTag(
            context,
            seats[i].$2,
            x: seats[i].$3,
            top: seats[i].$4 + 3,
            kind: seats[i].$1 == FoldKey.dart ? ExTagKind.you : ExTagKind.plain,
            reveal: t.engrave(720 + i * 90.0),
            opacity: t.engraveO(720 + i * 90.0),
          ),
        exTag(context, MobExplainerCopy.openSeat, x: 319, top: 337, kind: ExTagKind.dim, reveal: t.engrave(1060), opacity: t.engraveO(1060)),
      ],
    );
  }
}

class _OpenSeat extends StatelessWidget {
  const _OpenSeat({required this.colour, required this.fill, required this.icon});
  final Color colour;
  final Color fill;
  final Color icon;

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _DashedRRect(colour: colour, fill: fill, radius: 14),
    child: Center(child: Icon(LucideIcons.plus, size: 18, color: icon)),
  );
}

class _DashedRRect extends CustomPainter {
  _DashedRRect({required this.colour, this.fill, this.radius = 10, this.width = 1.5});
  final Color colour;
  final Color? fill;
  final double radius;
  final double width;

  @override
  void paint(Canvas canvas, Size size) {
    final rr = RRect.fromRectAndRadius((Offset.zero & size).deflate(width / 2), Radius.circular(radius));
    if (fill != null) canvas.drawRRect(rr, Paint()..color = fill!);
    final p = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    for (final m in (Path()..addRRect(rr)).computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 9) {
        canvas.drawPath(m.extractPath(d, math.min(d + 5, m.length)), p);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRRect old) => old.colour != colour || old.fill != fill;
}

// ---------------------------------------------------------------------------------------------------
// 2. Everyone sits as a Fold: an answer sheet with a mistake; the fix is ticked; the corners fold in to
// a diamond, the diamond takes Mobi's lime and opens its eyes, and Mobi steps out. The starters hop in.
// ---------------------------------------------------------------------------------------------------

class _SlideFold extends StatelessWidget {
  const _SlideFold({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  static const double sz = 168;
  static const double cx = 180;
  static const double cy = 262;
  static const double mobiH = 196;
  static const double mobiW = mobiH * 375 / 512;
  static double get mobiTop => cy - 0.43 * mobiH;
  static double get mobiBase => mobiTop + 0.97 * mobiH;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final p = ExPaper.of(context);
    final ms = t.ms;
    final r = t.reduced;

    // The lamp: the cone opens 0.7 to 1 wide, the shade drops in; it flares 1.5x as Mobi arrives.
    final cone = r ? t.fade(0) : seg(ms, 0, 420, MotionCurves.glide);
    final coneScale = r ? 1.0 : lerpD(0.7, 1, cone);
    final shade = r ? t.fade(0) : seg(ms, 0, 300, MotionCurves.out);
    final flare = r ? 1.0 : (ms < 2600 ? 1.0 : _kf(((ms - 2600) / 700).clamp(0.0, 1.0), const [0, 0.3, 1], const [1, 1.5, 1]));

    // The sheet.
    final (wo, wdy) = t.rise(120, dy: 22, d: 420);
    final tilt = r ? 0.0 : lerpD(-4, -1.5, seg(ms, 120, 600, MotionCurves.out)) * _deg;
    final shrink = r ? 0.0 : seg(ms, 2220, 300, MotionCurves.out);
    final sheetRot = lerpD(tilt, 0, shrink);
    final sheetScale = lerpD(1, 0.64, shrink);
    final wrapOut = r ? 1 - seg(ms, t.at(1500), 120) : 1 - seg(ms, 2640, 120);
    final flatO = r ? 1.0 : 1 - seg(ms, 1560, 120);
    // Before the fold the sheet is one piece (no seams on the diagonals); from 1560 it is the diamond and four flaps.
    final folding = !r && ms >= 1560;
    final tint = r ? 0.0 : seg(ms, 2300, 200);
    final visorK = r ? 0.0 : seg(ms, 2440, 200, MotionCurves.out);

    final (pencilO, pencilS) = t.pop(420, from: 0.5);
    final (creaseShare, creaseO) = t.draw(560, 360);
    final (cFillO, cFillS) = t.pop(900, from: 0.4);
    final cLetter = t.fade(900, 120);
    final (tickShare, tickO) = t.draw(980, 420);
    final tickEdge = t.fade(1100);

    Widget content({required bool crease}) => _SheetContent(paper: p, pencil: (pencilO, pencilS), cFill: (cFillO, cFillS), cLetter: cLetter, crease: crease ? (creaseShare, creaseO) : null);

    final flaps = <Widget>[];
    if (!r) {
      const order = ['tl', 'tr', 'br', 'bl'];
      for (var k = 0; k < 4; k++) {
        final start = 1560 + k * 90.0;
        final a = seg(ms, start, 420, MotionCurves.emphasized) * math.pi;
        flaps.add(
          Positioned.fill(
            child: _Flap(corner: order[k], angle: a, paper: p, front: content(crease: true)),
          ),
        );
      }
    }

    // Mobi steps out of the paper (celebrate), then sways ±3 degrees.
    final mobiK = r ? 0.0 : t.spring(2640, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final mobiO = r ? t.fade(1500) : (ms > 2640 ? 1.0 : 0.0);
    final mobiScale = r ? 1.0 : lerpD(0.7, 1, mobiK);
    final sway = r || ms < 3400 || ms > 4300 ? 0.0 : _kf((ms - 3400) / 900, const [0, 0.3, 0.65, 1], const [0, -3, 2, 0]) * _deg;
    final mShadow = r ? t.fade(1500) : seg(ms, 2700, 300, MotionCurves.out);

    final t0 = r ? 2000.0 : 3000.0;
    const ring = [(FoldKey.dogear, 98.0, 66.0), (FoldKey.hexa, 264.0, 66.0), (FoldKey.dart, 36.0, 64.0), (FoldKey.kandil, 324.0, 64.0)];
    final landed = ms >= ExSlides.lengthMs[1] - 1;

    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: _GridPaper(ink: c.ink, night: fx.night),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 70,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.ground.withValues(alpha: 0), c.ground]),
            ),
          ),
        ),
        Positioned.fill(
          child: CustomPaint(
            painter: ExLampPainter(cx: cx, coneW: 330, coneH: 378, lampA: p.lampA, scaleX: coneScale, cone: cone, bright: flare, shade: shade, shadeDy: r ? 0 : -12 * (1 - shade)),
          ),
        ),
        // The sheet, its corners and the diamond it folds into.
        _pos(
          cx - sz / 2,
          cy - sz / 2 + wdy,
          sz,
          sz,
          _o(
            wo * wrapOut,
            Transform.rotate(
              angle: sheetRot,
              child: Transform.scale(
                scale: sheetScale,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: 10,
                      right: 10,
                      top: sz - 4,
                      height: 16,
                      child: _o(1 - shrink, CustomPaint(painter: _SoftOval(alpha: p.shadowA))),
                    ),
                    Positioned.fill(
                      child: _o(
                        flatO,
                        DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: p.shadowA * 0.6),
                                blurRadius: 24,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Positioned.fill(
                      child: folding
                          ? ClipPath(clipper: const _Diamond(), child: ColoredBox(color: p.paper, child: content(crease: true)))
                          : DecoratedBox(
                              decoration: BoxDecoration(color: p.paper, borderRadius: BorderRadius.circular(3)),
                              child: content(crease: true),
                            ),
                    ),
                    // The fix: a volt tick on C.
                    Positioned.fill(
                      child: _o(
                        tickO,
                        CustomPaint(
                          painter: _FixTick(share: tickShare, edge: tickEdge),
                        ),
                      ),
                    ),
                    if (folding) ...flaps,
                    Positioned.fill(
                      child: _o(
                        tint,
                        ClipPath(
                          clipper: const _Diamond(),
                          child: const ColoredBox(color: Color(0xFFCDE52A)),
                        ),
                      ),
                    ),
                    Positioned(
                      left: sz * 0.26,
                      top: sz * 0.4,
                      width: sz * 0.48,
                      height: sz * 0.2,
                      child: _o(visorK, Transform(alignment: Alignment.center, transform: Matrix4.diagonal3Values(lerpD(0.4, 1, visorK), 1, 1), child: const _Visor())),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        _pos(cx - 46, mobiBase - 7, 92, 14, _o(mShadow, CustomPaint(painter: _SoftOval(alpha: p.shadowA)))),
        _pos(
          cx - 0.56 * mobiW,
          mobiTop,
          mobiW,
          mobiH,
          _o(
            mobiO,
            Transform.scale(
              scale: mobiScale,
              alignment: const Alignment(0.12, 0.94),
              child: Transform.rotate(
                angle: sway,
                alignment: const Alignment(0.12, 0.94),
                child: Image.asset('assets/art/mobi-greet.webp', fit: BoxFit.contain, filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
            ),
          ),
        ),
        for (var i = 0; i < ring.length; i++)
          ...exFold(
            fold: ring[i].$1,
            x: ring[i].$2,
            base: mobiBase + 2,
            size: ring[i].$3,
            pose: (ring[i].$1 == FoldKey.dart || ring[i].$1 == FoldKey.hexa) && ms >= t.at(t0 + 900 + i * 100) ? FoldPose.wave : FoldPose.idle,
            move: t.hopIn(t0 + i * 90, rise: 30),
            breathe: landed && !r,
            phase: i + 11,
            night: fx.night,
          ),
        for (var i = 0; i < ring.length; i++)
          exTag(context, MobV3Copy.foldName(ring[i].$1), x: ring[i].$2, top: mobiBase + 6, kind: ExTagKind.dim, reveal: t.engrave(t0 + 400 + i * 90), opacity: t.engraveO(t0 + 400 + i * 90)),
        exTag(context, MobExplainerCopy.mobiEldest, x: cx, top: mobiBase + 6, kind: ExTagKind.eldest, reveal: t.engrave(r ? 1800 : 2950), opacity: t.engraveO(r ? 1800 : 2950)),
        _sparks(
          t,
          bursts: [ExBurst(x: cx, y: cy - 10, n: fx.bits(18), at: 2660, floor: mobiBase + 2, seed: 21, up: 140)],
          glints: [
            ExGlints(x: cx + 14, y: cy - 6, n: 4, r: 22, at: 1180, colour: ExPaper.volt),
            const ExGlints(x: cx, y: cy - 20, n: 6, r: 70, at: 2700, rot: 0.3),
          ],
        ),
      ],
    );
  }
}

/// The answer sheet's face: the question, the marks rule, four bubbles (B picked in pencil, C the right
/// one), ruled lines and the dashed crease.
class _SheetContent extends StatelessWidget {
  const _SheetContent({required this.paper, required this.pencil, required this.cFill, required this.cLetter, this.crease});
  final ExPaper paper;
  final (double, double) pencil;
  final (double, double) cFill;
  final double cLetter;
  final (double, double)? crease;

  static const double sz = _SlideFold.sz;

  @override
  Widget build(BuildContext context) {
    final ink2 = paper.ink2;
    final small = _hanken(context, 11, w: FontWeight.w600, colour: ink2, height: 14);
    return Stack(
      children: [
        Positioned(left: 14, top: 12, child: Text(MobExplainerCopy.sheetQuestion, style: small)),
        Positioned(right: 14, top: 12, child: Text(MobExplainerCopy.sheetMarks, style: small)),
        for (var i = 0; i < 3; i++)
          Positioned(
            left: 28,
            right: 28,
            top: sz / 2 + 30 + i * 11,
            height: 1.5,
            child: ColoredBox(color: paper.line),
          ),
        Positioned(
          left: 28,
          width: 80,
          top: sz / 2 - 40,
          height: 1.5,
          child: ColoredBox(color: paper.line),
        ),
        for (var i = 0; i < 4; i++)
          Positioned(
            left: 21 + i * 34,
            top: sz / 2 - 13,
            width: 26,
            height: 26,
            child: _Bubble(
              letter: const ['A', 'B', 'C', 'D'][i],
              paper: paper,
              size: 26,
              pencil: i == 1 ? pencil : null,
              fill: i == 2 ? cFill : null,
              letterOnFill: i == 2 ? cLetter : 0,
              fontSize: 11,
            ),
          ),
        if (crease != null)
          Positioned.fill(
            child: _o(
              crease!.$2,
              CustomPaint(
                painter: ExLinePainter(a: const Offset(10, sz - 22), b: const Offset(sz - 12, 26), share: crease!.$1, colour: paper.ink.withValues(alpha: 0.38), dash: (5, 4)),
              ),
            ),
          ),
      ],
    );
  }
}

/// An answer-sheet bubble: the letter in a ring; a pencil pick or an ink fill pops in.
class _Bubble extends StatelessWidget {
  const _Bubble({required this.letter, required this.paper, required this.size, this.pencil, this.fill, this.letterOnFill = 0, this.fontSize = 11});
  final String letter;
  final ExPaper paper;
  final double size;
  final (double, double)? pencil;
  final (double, double)? fill;
  final double letterOnFill;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final style = _hanken(context, fontSize, w: FontWeight.w600, colour: paper.ink2, height: fontSize + 2);
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: paper.ink2, width: 1.5),
          ),
        ),
        Text(letter, style: style),
        if (pencil != null)
          Positioned.fill(
            child: _o(
              pencil!.$1,
              Transform.scale(
                scale: pencil!.$2,
                child: const DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(center: Alignment(-0.2, -0.3), colors: [Color(0xFF8D887E), Color(0xFF5E5A52)]),
                  ),
                ),
              ),
            ),
          ),
        if (fill != null)
          Positioned.fill(
            child: _o(
              fill!.$1,
              Transform.scale(
                scale: fill!.$2,
                child: DecoratedBox(
                  decoration: BoxDecoration(shape: BoxShape.circle, color: paper.ink),
                ),
              ),
            ),
          ),
        if (fill != null) _o(letterOnFill, Text(letter, style: style.copyWith(color: paper.paper))),
      ],
    );
  }
}

class _FixTick extends CustomPainter {
  _FixTick({required this.share, required this.edge});
  final double share;
  final double edge;

  @override
  void paint(Canvas canvas, Size size) {
    if (share <= 0) return;
    const x = 21 + 2 * 34 + 2.0;
    const y = _SlideFold.sz / 2 - 2;
    final path = Path()
      ..moveTo(x, y)
      ..relativeLineTo(8, 9)
      ..relativeLineTo(17, -21);
    final m = path.computeMetrics().first;
    final drawn = m.extractPath(0, m.length * share);
    Paint stroke(Color c, double w) => Paint()
      ..color = c
      ..style = PaintingStyle.stroke
      ..strokeWidth = w
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    if (edge > 0) canvas.drawPath(drawn, stroke(const Color(0xFF3B4A00).withValues(alpha: edge), 5.6));
    canvas.drawPath(drawn, stroke(ExPaper.volt, 4.2));
  }

  @override
  bool shouldRepaint(_FixTick old) => old.share != share || old.edge != edge;
}

/// One corner of the sheet folding in on its diagonal (520 perspective): its face hides half way, then
/// its back shows, shaded.
class _Flap extends StatelessWidget {
  const _Flap({required this.corner, required this.angle, required this.paper, required this.front});
  final String corner;
  final double angle;
  final ExPaper paper;
  final Widget front;

  @override
  Widget build(BuildContext context) {
    final (axis, origin) = switch (corner) {
      'tl' => (135 * _deg, const FractionalOffset(0.25, 0.25)),
      'tr' => (45 * _deg, const FractionalOffset(0.75, 0.25)),
      'br' => (135 * _deg, const FractionalOffset(0.75, 0.75)),
      _ => (45 * _deg, const FractionalOffset(0.25, 0.75)),
    };
    final m = Matrix4.identity()
      ..setEntry(3, 2, 1 / 520)
      ..rotateZ(axis)
      ..rotateX(angle)
      ..rotateZ(-axis);
    final k = angle / math.pi;
    final backShade = k < 0.31 ? 0.6 * k / 0.31 : lerpD(0.6, 0.35, (k - 0.31) / 0.69);
    final showFront = angle < math.pi / 2;
    return Transform(
      alignment: origin,
      transform: m,
      child: ClipPath(
        clipper: _Corner(corner),
        child: showFront ? ColoredBox(color: paper.paper, child: front) : ColoredBox(color: Color.lerp(paper.paper, paper.back, backShade.clamp(0.0, 1.0) / 0.6)!),
      ),
    );
  }
}

class _Corner extends CustomClipper<Path> {
  const _Corner(this.corner);
  final String corner;

  @override
  Path getClip(Size s) {
    final w = s.width;
    final h = s.height;
    final pts = switch (corner) {
      'tl' => [Offset.zero, Offset(w / 2, 0), Offset(0, h / 2)],
      'tr' => [Offset(w / 2, 0), Offset(w, 0), Offset(w, h / 2)],
      'br' => [Offset(w, h / 2), Offset(w, h), Offset(w / 2, h)],
      _ => [Offset(0, h / 2), Offset(w / 2, h), Offset(0, h)],
    };
    return Path()..addPolygon(pts, true);
  }

  @override
  bool shouldReclip(_Corner old) => old.corner != corner;
}

class _Diamond extends CustomClipper<Path> {
  const _Diamond();
  @override
  Path getClip(Size s) => Path()..addPolygon([Offset(s.width / 2, 0), Offset(s.width, s.height / 2), Offset(s.width / 2, s.height), Offset(0, s.height / 2)], true);
  @override
  bool shouldReclip(_Diamond old) => false;
}

class _Visor extends StatelessWidget {
  const _Visor();
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        Widget eye(double left) => Positioned(
          left: left,
          top: h * 0.28,
          width: w * 0.09,
          height: h * 0.46,
          child: DecoratedBox(
            decoration: BoxDecoration(color: const Color(0xFFF3EFE4), borderRadius: BorderRadius.circular(w * 0.04)),
          ),
        );
        return Stack(
          children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(color: const Color(0xFF12110E), borderRadius: BorderRadius.circular(h / 2)),
              ),
            ),
            eye(w * 0.28),
            eye(w * 0.63),
          ],
        );
      },
    );
  }
}

class _SoftOval extends CustomPainter {
  _SoftOval({required this.alpha});
  final double alpha;
  @override
  void paint(Canvas canvas, Size size) => canvas.drawOval(
    Offset.zero & size,
    Paint()
      ..color = Colors.black.withValues(alpha: alpha * 0.7)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.height * 0.35),
  );
  @override
  bool shouldRepaint(_SoftOval old) => old.alpha != alpha;
}

class _GridPaper extends CustomPainter {
  _GridPaper({required this.ink, required this.night});
  final Color ink;
  final bool night;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = const Color(0xFF7F7868).withValues(alpha: night ? 0.09 : 0.11)
      ..strokeWidth = 1;
    for (var x = 0.0; x <= size.width; x += 14) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    for (var y = 0.0; y <= size.height; y += 14) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
  }

  @override
  bool shouldRepaint(_GridPaper old) => old.night != night || old.ink != ink;
}

// ---------------------------------------------------------------------------------------------------
// 3. Four ways to play (K9): the four games are dealt onto the desk under the lamp, each with its
// real numbers; then each card shows its own detail.
// ---------------------------------------------------------------------------------------------------

class _SlideGames extends StatelessWidget {
  const _SlideGames({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  static const List<Rect> slots = [Rect.fromLTWH(16, 40, 158, 138), Rect.fromLTWH(186, 40, 158, 138), Rect.fromLTWH(16, 186, 158, 184), Rect.fromLTWH(186, 186, 158, 184)];
  static const List<double> stackTilt = [-7, -2.5, 3, 8];
  static const List<double> restTilt = [-1.2, 0.9, 0.7, -1];

  /// When card [i] lands in its slot.
  static double landed(int i) => 520 + i * 110.0 + 420;

  @override
  Widget build(BuildContext context) {
    final p = ExPaper.of(context);
    final ms = t.ms;
    final r = t.reduced;
    final cone = r ? t.fade(0) : seg(ms, 0, 420, MotionCurves.glide);
    final (so, sdy) = t.rise(120, dy: 18, d: 300);
    const centre = Offset(180, 210);
    final cards = <Widget>[];
    // The top card of the stack is dealt first, so it is painted last.
    for (var i = 3; i >= 0; i--) {
      final slot = slots[i];
      double o;
      Offset at;
      double rot;
      double scale;
      if (r) {
        o = t.fade(520 + i * 110.0, 120);
        at = slot.center;
        rot = restTilt[i] * _deg;
        scale = 1;
      } else {
        final k = seg(ms, 520 + i * 110.0, 420, MotionCurves.emphasized);
        o = 1;
        at = Offset.lerp(centre + Offset(0, sdy), slot.center, k)!;
        rot = lerpD(stackTilt[i], restTilt[i], k) * _deg;
        scale = lerpD(0.84, 1, k);
      }
      cards.add(
        Positioned(
          left: at.dx - slot.width / 2,
          top: at.dy - slot.height / 2,
          width: slot.width,
          height: slot.height,
          child: _o(
            o,
            Transform.rotate(
              angle: rot,
              child: Transform.scale(
                scale: scale,
                child: _GameCard(i: i, t: t, paper: p),
              ),
            ),
          ),
        ),
      );
    }
    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: ExLampPainter(cx: 180, coneW: 360, coneH: 380, lampA: p.lampA, cone: cone, scaleX: r ? 1 : lerpD(0.75, 1, cone), shade: r ? t.fade(0) : seg(ms, 0, 300, MotionCurves.out)),
          ),
        ),
        // The stack rises as one piece (no card shows through another), then each card is dealt.
        Positioned.fill(child: _o(r ? 1 : so, Stack(clipBehavior: Clip.none, children: cards))),
      ],
    );
  }
}

class _GameCard extends StatelessWidget {
  const _GameCard({required this.i, required this.t, required this.paper});
  final int i;
  final ExTime t;
  final ExPaper paper;

  @override
  Widget build(BuildContext context) {
    final land = _SlideGames.landed(i);
    final label = _hanken(context, 14, w: FontWeight.w600, colour: paper.ink, height: 18);
    final line = _hanken(context, 12.5, colour: paper.ink2, height: 16);
    final foot = _hanken(context, 11.5, w: FontWeight.w500, colour: paper.ink2, height: 15);
    Widget footRow(String text) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1.5),
          child: Icon(LucideIcons.clock, size: 12, color: paper.ink2),
        ),
        const SizedBox(width: 5),
        Expanded(child: Text(text, style: foot)),
      ],
    );
    final detail = switch (i) {
      0 => _sprint(context, land),
      1 => _round(context, land),
      2 => _rematch(context, land),
      _ => _paper(context, land),
    };
    final (title, sub, footText) = switch (i) {
      0 => (MobExplainerCopy.sprint, null, MobExplainerCopy.open24),
      1 => (MobExplainerCopy.ownRound, MobExplainerCopy.ownRoundLine, MobExplainerCopy.open24),
      2 => (MobExplainerCopy.rematch, MobExplainerCopy.rematchLine, MobExplainerCopy.open24),
      _ => (MobExplainerCopy.paper, null, MobExplainerCopy.paperFoot),
    };
    return DecoratedBox(
      decoration: paper.sheet(radius: 8),
      child: Stack(
        children: [
          Positioned(
            right: 0,
            top: 0,
            child: CustomPaint(
              size: const Size(16, 16),
              painter: _DogEar(back: paper.back, ground: context.mmColors.ground),
            ),
          ),
          // The top of the card is clipped, never overflowing; the foot keeps to the bottom edge.
          Positioned(
            left: 12,
            top: 11,
            right: 12,
            bottom: i == 3 ? 56 : 34,
            child: ClipRect(
              child: OverflowBox(
                alignment: Alignment.topLeft,
                maxHeight: double.infinity,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: Text(title, style: label),
                    ),
                    const SizedBox(height: 6),
                    detail,
                    if (sub != null) ...[const SizedBox(height: 6), Text(sub, style: line)],
                  ],
                ),
              ),
            ),
          ),
          Positioned(left: 12, right: 12, bottom: 10, child: footRow(footText)),
        ],
      ),
    );
  }

  // Sprint: "5 questions", and five cells fill one by one.
  Widget _sprint(BuildContext context, double land) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(MobExplainerCopy.sprintFigure, style: _figure(context, 44, paper.ink)),
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(MobExplainerCopy.sprintLine, style: _hanken(context, 12.5, colour: paper.ink2, height: 16)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            for (var j = 0; j < 5; j++) ...[
              if (j > 0) const SizedBox(width: 5),
              _Cell(fill: t.reduced ? t.fade(land - 200 + j * 60.0, 120) : seg(t.ms, land + 200 + j * 90.0, 240, MotionCurves.out), number: j + 1, paper: paper),
            ],
          ],
        ),
      ],
    );
  }

  // Your own round: the length chips, the pick sliding from 10 to 15.
  Widget _round(BuildContext context, double land) {
    final (ho, hs) = t.pop(land + 200, from: 0.6);
    final move = t.reduced ? (t.ms >= t.at(land + 520) ? 1.0 : 0.0) : seg(t.ms, land + 520, 360, exSmooth);
    const chipW = 36.0;
    const gap = 6.0;
    final hx = move * (chipW + gap);
    final pickIndex = move > 0.5 ? 1 : 0;
    return SizedBox(
      height: 26,
      child: Stack(
        children: [
          Positioned(
            left: hx,
            top: 0,
            width: chipW,
            height: 26,
            child: _o(
              ho,
              Transform.scale(
                scale: hs,
                child: DecoratedBox(
                  decoration: BoxDecoration(color: paper.ink, borderRadius: BorderRadius.circular(13)),
                ),
              ),
            ),
          ),
          for (var j = 0; j < 3; j++)
            Positioned(
              left: j * (chipW + gap),
              top: 0,
              width: chipW,
              height: 26,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: paper.ink2.withValues(alpha: 0.55)),
                ),
                child: Center(child: Text(MobExplainerCopy.roundLengths[j], style: _figure(context, 15, j == pickIndex && ho > 0.5 ? paper.paper : paper.ink))),
              ),
            ),
        ],
      ),
    );
  }

  // Rematch: a loop drawn round.
  Widget _rematch(BuildContext context, double land) {
    final (share, o) = t.draw(land + 200, 420);
    return SizedBox(
      width: 30,
      height: 30,
      child: _o(
        o,
        CustomPaint(
          painter: _LoopPainter(share: share, colour: paper.ink),
        ),
      ),
    );
  }

  // The Mob paper: "10 questions in 10 minutes", a clock's hand sweeping ten minutes.
  Widget _paper(BuildContext context, double land) {
    final sweep = t.reduced ? (t.ms >= t.at(land + 200) ? 1.0 : 0.0) : seg(t.ms, land + 200, 900, MotionCurves.inOut);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(MobExplainerCopy.paperFigure, style: _figure(context, 44, paper.ink)),
            const SizedBox(width: 10),
            SizedBox(
              width: 30,
              height: 30,
              child: CustomPaint(
                painter: _ClockPainter(sweep: sweep, ink: paper.ink, quiet: paper.ink2, wedge: paper.voltLine),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(MobExplainerCopy.paperLine, style: _hanken(context, 12.5, colour: paper.ink2, height: 16)),
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.fill, required this.number, required this.paper});
  final double fill;
  final int number;
  final ExPaper paper;

  @override
  Widget build(BuildContext context) {
    final style = _figure(context, 12, paper.ink);
    return Container(
      width: 20,
      height: 16,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: paper.ink2.withValues(alpha: 0.5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Text('$number', style: style),
          Positioned.fill(
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: fill.clamp(0.0, 1.0),
              child: ColoredBox(color: paper.ink),
            ),
          ),
          if (fill > 0.6) Text('$number', style: style.copyWith(color: paper.paper)),
        ],
      ),
    );
  }
}

class _DogEar extends CustomPainter {
  _DogEar({required this.back, required this.ground});
  final Color back;
  final Color ground;
  @override
  void paint(Canvas canvas, Size s) {
    canvas.drawPath(Path()..addPolygon([Offset.zero, Offset(s.width, 0), Offset(s.width, s.height)], true), Paint()..color = ground);
    canvas.drawPath(Path()..addPolygon([Offset.zero, Offset(s.width, s.height), Offset(0, s.height)], true), Paint()..color = back);
  }

  @override
  bool shouldRepaint(_DogEar old) => old.back != back || old.ground != ground;
}

class _LoopPainter extends CustomPainter {
  _LoopPainter({required this.share, required this.colour});
  final double share;
  final Color colour;
  @override
  void paint(Canvas canvas, Size size) {
    if (share <= 0) return;
    final c = size.center(Offset.zero);
    final rad = size.width * 0.36;
    final p = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;
    const start = -math.pi / 2 + 0.5;
    final sweep = (2 * math.pi - 1.0) * share;
    canvas.drawArc(Rect.fromCircle(center: c, radius: rad), start, sweep, false, p);
    if (share > 0.9) {
      final a = start + sweep;
      final tip = c + Offset(math.cos(a), math.sin(a)) * rad;
      final dir = Offset(-math.sin(a), math.cos(a));
      final n = Offset(math.cos(a), math.sin(a));
      final head = Path()
        ..moveTo(tip.dx + dir.dx * 5, tip.dy + dir.dy * 5)
        ..lineTo(tip.dx - n.dx * 4.5, tip.dy - n.dy * 4.5)
        ..lineTo(tip.dx + n.dx * 4.5, tip.dy + n.dy * 4.5)
        ..close();
      canvas.drawPath(head, Paint()..color = colour);
    }
  }

  @override
  bool shouldRepaint(_LoopPainter old) => old.share != share || old.colour != colour;
}

class _ClockPainter extends CustomPainter {
  _ClockPainter({required this.sweep, required this.ink, required this.quiet, required this.wedge});
  final double sweep;
  final Color ink;
  final Color quiet;
  final Color wedge;
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final rad = size.width / 2 - 1.5;
    // Ten minutes of sixty: a sixth of the face.
    final a = sweep * math.pi / 3;
    if (a > 0) canvas.drawArc(Rect.fromCircle(center: c, radius: rad), -math.pi / 2, a, true, Paint()..color = wedge.withValues(alpha: 0.45));
    canvas.drawCircle(
      c,
      rad,
      Paint()
        ..color = quiet
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
    final p = Paint()
      ..color = ink
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(c, c + Offset(math.sin(a), -math.cos(a)) * rad * 0.82, p);
    canvas.drawCircle(c, 2, Paint()..color = ink);
  }

  @override
  bool shouldRepaint(_ClockPainter old) => old.sweep != sweep || old.ink != ink;
}

// ---------------------------------------------------------------------------------------------------
// 4. See who did best: CUET marks fill a mark sheet, the podium unfolds third, second, first, then each
// friend's one highlight (assignMoments on the fixture runs).
// ---------------------------------------------------------------------------------------------------

class _SlidePodium extends StatelessWidget {
  const _SlidePodium({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  static const double floorY = 252;
  static const double rowsT = 160;
  static const double highlightAt = 4100;

  // (fold, name, place, x, plinth width, plinth height, cells, marks, highlight, colour index)
  static const List<(FoldKey, String, int, double, double, double, String, int, String)> rows = [
    (FoldKey.hexa, 'Kabir', 1, 180, 104, 108, 'rrrsr', 20, MobExplainerCopy.highlightKabir),
    (FoldKey.dogear, 'Riya', 2, 74, 100, 84, 'rrrwr', 19, MobExplainerCopy.highlightRiya),
    (FoldKey.dart, MobExplainerCopy.you, 3, 286, 100, 64, 'rrssr', 15, MobExplainerCopy.highlightYou),
  ];

  double cellAt(int ri, int ci) => rowsT + 120 + ci * 170.0 + ri * 50;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final p = ExPaper.of(context);
    final ms = t.ms;
    final r = t.reduced;
    final times = r ? const [2000.0, 2600.0, 3200.0] : const [2000.0, 2420.0, 2840.0];
    final firstAt = times[2];
    final cone = r ? t.fade(0) : seg(ms, 0, 420, MotionCurves.emphasized);
    final bright = r ? 1.0 : (ms < firstAt + 560 ? 1.0 : _kf(((ms - firstAt - 560) / 1200).clamp(0.0, 1.0), const [0, 0.35, 1], const [1, 1.6, 1.25]));
    final order = [rows[2], rows[1], rows[0]];
    final plinths = <Widget>[];
    final folds = <Widget>[];
    for (var i = 0; i < 3; i++) {
      final row = order[i];
      final at = times[i];
      final left = row.$4 - row.$5 / 2;
      final top = floorY - row.$6;
      final unfold = r ? 1.0 : seg(ms, at, 420, MotionCurves.emphasized);
      final po = r ? seg(ms, t.at(at), 120) : (ms > at ? (seg(ms, at, 42)) : 0.0);
      final sheen = r || row.$3 != 1 ? 0.0 : seg(ms, at + 640, 700, MotionCurves.sweep);
      plinths.add(
        _pos(
          left,
          top,
          row.$5,
          row.$6,
          _o(
            po,
            Transform(
              alignment: Alignment.bottomCenter,
              transform: Matrix4.identity()
                ..setEntry(3, 2, 1 / 520)
                ..rotateX((1 - unfold) * 86 * _deg),
              child: _Plinth(place: row.$3, label: MobExplainerCopy.plinth(row.$2, row.$8), night: fx.night, sheen: sheen, paperInk: p.ink, paperInk2: p.ink2),
            ),
          ),
        ),
      );
      final first = row.$3 == 1;
      final dropAt = at + 260;
      final move = t.drop(r ? at : dropAt);
      final hop = first ? t.hop(at + 1000, 12) : 0.0;
      final (sx, sy) = first ? t.squash(at + 1360) : (1.0, 1.0);
      folds.addAll(
        exFold(
          fold: row.$1,
          x: row.$4,
          base: top + 2,
          size: first ? 76 : 66,
          pose: first && ms >= t.at(at + 560) ? FoldPose.cheer : FoldPose.idle,
          move: ExMove(o: move.o, dy: move.dy, shadow: move.shadow, shadowO: move.shadowO, sx: move.sx * sx, sy: move.sy * sy),
          lift: hop,
          breathe: ms >= ExSlides.lengthMs[3] - 1 && !r,
          phase: 6 + i,
          night: fx.night,
        ),
      );
    }

    final (sheetO, sheetDy) = t.rise(120);
    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: ExLampPainter(cx: 180, coneW: 300, coneH: 254, lampA: p.lampA, cone: r ? cone : lerpD(0.4, 1, cone), scaleX: r ? 1 : lerpD(1.35, 1, cone), bright: bright, shade: 1),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: floorY,
          height: 14,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.sunken, c.sunken.withValues(alpha: 0)]),
            ),
          ),
        ),
        ...plinths,
        ...folds,
        _sparks(
          t,
          bursts: [ExBurst(x: 180, y: floorY - 108 - 30, n: fx.bits(26), at: firstAt + 600, floor: floorY, seed: 4)],
          glints: [ExGlints(x: 180, y: floorY - 108 - 50, n: 6, r: 52, at: firstAt + 660)],
        ),
        // The mark sheet.
        _pos(
          16,
          270 + sheetDy,
          328,
          128,
          _o(
            sheetO,
            DecoratedBox(
              decoration: ExPaper.card(context),
              child: Stack(children: [for (var ri = 0; ri < 3; ri++) _markRow(context, ri, p)]),
            ),
          ),
        ),
      ],
    );
  }

  Widget _markRow(BuildContext context, int ri, ExPaper p) {
    final c = context.mmColors;
    final row = rows[ri];
    const vals = {'r': 5, 'w': -1, 's': 0};
    var marks = 0;
    for (var ci = 0; ci < 5; ci++) {
      if (t.ms >= t.at(cellAt(ri, ci)) + 60) marks += vals[row.$7[ci]]!;
    }
    final hAt = highlightAt + ri * 90.0;
    final cellsOut = t.reduced ? 1 - seg(t.ms, t.at(hAt), 120) : 1 - seg(t.ms, hAt, 200, MotionCurves.leave);
    final hReveal = t.engrave(hAt + 120);
    final hO = t.engraveO(hAt + 120);
    final y = 10 + ri * 38.0;
    final cells = <Widget>[];
    for (var ci = 0; ci < 5; ci++) {
      final kind = row.$7[ci];
      final x = 132 + ci * 30.0;
      final (o, s) = t.pop(cellAt(ri, ci), from: 0.5);
      cells.add(
        _pos(
          x,
          5,
          26,
          26,
          _o(
            o,
            Transform.scale(
              scale: s,
              child: _MarkCell(kind: kind, good: p.good),
            ),
          ),
        ),
      );
      if (kind == 's' && ri == 0) {
        final (ro, rs) = t.pop(1420, from: 0.6);
        final pulse = t.reduced || t.ms < 1700 || t.ms > 2900 ? 0.0 : math.sin(((t.ms - 1700) % 600) / 600 * math.pi) * 0.15;
        cells.add(
          _pos(
            x - 4,
            1,
            34,
            34,
            _o(
              ro,
              Transform.scale(
                scale: rs * (1 + pulse),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: p.voltLine, width: 2.5),
                  ),
                ),
              ),
            ),
          ),
        );
      }
      if (kind == 'w') {
        final (ro, rs) = t.pop(1480, from: 0.6);
        cells.add(
          _pos(
            x - 4,
            1,
            34,
            34,
            _o(
              ro,
              Transform.scale(
                scale: rs,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: c.wrongBorder, width: 2),
                  ),
                ),
              ),
            ),
          ),
        );
      }
    }
    return _pos(
      0,
      y,
      328,
      36,
      Stack(
        children: [
          Positioned(left: 12, top: 4, child: ExHead(fold: row.$1, size: 28)),
          Positioned(
            left: 48,
            top: 8,
            child: Text(row.$2, style: context.mmType.labelLarge.copyWith(color: c.ink)),
          ),
          Positioned(left: 0, top: 0, width: 328, height: 36, child: _o(cellsOut, Stack(children: cells))),
          Positioned(
            left: 132,
            top: 8,
            width: 150,
            child: _o(
              hO,
              ClipRect(
                clipper: ExRevealClipper(hReveal),
                child: Row(
                  children: [
                    Icon(LucideIcons.sparkle, size: 13, color: p.voltLine),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(row.$9, maxLines: 1, style: context.mmType.label.copyWith(fontSize: 13, color: c.ink)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            right: 14,
            top: 2,
            width: 48,
            child: Text('$marks', textAlign: TextAlign.right, textHeightBehavior: MmType.figureHeightBehavior, style: _figure(context, 28, c.ink)),
          ),
        ],
      ),
    );
  }
}

class _MarkCell extends StatelessWidget {
  const _MarkCell({required this.kind, required this.good});
  final String kind;
  final Color good;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final style = _figure(context, 13, c.ink2);
    return switch (kind) {
      'r' => DecoratedBox(
        decoration: BoxDecoration(shape: BoxShape.circle, color: good),
        child: Center(child: Icon(LucideIcons.check, size: 14, color: c.ground)),
      ),
      'w' => DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: c.wrongSurface,
          border: Border.all(color: c.wrongBorder, width: 1.5),
        ),
        child: Center(
          child: Text('−1', style: style.copyWith(color: c.wrongText)),
        ),
      ),
      _ => CustomPaint(
        painter: _DashedRRect(colour: c.ink3, radius: 13, width: 1.5),
        child: Center(child: Text('0', style: style)),
      ),
    };
  }
}

class _Plinth extends StatelessWidget {
  const _Plinth({required this.place, required this.label, required this.night, required this.sheen, required this.paperInk, required this.paperInk2});
  final int place;
  final String label;
  final bool night;
  final double sheen;
  final Color paperInk;
  final Color paperInk2;

  @override
  Widget build(BuildContext context) {
    final fig = place == 1 ? 44.0 : (place == 2 ? 36.0 : 30.0);
    return Stack(
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: PlinthPainter(
              paper: night ? const Color(0xFFE6DFCD) : const Color(0xFFFBF8F1),
              paperLow: night ? const Color(0xFFCFC6B0) : const Color(0xFFEDE7DA),
              ground: context.mmColors.ground,
              edge: night ? null : const Color(0xFFD9D0BE),
              ruled: false,
              creases: 4 - place,
              foil: place == 1 ? 1 : 0,
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: place == 1 ? 16 : (place == 2 ? 10 : 7),
          child: Text('$place', textAlign: TextAlign.center, textHeightBehavior: MmType.figureHeightBehavior, style: _figure(context, fig, paperInk)),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 6,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: _hanken(context, 12, w: FontWeight.w600, colour: paperInk2, height: 16),
          ),
        ),
        if (sheen > 0 && sheen < 1)
          Positioned.fill(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(topLeft: Radius.circular(10)),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(-1.6 + sheen * 3.2 - 0.5, -1),
                    end: Alignment(-1.6 + sheen * 3.2 + 0.5, 1),
                    colors: [
                      const Color(0x00F2B865),
                      const Color(0xFFFFF0C8).withValues(alpha: 0.6 * math.sin(sheen * math.pi)),
                      const Color(0x00F2B865),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// 5. Fix it together: the trap, your pencil pick struck, the right one filled; then Now and the
// Wednesday check; two of you pass; the seal.
// ---------------------------------------------------------------------------------------------------

class _SlideFix extends StatelessWidget {
  const _SlideFix({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  /// The fixture's dates, kept true to the calendar: the game closes on the coming Sunday and the
  /// check opens that Wednesday (the next Wednesday at least 48 hours after the close).
  static (DateTime, DateTime) dates(DateTime now) {
    final ist = now.toUtc().add(const Duration(hours: 5, minutes: 30));
    final day = DateTime.utc(ist.year, ist.month, ist.day);
    final sunday = day.add(Duration(days: (7 - day.weekday) % 7));
    return (sunday, sunday.add(const Duration(days: 3)));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final p = ExPaper.of(context);
    final ms = t.ms;
    final r = t.reduced;
    final (close, check) = dates(fx.now);
    const wk = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // MobTime.day reads a UTC instant in IST; the check is midnight IST, so pass its UTC instant.
    final checkLabel = MobTime.day(check.subtract(const Duration(hours: 5, minutes: 30)));

    final (cardO, cardDy) = t.rise(80, dy: 18, d: 420);
    final (pencilO, pencilS) = t.pop(380, from: 0.5);
    final (strike, strikeO) = t.draw(640, 260);
    final (cFillO, cFillS) = t.pop(700, from: 0.4);
    final cLetter = t.fade(700, 120);
    final why = t.engrave(900);
    final whyO = t.engraveO(900);
    final mobiK = r ? 1.0 : t.spring(1100, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final mobiO = r ? t.fade(1100) : (ms > 1100 ? 1.0 : 0.0);
    final (pathO, pathDy) = t.rise(1300);
    final (nowO, nowS) = t.pop(1550);
    final (tick, tickO) = t.draw(1650, 380);
    final flipOut = r ? seg(ms, t.at(2050), 120) : seg(ms, 2050, 200, MotionCurves.leave);
    final flipIn = r ? flipOut : seg(ms, 2250, 200, MotionCurves.out);
    final heads = [t.pop(2450), t.pop(2540)];
    final badges = [t.pop(2560, from: 0.4), t.pop(2650, from: 0.4)];
    final sealK = r ? 1.0 : t.spring(2900, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final sealO = r ? t.fade(2900) : (ms > 2900 ? 1.0 : 0.0);
    final sealRot = r ? 0.0 : (ms < 2900 ? -6.0 : _kf(((ms - 2900) / 520).clamp(0.0, 1.0), const [0, 0.5, 1], const [-6, 2, 0])) * _deg;
    final fixed = t.engrave(3150);
    final fixedO = t.engraveO(3150);
    final prog = t.fade(3300, 240);
    final (craneO, craneS) = t.pop(3350);
    final craneWiggle = r || ms < 3700 || ms > 4300 ? 0.0 : _kf((ms - 3700) / 600, const [0, 0.33, 0.66, 1], const [0, -5, 3, 0]) * _deg;

    const mobiH = 112.0;
    const mobiW = mobiH * 346 / 512;
    final label = context.mmType.labelLarge.copyWith(color: c.ink);
    final cap = context.mmType.caption.copyWith(color: c.ink2);

    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        // The answer sheet.
        _pos(
          18,
          8 + cardDy,
          290,
          182,
          _o(
            cardO,
            Transform.rotate(
              angle: -1.2 * _deg,
              child: DecoratedBox(
                decoration: p.sheet(radius: 8),
                child: Stack(
                  children: [
                    Positioned(
                      right: 0,
                      top: 0,
                      child: CustomPaint(
                        size: const Size(18, 18),
                        painter: _DogEar(back: p.back, ground: c.ground),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      top: 14,
                      right: 24,
                      child: Text(
                        MobV3Copy.trapCaught(4),
                        style: context.mmType.title.copyWith(fontSize: 17, height: 21 / 17, color: p.ink),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 16,
                      top: 40,
                      child: Text(MobExplainerSample.stem, style: _hanken(context, 13, colour: p.ink2, height: 18)),
                    ),
                    for (var i = 0; i < 4; i++) ...[
                      Positioned(
                        left: 30 + i * 64.0,
                        top: 78,
                        width: 28,
                        height: 28,
                        child: _Bubble(
                          letter: const ['A', 'B', 'C', 'D'][i],
                          paper: p,
                          size: 28,
                          pencil: i == 1 ? (pencilO, pencilS) : null,
                          fill: i == 2 ? (cFillO, cFillS) : null,
                          letterOnFill: i == 2 ? cLetter : 0,
                          fontSize: 12,
                        ),
                      ),
                      Positioned(
                        left: 30 + i * 64.0 - 18,
                        width: 64,
                        top: 109,
                        child: Text(
                          MobExplainerSample.options[i],
                          textAlign: TextAlign.center,
                          style: _hanken(context, 11.5, w: FontWeight.w500, colour: p.ink2, height: 15),
                        ),
                      ),
                    ],
                    Positioned(
                      left: 30 + 64 - 6,
                      top: 72,
                      width: 40,
                      height: 40,
                      child: _o(
                        strikeO,
                        CustomPaint(
                          painter: ExLinePainter(a: const Offset(6, 34), b: const Offset(34, 6), share: strike, colour: const Color(0xFF4A463F), width: 2.4),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 16,
                      right: 44,
                      top: 132,
                      child: _o(
                        whyO,
                        ClipRect(
                          clipper: ExRevealClipper(why),
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: MobExplainerCopy.whyLead,
                                  style: TextStyle(fontWeight: FontWeight.w600, color: p.ink),
                                ),
                                const TextSpan(text: MobExplainerCopy.why),
                              ],
                            ),
                            style: _hanken(context, 12.5, colour: p.ink2, height: 17),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        // Mobi thinks at its side.
        _pos(
          356 - mobiW,
          196 - mobiH,
          mobiW,
          mobiH,
          _o(
            mobiO,
            Transform.translate(
              offset: Offset(26 * (1 - mobiK), 0),
              child: Transform.rotate(
                angle: 8 * _deg * (1 - mobiK),
                alignment: Alignment.bottomCenter,
                child: Image.asset('assets/art/mobi-think.webp', fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
            ),
          ),
        ),
        // The path.
        _pos(
          16,
          200 + pathDy,
          328,
          200,
          _o(
            pathO,
            DecoratedBox(
              decoration: ExPaper.card(context),
              child: Stack(
                children: [
                  // Now.
                  Positioned(
                    left: 14,
                    top: 16,
                    width: 38,
                    height: 38,
                    child: _o(
                      nowO,
                      Transform.scale(
                        scale: nowS,
                        child: DecoratedBox(
                          decoration: BoxDecoration(shape: BoxShape.circle, color: c.raised2),
                          child: Icon(LucideIcons.send, size: 18, color: c.ink),
                        ),
                      ),
                    ),
                  ),
                  Positioned(left: 66, top: 14, right: 50, child: Text(MobExplainerCopy.now, style: label)),
                  Positioned(left: 66, top: 35, right: 50, child: Text(MobExplainerCopy.nowLine, style: cap)),
                  Positioned(
                    right: 14,
                    top: 22,
                    width: 26,
                    height: 26,
                    child: _o(
                      tickO,
                      CustomPaint(
                        painter: ExTickPainter(share: tick, colour: p.good, width: 2.6),
                      ),
                    ),
                  ),
                  // The calendar leaf flips from the close to the Wednesday.
                  Positioned(
                    left: 14,
                    top: 66,
                    width: 38,
                    height: 44,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: p.paper,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))],
                      ),
                      child: Stack(
                        children: [
                          if (flipOut < 1)
                            Positioned.fill(
                              child: Transform(
                                alignment: Alignment.topCenter,
                                transform: Matrix4.identity()
                                  ..setEntry(3, 2, 1 / 200)
                                  ..rotateX(-flipOut * math.pi / 2),
                                child: _Leaf(day: wk[close.weekday - 1], date: close.day, paper: p),
                              ),
                            ),
                          if (flipIn > 0)
                            Positioned.fill(
                              child: Transform(
                                alignment: Alignment.topCenter,
                                transform: Matrix4.identity()
                                  ..setEntry(3, 2, 1 / 200)
                                  ..rotateX((1 - flipIn) * math.pi / 2),
                                child: _Leaf(day: wk[check.weekday - 1], date: check.day, paper: p),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(left: 66, top: 66, right: 14, child: Text(checkLabel, style: label)),
                  Positioned(left: 66, top: 87, right: 14, child: Text(MobExplainerCopy.checkLine, style: cap)),
                  Positioned(left: 14, right: 14, top: 122, height: 1, child: ColoredBox(color: c.line)),
                  // Two of you pass: fixed together.
                  Positioned(
                    left: 14,
                    top: 136,
                    child: _o(
                      heads[0].$1,
                      Transform.scale(
                        scale: heads[0].$2,
                        child: const ExHead(fold: FoldKey.dart, size: 30),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 36,
                    top: 136,
                    child: _o(
                      heads[1].$1,
                      Transform.scale(
                        scale: heads[1].$2,
                        child: const ExHead(fold: FoldKey.dogear, size: 30),
                      ),
                    ),
                  ),
                  for (var b = 0; b < 2; b++)
                    Positioned(
                      left: 32 + b * 22.0,
                      top: 156,
                      width: 16,
                      height: 16,
                      child: _o(
                        badges[b].$1,
                        Transform.scale(
                          scale: badges[b].$2,
                          child: DecoratedBox(
                            decoration: BoxDecoration(shape: BoxShape.circle, color: p.good),
                            child: Icon(LucideIcons.check, size: 10, color: c.ground),
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    left: 80,
                    top: 128,
                    width: 50,
                    height: 50,
                    child: _o(
                      sealO,
                      Transform.rotate(
                        angle: sealRot,
                        child: Transform.scale(
                          scale: lerpD(1.4, 1, sealK),
                          child: Image.asset(ParcelStills.seal, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 140,
                    top: 134,
                    right: 70,
                    child: _o(
                      fixedO,
                      ClipRect(
                        clipper: ExRevealClipper(fixed),
                        child: Text(MobExplainerCopy.fixedTogether, style: label),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 140,
                    top: 155,
                    width: 128,
                    child: _o(prog, Text(MobExplainerCopy.trapsLine, style: cap.copyWith(fontSize: 12, height: 16 / 12))),
                  ),
                  Positioned(
                    right: 12,
                    top: 130,
                    width: 52,
                    height: 56,
                    child: _o(
                      craneO,
                      Transform.scale(
                        scale: craneS,
                        child: Transform.rotate(
                          angle: craneWiggle,
                          alignment: Alignment.bottomCenter,
                          child: const Align(
                            alignment: Alignment.bottomCenter,
                            child: FoldPuppet(fold: FoldKey.crane, size: 48, locked: true, shadow: false, blink: false),
                          ),
                        ),
                      ),
                    ),
                  ),
                  _sparks(t, glints: [ExGlints(x: 105, y: 153, n: 6, r: 32, at: 3050, colour: ExPaper.volt)]),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Leaf extends StatelessWidget {
  const _Leaf({required this.day, required this.date, required this.paper});
  final String day;
  final int date;
  final ExPaper paper;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: paper.paper, borderRadius: BorderRadius.circular(8)),
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            day,
            style: _hanken(context, 10, w: FontWeight.w600, colour: paper.ink2, height: 12),
          ),
          Text('$date', textHeightBehavior: MmType.figureHeightBehavior, style: _figure(context, 20, paper.ink)),
        ],
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------------
// 6. Stitch a week together: the quest fills, the seal stamps, and only then the needle sews week 4
// (F13); the Mob's heads gather round; below, your own chain with one rested day.
// ---------------------------------------------------------------------------------------------------

class _SlideStitch extends StatelessWidget {
  const _SlideStitch({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  static const double sw = 2350;
  static const double f0 = 500;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final p = ExPaper.of(context);
    final ms = t.ms;
    final r = t.reduced;

    final glowK = r ? 1.0 : seg(ms, 0, 420, MotionCurves.glide);
    final glowO = r ? t.fade(0) : glowK * 0.8;
    final bright = r ? 1.0 : (ms < sw - 300 ? 1.0 : _kf(((ms - sw + 300) / 1400).clamp(0.0, 1.0), const [0, 0.3, 1], const [1, 1.6, 1.2]));
    final (po, pdy, prot) = _swingIn(t, 60);
    final lift = r ? 0.0 : (ms < sw - 200 || ms > sw + 900 ? 0.0 : _kf((ms - sw + 200) / 1100, const [0, 0.25, 0.55, 0.8, 1], const [0, -8, 0, 0, 0]));
    final liftRot = r ? 0.0 : (ms < sw - 200 || ms > sw + 900 ? 0.0 : _kf((ms - sw + 200) / 1100, const [0, 0.25, 0.55, 0.8, 1], const [0, -1.5, 1.2, -0.5, 0]) * _deg);
    final sew = r ? (ms >= t.at(sw) ? 1.0 : 0.0) : seg(ms, sw, MotionDurations.drawIn.inMilliseconds.toDouble(), MotionCurves.inOut);
    final holes = r ? sew : seg(ms, sw + 400, 140);
    final glintK = r ? null : (ms > sw + 460 && ms < sw + 880 ? (ms - sw - 460) / 420 : null);
    final roll = r ? (ms >= t.at(sw + 200) ? 1.0 : 0.0) : seg(ms, sw + 180, 500);

    // The quest: 51 to 60, the bar blooms, folds away, the seal stamps.
    final countK = r ? (ms >= t.at(f0) ? 1.0 : 0.0) : seg(ms, f0, 600);
    final count = (51 + 9 * (1 - (1 - countK) * (1 - countK))).round();
    final barPulse = r || ms < 1180 || ms > 1440 ? 1.0 : 1 + 0.04 * math.sin((ms - 1180) / 260 * math.pi);
    final barOut = r ? seg(ms, 900, 120) : seg(ms, 1620, 200, MotionCurves.leave);
    final sealK = r ? 1.0 : t.spring(1700, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final sealO = r ? seg(ms, 900, 120) : (ms > 1700 ? 1.0 : 0.0);
    final sealRot = r ? 0.0 : (ms < 1700 ? -6.0 : _kf(((ms - 1700) / 520).clamp(0.0, 1.0), const [0, 0.5, 1], const [-6, 2, 0])) * _deg;
    final doneT = t.engrave(1900);
    final doneO = t.engraveO(1900);
    final doneLine = t.fade(2000, 240);
    final (qo, qdy) = t.rise(160);
    final (co, cdy) = t.rise(3050);

    const pennantW = 118.0;
    const scale = pennantW / PennantPainter.width;
    const pennantH = (PennantPainter.height + PennantPainter.hang) * scale;
    final type = context.mmType;
    const ink = Color(0xFF221E17);

    final heads = [(FoldKey.dogear, 3, 56.0, 52.0), (FoldKey.kandil, 2, 56.0, 112.0), (FoldKey.hexa, 0, 304.0, 52.0), (FoldKey.dart, 5, 304.0, 112.0)];

    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        _pos(
          50,
          -50,
          260,
          250,
          _o(
            glowO,
            Transform.scale(
              scale: lerpD(0.7, 1, glowK),
              child: CustomPaint(
                painter: ExPoolPainter(lampA: p.lampA, strength: bright),
              ),
            ),
          ),
        ),
        Positioned(
          left: 180 - pennantW / 2,
          top: 4,
          width: pennantW,
          height: pennantH,
          child: _o(
            po,
            Transform.translate(
              offset: Offset(0, pdy + lift),
              child: Transform.rotate(
                angle: prot + liftRot,
                alignment: Alignment.topCenter,
                child: FittedBox(
                  fit: BoxFit.contain,
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    width: PennantPainter.width,
                    height: PennantPainter.height + PennantPainter.hang,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: CustomPaint(
                            painter: PennantPainter(weeks: ms >= t.at(sw) ? 4 : 3, sew: ms >= t.at(sw) ? sew : 1, holes: ms >= t.at(sw) ? holes : 1, glints: glintK, night: fx.night, volt: c.volt, voltEdge: c.voltEdge),
                          ),
                        ),
                        Positioned(
                          left: 0,
                          right: 0,
                          top: PennantPainter.hang + 14,
                          child: Column(
                            children: [
                              RollNumber(
                                from: 3,
                                to: 4,
                                t: roll,
                                style: type.figureHero.copyWith(fontSize: 76, color: ink),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                MobV3Copy.weeksInARow(4),
                                style: type.label.copyWith(color: ink.withValues(alpha: 0.8), fontSize: 14),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        for (var i = 0; i < heads.length; i++)
          () {
            final (o, s) = t.pop(sw + 650 + i * 45, from: 0.6);
            return _pos(
              heads[i].$3 - 20,
              heads[i].$4,
              40,
              40,
              _o(
                o,
                Transform.scale(
                  scale: s,
                  child: ExHead(fold: heads[i].$1, size: 40, ring: MobColours.of(context, heads[i].$2)),
                ),
              ),
            );
          }(),
        // The quest card.
        _pos(
          16,
          204 + qdy,
          328,
          90,
          _o(
            qo,
            DecoratedBox(
              decoration: ExPaper.card(context),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  children: [
                    Positioned(
                      left: 16,
                      right: 16,
                      top: 14,
                      height: 58,
                      child: _o(
                        1 - barOut,
                        Transform.translate(
                          offset: Offset(0, -10 * barOut),
                          child: Transform(
                            alignment: Alignment.topCenter,
                            transform: Matrix4.diagonal3Values(1, 1 - 0.4 * barOut, 1),
                            child: Stack(
                              children: [
                                Positioned(
                                  left: 0,
                                  top: 2,
                                  child: Text(MobV3Copy.questTitle, style: type.labelLarge.copyWith(color: c.ink)),
                                ),
                                Positioned(
                                  right: 0,
                                  top: -4,
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.baseline,
                                    textBaseline: TextBaseline.alphabetic,
                                    children: [
                                      Text('$count', style: _figure(context, 26, c.ink)),
                                      const SizedBox(width: 4),
                                      Text(MobExplainerCopy.questOf, style: type.caption.copyWith(color: c.ink2)),
                                    ],
                                  ),
                                ),
                                Positioned(
                                  left: 0,
                                  right: 0,
                                  top: 40,
                                  height: 14,
                                  child: Transform.scale(
                                    scale: barPulse,
                                    child: Row(
                                      children: [
                                        for (var i = 0; i < 12; i++) ...[
                                          if (i > 0) const SizedBox(width: 4),
                                          Expanded(
                                            child: _Segment(
                                              fill: i < 10 ? 1 : (r ? t.fade(f0 + (i - 10) * 260 + 200, 120) : seg(ms, f0 + (i - 10) * 260 + 160, 240, MotionCurves.out)),
                                              bloom: r ? 0 : _bloom(ms, 1260 + i * 22.0),
                                              c: c,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 14,
                      top: 13,
                      width: 64,
                      height: 64,
                      child: _o(
                        sealO,
                        Transform.rotate(
                          angle: sealRot,
                          child: Transform.scale(
                            scale: lerpD(1.4, 1, sealK),
                            child: Image.asset(ParcelStills.seal, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 88,
                      top: 22,
                      right: 12,
                      child: _o(
                        doneO,
                        ClipRect(
                          clipper: ExRevealClipper(doneT),
                          child: Text(
                            MobExplainerCopy.questDone,
                            style: type.title.copyWith(fontSize: 20, height: 24 / 20, color: c.ink),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 88,
                      top: 48,
                      right: 12,
                      child: _o(doneLine, Text(MobExplainerCopy.questDoneLine, style: type.caption.copyWith(color: c.ink2))),
                    ),
                    _sparks(t, glints: [ExGlints(x: 46, y: 46, n: 8, r: 36, at: 1850, colour: ExPaper.volt)]),
                  ],
                ),
              ),
            ),
          ),
        ),
        // Your own chain.
        _pos(
          16,
          304 + cdy,
          328,
          96,
          _o(
            co,
            DecoratedBox(
              decoration: ExPaper.card(context),
              child: Stack(
                children: [
                  Positioned(
                    left: 16,
                    top: 12,
                    child: Text(MobExplainerCopy.yourChain, style: type.labelLarge.copyWith(color: c.ink)),
                  ),
                  Positioned(
                    right: 16,
                    top: 6,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text('14', style: _figure(context, 26, c.ink)),
                        const SizedBox(width: 4),
                        Text(MobExplainerCopy.daysInARow, style: type.caption.copyWith(color: c.ink2)),
                      ],
                    ),
                  ),
                  for (var i = 0; i < 7; i++)
                    () {
                      final at = 3250 + i * 70.0;
                      double o;
                      double dy;
                      if (r) {
                        o = t.fade(at);
                        dy = 0;
                      } else if (i == 6) {
                        o = seg(ms, at, 120);
                        dy = -10 * (1 - t.spring(at, MotionSprings.celebrateDuration, MomentCurves.celebrate));
                      } else {
                        final k = seg(ms, at, 300, MotionCurves.out);
                        o = k;
                        dy = -10 * (1 - k);
                      }
                      final rested = i == 4;
                      return Positioned(
                        left: 16 + i * 42.0,
                        top: 40 + dy,
                        width: 36,
                        height: 28,
                        child: _o(
                          o,
                          rested
                              ? CustomPaint(
                                  painter: _DashedRRect(colour: c.ink4, radius: 8),
                                  child: Center(child: Icon(LucideIcons.moon, size: 15, color: c.ink2)),
                                )
                              : DecoratedBox(
                                  decoration: BoxDecoration(color: c.raised2, borderRadius: BorderRadius.circular(8)),
                                  child: Center(child: Icon(LucideIcons.check, size: 15, color: p.good)),
                                ),
                        ),
                      );
                    }(),
                  Positioned(
                    left: 16,
                    top: 72,
                    child: _o(t.fade(3800, 240), Text(MobExplainerCopy.moonLegend, style: type.caption.copyWith(fontSize: 12.5, color: c.ink2))),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  static double _bloom(double ms, double at) {
    if (ms <= at || ms >= at + 420) return 0;
    final k = (ms - at) / 420;
    return k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
  }
}

class _Segment extends StatelessWidget {
  const _Segment({required this.fill, required this.bloom, required this.c});
  final double fill;
  final double bloom;
  final MmColors c;

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: Offset(0, -bloom),
      child: Container(
        height: 14,
        decoration: BoxDecoration(
          color: c.raised2,
          borderRadius: BorderRadius.circular(4),
          boxShadow: bloom > 0 ? [BoxShadow(color: ExPaper.volt.withValues(alpha: 0.28 * bloom), blurRadius: 10)] : null,
        ),
        clipBehavior: Clip.antiAlias,
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: fill.clamp(0.0, 1.0),
          child: ColoredBox(color: c.ink),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// 7. Earned, never bought: the parcel pulls back, wobbles, the seal pops, light leaks and Hop climbs
// out (M9); the shelf shows true silhouettes with their real rules. No rays, no rarity colour (F6).
// ---------------------------------------------------------------------------------------------------

class _SlideShelf extends StatelessWidget {
  const _SlideShelf({required this.t, required this.fx});
  final ExTime t;
  final ExFx fx;

  static const double px = 180;
  static const double ps = 156;
  static const double pt = 88;
  static const double shelfY = 346;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final p = ExPaper.of(context);
    final ms = t.ms;
    final r = t.reduced;
    final rim = pt + ps * 0.5;
    final hopBase = rim + 22;

    final cone = r ? t.fade(0) : seg(ms, 0, 420, MotionCurves.emphasized);
    final bright = r ? 1.0 : (ms < 1000 ? 1.0 : _kf(((ms - 1000) / 1000).clamp(0.0, 1.0), const [0, 0.4, 1], const [1, 1.45, 1.15]));
    final parcelO = t.fade(120, 240);
    // The stills: sealed until 1000, the pop for a beat, then open.
    final sealedO = r ? 1 - seg(ms, t.at(1000), 120) : (ms < 954 ? 1.0 : 1 - seg(ms, 954, 106));
    final popO = r ? 0.0 : (ms < 1000 || ms > 1140 ? 0.0 : _kf((ms - 1000) / 140, const [0, 0.2, 0.7, 1], const [0, 1, 1, 0]));
    final openO = r ? seg(ms, t.at(1000), 120) : (ms < 1089 ? 0.0 : seg(ms, 1089, 11));
    final wob = r || ms < 420 || ms > 1200 ? null : (ms - 420) / 780;
    final pScale = wob == null ? 1.0 : _kf(wob, const [0, 0.16, 0.38, 0.6, 0.78, 0.9, 1], const [1, 0.94, 0.97, 0.97, 0.97, 1.05, 1]);
    final pRot = wob == null ? 0.0 : _kf(wob, const [0, 0.16, 0.38, 0.6, 0.78, 1], const [0, 0, -3, 3, 0, 0]) * _deg;
    final leak = r ? 0.0 : (ms < 880 ? 0.0 : _kf(((ms - 880) / 900).clamp(0.0, 1.0), const [0, 0.35, 1], const [0, 1, 0.6]));
    final leakS = r ? 1.0 : (ms < 880 ? 0.6 : _kf(((ms - 880) / 900).clamp(0.0, 1.0), const [0, 0.35, 1], const [0.6, 1.1, 1]));
    final hopK = r ? 1.0 : t.spring(1180, MotionSprings.celebrateDuration, MomentCurves.celebrate);
    final hopO = r ? t.fade(1200) : (ms > 1180 ? 1.0 : 0.0);
    final (hsx, hsy) = t.squash(1600);
    final name = t.engrave(1600);
    final nameO = t.engraveO(1600);
    final (lineO, lineDy) = t.rise(1760, dy: 8);
    final plank = t.fade(2100, 240);
    const silhouettes = [FoldKey.crane, FoldKey.stamp, FoldKey.patang, FoldKey.sticky];

    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: ExLampPainter(cx: 180, coneW: 280, coneH: 274, lampA: p.lampA, cone: r ? cone : lerpD(0.5, 1, cone), scaleX: r ? 1 : lerpD(1.3, 1, cone), bright: bright),
          ),
        ),
        _pos(
          px - 110,
          pt + 30,
          220,
          110,
          _o(
            leak,
            Transform.scale(
              scale: leakS,
              child: CustomPaint(painter: ExPoolPainter(lampA: p.lampA, strength: 1.4)),
            ),
          ),
        ),
        _pos(
          px - ps / 2,
          pt,
          ps,
          ps,
          _o(
            parcelO,
            Transform.rotate(
              angle: pRot,
              alignment: const Alignment(0, 0.8),
              child: Transform.scale(
                scale: pScale,
                alignment: const Alignment(0, 0.8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _o(sealedO, Image.asset(ParcelStills.sealed, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                    _o(popO, Image.asset(ParcelStills.pop, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                    _o(openO, Image.asset(ParcelStills.open, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                  ],
                ),
              ),
            ),
          ),
        ),
        // Hop climbs out, clipped at the box's rim.
        Positioned.fill(
          child: ClipPath(
            clipper: const _AboveParcelRim(left: px - ps / 2, top: pt, size: ps),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                ...exFold(
                  fold: FoldKey.hop,
                  x: px + 4,
                  base: hopBase,
                  size: 104,
                  pose: FoldPose.cheer,
                  large: true,
                  shadow: false,
                  move: ExMove(o: hopO, dy: 96 * (1 - hopK), sx: hsx, sy: hsy),
                  breathe: ms >= ExSlides.lengthMs[6] - 1 && !r,
                  phase: 17,
                  night: fx.night,
                ),
              ],
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: pt + ps + 2,
          child: _o(
            nameO,
            ClipRect(
              clipper: ExRevealClipper(name),
              child: Text(
                MobExplainerCopy.hop,
                textAlign: TextAlign.center,
                style: context.mmType.headline.copyWith(fontSize: 24, height: 28 / 24, color: c.ink),
              ),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: pt + ps + 32 + lineDy,
          child: _o(
            lineO,
            Text(
              MobV3Copy.foldLine(FoldKey.hop),
              textAlign: TextAlign.center,
              style: context.mmType.small.copyWith(color: c.ink2),
            ),
          ),
        ),
        _sparks(
          t,
          bursts: [ExBurst(x: px, y: rim - 10, n: fx.bits(22), at: 1200, floor: pt + ps - 22, seed: 31, up: 220)],
          glints: [const ExGlints(x: px, y: 116, n: 6, r: 74, at: 1350)],
        ),
        // The shelf.
        _pos(
          16,
          shelfY,
          328,
          6,
          _o(
            plank,
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(3),
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [p.back, Color.lerp(p.back, Colors.black, 0.3)!]),
              ),
            ),
          ),
        ),
        for (var i = 0; i < 4; i++)
          () {
            final x = 58 + i * 81.0;
            final (o, s) = t.pop(2200 + i * 90.0);
            return _pos(
              x - 30,
              shelfY - 46,
              60,
              46,
              _o(
                o,
                Transform.scale(
                  scale: s,
                  alignment: Alignment.bottomCenter,
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: FoldPuppet(fold: silhouettes[i], size: 44, locked: true, shadow: false, blink: false),
                  ),
                ),
              ),
            );
          }(),
        for (var i = 0; i < 4; i++)
          _pos(
            58 + i * 81.0 - 40,
            shelfY + 12,
            80,
            40,
            _o(
              t.fade(2300 + i * 90.0, 240),
              Text(
                MobExplainerCopy.shelfRules[i],
                textAlign: TextAlign.center,
                style: _hanken(context, 12.5, w: FontWeight.w500, colour: c.ink2, height: 16),
              ),
            ),
          ),
      ],
    );
  }
}

/// Keeps Hop above the open parcel's front rim (the still's own rim line, RevealGeo.frontRim), so the
/// boots stand inside the box and the paper edge in front of them is the art's.
class _AboveParcelRim extends CustomClipper<Path> {
  const _AboveParcelRim({required this.left, required this.top, required this.size});
  final double left;
  final double top;
  final double size;

  @override
  Path getClip(Size s) {
    final rim = RevealGeo.frontRim.take(5).toList();
    Offset at(Offset f) => Offset(left + f.dx * size, top + (f.dy + 0.02) * size);
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(s.width, 0)
      ..lineTo(s.width, at(rim.last).dy);
    for (final o in rim.reversed) {
      final q = at(o);
      path.lineTo(q.dx, q.dy);
    }
    return path
      ..lineTo(0, at(rim.first).dy)
      ..close();
  }

  @override
  bool shouldReclip(_AboveParcelRim old) => old.left != left || old.top != top || old.size != size;
}
