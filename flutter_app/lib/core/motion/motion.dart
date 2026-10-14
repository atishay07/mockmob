import 'dart:math' as math;

import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import 'reduced_motion.dart';

export 'draw.dart';
export 'drag_commit.dart';
export 'entrance.dart';
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
/// Never moves: question text, options, the timer, explanation body, numbers after landing.
abstract final class Motion {
  // ---- Night Sheet vocabulary -------------------------------------------------------------

  /// Default enter: cubic-bezier(0.15, 0.5, 0.5, 1), 300 ms.
  static const Cubic glide = Cubic(0.15, 0.5, 0.5, 1);
  static const Duration glideDuration = Duration(milliseconds: 300);

  /// Default exit: cubic-bezier(0.4, 0.3, 0.8, 0.6), 200 ms.
  static const Cubic exit = Cubic(0.4, 0.3, 0.8, 0.6);
  static const Duration exitDuration = Duration(milliseconds: 200);

  /// Container transforms (Start to sheet, card to detail): cubic-bezier(0.16, 1, 0.3, 1), 420 ms.
  static const Cubic emphasized = Cubic(0.16, 1, 0.3, 1);
  static const Duration emphasizedDuration = Duration(milliseconds: 420);

  /// A soft light band crossing a surface once.
  static const Cubic sweepCurve = Cubic(0.45, 0, 0.55, 1);
  static const Duration sweep = Duration(milliseconds: 700);

  /// Text revealed left to right by a mask.
  static const Duration engrave = Duration(milliseconds: 280);

  /// Digits rolling into place.
  static const Duration numberRoll = Duration(milliseconds: 500);

  /// A bubble inking from the touch point.
  static const Duration ink = Duration(milliseconds: 260);

  /// Reduced-motion replacement for an unfold or a reveal.
  static const Duration crossFade = Duration(milliseconds: 200);

  // ---- Shared tokens (kept for existing screens) --------------------------------------------

  static const Duration press = Duration(milliseconds: 100);
  static const Duration release = Duration(milliseconds: 140);
  static const Duration ui = Duration(milliseconds: 200);
  static const Duration card = Duration(milliseconds: 240);
  static const Duration result = Duration(milliseconds: 320);
  static const Duration figureRoll = numberRoll;

  /// Ceiling for a milestone, optional.
  static const Duration milestone = Duration(milliseconds: 500);

  /// Page transitions.
  static const Duration tabSwitch = Duration(milliseconds: 180);
  static const Duration pagePush = glideDuration;
  static const Duration pagePop = Duration(milliseconds: 220);
  static const Duration runner = Duration(milliseconds: 160);
  static const Duration sheetIn = emphasizedDuration;
  static const Duration sheetOut = Duration(milliseconds: 240);

  /// Reduced-motion replacement for any movement: a short fade.
  static const Duration reducedFade = Duration(milliseconds: 120);

  /// Decelerating ease for UI that settles (the glide family).
  static const Cubic out = Cubic(0.23, 1, 0.32, 1);
  static const Cubic drawer = Cubic(0.32, 0.72, 0, 1);

  /// Position change only.
  static const Cubic inOut = Cubic(0.77, 0, 0.175, 1);

  // ---- Choreography (UI blitz, docs/brain/ui-blitz/motion.md) ------------------------------

  /// Gap between staggered items.
  static const Duration staggerStep = Duration(milliseconds: 45);

  /// Items after this index arrive with it, so a long list never takes long.
  static const int staggerCap = 8;

  /// One staggered item's own travel.
  static const Duration enterDuration = Duration(milliseconds: 360);

  /// How far an entering item rises, in logical px.
  static const double enterRise = 14;

  /// Where an entering item starts its scale (never from 0).
  static const double enterScale = 0.97;

  /// Shared-axis travel of a pushed page, in logical px.
  static const double axisTravel = 28;

  /// The covered page moves this share of [axisTravel] the other way while a scrim rises.
  static const double recedeShare = 0.22;

  /// The ground scrim over a fully covered page.
  static const double recedeScrim = 0.45;

