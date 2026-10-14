import 'dart:async';

import 'package:flutter/gestures.dart' show kLongPressTimeout, kTouchSlop;
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'feedback.dart';

export 'feedback.dart' show MmPressHaptic;

/// The one press physics of the Night Sheet, shared by [MmPressable] and `KeyButton`: the
/// surface's scale on the near-critical [Springs.snappy] spring, down to [Springs.pressedScale]
/// the moment a finger lands, and back to 1 on release on [Springs.release] (a short physical
/// give), keeping its velocity between the two. Under reduced motion it jumps to the target.
class MmPressSpring {
  MmPressSpring(TickerProvider vsync) : scale = AnimationController.unbounded(vsync: vsync, value: 1);

  /// The current scale (1 at rest).
  final AnimationController scale;

  /// How far down the press is: 0 at rest, 1 at [pressedScale].
  double depth({double pressedScale = Springs.pressedScale}) =>
      ((1 - scale.value) / (1 - pressedScale)).clamp(0.0, 1.0);

  void to(double target, {required bool reduced}) {
    if (reduced) {
      scale.value = target;
      return;
    }
    final spring = target >= 1 ? Springs.release : Springs.snappy;
    scale.animateWith(Motion.spring(spring, scale.value, target, velocity: scale.velocity));
  }

  /// The scale a release rises to before settling, for a surface that sank to [pressedScale]: three
  /// quarters of the sink, at most 1.03 (a 0.96 key rises to 1.03; a 340 dp hero, which sinks only
  /// 8 dp, rises about 6 dp).
  static double overshootFor(double pressedScale) => 1 + ((1 - pressedScale) * 0.75).clamp(0.0, 0.03);

  /// Back to rest after a press that committed: up past 1 to [overshootFor] on [Springs.snappy],
  /// then down to 1 on [Springs.release], keeping its velocity through the turn, so the surface
  /// answers the tap with a small lift. Under reduced motion it jumps to 1.
  void releaseWithLift({required bool reduced, double pressedScale = Springs.pressedScale}) {
    if (reduced) {
      scale.value = 1;
      return;
    }
    scale.animateWith(MmLiftSimulation(from: scale.value, peak: overshootFor(pressedScale), velocity: scale.velocity));
  }

  void dispose() => scale.dispose();
}

/// A rise to [peak] on [Springs.snappy] that turns, once it reaches the peak (or after 180 ms),
/// into a settle to 1 on [Springs.release], keeping the velocity at the turn.
class MmLiftSimulation extends Simulation {
  MmLiftSimulation({required double from, required this.peak, double velocity = 0})
      : _rise = SpringSimulation(Springs.snappy, from, peak + (peak - 1) * 0.5, velocity) {
    var t = 0.0;
    while (t < 0.18 && _rise.x(t) < peak) {
      t += 0.004;
    }
    _turn = t;
    _settle = SpringSimulation(Springs.release, _rise.x(_turn), 1, _rise.dx(_turn));
  }

  final double peak;
  final SpringSimulation _rise;
  late final double _turn;
  late final SpringSimulation _settle;

  @override
  double x(double time) => time < _turn ? _rise.x(time) : _settle.x(time - _turn);

  @override
  double dx(double time) => time < _turn ? _rise.dx(time) : _settle.dx(time - _turn);

  @override
  bool isDone(double time) => time >= _turn && _settle.isDone(time - _turn);
}

/// Builds a surface for its pressed and focused state.
typedef PressableBuilder = Widget Function(BuildContext context, bool pressed, bool focused);

