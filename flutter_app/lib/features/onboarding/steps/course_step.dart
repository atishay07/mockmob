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
import '../widgets/college_search_field.dart';
import '../widgets/course_grid.dart';
import '../widgets/engraved_text.dart';
import '../widgets/entrance.dart';
import '../widgets/step_layout.dart';

/// Step 2 ("Aim"), one evolving screen: pick the course from the six with their real 2026 college
/// counts, then the ladder of colleges with their Round 1 minimums from 2026 unfolds in place; picks
/// engrave onto the sheet. Up to eight colleges, found by name in "Find a college": the same list,
/// limit and search as My colleges, which these picks move into after sign-in.
class CourseStep extends ConsumerStatefulWidget {
  const CourseStep({super.key, required this.answers, required this.onNext, this.mobi});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  /// The guide Mobi: a nod at the first pick, a tilt at a refused one, nothing else.
  final MobiController? mobi;

  @override
  ConsumerState<CourseStep> createState() => _CourseStepState();
}

class _CourseStepState extends ConsumerState<CourseStep> {
  /// Showing the course tiles even though a course is chosen ("Change course").
  bool _choosing = false;

  /// What "Find a college" holds. Cleared with the course, because a search belongs to a ladder.
  final TextEditingController _search = TextEditingController();
  String _query = '';

  /// Mobi nods at the first pick of this visit only.
  bool _nodded = false;

  AnswersController get _c => ref.read(onboardingAnswersProvider.notifier);

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _changeCourse() {
    _search.clear();
    setState(() {
      _choosing = true;
      _query = '';
    });
  }

  /// A pick or a drop. False when the ninth is refused; Mobi tilts. The first pick gets one nod.
  bool _toggle(String college) {
    final before = widget.answers.colleges;
    final ok = _c.toggleCollege(college);
    final mobi = widget.mobi;
    if (!ok) {
      mobi?.react(MobiAct.tilt);
    } else if (before.isEmpty && !_nodded) {
      _nodded = true;
      mobi?.react(MobiAct.nod);
    }
    return ok;
  }

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
              _search.clear();
              setState(() {
                _choosing = false;
                _query = '';
              });
            },
          ),
          EntranceItem.answer(
            6,
            child: MmSelectRow(
              title: OnboardingCopy.notSure,
              note: OnboardingCopy.notSureNote,
              selected: a.courseUndecided,
              onTap: () {
                _c.setCourse(null, undecided: true);
                widget.onNext();
              },
            ),
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
          // Two controls that change what the ladder shows, as two chips with the same weight:
          // the course (a pencil says it changes) and the category.
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: 0,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              CourseChip(label: course.short, onTap: _changeCourse),
              CategoryChip(category: a.category, onTap: () => _category(a.category)),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          CollegeSearchField(controller: _search, onChanged: (q) => setState(() => _query = q)),
          const SizedBox(height: MmSpace.s12),
          LadderCount(picked: a.colleges.length),
          const SizedBox(height: MmSpace.s8),
          CollegeLadder(
            course: course,
            category: a.category,
            picks: a.colleges,
            query: _query,
            onToggle: _toggle,
          ),
          const SizedBox(height: MmSpace.s8),
          Align(
            alignment: Alignment.centerLeft,
            child: MmChip(label: OnboardingCopy.openToAny, selected: a.openToAny, onTap: () => _c.setOpenToAny(!a.openToAny)),
          ),
          if (top != null) ...[
            const SizedBox(height: MmSpace.s12),
            Semantics(
              liveRegion: true,
              // Engraves again whenever the top pick or the category changes it.
              child: EngravedText(
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
