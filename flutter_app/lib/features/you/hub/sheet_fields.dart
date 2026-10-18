import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/logic/plan_week.dart' show PlanDay, bubbleWeek;
import '../../rhythm/widgets/week_dial.dart';
import '../copy.dart';
import '../widgets/you_page.dart' show PillKey, youText;
import 'week_skeleton.dart';

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

/// The chosen subjects as a row of art tiles: each subject's rendered object on its own light
/// field, its name beneath. The row scrolls sideways with a peek when it is wider than the phone.
/// Every tile has the same size, so two names never sit at unequal widths.
class SubjectList extends StatelessWidget {
  const SubjectList({super.key, required this.subjects, this.padding = EdgeInsets.zero});

  final List<String> subjects;

  /// Space before the first and after the last tile, so the row can bleed to the screen edge.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: padding,
      child: Row(
        children: [
          for (var i = 0; i < subjects.length; i++) ...[
            if (i > 0) const SizedBox(width: MmSpace.s12),
            SubjectTile(subjects[i]),
          ],
        ],
      ),
    );
  }
}

/// One chosen subject on the sheet: the shared subject plate (its light pooled behind the object
/// at the upper right, the name at the bottom left), so a subject looks the same here as on
/// Practice and Insights. Not tappable on its own; the whole field opens the editor.
class SubjectTile extends StatelessWidget {
  const SubjectTile(this.id, {super.key});

  final String id;

  static const double width = 136;
  static const double height = 104;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: SubjectPlate(subject: id, label: subjectDisplayName(id), height: height),
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
    final type = context.mmType;
    const side = MmSpace.gutter;
    final field = Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16, bottom: MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: side),
            child: Row(
              children: [
                Expanded(child: Text(YouCopy.fieldSubjects, style: type.caption.copyWith(color: colors.ink3))),
                if (onEdit != null) ...[
                  Text(YouCopy.editSubjects, style: type.labelLarge.copyWith(fontSize: 14)),
                  const SizedBox(width: MmSpace.s4),
                  Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
                ],
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          SubjectList(subjects: subjects, padding: const EdgeInsets.symmetric(horizontal: side)),
        ],
      ),
    );
    final ruled = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!first) Padding(padding: const EdgeInsets.symmetric(horizontal: side), child: SizedBox(height: 1, child: ColoredBox(color: colors.line))),
        field,
      ],
    );
    if (onEdit == null) return ruled;
    return MmPressable(
      onTap: onEdit,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.99,
      focusRadius: BorderRadius.circular(MmRhythm.plainRadius),
      semanticsLabel: '${YouCopy.editSubjectsLabel}. ${subjects.map(subjectDisplayName).join(', ')}',
      builder: (context, pressed, focused) => ruled,
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
        onRetry = null,
        done = null,
        goal = null,
        paused = false;

  const SheetWeek.failed(this.onRetry)
      : state = SheetWeekState.failed,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        done = null,
        goal = null,
        paused = false;

  const SheetWeek.off()
      : state = SheetWeekState.off,
        days = const [],
        count = null,
        note = null,
        description = null,
        planDays = null,
        onRetry = null,
        done = null,
        goal = null,
        paused = false;

  const SheetWeek.ready({
    required this.days,
    required this.count,
    required this.description,
    this.note,
    this.planDays,
    this.done,
    this.goal,
    this.paused = false,
  })  : state = SheetWeekState.ready,
        onRetry = null;

  final SheetWeekState state;
  final List<WeekBubbleDay> days;

  /// The week as planned (rest days dashed), the same strip Today and Rhythm draw. Null falls
  /// back to the plain bubbles.
  final List<PlanDay>? planDays;

  /// "2 of 4 study days".
  final String? count;

  /// The two numbers behind [count], for the dial. Null falls back to the words.
  final int? done;
  final int? goal;

  /// The week is paused: the dial is dashed and the note carries the pause.
  final bool paused;

  /// "Weeks in rhythm: 3", or the pause.
  final String? note;

  /// The whole week in words for TalkBack.
  final String? description;

  final VoidCallback? onRetry;
}

/// The rhythm field: this week on the ground, in the lamp light. The ring (one segment inked per
/// study day, the count in the middle) is the loudest object under the header, with the plain
/// words beside it and the planned week beneath. The whole field opens the rhythm screen, where
/// the key and the study days live; "Rhythm" with its chevron says so.
class WeekField extends StatelessWidget {
  const WeekField({super.key, required this.week, required this.onOpen});

