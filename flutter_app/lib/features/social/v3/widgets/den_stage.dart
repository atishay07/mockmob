// The den's lamp-lit room (spec 5.3 D1 to D6, 5.4 layers, 5.5 sizes, 5.6 M1).
//
// Layers, back to front, each on its own RepaintBoundary (5.4):
//   1 ground and grain, 2 the room art (`scene-empty-nothing-{night,day}.webp`), 3 the lamp light field
//   (a painted radial pool: lamp 26% Night, 17% Day), 4 the floor (the art fades into the ground under
//   the pool), 5 Fold shadows, 6 Folds, 7 name tags, 8 the pennant and the shelf, 9 sticker flights.
//   Cards and chrome (10) belong to the screen.
//
// Every M1 value reads one timeline in milliseconds ([DenStage.ms]); the screen drives it. Only
// transform and opacity animate, except the light field. The room box spans the header too: the art
// sits behind the status bar and the header, and the stage proper ([stageTop] .. + [stageHeight]) holds
// the Folds.
//
// Privacy (F2): nothing under a Fold but its name. No played tag, no dimmed Fold, no count.

import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/motion/springs.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'den_motion.dart';
import 'fold_puppet.dart';
import 'pennant.dart';
import 'sticker_row.dart';

/// The room art, by theme.
String denRoomArt(bool night) => night ? 'assets/art/scene-empty-nothing-night.webp' : 'assets/art/scene-empty-nothing-day.webp';

/// Sizes from spec 5.5: the stage is 280 dp at 360 (300 from 400 wide); Folds 72 (64 with 5 members),
/// 80 from 400 wide (72 with 5).
abstract final class DenSizes {
  static double stageHeight(double width) => width >= 400 ? 300 : 280;
  static double foldSize(double width, int members) {
    if (width >= 400) return members >= 5 ? 72 : 80;
    return members >= 5 ? 64 : 72;
  }

  /// From the stage's foot to the boots: room for two lines of tags at 1.3x.
  static const double tagBand = 52;
}

/// The M1 timeline (ms) as the spec gives it.
abstract final class EnterDen {
  static const double total = 1100;
  static const double lampLength = 420;
  static const double roomAt = 120;
  static const double roomLength = 360;
  static const double pennantAt = 160;
  static const double pennantLength = 900;
  static const double foldsAt = 200;
  static const double foldStep = 90;
  static const double foldLength = 360;
  static const double shadowLag = 60;
  static const double tagsAt = 420;
  static const double tagsLength = 280;
  static const double cardAt = 420;
  static const double cardLength = 360;
  static const double questAt = 465;
  static const double idleAt = 700;
  static const double rise = 14;

  /// How long Enter the den waits on its first frame for the room art to decode.
  static const Duration waitForArt = Duration(milliseconds: 450);

  static final Curve _pop = SpringCurve(Springs.iconPop, settle: MotionSprings.iconPopDuration);

  /// The lamp pool's strength (0.6 to 1) and the dim over the room (62% to 0), glide 420.
  static double lamp(double ms) => 0.6 + 0.4 * windowOf(ms, 0, lampLength, MotionCurves.glide);
  static double dim(double ms) => 0.62 * (1 - windowOf(ms, 0, lampLength, MotionCurves.glide));

  /// The room rises 14 dp from 120 on emphasized 360.
  static double roomDy(double ms) => rise * (1 - windowOf(ms, roomAt, roomLength, MotionCurves.emphasized));

  /// The swing's turning points in degrees: it comes in from 4.8 and sways -2.4, +1.2, -0.4 to rest
  /// (the spec's decaying 2.4, 1.2, 0.4 after a first swing). At 2.4 alone the tip
  /// moved about 3 dp and the device walk saw no swing (M3, 19 Oct night).
  static const List<double> pennantKeys = [4.8, -2.4, 1.2, -0.4, 0.0];

  /// The pennant swings in from 160 on a decaying sway, on `out` over 900 ms.
  static double pennantAngle(double ms) {
    const keys = pennantKeys;
    if (ms < pennantAt) return keys.first * math.pi / 180;
    // Even half-swings (a pendulum keeps its period while it decays): linear time, each half eased.
    final p = windowOf(ms, pennantAt, pennantLength);
    final n = keys.length - 1;
    final x = p * n;
    final i = x.floor().clamp(0, n - 1);
    final f = x - i;
    final eased = 0.5 - 0.5 * math.cos(math.pi * f);
    return (keys[i] + (keys[i + 1] - keys[i]) * eased) * math.pi / 180;
  }

  static double pennantOpacity(double ms) => windowOf(ms, pennantAt, 160);

  /// Fold [i] in join order: (opacity, rise dp, scale).
  static (double, double, double) fold(double ms, int i) {
    final at = foldsAt + foldStep * i;
    final v = windowOf(ms, at, foldLength, _pop);
    return (windowOf(ms, at, 120), rise * (1 - v), 0.92 + 0.08 * v);
  }

  /// Fold [i]'s shadow settles 60 ms after the Fold: (opacity, scale).
  static (double, double) shadow(double ms, int i) {
    final at = foldsAt + foldStep * i + shadowLag;
    final v = windowOf(ms, at, foldLength - shadowLag, MotionCurves.out);
    return (v, 0.6 + 0.4 * v);
  }

