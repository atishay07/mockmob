// The Combo planner's three steps as one truthful header: Targets, Subjects, Papers. A segment
// fills only when its step has a value the student (or a named default) set, and the caption
// says which step is next, or that all are set. Tapping a segment jumps to its step.

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

abstract final class ComboProgressCopy {
  static const List<String> steps = ['Targets', 'Subjects', 'Papers'];
  static String step(int i) => 'Step ${i + 1} of 3: ${steps[i]}';
  static const String allSet = 'All set. Tap a step to change it.';
  static const String fromColleges = 'From your colleges';
  static const String fromSheet = 'From your subjects';
}

class ComboProgress extends StatelessWidget {
  const ComboProgress({super.key, required this.done, required this.onStep});

  /// Whether Targets, Subjects and Papers each have a value.
  final List<bool> done;
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final next = done.indexOf(false);
    final caption = next < 0 ? ComboProgressCopy.allSet : ComboProgressCopy.step(next);
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: MmSpace.s6),
                Expanded(
                  child: MmPressable(
                    semanticsLabel: '${ComboProgressCopy.steps[i]}, ${done[i] ? 'set' : 'not set'}',
                    onTap: () => onStep(i),
                    builder: (context, pressed, _) => SizedBox(
                      height: 48,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AnimatedContainer(
                            duration: Motion.of(context, Motion.glideDuration),
                            curve: Motion.glide,
                            height: 6,
                            decoration: BoxDecoration(
                              color: done[i] ? colors.volt : colors.sunken,
                              borderRadius: BorderRadius.circular(3),
                              border: i == next ? Border.all(color: colors.voltEdge, width: 1) : null,
                            ),
                          ),
                          const SizedBox(height: MmSpace.s6),
                          Text(
                            ComboProgressCopy.steps[i],
                            style: type.caption.copyWith(color: done[i] || i == next ? colors.ink : colors.ink3, fontWeight: i == next ? FontWeight.w700 : null),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          Semantics(liveRegion: true, child: Text(caption, style: type.caption.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}
