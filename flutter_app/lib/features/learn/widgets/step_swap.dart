import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../../../core/motion/motion.dart';

/// Where a run's steps change: the new step arrives on a shared axis, and the one that leaves goes
/// the way its kind says. One set of numbers with the website (`study.css`, `StudyRun.jsx`).
///
/// - A step put away by rating it (a recall card) **flies off**: 56 dp to the left, a little lift,
///   a touch smaller, gone in about 150 ms, on [Springs.smooth] (a spring, not a timed tween).
/// - Any other step (a lesson block, a checked question) is left **on the axis**: it drifts a
///   fifth of the arrival's travel the other way and gives way once the new step is half there,
///   by the same overlap rule as [MmOverlapSwitcher] (the two never add up to less than 0.7, so the
///   ground does not flash through).
/// - The new step arrives 24 dp from the trailing edge, fading in over [Motion.glideDuration] on
///   [Motion.glide]. A tap during the arrival lands on the new step at once; the leaving step takes
///   no touches and is hidden from screen readers.
///
/// The swap happens when [stepKey] changes, which is when the server has acknowledged the event that
/// moves the run on, so a card never leaves before the rating is kept. Reduced motion: no travel,
/// no flight; the old step is gone and the new one fades in over [Motion.reducedFade].
///
/// Transform and opacity only, each layer on its own repaint boundary.
class StepSwap extends StatefulWidget {
  const StepSwap({
    super.key,
    required this.stepKey,
    required this.rated,
    required this.child,
  });

  /// Changes when the run moves to another step.
  final Object stepKey;

  /// This step is put away by rating it: when it leaves, it flies off.
  final bool rated;

  final Widget child;

  /// How far a new step travels in, in dp (the shared-axis step, a little under the pages' 28).
  static const double arriveTravel = 24;

  /// How far a rated card flies, how far it lifts and how small it ends, in dp and scale.
  static const double flyTravel = 56;
  static const double flyLift = 10;
  static const double flyScale = 0.97;

  /// The share of the flight's spring after which the card is fully gone (about 150 ms).
  static const double flyGoneAt = 0.55;

  /// A flying card's opacity at the spring's progress [t] (0 to 1).
  static double flyOpacity(double t) => (1 - t / flyGoneAt).clamp(0.0, 1.0);

  /// A flying card's offset in dp at the spring's progress [t].
  static Offset flyOffset(double t) => Offset(-flyTravel * t, -flyLift * t);

  /// A flying card's scale at the spring's progress [t].
  static double flyScaleAt(double t) => 1 - (1 - flyScale) * t;

  /// The leaving step of an axis swap, [t] into the overlap (0 to 1, the arrival's own clock): its
  /// opacity (never letting the pair add up to less than the overlap floor) and its drift in dp.
  static double axisOutOpacity(double t) {
    final incoming = Motion.glide.transform(t);
    final own = (1 - (incoming - MmOverlapSwitcher.releaseAt) / (1 - MmOverlapSwitcher.releaseAt)).clamp(0.0, 1.0);
    return MmOverlapSwitcher.outgoingOpacity(own, incoming);
  }

  static double axisOutDrift(double t) => -arriveTravel * Motion.recedeShare * Motion.glide.transform(t);

  @override
  State<StepSwap> createState() => _StepSwapState();
}

class _Layer {
  _Layer(this.id, this.key, this.child, this.rated, this.reduced);

  final int id;
  final Object key;
  Widget child;
  final bool rated;

  /// Reduced motion was on when this layer arrived: it only fades in.
  final bool reduced;

  /// The arrival clock (null for the first step, which is simply there).
  AnimationController? arrive;

  /// The leaving clock, once the layer has been replaced.
  AnimationController? leave;
}

class _StepSwapState extends State<StepSwap> with TickerProviderStateMixin {
  late _Layer _current = _Layer(0, widget.stepKey, widget.child, widget.rated, false);
  final List<_Layer> _leaving = [];
  int _ids = 1;