  /// A rising block (card at 420, quest strip at 465): (opacity, rise dp).
  static (double, double) block(double ms, double at) {
    final v = windowOf(ms, at, cardLength, MotionCurves.emphasized);
    return (windowOf(ms, at, 200), rise * (1 - v));
  }
}

/// One slot on the floor: a member's Fold or an open seat.
class _Slot {
  const _Slot.member(this.member, this.index) : seat = false;
  const _Slot.seat(this.index) : member = null, seat = true;

  final MobV3Member? member;
  final int index;
  final bool seat;
}

class DenStage extends ConsumerWidget {
  const DenStage({
    super.key,
    required this.v3,
    required this.roomHeight,
    required this.stageTop,
    required this.ms,
    this.idle = false,
    this.skeleton = false,
    this.flights = const [],
    this.onFlightDone,
    this.onPennant,
    this.onShelf,
    this.onOpenSeat,
    this.titleWidth = 0,
    this.now,
  });

  /// Null with [skeleton] (D6: the room and the lamp, no Folds).
  final MobV3? v3;

  /// The whole room box, header included.
  final double roomHeight;

  /// Where the stage proper starts in the room box (under the header's first row).
  final double stageTop;

  /// The M1 timeline in ms (1100 or more is the end state).
  final ValueListenable<double> ms;

  /// Idle loops (breathe and blink) may run.
  final bool idle;
  final bool skeleton;

  /// Stickers flying from a member's Fold (M12), at most 3.
  final List<StickerSend> flights;
  final void Function(int id)? onFlightDone;
  final VoidCallback? onPennant;
  final VoidCallback? onShelf;
  final VoidCallback? onOpenSeat;

  /// Room the screen's title block takes at the stage's top left (the shelf sits under it).
  final double titleWidth;

  /// The den's clock (the studying desk's "since" reads the server's time, not this).
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final stageH = DenSizes.stageHeight(w);
        final bootsY = stageTop + stageH - DenSizes.tagBand;
        final all = v3?.members ?? const <MobV3Member>[];
        // Studying now (D171, 4.2): a sharing member with a practice answer in the last 10 minutes stands on the
        // desk under the lamp, not on the floor. Real presence only (`v3.hours.studying_now`); one at a time.
        StudyingNow? studying;
        MobV3Member? studier;
        for (final st in v3?.hours?.studyingNow ?? const <StudyingNow>[]) {
          for (final m in all) {
            if (m.memberId == st.memberId && !m.you && all.length > 1) {
              studying = st;
              studier = m;
              break;
            }
          }
          if (studier != null) break;
        }
        final members = [for (final m in all) if (m != studier) m];
        final size = DenSizes.foldSize(w, members.length);
        // A Mob of one stands you in the middle of the lamp pool with two open seats each side (L4, 19 Oct
        // night walk: at the left edge your Fold stood outside the light).
        final alone = members.length == 1 && !skeleton;
        final slots = alone
            ? <_Slot>[const _Slot.seat(0), const _Slot.seat(1), _Slot.member(members.first, 2), const _Slot.seat(3), const _Slot.seat(4)]
            : <_Slot>[
                for (var i = 0; i < members.length; i++) _Slot.member(members[i], i),
                if (!skeleton && all.length < 5)
                  for (var i = members.length; i < members.length + 5 - all.length; i++) _Slot.seat(i),
              ];
        int? posOf(String memberId) {
          for (final sl in slots) {
            if (sl.member?.memberId == memberId) return sl.index;
          }
          return null;
        }
        // A Mob of one shows its four seats under one caption; a fuller Mob tags its one or two seats.
        final oneCaption = all.length <= 1;
        const side = MmSpace.gutter;
        final slotW = slots.isEmpty ? 0.0 : (w - 2 * side) / slots.length;
        double centreOf(int i) => side + slotW * (i + 0.5);

        // The art: the lamp pool (art 790, 810 of 1536 x 1024) lands under the Folds' boots, centred.
        final s = w / 1060;
        final artLeft = w / 2 - 790 * s;
        final artTop = bootsY - 810 * s;
        final night = colors.isNight;

