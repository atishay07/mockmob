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
import '../../../../core/motion/motion.dart' show Motion;
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
    this.desk,
    this.deskLeaving = false,
    this.onDeskLeft,
    this.act,
    this.waiting = const {},
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

  /// Who is on the desk, as the screen keeps it (null: read [studierOf]). While [deskLeaving], the last studier
  /// plays the exit (4.2: the tag fades, two hops back to their floor slot, the lamp dims over 600 ms), then
  /// [onDeskLeft] lets the screen drop them.
  final (StudyingNow?, MobV3Member?)? desk;
  final bool deskLeaving;
  final VoidCallback? onDeskLeft;

  /// The event act playing now (4.2: a friend joins, a reaction), or null. The screen decides when (a real event,
  /// once, one at a time); the stage draws it on the act's clock.
  final DenActCue? act;

  /// Newcomers waiting for their join act: their seat still shows (outline and tag) and their Fold is not drawn yet,
  /// so a friend never stands in the den before they hop in.
  final Set<String> waiting;

  /// The floor reflows (a member moves to or from the desk) over 360 ms; reduced motion: at once.
  static const Duration reflow = Duration(milliseconds: 360);

  /// Studying now (D171, 4.2): the first sharing member, other than you, with a practice answer in the last
  /// 10 minutes (`v3.hours.studying_now`). They stand on the desk under the lamp, not on the floor. Real
  /// presence only; one at a time; never in a Mob of one.
  static (StudyingNow?, MobV3Member?) studierOf(MobV3? v3) {
    final all = v3?.members ?? const <MobV3Member>[];
    if (all.length <= 1) return (null, null);
    for (final st in v3?.hours?.studyingNow ?? const <StudyingNow>[]) {
      for (final m in all) {
        if (m.memberId == st.memberId && !m.you) return (st, m);
      }
    }
    return (null, null);
  }

  /// The pennant's left edge: by the desk's left when someone studies (the desk takes the right), else at
  /// the stage's right. The title block stops short of it.
  static double pennantLeft(double width, {required bool studying}) => studying ? width * 0.66 - pennantWidth / 2 : width - MmSpace.gutter - 6 - pennantWidth;

  static const double pennantWidth = 58;

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
        final (studying, studier) = desk ?? DenStage.studierOf(v3);
        // While the last studier leaves the desk, their floor slot is already made (the others reflow), and their
        // floor Fold shows once the hops land.
        final members = [for (final m in all) if (deskLeaving || m.memberId != studier?.memberId) m];
        final hiddenOnFloor = deskLeaving ? studier?.memberId : null;
        final reduced = Motion.reduced(context);
        final move = reduced ? Duration.zero : DenStage.reflow;
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
        // The event acts (4.2). A newcomer waiting for their act keeps their seat; the one hopping in is [joinId].
        final joinId = act?.kind == DenActKind.join ? act!.memberId : null;
        final reacting = act?.kind == DenActKind.reaction;
        final waits = {for (final m in members) if (waiting.contains(m.memberId) && m.memberId != joinId) m.memberId};
        // Every open seat carries its own tag (V4 3.1 step 9, the approved empty den): "Open seat" when one is
        // left, "Open" when there are two or more. A seat a newcomer is about to take still counts until it folds away.
        final openSeats = slots.where((sl) => sl.seat).length + waits.length + (joinId != null && posOf(joinId) != null ? 1 : 0);
        final seatLabel = openSeats >= 2 ? MobV4DenCopy.openShort : MobV3Copy.openSeat;
        const side = MmSpace.gutter;
        final slotW = slots.isEmpty ? 0.0 : (w - 2 * side) / slots.length;
        double centreOf(int i) => side + slotW * (i + 0.5);
        final seatW = math.min(slotW - 6, size * 0.66);

        // Who the act moves: the newcomer, or (a reaction) every Fold on the floor, the cheer rippling out from the
        // sender's Fold, nearest first (ties: the left one first), 120 ms apart.
        DenActCue? actOn(String id) => act != null && !waits.contains(id) && (id == joinId || reacting) ? act : null;
        final rank = <String, int>{};
        if (reacting) {
          final lead = posOf(act!.memberId);
          final order = [for (final sl in slots) if (!sl.seat && !waits.contains(sl.member!.memberId)) sl]
            ..sort((a, b) {
              final da = lead == null ? a.index : (a.index - lead).abs();
              final db = lead == null ? b.index : (b.index - lead).abs();
              return da != db ? da.compareTo(db) : a.index.compareTo(b.index);
            });
          for (var i = 0; i < order.length; i++) {
            rank[order[i].member!.memberId] = math.min(i, math.max(0, act!.members - 1));
          }
        }
        // The newcomer enters from the stage's right edge (members stand in join order, so the right is where the open
        // seats are): just past the edge, two hops onto their seat.
        double fromDxOf(int i) => w + size * 0.25 - centreOf(i);
        // The others turn their eyes toward the newcomer while they land and wave (reduced motion: no glance).
        final joinAt = joinId == null ? null : posOf(joinId);
        Animation<double>? lookOf(_Slot slot) {
          if (joinAt == null || reduced || waits.contains(slot.member!.memberId) || slot.member!.memberId == joinId) return null;
          return _JoinLook(act!.clock, centreOf(joinAt) >= centreOf(slot.index) ? 1 : -1);
        }

        // The art: the lamp pool (art 790, 810 of 1536 x 1024) lands under the Folds' boots, centred.
        final s = w / 1060;
        final artLeft = w / 2 - 790 * s;
        final artTop = bootsY - 810 * s;
        final night = colors.isNight;

        // A member's Fold (layer 6). The newcomer hopping in is drawn over the desk and its tag (layer 6b), so the
        // character leads the moment; the same key keeps its state when it moves between the two.
        Widget foldOf(_Slot slot) => AnimatedPositioned(
          key: ValueKey('den-fold-${slot.member!.memberId}'),
          duration: move,
          curve: MotionCurves.glide,
          left: centreOf(slot.index) - size,
          width: size * 2,
          top: bootsY - size,
          height: size,
          child: _Entering(
            ms: ms,
            index: slot.index,
            hidden: slot.member!.memberId == hiddenOnFloor || waits.contains(slot.member!.memberId),
            child: Center(
              child: waits.contains(slot.member!.memberId)
                  ? const SizedBox.shrink()
                  // The act's travel and squash about the boots; the Fold draws the frame's pose (4.2).
                  : DenActPlayer(
                      key: ValueKey('den-act-${slot.member!.memberId}'),
                      kind: slot.member!.memberId == joinId ? DenActKind.join : DenActKind.reaction,
                      actId: actOn(slot.member!.memberId)?.id ?? 0,
                      clock: actOn(slot.member!.memberId)?.clock,
                      index: rank[slot.member!.memberId] ?? 0,
                      members: act?.members ?? 1,
                      fromDx: fromDxOf(slot.index),
                      builder: (context, f) => FoldPuppet(
                        fold: slot.member!.fold,
                        size: size,
                        pose: f.pose,
                        breathe: idle,
                        blink: idle,
                        phase: slot.index,
                        shadow: false,
                        finish: slot.member!.finish,
                        fallbackName: slot.member!.name,
                        fallbackColour: slot.member!.colour,
                        acting: act != null,
                        look: lookOf(slot),
                      ),
                    ),
            ),
          ),
        );

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
                    AnimatedPositioned(
                      key: ValueKey('den-shadow-${slot.member!.memberId}'),
                      duration: move,
                      curve: MotionCurves.glide,
                      left: centreOf(slot.index) - size * 0.4,
                      top: bootsY - size * 0.05,
                      width: size * 0.8,
                      height: size * 0.1,
                      child: Opacity(
                        opacity: slot.member!.memberId == hiddenOnFloor || waits.contains(slot.member!.memberId) ? 0 : 1,
                        // The rig's first layer (4.1): the shadow travels with the Fold on the floor and shrinks as it rises.
                        child: _OnAct(
                          cue: actOn(slot.member!.memberId),
                          kind: slot.member!.memberId == joinId ? DenActKind.join : DenActKind.reaction,
                          index: rank[slot.member!.memberId] ?? 0,
                          fromDx: fromDxOf(slot.index),
                          builder: (context, f, child) {
                            final k = 1 - 0.4 * (-f.dy / 26).clamp(0.0, 1.0);
                            return Opacity(
                              opacity: f.opacity.clamp(0.0, 1.0),
                              child: Transform.translate(offset: Offset(f.dx, 0), child: Transform.scale(scale: k, child: child)),
                            );
                          },
                          child: RepaintBoundary(
                            child: _FoldShadow(ms: ms, index: slot.index, night: night),
                          ),
                        ),
                      ),
                    ),
                // The seat a newcomer takes: shown while they wait for their act, folding away flat onto the floor as
                // they land (4.2). Under the Folds, so the newcomer stands in front of it.
                for (final slot in slots)
                  if (!slot.seat && (waits.contains(slot.member!.memberId) || slot.member!.memberId == joinId))
                    AnimatedPositioned(
                      key: ValueKey('den-waitseat-${slot.member!.memberId}'),
                      duration: move,
                      curve: MotionCurves.glide,
                      left: centreOf(slot.index) - seatW / 2,
                      top: bootsY - size * 0.9,
                      width: seatW,
                      height: size * 0.9,
                      child: _Entering(
                        ms: ms,
                        index: slot.index,
                        child: _OnAct(
                          cue: slot.member!.memberId == joinId ? act : null,
                          kind: DenActKind.join,
                          builder: (context, f, child) {
                            final v = slot.member!.memberId == joinId ? f.seat.clamp(0.0, 1.0) : 1.0;
                            // Reduced motion: the outline only fades.
                            return Opacity(
                              opacity: v,
                              child: reduced ? child : Transform(alignment: Alignment.bottomCenter, transform: Matrix4.diagonal3Values(1, 0.2 + 0.8 * v, 1), child: child),
                            );
                          },
                          child: const _OpenSeat(),
                        ),
                      ),
                    ),
                // 6 Folds and open seats.
                for (final slot in slots)
                  if (slot.seat)
                    AnimatedPositioned(
                      key: ValueKey('den-seat-${slot.index}'),
                      duration: move,
                      curve: MotionCurves.glide,
                      left: centreOf(slot.index) - seatW / 2,
                      top: bootsY - size * 0.9,
                      width: seatW,
                      height: size * 0.9,
                      child: _Entering(
                        ms: ms,
                        index: slot.index,
                        child: _OpenSeat(onTap: onOpenSeat),
                      ),
                    )
                  else if (slot.member!.memberId != joinId)
                    foldOf(slot),
                // 7 name tags: names only (F2).
                for (final slot in slots)
                  if (!slot.seat)
                    AnimatedPositioned(
                      key: ValueKey('den-tag-${slot.member!.memberId}'),
                      duration: move,
                      curve: MotionCurves.glide,
                      left: centreOf(slot.index) - slotW / 2 + 2,
                      width: slotW - 4,
                      top: bootsY + 6,
                      child: waits.contains(slot.member!.memberId)
                          ? _EngraveTag(text: seatLabel, ms: ms, quiet: true)
                          : slot.member!.memberId == joinId
                              // The seat's tag leaves with the outline, then the newcomer's name engraves (4.2).
                              ? _OnAct(
                                  cue: act,
                                  kind: DenActKind.join,
                                  builder: (context, f, _) => Stack(
                                    alignment: Alignment.topCenter,
                                    children: [
                                      if (f.seat > 0.001) Opacity(opacity: f.seat.clamp(0.0, 1.0), child: _EngraveTag(text: seatLabel, ms: ms, quiet: true)),
                                      Semantics(
                                        liveRegion: true,
                                        label: MobV4DenCopy.joined(slot.member!.name),
                                        child: ExcludeSemantics(child: _EngraveTag(text: slot.member!.name, ms: ms, engrave: f.name)),
                                      ),
                                    ],
                                  ),
                                )
                              : _EngraveTag(text: slot.member!.you ? MobV3Copy.you : slot.member!.name, ms: ms),
                    )
                  else
                    AnimatedPositioned(
                      key: ValueKey('den-seattag-${slot.index}'),
                      duration: move,
                      curve: MotionCurves.glide,
                      left: centreOf(slot.index) - slotW / 2 + 2,
                      width: slotW - 4,
                      top: bootsY + 6,
                      child: _EngraveTag(text: seatLabel, ms: ms, quiet: true),
                    ),
                // The studying desk (4.2): the art's own desk, right of the pennant, under a desk lamp.
                if (studying != null && studier != null)
                  // Keyed, like every layer after the Folds: a change in the floor (a seat taken, the newcomer moving
                  // over the desk) must never rebuild the desk and replay its arrival.
                  Positioned.fill(
                    key: const ValueKey('den-desk-layer'),
                    child: StudyDesk(
                      key: ValueKey('den-studying-${deskLeaving ? 'leave' : 'in'}-${studier.memberId}'),
                      member: studier,
                      since: studying.since,
                      size: size * 0.85,
                      // The art's desk top (art 1536 x 1024: the paper at about x 1150, the top at y 452).
                      deskTop: Offset(artLeft + 1150 * s, artTop + 452 * s),
                      // The Fold stands clear of the pennant's right edge.
                      minFoldX: DenStage.pennantLeft(w, studying: true) + DenStage.pennantWidth + size * 0.85 * 0.5 - 6,
                      width: w,
                      tagTop: artTop + 452 * s + 4,
                      idle: idle,
                      leaving: deskLeaving,
                      floor: posOf(studier.memberId) == null ? null : Offset(centreOf(posOf(studier.memberId)!), bootsY),
                      floorSize: size,
                      onLeft: onDeskLeft,
                    ),
                  ),
                // 6b the newcomer hopping in, over the desk's tag.
                for (final slot in slots)
                  if (!slot.seat && slot.member!.memberId == joinId) foldOf(slot),
                // 8 the pennant (the Mob's weekly streak, labelled with the Mob's name: D173 item 6).
                AnimatedPositioned(
                  key: const ValueKey('den-pennant-spot'),
                  duration: move,
                  curve: MotionCurves.glide,
                  left: DenStage.pennantLeft(w, studying: studying != null),
                  top: stageTop - 6,
                  child: RepaintBoundary(
                    child: _PennantIn(
                      ms: ms,
                      weeks: v3!.mobChain.weeks,
                      onTap: onPennant,
                      label: MobV4DenCopy.pennantLabel(v3!.name.text, v3!.mobChain.weeks),
                      caption: v3!.name.text.isEmpty ? MobV4DenCopy.pennantCaptionFallback : v3!.name.text,
                      crown: v3!.hours?.topMemberId != null && (v3!.hours?.members.isNotEmpty ?? false),
                      // The studying tag sits right under the pennant: its caption keeps to one line then.
                      roomBelow: studying == null,
                    ),
                  ),
                ),
                // The shelf's entry is the Your shelf row under the This week panel (3.1 item 6): the stage keeps only
                // the pennant and the desk, as the approved den does.
                // 9 sticker flights from a member's Fold.
                for (final f in flights.take(3))
                  if (posOf(f.memberId) case final int i)
                    Positioned(
                      key: ValueKey('den-flight-spot-${f.id}'),
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

/// The event act now playing on the den (4.2): what plays, on whom, and its clock (0 to 1 over
/// [DenActPlayer.lengthFor]). The screen owns the clock; the stage reads it for every part of the act.
@immutable
class DenActCue {
  const DenActCue({required this.kind, required this.memberId, required this.id, required this.clock, this.members = 1});

  /// [DenActKind.join] or [DenActKind.reaction].
  final DenActKind kind;

  /// The newcomer (join) or the friend whose sticker started the cheer (reaction).
  final String memberId;

  /// Bumped per act.
  final int id;
  final Animation<double> clock;

  /// How many Folds cheer (a reaction's length follows it).
  final int members;
}

/// Draws [builder] with the act's frame at the clock's time, or the rest frame with no act.
class _OnAct extends StatelessWidget {
  const _OnAct({required this.cue, required this.kind, required this.builder, this.index = 0, this.fromDx = 0, this.child});

  final DenActCue? cue;
  final DenActKind kind;
  final int index;
  final double fromDx;
  final Widget Function(BuildContext context, ActFrame frame, Widget? child) builder;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final c = cue;
    if (c == null) return builder(context, const ActFrame(), child);
    final reduced = Motion.reduced(context);
    final length = DenActPlayer.lengthFor(kind, reduced: reduced, members: c.members);
    return AnimatedBuilder(
      animation: c.clock,
      child: child,
      builder: (context, child) => builder(context, DenActPlayer.frame(kind, c.clock.value * length, index: index, fromDx: fromDx, reduced: reduced), child),
    );
  }
}

