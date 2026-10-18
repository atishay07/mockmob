import 'dart:math' as math;

import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import 'motion_tokens.g.dart';
import 'reduced_motion.dart';

export 'draw.dart';
export 'drag_commit.dart';
export 'entrance.dart';
export 'fade_through.dart';
export 'fold_exit.dart';
export 'launch_rect.dart';
export 'object_react.dart';
export 'pull_refresh.dart';
export 'scroll_effects.dart';
export 'scrub.dart';
export 'shake.dart';
export 'size_ease.dart';
export 'springs.dart';

/// Motion tokens (Night Sheet brief, section 7). Only opacity and transform animate, inside a
/// RepaintBoundary. Things glide and land with weight; they do not bounce.
///
/// The values come from `shared/motion-tokens.json` through the generated `motion_tokens.g.dart`
/// (`python tool/gen_motion_tokens.py`); the website reads the same JSON, so both move alike.
/// Change a value there, never here.
///
/// Never moves: question text, options, the timer, explanation body, numbers after landing.
abstract final class Motion {
  // ---- Night Sheet vocabulary -------------------------------------------------------------

  /// Default enter: cubic-bezier(0.15, 0.5, 0.5, 1), 300 ms.
  static const Cubic glide = MotionCurves.glide;
  static const Duration glideDuration = MotionDurations.glide;

  /// Default exit: cubic-bezier(0.4, 0.3, 0.8, 0.6), 200 ms.
  static const Cubic exit = MotionCurves.exit;
  static const Duration exitDuration = MotionDurations.exit;

  /// Container transforms (Start to sheet, card to detail): cubic-bezier(0.16, 1, 0.3, 1), 420 ms.
  static const Cubic emphasized = MotionCurves.emphasized;
  static const Duration emphasizedDuration = MotionDurations.emphasized;

  /// A soft light band crossing a surface once.
  static const Cubic sweepCurve = MotionCurves.sweep;
  static const Duration sweep = MotionDurations.sweep;

  /// Text revealed left to right by a mask.
  static const Duration engrave = MotionDurations.engrave;

  /// Digits rolling into place.
  static const Duration numberRoll = MotionDurations.numberRoll;

  /// How long a remembered number that changed holds its tint (volt on a rise, dim on a fall)
  /// after its digits land, before it settles back to its own colour.
  static const Duration numberInk = MotionDurations.numberInk;

  /// A bubble inking from the touch point.
  static const Duration ink = MotionDurations.ink;

  /// Reduced-motion replacement for an unfold or a reveal.
  static const Duration crossFade = MotionDurations.crossFade;

  // ---- Shared tokens (kept for existing screens) --------------------------------------------

  static const Duration press = MotionDurations.press;
  static const Duration release = MotionDurations.release;
  static const Duration ui = MotionDurations.ui;
  static const Duration card = MotionDurations.card;
  static const Duration result = MotionDurations.result;
  static const Duration figureRoll = numberRoll;

  /// Ceiling for a milestone, optional.
  static const Duration milestone = MotionDurations.milestone;

  /// Page transitions.
  static const Duration tabSwitch = MotionDurations.tabSwitch;
  static const Duration pagePush = glideDuration;
  static const Duration pagePop = MotionDurations.pagePop;
  static const Duration runner = MotionDurations.runner;
  static const Duration sheetIn = emphasizedDuration;
  static const Duration sheetOut = MotionDurations.sheetOut;

  /// Reduced-motion replacement for any movement: a short fade.
  static const Duration reducedFade = MotionDurations.reducedFade;

  /// Decelerating ease for UI that settles (the glide family).
  static const Cubic out = MotionCurves.out;
  static const Cubic drawer = MotionCurves.drawer;

  /// Position change only.
  static const Cubic inOut = MotionCurves.inOut;

  // ---- Choreography (UI blitz, docs/brain/ui-blitz/motion.md) ------------------------------

  /// Gap between staggered items.
  static const Duration staggerStep = MotionDurations.staggerStep;

  /// Items after this index arrive with it, so a long list never takes long.
  static const int staggerCap = MotionNumbers.staggerCap;

  /// One staggered item's own travel.
  static const Duration enterDuration = MotionDurations.enter;

  /// How far an entering item rises, in logical px.
  static const double enterRise = MotionNumbers.enterRise;

  /// Where an entering item starts its scale (never from 0).
  static const double enterScale = MotionNumbers.enterScale;