        return SizedBox(
          height: roomHeight,
          child: Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              // 1 ground.
              Positioned.fill(child: ColoredBox(color: colors.ground)),
              // 2 to 4: the room, its light and the floor, rising together (M1 at 120).
              Positioned.fill(
                child: RepaintBoundary(
                  child: ValueListenableBuilder<double>(
                    valueListenable: ms,
                    builder: (context, t, _) => Transform.translate(
                      offset: Offset(0, EnterDen.roomDy(t)),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned(
                            left: artLeft,
                            top: artTop,
                            width: 1536 * s,
                            height: 1024 * s,
                            child: Image.asset(denRoomArt(night), fit: BoxFit.fill, filterQuality: FilterQuality.medium, gaplessPlayback: true, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                          ),
                          // The art's own soft edges fade into the ground (top) and become the floor (bottom).
                          Positioned(
                            left: 0,
                            right: 0,
                            top: artTop - 2,
                            height: 44 * s + 30,
                            child: _Fade(colour: colors.ground, down: false),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            top: math.min(roomHeight, artTop + 860 * s) - 48,
                            height: 48,
                            child: _Fade(colour: colors.ground, down: true),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            top: math.min(roomHeight, artTop + 860 * s),
                            bottom: -20,
                            child: ColoredBox(color: colors.ground),
                          ),
                          // 3 the lamp light field over the pool.
                          Positioned.fill(
                            child: CustomPaint(
                              painter: _LampPool(centre: Offset(w / 2, bootsY - 4), width: w, strength: EnterDen.lamp(t), night: night),
                            ),
                          ),
                          // The dim the room comes up from (62% to 0).
                          if (EnterDen.dim(t) > 0.001)
                            Positioned.fill(
                              child: ColoredBox(color: colors.ground.withValues(alpha: EnterDen.dim(t))),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              // Day: the header sits over the bright room on a 40% ground scrim (5.5).
              if (!night)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: stageTop + 64,
                  child: _Scrim(colour: colors.ground),
                ),
              if (skeleton)
                ..._skeleton(context, w, bootsY)
              else if (v3 != null) ...[
                // 5 Fold shadows.
                for (final slot in slots)
                  if (!slot.seat)
                    Positioned(
                      left: centreOf(slot.index) - size * 0.4,
                      top: bootsY - size * 0.05,
                      width: size * 0.8,
                      height: size * 0.1,
                      child: RepaintBoundary(
                        child: _FoldShadow(ms: ms, index: slot.index, night: night),
                      ),
                    ),
                // 6 Folds and open seats.
                for (final slot in slots)
                  if (slot.seat)
                    Positioned(
                      left: centreOf(slot.index) - math.min(slotW - 6, size * 0.66) / 2,
                      top: bootsY - size * 0.9,
                      width: math.min(slotW - 6, size * 0.66),
                      height: size * 0.9,
                      child: _Entering(
                        ms: ms,
                        index: slot.index,
                        child: _OpenSeat(onTap: onOpenSeat),
                      ),
                    )
                  else
                    Positioned(
                      left: centreOf(slot.index) - size,
                      width: size * 2,
                      top: bootsY - size,
                      height: size,
                      child: _Entering(
                        ms: ms,
                        index: slot.index,
                        child: Center(
                          child: FoldPuppet(
                            fold: slot.member!.fold,
                            size: size,
                            breathe: idle,
                            blink: idle,
                            phase: slot.index,
                            shadow: false,
                            finish: slot.member!.finish,
                            fallbackName: slot.member!.name,
                            fallbackColour: slot.member!.colour,
                          ),
                        ),
                      ),
                    ),
                // 7 name tags: names only (F2).
                for (final slot in slots)
                  if (!slot.seat)
                    Positioned(
                      left: centreOf(slot.index) - slotW / 2 + 2,
                      width: slotW - 4,
                      top: bootsY + 6,
                      child: _EngraveTag(text: slot.member!.you ? MobV3Copy.you : slot.member!.name, ms: ms),
                    )
                  else if (!oneCaption)
                    Positioned(
                      left: centreOf(slot.index) - slotW / 2 + 2,
                      width: slotW - 4,
                      top: bootsY + 6,
                      child: _EngraveTag(text: MobV3Copy.openSeat, ms: ms, quiet: true),
                    ),
                if (oneCaption && slots.length > 1)
                  Positioned(
                    left: side,
                    right: side,
                    top: bootsY + (alone ? 26 : 6),
                    child: _EngraveTag(text: MobV3Copy.seatsOpen(slots.length - 1), ms: ms, quiet: true),
                  ),
                // The studying desk (4.2): the art's own desk, right of the pennant, under a desk lamp.
                if (studying != null && studier != null)
                  Positioned.fill(
                    child: StudyDesk(
                      key: ValueKey('den-studying-${studier.memberId}'),
                      member: studier,
                      since: studying.since,
                      size: size * 0.85,
                      // The art's desk top (art 1536 x 1024: the paper at about x 1150, the top at y 452).
                      deskTop: Offset(artLeft + 1150 * s, artTop + 452 * s),
                      width: w,
                      tagTop: artTop + 452 * s + 10,
                      idle: idle,
                    ),
                  ),
                // 8 the pennant (the Mob's weekly streak, labelled with the Mob's name: D173 item 6).
                Positioned(
                  left: w * 0.685 - 29,
                  top: stageTop - 6,
                  child: RepaintBoundary(
                    child: _PennantIn(
                      ms: ms,
                      weeks: v3!.mobChain.weeks,
                      onTap: onPennant,
                      label: MobV4DenCopy.pennantLabel(v3!.name.text, v3!.mobChain.weeks),
                      crown: v3!.hours?.topMemberId != null && (v3!.hours?.members.isNotEmpty ?? false),
                    ),
                  ),
                ),
                if (v3!.shelf.items.isNotEmpty || v3!.shelf.nextItem != null)
                  Positioned(
                    left: side,
                    top: stageTop + 92,
                    child: RepaintBoundary(
                      child: _Fading(
                        ms: ms,
                        at: EnterDen.pennantAt,
                        child: DenShelfView(shelf: v3!.shelf, mobName: v3!.name.text, onTap: onShelf),
                      ),
                    ),
                  ),
                // 9 sticker flights from a member's Fold.
                for (final f in flights.take(3))
                  if (posOf(f.memberId) case final int i)
                    Positioned(
                      left: centreOf(i) - 80,
                      width: 160,
                      top: bootsY - size - 52,
                      height: 52,
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: StickerFlight(key: ValueKey('flight-${f.id}'), kind: f.kind, onDone: () => onFlightDone?.call(f.id)),
                      ),
                    ),
              ],
            ],
          ),
        );
      },
    );
  }

  List<Widget> _skeleton(BuildContext context, double w, double bootsY) {
    // D6: the room and the lamp, no Folds; the pennant as a paper block pulsing 1.0 to 0.6.
    return [Positioned(right: MmSpace.gutter + 6, top: stageTop + 10, child: const PaperPulse(width: 58, height: 82))];
  }
}

