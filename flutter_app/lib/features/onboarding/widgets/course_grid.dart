import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../choices_copy.dart';
import '../copy.dart';
import '../data/course_combos.dart';
import '../data/du_catalog.dart';
import 'choice_tile.dart';
import 'entrance.dart';
import 'glyphs.dart';

/// The six most chosen courses as tiles (B.Com (Hons) first): the real count of colleges that
/// took each through CUET in 2026, in condensed figures, the shape of its college ladder, the
/// course name and its CUET subject combination from the Bulletin. Two columns, equal heights.
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
                Expanded(child: EntranceItem.answer(i, child: CourseTile(course: courses[i], selected: courses[i].id == selected, onTap: () => onPick(courses[i])))),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: i + 1 < courses.length
                      ? EntranceItem.answer(
                          i + 1,
                          child: CourseTile(course: courses[i + 1], selected: courses[i + 1].id == selected, onTap: () => onPick(courses[i + 1])),
                        )
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

class CourseTile extends StatelessWidget {
  const CourseTile({super.key, required this.course, required this.selected, required this.onTap});

  final DuCourse course;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scores = [for (final o in course.ladder('UR')) o.scoreFor('UR')!];
    return ChoiceTile(
      selected: selected,
      onTap: onTap,
      semanticsLabel: '${course.short}, ${OnboardingCopy.collegesCount(course.collegeCount)}. ${ChoicesCopy.combosSpoken}: ${CourseCombos.line(course)}',
      minHeight: 124,
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${course.collegeCount}', style: type.figureCompact),
              const SizedBox(width: MmSpace.s4),
              // The unit at 55% of the figure, top-aligned (brief section 4).
              Padding(
                padding: const EdgeInsets.only(top: MmSpace.s4),
                child: Text(
                  OnboardingCopy.collegesUnit(course.collegeCount),
                  style: type.figureCompact.copyWith(
                    fontSize: (type.figureCompact.fontSize ?? 32) * 0.55,
                    height: 1,
                    color: colors.ink2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          // The shape of the ladder: its top closing scores as rungs.
          LadderGlyph(
            scores: scores,
            color: colors.ink3,
            // A 4 dp bar reads as a stroke on the tile, so it takes the text accent (olive on Day,
            // where a volt bar on white would vanish). SPACING.md 8.3.
            accent: selected ? colors.accentText : colors.ink2,
          ),
          const SizedBox(height: MmSpace.s12),
          Text(course.short, style: type.labelLarge.copyWith(height: 20 / 15)),
          const SizedBox(height: MmSpace.s4),
          // The CUET subjects it takes, from the Bulletin rows only (D41).
          Text(CourseCombos.line(course), style: type.caption.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}