  /// Shared-axis travel of a pushed page, in logical px.
  static const double axisTravel = MotionNumbers.axisTravel;

  /// The covered page moves this share of [axisTravel] the other way while a scrim rises.
  static const double recedeShare = MotionNumbers.recedeShare;

  /// The ground scrim over a fully covered page.
  static const double recedeScrim = MotionNumbers.recedeScrim;

  /// Tab fade-through: the outgoing tab's fade, then the incoming tab's.
  static const Duration fadeThroughOut = MotionDurations.fadeThroughOut;
  static const Duration fadeThroughIn = MotionDurations.fadeThroughIn;

  /// Where the incoming tab starts its scale.
  static const double fadeThroughScale = MotionNumbers.fadeThroughScale;

  /// A count-up of an inline figure.
  static const Duration countUp = MotionDurations.countUp;

  /// One skeleton light sweep, then a rest; at most [shimmerSweeps] of them.
  static const Duration shimmerSweep = MotionDurations.shimmerSweep;
  static const Duration shimmerRest = MotionDurations.shimmerRest;
  static const int shimmerSweeps = MotionNumbers.shimmerSweeps;

  /// Anything leaving for good: cubic-bezier(0.5, 0, 0.75, 0), 180 ms.
  static const Cubic leave = MotionCurves.leave;
  static const Duration leaveDuration = MotionDurations.leave;

  // ---- Phase 2 additions (docs/brain/ui-phase2/MOTION.md section 2) --------------------------

  /// The longest a ladder T2 moment (practice set acknowledged, repair finished, mock received)
  /// may run, from first frame to rest. Celebrations assert against it in tests.
  static const Duration momentT2 = MotionDurations.momentT2;

  /// The longest a ladder T3 moment (plan sealed, first full mock, a milestone) may run.
  static const Duration momentT3 = MotionDurations.momentT3;

  /// The bar and a screen's chrome leaving for a focused task (on [leave]), and coming back
  /// (on [glide]).
  static const Duration handOffOut = MotionDurations.handOffOut;
  static const Duration handOffIn = MotionDurations.handOffIn;

  /// One duration for charts, roads, bars and threads drawing in (on [emphasized]). They used to
  /// range from 520 to 620 ms.
  static const Duration drawIn = MotionDurations.drawIn;

  /// How far a surface of [width] dp sinks when pressed: at most 4% and at most about 8 dp across.
  /// A 340 dp hero at a flat 0.96 sank 14 dp and read as a bounce; small keys keep 0.96.
  static double pressedScaleFor(double width) => 1 - math.min(0.04, 8 / math.max(width, 1));

  /// [d], or zero when motion is reduced.
  static Duration of(BuildContext c, Duration d) => reduced(c) ? Duration.zero : d;

  static bool reduced(BuildContext c) => MediaQuery.disableAnimationsOf(c) || ReducedMotionSetting.of(c);

  /// A [SpringSimulation] from [from] to [to] with [spring], keeping [velocity].
  static SpringSimulation spring(SpringDescription spring, double from, double to, {double velocity = 0}) =>
      SpringSimulation(spring, from, to, velocity);
}

/// The default for any keyed content swap (a tab's body, a filter's list, a loaded state replacing
/// its skeleton): it never shows a blank frame between the two.
///
/// When [child] changes key, the incoming layer fades in over [duration] on [Motion.glide] while
/// the outgoing layer holds at full strength; only once the incoming layer is half visible does the
/// outgoing one fade, over [outDuration] (90 ms). The two layers' summed opacity never drops below
/// [floor] (0.7), so the ground never shows through. Both layers sit in their own
/// `RepaintBoundary`; the outgoing one ignores touches and is hidden from TalkBack. A swap in the
/// middle of a swap holds what is showing and starts again from there.
///
/// Prefer it to a bare `AnimatedSwitcher`, whose default cross-fade dips to about half strength in
/// the middle and reads as a flash on the dark ground. It is the default for every keyed content
/// swap in the app (`MmSkeletonSwitcher` is built on it).
///
/// Three variants share that overlap; they differ only in the transform the layers carry:
/// - [MmOverlapSwitcher.fade] (the default constructor): opacity only, the content changes in place;
/// - [MmOverlapSwitcher.rise]: the incoming layer also rises [Motion.enterRise] from
///   [Motion.enterScale] on [Motion.emphasized] (new content arriving), over [Motion.enterDuration];
/// - [MmOverlapSwitcher.axis]: a shared-axis step, the incoming layer travelling in from the side
///   its `direction` points to on [Motion.glide] while the outgoing one drifts
///   [Motion.recedeShare] of that travel the other way (a wizard's next or previous step).
///
/// Under reduced motion it stays a fade (opacity only, nothing travels) but a short one: the
/// incoming layer arrives over [Motion.reducedFade].
class MmOverlapSwitcher extends StatefulWidget {
  const MmOverlapSwitcher({
    super.key,
    required this.child,
    this.duration = Motion.fadeThroughIn,
    this.outDuration = Motion.fadeThroughOut,
    this.alignment = Alignment.topCenter,
    this.animateFirst = false,
    this.fit = StackFit.loose,
    this.swap = MmSwap.fade,
  });

