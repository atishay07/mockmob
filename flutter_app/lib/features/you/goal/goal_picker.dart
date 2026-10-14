import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Seven numbered answer bubbles, one per possible goal. Tapping bubble 4 sets the goal to four:
/// bubbles 1 to 4 ink (study days, the ink spreading from the finger) and the rest stay open
/// rings (rest days), with a bracket underneath that names the split. The picture is the
/// explanation. State is the fill, the ring and the words, never colour alone.
///
/// The circles answer a pick in order: raising the goal fills the new circles left to right, one
/// every 40 ms; lowering it empties them right to left on the same beat. Under reduced motion
/// they change together.
class GoalPicker extends ConsumerStatefulWidget {
  const GoalPicker({super.key, required this.value, required this.onChanged});

  final int value;

  /// Null disables the picker (a save is in flight).
  final ValueChanged<int>? onChanged;

  static const double bubble = 36;

  /// The beat between one circle and the next when a pick fills or empties several.
  static const Duration stagger = Duration(milliseconds: 40);

  /// How long circle [day] waits to change when the goal moves from [from] to [to]. Raising it
  /// fills left to right; lowering it empties right to left; circles that do not change wait
  /// for nothing.
  static Duration delayFor(int day, {required int from, required int to}) {
    if (to > from && day > from && day <= to) return stagger * (day - from - 1);
    if (to < from && day > to && day <= from) return stagger * (from - day);
    return Duration.zero;
  }

  @override
  ConsumerState<GoalPicker> createState() => _GoalPickerState();
}

class _GoalPickerState extends ConsumerState<GoalPicker> {
  late int _from = widget.value;

  @override
  void didUpdateWidget(GoalPicker old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) _from = old.value;
  }

  int get value => widget.value;
  ValueChanged<int>? get onChanged => widget.onChanged;

  @override
  Widget build(BuildContext context) {
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
                      child: Center(
                        child: _DayBubble(day: day, filled: day <= value, current: day == value, scaler: numeralScaler, delay: GoalPicker.delayFor(day, from: _from, to: value)),
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
                  child: _Bracket(
                    label: YouCopy.goalStudy,
                    color: colors.isNight ? colors.volt : colors.accentText,
                    textStyle: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w700),
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

class _DayBubble extends StatefulWidget {
  const _DayBubble({required this.day, required this.filled, required this.current, required this.scaler, this.delay = Duration.zero});

  final int day;
  final bool filled;
  final bool current;
  final TextScaler scaler;

  /// How long to wait before showing a change of [filled] (the left to right stagger).
  final Duration delay;

  @override
  State<_DayBubble> createState() => _DayBubbleState();
}

class _DayBubbleState extends State<_DayBubble> {
  late bool _shown = widget.filled;
  Timer? _wait;

  @override
  void didUpdateWidget(_DayBubble old) {
    super.didUpdateWidget(old);
    if (old.filled == widget.filled) return;
    _wait?.cancel();
    if (widget.delay == Duration.zero || Motion.reduced(context)) {
      _shown = widget.filled;
      return;
    }
    _wait = Timer(widget.delay, () {
      if (mounted) setState(() => _shown = widget.filled);
    });
  }

  @override
  void dispose() {
    _wait?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final filled = _shown;
    final day = widget.day;
    final scaler = widget.scaler;
    return Stack(
      alignment: Alignment.center,
      children: [
        Bubble(
          state: filled ? BubbleState.filled : BubbleState.hollow,
          size: GoalPicker.bubble,
          emphasis: false,
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
