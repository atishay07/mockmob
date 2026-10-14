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

/// Hairlines of a flat list start where the row text starts: 4 dp, a 28 dp bare icon, 16 dp.
const double _flatInset = 4 + 28 + MmSpace.s16;

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
  final WeekSaveController _weekSave = WeekSaveController();

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
  void dispose() {
    _weekSave.dispose();
    super.dispose();
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

    // Three groups on the ground, not four cards: who you are, what you are aiming at, and the
    // week. Save is pinned at the foot, so it is always in reach however long the page is.
    return YouPage(
      title: EditCopy.sheetTitle,
      footer: WeekSaveFooter(controller: _weekSave),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, 0, youText, 0),
          child: Text(EditCopy.sheetIntro, style: type.small.copyWith(color: colors.ink2)),
        ),
        const GroupHeading(EditCopy.groupAbout, top: MmSpace.s24),
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.pencilLine,
              title: EditCopy.rowName,
              value: name == null || name.isEmpty ? EditCopy.notSet : name,
              onTap: _editName,
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.signpost,
              title: EditCopy.rowStage,
              note: target.stage?.sheetLine ?? EditCopy.notSet,
              onTap: () => showStageSheet(context, ref),
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.circleAlert,
              title: EditCopy.rowWorry,
              note: target.worry?.option ?? EditCopy.notSet,
              onTap: () => showWorrySheet(context, ref),
            ),
          ],
        ),
        if (_nameSavedAt != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, MmSpace.gutter, 0),
            child: ReceiptLine(text: EditCopy.nameSaved(_nameSavedAt!)),
          ),
        const GroupHeading(EditCopy.groupTarget, top: MmSpace.s24),
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.graduationCap,
              title: EditCopy.rowCourse,
              note: target.course ?? EditCopy.courseNotSure,
              onTap: _editCourse,
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.landmark,
              title: EditCopy.rowColleges,
              note: target.colleges.isEmpty ? EditCopy.notSet : target.colleges.join('\n'),
              onTap: () => showCollegesSheet(context),
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.tag,
              title: EditCopy.rowCategory,
              value: categoryTitle(target.category),
              onTap: () => showCategorySheet(context, ref),
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.bookOpen,
              title: EditCopy.rowSubjects,
              note: subjects.isEmpty ? EditCopy.notSet : subjects.map(subjectDisplayName).join(', '),
              onTap: () => openYouPage(context, YouPaths.subjects),
            ),
            if (subjects.isNotEmpty)
              YouRow(
                flat: true,
                icon: LucideIcons.gauge,
                title: EditCopy.rowConfidence,
                value: EditCopy.confidenceValue(rated, subjects.length),
                onTap: () => showConfidenceSheet(context, subjects),
              ),
          ],
        ),
        if (_courseUndo != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, MmSpace.gutter, 0),
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
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, MmSpace.gutter, 0),
            child: Semantics(liveRegion: true, child: Text(EditCopy.courseRestored, style: type.small.copyWith(color: colors.ink2))),
          ),
        const GroupHeading(EditCopy.groupWeek, top: MmSpace.s24),
        WeekEditor(controller: _weekSave),
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s24, youText, 0),
          child: Text(EditCopy.phoneOnly, style: type.caption.copyWith(color: colors.ink2)),
        ),
      ],
    );
  }
}
