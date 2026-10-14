// The content of the You rhythm screen (spec 5.11): this week as the lit hero (the count as a
// monumental number over seven answer bubbles), the run, the goal, pause, closed weeks, the
// Celebrations setting, and the quiet Turn off rhythm. Stateless: the screen passes the state and
// the callbacks, and goldens render it directly.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show PillKey, SectionTitle;
import '../../you/widgets/you_row.dart' show RowFrame, YouPanel;
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/week_view.dart';
import 'rhythm_page.dart';
import '../logic/plan_week.dart';
import 'plan_week_strip.dart';
import 'proud_mobi.dart';
import 'run_ribbon.dart';
import 'week_dial.dart';

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
    this.savedText,
    this.plan,
  });

  final RhythmSnapshot snapshot;
  final bool rhythmOff;
  final CelebrationMode mode;

  /// A write is in flight: the keys wait.
  final bool busy;
  final String? errorText;

  /// A receipt for a save the server acknowledged (the study days).
  final String? savedText;
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
    final ribbon = ribbonWeeks(rhythm, week);
    final goal = snapshot.goal?.daysPerWeek ?? rhythm.daysGoal;

    // One authored entrance as the page arrives (route driver): this week first, then the run,
    // the plan, the pause and the celebrations in reading order. Nothing moves once it is up.
    return MmStagger(
      driver: MmStaggerDriver.route,
      child: Column(
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
            const SizedBox(height: MmRhythm.item),
          ],
          if (savedText != null) ...[
            Padding(padding: const EdgeInsets.only(left: 4), child: ReceiptLine(text: savedText!)),
            const SizedBox(height: MmRhythm.item),
          ],
          MmStaggerItem(index: 0, child: rhythmOff ? _OffPanel(onTurnOn: onTurnOn) : WeekHero(week: week, plan: plan)),
          const SizedBox(height: MmRhythm.section),
          // The run: two numbers, then every week the server sent as a ribbon of capsules. Without
          // a run there is one plain line (never a zero).
          MmStaggerItem(
            index: 1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SectionTitle(RhythmCopy.runTitle),
                _RunStats(rhythm: rhythm, note: note),
                if (ribbon.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s16),
                  RunRibbon(weeks: ribbon),
                ],
              ],
            ),
          ),
          const SizedBox(height: MmRhythm.section),
          MmStaggerItem(
            index: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SectionTitle(RhythmCopy.planTitle),
                YouPanel(
                  margin: EdgeInsets.zero,
                  inset: MmSpace.gutter,
                  children: [
                    _SettingRow(label: RhythmCopy.goalLabel, value: RhythmCopy.goalValue(goal), onTap: busy ? null : onEditGoal),
                    _SettingRow(
                      label: RhythmCopy.studyDaysLabel,
                      value: plan == null || plan!.isEmpty
                          ? RhythmCopy.studyDaysNotSet
                          : plan!.length == 7
                              ? RhythmCopy.everyDay
                              : joinWithAnd([for (final d in plan!.toList()..sort()) weekdayNames[d].substring(0, 3)]),
                      onTap: busy ? null : onEditGoal,
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (!rhythmOff) ...[
            const SizedBox(height: MmRhythm.section),
            MmStaggerItem(
              index: 3,
              child: _PauseGroup(
                paused: week.status == WeekStatus.paused,
                busy: busy,
                onThisWeek: onPauseThisWeek,
                onTwoWeeks: onPauseTwoWeeks,
                onUntilOn: onPauseUntilOn,
                onResume: onResume,
              ),
            ),
          ],
          const SizedBox(height: MmRhythm.section),
          MmStaggerItem(
            index: 4,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SectionTitle(RhythmCopy.celebrationsTitle),
                CelebrationsPicker(mode: mode, onMode: onMode),
                if (!rhythmOff) ...[
                  const SizedBox(height: MmRhythm.group),
                  FlushQuietKey(label: RhythmCopy.turnOff, onPressed: onTurnOff),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// This week, lit: the ring on the ground in a pool of lamp light (one segment inked per study day,
/// the count in the middle), the dates and one plain line, then the planned week in the room's one
/// lit pane (counted, planned, rest, not yet). The counted days ink in one after another when the
/// screen opens, and each day answers a tap with a light tick and its name in words. Mobi cheers
/// beside the ring when the week is met and rests while it is paused; otherwise he stays out of it.
class WeekHero extends ConsumerStatefulWidget {
  const WeekHero({super.key, required this.week, this.plan});

  final WeekView week;
  final Set<int>? plan;

  @override
  ConsumerState<WeekHero> createState() => _WeekHeroState();
}

class _WeekHeroState extends ConsumerState<WeekHero> {
  int? _selected;

  String _status(WeekView week) => switch (week.status) {
        WeekStatus.open => RhythmCopy.toGo((week.goal - week.studyDays).clamp(1, 7)),
        WeekStatus.met => RhythmCopy.weekDoneSentence,
        WeekStatus.extra || WeekStatus.paused => week.label,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final week = widget.week;
    final paused = week.status == WeekStatus.paused;
    final todayIndex = week.days.indexWhere((d) => d.isToday);
    final days = planWeek(
      studied: [for (final d in week.days) d.studyDay],
      todayIndex: todayIndex < 0 ? null : todayIndex,
      planned: widget.plan,
      dates: [for (final d in week.days) d.date?.day],
    );
    final picked = _selected == null ? null : days[_selected!];
    final monday = week.days.first.date;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          container: true,
          label: week.label,
          excludeSemantics: true,
          child: SizedBox(
            height: 232,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned.fill(
                  child: IgnorePointer(
                    child: LightField(
                      pools: [
                        LightPool(
                          color: colors.lamp.withValues(alpha: colors.isNight ? 0.26 : 0.2),
                          center: const Alignment(0, -0.05),
                          radius: 0.36,
                        ),
                      ],
                    ),
                  ),
                ),
                WeekDial(done: week.studyDays, goal: week.goal, size: 188, paused: paused),
                if (week.met)
                  const Align(alignment: Alignment(1, 0.95), child: ProudMobi(size: 76))
                else if (paused)
                  const Align(alignment: Alignment(1, 0.95), child: Mobi(pose: MobiPose.rest, size: 72)),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        if (monday != null)
          Text(RhythmCopy.weekRange(monday), textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s4),
        Semantics(
          liveRegion: true,
          child: Text(_status(week), textAlign: TextAlign.center, style: type.subhead),
        ),
        const SizedBox(height: MmSpace.s24),
        LitEdge(
          child: FakeGlass(
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.s12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PlanWeekStrip(
                    days: days,
                    bubble: 28,
                    showDates: true,
                    daySemantics: true,
                    animateIn: true,
                    selected: _selected,
                    onDay: (d) {
                      ref.read(hapticsProvider).tick();
                      setState(() => _selected = _selected == d.index ? null : d.index);
                    },
                  ),
                  const SizedBox(height: MmSpace.s4),
                  Padding(padding: const EdgeInsets.only(left: MmSpace.s8), child: PlanWeekKey(days: days)),
                  AnimatedSize(
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    curve: Motion.glide,
                    alignment: Alignment.topCenter,
                    child: picked == null
                        ? const SizedBox(width: double.infinity)
                        : Padding(
                            padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s12, MmSpace.s8, MmSpace.s4),
                            child: Semantics(
                              liveRegion: true,
                              child: Text(_sentence(picked), style: type.small.copyWith(color: colors.ink2)),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// "Wednesday, today, planned study day" as a sentence.
  static String _sentence(PlanDay day) {
    final text = day.describe();
    return '${text[0].toUpperCase()}${text.substring(1)}.';
  }
}

/// The run as two monumental numbers side by side on the ground. A student with no run gets one
/// plain line instead (never "0 weeks").
class _RunStats extends StatelessWidget {
  const _RunStats({required this.rhythm, required this.note});

  final Rhythm rhythm;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final streak = rhythm.weeksMetStreak;
    if (streak <= 0) {
      return Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(note ?? weeksInRhythmText(rhythm), style: type.body.copyWith(color: colors.ink)),
      );
    }
    final best = rhythm.bestRun;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: _Stat(value: '$streak', label: RhythmCopy.statWeeks(streak), semantics: weeksInRhythmText(rhythm))),
        if (best > 0) Expanded(child: _Stat(value: '$best', label: RhythmCopy.statBest, semantics: RhythmCopy.bestRun(best))),
      ],
    );
  }
}

class _Stat extends ConsumerWidget {
  const _Stat({required this.value, required this.label, required this.semantics});

  final String value;
  final String label;
  final String semantics;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: semantics,
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Rolls in after the screen has arrived and ticks once where it lands.
            MonumentalNumber(
              value: value,
              style: type.figure.copyWith(fontSize: 56, height: 54 / 56),
              delay: Motion.enterDuration,
              onLanded: () => ref.read(hapticsProvider).selection(),
            ),
            const SizedBox(height: MmSpace.s4),
            Text(label, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// A setting: its name on the left, its value and a chevron on the right, the whole row a target.
class _SettingRow extends StatelessWidget {
  const _SettingRow({required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return RowFrame(
      onTap: onTap,
      semanticsLabel: '$label. $value',
      child: Row(
        children: [
          Text(label, style: type.labelLarge.copyWith(fontSize: 16, color: onTap == null ? colors.ink3 : colors.ink)),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Text(
              value,
              style: type.small.copyWith(color: colors.ink2),
              textAlign: TextAlign.end,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
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
        const SectionTitle(RhythmCopy.pauseTitle, bottom: MmSpace.s4),
        // The date is in the week above; this says only what pausing does to the run.
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: MmSpace.s12),
          child: Text(RhythmCopy.pausedKeepsRun, style: type.small.copyWith(color: colors.ink2)),
        ),
        if (paused)
          KeyButton.secondary(label: RhythmCopy.resume, onPressed: busy ? null : onResume)
        else
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [
              PillKey(label: RhythmCopy.pauseThisWeek, semanticsLabel: '${RhythmCopy.pauseTitle}, ${RhythmCopy.pauseThisWeek}', onPressed: busy ? null : onThisWeek),
              PillKey(label: RhythmCopy.pauseTwoWeeks, semanticsLabel: '${RhythmCopy.pauseTitle}, ${RhythmCopy.pauseTwoWeeks}', onPressed: busy ? null : onTwoWeeks),
              PillKey(label: RhythmCopy.pauseUntilOn, semanticsLabel: '${RhythmCopy.pauseTitle}, ${RhythmCopy.pauseUntilOn}', onPressed: busy ? null : onUntilOn),
            ],
          ),
      ],
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