class _Fade extends StatelessWidget {
  const _Fade({required this.colour, required this.down});

  final Color colour;

  /// True: transparent at the top to the colour at the bottom.
  final bool down;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: down ? [colour.withValues(alpha: 0), colour] : [colour, colour.withValues(alpha: 0)]),
    ),
  );
}

class _Scrim extends StatelessWidget {
  const _Scrim({required this.colour});

  final Color colour;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [colour.withValues(alpha: 0.4), colour.withValues(alpha: 0)]),
      ),
    ),
  );
}

/// The lamp light field (layer 3): a warm radial pool on the floor under the Folds.
class _LampPool extends CustomPainter {
  _LampPool({required this.centre, required this.width, required this.strength, required this.night});

  final Offset centre;
  final double width;
  final double strength;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final base = night ? const Color(0xFFF2A93B) : const Color(0xFFF2C46B);
    final peak = (night ? 0.26 : 0.17) * strength;
    final rx = math.min(width * 0.46, 260.0);
    final ry = rx * 0.24;
    final rect = Rect.fromCenter(center: centre, width: rx * 2, height: ry * 2);
    canvas.save();
    canvas.translate(centre.dx, centre.dy);
    canvas.scale(1, ry / rx);
    canvas.translate(-centre.dx, -centre.dy);
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [
          base.withValues(alpha: peak),
          base.withValues(alpha: peak * 0.55),
          base.withValues(alpha: 0),
        ],
        stops: const [0, 0.55, 1],
      ).createShader(Rect.fromCircle(center: centre, radius: rx));
    canvas.drawCircle(centre, rx, paint);
    canvas.restore();
    // A faint wash up the wall behind the Folds, so the room reads as lit from the lamp.
    canvas.drawRect(
      Rect.fromLTWH(rect.left, rect.top - ry * 3.2, rect.width, ry * 3.4),
      Paint()
        ..shader = RadialGradient(
          center: Alignment.bottomCenter,
          radius: 0.9,
          colors: [
            base.withValues(alpha: peak * 0.35),
            base.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromLTWH(rect.left, rect.top - ry * 3.2, rect.width, ry * 3.4)),
    );
  }

  @override
  bool shouldRepaint(_LampPool old) => old.strength != strength || old.centre != centre || old.night != night || old.width != width;
}

/// A Fold's contact shadow (layer 5): 18% black Night, 12% 3B2A12 Day, settling 60 ms after its Fold.
class _FoldShadow extends StatelessWidget {
  const _FoldShadow({required this.ms, required this.index, required this.night});

  final ValueListenable<double> ms;
  final int index;
  final bool night;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: ms,
      builder: (context, t, _) {
        final (o, sc) = EnterDen.shadow(t, index);
        return CustomPaint(
          painter: _ShadowEllipse(opacity: o, scale: sc, night: night),
        );
      },
    );
  }
}

class _ShadowEllipse extends CustomPainter {
  _ShadowEllipse({required this.opacity, required this.scale, required this.night});

  final double opacity;
  final double scale;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    if (opacity <= 0) return;
    final c = night ? Colors.black.withValues(alpha: 0.30 * opacity) : const Color(0xFF3B2A12).withValues(alpha: 0.16 * opacity);
    final r = Rect.fromCenter(center: size.center(Offset.zero), width: size.width * scale, height: size.height * scale);
    canvas.drawOval(
      r,
      Paint()
        ..color = c
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.height * 0.3),
    );
  }

  @override
  bool shouldRepaint(_ShadowEllipse old) => old.opacity != opacity || old.scale != scale || old.night != night;
}

/// A Fold (or a seat) rising into its place: rise 14 dp, scale 0.92 to 1 on iconPop, 90 ms apart.
class _Entering extends StatelessWidget {
  const _Entering({required this.ms, required this.index, required this.child});

  final ValueListenable<double> ms;
  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: ms,
      child: RepaintBoundary(child: child),
      builder: (context, t, child) {
        final (o, dy, sc) = EnterDen.fold(t, index);
        return Opacity(
          opacity: o,
          child: Transform.translate(
            offset: Offset(0, dy),
            child: Transform.scale(scale: sc, alignment: Alignment.bottomCenter, child: child),
          ),
        );
      },
    );
  }
}

class _Fading extends StatelessWidget {
  const _Fading({required this.ms, required this.at, required this.child});

