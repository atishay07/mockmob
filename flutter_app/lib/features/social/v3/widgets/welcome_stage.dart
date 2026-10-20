// The Mob welcome's room (owner, 20 Oct 11:20 pm; V16-PLAN A3): the den as den_stage.dart paints it (the same room
// art, ground fades and lamp pool, Night and Day), dark at first, then the lamp, three friends and the pennant.
//
// One timeline in ms ([WelcomeTimeline]); the stage is a pure function of it, so the screen, the frame strips and the
// tests read the same frames. MOB-MINIMAL 4.2 is the motion language:
//   0      the lamp's bulb comes on (150 ms), then its beam (300 ms) cuts the dark down to the floor; the room comes
//          up behind it (from 380 ms over 700 ms on glide);
//   500    Riya, Kabir and Zoya hop in from the edges 350 ms apart (JoinAct: two hops, a landing squash 1.12/0.86 for
//          90 ms, the name engraves, the others glance at the newcomer, the newcomer waves);
//   2000   the fourth seat stands up off the floor once, "Open seat";
//   2300   the pennant drops onto the wall and swings to rest, one volt stitch;
//   then the screen's words and keys (mob_welcome_screen.dart).
// Reduced motion: the lamp fades in 120 ms, each Fold cross-fades in its seat (120 ms, in the same order), no hops.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/motion/motion.dart' show Motion;
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'den_motion.dart';
import 'den_stage.dart' show DenFade, DenLampPool, DenSeatOutline, DenShadowEllipse, EnterDen, denRoomArt;
import 'fold_puppet.dart';
import 'pennant.dart';

/// The welcome's friends, left to right on the floor, and where each one comes from. Three Folds that read apart at
/// a glance in both themes: a slim red kite, a round teal frog, an angular lilac crane.
abstract final class WelcomeCast {
  static const List<FoldKey> folds = [FoldKey.patang, FoldKey.hop, FoldKey.crane];

  /// Floor slots (of four): Riya 0, Kabir 1, the open seat 2, Zoya 3.
  static const List<int> slots = [0, 1, 3];
  static const int seatSlot = 2;

  /// Riya comes in from the left edge; Kabir and Zoya from the right (nobody hops over a Fold already standing).
  static const List<bool> fromLeft = [true, false, false];

  /// How much higher than the act's own hops each one jumps: Kabir leaps across half the room.
  static const List<double> hopLift = [1.0, 1.5, 1.0];
}

/// The welcome's timeline (ms). Every value is a pure function of the time.
abstract final class WelcomeTimeline {
  static const double bulbLength = 150;
  static const double beamAt = 150;
  static const double beamLength = 300;
  static const double roomAt = 380;
  static const double roomLength = 700;
  static const double foldsAt = 500;
  static const double foldStep = 350;
  static const double seatAt = 2000;
  static const double seatLength = 420;
  static const double pennantAt = 2300;
  static const double pennantDrop = 280;
  static const double headlineAt = 2800;
  static const double headlineLength = 420;
  static const double ledeAt = 2950;
  static const double ledeLength = 360;
  static const double keysAt = 3400;
  static const double keysLength = 300;

  /// The quiet Skip key shows from here until the keys arrive.
  static const double skipAt = 600;

  /// The motion's end: Zoya's wave is done at 3500, the keys are in at 3700.
  static const double total = 3800;

  /// Any tap (or Skip) lands the end state in this long.
  static const Duration finish = Duration(milliseconds: 200);

  /// Reduced motion: the same order, each step a 120 ms fade.
  static const double reducedStep = 120;
  static const double reducedFoldsAt = 200;
  static const double reducedSeatAt = 560;
  static const double reducedPennantAt = 680;
  static const double reducedWordsAt = 800;
  static const double reducedKeysAt = 1000;
  static const double reducedTotal = 1200;

  static double totalFor({required bool reduced}) => reduced ? reducedTotal : total;

  /// When Fold [i] starts to come in.
  static double foldStart(int i, {bool reduced = false}) => reduced ? reducedFoldsAt + reducedStep * i : foldsAt + foldStep * i;