/// Every tappable surface of the Night Sheet: it sinks to 0.96 on a near-critical spring the
/// moment a finger lands (no 100 ms tap delay), springs back on release or when the finger
/// drags away, and commits on release. Keyboard focus draws a ring; Enter and Space activate.
///
/// The surface itself is drawn by [builder], which receives the pressed state so glass can
/// brighten its edge light.
///
/// Opt-in extras (docs/brain/ui-blitz/motion.md 3.1): [haptic] on activation, a press veil
/// ([highlight]) in the [focusRadius] shape, and [captureLaunch] so the page it opens can grow
/// out of it (`MmTransition.container`).
class MmPressable extends StatefulWidget {
  const MmPressable({
    super.key,
    required this.builder,
    required this.onTap,
    this.onLongPress,
    this.onLongPressThreshold,
    this.lift = true,
    this.pressedScale,
    this.focusRadius = MmRadius.pillAll,
    this.semanticsLabel,
    this.button = true,
    this.selected,
    this.checked,
    this.inMutuallyExclusiveGroup,
    this.autofocus = false,
    this.excludeSemantics = true,
    this.isolate = false,
    this.haptic = MmPressHaptic.none,
    this.highlight = false,
    this.captureLaunch = false,
  });

  final PressableBuilder builder;

  /// Null disables the surface.
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Fired once while the finger is still down, when the hold passes the long-press threshold
  /// ([kLongPressTimeout]), with a selection haptic and a little more sink, so the finger feels
  /// the hold register before it lifts (a peek, a reorder grab).
  final VoidCallback? onLongPressThreshold;

  /// A committed tap releases with a small lift past rest ([MmPressSpring.releaseWithLift]); a
  /// finger that slides off, or a cancel, settles without it.
  final bool lift;

  /// How far the surface sinks. Null derives it from the surface's width ([Motion.pressedScaleFor]):
  /// 0.96 for a key, about 0.976 for a 340 dp hero, so a large surface never sinks more than 8 dp.
  final double? pressedScale;

  /// The shape of the focus ring.
  final BorderRadius focusRadius;
  final String? semanticsLabel;
  final bool button;
  final bool? selected;
  final bool? checked;
  final bool? inMutuallyExclusiveGroup;
  final bool autofocus;

  /// When a [semanticsLabel] is given, the built children are hidden from TalkBack.
  final bool excludeSemantics;

  /// Paints the surface on its own layer: only for a large surface whose press would otherwise
  /// repaint costly neighbours. Off by default, so a palette of 50 keys is not 50 layers.
  final bool isolate;

  /// The haptic on activation (tap, Enter or Space), through the Touch feedback switch.
  final MmPressHaptic haptic;

  /// Paints a press veil (ink 6% on Night, 5% on Daylight) in the [focusRadius] shape while
  /// the finger is down. No layer and no ripple.
  final bool highlight;

  /// Records this surface's rect on tap, for the container transform of the page it opens.
  final bool captureLaunch;

  @override
  State<MmPressable> createState() => _MmPressableState();
}

class _MmPressableState extends State<MmPressable> with SingleTickerProviderStateMixin {
  late final MmPressSpring _spring = MmPressSpring(this);
  AnimationController get _scale => _spring.scale;
  final ValueNotifier<bool> _pressed = ValueNotifier(false);
  bool _focused = false;
  Offset _downAt = Offset.zero;

  bool get _enabled => widget.onTap != null || widget.onLongPress != null || widget.onLongPressThreshold != null;
  Timer? _hold;
  Duration _downStamp = Duration.zero;
  double _sunkTo = Springs.pressedScale;