  /// Opacity only: the same as the default constructor.
  const MmOverlapSwitcher.fade({
    super.key,
    required this.child,
    this.duration = Motion.fadeThroughIn,
    this.outDuration = Motion.fadeThroughOut,
    this.alignment = Alignment.topCenter,
    this.animateFirst = false,
    this.fit = StackFit.loose,
  }) : swap = MmSwap.fade;

  /// The incoming layer rises into place as it fades in.
  const MmOverlapSwitcher.rise({
    super.key,
    required this.child,
    this.duration = Motion.enterDuration,
    this.outDuration = Motion.fadeThroughOut,
    this.alignment = Alignment.topCenter,
    this.animateFirst = false,
    this.fit = StackFit.loose,
  }) : swap = MmSwap.rise;

  /// A shared-axis step: [direction] 1 brings the new content in from the trailing edge (forward),
  /// -1 from the leading edge (back); [travel] is how far it comes (dp).
  MmOverlapSwitcher.axis({
    super.key,
    required this.child,
    int direction = 1,
    double travel = Motion.axisTravel,
    this.duration = Motion.glideDuration,
    this.outDuration = Motion.fadeThroughOut,
    this.alignment = Alignment.topCenter,
    this.animateFirst = false,
    this.fit = StackFit.loose,
  }) : swap = MmSwap.axis(direction: direction, travel: travel);

  final Widget child;
  final Duration duration;
  final Duration outDuration;
  final AlignmentGeometry alignment;

  /// The transform the layers carry while they swap (opacity is the same for every variant).
  final MmSwap swap;

  /// How the two layers are sized in their stack. [StackFit.passthrough] hands both the parent's
  /// constraints unchanged (a full-width skeleton and its content).
  final StackFit fit;

  /// Fades the first child in as well (off: it is simply there).
  final bool animateFirst;

  /// The incoming opacity at which the outgoing layer starts to go.
  static const double releaseAt = MotionNumbers.overlapRelease;

  /// The least summed opacity of the two layers.
  static const double floor = MotionNumbers.overlapFloor;

  /// The opacity of an outgoing layer whose own fade is at [own], which held at [heldFrom] when it
  /// started leaving, while the incoming layer shows at [incoming]. It never rises above where it
  /// held, and never lets the sum of the two fall under [floor].
  static double outgoingOpacity(double own, double incoming, {double heldFrom = 1}) =>
      math.max(own, math.min(heldFrom, floor - incoming)).clamp(0.0, 1.0);

  @override
  State<MmOverlapSwitcher> createState() => _MmOverlapSwitcherState();
}

/// How an [MmOverlapSwitcher]'s layers move while they swap. Opacity always follows the overlap
/// rule; a variant only adds a transform (translate and scale, nothing that lays out).
@immutable
class MmSwap {
  const MmSwap._(this._kind, {this.travel = 0}) : direction = 1;

  /// Opacity only.
  static const MmSwap fade = MmSwap._(_SwapKind.fade);

  /// The incoming layer rises [Motion.enterRise] from [Motion.enterScale].
  static const MmSwap rise = MmSwap._(_SwapKind.rise, travel: Motion.enterRise);

  /// The incoming layer travels [travel] in from the side [direction] points to (1: from the
  /// trailing edge; -1: from the leading edge); the outgoing one drifts [Motion.recedeShare] of it
  /// the other way.
  const MmSwap.axis({int direction = 1, this.travel = Motion.axisTravel})
      : _kind = _SwapKind.axis,
        direction = direction < 0 ? -1 : 1;

  final _SwapKind _kind;

  /// 1 forward, -1 back (axis only).
  final int direction;