  @override
  void didUpdateWidget(StepSwap old) {
    super.didUpdateWidget(old);
    if (widget.stepKey == _current.key) {
      _current.child = widget.child;
      return;
    }
    _swap();
  }

  void _swap() {
    final reduced = Motion.reduced(context);
    final out = _current;
    final incoming = _Layer(_ids++, widget.stepKey, widget.child, widget.rated, reduced);
    incoming.arrive = AnimationController(
      vsync: this,
      duration: reduced ? Motion.reducedFade : Motion.glideDuration,
    )..forward();
    _current = incoming;

    // A step that is still leaving is dropped: three cards at once would be a pile.
    while (_leaving.length >= 2) {
      _retire(_leaving.removeAt(0));
    }
    out.arrive?.stop();
    if (reduced) {
      _retire(out);
    } else {
      final clock = AnimationController(vsync: this, duration: out.rated ? null : Motion.glideDuration);
      out.leave = clock;
      if (out.rated) {
        clock.animateWith(SpringSimulation(Springs.smooth, 0, 1, 0));
      } else {
        clock.forward();
      }
      // A flying card is gone (fully faded) well before its spring has finished settling: drop it
      // then, not when the physics stop. An axis step goes when its own clock completes.
      var gone = false;
      void drop() {
        if (gone || !mounted) return;
        gone = true;
        setState(() => _leaving.remove(out));
        _retire(out);
      }

      clock.addListener(() {
        if (out.rated && clock.value >= StepSwap.flyGoneAt) drop();
      });
      clock.addStatusListener((status) {
        if (status == AnimationStatus.completed) drop();
      });
      _leaving.add(out);
    }
    setState(() {});
  }

  /// Disposes a layer's clocks once the frame that stops drawing it is out.
  void _retire(_Layer layer) {
    final clocks = [layer.arrive, layer.leave];
    layer.arrive = null;
    layer.leave = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final c in clocks) {
        c?.dispose();
      }
    });
  }

  @override
  void dispose() {
    for (final layer in [_current, ..._leaving]) {
      layer.arrive?.dispose();
      layer.leave?.dispose();
    }
    super.dispose();
  }

  /// One layer, with the same widget structure whether it is arriving, current or leaving, so its
  /// state (the step's own input, its feedback) carries through the swap and nothing replays.
  Widget _view(_Layer layer, {required bool leaving}) {
    final clocks = <Listenable>[?layer.arrive, ?layer.leave];
    return RepaintBoundary(
      key: ValueKey(layer.id),
      child: IgnorePointer(
        ignoring: leaving,
        child: ExcludeSemantics(
          excluding: leaving,
          child: AnimatedBuilder(
            animation: Listenable.merge(clocks),
            child: layer.child,
            builder: (context, child) {
              var opacity = 1.0;
              var offset = Offset.zero;
              var scale = 1.0;
              if (leaving) {
                final t = layer.leave?.value ?? 1;
                if (layer.rated) {
                  opacity = StepSwap.flyOpacity(t);
                  offset = StepSwap.flyOffset(t);
                  scale = StepSwap.flyScaleAt(t);
                } else {
                  opacity = StepSwap.axisOutOpacity(t);
                  offset = Offset(StepSwap.axisOutDrift(t), 0);
                }
              } else {
                final t = layer.arrive?.value ?? 1;
                final glide = Motion.glide.transform(t);
                opacity = layer.reduced ? t : glide;
                if (!layer.reduced) offset = Offset(StepSwap.arriveTravel * (1 - glide), 0);
              }
              return Opacity(
                opacity: opacity,
                child: Transform.translate(
                  offset: offset,
                  child: Transform.scale(scale: scale, child: child),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Stack(
        fit: StackFit.expand,
        children: [
          for (final layer in _leaving) _view(layer, leaving: true),
          _view(_current, leaving: false),
        ],
      );
}
