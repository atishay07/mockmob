import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// Seven numbered circles, one per possible goal. Tapping a circle sets the goal to that number:
/// the circles up to it fill ink (study days) and the rest stay hairline (rest days), with a
/// bracket underneath that names the split. The picture is the explanation, so the rest-days
/// idea needs no extra screen. State is the fill plus the words, never colour alone.
class GoalPicker extends ConsumerWidget {
  const GoalPicker({super.key, required this.value, required this.onChanged});

  final int value;

  /// Null disables the picker (a save is in flight).
  final ValueChanged<int>? onChanged;

  static const double circle = 44;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    // The numerals sit in a fixed circle, so they stop growing at 1.3x. The words below scale.
    final numeralScaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);

    return Semantics(
      container: true,
      label: YouCopy.goalQuestion,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (var day = 1; day <= 7; day++)
                Semantics(
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
                      width: circle,
                      height: circle,
                      child: Center(
                        child: AnimatedScale(
                          scale: day == value ? 1.0 : 0.92,
                          duration: reduced ? Duration.zero : Motion.ui,
                          curve: Motion.out,
                          child: _Dot(day: day, filled: day <= value, current: day == value, scaler: numeralScaler),
                        ),
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
                  child: _Bracket(label: YouCopy.goalStudy, color: colors.ink, textStyle: type.label.copyWith(color: colors.ink)),
                ),
                if (value < 7) ...[
                  const SizedBox(width: MmSpace.s4),
                  Expanded(
                    flex: 7 - value,
                    child: _Bracket(label: YouCopy.goalRest, color: colors.lineStrong, textStyle: type.label.copyWith(color: colors.ink3)),
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
    ref.read(hapticsProvider).tick();
    onChanged!(day);
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.day, required this.filled, required this.current, required this.scaler});

  final int day;
  final bool filled;
  final bool current;
  final TextScaler scaler;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? colors.ink : Colors.transparent,
        border: Border.all(color: filled ? colors.ink : colors.lineStrong, width: current ? 2 : 1),
      ),
      child: SizedBox(
        width: GoalPicker.circle - 4,
        height: GoalPicker.circle - 4,
        child: Center(
          child: Text(
            '$day',
            textScaler: scaler,
            style: type.button.copyWith(color: filled ? colors.ground : colors.ink3),
          ),
        ),
      ),
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
