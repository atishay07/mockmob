import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/subject_art.dart';
import '../../rhythm/logic/plan_week.dart' show PlanDay;
import '../../rhythm/widgets/plan_week_strip.dart';

/// One field of the sheet card, ruled off like the header boxes of an answer sheet: a hairline
/// above, a small label, then the value.
class SheetField extends StatelessWidget {
  const SheetField({super.key, required this.label, required this.child, this.trailing});

  final String label;
  final Widget child;

  /// Sits at the end of the label line ("2 of 4 study days").
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s12 + 2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text(label, style: type.caption.copyWith(color: colors.ink3))),
                ?trailing,
              ],
            ),
            const SizedBox(height: MmSpace.s6),
            child,
          ],
        ),
      ),
    );
  }
}

/// The colleges in order of preference, each with its rank printed in an answer ring.
class CollegeList extends StatelessWidget {
  const CollegeList({super.key, required this.colleges});

  final List<String> colleges;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < colleges.length; i++)
          Semantics(
            container: true,
            label: YouCopy.collegeChoice(i + 1, colleges[i]),
            excludeSemantics: true,
            child: Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : MmSpace.s8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _RankRing(i + 1),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(colleges[i], style: type.labelLarge.copyWith(color: colors.ink))),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _RankRing extends StatelessWidget {
  const _RankRing(this.rank);

  final int rank;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.lineStrong, width: 1.4)),
      alignment: Alignment.center,
      child: Text(
        '$rank',
        textScaler: TextScaler.noScaling,
        style: context.mmType.caption.copyWith(fontSize: 11, height: 1, fontWeight: FontWeight.w700, color: colors.ink2),
      ),
    );
  }
}

/// The chosen subjects, each beside its small lamp-lit object.
class SubjectList extends StatelessWidget {
  const SubjectList({super.key, required this.subjects});

  final List<String> subjects;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Wrap(
      spacing: MmSpace.s16,
      runSpacing: MmSpace.s8,
      children: [
        for (final id in subjects)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox.square(
                dimension: 26,
                child: SubjectArt(id, size: 26),
              ),
              const SizedBox(width: MmSpace.s6),
              Text(subjectDisplayName(id), style: type.labelLarge.copyWith(fontSize: 14)),
            ],
          ),
      ],
    );
  }
}

/// The subjects field: the chosen subjects with their objects, and Edit at the end of the
/// label line. The whole field opens the subjects editor.
class SubjectsField extends StatelessWidget {
  const SubjectsField({super.key, required this.subjects, this.onEdit});

  final List<String> subjects;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final field = SheetField(
      label: YouCopy.fieldSubjects,
      trailing: onEdit == null
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(YouCopy.editSubjects, style: context.mmType.labelLarge.copyWith(fontSize: 14)),
                const SizedBox(width: MmSpace.s4),
                Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
              ],
            ),
      child: SubjectList(subjects: subjects),
    );
    if (onEdit == null) return field;
    return Semantics(
      button: true,
      label: '${YouCopy.editSubjectsLabel}. ${subjects.map(subjectDisplayName).join(', ')}',
      excludeSemantics: true,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onEdit, child: field),
    );
  }
}

/// What the rhythm field of the sheet shows.
enum SheetWeekState { loading, failed, off, ready }

class SheetWeek {
  const SheetWeek.loading()
      : state = SheetWeekState.loading,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        onShowMe = null,
        onRetry = null;

  const SheetWeek.failed(this.onRetry)
      : state = SheetWeekState.failed,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        onShowMe = null;

  const SheetWeek.off()
      : state = SheetWeekState.off,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        onShowMe = null,
        onRetry = null;

  const SheetWeek.ready({required this.days, required this.count, required this.description, this.note, this.planDays, this.onShowMe})
      : state = SheetWeekState.ready,
        onRetry = null;

  final SheetWeekState state;
  final List<WeekBubbleDay> days;

  /// The week as planned (rest days dashed), the same strip Today and Rhythm draw. Null falls
  /// back to the plain bubbles.
  final List<PlanDay>? planDays;

  /// "2 of 4 study days".
  final String? count;

  /// "Weeks in rhythm: 3", or the pause.
  final String? note;

  /// The whole week in words for TalkBack.
  final String? description;

  /// Opens the study days behind the count ("Show me"). Null when there are none yet: a claim
  /// with no evidence shows no key.
  final VoidCallback? onShowMe;
  final VoidCallback? onRetry;
}

/// The rhythm field: this week as seven bubbles with the count beside the label. The field
/// opens the rhythm screen.
class WeekField extends StatelessWidget {
  const WeekField({super.key, required this.week, required this.onOpen});

  final SheetWeek week;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Widget body = switch (week.state) {
      SheetWeekState.loading => const SkeletonGroup(
          label: 'Loading this week',
          child: Align(alignment: Alignment.centerLeft, child: Skeleton(width: 250, height: 30, radius: 15)),
        ),
      SheetWeekState.failed => Row(
          children: [
            Expanded(child: Text(YouCopy.fieldWeekFailed, style: type.small.copyWith(color: colors.ink2))),
            KeyButton.quiet(label: YouCopy.tryAgain, onPressed: week.onRetry),
          ],
        ),
      SheetWeekState.off => Text(YouCopy.rhythmOffLine, style: type.small.copyWith(color: colors.ink2)),
      SheetWeekState.ready => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Each day is its own stop for TalkBack ("Wednesday, today, planned study day"), read
            // from the rhythm's own words, and the marks are named in a one-line key.
            if (week.planDays != null) ...[
              PlanWeekStrip(days: week.planDays!, bubble: 20, daySemantics: true),
              const SizedBox(height: MmSpace.s8),
              PlanWeekKey(days: week.planDays!),
            ] else
              WeekBubbles(days: week.days, bubbleSize: 24, gap: 13, semanticsLabel: week.description),
            if (week.note != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(week.note!, style: type.caption.copyWith(color: colors.ink2)),
            ],
            if (week.onShowMe != null) ...[
              const SizedBox(height: MmSpace.s4),
              ShowMePill(onTap: week.onShowMe!, semanticsLabel: YouCopy.showMeWeek),
            ],
          ],
        ),
    };

    final field = SheetField(
      label: YouCopy.fieldWeek,
      trailing: week.state == SheetWeekState.ready
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(week.count!, style: type.labelLarge.copyWith(fontSize: 14)),
                const SizedBox(width: MmSpace.s4),
                Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
              ],
            )
          : null,
      child: body,
    );
    if (week.state != SheetWeekState.ready && week.state != SheetWeekState.off) return field;
    return Semantics(
      button: true,
      label: [YouCopy.rowRhythm, ?week.count, ?week.note].join('. '),
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onOpen, child: field),
    );
  }
}
