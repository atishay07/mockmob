// The den's event acts (MOB-MINIMAL 4.2), as reusable timelines and one player widget. The den stage
// (den_stage.dart, the den track) decides WHEN an act plays, on a real event only; this file decides HOW it moves.
//
//   A friend joins (about 2.3 s): two hops in from the edge, a landing squash 1.12/0.86 for 90 ms, the seat
//     outline folds away, the name engraves, the others glance toward the newcomer, the newcomer waves.
//     Reduced motion: a 120 ms cross-fade into the seat.
//   A reaction (about 1.7 s for four): everyone cheers 120 ms apart: an anticipation squash, a 14 dp hop, the pose
//     swap at the low point, back to idle by about 1.2 s each. Reduced motion: the pose swap only.
//   Studying now (about 1.7 s): the desk lamp's bulb (150 ms), then its beam (300 ms); the Fold hops twice to the
//     desk (500 ms each, scaling to 0.85 for depth), lands and swaps to think; the tag rises. When study stops the
//     lamp dims over 600 ms and the Fold hops back. Reduced motion: the lamp fades, the Fold appears.
//
// Every act is a pure function of its elapsed ms ([JoinAct.at], [ReactionAct.at], [DeskAct.at]) so frame strips and
// tests read exact frames, plus [DenActPlayer], which runs one act when its [DenActPlayer.actId] changes.

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../core/motion/motion.dart';
import '../data/mob_v3_models.dart' show FoldPose;

/// One frame of a Fold in an act: where it stands relative to its rest spot, its squash about the boots, its
/// pose, and how visible it is. Plus the act's props (seat outline, name, lamp, tag), each 0 to 1.
@immutable
class ActFrame {
  const ActFrame({
    this.dx = 0,
    this.dy = 0,
    this.scaleX = 1,
    this.scaleY = 1,
    this.depth = 1,
    this.pose = FoldPose.idle,
    this.opacity = 1,
    this.seat = 0,
    this.name = 1,
    this.glance = 0,
    this.bulb = 0,
    this.beam = 0,
    this.tag = 0,
  });

  /// Offset from the rest spot in dp (dy up is negative).
  final double dx;
  final double dy;

  /// Squash about the boots.
  final double scaleX;
  final double scaleY;

  /// Overall scale for depth (the desk sits further back: 0.85).
  final double depth;
  final FoldPose pose;
  final double opacity;

  /// The empty seat's outline: 1 shown, 0 folded away.
  final double seat;

  /// The name tag's engrave, 0 to 1.
  final double name;

  /// How far the OTHER Folds turn toward the newcomer, 0 to 1 (feeds their glance).
  final double glance;

  /// The desk lamp's bulb and beam, 0 to 1.
  final double bulb;
  final double beam;

  /// The "studying now" tag rising, 0 to 1.
  final double tag;
}

double _seg(double t, double start, double dur, [Curve curve = Curves.linear]) => curve.transform(((t - start) / dur).clamp(0.0, 1.0));

/// A hop's height at 0..1 of its arc (a parabola, 0 at both ends).
double _arc(double p) => 4 * p * (1 - p);

/// A landing squash at [t] ms after touching down: [sx]/[sy] at the low point for [hold] ms, then back.
(double, double) _squash(double t, {double sx = 1.12, double sy = 0.86, double hold = 90}) {
  if (t < 0 || t > hold * 2) return (1, 1);
  final k = t <= hold ? math.sin(math.pi / 2 * (t / hold)) : 1 - _seg(t, hold, hold, Curves.easeOut);
  return (1 + (sx - 1) * k, 1 + (sy - 1) * k);
}

/// A friend joins: [fromDx] is where they enter from (the stage edge, relative to the seat; negative = left).
abstract final class JoinAct {
  static const double total = 2300;
  static const double hop1 = 0;
  static const double hop2 = 480;
  static const double hopDur = 480;
  static const double land = 960;
  static const double seatFold = 1000;
  static const double nameAt = 1240;
  static const double glanceAt = 1240;
  static const double waveAt = 1560;