  /// When Fold [i] touches down (its light haptic).
  static double landing(int i) => foldStart(i) + JoinAct.land;

  /// The lamp's bulb and beam, 0 to 1.
  static double bulb(double ms, {bool reduced = false}) => reduced ? windowOf(ms, 0, reducedStep) : windowOf(ms, 0, bulbLength, MotionCurves.glide);
  static double beam(double ms, {bool reduced = false}) => reduced ? windowOf(ms, 0, reducedStep) : windowOf(ms, beamAt, beamLength, MotionCurves.out);

  /// The room's light (0 dark, 1 as the den draws it).
  static double room(double ms, {bool reduced = false}) => reduced ? windowOf(ms, 0, reducedStep) : windowOf(ms, roomAt, roomLength, MotionCurves.glide);

  /// Fold [i]'s frame: the friend-joins act (4.2) from its start, or its reduced cross-fade.
  static ActFrame fold(int i, double ms, {required double fromDx, bool reduced = false}) => JoinAct.at(
    ms - foldStart(i, reduced: reduced),
    fromDx: fromDx,
    reduced: reduced,
  );

  /// Where Fold [i]'s eyes turn (-1 left .. 1 right): toward each later friend as they land and wave.
  static double look(int i, double ms, {bool reduced = false}) {
    if (reduced) return 0;
    var out = 0.0;
    for (var j = i + 1; j < WelcomeCast.slots.length; j++) {
      final g = JoinAct.at(ms - foldStart(j), fromDx: 0).glance;
      if (g > 0) out = (WelcomeCast.slots[j] > WelcomeCast.slots[i] ? 1.0 : -1.0) * g;
    }
    return out;
  }

  /// The open seat standing up off the floor, 0 (flat) to 1.
  static double seat(double ms, {bool reduced = false}) => reduced ? windowOf(ms, reducedSeatAt, reducedStep) : windowOf(ms, seatAt, seatLength, MotionCurves.emphasized);

  /// The seat's tag, after it stands.
  static double seatTag(double ms, {bool reduced = false}) => reduced ? seat(ms, reduced: true) : windowOf(ms, seatAt + 240, 280);

  /// The pennant: (opacity, drop dy, swing radians). It falls 56 dp onto its pin, then sways to rest.
  static (double, double, double) pennant(double ms, {bool reduced = false}) {
    if (reduced) return (windowOf(ms, reducedPennantAt, reducedStep), 0, 0);
    final fall = windowOf(ms, pennantAt, pennantDrop, Curves.easeInQuad);
    final landed = pennantAt + pennantDrop;
    final angle = ms < landed ? EnterDen.pennantKeys.first * math.pi / 180 : EnterDen.pennantAngle(EnterDen.pennantAt + (ms - landed));
    return (windowOf(ms, pennantAt, 120), -56 * (1 - fall), angle);
  }

  /// The headline: (opacity, rise dp). It rises 10 dp.
  static (double, double) headline(double ms, {bool reduced = false}) {
    if (reduced) return (windowOf(ms, reducedWordsAt, reducedStep), 0);
    final v = windowOf(ms, headlineAt, headlineLength, MotionCurves.emphasized);
    return (windowOf(ms, headlineAt, 240), 10 * (1 - v));
  }

  static (double, double) lede(double ms, {bool reduced = false}) {
    if (reduced) return (windowOf(ms, reducedWordsAt, reducedStep), 0);
    final v = windowOf(ms, ledeAt, ledeLength, MotionCurves.emphasized);
    return (windowOf(ms, ledeAt, 240), 8 * (1 - v));
  }

  static (double, double) keys(double ms, {bool reduced = false}) {
    if (reduced) return (windowOf(ms, reducedKeysAt, reducedStep), 0);
    final v = windowOf(ms, keysAt, keysLength, MotionCurves.emphasized);
    return (windowOf(ms, keysAt, 200), 8 * (1 - v));
  }

