import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_catalog.dart';
import '../model/answers.dart';
import '../state/answers_controller.dart';
import '../widgets/college_ladder.dart';
import '../widgets/course_grid.dart';
import '../widgets/step_layout.dart';

/// Step 4, one evolving screen: pick the course from the six with their real 2026 college
/// counts, then the ladder of colleges with CSAS 2026 Round 1 figures unfolds in place; picks
/// engrave onto the sheet.
class CourseStep extends ConsumerStatefulWidget {
  const CourseStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  ConsumerState<CourseStep> createState() => _CourseStepState();
}

class _CourseStepState extends ConsumerState<CourseStep> {
  /// Showing the course tiles even though a course is chosen ("Change course").
  bool _choosing = false;

  AnswersController get _c => ref.read(onboardingAnswersProvider.notifier);

  Future<void> _category(String current) async {
    final picked = await showCategorySheet(context, current);
    if (picked != null) _c.setCategory(picked);
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.answers;
    final course = a.course;
    final ladder = course != null && !_choosing;
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.glideDuration),
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      child: ladder ? _ladder(context, a, course) : _courses(context, a),
    );
  }

  Widget _courses(BuildContext context, OnboardingAnswers a) {
    return StepLayout(
      key: const ValueKey('courses'),
      title: OnboardingCopy.courseTitle,
      support: OnboardingCopy.courseSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CourseGrid(
            selected: a.courseId,
            onPick: (course) {
              _c.setCourse(course.id);
              setState(() => _choosing = false);
            },
          ),
          MmSelectRow(
            title: OnboardingCopy.notSure,
            note: OnboardingCopy.notSureNote,
            selected: a.courseUndecided,
            onTap: () {
              _c.setCourse(null, undecided: true);
              widget.onNext();
            },
          ),
        ],
      ),
    );
  }

  Widget _ladder(BuildContext context, OnboardingAnswers a, DuCourse course) {
    final colors = context.mmColors;
    final type = context.mmType;
    final top = a.colleges.isEmpty ? null : course.offeringAt(a.colleges.first);
    final topScore = top?.scoreFor(a.category);
    return StepLayout(
      key: ValueKey('ladder-${course.id}'),
      title: OnboardingCopy.ladderTitle,
      support: OnboardingCopy.ladderSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(
              label: OnboardingCopy.courseChange(course.short),
              semanticsLabel: '${course.short}. ${OnboardingCopy.changeCourse}',
              onPressed: () => setState(() => _choosing = true),
            ),
          ),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: 0,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              CategoryChip(category: a.category, onTap: () => _category(a.category)),
              MmChip(label: OnboardingCopy.openToAny, selected: a.openToAny, onTap: () => _c.setOpenToAny(!a.openToAny)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          CollegeLadder(
            course: course,
            category: a.category,
            picks: a.colleges,
            onToggle: _c.toggleCollege,
          ),
          if (top != null) ...[
            const SizedBox(height: MmSpace.s12),
            Semantics(
              liveRegion: true,
              child: Text(
                topScore == null
                    ? OnboardingCopy.noSeatsFor(a.category)
                    : OnboardingCopy.barLine(top.short, DuCatalog.format(topScore), (topScore / 4).round()),
                style: type.small.copyWith(color: colors.ink2),
              ),
            ),
          ],
        ],
      ),
      bottom: KeyButton(
        label: OnboardingCopy.next,
        onPressed: a.colleges.isNotEmpty || a.openToAny ? widget.onNext : null,
        disabledReason: a.colleges.isNotEmpty || a.openToAny ? null : OnboardingCopy.pickCollege,
      ),
    );
  }
}