/// The others' eyes during a join: toward the newcomer ([dir] -1 left, 1 right) as far as the act's glance says.
class _JoinLook extends Animation<double> with AnimationWithParentMixin<double> {
  _JoinLook(this.parent, this.dir);

  @override
  final Animation<double> parent;
  final double dir;

  @override
  double get value => dir * JoinAct.at(parent.value * JoinAct.total, fromDx: 0).glance;
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
  const _Entering({required this.ms, required this.index, required this.child, this.hidden = false});

  final ValueListenable<double> ms;
  final int index;
  final Widget child;

  /// The studier's floor Fold while they hop back from the desk (it shows when they land).
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: ms,
      child: RepaintBoundary(child: child),
      builder: (context, t, child) {
        final (o, dy, sc) = EnterDen.fold(t, index);
        return Opacity(
          opacity: hidden ? 0 : o,
          child: Transform.translate(
            offset: Offset(0, dy),
            child: Transform.scale(scale: sc, alignment: Alignment.bottomCenter, child: child),
          ),
        );
      },
    );
  }
}

/// The pennant swinging in about its pin (M1 from 160 ms).
class _PennantIn extends StatefulWidget {
  const _PennantIn({required this.ms, required this.weeks, this.onTap, this.label, this.caption, this.crown = false, this.roomBelow = true});

