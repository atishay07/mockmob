import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/student_target.dart';
import '../widgets/you_page.dart' show youText;
import 'sheet_fields.dart';

/// The student's sheet for the season (brief section 12, You): the identity at the top of You.
///
/// It is a hero, not a card. Mobi waves at the top right in the lamp light, the name stands at
/// display size on the ground, and under it this week stands on the ground in the lamp light. The
/// course, colleges and subjects follow as ruled fields like the header boxes of an answer
/// sheet: hairlines, no outer card, no box inside a box. It prints only what is known; a field
/// with nothing in it is left off, and the sheet says what is missing with one way to fill it.
/// The Edit key lives in the page's top row; the subjects field opens the subjects editor.
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

  /// Opens the sheet editor. Used by the finish prompt; the page's top row carries the Edit key.
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
    const fieldInset = EdgeInsets.symmetric(horizontal: youText);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, 0, MmSpace.s12, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(YouCopy.sheetOverlineFor(year), style: type.caption.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s8),
                      Semantics(header: true, child: Text(title, style: type.display, maxLines: 3, overflow: TextOverflow.ellipsis)),
                      if (target.stage != null) ...[
                        const SizedBox(height: MmSpace.s8),
                        Text(target.stage!.sheetLine, style: type.small.copyWith(color: colors.ink2)),
                      ],
                      if (email != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Text(email!, style: type.caption.copyWith(color: colors.ink3), maxLines: 2, overflow: TextOverflow.ellipsis),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              // Mobi waves the first time You opens each day (sleepy late at night), then he is
              // simply there: he breathes and blinks, and a tap makes him react.
              const _YouMobi(),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        WeekField(week: week, onOpen: onOpenRhythm),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (target.course != null)
              Padding(
                padding: fieldInset,
                child: SheetField(label: YouCopy.fieldCourse, child: Text(target.course!, style: type.title)),
              ),
            if (target.colleges.isNotEmpty)
              Padding(
                padding: fieldInset,
                child: SheetField(label: YouCopy.fieldColleges, child: CollegeList(colleges: target.colleges)),
              ),
            if (subjects.isNotEmpty)
              SubjectsField(subjects: subjects, onEdit: onEditSubjects),
            if (missingTarget && onEdit != null) Padding(padding: fieldInset, child: _FinishPrompt(onTap: onEdit!)),
          ],
        ),
      ],
    );
  }
}

/// Mobi at the top right of the sheet. His wave is asked for once, when the screen is first built,
/// so it plays on the first open of the day and never again (MOTION.md 4.13).
class _YouMobi extends StatefulWidget {
  const _YouMobi();

  @override
  State<_YouMobi> createState() => _YouMobiState();
}

class _YouMobiState extends State<_YouMobi> {
  late final MobiAct _entrance = MobiRation.greeting('you');

  @override
  Widget build(BuildContext context) => Mobi(pose: MobiPose.greet, size: 120, interactive: true, entrance: _entrance);
}

/// Shown when the sheet has no course or colleges yet: one line and the one volt key that fills
/// them in. Mobi is already waving in the header, so he is not drawn twice.
class _FinishPrompt extends StatelessWidget {
  const _FinishPrompt({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s20, bottom: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(YouCopy.finishSheet, style: context.mmType.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            KeyButton(label: YouCopy.finishSheetKey, onPressed: onTap),
          ],
        ),
      ),
    );
  }
}