  @override
  void didUpdateWidget(MmPressable oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_enabled && _pressed.value) _release();
  }

  @override
  void dispose() {
    _hold?.cancel();
    _spring.dispose();
    _pressed.dispose();
    super.dispose();
  }

  void _springTo(double target) => _spring.to(target, reduced: Motion.reduced(context));

  void _down(PointerDownEvent event) {
    if (!_enabled) return;
    _downAt = event.position;
    _downStamp = event.timeStamp;
    _pressed.value = true;
    final width = context.size?.width;
    _sunkTo = widget.pressedScale ?? (width == null ? Springs.pressedScale : Motion.pressedScaleFor(width));
    _springTo(_sunkTo);
    _hold?.cancel();
    if (widget.onLongPressThreshold != null) _hold = Timer(kLongPressTimeout, _held);
  }

  void _held() {
    if (!mounted || !_pressed.value) return;
    mmFireHaptic(context, MmPressHaptic.selection);
    // Half as deep again: the hold registers in the hand.
    _springTo(1 - (1 - _sunkTo) * 1.5);
    widget.onLongPressThreshold?.call();
  }

  void _move(PointerMoveEvent event) {
    if (_pressed.value && (event.position - _downAt).distance > kTouchSlop) _release();
  }

  void _release({bool committed = false}) {
    _hold?.cancel();
    _hold = null;
    if (!_pressed.value) return;
    _pressed.value = false;
    if (committed && widget.lift && widget.onTap != null) {
      _spring.releaseWithLift(reduced: Motion.reduced(context), pressedScale: _sunkTo);
    } else {
      _springTo(1);
    }
  }

  void _activate() {
    if (widget.onTap == null) return;
    _commit();
    widget.onTap!.call();
  }

  void _commit() {
    if (widget.captureLaunch) MmLaunchRect.capture(context);
    mmFireHaptic(context, widget.haptic);
  }

  VoidCallback? get _tap {
    final onTap = widget.onTap;
    if (onTap == null) return null;
    if (widget.haptic == MmPressHaptic.none && !widget.captureLaunch) return onTap;
    return () {
      _commit();
      onTap();
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final veil = colors.ink.withValues(alpha: colors.isNight ? 0.06 : 0.05);
    final surface = ValueListenableBuilder<bool>(
      valueListenable: _pressed,
      builder: (context, pressed, _) {
        final built = widget.builder(context, pressed, _focused);
        if (!widget.highlight) return built;
        return CustomPaint(
          foregroundPainter: _VeilPainter(color: pressed ? veil : null, radius: widget.focusRadius),
          child: built,
        );
      },
    );

    Widget body = AnimatedBuilder(
      animation: _scale,
      builder: (context, child) => Transform.scale(scale: _scale.value, child: child),
      child: surface,
    );

    if (_focused) {
      body = Stack(
        clipBehavior: Clip.none,
        children: [
          body,
          Positioned(
            left: -4,
            right: -4,
            top: -4,
            bottom: -4,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: widget.focusRadius == MmRadius.pillAll
                      ? MmRadius.pillAll
                      : widget.focusRadius + const BorderRadius.all(Radius.circular(4)),
                  border: Border.all(color: colors.focusRing, width: 2),
                ),
              ),
            ),
          ),
        ],
      );
    }

    final interactive = FocusableActionDetector(
      enabled: widget.onTap != null,
      autofocus: widget.autofocus,
      mouseCursor: widget.onTap != null ? SystemMouseCursors.click : MouseCursor.defer,
      onShowFocusHighlight: (value) => setState(() => _focused = value),
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          _activate();
          return null;
        }),
      },
      child: Listener(
        onPointerDown: _down,
        onPointerMove: _move,
        // A tap lifts; a hold that became a long press settles without the lift.
        onPointerUp: (e) => _release(committed: e.timeStamp - _downStamp < kLongPressTimeout),
        onPointerCancel: (_) => _release(),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _tap,
          onLongPress: widget.onLongPress,
          child: widget.isolate ? RepaintBoundary(child: body) : body,
        ),
      ),
    );

    return Semantics(
      container: true,
      button: widget.button,
      enabled: _enabled,
      selected: widget.selected,
      checked: widget.checked,
      inMutuallyExclusiveGroup: widget.inMutuallyExclusiveGroup,
      label: widget.semanticsLabel,
      excludeSemantics: widget.excludeSemantics && widget.semanticsLabel != null,
      onTap: _tap,
      child: interactive,
    );
  }
}

/// The press veil: a flat ink wash in the surface's shape, drawn over it while held.
class _VeilPainter extends CustomPainter {
  const _VeilPainter({required this.color, required this.radius});

  final Color? color;
  final BorderRadius radius;

  @override
  void paint(Canvas canvas, Size size) {
    final c = color;
    if (c == null) return;
    final rect = Offset.zero & size;
    final r = radius == MmRadius.pillAll ? BorderRadius.circular(size.shortestSide / 2) : radius;
    canvas.drawRRect(r.toRRect(rect), Paint()..color = c);
  }

  @override
  bool shouldRepaint(_VeilPainter old) => old.color != color || old.radius != radius;
}
