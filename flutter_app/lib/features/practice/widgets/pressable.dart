import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';

/// A tappable surface with the app's pressed fill instead of a ripple (spec 2.3), a visible
/// focus ring, a 44 dp minimum height and one button semantics node. [builder] receives the
/// pressed state so the content can respond; [semanticsLabel] replaces the merged label when
/// the visual text is not what a screen reader should hear.
class Pressable extends ConsumerStatefulWidget {
  const Pressable({
    super.key,
    required this.onTap,
    required this.builder,
    this.semanticsLabel,
    this.selected,
    this.expanded,
    this.radius = MmRadius.key,
    this.minHeight = MmTarget.min,
    this.tickOnTap = true,
    this.pressedColor,
  });

  final VoidCallback? onTap;
  final Widget Function(BuildContext context, bool pressed) builder;
  final String? semanticsLabel;

  /// Non-null marks a toggle (a chip or a checked row).
  final bool? selected;

  /// Non-null marks a disclosure (an expandable row).
  final bool? expanded;
  final double radius;
  final double minHeight;
  final bool tickOnTap;
  final Color? pressedColor;

  @override
  ConsumerState<Pressable> createState() => _PressableState();
}

class _PressableState extends ConsumerState<Pressable> {
  bool _pressed = false;
  bool _focused = false;

  void _setPressed(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final enabled = widget.onTap != null;
    final radius = BorderRadius.circular(widget.radius);
    return Semantics(
      button: true,
      enabled: enabled,
      selected: widget.selected,
      expanded: widget.expanded,
      label: widget.semanticsLabel,
      container: widget.semanticsLabel != null,
      excludeSemantics: widget.semanticsLabel != null,
      onTap: widget.onTap,
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: widget.minHeight, minWidth: MmTarget.min),
        child: DecoratedBox(
          position: DecorationPosition.foreground,
          decoration: BoxDecoration(
            borderRadius: radius,
            border: _focused ? Border.all(color: colors.focusRing, width: 2) : null,
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: enabled
                  ? () {
                      if (widget.tickOnTap) ref.read(hapticsProvider).tick();
                      widget.onTap!();
                    }
                  : null,
              onHighlightChanged: _setPressed,
              onFocusChange: (v) => setState(() => _focused = v),
              borderRadius: radius,
              splashFactory: NoSplash.splashFactory,
              overlayColor: const WidgetStatePropertyAll(Colors.transparent),
              child: Ink(
                decoration: BoxDecoration(borderRadius: radius, color: _pressed ? (widget.pressedColor ?? colors.sunken) : null),
                child: widget.builder(context, _pressed),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