  /// The keys take taps once they are mostly in.
  static bool keysLive(double ms, {bool reduced = false}) => keys(ms, reduced: reduced).$1 >= 0.5;

  /// Skip shows from 600 ms until the keys arrive (never under reduced motion: it is over in a second).
  static bool skipShown(double ms, {bool reduced = false}) => !reduced && ms >= skipAt && ms < keysAt;
}

/// The room at [ms]: [height] tall, the floor [floorGap] above its foot (the name tags sit in it).
class WelcomeStage extends StatelessWidget {
  const WelcomeStage({super.key, required this.ms, required this.height, this.idle = false, this.reduced});

  final double ms;
  final double height;

  /// Breathe and blink once the motion is over.
  final bool idle;

  /// Null reads [Motion.reduced].
  final bool? reduced;

  static const double floorGap = 54;

  /// The Fold's height: 76 dp at 360 wide, 84 from 400.
  static double foldSize(double width) => width >= 400 ? 84 : 76;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final night = colors.isNight;
    final low = reduced ?? Motion.reduced(context);
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = height;
        final bootsY = h - floorGap;
        final size = foldSize(w);
        const side = MmSpace.gutter;
        final slotW = (w - 2 * side) / 4;
        double centreOf(int slot) => side + slotW * (slot + 0.5);
        // The art as the den lays it (the lamp pool, art 790, 810 of 1536 x 1024, under the boots), a little closer: the
        // welcome is the room's first impression, so it fills more of the screen.
        final s = w / 960;
        final artLeft = w / 2 - 790 * s;
        final artTop = bootsY - 810 * s;
        final floorTop = math.min(h, artTop + 860 * s);
        final beam = WelcomeTimeline.beam(ms, reduced: low);
        final room = WelcomeTimeline.room(ms, reduced: low);
        final bulb = WelcomeTimeline.bulb(ms, reduced: low);
        // The floor lamp's bulb under its shade, and its pool on the floor (art coordinates).
        final bulbAt = Offset(artLeft + 624 * s, artTop + 222 * s);
        final pool = Offset(artLeft + 790 * s, bootsY - 2);
        final seatW = math.min(slotW - 6, size * 0.66);
        final (pennantO, pennantDy, pennantA) = WelcomeTimeline.pennant(ms, reduced: low);
        final seatV = WelcomeTimeline.seat(ms, reduced: low);
        final tagStyle = context.mmType.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700);
        final seatStyle = context.mmType.label.copyWith(color: colors.ink3, fontWeight: FontWeight.w600);

        final frames = [
          for (var i = 0; i < WelcomeCast.slots.length; i++)
            WelcomeTimeline.fold(i, ms, reduced: low, fromDx: WelcomeCast.fromLeft[i] ? -(centreOf(WelcomeCast.slots[i]) + size * 0.5) : w + size * 0.5 - centreOf(WelcomeCast.slots[i])),
        ];
        double lift(int i) => WelcomeCast.hopLift[i];

        return SizedBox(
          height: h,
          child: Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned.fill(child: ColoredBox(color: colors.ground)),
              // The room, its fades and the lamp pool, as the den paints them.
              Positioned(
                left: artLeft,
                top: artTop,
                width: 1536 * s,
                height: 1024 * s,
                child: Image.asset(denRoomArt(night), fit: BoxFit.fill, filterQuality: FilterQuality.medium, gaplessPlayback: true, errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: artTop - 2,
                height: 44 * s + 30,
                child: DenFade(colour: colors.ground, down: false),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: floorTop - 48,
                height: 48,
                child: DenFade(colour: colors.ground, down: true),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: floorTop,
                bottom: 0,
                child: ColoredBox(color: colors.ground),
              ),
              Positioned.fill(
                child: CustomPaint(
                  painter: DenLampPool(centre: pool, width: w, strength: 0.25 + 0.75 * beam, night: night),
                ),
              ),
              // The dark the lamp cuts through, and the bulb.
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(
                    painter: WelcomeLightPainter(
                      bulbAt: bulbAt,
                      pool: pool,
                      poolRx: math.min(w * 0.46, 260.0),
                      scale: s,
                      bulb: bulb,
                      beam: beam,
                      room: room,
                      night: night,
                      dark: WelcomeLightPainter.darkOf(colors),
                      lamp: colors.lamp,
                    ),
                  ),
                ),
              ),
              // The pennant on the wall, right, above the desk.
              Positioned(
                left: w - side - 6 - 58,
                // Hung on the wall above the desk (art y 452), clear of its top.
                top: bootsY - 358 * s - 116,
                child: Opacity(
                  opacity: pennantO.clamp(0.0, 1.0),
                  child: Transform.translate(
                    offset: Offset(0, pennantDy),
                    child: Transform.rotate(
                      angle: pennantA,
                      alignment: Alignment.topCenter,
                      child: Pennant(weeks: 1, stitch: PennantPaper.stitch(context)),
                    ),
                  ),
                ),
              ),
              // Shadows travel with their Fold and shrink as it rises.
              for (var i = 0; i < frames.length; i++)
                Positioned(
                  left: centreOf(WelcomeCast.slots[i]) - size * 0.4 + frames[i].dx,
                  top: bootsY - size * 0.05,
                  width: size * 0.8,
                  height: size * 0.1,
                  child: CustomPaint(
                    painter: DenShadowEllipse(opacity: frames[i].opacity.clamp(0.0, 1.0), scale: 1 - 0.4 * (-frames[i].dy * lift(i) / 26).clamp(0.0, 1.0), night: night),
                  ),
                ),
              // The open seat stands up off the floor once.
              Positioned(
                left: centreOf(WelcomeCast.seatSlot) - seatW / 2,
                top: bootsY - size * 0.9,
                width: seatW,
                height: size * 0.9,
                child: Opacity(
                  opacity: (low ? seatV : windowOf(seatV, 0, 0.25)).clamp(0.0, 1.0),
                  child: low
                      ? const DenSeatOutline()
                      : Transform(
                          alignment: Alignment.bottomCenter,
                          transform: Matrix4.identity()
                            ..setEntry(3, 2, 0.003)
                            ..rotateX(-(1 - seatV) * 1.35),
                          child: const DenSeatOutline(),
                        ),
                ),
              ),
              Positioned(
                left: centreOf(WelcomeCast.seatSlot) - slotW / 2 + 2,
                width: slotW - 4,
                top: bootsY + 6,
                child: Opacity(
                  opacity: WelcomeTimeline.seatTag(ms, reduced: low).clamp(0.0, 1.0),
                  child: Text(MobWelcomeCopy.openSeat, textAlign: TextAlign.center, maxLines: 2, style: seatStyle),
                ),
              ),
              // The Folds.
              for (var i = 0; i < frames.length; i++)
                Positioned(
                  key: ValueKey('welcome-fold-$i'),
                  left: centreOf(WelcomeCast.slots[i]) - size,
                  width: size * 2,
                  top: bootsY - size,
                  height: size,
                  child: Center(
                    child: ActTransform(
                      frame: ActFrame(dx: frames[i].dx, dy: frames[i].dy * lift(i), scaleX: frames[i].scaleX, scaleY: frames[i].scaleY, opacity: frames[i].opacity),
                      child: FoldPuppet(
                        fold: WelcomeCast.folds[i],
                        size: size,
                        pose: frames[i].pose,
                        breathe: idle,
                        blink: idle,
                        phase: i,
                        shadow: false,
                        fallbackName: MobWelcomeCopy.names[i],
                        acting: !idle,
                        look: low ? null : AlwaysStoppedAnimation<double>(WelcomeTimeline.look(i, ms)),
                      ),
                    ),
                  ),
                ),
              // Their names engrave as they land.
              for (var i = 0; i < frames.length; i++)
                Positioned(
                  left: centreOf(WelcomeCast.slots[i]) - slotW / 2 + 2,
                  width: slotW - 4,
                  top: bootsY + 6,
                  child: Opacity(
                    opacity: frames[i].name.clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, 4 * (1 - frames[i].name)),
                      child: Text(MobWelcomeCopy.names[i], textAlign: TextAlign.center, maxLines: 2, style: tagStyle),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// The welcome's light over the room: a dark that lifts as the room comes up, with the lamp's beam cut through it
/// (a soft cone from the bulb to its pool on the floor) and the bulb's glow on top.
class WelcomeLightPainter extends CustomPainter {
  WelcomeLightPainter({
    required this.bulbAt,
    required this.pool,
    required this.poolRx,
    required this.scale,
    required this.bulb,
    required this.beam,
    required this.room,
    required this.night,
    required this.dark,
    required this.lamp,
  });

  final Offset bulbAt;
  final Offset pool;
  final double poolRx;
  final double scale;
  final double bulb;
  final double beam;
  final double room;
  final bool night;
  final Color dark;
  final Color lamp;

  /// The dark at the start: near black at Night, a warm dusk in Day.
  static double depthFor({required bool night}) => night ? 0.93 : 0.74;

  /// The dark's colour: the Night ground, a warm brown in Day.
  static Color darkOf(MmColors colors) => colors.isNight ? colors.ground : const Color(0xFF3B2F24);

  /// How dark the room still is at [room] (0 dark .. 1 lit); the screen dims what lies under the room with it.
  static double darknessAt(double room, {required bool night}) => depthFor(night: night) * (1 - room);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final darkness = darknessAt(room, night: night);
    if (darkness > 0.002) {
      canvas.saveLayer(rect, Paint());
      canvas.drawRect(rect, Paint()..color = dark.withValues(alpha: darkness));
      if (beam > 0) {
        // The cone: from the shade's mouth down to the pool's width on the floor.
        final s = scale;
        final cone = Path()
          ..moveTo(bulbAt.dx - 70 * s, bulbAt.dy + 6 * s)
          ..lineTo(bulbAt.dx + 74 * s, bulbAt.dy - 2 * s)
          ..lineTo(pool.dx + poolRx * 0.95, pool.dy)
          ..lineTo(pool.dx - poolRx * 0.95, pool.dy)
          ..close();
        // Day cuts softer and keeps the pool flat on the floor, so the bright ground under the art never shows as a blot.
        final cut = Paint()
          ..blendMode = BlendMode.dstOut
          ..color = Colors.black.withValues(alpha: (night ? 0.82 : 0.62) * beam)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, (night ? 14 : 20) * s + 4);
        canvas.drawPath(cone, cut);
        canvas.drawOval(Rect.fromCenter(center: pool, width: poolRx * (night ? 2.1 : 1.8), height: poolRx * (night ? 0.55 : 0.28)), cut);
      }
      canvas.restore();
    }
    if (bulb > 0) {
      // The bulb's glow: strong in the dark, a warm point once the room is up.
      final glow = bulb * (0.5 + 0.5 * (1 - room));
      final r = 46 * scale + 18;
      canvas.drawCircle(
        bulbAt,
        r,
        Paint()
          ..shader = RadialGradient(
            colors: [
              lamp.withValues(alpha: (night ? 0.75 : 0.55) * glow),
              lamp.withValues(alpha: (night ? 0.22 : 0.14) * glow),
              lamp.withValues(alpha: 0),
            ],
            stops: const [0, 0.35, 1],
          ).createShader(Rect.fromCircle(center: bulbAt, radius: r)),
      );
      canvas.drawCircle(bulbAt, 3.2, Paint()..color = Color.lerp(lamp, Colors.white, 0.6)!.withValues(alpha: bulb * (night ? 0.95 : 0.7)));
    }
  }

  @override
  bool shouldRepaint(WelcomeLightPainter old) =>
      old.bulb != bulb ||
      old.beam != beam ||
      old.room != room ||
      old.bulbAt != bulbAt ||
      old.pool != pool ||
      old.night != night ||
      old.dark != dark ||
      old.lamp != lamp ||
      old.poolRx != poolRx ||
      old.scale != scale;
}
