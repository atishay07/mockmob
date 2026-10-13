// The content of the You rhythm screen (spec 5.11): this week as the lit hero (the count as a
// monumental number over seven answer bubbles), the run, the goal, pause, closed weeks, the
// Celebrations setting, and the quiet Turn off rhythm. Stateless: the screen passes the state and
// the callbacks, and goldens render it directly.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/rhythm.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_row.dart' show IconWell, RowFrame, YouPanel;
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/week_view.dart';
import 'rhythm_page.dart';
import '../logic/plan_week.dart';
import 'plan_week_strip.dart';

class RhythmBody extends StatelessWidget {
  const RhythmBody({
    super.key,
    required this.snapshot,
    required this.rhythmOff,
    required this.mode,
    required this.busy,
    required this.onEditGoal,
    required this.onPauseThisWeek,
    required this.onPauseTwoWeeks,
    required this.onPauseUntilOn,
    required this.onResume,
    required this.onTurnOff,
    required this.onTurnOn,
    required this.onMode,
    this.errorText,
    this.plan,
  });

  final RhythmSnapshot snapshot;
  final bool rhythmOff;
  final CelebrationMode mode;

  /// A write is in flight: the keys wait.
  final bool busy;
  final String? errorText;
  final VoidCallback onEditGoal;
  final VoidCallback onPauseThisWeek;
  final VoidCallback onPauseTwoWeeks;
  final VoidCallback onPauseUntilOn;
  final VoidCallback onResume;
  final VoidCallback onTurnOff;
  final VoidCallback onTurnOn;
  final ValueChanged<CelebrationMode> onMode;

  /// The student's chosen study days (0 = Monday), or null without a plan.
  final Set<int>? plan;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rhythm = snapshot.rhythm!;
    final week = snapshot.week!;
    final note = runNote(rhythm);
    final closed = closedWeeks(rhythm);
    final goal = snapshot.goal?.daysPerWeek ?? rhythm.daysGoal;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot.stale && snapshot.fetchedAt != null) ...[
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: MmSpace.s8),
            child: Text(RhythmCopy.asOf(snapshot.fetchedAt!), style: type.caption.copyWith(color: colors.ink3)),
          ),
        ],
        if (errorText != null) ...[
          InlineBanner(message: errorText!, tone: BannerTone.error),
          const SizedBox(height: MmSpace.s12),
        ],
        if (rhythmOff) _OffPanel(onTurnOn: onTurnOn) else WeekHero(week: week, plan: plan),
        const SizedBox(height: MmSpace.s24),
        YouPanel(
          margin: EdgeInsets.zero,
          children: [
            _Line(text: note ?? weeksInRhythmText(rhythm)),
            // The new-run note already says the best, so the Best run row would repeat it.
            if (rhythm.bestRun > 0 && note == null) _Line(text: RhythmCopy.bestRun(rhythm.bestRun)),
            _Line(
              text: RhythmCopy.goalRow(goal),
              trailing: KeyButton.quiet(label: RhythmCopy.editGoal, onPressed: busy ? null : onEditGoal),
            ),
          ],
        ),
        if (!rhythmOff) ...[
          const SizedBox(height: MmSpace.s32),
          _PauseGroup(
            paused: week.status == WeekStatus.paused,
            busy: busy,
            onThisWeek: onPauseThisWeek,
            onTwoWeeks: onPauseTwoWeeks,
            onUntilOn: onPauseUntilOn,
            onResume: onResume,
          ),
        ],
        if (closed.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s32),
          const GroupHeading(RhythmCopy.closedWeeks),
          YouPanel(
            margin: EdgeInsets.zero,
            children: [for (final w in closed) _ClosedWeek(week: w)],
          ),
        ],
        const SizedBox(height: MmSpace.s32),
        const GroupHeading(RhythmCopy.celebrationsTitle),
        CelebrationsPicker(mode: mode, onMode: onMode),
        if (!rhythmOff) ...[
          const SizedBox(height: MmSpace.s24),
          FlushQuietKey(label: RhythmCopy.turnOff, onPressed: onTurnOff),
        ],
      ],
    );
  }
}

/// This week, lit: the count as a monumental number, the planned week (the same strip as Today
/// and the week sheet: counted, planned, rest, not yet), and one plain line.
class WeekHero extends StatelessWidget {
  const WeekHero({super.key, required this.week, this.plan});

  final WeekView week;
  final Set<int>? plan;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final status = switch (week.status) {
      WeekStatus.open => RhythmCopy.goalSentence(week.goal),
      WeekStatus.met => RhythmCopy.weekDoneSentence,
      WeekStatus.extra || WeekStatus.paused => week.label,
    };
    return LitEdge(
      child: FakeGlass(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(RhythmCopy.weekTitle, style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: MonumentalNumber(
                  value: '${week.studyDays}',
                  unit: RhythmCopy.ofGoal(week.goal),
                  style: type.figure.copyWith(fontSize: 72, height: 66 / 72),
                  semanticsLabel: week.label,
                ),
              ),
              const SizedBox(height: MmSpace.s16),
              Builder(
                builder: (context) {
                  final todayIndex = week.days.indexWhere((d) => d.isToday);
                  final strip = PlanWeekStrip(
                    days: planWeek(
                      studied: [for (final d in week.days) d.studyDay],
                      todayIndex: todayIndex < 0 ? null : todayIndex,
                      planned: plan,
                      dates: [for (final d in week.days) d.date?.day],
                    ),
                    bubble: 28,
                    showDates: true,
                  );
                  return Semantics(label: strip.describe(), child: strip);
                },
              ),
              const SizedBox(height: MmSpace.s12),
              Text(status, style: type.small.copyWith(color: colors.ink2)),
            ],
          ),
        ),
      ),
    );
  }
}

