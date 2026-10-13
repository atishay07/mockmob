import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/model/answers.dart' show OnboardingAnswers;
import '../../onboarding/state/answers_controller.dart' show onboardingAnswersProvider;
import '../account/name_sheet.dart';
import '../copy.dart';
import '../data/sheet_editor.dart' show CourseSnapshot, sheetEditorProvider;
import '../data/student_target.dart';
import '../edit_copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_routes.dart';
import 'choice_sheets.dart';
import 'week_editor.dart';

const double _rowInset = MmSpace.gutter + 36 + MmSpace.s12;

/// Everything setup asked, editable after it (owner feedback 11-10: "there is no option to edit
/// subject"): name, where the student is, course and colleges, subjects and how solid each
/// feels, what costs marks, and the study week. Each row shows its current answer; a field never
/// answered reads "Not set" rather than a default.
class SheetEditorScreen extends ConsumerStatefulWidget {
  const SheetEditorScreen({super.key});

  @override
  ConsumerState<SheetEditorScreen> createState() => _SheetEditorScreenState();
}

/// The parts of the sheet that Undo would overwrite, as one comparable value.
(String?, bool, String, bool)? _courseKey(OnboardingAnswers? a) =>
    a == null ? null : (a.courseId, a.courseUndecided, a.colleges.join('|'), a.openToAny);

class _SheetEditorScreenState extends ConsumerState<SheetEditorScreen> {
  DateTime? _nameSavedAt;

  /// The course and colleges before a change that removed colleges, while the undo is offered.
  CourseSnapshot? _courseUndo;
  bool _courseRestored = false;

  Future<void> _editCourse() async {
    final removed = await showCourseSheet(context, ref);
    if (!mounted) return;
    setState(() {
      _courseUndo = removed;
      _courseRestored = false;
    });
  }

  void _undoCourse() {
    final before = _courseUndo;
    if (before == null) return;
    ref.read(sheetEditorProvider).restoreCourse(before);
    setState(() {
      _courseUndo = null;
      _courseRestored = true;
    });
  }

  Future<void> _editName() async {
    final saved = await showNameSheet(context);
    if (saved != null && mounted) setState(() => _nameSavedAt = ref.read(nowProvider)());
  }

  @override
  Widget build(BuildContext context) {
    // Undo puts the old course and colleges back, so it only stands while those are as the change
    // left them. A later pick of colleges or course drops it, rather than being overwritten.
    ref.listen(onboardingAnswersProvider.select((a) => _courseKey(a.value)), (before, now) {
      if (before == now || _courseUndo == null) return;
      setState(() => _courseUndo = null);
    });
    final colors = context.mmColors;
    final type = context.mmType;
    final auth = ref.watch(authSnapshotProvider);
    final target = ref.watch(studentTargetProvider);
    final subjects = auth.subjects.isNotEmpty ? auth.subjects : target.subjects;
    final rated = subjects.where(target.confidence.containsKey).length;
    final name = auth.name?.trim();

    return YouPage(
      title: EditCopy.sheetTitle,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.s8, 0, MmSpace.gutter, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Mobi(pose: MobiPose.greet, size: 72, say: EditCopy.sheetIntro, interactive: true),
          ),
        ),
        const GroupHeading(EditCopy.groupAbout, top: MmSpace.s24),
        YouPanel(
          inset: _rowInset,
          children: [
            YouRow(
              icon: LucideIcons.pencilLine,
              title: EditCopy.rowName,
              value: name == null || name.isEmpty ? EditCopy.notSet : name,
              onTap: _editName,
            ),
            YouRow(
              icon: LucideIcons.signpost,
              title: EditCopy.rowStage,
              note: target.stage?.sheetLine ?? EditCopy.notSet,
              onTap: () => showStageSheet(context, ref),
            ),
          ],
        ),
        if (_nameSavedAt != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s12, MmSpace.gutter, 0),
            child: ReceiptLine(text: EditCopy.nameSaved(_nameSavedAt!)),
          ),
        const GroupHeading(EditCopy.groupTarget, top: MmSpace.s24),
        YouPanel(
          inset: _rowInset,
          children: [
            YouRow(
              icon: LucideIcons.graduationCap,
              title: EditCopy.rowCourse,
              note: target.course ?? EditCopy.courseNotSure,
              onTap: _editCourse,
            ),
            YouRow(
              icon: LucideIcons.landmark,
              title: EditCopy.rowColleges,
              note: target.colleges.isEmpty ? EditCopy.notSet : target.colleges.join('\n'),
              onTap: () => showCollegesSheet(context),
            ),
            YouRow(
              icon: LucideIcons.tag,
              title: EditCopy.rowCategory,
              value: target.category,
              onTap: () => showCategorySheet(context, ref),
            ),
          ],
        ),
        if (_courseUndo != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s12, MmSpace.gutter, 0),
            child: Row(
              children: [
                Expanded(
                  child: Semantics(
                    liveRegion: true,
                    child: Text(EditCopy.courseChanged(_courseUndo!.colleges.length), style: type.small.copyWith(color: colors.ink2)),
                  ),
                ),
                KeyButton.quiet(label: EditCopy.courseUndo, onPressed: _undoCourse),
              ],
            ),
          )
        else if (_courseRestored)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s12, MmSpace.gutter, 0),
            child: Semantics(liveRegion: true, child: Text(EditCopy.courseRestored, style: type.small.copyWith(color: colors.ink2))),
          ),
        const GroupHeading(EditCopy.groupSubjects, top: MmSpace.s24),
        YouPanel(
          inset: _rowInset,
          children: [
            YouRow(
              icon: LucideIcons.bookOpen,
              title: EditCopy.rowSubjects,
              note: subjects.isEmpty ? EditCopy.notSet : subjects.map(subjectDisplayName).join(', '),
              onTap: () => openYouPage(context, YouPaths.subjects),
            ),
            if (subjects.isNotEmpty)
              YouRow(
                icon: LucideIcons.gauge,
                title: EditCopy.rowConfidence,
                value: EditCopy.confidenceValue(rated, subjects.length),
                onTap: () => showConfidenceSheet(context, subjects),
              ),
            YouRow(
              icon: LucideIcons.circleAlert,
              title: EditCopy.rowWorry,
              note: target.worry?.option ?? EditCopy.notSet,
              onTap: () => showWorrySheet(context, ref),
            ),
          ],
        ),
        const GroupHeading(EditCopy.groupWeek, top: MmSpace.s24),
        const WeekEditor(),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s32, MmSpace.gutter, 0),
          child: Text(EditCopy.phoneOnly, style: type.caption.copyWith(color: colors.ink3)),
        ),
      ],
    );
  }
}