  static ActFrame at(double ms, {required double fromDx, bool reduced = false}) {
    if (reduced) {
      final o = _seg(ms, 0, 120);
      return ActFrame(opacity: o, seat: 1 - o, name: o);
    }
    // Two hops: from the edge to half way, then onto the seat; 26 dp and 18 dp high.
    final p1 = _seg(ms, hop1, hopDur);
    final p2 = _seg(ms, hop2, hopDur);
    final dx = fromDx * (1 - 0.5 * Curves.easeOut.transform(p1) - 0.5 * Curves.easeOut.transform(p2));
    final dy = ms < hop2 ? -26 * _arc(p1) : -18 * _arc(p2);
    final (sx, sy) = _squash(ms - land);
    final glance = _seg(ms, glanceAt, 160) * (1 - _seg(ms, glanceAt + 900, 160));
    final pose = ms >= waveAt && ms < total - 120 ? FoldPose.wave : FoldPose.idle;
    return ActFrame(
      dx: dx,
      dy: dy,
      scaleX: sx,
      scaleY: sy,
      pose: pose,
      opacity: _seg(ms, 0, 120),
      seat: 1 - _seg(ms, seatFold, 280, Motion.emphasized),
      name: _seg(ms, nameAt, 280),
      glance: glance,
    );
  }
}

/// A reaction (a result lands, a friend tops a game): member [index] starts 120 ms after the one before.
abstract final class ReactionAct {
  static const double stagger = 120;
  static const double each = 1200;

  /// The whole act's length for [members] Folds (about 1.56 s for four).
  static double totalFor(int members) => stagger * math.max(0, members - 1) + each;

  static ActFrame at(double ms, {required int index, bool reduced = false}) {
    final t = ms - index * stagger;
    if (t < 0) return const ActFrame();
    if (reduced) return ActFrame(pose: t < each ? FoldPose.cheer : FoldPose.idle);
    // 0-90 anticipation squash (0.92 high, 1.06 wide); 90-450 the 14 dp hop; the pose swaps to cheer at the low
    // point (90); 450 lands with a small squash; back to idle at 1100.
    final (asx, asy) = t < 180 ? _squash(t, sx: 1.06, sy: 0.92) : (1.0, 1.0);
    final hop = _seg(t, 90, 360);
    final (lsx, lsy) = _squash(t - 450, sx: 1.08, sy: 0.9, hold: 70);
    return ActFrame(
      dy: -14 * _arc(hop),
      scaleX: asx * lsx,
      scaleY: asy * lsy,
      pose: t >= 90 && t < 1100 ? FoldPose.cheer : FoldPose.idle,
    );
  }
}

/// Studying now: to the desk ([toDesk] true) or back from it. [deskDx]/[deskDy]: the desk spot relative to the seat.
abstract final class DeskAct {
  static const double bulbAt = 0;
  static const double beamAt = 150;
  static const double hop1 = 450;
  static const double hopDur = 500;
  static const double landAt = 1450;
  static const double tagAt = 1450;
  static const double total = 1700;
  static const double dimDur = 600;
  static const double backTotal = 1600;

  static ActFrame at(double ms, {required bool toDesk, required double deskDx, required double deskDy, bool reduced = false}) {
    if (toDesk) {
      if (reduced) {
        final o = _seg(ms, 0, 120);
        return ActFrame(dx: deskDx, dy: deskDy, depth: 0.85, pose: FoldPose.think, bulb: o, beam: o, tag: o, opacity: o);
      }
      final p1 = _seg(ms, hop1, hopDur);
      final p2 = _seg(ms, hop1 + hopDur, hopDur);
      final along = 0.5 * Curves.easeInOut.transform(p1) + 0.5 * Curves.easeInOut.transform(p2);
      final up = ms < hop1 + hopDur ? 20 * _arc(p1) : 16 * _arc(p2);
      final (sx, sy) = _squash(ms - landAt);
      return ActFrame(
        dx: deskDx * along,
        dy: deskDy * along - up,
        depth: 1 - 0.15 * along,
        scaleX: sx,
        scaleY: sy,
        pose: ms >= landAt + 45 ? FoldPose.think : FoldPose.idle,
        bulb: _seg(ms, bulbAt, 150),
        beam: _seg(ms, beamAt, 300, Curves.easeOut),
        tag: _seg(ms, tagAt, 250, Motion.emphasized),
      );
    }
    // Back: the lamp dims over 600 ms while the tag leaves, then two hops home from 600.
    final dim = 1 - _seg(ms, 0, dimDur, Curves.easeIn);
    if (reduced) return ActFrame(dx: 0, dy: 0, bulb: dim, beam: dim, tag: 0);
    final p1 = _seg(ms, dimDur, hopDur);
    final p2 = _seg(ms, dimDur + hopDur, hopDur * 0.8);
    final home = 0.5 * Curves.easeInOut.transform(p1) + 0.5 * Curves.easeInOut.transform(p2);
    final up = ms < dimDur + hopDur ? 16 * _arc(p1) : 20 * _arc(p2);
    final (sx, sy) = _squash(ms - (dimDur + hopDur + hopDur * 0.8));
    return ActFrame(
      dx: deskDx * (1 - home),
      dy: deskDy * (1 - home) - up,
      depth: 0.85 + 0.15 * home,
      scaleX: sx,
      scaleY: sy,
      pose: FoldPose.idle,
      bulb: dim,
      beam: dim,
      tag: 1 - _seg(ms, 0, 200),
    );
  }
}