  /// How far the incoming layer comes, in dp.
  final double travel;

  /// Whether the layers carry a transform at all.
  bool get moves => _kind != _SwapKind.fade;

  /// The incoming layer's offset when its own fade is at [v] (0 to 1, linear). [sign] is -1 in a
  /// right-to-left layout, so "trailing" stays trailing.
  Offset incomingOffset(double v, {double sign = 1}) {
    final t = v.clamp(0.0, 1.0);
    return switch (_kind) {
      _SwapKind.fade => Offset.zero,
      _SwapKind.rise => Offset(0, travel * (1 - Motion.emphasized.transform(t))),
      _SwapKind.axis => Offset(direction * sign * travel * (1 - Motion.glide.transform(t)), 0),
    };
  }

  /// The incoming layer's scale when its own fade is at [v].
  double incomingScale(double v) {
    if (_kind != _SwapKind.rise) return 1;
    final t = Motion.emphasized.transform(v.clamp(0.0, 1.0));
    return Motion.enterScale + (1 - Motion.enterScale) * t;
  }

  /// The outgoing layer's drift while the incoming layer's fade is at [v].
  Offset outgoingOffset(double v, {double sign = 1}) {
    if (_kind != _SwapKind.axis) return Offset.zero;
    final t = Motion.glide.transform(v.clamp(0.0, 1.0));
    return Offset(-direction * sign * travel * Motion.recedeShare * t, 0);
  }

  @override
  bool operator ==(Object other) =>
      other is MmSwap && other._kind == _kind && other.direction == direction && other.travel == travel;

  @override
  int get hashCode => Object.hash(_kind, direction, travel);

  @override
  String toString() => switch (_kind) {
        _SwapKind.fade => 'MmSwap.fade',
        _SwapKind.rise => 'MmSwap.rise',
        _SwapKind.axis => 'MmSwap.axis(direction: $direction, travel: $travel)',
      };
}

enum _SwapKind { fade, rise, axis }

class _OverlapLayer {
  _OverlapLayer(this.id, this.child, this.fade, this.swap);

  final int id;
  Widget child;
  final AnimationController fade;

  /// The variant this layer arrived with (a later swap's direction does not turn it round).
  final MmSwap swap;
  double heldFrom = 1;
  bool leaving = false;

  /// Where it was, and how big, when it stopped being the incoming layer.
  Offset heldOffset = Offset.zero;
  double heldScale = 1;
}

class _MmOverlapSwitcherState extends State<MmOverlapSwitcher> with TickerProviderStateMixin {
  int _ids = 0;
  late _OverlapLayer _current;
  final List<_OverlapLayer> _outgoing = [];

  double _incomingOpacity() => Motion.glide.transform(_current.fade.value.clamp(0.0, 1.0));
  bool _begun = false;

  /// The incoming fade: [MmOverlapSwitcher.duration], or the short reduced-motion fade.
  Duration get _inDuration => Motion.reduced(context) ? Motion.reducedFade : widget.duration;