  /// Tab fade-through: the outgoing tab's fade, then the incoming tab's.
  static const Duration fadeThroughOut = Duration(milliseconds: 90);
  static const Duration fadeThroughIn = Duration(milliseconds: 210);

  /// Where the incoming tab starts its scale.
  static const double fadeThroughScale = 0.985;

  /// A count-up of an inline figure.
  static const Duration countUp = Duration(milliseconds: 720);

  /// One skeleton light sweep, then a rest; at most [shimmerSweeps] of them.
  static const Duration shimmerSweep = Duration(milliseconds: 1400);
  static const Duration shimmerRest = Duration(milliseconds: 250);
  static const int shimmerSweeps = 4;

  /// Anything leaving for good: cubic-bezier(0.5, 0, 0.75, 0), 180 ms.
  static const Cubic leave = Cubic(0.5, 0, 0.75, 0);
  static const Duration leaveDuration = Duration(milliseconds: 180);

  // ---- Phase 2 additions (docs/brain/ui-phase2/MOTION.md section 2) --------------------------

  /// The longest a ladder T2 moment (practice set acknowledged, repair finished, mock received)
  /// may run, from first frame to rest. Celebrations assert against it in tests.
  static const Duration momentT2 = Duration(milliseconds: 1200);

  /// The longest a ladder T3 moment (plan sealed, first full mock, a milestone) may run.
  static const Duration momentT3 = Duration(milliseconds: 2000);

  /// The bar and a screen's chrome leaving for a focused task (on [leave]), and coming back
  /// (on [glide]).
  static const Duration handOffOut = Duration(milliseconds: 180);
  static const Duration handOffIn = Duration(milliseconds: 300);

  /// One duration for charts, roads, bars and threads drawing in (on [emphasized]). They used to
  /// range from 520 to 620 ms.
  static const Duration drawIn = Duration(milliseconds: 450);

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
/// Under reduced motion it stays a fade (opacity only, nothing travels) but a short one: the
/// incoming layer arrives over [Motion.reducedFade].
class MmOverlapSwitcher extends StatefulWidget {
  const MmOverlapSwitcher({
    super.key,
    required this.child,
    this.duration = Motion.fadeThroughIn,
    this.outDuration = const Duration(milliseconds: 90),
    this.alignment = Alignment.topCenter,
    this.animateFirst = false,
    this.fit = StackFit.loose,
  });

  final Widget child;
  final Duration duration;
  final Duration outDuration;
  final AlignmentGeometry alignment;

  /// How the two layers are sized in their stack. [StackFit.passthrough] hands both the parent's
  /// constraints unchanged (a full-width skeleton and its content).
  final StackFit fit;

  /// Fades the first child in as well (off: it is simply there).
  final bool animateFirst;

  /// The incoming opacity at which the outgoing layer starts to go.
  static const double releaseAt = 0.5;

  /// The least summed opacity of the two layers.
  static const double floor = 0.7;

  /// The opacity of an outgoing layer whose own fade is at [own], which held at [heldFrom] when it
  /// started leaving, while the incoming layer shows at [incoming]. It never rises above where it
  /// held, and never lets the sum of the two fall under [floor].
  static double outgoingOpacity(double own, double incoming, {double heldFrom = 1}) =>
      math.max(own, math.min(heldFrom, floor - incoming)).clamp(0.0, 1.0);

  @override
  State<MmOverlapSwitcher> createState() => _MmOverlapSwitcherState();
}

class _OverlapLayer {
  _OverlapLayer(this.id, this.child, this.fade);

  final int id;
  Widget child;
  final AnimationController fade;
  double heldFrom = 1;
  bool leaving = false;
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
    final layer = _OverlapLayer(_ids++, child, c);
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
                  builder: (context, child) => Opacity(
                    opacity: leaving
                        ? MmOverlapSwitcher.outgoingOpacity(l.fade.value, _incomingOpacity(), heldFrom: l.heldFrom)
                        : _incomingOpacityOf(l),
                    child: child,
                  ),
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