  final SheetWeek week;
  final VoidCallback onOpen;

  /// The ring's diameter (the shared study week's ring). The skeleton reserves the same height, so
  /// nothing moves when data lands.
  static const double dialSize = 112;

  /// The page margin the field aligns to.
  static const double side = youText;

  /// The line beside the ring: what is left, or that the week is done, or the pause.
  String? _headline() {
    final done = week.done;
    final goal = week.goal;
    if (week.paused) return week.note;
    if (done == null || goal == null) return null;
    if (done >= goal) return YouCopy.weekReached;
    if (done == 0) return YouCopy.weekNone;
    // Days that can still count this week: today and the days after it that are not counted yet. Today counts only while it
    // is open (on a Sunday already counted nothing is left, and "1 more study day" promised a day that does not exist, v15 walk).
    // A goal that cannot be reached says so.
    final today = week.days.indexWhere((d) => d.isToday);
    final left = today < 0 ? null : [for (var d = today; d < week.days.length; d++) if (week.days[d].mark != WeekDayMark.done) d].length;
    if (left != null && goal - done > left) return left == 0 ? YouCopy.weekNoDaysLeft : YouCopy.weekDaysLeft(left);
    return YouCopy.weekToGo(goal - done);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Widget body = switch (week.state) {
      SheetWeekState.loading => const WeekSkeleton(),
      SheetWeekState.failed => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(YouCopy.fieldWeekFailed, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            PillKey(label: YouCopy.tryAgain, onPressed: week.onRetry),
          ],
        ),
      SheetWeekState.off => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(YouCopy.rhythmOffTitle, style: type.title),
            const SizedBox(height: MmSpace.s4),
            Text(YouCopy.rhythmOffLine, style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      SheetWeekState.ready => _ready(context),
    };
    final labelled = week.state == SheetWeekState.failed;

    // No container and no glow: the shared study week stands on the ground between the margins.
    final pane = Padding(
      padding: const EdgeInsets.fromLTRB(side, MmSpace.s4, side, MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (labelled) ...[
            Text(YouCopy.fieldWeek, style: type.caption.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s8),
          ],
          body,
        ],
      ),
    );
    if (week.state != SheetWeekState.ready && week.state != SheetWeekState.off) return pane;
    // The whole pane is the way in to Rhythm: it sinks a touch under the finger, shows the press veil
    // and ticks once. Each day keeps its own stop for TalkBack.
    return MmPressable(
      onTap: onOpen,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.985,
      focusRadius: BorderRadius.circular(MmRhythm.plainRadius),
      semanticsLabel: [YouCopy.rowRhythm, ?week.count, ?week.note].join('. '),
      excludeSemantics: false,
      builder: (context, pressed, focused) => pane,
    );
  }

  Widget _ready(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final headline = _headline();
    final hasDial = week.done != null && week.goal != null;
    // The week as planned (rest days dashed) when the plan is known, else the counted days. The
    // shared study week needs seven columns; a week without them draws only its words.
    final days = week.planDays != null ? bubbleWeek(week.planDays!) : week.days;
    final seven = days.length == 7;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The section title above names the week; its "See rhythm" key and the whole field open Rhythm.
        // L06: the ring says what it counts. The big numeral is the days studied this week and the
        // words inside the ring name the goal ("of 4 study days"), one node for TalkBack.
        if (hasDial) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Semantics(
                container: true,
                label: [?week.count, ?headline].join('. '),
                excludeSemantics: true,
                child: WeekDial(done: week.done!, goal: week.goal!.clamp(1, 7), size: WeekField.dialSize, paused: week.paused),
              ),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: ExcludeSemantics(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (headline != null) Text(headline, style: type.title),
                      if (headline != null && !week.paused && week.note != null) const SizedBox(height: MmSpace.s4),
                      if (!week.paused && week.note != null)
                        Text(week.note!, style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink2)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          SizedBox(height: 1, child: ColoredBox(color: colors.line)),
          const SizedBox(height: MmSpace.s4),
        ],
        if (seven)
          // Today, Rhythm and the week sheet draw this same row of days.
          StudyWeek(days: days, animateIn: true, semanticsLabel: week.description)
        else
          const SizedBox.shrink(),
        if (!hasDial && headline != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(headline, style: type.title),
        ],
      ],
    );
  }
}

