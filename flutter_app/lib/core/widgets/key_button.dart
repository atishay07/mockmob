import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics/haptics.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import 'key_button_face.dart';

export 'key_button_face.dart' show KeyVariant;

/// The touch keycap (spec 2.4). Press: the face travels down 4 dp in 80 ms and the lip stays;
/// release returns in 140 ms; the tap commits on pointer up with the `settle` haptic.
///
/// Disabled keys sit flush at 45% with an optional one-line [disabledReason] below. A loading
/// key keeps its label and width and ignores taps. An answer option that is [selected] stays
/// flush with a 2 dp ink border and a check glyph.
class KeyButton extends ConsumerStatefulWidget {
  const KeyButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = KeyVariant.primary,
    this.loading = false,
    this.selected = false,
    this.disabledReason,
    this.expanded = true,
    this.minHeight,
    this.leading,
    this.semanticsLabel,
    this.hapticOnCommit = true,
    this.autofocus = false,
  });

  const KeyButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.disabledReason,
    this.expanded = true,
    this.minHeight,
    this.semanticsLabel,
    this.hapticOnCommit = true,
    this.autofocus = false,
  })  : variant = KeyVariant.secondary,
        selected = false,
        leading = null;

  const KeyButton.quiet({
    super.key,
    required this.label,
    required this.onPressed,
    this.disabledReason,
    this.expanded = false,
    this.semanticsLabel,
    this.hapticOnCommit = true,
    this.autofocus = false,
  })  : variant = KeyVariant.quiet,
        loading = false,
        selected = false,
        minHeight = null,
        leading = null;

  const KeyButton.option({
    super.key,
    required this.label,
    required this.onPressed,
    required this.selected,
    this.leading,
    this.semanticsLabel,
    this.hapticOnCommit = false,
    this.autofocus = false,
  })  : variant = KeyVariant.option,
        loading = false,
        disabledReason = null,
        expanded = true,
        minHeight = null;

  final String label;

  /// Null disables the key.
  final VoidCallback? onPressed;
  final KeyVariant variant;
  final bool loading;
  final bool selected;

  /// Shown under a disabled key when the reason matters.
  final String? disabledReason;

  /// Full width when true; otherwise as wide as the label.
  final bool expanded;
  final double? minHeight;

  /// Letter chip or similar, for options.
  final Widget? leading;
  final String? semanticsLabel;

  /// Fire the `settle` haptic on commit. Off for options and anywhere inside an exam, where
  /// only `tick` is allowed.
  final bool hapticOnCommit;
  final bool autofocus;

  @override
  ConsumerState<KeyButton> createState() => _KeyButtonState();
}

class _KeyButtonState extends ConsumerState<KeyButton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Motion.keyDown,
    reverseDuration: Motion.release,
  );
  late final Animation<double> _depth = CurvedAnimation(parent: _controller, curve: Motion.out);
  bool _focused = false;
  Offset _downAt = Offset.zero;

  bool get _active => widget.onPressed != null && !widget.loading;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    _controller.duration = reduced ? Duration.zero : Motion.keyDown;
    _controller.reverseDuration = reduced ? Duration.zero : Motion.release;
  }

  @override
  void didUpdateWidget(KeyButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_active && _controller.value != 0) _controller.reverse();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _down(PointerDownEvent event) {
    _downAt = event.position;
    if (_active) _controller.forward();
  }

  void _move(PointerMoveEvent event) {
    // Dragging away (a scroll, or sliding off the key) lets the face come back up.
    if ((event.position - _downAt).distance > kTouchSlop) _release();
  }

  void _release() => _controller.reverse();

  void _commit() {
    if (!_active) return;
    if (widget.hapticOnCommit) ref.read(hapticsProvider).settle();
    widget.onPressed!();
  }

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null;
    final isOption = widget.variant == KeyVariant.option;
    final colors = context.mmColors;
    final type = context.mmType;

    final key = FocusableActionDetector(
      enabled: _active,
      autofocus: widget.autofocus,
      mouseCursor: _active ? SystemMouseCursors.click : MouseCursor.defer,
      onShowFocusHighlight: (value) => setState(() => _focused = value),
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          _commit();
          return null;
        }),
      },
      // The face goes down on pointer down (a gesture recognizer would wait 100 ms to tell a
      // tap from a scroll). The commit still comes from the tap recognizer, on release.
      child: Listener(
        onPointerDown: _down,
        onPointerMove: _move,
        onPointerUp: (_) => _release(),
        onPointerCancel: (_) => _release(),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _commit,
          child: AnimatedBuilder(
            animation: _depth,
            builder: (context, _) => KeyButtonFace(
              label: widget.label,
              variant: widget.variant,
              depth: _depth.value,
              disabled: disabled,
              loading: widget.loading,
              selected: widget.selected,
              focused: _focused,
              expanded: widget.expanded,
              leading: widget.leading,
              minHeight: widget.minHeight,
            ),
          ),
        ),
      ),
    );

    final reason = disabled ? widget.disabledReason : null;
    final column = Column(
      crossAxisAlignment: widget.expanded ? CrossAxisAlignment.stretch : CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        key,
        if (reason != null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: Text(
              reason,
              style: type.small.copyWith(color: colors.ink3),
              textAlign: widget.expanded ? TextAlign.center : TextAlign.start,
            ),
          ),
      ],
    );

    return Semantics(
      container: true,
      button: !isOption,
      enabled: !disabled,
      selected: isOption ? widget.selected : null,
      inMutuallyExclusiveGroup: isOption ? true : null,
      label: widget.semanticsLabel ?? widget.label,
      hint: widget.loading ? 'Loading' : reason,
      onTap: _active ? _commit : null,
      excludeSemantics: true,
      child: column,
    );
  }
}
