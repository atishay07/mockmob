import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/eligibility.dart';
import '../data/subjects.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/flip_reorder.dart';
import '../widgets/step_layout.dart';
import '../widgets/subject_row.dart';

/// Step 5: the subjects, and how solid each feels. Rows reorder weakest first as the student
/// rates them, and the eligibility line for the chosen course updates with every change.
class SubjectsStep extends ConsumerStatefulWidget {
  const SubjectsStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  ConsumerState<SubjectsStep> createState() => _SubjectsStepState();
}

class _SubjectsStepState extends ConsumerState<SubjectsStep> {
  bool _capped = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) ref.read(onboardingAnswersProvider.notifier).ensureSubjects();
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.answers;
    final c = ref.read(onboardingAnswersProvider.notifier);
    final included = a.ranked;
    final rest = [for (final s in kTieOrder) if (!a.subjects.contains(s)) s];
    final course = a.course;
    final check = course == null || a.subjects.isEmpty ? null : EligibilityCheck.of(course, a.subjects.toSet());
    final line = PlanSummary.eligibilityLine(a);

    return StepLayout(
      title: OnboardingCopy.subjectsTitle,
      support: OnboardingCopy.subjectsSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (line != null)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s12),
              child: _Note(
                text: line,
                icon: check?.eligible ?? false ? LucideIcons.check : LucideIcons.circleAlert,
                color: check?.eligible ?? false ? context.mmColors.accentText : context.mmColors.warnText,
              ),
            ),
          for (final s in [...included, ...rest])
            FlipItem(
              key: ValueKey(s),
              child: Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s8),
                child: SubjectRow(
                  subject: s,
                  included: a.subjects.contains(s),
                  confidence: a.confidence[s],
                  onToggle: () => setState(() => _capped = !c.toggleSubject(s)),
                  onConfidence: (v) => c.setConfidence(s, v),
                ),
              ),
            ),
          if (_capped) _Note(text: OnboardingCopy.fiveMax, icon: LucideIcons.info, color: context.mmColors.ink2),
        ],
      ),
      bottom: KeyButton(
        label: OnboardingCopy.next,
        disabledReason: a.subjects.isEmpty ? OnboardingCopy.pickOne : null,
        onPressed: a.subjects.isEmpty
            ? null
            : () {
                c.edit((x) => x.mark(Steps.subjects));
                widget.onNext();
              },
      ),
    );
  }
}

/// A one-line note with its glyph, read out when it changes.
class _Note extends StatelessWidget {
  const _Note({required this.text, required this.icon, required this.color});

  final String text;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.s4, 0),
      child: Semantics(
        liveRegion: true,
        container: true,
        label: text,
        excludeSemantics: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 16, color: color)),
            const SizedBox(width: MmSpace.s8),
            Expanded(child: Text(text, style: context.mmType.small.copyWith(color: context.mmColors.ink))),
          ],
        ),
      ),
    );
  }
}
