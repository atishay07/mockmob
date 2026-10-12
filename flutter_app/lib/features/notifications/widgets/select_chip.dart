import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';

/// A small choice key: an hour, a minute, AM or PM, a weekly cap. At least 44 dp square. The
/// chosen one is filled with ink (never volt) and reads as selected to TalkBack; pressed shows
/// a stronger fill instead of a ripple; focus shows the ring.
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

    final fill = widget.selected
        ? colors.ink
        : (_pressed ? colors.line : colors.sunken);
    final textColor = widget.selected ? colors.ground : colors.ink;

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
                decoration: BoxDecoration(
                  color: fill,
                  borderRadius: MmRadius.smallAll,
                  border: Border.all(
                    color: _focused
                        ? colors.focusRing
                        : (widget.selected ? colors.ink : colors.line),
                    width: _focused ? 2 : 1,
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