  final ValueListenable<double> ms;
  final double at;
  final Widget child;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<double>(
    valueListenable: ms,
    child: child,
    builder: (context, t, child) => Opacity(opacity: windowOf(t, at, 200), child: child),
  );
}

/// The pennant swinging in about its pin (M1 from 160 ms).
class _PennantIn extends StatefulWidget {
  const _PennantIn({required this.ms, required this.weeks, this.onTap, this.label, this.crown = false});

  final ValueListenable<double> ms;
  final int weeks;
  final VoidCallback? onTap;
  final String? label;
  final bool crown;

  @override
  State<_PennantIn> createState() => _PennantInState();
}

class _PennantInState extends State<_PennantIn> {
  final ValueNotifier<double> _angle = ValueNotifier(0);

  @override
  void initState() {
    super.initState();
    widget.ms.addListener(_sync);
    _sync();
  }

  @override
  void didUpdateWidget(_PennantIn old) {
    super.didUpdateWidget(old);
    if (old.ms != widget.ms) {
      old.ms.removeListener(_sync);
      widget.ms.addListener(_sync);
    }
  }

  void _sync() => _angle.value = EnterDen.pennantAngle(widget.ms.value);

  @override
  void dispose() {
    widget.ms.removeListener(_sync);
    _angle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: widget.ms,
      child: Pennant(weeks: widget.weeks, swing: _angle, onTap: widget.onTap, semanticsLabel: widget.label, crown: widget.crown, stitch: PennantPaper.stitch(context)),
      builder: (context, t, child) => Opacity(opacity: EnterDen.pennantOpacity(t), child: child),
    );
  }
}

/// A name tag that engraves whole words, left to right, from 420 ms over 280 ms (never letters).
/// Names wrap to two lines at large text and are never cut (5.5).
class _EngraveTag extends StatelessWidget {
  const _EngraveTag({required this.text, required this.ms, this.quiet = false});

  final String text;
  final ValueListenable<double> ms;
  final bool quiet;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final style = quiet ? type.label.copyWith(color: colors.ink3, fontWeight: FontWeight.w600) : type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700);
    final words = text.split(' ');
    return ValueListenableBuilder<double>(
      valueListenable: ms,
      builder: (context, t, _) {
        final step = EnterDen.tagsLength / words.length;
        return Text.rich(
          TextSpan(
            children: [
              for (var j = 0; j < words.length; j++)
                TextSpan(
                  text: j == words.length - 1 ? words[j] : '${words[j]} ',
                  style: style.copyWith(color: style.color!.withValues(alpha: style.color!.a * windowOf(t, EnterDen.tagsAt + step * j, step))),
                ),
            ],
          ),
          textAlign: TextAlign.center,
          maxLines: 2,
          softWrap: true,
          semanticsLabel: text,
        );
      },
    );
  }
}

/// An open seat (D5 and any Mob under 5): a dashed paper outline with a plus. A tap invites.
class _OpenSeat extends StatelessWidget {
  const _OpenSeat({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final seat = CustomPaint(
      painter: _SeatPainter(edge: colors.isNight ? const Color(0x8CEDE5D3) : const Color(0x996B5F4A), plus: colors.isNight ? const Color(0xCCEDE5D3) : const Color(0xCC4A4234)),
    );
    if (onTap == null) return Semantics(label: MobV3Copy.openSeat, child: seat);
    return MmPressable(onTap: onTap, semanticsLabel: MobV3Copy.openSeatInvite, pressedScale: 0.95, focusRadius: BorderRadius.circular(18), builder: (context, pressed, _) => seat);
  }
}

class _SeatPainter extends CustomPainter {
  _SeatPainter({required this.edge, required this.plus});

  final Color edge;
  final Color plus;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndCorners(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      topLeft: Radius.circular(size.width * 0.5),
      topRight: Radius.circular(size.width * 0.5),
      bottomLeft: const Radius.circular(10),
      bottomRight: const Radius.circular(10),
    );
    canvas.drawRRect(r, Paint()..color = edge.withValues(alpha: edge.a * 0.12));
    final p = Paint()
      ..color = edge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    for (final m in (Path()..addRRect(r)).computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + 5, m.length)), p);
        d += 9;
      }
    }
    final c = Offset(size.width / 2, size.height * 0.52);
    final arm = math.min(size.width, size.height) * 0.14;
    final q = Paint()
      ..color = plus
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(c.translate(-arm, 0), c.translate(arm, 0), q);
    canvas.drawLine(c.translate(0, -arm), c.translate(0, arm), q);
  }

  @override
  bool shouldRepaint(_SeatPainter old) => old.edge != edge || old.plus != plus;
}

/// The den's shelf (layer 8): a lamp-lit plank with the earned den objects, and the next one as a true
/// silhouette (spec 0.4 "Den objects"). A tap opens the shelf.
class DenShelfView extends StatelessWidget {
  const DenShelfView({super.key, required this.shelf, required this.mobName, this.onTap});

  final DenShelf shelf;
  final String mobName;
  final VoidCallback? onTap;

