import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_catalog.dart';

/// The six Commerce courses as tiles: the real count of colleges that took each through CUET in
/// 2026, in condensed figures, over the course name. Two columns, equal heights.
class CourseGrid extends StatelessWidget {
  const CourseGrid({super.key, required this.selected, required this.onPick});

  final String? selected;
  final ValueChanged<DuCourse> onPick;

  @override
  Widget build(BuildContext context) {
    final courses = DuCatalog.courses;
    return Column(
      children: [
        for (var i = 0; i < courses.length; i += 2) ...[
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: CourseTile(course: courses[i], selected: courses[i].id == selected, onTap: () => onPick(courses[i]))),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: i + 1 < courses.length
                      ? CourseTile(course: courses[i + 1], selected: courses[i + 1].id == selected, onTap: () => onPick(courses[i + 1]))
                      : const SizedBox(),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
        ],
      ],
    );
  }
}

class CourseTile extends ConsumerWidget {
  const CourseTile({super.key, required this.course, required this.selected, required this.onTap});

  final DuCourse course;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rim = selected ? (colors.isNight ? colors.volt : colors.accentText) : colors.line;
    return MmPressable(
      semanticsLabel: '${course.short}, ${OnboardingCopy.collegesCount(course.collegeCount)}',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: selected ? colors.raised2 : (pressed ? colors.raised2 : colors.raised),
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: rim, width: selected ? 1.5 : 1)),
        ),
        child: CustomPaint(
          foregroundPainter: EdgeLightPainter(
            borderRadius: MmRadius.keyAll,
            top: colors.edgeTop,
            bottom: colors.edgeBottom.withValues(alpha: 0),
            lamp: colors.isNight ? colors.lamp : null,
            sheen: false,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text('${course.collegeCount}', style: type.figureCompact)),
                    Bubble(state: selected ? BubbleState.filled : BubbleState.hollow, size: 18, inkOrigin: const Offset(0.6, -0.6)),
                  ],
                ),
                const SizedBox(height: MmSpace.s4),
                Text(course.short, style: type.labelLarge),
                const SizedBox(height: 2),
                Text(OnboardingCopy.collegesUnit(course.collegeCount), style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
