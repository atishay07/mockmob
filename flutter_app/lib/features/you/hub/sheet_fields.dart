import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/copy.dart' show RhythmCopy;
import '../copy.dart';
import '../widgets/subject_art.dart';
import '../widgets/you_page.dart' show PillKey;
import '../../rhythm/logic/plan_week.dart' show PlanDay;
import '../../rhythm/widgets/plan_week_strip.dart';

/// One field of the sheet card, ruled off like the header boxes of an answer sheet: a hairline
/// above, a small label, then the value.
class SheetField extends StatelessWidget {
  const SheetField({super.key, required this.label, required this.child, this.trailing, this.first = false});

  final String label;
  final Widget child;

  /// Sits at the end of the label line ("2 of 4 study days").
  final Widget? trailing;

  /// The first field under the hero has no hairline above it.
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s16, bottom: MmSpace.s16),
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

/// The chosen subjects as an equal two-column grid, each beside its coloured glyph tile. Every
/// cell is the same width, so two names never sit at unequal widths on one row.
class SubjectList extends StatelessWidget {
  const SubjectList({super.key, required this.subjects});

  final List<String> subjects;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < subjects.length; i += 2) {
      rows.add(
        Padding(
          padding: EdgeInsets.only(top: i == 0 ? 0 : MmSpace.s12),
          child: Row(
            children: [
              Expanded(child: _SubjectCell(subjects[i])),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: i + 1 < subjects.length ? _SubjectCell(subjects[i + 1]) : const SizedBox.shrink()),
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

class _SubjectCell extends StatelessWidget {
  const _SubjectCell(this.id);

  final String id;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Row(
      children: [
        SubjectArt(id, size: 36),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Text(subjectDisplayName(id), style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

/// The subjects field: the chosen subjects with their objects, and Edit at the end of the
/// label line. The whole field opens the subjects editor.
class SubjectsField extends StatelessWidget {
  const SubjectsField({super.key, required this.subjects, this.onEdit, this.first = false});

  final List<String> subjects;
  final VoidCallback? onEdit;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final field = SheetField(
      first: first,
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
        onRetry = null,
        done = null,
        goal = null;

  const SheetWeek.failed(this.onRetry)
      : state = SheetWeekState.failed,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        onShowMe = null,
        done = null,
        goal = null;

  const SheetWeek.off()
      : state = SheetWeekState.off,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        onShowMe = null,
        onRetry = null,
        done = null,
        goal = null;

  const SheetWeek.ready({
    required this.days,
    required this.count,
    required this.description,
    this.note,
    this.planDays,
    this.onShowMe,
    this.done,
    this.goal,
  })  : state = SheetWeekState.ready,
        onRetry = null;

  final SheetWeekState state;
  final List<WeekBubbleDay> days;

  /// The week as planned (rest days dashed), the same strip Today and Rhythm draw. Null falls
  /// back to the plain bubbles.
  final List<PlanDay>? planDays;

  /// "2 of 4 study days".
  final String? count;

  /// The two numbers behind [count], for the monumental figure. Null falls back to the words.
  final int? done;
  final int? goal;

  /// "Weeks in rhythm: 3", or the pause.
  final String? note;

  /// The whole week in words for TalkBack.
  final String? description;

  /// Opens the study days behind the count ("Show me"). Null when there are none yet: a claim
  /// with no evidence shows no key.
  final VoidCallback? onShowMe;
  final VoidCallback? onRetry;
}

/// The rhythm field: this week in the room's one lit pane. The count stands as a monumental
/// number over the seven answer bubbles. The pane opens the rhythm screen.
class WeekField extends StatelessWidget {
  const WeekField({super.key, required this.week, required this.onOpen});

  final SheetWeek week;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ready = week.state == SheetWeekState.ready;
    final Widget body = switch (week.state) {
      SheetWeekState.loading => const SkeletonGroup(
          label: 'Loading this week',
          child: Align(alignment: Alignment.centerLeft, child: Skeleton(width: 250, height: 30, radius: 15)),
        ),
      SheetWeekState.failed => Row(
          children: [
            Expanded(child: Text(YouCopy.fieldWeekFailed, style: type.small.copyWith(color: colors.ink2))),
            const SizedBox(width: MmSpace.s8),
            PillKey(label: YouCopy.tryAgain, onPressed: week.onRetry),
          ],
        ),
      SheetWeekState.off => Text(YouCopy.rhythmOffLine, style: type.small.copyWith(color: colors.ink2)),
      SheetWeekState.ready => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (week.done != null && week.goal != null) ...[
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: ExcludeSemantics(
                  child: MonumentalNumber(
                    value: '${week.done}',
                    unit: RhythmCopy.ofGoal(week.goal!),
                    style: type.figure.copyWith(fontSize: 56, height: 52 / 56),
                  ),
                ),
              ),
              const SizedBox(height: MmSpace.s8),
            ],
            // Each day is its own stop for TalkBack ("Wednesday, today, planned study day"), read
            // from the rhythm's own words, and the marks are named in a one-line key.
            if (week.planDays != null) ...[
              PlanWeekStrip(days: week.planDays!, bubble: 22, daySemantics: true, animateIn: true),
              const SizedBox(height: MmSpace.s4),
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

    final pane = LitEdge(
      child: FakeGlass(
        opacity: colors.isNight ? 0.5 : 0.72,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text(YouCopy.fieldWeek, style: type.caption.copyWith(color: colors.ink2))),
                  if (ready) Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
                ],
              ),
              const SizedBox(height: MmSpace.s8),
              body,
            ],
          ),
        ),
      ),
    );
    if (week.state != SheetWeekState.ready && week.state != SheetWeekState.off) return pane;
    return Semantics(
      button: true,
      label: [YouCopy.rowRhythm, ?week.count, ?week.note].join('. '),
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onOpen, child: pane),
    );
  }
}
