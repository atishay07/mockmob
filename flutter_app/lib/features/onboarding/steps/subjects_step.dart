import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/eligibility.dart';
import '../data/subjects.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/entrance.dart';
import '../widgets/flip_reorder.dart';
import '../widgets/step_layout.dart';
import '../widgets/subject_picker.dart';
import '../widgets/subject_row.dart';

/// The subjects a row is offered for without opening the picker: the Commerce set the course
/// list is built on, the General Test and Maths.
const List<SheetSubject> kQuickSubjects = [
  SheetSubject.accountancy,
  SheetSubject.economics,
  SheetSubject.businessStudies,
  SheetSubject.english,
  SheetSubject.generalTest,
  SheetSubject.mathematics,
];

/// Step 5: the subjects, and how solid each feels. Chosen rows reorder weakest first as the
/// student rates them; the common picks sit under them, and "Add a subject" opens all 15 (and
/// what MockMob doesn't offer yet). The eligibility line for the chosen course updates live.
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
    final colors = context.mmColors;
    final c = ref.read(onboardingAnswersProvider.notifier);
    final included = a.ranked;
    final rest = [for (final s in kQuickSubjects) if (!a.subjects.contains(s)) s];
    final course = a.course;
    final check = course == null || a.subjects.isEmpty ? null : EligibilityCheck.of(course, a.subjects.toSet());
    final line = PlanSummary.eligibilityLine(a);

    // Rows lift in the order they stand: the chosen ones, then the common picks.
    final order = [...included, ...rest];
    Widget row(SheetSubject s) => FlipItem(
          key: ValueKey(s),
          child: EntranceItem.answer(
            order.indexOf(s) + (line == null ? 0 : 1),
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
        );

    return StepLayout(
      title: OnboardingCopy.subjectsTitle,
      support: OnboardingCopy.subjectsSupport,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (line != null)
            EntranceItem.answer(
              0,
              child: Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s12),
              child: _Note(
                text: line,
                icon: check?.eligible ?? false ? LucideIcons.check : LucideIcons.circleAlert,
                color: check?.eligible ?? false ? colors.accentText : colors.warnText,
              ),
            ),
            ),
          for (final s in included) row(s),
          if (_capped)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: _Note(text: OnboardingCopy.fiveMax, icon: LucideIcons.info, color: colors.ink2),
            ),
          if (rest.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s12, MmSpace.s4, MmSpace.s8),
              child: Text(OnboardingCopy.commonPicks, style: context.mmType.label.copyWith(color: colors.ink3)),
            ),
            for (final s in rest) row(s),
          ],
          _AddRow(onTap: () => showSubjectPicker(context)),
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

/// "Add a subject": a dashed bubble, the line, and how many MockMob offers.
class _AddRow extends ConsumerWidget {
  const _AddRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: OnboardingCopy.addSubject,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised : Colors.transparent,
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.lineStrong)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 40,
                  child: Center(child: Icon(LucideIcons.plus, size: 20, color: colors.ink)),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(OnboardingCopy.addSubject, style: type.body.copyWith(fontWeight: FontWeight.w600)),
                      Text(OnboardingCopy.addSubjectNote, style: type.caption.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
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