  static const double item = 30;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final next = shelf.nextItem;
    final things = <Widget>[
      for (final i in shelf.items.take(4)) DenObject(item: i, size: item),
      if (next != null) DenObject(key: const ValueKey('den-shelf-next'), item: next.item, size: item, next: true),
    ];
    final width = math.max(96.0, things.length * (item + 6) + 18);
    final view = SizedBox(
      width: width,
      height: item + 10,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 6,
            child: CustomPaint(painter: _PlankPainter(night: colors.isNight)),
          ),
          Positioned(
            left: 9,
            bottom: 5,
            child: Row(
              children: [for (final t in things) Padding(padding: const EdgeInsets.only(right: 6), child: t)],
            ),
          ),
        ],
      ),
    );
    final label = MobV3Copy.shelfSemantics(mobName, [for (final i in shelf.items) MobV3Copy.itemName(i)], next == null ? null : MobV3Copy.itemName(next.item), next?.at);
    if (onTap == null) {
      return Semantics(
        label: label,
        child: ExcludeSemantics(child: view),
      );
    }
    return MmPressable(onTap: onTap, semanticsLabel: label, pressedScale: 0.97, focusRadius: BorderRadius.circular(8), builder: (context, pressed, _) => view);
  }
}

class _PlankPainter extends CustomPainter {
  _PlankPainter({required this.night});

  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(2));
    canvas.drawRRect(
      r.shift(const Offset(0, 3)),
      Paint()
        ..color = Colors.black.withValues(alpha: night ? 0.45 : 0.14)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );
    canvas.drawRRect(r, Paint()..color = night ? const Color(0xFF5A4A36) : const Color(0xFFC9B48E));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, 1.5), Paint()..color = night ? const Color(0xFFB08A55) : const Color(0xFFE7D6B4));
  }

  @override
  bool shouldRepaint(_PlankPainter old) => old.night != night;
}

/// One den object (spec 0.4): the desk bell and the foil seal from the art set; the stamps and the
/// brass lamp painted in paper and lamp.
class DenObject extends StatelessWidget {
  const DenObject({super.key, required this.item, this.size = 30, this.next = false});

  final String item;
  final double size;

  /// The next thing to earn: a quiet pencilled outline of its shape, never a grey block that reads as
  /// a missing picture (M8, 19 Oct night walk). Art items show as a soft silhouette.
  final bool next;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (next) {
      final art = _artFor(item);
      if (art != null) {
        return Opacity(
          opacity: 0.55,
          child: ColorFiltered(
            colorFilter: ColorFilter.mode(colors.ink4, BlendMode.srcIn),
            child: Image.asset(art, width: size, height: size, fit: BoxFit.contain, errorBuilder: (_, _, _) => SizedBox(width: size, height: size)),
          ),
        );
      }
      return CustomPaint(size: Size(size, size), painter: _OutlinePainter(colour: colors.ink3));
    }
    return _real();
  }

  static String? _artFor(String item) => switch (item) {
    'desk_bell' => 'assets/art/hybrid-deskbell.webp',
    'foil_seal' => 'assets/art/foil-seal.webp',
    _ => null,
  };

  Widget _real() {
    final art = switch (item) {
      'desk_bell' => 'assets/art/hybrid-deskbell.webp',
      'foil_seal' => 'assets/art/foil-seal.webp',
      _ => null,
    };
    if (art != null) {
      return Image.asset(
        art,
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => SizedBox(width: size, height: size),
      );
    }
    return CustomPaint(size: Size(size, size), painter: _ObjectPainter(item));
  }
}

/// The next stamp to earn: a pencilled, dashed square with a faint plus, sitting on the plank.
class _OutlinePainter extends CustomPainter {
  _OutlinePainter({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size s) {
    final r = Rect.fromLTWH(s.width * 0.12, s.height * 0.16, s.width * 0.76, s.height * 0.76);
    final p = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    for (final m in (Path()..addRRect(RRect.fromRectAndRadius(r, const Radius.circular(3)))).computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + 3.5, m.length)), p);
        d += 6;
      }
    }
    final c = r.center;
    final arm = r.width * 0.16;
    canvas.drawLine(c.translate(-arm, 0), c.translate(arm, 0), p);
    canvas.drawLine(c.translate(0, -arm), c.translate(0, arm), p);
  }

  @override
  bool shouldRepaint(_OutlinePainter old) => old.colour != colour;
}

class _ObjectPainter extends CustomPainter {
  _ObjectPainter(this.item);

  final String item;

  @override
  void paint(Canvas canvas, Size s) {
    switch (item) {
      case 'brass_lamp':
        final brass = Paint()..color = const Color(0xFFC9963E);
        canvas.drawRect(Rect.fromLTWH(s.width * 0.47, s.height * 0.38, s.width * 0.06, s.height * 0.5), brass);
        canvas.drawOval(Rect.fromLTWH(s.width * 0.28, s.height * 0.86, s.width * 0.44, s.height * 0.12), brass);
        canvas.drawPath(
          Path()
            ..moveTo(s.width * 0.2, s.height * 0.42)
            ..quadraticBezierTo(s.width * 0.5, s.height * 0.02, s.width * 0.8, s.height * 0.42)
            ..close(),
          Paint()..color = const Color(0xFFE0B25C),
        );
      case 'den_stamp_row':
        _stamp(canvas, Rect.fromLTWH(0, s.height * 0.2, s.width * 0.6, s.height * 0.6));
        _stamp(canvas, Rect.fromLTWH(s.width * 0.4, s.height * 0.32, s.width * 0.6, s.height * 0.6));
      default:
        _stamp(canvas, Rect.fromLTWH(s.width * 0.08, s.height * 0.12, s.width * 0.84, s.height * 0.84));
    }
  }

