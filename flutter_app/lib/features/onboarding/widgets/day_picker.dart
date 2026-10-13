import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The week as seven bubbles, Monday first: a study day is inked, a rest day is dotted with a
/// bar (rest is part of the plan, never a miss). The seven targets share the row edge to edge,
/// so the week fits a 360 dp phone (about 47 dp each there, 48 dp tall) with no gaps between.
class DayPicker extends ConsumerWidget {
  const DayPicker({super.key, required this.days, required this.onToggle});

  final Set<int> days;
  final ValueChanged<int> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        for (var i = 0; i < 7; i++)
          Expanded(
            child: MmPressable(
              semanticsLabel: '${weekdayNames[i]}, ${days.contains(i) ? 'study day' : 'rest day'}',
              checked: days.contains(i),
              pressedScale: 0.9,
              onTap: () {
                ref.read(hapticsProvider).selection();
                onToggle(i);
              },
              builder: (context, pressed, _) => SizedBox(
                width: double.infinity,
                child: Column(
                  children: [
                    SizedBox(
                      height: 48,
                      child: Center(
                        child: Bubble(
                          state: days.contains(i) ? BubbleState.filled : BubbleState.rest,
                          size: 32,
                          inkOrigin: const Offset(0, 0.8),
                        ),
                      ),
                    ),
                    Text(
                      weekdayInitials[i],
                      style: type.caption.copyWith(fontWeight: FontWeight.w600, color: days.contains(i) ? colors.ink : colors.ink3),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
