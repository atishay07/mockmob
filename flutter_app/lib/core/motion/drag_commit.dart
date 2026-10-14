import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

import '../haptics/haptics.dart';
import 'motion.dart';

/// Which way a drag committed.
enum MmDragSide { left, right }

/// What the child does once a drag commits.
enum MmDragSettle {
  /// Springs back to rest (the runner's swipe to the next question: the content swaps behind it).
  back,

  /// Leaves past its own width and stays there (a dismissed row or recap card; the caller removes
  /// or replaces it, usually inside an `MmFoldExit`).
  exit,
}

/// Where a committed drag let go: the side, the child's offset in dp at release (what the next
/// content picks up from, so a swap continues the finger's motion instead of starting over) and
/// the finger's speed in dp per second.
@immutable
class MmDragRelease {
  const MmDragRelease({required this.side, required this.offset, required this.velocity});

  final MmDragSide side;
  final double offset;
  final double velocity;

  @override
  String toString() => 'MmDragRelease($side, offset: ${offset.toStringAsFixed(1)}, velocity: ${velocity.toStringAsFixed(0)})';
}

/// The arithmetic of [MmDragCommit], kept pure so it can be tested without a gesture.
abstract final class MmDragPolicy {
  /// A horizontal drag claims the pointer only when it is clearly sideways.
  static const double claimRatio = 2.2;

  /// Resistance past an edge (a side that does not commit, or beyond [maxTravelShare] of the width).
  static const double resist = 0.35;

  /// Commit past this share of the width...
  static const double commitShare = 0.35;

  /// ...or when released faster than this, in dp per second, toward an allowed side.
  static const double commitVelocity = 700;

  /// Travel beyond this share of the width rubber-bands.
  static const double maxTravelShare = 1.0;

  /// Whether a pointer that moved [delta] since it landed should be claimed as a horizontal drag:
  /// past the touch [slop] sideways and more than [claimRatio] times its vertical travel.
  static bool claims(Offset delta, {double slop = kTouchSlop, double ratio = claimRatio}) =>
      delta.dx.abs() > slop && delta.dx.abs() > ratio * delta.dy.abs();

  /// Whether the pointer should be given up to a vertical gesture (a scroll).
  static bool yields(Offset delta, {double slop = kTouchSlop, double ratio = claimRatio}) =>
      delta.dy.abs() > slop && delta.dx.abs() <= ratio * delta.dy.abs();

  /// The child's offset for a finger that has travelled [raw] dp: 1:1 toward an allowed side up to
  /// [maxTravel], then [resist]; a side that does not commit gives only [resist] from the start.
  static double follow(double raw, {required bool left, required bool right, required double maxTravel, double resist = resist}) {
    final allowed = raw >= 0 ? right : left;
    if (!allowed) return raw * resist;
    final limit = maxTravel;
    if (raw.abs() <= limit) return raw;
    final over = raw.abs() - limit;
    return raw.sign * (limit + over * resist);
  }

  /// The side a release at [offset] dp moving at [velocity] dp/s commits to, or null to spring back.
  /// A fling against the offset never commits, and a fast fling commits even when short.
  static MmDragSide? commits(
    double offset,
    double velocity, {
    required double distance,
    required bool left,
    required bool right,
    double minVelocity = commitVelocity,
  }) {
    MmDragSide? side(double sign) => sign > 0 ? (right ? MmDragSide.right : null) : (left ? MmDragSide.left : null);
    if (velocity.abs() >= minVelocity && (offset == 0 || velocity.sign == offset.sign)) {
      return side(velocity.sign);
    }
    if (offset.abs() >= distance && !(velocity.abs() >= minVelocity && velocity.sign != offset.sign)) {
      return side(offset.sign);
    }
    return null;
  }
}

/// A horizontal drag that follows the finger 1:1 and commits past a distance or a speed.
///
/// - It claims the pointer only when the drag is clearly sideways ([MmDragPolicy.claimRatio] times
///   its vertical travel), so a list it sits in still scrolls.
/// - The child moves by `Transform` only, on its own layer: no layout per frame.
/// - Past [MmDragPolicy.commitShare] of its width (or [commitDistance]) or on a fling it commits:
///   [onCommit] fires at release with the side, and the child springs away ([MmDragSettle.exit])
///   or home ([MmDragSettle.back]). Below the threshold it springs home with the finger's velocity.
/// - A side not in [left] / [right] rubber-bands at [MmDragPolicy.resist].
/// - Crossing the threshold while dragging ticks a selection haptic, both ways, so the finger
///   feels the point of no return.
/// - Grabbing it mid-settle stops the spring and carries on from where it is.
/// - [behind] paints under the child with the signed progress (-1 to 1 at the threshold), for the
///   reveal of a row ("Remove", "Saved"); it rebuilds per frame, keep it cheap.
/// - [follow] below 1 moves the child less than the finger (a recap card that leans at 0.35);
///   the thresholds still count the finger's travel.
/// - A cancelled pointer (the system took it, another gesture won) never commits: it springs home.
///
/// Under reduced motion the child still follows the finger (direct manipulation), and the settle
/// jumps instead of springing.
class MmDragCommit extends StatefulWidget {
  const MmDragCommit({
    super.key,
    required this.child,
    required this.onCommit,
    this.left = true,
    this.right = true,
    this.commitDistance,
    this.commitShare = MmDragPolicy.commitShare,
    this.commitVelocity = MmDragPolicy.commitVelocity,
    this.settle = MmDragSettle.back,
    this.behind,
    this.onProgress,
    this.onRelease,
    this.follow = 1,
    this.enabled = true,
    this.haptic = true,
  }) : assert(follow > 0 && follow <= 1, 'follow is a share of the finger travel, above 0 and at most 1.');

