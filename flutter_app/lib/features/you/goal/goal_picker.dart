import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Seven numbered answer bubbles, one per possible goal. Tapping bubble 4 sets the goal to four:
/// bubbles 1 to 4 ink (study days, the ink spreading from the finger) and the rest stay open
/// rings (rest days), with a bracket underneath that names the split. The picture is the
/// explanation. State is the fill, the ring and the words, never colour alone.
class GoalPicker extends ConsumerWidget {
  const GoalPicker({super.key, required this.value, required this.onChanged});

  final int value;

  /// Null disables the picker (a save is in flight).
  final ValueChanged<int>? onChanged;

  static const double bubble = 36;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The numerals sit in a fixed bubble, so they stop growing at 1.3x. The words below scale.
    final numeralScaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);

    return Semantics(
      container: true,
      label: YouCopy.goalQuestion,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              for (var day = 1; day <= 7; day++)
                Expanded(
                  child: Semantics(
                  inMutuallyExclusiveGroup: true,
                  button: true,
                  selected: day == value,
                  enabled: onChanged != null,
                  label: YouCopy.goalDayLabel(day, day == value),
                  excludeSemantics: true,
                  onTap: onChanged == null ? null : () => _pick(ref, day),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: onChanged == null ? null : () => _pick(ref, day),
                    child: SizedBox(
                      height: MmTarget.min,
                      child: Center(child: _DayBubble(day: day, filled: day <= value, current: day == value, scaler: numeralScaler)),
                    ),
                  ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          // The bracket: ink under the study days, a hairline under the rest days.
          ExcludeSemantics(
            child: Row(
              children: [
                Expanded(
                  flex: value,
                  child: _Bracket(
                    label: YouCopy.goalStudy,
                    color: colors.isNight ? colors.volt : colors.accentText,
                    textStyle: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600),
                  ),
                ),
                if (value < 7) ...[
                  const SizedBox(width: MmSpace.s4),
                  Expanded(
                    flex: 7 - value,
                    child: _Bracket(label: YouCopy.goalRest, color: colors.lineStrong, textStyle: type.small.copyWith(color: colors.ink3)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _pick(WidgetRef ref, int day) {
    if (day == value) return;
    ref.read(hapticsProvider).selection();
    onChanged!(day);
  }
}

class _DayBubble extends StatelessWidget {
  const _DayBubble({required this.day, required this.filled, required this.current, required this.scaler});

  final int day;
  final bool filled;
  final bool current;
  final TextScaler scaler;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Stack(
      alignment: Alignment.center,
      children: [
        Bubble(
          state: filled ? BubbleState.filled : BubbleState.hollow,
          size: GoalPicker.bubble,
          emphasis: current,
          inkOrigin: const Offset(-0.5, -0.5),
        ),
        Text(
          '$day',
          textScaler: scaler,
          style: type.button.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: filled ? colors.voltInk : colors.ink3,
          ),
        ),
      ],
    );
  }
}

class _Bracket extends StatelessWidget {
  const _Bracket({required this.label, required this.color, required this.textStyle});

  final String label;
  final Color color;
  final TextStyle textStyle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: 2, child: DecoratedBox(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(1)))),
        const SizedBox(height: MmSpace.s4),
        FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: textStyle, softWrap: false)),
      ],
    );
  }
}