  @override
  void initState() {
    super.initState();
    _current = _layer(widget.child, value: widget.animateFirst ? 0 : 1);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_begun) return;
    _begun = true;
    // The first fade starts here, where reduced motion can be read.
    if (widget.animateFirst) {
      _current.fade
        ..duration = _inDuration
        ..forward();
    }
  }

  _OverlapLayer _layer(Widget child, {required double value, Duration? duration}) {
    final c = AnimationController(vsync: this, duration: duration ?? widget.duration, value: value);
    final layer = _OverlapLayer(_ids++, child, c, widget.swap);
    c
      ..addListener(() => _onIncoming(layer))
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) _landed(layer);
      });
    return layer;
  }

  /// The incoming layer has landed at full strength on top: the swap is over, and any layer still
  /// leaving goes now (on real frames they have already faded; a long frame must not leave the old
  /// content behind the new).
  void _landed(_OverlapLayer layer) {
    if (!mounted || !identical(layer, _current) || _outgoing.isEmpty) return;
    final gone = List<_OverlapLayer>.of(_outgoing);
    setState(_outgoing.clear);
    for (final out in gone) {
      out.fade.dispose();
    }
  }

  void _onIncoming(_OverlapLayer layer) {
    if (!identical(layer, _current) || _outgoing.isEmpty) return;
    if (_incomingOpacity() < MmOverlapSwitcher.releaseAt) return;
    for (final out in _outgoing) {
      if (out.leaving) continue;
      out.leaving = true;
      out.fade
        ..duration = widget.outDuration
        ..animateTo(0, duration: widget.outDuration, curve: Curves.linear).whenCompleteOrCancel(() => _drop(out));
    }
  }

  void _drop(_OverlapLayer layer) {
    if (!mounted || !_outgoing.contains(layer) || layer.fade.value > 0) return;
    setState(() => _outgoing.remove(layer));
    layer.fade.dispose();
  }

  @override
  void didUpdateWidget(MmOverlapSwitcher old) {
    super.didUpdateWidget(old);
    if (Widget.canUpdate(_current.child, widget.child)) {
      _current.child = widget.child;
      return;
    }
    // The showing layer holds where it is and becomes the outgoing one.
    final held = _current;
    held.fade.stop();
    // Where it is now, so it leaves from there rather than jumping to rest first.
    final moving = held.swap.moves && !Motion.reduced(context);
    held.heldOffset = moving ? held.swap.incomingOffset(held.fade.value, sign: _sign) : Offset.zero;
    held.heldScale = moving ? held.swap.incomingScale(held.fade.value) : 1;
    held.heldFrom = _incomingOpacityOf(held);
    held.fade.value = held.heldFrom;
    for (final out in _outgoing) {
      // Older leavers keep fading; one that had not started holds until this swap releases it.
      out.heldFrom = math.min(out.heldFrom, out.fade.value);
    }
    _outgoing.add(held);
    while (_outgoing.length > 2) {
      _outgoing.removeAt(0).fade.dispose();
    }
    _current = _layer(widget.child, value: 0, duration: _inDuration);
    _current.fade.forward();
  }

  /// The opacity a layer shows as the incoming one (its controller runs 0 to 1 on glide).
  double _incomingOpacityOf(_OverlapLayer layer) => Motion.glide.transform(layer.fade.value.clamp(0.0, 1.0));

  /// -1 in a right-to-left layout.
  double get _sign => Directionality.maybeOf(context) == TextDirection.rtl ? -1 : 1;

  /// The transform of [l]: its own arrival while incoming; while leaving, where it was held plus
  /// the drift the incoming layer's variant gives it.
  Widget _moved(_OverlapLayer l, {required bool leaving, required bool still, required Widget child}) {
    final Offset offset;
    final double scale;
    if (still) {
      offset = Offset.zero;
      scale = 1;
    } else if (leaving) {
      offset = l.heldOffset + _current.swap.outgoingOffset(_current.fade.value, sign: _sign);
      scale = l.heldScale;
    } else {
      offset = l.swap.incomingOffset(l.fade.value, sign: _sign);
      scale = l.swap.incomingScale(l.fade.value);
    }
    return Transform.translate(
      offset: offset,
      child: Transform.scale(scale: scale, alignment: Alignment.topCenter, child: child),
    );
  }

  @override
  void dispose() {
    _current.fade.dispose();
    for (final out in _outgoing) {
      out.fade.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = _current;
    // A moving variant always wraps its layers in the same transforms (so a layer never remounts);
    // under reduced motion they stay at rest and the swap is the short fade.
    final moves = widget.swap.moves;
    final still = Motion.reduced(context);
    // One structure for both roles, so the showing layer keeps its state when it becomes the
    // outgoing one.
    Widget layer(_OverlapLayer l, {required bool leaving}) => KeyedSubtree(
          key: ValueKey<int>(l.id),
          child: IgnorePointer(
            ignoring: leaving,
            child: ExcludeSemantics(
              excluding: leaving,
              child: RepaintBoundary(
                child: AnimatedBuilder(
                  animation: leaving ? Listenable.merge([l.fade, current.fade]) : l.fade,
                  builder: (context, child) {
                    final faded = Opacity(
                      opacity: leaving
                          ? MmOverlapSwitcher.outgoingOpacity(l.fade.value, _incomingOpacity(), heldFrom: l.heldFrom)
                          : _incomingOpacityOf(l),
                      child: child,
                    );
                    return moves ? _moved(l, leaving: leaving, still: still, child: faded) : faded;
                  },
                  child: l.child,
                ),
              ),
            ),
          ),
        );
    return Stack(
      alignment: widget.alignment,
      fit: widget.fit,
      children: [
        for (final out in _outgoing) layer(out, leaving: true),
        layer(current, leaving: false),
      ],
    );
  }
}
