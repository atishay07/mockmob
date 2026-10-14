import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';

/// A small choice key drawn as an answer bubble: an hour, a minute, AM or PM, a weekly cap. At
/// least 48 dp. The chosen one is inked (volt, dark numerals) and reads as selected to TalkBack;
/// pressed shows a fill instead of a ripple (on the next frame); the ink fades in over 140 ms on
/// release, and is there at once under reduced motion; focus shows the ring.
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
  void _commit() {
    ref.read(hapticsProvider).tick();
    widget.onSelected?.call();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = widget.onSelected != null;
    final textColor = widget.selected ? colors.voltInk : colors.ink;

    return Semantics(
      button: true,
      selected: widget.selected,
      enabled: enabled,
      label: widget.semanticsLabel ?? widget.label,
      onTap: enabled ? _commit : null,
      excludeSemantics: true,
      // The choice gives its own tick; the press adds the shared physics (sink and spring back).
      child: MmPressable(
        onTap: enabled ? _commit : null,
        builder: (context, pressed, _) {
          // Chosen reads as an inked answer bubble: volt with dark ink, the ring gone.
          final pressFill = colors.isNight ? colors.raised2 : colors.sunken;
          final fill = widget.selected
              ? colors.volt
              : (pressed ? pressFill : pressFill.withValues(alpha: 0));
          return ConstrainedBox(
            constraints: BoxConstraints(minWidth: widget.minWidth, minHeight: MmTarget.min),
            // The press fill is immediate; only the ink coming in or going out eases.
            child: AnimatedContainer(
              duration: pressed ? Duration.zero : Motion.of(context, Motion.release),
              curve: Motion.out,
              decoration: ShapeDecoration(
                color: fill,
                shape: StadiumBorder(
                  side: BorderSide(color: widget.selected ? colors.volt : colors.lineStrong, width: 1.4),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                child: Center(
                  widthFactor: 1,
                  child: AnimatedDefaultTextStyle(
                    duration: pressed ? Duration.zero : Motion.of(context, Motion.release),
                    style: type.button.copyWith(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: textColor.withValues(alpha: enabled ? 1 : 0.45),
                    ),
                    child: Text(widget.label),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
