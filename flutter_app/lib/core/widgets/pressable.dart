import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';

/// Builds a surface for its pressed and focused state.
typedef PressableBuilder = Widget Function(BuildContext context, bool pressed, bool focused);

/// Every tappable surface of the Night Sheet: it sinks to 0.96 on a near-critical spring the
/// moment a finger lands (no 100 ms tap delay), springs back on release or when the finger
/// drags away, and commits on release. Keyboard focus draws a ring; Enter and Space activate.
///
/// The surface itself is drawn by [builder], which receives the pressed state so glass can
/// brighten its edge light.
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

  @override
  State<MmPressable> createState() => _MmPressableState();
}

class _MmPressableState extends State<MmPressable> with SingleTickerProviderStateMixin {
  late final AnimationController _scale = AnimationController.unbounded(vsync: this, value: 1);
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
    _scale.dispose();
    _pressed.dispose();
    super.dispose();
  }

  void _springTo(double target) {
    if (Motion.reduced(context)) {
      _scale.value = target;
      return;
    }
    _scale.animateWith(Motion.spring(Springs.snappy, _scale.value, target, velocity: _scale.velocity));
  }

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

  void _activate() => widget.onTap?.call();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final surface = ValueListenableBuilder<bool>(
      valueListenable: _pressed,
      builder: (context, pressed, _) => widget.builder(context, pressed, _focused),
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
          onTap: widget.onTap,
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
      onTap: widget.onTap,
      child: interactive,
    );
  }
}
