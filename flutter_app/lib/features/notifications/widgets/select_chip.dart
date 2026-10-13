import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';

/// A small choice key drawn as an answer bubble: an hour, a minute, AM or PM, a weekly cap. At
/// least 48 dp. The chosen one is inked (volt, dark numerals) and reads as selected to TalkBack;
/// pressed shows a fill instead of a ripple; focus shows the ring.
class SelectChip extends ConsumerStatefulWidget {
  const SelectChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.semanticsLabel,
    this.minWidth = MmTarget.min,
  });

  final String label;
  final bool selected;
  final VoidCallback? onSelected;
  final String? semanticsLabel;
  final double minWidth;

  @override
  ConsumerState<SelectChip> createState() => _SelectChipState();
}

class _SelectChipState extends ConsumerState<SelectChip> {
  bool _pressed = false;
  bool _focused = false;

  void _commit() {
    ref.read(hapticsProvider).tick();
    widget.onSelected?.call();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = widget.onSelected != null;

    // Chosen reads as an inked answer bubble: volt with dark ink, the ring gone.
    final fill = widget.selected
        ? colors.volt
        : (_pressed ? (colors.isNight ? colors.raised2 : colors.sunken) : Colors.transparent);
    final textColor = widget.selected ? colors.voltInk : colors.ink;

    return Semantics(
      button: true,
      selected: widget.selected,
      enabled: enabled,
      label: widget.semanticsLabel ?? widget.label,
      onTap: enabled ? _commit : null,
      excludeSemantics: true,
      child: FocusableActionDetector(
        enabled: enabled,
        onShowFocusHighlight: (value) => setState(() => _focused = value),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              _commit();
              return null;
            },
          ),
        },
        child: Listener(
          onPointerDown: (_) => setState(() => _pressed = true),
          onPointerUp: (_) => setState(() => _pressed = false),
          onPointerCancel: (_) => setState(() => _pressed = false),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: enabled ? _commit : null,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minWidth: widget.minWidth,
                minHeight: MmTarget.min,
              ),
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: fill,
                  shape: StadiumBorder(
                    side: BorderSide(
                      color: _focused
                          ? colors.focusRing
                          : (widget.selected ? colors.volt : colors.lineStrong),
                      width: _focused ? 2 : 1.4,
                    ),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                  child: Center(
                    widthFactor: 1,
                    child: Text(
                      widget.label,
                      style: type.button.copyWith(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: textColor.withValues(alpha: enabled ? 1 : 0.45),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
