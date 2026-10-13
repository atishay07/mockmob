import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/student_target.dart';
import '../edit_copy.dart';
import 'sheet_fields.dart';

/// The student's sheet for the season (brief section 12, You): the identity card at the top of
/// You. Smoked glass with the room's one lit edge along its top. It prints only what is known:
/// the name, where the student is, the course and colleges, the subjects and this week's rhythm.
/// A field with nothing in it is left off rather than shown as unknown, and the card says what
/// is missing with one way to fill it. Edit opens the sheet editor; the subjects field opens
/// the subjects editor.
class SheetCard extends StatelessWidget {
  const SheetCard({
    super.key,
    required this.name,
    required this.email,
    required this.target,
    required this.subjects,
    required this.week,
    required this.onOpenRhythm,
    this.onEdit,
    this.onEditSubjects,
  });

  final String? name;
  final String? email;
  final StudentTarget target;

  /// Public subject ids from the profile.
  final List<String> subjects;

  /// The rhythm field's state.
  final SheetWeek week;
  final VoidCallback onOpenRhythm;

  /// Opens the sheet editor. Null hides the key.
  final VoidCallback? onEdit;

  /// Opens the subjects editor.
  final VoidCallback? onEditSubjects;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final trimmed = name?.trim();
    final title = trimmed == null || trimmed.isEmpty ? YouCopy.sheetNameFallback : trimmed;
    final year = target.stage?.cuetYear ?? 2027;
    final missingTarget = target.course == null && target.colleges.isEmpty;

    final fields = <Widget>[
      if (target.course != null) SheetField(label: YouCopy.fieldCourse, child: Text(target.course!, style: type.labelLarge.copyWith(fontSize: 17))),
      if (target.colleges.isNotEmpty) SheetField(label: YouCopy.fieldColleges, child: CollegeList(colleges: target.colleges)),
      if (subjects.isNotEmpty) SubjectsField(subjects: subjects, onEdit: onEditSubjects),
      WeekField(week: week, onOpen: onOpenRhythm),
      if (missingTarget && onEdit != null) _FinishPrompt(onTap: onEdit!),
    ];

    return LitEdge(
      child: FakeGlass(
        opacity: colors.isNight ? 0.5 : 0.72,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s8, MmSpace.s8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text(YouCopy.sheetOverlineFor(year), style: type.caption.copyWith(color: colors.ink2))),
                  if (onEdit != null)
                    KeyButton.quiet(label: EditCopy.editSheet, semanticsLabel: EditCopy.editSheetLabel, onPressed: onEdit),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(right: MmSpace.s12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(header: true, child: Text(title, style: type.headline)),
                    if (target.stage != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(target.stage!.sheetLine, style: type.small.copyWith(color: colors.ink2)),
                    ],
                    if (email != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(email!, style: type.caption.copyWith(color: colors.ink3), maxLines: 2),
                    ],
                    const SizedBox(height: MmSpace.s12),
                    ...fields,
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shown when the sheet has no course or colleges yet: Mobi points at the one way to add them.
class _FinishPrompt extends StatelessWidget {
  const _FinishPrompt({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Mobi(pose: MobiPose.point, size: 56),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(YouCopy.finishSheet, style: context.mmType.small.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s4),
                  KeyButton.quiet(label: YouCopy.finishSheetKey, onPressed: onTap),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
