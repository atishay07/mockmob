import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';

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

  void dispose() => scale.dispose();
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
    this.pressedScale = Springs.pressedScale,
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
  final double pressedScale;

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

  bool get _enabled => widget.onTap != null || widget.onLongPress != null;

  @override
  void didUpdateWidget(MmPressable oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_enabled && _pressed.value) _release();
  }

  @override
  void dispose() {
    _spring.dispose();
    _pressed.dispose();
    super.dispose();
  }

  void _springTo(double target) => _spring.to(target, reduced: Motion.reduced(context));

  void _down(PointerDownEvent event) {
    if (!_enabled) return;
    _downAt = event.position;
    _pressed.value = true;
    _springTo(widget.pressedScale);
  }

  void _move(PointerMoveEvent event) {
    if (_pressed.value && (event.position - _downAt).distance > kTouchSlop) _release();
  }

  void _release() {
    if (!_pressed.value) return;
    _pressed.value = false;
    _springTo(1);
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
        onPointerUp: (_) => _release(),
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