  final Widget child;

  /// Called once at release when the drag commits.
  final ValueChanged<MmDragSide>? onCommit;

  /// Which sides commit.
  final bool left;
  final bool right;

  /// The commit distance in dp of finger travel. Null: [commitShare] of the width.
  final double? commitDistance;

  /// The commit distance as a share of the width, when [commitDistance] is null (0.45 for a row
  /// that should take a deliberate swipe).
  final double commitShare;
  final double commitVelocity;
  final MmDragSettle settle;

  /// Painted under the child with the signed progress toward the threshold.
  final Widget Function(BuildContext context, double progress)? behind;

  /// The signed progress toward the threshold as it changes (drag and settle).
  final ValueChanged<double>? onProgress;

  /// Called with [onCommit] when a drag commits, with where the child was and how fast the finger
  /// moved, for a caller that carries the motion into the next content.
  final ValueChanged<MmDragRelease>? onRelease;

  /// The share of the finger's travel the child moves (1: under the finger).
  final double follow;
  final bool enabled;
  final bool haptic;

  @override
  State<MmDragCommit> createState() => MmDragCommitState();
}

class MmDragCommitState extends State<MmDragCommit> with SingleTickerProviderStateMixin {
  late final AnimationController _x = AnimationController.unbounded(vsync: this)..addListener(_changed);
  double _raw = 0;
  double _width = 1;
  bool _past = false;
  bool _gone = false;

  /// The child's current offset in dp.
  double get offset => _x.value;

  double get _distance => widget.commitDistance ?? _width * widget.commitShare;

  /// The child's offset in finger travel (the offset itself when [MmDragCommit.follow] is 1).
  double get _travel => _x.value / widget.follow;

  double get progress => _distance <= 0 ? 0 : (_travel / _distance).clamp(-1.0, 1.0);

  void _changed() => widget.onProgress?.call(progress);

  @override
  void dispose() {
    _x.dispose();
    super.dispose();
  }

  /// Brings an exited child back to rest (an Undo).
  void reset({bool animate = true}) {
    _gone = false;
    _past = false;
    if (!animate || Motion.reduced(context)) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0, velocity: _x.velocity));
    }
  }

  /// A settle grabbed by a landing finger, waiting to see whether a drag follows.
  bool _held = false;

  void _hold() {
    if (_gone || !_x.isAnimating) return;
    _x.stop();
    _held = true;
  }

  /// The finger that held a settle let go (or scrolled) without dragging: settle from here.
  void _unhold() {
    if (!_held || !mounted) return;
    _held = false;
    _past = false;
    if (Motion.reduced(context)) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0));
    }
  }

  void _start() {
    _held = false;
    _x.stop();
    _raw = _travel;
  }

  void _update(double dx) {
    _raw += dx;
    final next = MmDragPolicy.follow(
      _raw,
      left: widget.left,
      right: widget.right,
      maxTravel: _width * MmDragPolicy.maxTravelShare,
    );
    _x.value = next * widget.follow;
    final past = next.abs() >= _distance && ((next > 0 && widget.right) || (next < 0 && widget.left));
    if (past != _past) {
      _past = past;
      if (widget.haptic) hapticsOf(context)?.selection();
    }
  }

  /// The pointer was taken away mid-drag: never a commit, the child springs home.
  void _cancel() {
    _past = false;
    if (!mounted) return;
    if (Motion.reduced(context)) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0));
    }
  }

  void _end(double velocity) {
    final at = _x.value;
    final side = MmDragPolicy.commits(
      _travel,
      velocity,
      distance: _distance,
      left: widget.left,
      right: widget.right,
      minVelocity: widget.commitVelocity,
    );
    _past = false;
    final reduced = Motion.reduced(context);
    // The child moved at [MmDragCommit.follow] of the finger's speed; it keeps that speed.
    final carried = velocity * widget.follow;
    if (side != null && widget.settle == MmDragSettle.exit) {
      _gone = true;
      final target = (side == MmDragSide.right ? 1 : -1) * (_width * 1.1 + 24);
      if (reduced) {
        _x.value = target;
      } else {
        _x.animateWith(Motion.spring(Springs.lift, _x.value, target, velocity: carried));
      }
    } else if (reduced) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0, velocity: carried));
    }
    if (side != null) {
      widget.onCommit?.call(side);
      widget.onRelease?.call(MmDragRelease(side: side, offset: at, velocity: velocity));
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.enabled && !_gone && widget.onCommit != null;
    return LayoutBuilder(
      builder: (context, constraints) {
        _width = constraints.hasBoundedWidth ? constraints.maxWidth : MediaQuery.sizeOf(context).width;
        final moving = AnimatedBuilder(
          animation: _x,
          builder: (context, child) => Transform.translate(offset: Offset(_x.value, 0), child: child),
          child: RepaintBoundary(child: widget.child),
        );
        final behind = widget.behind;
        final body = behind == null
            ? moving
            : Stack(
                children: [
                  Positioned.fill(
                    child: AnimatedBuilder(animation: _x, builder: (context, _) => behind(context, progress)),
                  ),
                  moving,
                ],
              );
        if (!active) return body;
        return RawGestureDetector(
          behavior: HitTestBehavior.translucent,
          gestures: {
            MmSidewaysDragRecognizer: GestureRecognizerFactoryWithHandlers<MmSidewaysDragRecognizer>(
              () => MmSidewaysDragRecognizer(debugOwner: this),
              (r) => r
                ..onDown = _hold
                ..onIdle = _unhold
                ..onStart = _start
                ..onUpdate = _update
                ..onEnd = _end
                ..onCancel = _cancel,
            ),
          },
          child: body,
        );
      },
    );
  }
}