class _OffPanel extends StatelessWidget {
  const _OffPanel({required this.onTurnOn});

  final VoidCallback onTurnOn;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return YouPanel(
      margin: EdgeInsets.zero,
      children: [
        Padding(
          padding: const EdgeInsets.all(MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(RhythmCopy.rhythmOffTitle, style: type.title),
              const SizedBox(height: MmSpace.s4),
              Text(RhythmCopy.rhythmOffBody, style: type.body.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s16),
              KeyButton.secondary(label: RhythmCopy.turnOnRhythm, onPressed: onTurnOn),
            ],
          ),
        ),
      ],
    );
  }
}

/// One line of the run panel, with an optional key at its end.
class _Line extends StatelessWidget {
  const _Line({required this.text, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, trailing == null ? MmSpace.gutter : MmSpace.s4, MmSpace.s8),
        child: Row(
          children: [
            Expanded(child: Text(text, style: context.mmType.labelLarge.copyWith(fontSize: 16))),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

/// A closed week: its words and the week as a row of bubbles, the study days inked.
class _ClosedWeek extends StatelessWidget {
  const _ClosedWeek({required this.week});

  final RhythmWeek week;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final days = week.studyDays;
    final goal = week.goal;
    final met = week.met;
    final total = days > goal ? days : goal;
    return Semantics(
      container: true,
      label: met ? '${closedWeekText(week)} ${RhythmCopy.goalMet}' : closedWeekText(week),
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
        child: Row(
          children: [
            Expanded(child: Text(closedWeekText(week), style: type.body.copyWith(color: colors.ink))),
            const SizedBox(width: MmSpace.s12),
            BubbleRow(
              states: [for (var i = 0; i < total; i++) i < days ? BubbleState.filled : BubbleState.hollow],
              bubbleSize: 10,
              gap: 4,
            ),
          ],
        ),
      ),
    );
  }
}

class _PauseGroup extends StatelessWidget {
  const _PauseGroup({
    required this.paused,
    required this.busy,
    required this.onThisWeek,
    required this.onTwoWeeks,
    required this.onUntilOn,
    required this.onResume,
  });

  final bool paused;
  final bool busy;
  final VoidCallback onThisWeek;
  final VoidCallback onTwoWeeks;
  final VoidCallback onUntilOn;
  final VoidCallback onResume;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupHeading(RhythmCopy.pauseTitle),
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: MmSpace.s12),
          child: Text(RhythmCopy.pausedKeepsRun, style: type.small.copyWith(color: colors.ink2)),
        ),
        if (paused)
          KeyButton.secondary(label: RhythmCopy.resume, onPressed: busy ? null : onResume)
        else
          YouPanel(
            margin: EdgeInsets.zero,
            inset: MmSpace.gutter + 36 + MmSpace.s12,
            children: [
              _PauseRow(label: RhythmCopy.pauseThisWeek, onTap: busy ? null : onThisWeek),
              _PauseRow(label: RhythmCopy.pauseTwoWeeks, onTap: busy ? null : onTwoWeeks),
              _PauseRow(label: RhythmCopy.pauseUntilOn, onTap: busy ? null : onUntilOn),
            ],
          ),
      ],
    );
  }
}

/// A pause preset as a row with a pause glyph, so a preset reads as an action.
class _PauseRow extends StatelessWidget {
  const _PauseRow({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return RowFrame(
      onTap: onTap,
      semanticsLabel: '${RhythmCopy.pauseTitle}, $label',
      child: Row(
        children: [
          IconWell(LucideIcons.pause, color: onTap == null ? colors.ink4 : colors.ink2),
          const SizedBox(width: MmSpace.s12),
          Expanded(child: Text(label, style: type.labelLarge.copyWith(fontSize: 16, color: onTap == null ? colors.ink3 : colors.ink))),
        ],
      ),
    );
  }
}

/// Celebrations: Full, Quiet or Off (spec 6.2), as a segmented control with the plain hint under it.
class CelebrationsPicker extends StatelessWidget {
  const CelebrationsPicker({super.key, required this.mode, required this.onMode});

  final CelebrationMode mode;
  final ValueChanged<CelebrationMode> onMode;

  static String hint(CelebrationMode m) => switch (m) {
        CelebrationMode.full => RhythmCopy.celebrationsFullHint,
        CelebrationMode.quiet => RhythmCopy.celebrationsQuietHint,
        CelebrationMode.off => RhythmCopy.celebrationsOffHint,
      };

  static String label(CelebrationMode m) => switch (m) {
        CelebrationMode.full => RhythmCopy.celebrationsFull,
        CelebrationMode.quiet => RhythmCopy.celebrationsQuiet,
        CelebrationMode.off => RhythmCopy.celebrationsOff,
      };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmSegmented<CelebrationMode>(
          semanticsLabel: RhythmCopy.celebrationsTitle,
          segments: [for (final m in CelebrationMode.values) MmSegment(m, label(m))],
          value: mode,
          onChanged: onMode,
        ),
        Padding(
          padding: const EdgeInsets.only(left: 4, top: MmSpace.s8),
          child: Text(hint(mode), style: context.mmType.caption.copyWith(color: context.mmColors.ink2)),
        ),
      ],
    );
  }
}