  /// A square paper stamp with a perforated (scalloped) edge and an ink tick.
  void _stamp(Canvas canvas, Rect r) {
    final edge = Path();
    const n = 6;
    final rad = r.width / (n * 2.2);
    edge.addRect(r.deflate(rad * 0.6));
    for (var i = 0; i <= n; i++) {
      final f = i / n;
      for (final c in [Offset(r.left + r.width * f, r.top), Offset(r.left + r.width * f, r.bottom), Offset(r.left, r.top + r.height * f), Offset(r.right, r.top + r.height * f)]) {
        edge.addOval(Rect.fromCircle(center: c, radius: rad));
      }
    }
    canvas.drawRect(
      r.shift(const Offset(1, 2)),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.25)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
    );
    canvas.drawRect(r, Paint()..color = const Color(0xFFF1E8D4));
    canvas.drawRect(
      r.deflate(r.width * 0.14),
      Paint()
        ..color = const Color(0xFFC98A2E)
        ..style = PaintingStyle.stroke
        ..strokeWidth = r.width * 0.06,
    );
    final t = Paint()
      ..color = const Color(0xFF1E1B15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r.width * 0.09
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(
      Path()
        ..moveTo(r.left + r.width * 0.3, r.top + r.height * 0.52)
        ..lineTo(r.left + r.width * 0.45, r.top + r.height * 0.66)
        ..lineTo(r.left + r.width * 0.72, r.top + r.height * 0.36),
      t,
    );
  }

  @override
  bool shouldRepaint(_ObjectPainter old) => old.item != item;
}

/// A paper block pulsing 1.0 to 0.6 on the 1200 ms sweep (D6); still in reduced motion.
class PaperPulse extends StatefulWidget {
  const PaperPulse({super.key, required this.width, required this.height, this.radius = 6});

  final double width;
  final double height;
  final double radius;

  @override
  State<PaperPulse> createState() => _PaperPulseState();
}

class _PaperPulseState extends State<PaperPulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.disableAnimationsOf(context) || !TickerMode.valuesOf(context).enabled;
    if (still) {
      _c.stop();
      _c.value = 0;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.6).animate(CurvedAnimation(parent: _c, curve: MotionCurves.sweep)),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: colors.isNight ? colors.raised2 : colors.raised,
          borderRadius: BorderRadius.circular(widget.radius),
          border: Border.all(color: colors.line),
        ),
      ),
    );
  }
}

/// Studying now (pass-1020 MOB-MINIMAL 3.1 item 2, 4.2 "Studying now"): real presence only, from
/// `v3.hours.studying_now`. Light first: the desk lamp's bulb (150 ms), then its beam (300 ms). The member's
/// Fold hops twice onto the art's desk (500 ms each), lands in the think pose, and the tag rises: "Riya is
/// studying" / "since 3:52 PM". About 1.75 s. Reduced motion: the lamp fades in over 120 ms and the Fold
/// simply appears.
class StudyDesk extends StatelessWidget {
  const StudyDesk({super.key, required this.member, required this.since, required this.size, required this.deskTop, required this.width, required this.tagTop, this.idle = false});

  final MobV3Member member;
  final DateTime since;

  /// The Fold's size on the desk (0.85 of the floor Folds, for depth).
  final double size;

  /// Where the Fold's boots stand: the paper on the art's desk top, in the room's coordinates.
  final Offset deskTop;

  /// The room's width (the lamp stands at the desk's right, inside the screen).
  final double width;

  /// The tag's top, under the desk.
  final double tagTop;

  /// The Fold blinks with the others while the den is idle.
  final bool idle;