/// The kinds of act [DenActPlayer] runs.
enum DenActKind { join, reaction, toDesk, fromDesk }

/// Runs one den act on [child] whenever [actId] changes (the den bumps it on the real event). [builder] gets the
/// frame to draw the Fold with (pose, name, glance, lamp and tag); the player applies the travel and squash about
/// the boots itself. Reduced motion uses each act's reduced frames. Between acts the frame is the act's end state.
class DenActPlayer extends StatefulWidget {
  const DenActPlayer({
    super.key,
    required this.kind,
    required this.actId,
    required this.builder,
    this.index = 0,
    this.members = 1,
    this.fromDx = -120,
    this.deskDx = 0,
    this.deskDy = 0,
    this.onDone,
  });

  final DenActKind kind;

  /// Bump to play (0: never played; the rest frame shows).
  final int actId;

  /// Draws the Fold for a frame (no travel: the player moves it).
  final Widget Function(BuildContext context, ActFrame frame) builder;

  /// Reaction: this Fold's place in the cheer and how many cheer.
  final int index;
  final int members;

  /// Join: where the newcomer enters from, relative to the seat.
  final double fromDx;

  /// Desk: the desk spot relative to the seat.
  final double deskDx;
  final double deskDy;
  final VoidCallback? onDone;

  /// The act's length in ms.
  double get totalMs => switch (kind) {
        DenActKind.join => JoinAct.total,
        DenActKind.reaction => ReactionAct.totalFor(members),
        DenActKind.toDesk => DeskAct.total,
        DenActKind.fromDesk => DeskAct.backTotal,
      };

  /// The frame of this act at [ms] (public for frame strips and tests).
  ActFrame frameAt(double ms, {bool reduced = false}) => switch (kind) {
        DenActKind.join => JoinAct.at(ms, fromDx: fromDx, reduced: reduced),
        DenActKind.reaction => ReactionAct.at(ms, index: index, reduced: reduced),
        DenActKind.toDesk => DeskAct.at(ms, toDesk: true, deskDx: deskDx, deskDy: deskDy, reduced: reduced),
        DenActKind.fromDesk => DeskAct.at(ms, toDesk: false, deskDx: deskDx, deskDy: deskDy, reduced: reduced),
      };

  @override
  State<DenActPlayer> createState() => _DenActPlayerState();
}

class _DenActPlayerState extends State<DenActPlayer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, value: 1);

  @override
  void didUpdateWidget(DenActPlayer old) {
    super.didUpdateWidget(old);
    if (widget.actId != old.actId && widget.actId != 0) _play();
  }

  void _play() {
    final reduced = Motion.reduced(context);
    final ms = reduced ? 120.0 : widget.totalMs;
    _c.duration = Duration(milliseconds: ms.round());
    _c.forward(from: 0).whenCompleteOrCancel(() {
      if (mounted) widget.onDone?.call();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final ms = _c.value * (reduced ? 120 : widget.totalMs);
        final f = widget.actId == 0 ? const ActFrame() : widget.frameAt(ms, reduced: reduced);
        return ActTransform(frame: f, child: widget.builder(context, f));
      },
    );
  }
}

/// Applies a frame's travel, depth and squash to [child], pivoted at the boots (bottom centre).
class ActTransform extends StatelessWidget {
  const ActTransform({super.key, required this.frame, required this.child});

  final ActFrame frame;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: frame.opacity.clamp(0.0, 1.0),
      child: Transform.translate(
        offset: Offset(frame.dx, frame.dy),
        child: Transform(
          alignment: Alignment.bottomCenter,
          transform: Matrix4.diagonal3Values(frame.scaleX * frame.depth, frame.scaleY * frame.depth, 1),
          child: child,
        ),
      ),
    );
  }
}