/// A drag recognizer that enters the arena like any other but accepts only when the pointer has
/// moved clearly sideways ([MmDragPolicy.claims]) and rejects as soon as it moves clearly vertical,
/// so a parent scroll wins vertical drags at once.
class MmSidewaysDragRecognizer extends OneSequenceGestureRecognizer {
  MmSidewaysDragRecognizer({super.debugOwner});

  /// A finger landed (before any claim): a settle in progress should hold still under it.
  VoidCallback? onDown;

  /// The finger left, or went to another gesture, without a drag beginning.
  VoidCallback? onIdle;
  VoidCallback? onStart;
  ValueChanged<double>? onUpdate;
  ValueChanged<double>? onEnd;
  VoidCallback? onCancel;

  VelocityTracker? _tracker;
  Offset _travel = Offset.zero;

  /// Won the arena (alone, a recognizer wins at once on pointer down).
  bool _won = false;

  /// The drag has begun: the pointer moved clearly sideways.
  bool _dragging = false;
  int? _pointer;

  @override
  void addAllowedPointer(PointerDownEvent event) {
    if (_pointer != null) return;
    super.addAllowedPointer(event);
    _pointer = event.pointer;
    _travel = Offset.zero;
    _won = false;
    _dragging = false;
    _tracker = VelocityTracker.withKind(event.kind)..addPosition(event.timeStamp, event.localPosition);
    onDown?.call();
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event.pointer != _pointer) return;
    if (event is PointerMoveEvent) {
      _tracker?.addPosition(event.timeStamp, event.localPosition);
      if (_dragging) {
        onUpdate?.call(event.localDelta.dx);
        return;
      }
      _travel += event.localDelta;
      if (MmDragPolicy.claims(_travel)) {
        if (!_won) resolve(GestureDisposition.accepted);
        if (_won) _begin();
      } else if (MmDragPolicy.yields(_travel)) {
        if (!_won) resolve(GestureDisposition.rejected);
        onIdle?.call();
        stopTrackingPointer(event.pointer);
      }
    } else if (event is PointerUpEvent || event is PointerCancelEvent) {
      if (_dragging) {
        _dragging = false;
        if (event is PointerUpEvent) {
          onEnd?.call(_tracker?.getVelocity().pixelsPerSecond.dx ?? 0);
        } else {
          onCancel?.call();
        }
      } else {
        if (!_won) resolve(GestureDisposition.rejected);
        onIdle?.call();
      }
      stopTrackingPointer(event.pointer);
    }
  }

  void _begin() {
    if (_dragging) return;
    _dragging = true;
    onStart?.call();
    // The travel that won the claim is applied at once, so the child is under the finger.
    onUpdate?.call(_travel.dx);
  }

  @override
  void acceptGesture(int pointer) {
    _won = true;
    if (MmDragPolicy.claims(_travel)) _begin();
  }

  @override
  void rejectGesture(int pointer) {
    if (_dragging) {
      _dragging = false;
      onCancel?.call();
    } else {
      onIdle?.call();
    }
    _won = false;
    stopTrackingPointer(pointer);
  }

  @override
  void didStopTrackingLastPointer(int pointer) {
    _pointer = null;
    _tracker = null;
  }

  @override
  String get debugDescription => 'mm sideways drag';
}