  static const double total = 1750;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final lampX = math.min(width - 20, deskTop.dx + size * 1.3);
    final foldX = deskTop.dx - size * 0.15;
    return Semantics(
      label: MobV4DenCopy.studyingSemantics(member.name, since),
      container: true,
      child: ExcludeSemantics(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: reduced ? 0 : 0, end: 1),
          duration: reduced ? MotionDurations.reducedFade : const Duration(milliseconds: 1750),
          builder: (context, t, _) {
            final ms = t * total;
            final bulb = reduced ? t : windowOf(ms, 0, 150, MotionCurves.glide);
            final beam = reduced ? t : windowOf(ms, 150, 300, MotionCurves.glide);
            // Two hops in from the lamp's side: x from +2 Fold widths to 0, a 14 dp arc each.
            double hopY(double p) => -14 * 4 * p * (1 - p);
            final h1 = windowOf(ms, 450, 500);
            final h2 = windowOf(ms, 950, 500);
            final travel = reduced ? 0.0 : (1 - (h1 * 0.5 + h2 * 0.5)) * size * 0.9;
            final lift = reduced ? 0.0 : (ms < 950 ? hopY(h1) : hopY(h2));
            final shown = reduced ? t : windowOf(ms, 450, 120);
            // The landing squash (1.06 / 0.94 for 90 ms) at the end of the second hop.
            final land = reduced ? 0.0 : windowOf(ms, 1450, 90);
            final squash = land > 0 && land < 1 ? math.sin(land * math.pi) : 0.0;
            final tag = reduced ? t : windowOf(ms, 1450, 300, MotionCurves.emphasized);
            return Stack(
              clipBehavior: Clip.none,
              children: [
                // The beam and the pool it leaves on the desk.
                Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(
                      painter: _DeskLampPainter(lampX: lampX, deskY: deskTop.dy, target: deskTop.dx, bulb: bulb, beam: beam, lamp: colors.lamp, metal: colors.isNight ? const Color(0xFF16151A) : const Color(0xFF2A2721), night: colors.isNight),
                    ),
                  ),
                ),
                Positioned(
                  left: foldX - size / 2 + travel,
                  top: deskTop.dy - size + 2 + lift,
                  width: size,
                  height: size,
                  child: Opacity(
                    opacity: shown.clamp(0.0, 1.0),
                    child: Transform(
                      alignment: Alignment.bottomCenter,
                      transform: Matrix4.diagonal3Values(1 + 0.06 * squash, 1 - 0.06 * squash, 1),
                      child: FoldPuppet(
                        fold: member.fold,
                        size: size,
                        pose: (reduced || ms >= 1450) ? FoldPose.think : FoldPose.idle,
                        blink: idle,
                        shadow: false,
                        finish: member.finish,
                        fallbackName: member.name,
                        fallbackColour: member.colour,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: MmSpace.gutter,
                  top: tagTop,
                  child: Opacity(
                    opacity: tag.clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, 8 * (1 - tag)),
                      child: Container(
                        key: const ValueKey('den-studying-tag'),
                        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s16, MmSpace.s8),
                        decoration: BoxDecoration(
                          color: colors.raised.withValues(alpha: colors.isNight ? 0.9 : 0.94),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: colors.lamp.withValues(alpha: colors.isNight ? 0.55 : 0.4)),
                          boxShadow: colors.cardShadow,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: colors.lamp, shape: BoxShape.circle)),
                            const SizedBox(width: MmSpace.s8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(MobV4DenCopy.studying(member.name), style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                                Text(MobV4DenCopy.since(since), style: type.caption.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// A small desk lamp at the desk's right: base, arm and shade in one dark metal, the bulb, and a soft
/// beam onto the paper. [bulb] and [beam] are 0 to 1.
class _DeskLampPainter extends CustomPainter {
  _DeskLampPainter({required this.lampX, required this.deskY, required this.target, required this.bulb, required this.beam, required this.lamp, required this.metal, required this.night});

  final double lampX;
  final double deskY;
  final double target;
  final double bulb;
  final double beam;
  final Color lamp;
  final Color metal;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final base = Offset(lampX, deskY);
    final elbow = Offset(lampX - 4, deskY - 30);
    final head = Offset(lampX - 16, deskY - 50);
    final bulbAt = Offset(lampX - 24, deskY - 42);
    // The beam: a soft wedge from the bulb to the paper, and the pool it leaves.
    if (beam > 0) {
      final wedge = Path()
        ..moveTo(bulbAt.dx - 2, bulbAt.dy - 4)
        ..lineTo(target - 46, deskY)
        ..lineTo(target + 26, deskY)
        ..lineTo(bulbAt.dx + 6, bulbAt.dy + 2)
        ..close();
      canvas.drawPath(
        wedge,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [lamp.withValues(alpha: (night ? 0.34 : 0.22) * beam), lamp.withValues(alpha: 0.0)],
          ).createShader(Rect.fromPoints(bulbAt, Offset(target - 46, deskY))),
      );
      canvas.drawOval(
        Rect.fromCenter(center: Offset(target - 8, deskY + 1), width: 96, height: 12),
        Paint()
          ..color = lamp.withValues(alpha: (night ? 0.38 : 0.26) * beam)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
    }
    final metalPaint = Paint()
      ..color = metal
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    canvas.drawOval(Rect.fromCenter(center: base.translate(0, -1), width: 22, height: 6), Paint()..color = metal);
    canvas.drawLine(base.translate(0, -2), elbow, metalPaint);
    canvas.drawLine(elbow, head, metalPaint);
    // The shade: a cone pointing down-left at the paper.
    final shade = Path()
      ..moveTo(head.dx + 4, head.dy - 4)
      ..lineTo(head.dx - 16, head.dy + 2)
      ..lineTo(head.dx - 6, head.dy + 14)
      ..close();
    canvas.drawPath(shade, Paint()..color = metal);
    if (bulb > 0) {
      canvas.drawCircle(
        bulbAt,
        9,
        Paint()
          ..color = lamp.withValues(alpha: 0.55 * bulb)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
      canvas.drawCircle(bulbAt, 2.6, Paint()..color = Color.lerp(lamp, Colors.white, 0.5)!.withValues(alpha: bulb));
    }
  }

  @override
  bool shouldRepaint(_DeskLampPainter old) => old.bulb != bulb || old.beam != beam || old.lampX != lampX || old.deskY != deskY || old.target != target || old.lamp != lamp;
}