  /// Under the foot, whose streak this is in words: the Mob's name (override 3). The semantics label says it too.
  final String? caption;

  /// Nothing sits right under the caption (no studying tag), so a long name may take a second line.
  final bool roomBelow;

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
      child: _withCaption(context, Pennant(weeks: widget.weeks, swing: _angle, onTap: widget.onTap, semanticsLabel: widget.label, crown: widget.crown, stitch: PennantPaper.stitch(context))),
      builder: (context, t, child) => Opacity(opacity: EnterDen.pennantOpacity(t), child: child),
    );
  }

  Widget _withCaption(BuildContext context, Widget pennant) {
    final text = widget.caption;
    if (text == null || text.isEmpty) return pennant;
    final colors = context.mmColors;
    final halo = [Shadow(color: colors.ground.withValues(alpha: colors.isNight ? 0.85 : 0.9), blurRadius: 6)];
    final style = context.mmType.caption.copyWith(fontSize: 10, height: 1.2, color: colors.isNight ? colors.ink2 : colors.ink, fontWeight: FontWeight.w600, shadows: halo);
    // The caption's text grows with large text up to 1.15x (it is part of the pennant's art).
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15);
    // The Mob's name is never cut mid-word (MOB-V4-BUILD override 3): it may reach 12 dp past each side of the pennant,
    // wraps at its words onto a second line when nothing sits under it ("Accountancy" / "Avengers"), and with the
    // studying tag under it keeps to one line of whole words ("Accountancy..."). A single word too long for the room
    // shrinks whole instead.
    const room = DenStage.pennantWidth + 24;
    double widthOf(String s) {
      final p = TextPainter(text: TextSpan(text: s, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      final w = p.width;
      p.dispose();
      return w;
    }

    if (widthOf(text) <= DenStage.pennantWidth) {
      // The usual name fits under the pennant as it is.
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          pennant,
          const SizedBox(height: MmSpace.s2),
          SizedBox(
            width: DenStage.pennantWidth,
            child: ExcludeSemantics(
              child: MediaQuery.withClampedTextScaling(
                maxScaleFactor: 1.15,
                child: Text(text, key: const ValueKey('den-pennant-caption'), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: style),
              ),
            ),
          ),
        ],
      );
    }
    final words = text.split(' ').where((w) => w.isNotEmpty).toList();
    final wordFits = words.every((w) => widthOf(w) <= room);
    final twoLines = widget.roomBelow && wordFits && widthOf(text) > room;
    var shown = text;
    if (!twoLines && widthOf(text) > room) {
      // The most whole words that fit with the ellipsis; at least the first word.
      shown = '${words.first}…';
      for (var k = words.length - 1; k >= 1; k--) {
        final candidate = '${words.take(k).join(' ')}…';
        if (widthOf(candidate) <= room) {
          shown = candidate;
          break;
        }
      }
    }
    final line = scaler.scale(10) * 1.2;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        pennant,
        const SizedBox(height: MmSpace.s2),
        SizedBox(
          width: DenStage.pennantWidth,
          height: line * (twoLines ? 2 : 1) + 1,
          child: OverflowBox(
            // With the studier at the desk on the pennant's right, a wider caption grows to the left only.
            alignment: widget.roomBelow ? Alignment.topCenter : Alignment.topRight,
            minWidth: 0,
            maxWidth: room,
            child: ExcludeSemantics(
              child: MediaQuery(
                data: MediaQuery.of(context).copyWith(textScaler: scaler),
                child: twoLines
                    ? Text(shown, key: const ValueKey('den-pennant-caption'), textAlign: TextAlign.center, maxLines: 2, style: style)
                    : FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(shown, key: const ValueKey('den-pennant-caption'), textAlign: TextAlign.center, maxLines: 1, softWrap: false, style: style),
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A name tag that engraves whole words, left to right, from 420 ms over 280 ms (never letters).
/// Names wrap to two lines at large text and are never cut (5.5).
class _EngraveTag extends StatelessWidget {
  const _EngraveTag({required this.text, required this.ms, this.quiet = false, this.engrave});

  final String text;
  final ValueListenable<double> ms;
  final bool quiet;

  /// A name engraving again in an act (a newcomer's, 0 to 1 over 280 ms), word by word like Enter the den.
  final double? engrave;

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
                  style: style.copyWith(
                    color: style.color!.withValues(alpha: style.color!.a * windowOf(t, EnterDen.tagsAt + step * j, step) * (engrave == null ? 1 : windowOf(engrave! * EnterDen.tagsLength, step * j, step))),
                  ),
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
///
/// [leaving] plays the exit when study stops: the tag fades (160 ms), two 500 ms hops back to the member's
/// floor slot ([floor]), and the lamp dims over 600 ms; then [onLeft]. Reduced motion: a 120 ms fade.
class StudyDesk extends StatelessWidget {
  const StudyDesk({
    super.key,
    required this.member,
    required this.since,
    required this.size,
    required this.deskTop,
    required this.width,
    required this.tagTop,
    this.idle = false,
    this.minFoldX = 0,
    this.leaving = false,
    this.floor,
    this.floorSize,
    this.onLeft,
  });

  /// The Fold's centre never goes left of this (clear of the pennant).
  final double minFoldX;
  final bool leaving;

  /// The member's floor slot (centre x, boots y) the exit hops land on.
  final Offset? floor;
  final double? floorSize;
  final VoidCallback? onLeft;

  static const double exitTotal = 1760;

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
    // Both the system's and the app's own reduced-motion setting.
    final reduced = Motion.reduced(context);
    final foldX = math.max(deskTop.dx - size * 0.3, minFoldX);
    final lampX = math.min(width - 10, math.max(deskTop.dx + size * 1.3, foldX + size * 0.5 + 30));
    if (leaving) return _leave(context, reduced: reduced, foldX: foldX, lampX: lampX);
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
            // Two hops up from the floor side (left and below the desk top), a 14 dp arc each, never through the
            // lamp: the first lands on the desk's front edge, the second by the paper.
            double hopY(double p) => -14 * 4 * p * (1 - p);
            final h1 = windowOf(ms, 450, 500);
            final h2 = windowOf(ms, 950, 500);
            final travel = reduced ? 0.0 : -(1 - (h1 * 0.5 + h2 * 0.5)) * size * 0.9;
            final lift = reduced ? 0.0 : (ms < 950 ? hopY(h1) + (1 - h1) * size * 0.55 : hopY(h2));
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
                      child: _StudyTag(name: member.name, since: since),
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

extension on StudyDesk {
  Widget _leave(BuildContext context, {required bool reduced, required double foldX, required double lampX}) {
    final colors = context.mmColors;
    final to = floor ?? Offset(foldX, deskTop.dy);
    final endSize = floorSize ?? size;
    return ExcludeSemantics(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: reduced ? MotionDurations.reducedFade : const Duration(milliseconds: 1760),
        onEnd: onLeft,
        builder: (context, t, _) {
          final ms = t * StudyDesk.exitTotal;
          final tag = reduced ? 1 - t : 1 - windowOf(ms, 0, 160);
          final a = reduced ? 0.0 : windowOf(ms, 160, 500, MotionCurves.sweep);
          final b = reduced ? 0.0 : windowOf(ms, 660, 500, MotionCurves.sweep);
          final f = (a + b) / 2;
          double arc(double p) => 4 * p * (1 - p);
          final x = foldX + (to.dx - foldX) * f;
          final y = deskTop.dy + (to.dy - deskTop.dy) * f - 18 * arc(a) - 14 * arc(b);
          final sz = size + (endSize - size) * f;
          final light = reduced ? 1 - t : 1 - windowOf(ms, 1160, 600, MotionCurves.sweep);
          final shown = reduced ? 1 - t : 1.0;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(
                    painter: _DeskLampPainter(lampX: lampX, deskY: deskTop.dy, target: deskTop.dx, bulb: light, beam: light, lamp: colors.lamp, metal: colors.isNight ? const Color(0xFF16151A) : const Color(0xFF2A2721), night: colors.isNight),
                  ),
                ),
              ),
              Positioned(
                left: x - sz / 2,
                top: y - sz + 2,
                width: sz,
                height: sz,
                child: Opacity(
                  opacity: shown.clamp(0.0, 1.0),
                  child: FoldPuppet(fold: member.fold, size: sz, shadow: false, finish: member.finish, fallbackName: member.name, fallbackColour: member.colour),
                ),
              ),
              if (tag > 0)
                Positioned(
                  right: MmSpace.gutter,
                  top: tagTop,
                  child: Opacity(
                    opacity: tag.clamp(0.0, 1.0),
                    child: _StudyTag(name: member.name, since: since),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// "Riya is studying" / "since 3:52 PM" on a small lamp-edged tag.
class _StudyTag extends StatelessWidget {
  const _StudyTag({required this.name, required this.since});

  final String name;
  final DateTime since;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Container(
      key: const ValueKey('den-studying-tag'),
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s6, MmSpace.s16, MmSpace.s6),
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
              Text(MobV4DenCopy.studying(name), style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
              Text(MobV4DenCopy.since(since), style: type.caption.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
        ],
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
