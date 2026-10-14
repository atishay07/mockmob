import 'dart:async';

import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics/haptics.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import 'hit_slop.dart';
import 'key_button_face.dart';
import 'pressable.dart';

export 'key_button_face.dart' show KeyVariant;

/// The Night Sheet button: [KeyVariant.primary] is the volt pill, [KeyButton.secondary] the glass
/// pill, [KeyButton.quiet] a text button and [KeyButton.option] a solid answer option whose
/// bubble inks when chosen.
///
/// Press: the face sinks to 0.96 the moment a finger lands (no tap delay) and springs back on
/// release, on the same near-critical spring as every other surface ([MmPressSpring]); the tap
/// commits on pointer up with the `lightImpact` haptic.
/// Disabled pills go quiet (no volt) with an optional one-line [disabledReason] below. A
/// loading key keeps its label and width and ignores taps.
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
    this.tapLock = defaultTapLock,
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
    this.tapLock = defaultTapLock,
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
    this.tapLock = defaultTapLock,
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
        tapLock = Duration.zero,
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

  /// After a commit the key ignores further commits for this long. A double tap on Next, Skip,
  /// Submit or Start used to run the action twice (the stream skipped a question the student never
  /// read; the Start sheet popped twice). Options keep [Duration.zero]: choosing is not a commit.
  final Duration tapLock;

  static const Duration defaultTapLock = Duration(milliseconds: 300);

  @override
  ConsumerState<KeyButton> createState() => _KeyButtonState();
}

class _KeyButtonState extends ConsumerState<KeyButton> with SingleTickerProviderStateMixin {
  late final MmPressSpring _spring = MmPressSpring(this);
  bool _focused = false;
  bool _down0 = false;
  Offset _downAt = Offset.zero;
  Timer? _lockTimer;

  bool get _active => widget.onPressed != null && !widget.loading;

  @override
  void didUpdateWidget(KeyButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_active && _spring.scale.value != 1) _release();
  }

  @override
  void dispose() {
    _lockTimer?.cancel();
    _spring.dispose();
    super.dispose();
  }

  void _down(PointerDownEvent event) {
    _downAt = event.position;
    if (!_active) return;
    _down0 = true;
    _spring.to(Springs.pressedScale, reduced: Motion.reduced(context));
  }

  void _move(PointerMoveEvent event) {
    // Dragging away (a scroll, or sliding off the key) lets the face come back up.
    if (_down0 && (event.position - _downAt).distance > kTouchSlop) _release();
  }

  void _release() {
    _down0 = false;
    _spring.to(1, reduced: Motion.reduced(context));
  }

  void _commit() {
    if (!_active) return;
    if (_lockTimer?.isActive ?? false) return;
    if (widget.tapLock > Duration.zero) _lockTimer = Timer(widget.tapLock, () {});
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
            animation: _spring.scale,
            // The face scales linearly with depth, so it lands exactly on the spring's scale.
            builder: (context, _) => KeyButtonFace(
              label: widget.label,
              variant: widget.variant,
              depth: _spring.depth(),
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

    final semantics = Semantics(
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

    // A quiet key is painted at 40 dp; its 48 dp target is the hit slop, not layout.
    if (widget.variant == KeyVariant.quiet) return MmHitSlop.toTarget(visual: 40, child: semantics);
    return semantics;
  }
}
