import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/student_target.dart';
import 'sheet_fields.dart';

/// The student's sheet for the season (brief section 12, You): the identity card at the top of
/// You. Smoked glass over charcoal answer-sheet paper, the room's one lit edge along its top and
/// the timing marks of an OMR sheet down its right side. It prints only what is known: the name,
/// the course and colleges picked in setup, the subjects, and this week's rhythm. A field with
/// nothing in it is left off rather than shown as unknown.
class SheetCard extends StatelessWidget {
  const SheetCard({
    super.key,
    required this.name,
    required this.email,
    required this.target,
    required this.subjects,
    required this.week,
    required this.onOpenRhythm,
  });

  final String? name;
  final String? email;
  final StudentTarget target;

  /// Public subject ids from the profile.
  final List<String> subjects;

  /// The rhythm field's state.
  final SheetWeek week;
  final VoidCallback onOpenRhythm;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final trimmed = name?.trim();
    final title = trimmed == null || trimmed.isEmpty ? YouCopy.sheetNameFallback : trimmed;

    final fields = <Widget>[
      if (target.course != null) SheetField(label: YouCopy.fieldCourse, child: Text(target.course!, style: type.labelLarge.copyWith(fontSize: 17))),
      if (target.colleges.isNotEmpty) SheetField(label: YouCopy.fieldColleges, child: CollegeList(colleges: target.colleges)),
      if (subjects.isNotEmpty) SheetField(label: YouCopy.fieldSubjects, child: SubjectList(subjects: subjects)),
      WeekField(week: week, onOpen: onOpenRhythm),
    ];

    return LitEdge(
      child: FakeGlass(
        opacity: colors.isNight ? 0.5 : 0.72,
        backdrop: colors.isNight ? const _PaperBackdrop() : null,
        child: CustomPaint(
          painter: _TimingMarks(colors.isNight ? colors.ink4.withValues(alpha: 0.45) : colors.lineStrong),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, 30, MmSpace.s8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(YouCopy.sheetOverline, style: type.caption.copyWith(color: colors.ink2))),
                    const MmMark(size: 22),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                Semantics(header: true, child: Text(title, style: type.headline)),
                if (email != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  Text(email!, style: type.caption.copyWith(color: colors.ink3), maxLines: 2),
                ],
                const SizedBox(height: MmSpace.s12),
                ...fields,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The charcoal answer-sheet paper with its pressed rings, seen faintly through the glass.
class _PaperBackdrop extends StatelessWidget {
  const _PaperBackdrop();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        image: DecorationImage(
          image: AssetImage(MmArt.paperTile.asset),
          fit: BoxFit.cover,
          alignment: Alignment.topLeft,
          opacity: 0.34,
          onError: (_, _) {},
        ),
      ),
    );
  }
}

/// The black timing marks down the right edge of an OMR sheet: short bars at an even pitch.
class _TimingMarks extends CustomPainter {
  const _TimingMarks(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const pitch = 14.0;
    final x = size.width - 15;
    for (var y = 26.0; y < size.height - 22; y += pitch) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, 7, 3), const Radius.circular(1)), paint);
    }
  }

  @override
  bool shouldRepaint(_TimingMarks old) => old.color != color;
}
