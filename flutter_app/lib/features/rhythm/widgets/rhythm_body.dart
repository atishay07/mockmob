// The content of the You rhythm screen (spec 5.11): this week as the lit hero (the count as a
// monumental number over seven answer bubbles), the run, the goal, pause, closed weeks, the
// Celebrations setting, and the quiet Turn off rhythm. Stateless: the screen passes the state and
// the callbacks, and goldens render it directly.
//
// One dominant volt key per state: Resume rhythm while paused (right under the status line), Turn
// on rhythm while off (the plan and the pause are hidden then). Everything sits on the 16 dp page
// gutter; the sections under the week are typeset (32 dp, a hairline, 16 dp, the heading) and the
// lists are plain cards with one row padding (SPACING.md 3.1 and 4.3).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show SectionTitle;
import '../../you/widgets/you_row.dart' show RowFrame;
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../data/rhythm_providers.dart';
import '../logic/week_mobi.dart';
import '../logic/week_outlook.dart';
import '../logic/week_view.dart';
import 'rhythm_layout.dart';
import 'rhythm_page.dart';
import '../logic/plan_week.dart';
import 'plan_week_strip.dart';
import 'week_mobi_slot.dart';
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
    final paused = week.status == WeekStatus.paused;
    // While rhythm is off the one thing to do is turn it on: the plan and the pause are hidden, and
    // the run shows only when there is a record behind it.
    final showRun = !rhythmOff || rhythm.weeksMetStreak > 0 || rhythm.bestRun > 0;

    // One authored entrance as the page arrives (route driver): this week first, then the run,
    // the plan, the pause and the celebrations in reading order. Nothing moves once it is up.
    return MmStagger(
        driver: MmStaggerDriver.route,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (snapshot.stale && snapshot.fetchedAt != null) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s8),
                child: Text(RhythmCopy.asOf(snapshot.fetchedAt!), style: type.caption.copyWith(color: colors.ink3)),
              ),
            ],
            if (errorText != null) ...[
              InlineBanner(message: errorText!, tone: BannerTone.error),
              const SizedBox(height: MmRhythm.item),
            ],
            if (savedText != null) ...[
              ReceiptLine(text: savedText!),
              const SizedBox(height: MmRhythm.item),
            ],
            MmStaggerItem(
              index: 0,
              child: rhythmOff
                  ? _OffBlock(onTurnOn: onTurnOn)
                  : WeekHero(
                      week: week,
                      plan: plan,
                      onResume: busy ? null : onResume,
                      busy: busy,
                      stale: snapshot.stale,
                      returning: rhythm.returning,
                    ),
            ),
            // The run: two numbers, then every week the server sent as a ribbon of capsules. Without
            // a run there is one plain line (never a zero).
            if (showRun) ...[
              const SectionBreak(),
              MmStaggerItem(
                index: 1,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Title(RhythmCopy.runTitle),
                    _RunStats(rhythm: rhythm, note: note),
                    if (ribbon.isNotEmpty) ...[
                      const SizedBox(height: MmSpace.s16),
                      RunRibbon(weeks: ribbon),
                    ],
                  ],
                ),
              ),
            ],
            if (!rhythmOff) ...[
              const SectionBreak(),
              MmStaggerItem(
                index: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Title(RhythmCopy.planTitle),
                    _InsetPanel(
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
              // A paused week already has its one key (Resume, under the ring), so the pause options
              // wait until the week is running again: they fold away, and unfold on resume, as the
              // ring changes (a calm change of state, never a jump).
              MmStaggerItem(
                index: 3,
                child: _Reveal(
                  show: !paused,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SectionBreak(),
                      _PauseGroup(
                        week: week,
                        busy: busy,
                        onThisWeek: onPauseThisWeek,
                        onTwoWeeks: onPauseTwoWeeks,
                        onUntilOn: onPauseUntilOn,
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SectionBreak(),
            MmStaggerItem(
              index: 4,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _Title(RhythmCopy.celebrationsTitle),
                  CelebrationsPicker(mode: mode, onMode: onMode),
                  if (!rhythmOff) ...[
                    const SizedBox(height: MmRhythm.group),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: IntrinsicWidth(child: QuietPill(label: RhythmCopy.turnOff, danger: true, onPressed: busy ? null : onTurnOff)),
                    ),
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
/// screen opens, and each day answers a tap with a light tick and its name in words.
///
/// Mobi stands in one fixed slot beside the ring and reacts to what the week is (`mobiForWeek`):
/// proud when it is met, resting while it is paused, asleep late at night, nudging when one day is
/// left and today is planned, encouraging when the goal is out of reach. A day counted while the
/// screen is open answers in the ring itself (only the new segment inks, with a lamp pulse), in
/// the number (it rolls one step) and in Mobi (one small hop for 1.2 s). Nothing of that plays on
/// first load, on a stale cache or under reduced motion. A paused week carries the screen's one
/// volt key, Resume rhythm, right under its status line.
class WeekHero extends ConsumerStatefulWidget {
  const WeekHero({super.key, required this.week, this.plan, this.onResume, this.busy = false, this.stale = false, this.returning = false});

  final WeekView week;
  final Set<int>? plan;

  /// The Resume rhythm key shown under the status line while the week is paused. Null hides it.
  final VoidCallback? onResume;

  /// A write is in flight: the Resume key waits.
  final bool busy;

  /// The week comes from an old cache: no live reaction is played for a change of it.
  final bool stale;

  /// The server says the student has been away for 3 or more days: Mobi greets once a day.
  final bool returning;

  @override
  ConsumerState<WeekHero> createState() => _WeekHeroState();
}

class _WeekHeroState extends ConsumerState<WeekHero> {
  int? _selected;

  /// Goes up each time a day is counted on the open screen (Mobi's small hop).
  int _reaction = 0;

  /// The closing light runs only in the build that follows the counted day that met the goal.
  bool _sweep = false;

  /// The last change of the week happened while this screen was open on a fresh week; the ring
  /// inks the new day only then, and the number ticks only then (or on its first roll).
  bool _live = true;
  bool _tick = true;
  Duration _proudDelay = Duration.zero;

  /// Mobi's greeting for a returning student is spent once a day, when this screen first stands.
  late final bool _greet = widget.returning && MobiRation.helloToday('rhythm-week');

  WeekMobi _mobi = WeekMobi.none;
  String? _line;
  Timer? _hello;

  String _status(WeekView week) => switch (week.status) {
        WeekStatus.open => RhythmCopy.toGo((week.goal - week.studyDays).clamp(1, 7)),
        WeekStatus.met => RhythmCopy.weekDoneSentence,
        WeekStatus.extra || WeekStatus.paused => week.label,
      };

  WeekOutlook? _outlook(WeekView week) {
    final todayIndex = week.days.indexWhere((d) => d.isToday);
    return weekOutlook(
      studied: [for (final d in week.days) d.studyDay],
      todayIndex: todayIndex < 0 ? null : todayIndex,
      goal: week.goal,
      paused: week.status == WeekStatus.paused,
      planned: widget.plan,
    );
  }

  /// Picks who stands beside the ring. His line is said once per kind per run (a paused week's
  /// line is the state itself, so it always shows).
  void _syncMobi({bool resumed = false}) {
    final week = widget.week;
    var next = mobiForWeek(week, _outlook(week), MobiRation.now(), returning: _greet);
    if (resumed && next.kind == WeekMobiKind.none) {
      // Resume reverses the pause: he waves hello, and goes when the moment has passed.
      next = const WeekMobi(WeekMobiKind.hello, MobiAct.hello, line: RhythmCopy.mobiResumed);
      _hello?.cancel();
      _hello = Timer(const Duration(seconds: 4), () {
        if (!mounted) return;
        setState(_syncMobi);
      });
    }
    if (next.kind != _mobi.kind) {
      _line = null;
      final line = next.line;
      if (line != null && (next.lineIsState || resumed || MobiRation.speakOnce('rhythm-week:${next.kind.name}'))) _line = line;
    }
    _mobi = next;
  }

  @override
  void initState() {
    super.initState();
    _syncMobi();
  }

  @override
  void didUpdateWidget(WeekHero old) {
    super.didUpdateWidget(old);
    final was = old.week;
    final now = widget.week;
    _sweep = false;
    final sameWeek = was.days.first.date == now.days.first.date;
    final live = sameWeek && !widget.stale && !old.stale && !Motion.reduced(context);
    _live = live;
    if (was.studyDays != now.studyDays) _tick = live;
    final paused = now.status == WeekStatus.paused;
    final counted = live && !paused && was.status != WeekStatus.paused && was.goal == now.goal && now.studyDays > was.studyDays;
    if (counted) {
      _reaction++;
      if (now.met && !was.met) {
        // The segment that meets the goal hands over to the closing sweep and a proud Mobi, who
        // waits for the ring to finish.
        _sweep = true;
        _proudDelay = WeekDial.settleAfter(done: now.studyDays, goal: now.goal, sweep: true, from: was.studyDays);
      }
    }
    final resumed = sameWeek && was.status == WeekStatus.paused && !paused;
    if (widget.plan != old.plan || was != now || widget.returning != old.returning || resumed) {
      _syncMobi(resumed: resumed && !Motion.reduced(context));
    }
  }

  @override
  void dispose() {
    _hello?.cancel();
    super.dispose();
  }

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
    final line = _line;
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
                // The lead number of the screen: it ticks once where it lands. An ordinary open
                // draws a met ring closed; the closing sweep belongs to the moment it is met.
                WeekDial(
                  done: week.studyDays,
                  goal: week.goal,
                  size: 188,
                  paused: paused,
                  sweep: _sweep,
                  live: _live,
                  onLanded: () {
                    if (_tick) ref.read(hapticsProvider).selection();
                  },
                ),
                // Mobi's one place: the same 76 dp box for every standing, so nothing moves when
                // he arrives. A proud Mobi cheers once the ring has inked in, never before.
                Align(
                  alignment: const Alignment(1, 0.95),
                  child: WeekMobiSlot(
                    mobi: _mobi,
                    reaction: _reaction,
                    proudDelay: _proudDelay > Duration.zero ? _proudDelay : WeekDial.settleAfter(done: week.studyDays, goal: week.goal),
                    onWake: () => setState(() => _line = RhythmCopy.mobiSleep),
                  ),
                ),
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
        // Mobi's one line, in its own slot under the status: it fades in and out, and the card
        // grows to hold it instead of covering anything.
        _GrowIn(
          child: AnimatedSwitcher(
            duration: Motion.of(context, const Duration(milliseconds: 300)),
            child: line == null
                ? const SizedBox(key: ValueKey('no-line'), width: double.infinity)
                : Padding(
                    key: ValueKey(line),
                    padding: const EdgeInsets.only(top: MmSpace.s4),
                    child: Semantics(
                      liveRegion: true,
                      child: Text(line, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
                    ),
                  ),
          ),
        ),
        // The one dominant action of a paused screen; it unfolds as the pause lands and folds
        // away as the run resumes.
        _Reveal(
          show: paused && (widget.onResume != null || widget.busy),
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: KeyButton(label: RhythmCopy.resume, onPressed: widget.busy ? null : widget.onResume),
          ),
        ),
        const SizedBox(height: MmSpace.s24),
        LitEdge(
          child: FakeGlass(
            child: Padding(
              // The day columns want every dp of width (a 48 dp target each), so the card's side
              // padding is 8; the legend below is inset 8 more, onto the card's 16 dp text edge.
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s12),
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
                    onDay: (d) => setState(() => _selected = _selected == d.index ? null : d.index),
                  ),
                  const SizedBox(height: MmSpace.s4),
                  // One slot for the legend and for the chosen day in words: a tap swaps them with
                  // a 160 ms cross-fade and the card never changes height, so nothing below it
                  // moves (MOTION.md 10).
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: MmSpace.s20),
                    child: AnimatedSwitcher(
                      duration: Motion.of(context, const Duration(milliseconds: 160)),
                      layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
                      child: picked == null
                          ? Padding(
                              key: const ValueKey('legend'),
                              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                              child: Align(alignment: Alignment.centerLeft, child: PlanWeekKey(days: days)),
                            )
                          : Padding(
                              key: ValueKey('day-${picked.index}'),
                              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                              child: Semantics(
                                liveRegion: true,
                                child: Text(_sentence(picked), style: type.small.copyWith(color: colors.ink2)),
                              ),
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

/// Shows [child], or nothing: it fades out and then folds its space away (and, coming back,
/// unfolds while it fades in), so pausing and resuming change the page calmly instead of making it
/// jump. Under reduced motion the change is at once.
class _Reveal extends StatelessWidget {
  const _Reveal({required this.show, required this.child});

  final bool show;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final duration = Motion.of(context, const Duration(milliseconds: 280));
    return MmSizeEase(
      duration: duration,
      curve: Motion.emphasized,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: duration,
        layoutBuilder: (current, previous) => Stack(
          fit: StackFit.passthrough,
          alignment: Alignment.topCenter,
          children: [...previous, ?current],
        ),
        child: show ? KeyedSubtree(key: const ValueKey('shown'), child: child) : const SizedBox(key: ValueKey('hidden'), width: double.infinity),
      ),
    );
  }
}

/// Lets the card grow to hold Mobi's line (200 ms) instead of jumping; under reduced motion it is
/// the child alone (an animated size with no time to run mutates its own layout).
class _GrowIn extends StatelessWidget {
  const _GrowIn({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return AnimatedSize(duration: const Duration(milliseconds: 200), curve: Motion.emphasized, alignment: Alignment.topCenter, child: child);
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
      return Text(note ?? weeksInRhythmText(rhythm), style: type.body.copyWith(color: colors.ink));
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

/// One of the run's two secondary figures: 40 sp, with its label 4 dp under the figure's box (the
/// box is the ink plus about 2 dp, so the two read as one pair). The screen's lead number is the
/// ring, so these roll in without a tick.
class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.semantics});

  final String value;
  final String label;
  final String semantics;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: semantics,
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Rolls in after the screen has arrived, inside the 800 ms entrance.
          MonumentalNumber(value: value, style: type.figureCompact, delay: kNumberRollDelay),
          const SizedBox(height: MmSpace.s4),
          Text(label, style: type.caption.copyWith(color: colors.ink2)),
        ],
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

/// Rhythm turned off: a heading, one plain line and the one volt key, on the page itself (no card
/// round it). Everything else on the screen waits behind this.
class _OffBlock extends StatelessWidget {
  const _OffBlock({required this.onTurnOn});

  final VoidCallback onTurnOn;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(RhythmCopy.rhythmOffTitle, style: type.headline)),
          const SizedBox(height: MmSpace.s8),
          Text(RhythmCopy.rhythmOffBody, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: RhythmCopy.turnOnRhythm, onPressed: onTurnOn),
        ],
      ),
    );
  }
}

/// A section title on the screen gutter (the body already insets, so no extra left).
class _Title extends StatelessWidget {
  const _Title(this.text, {this.bottom = MmSpace.s12});

  final String text;
  final double bottom;

  @override
  Widget build(BuildContext context) => SectionTitle(text, padding: EdgeInsets.only(bottom: bottom));
}

/// Rows on one raised surface with hairlines inset on both sides, so a divider never runs into the
/// card's edge. Never nest a panel in a panel.
class _InsetPanel extends StatelessWidget {
  const _InsetPanel({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        rows.add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: SizedBox(height: 1, child: ColoredBox(color: colors.line)),
        ));
      }
      rows.add(children[i]);
    }
    return MmSurface.plain(
      padding: EdgeInsets.zero,
      child: MmClip(
        borderRadius: BorderRadius.circular(MmRhythm.plainRadius),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
      ),
    );
  }
}

/// Pause: three chips in one segmented control (a thumb glides to the chosen one), the day the run
/// comes back in words under it, and one key that does it. Nothing is written until the key, and
/// the week changes only after the server has acknowledged it.
class _PauseGroup extends StatefulWidget {
  const _PauseGroup({required this.week, required this.busy, required this.onThisWeek, required this.onTwoWeeks, required this.onUntilOn});

  final WeekView week;
  final bool busy;
  final VoidCallback onThisWeek;
  final VoidCallback onTwoWeeks;
  final VoidCallback onUntilOn;

  @override
  State<_PauseGroup> createState() => _PauseGroupState();
}

class _PauseGroupState extends State<_PauseGroup> {
  PauseOption _option = PauseOption.thisWeek;

  static String _label(PauseOption o) => switch (o) {
        PauseOption.thisWeek => RhythmCopy.pauseThisWeek,
        PauseOption.twoWeeks => RhythmCopy.pauseTwoWeeks,
        PauseOption.threeMonths => RhythmCopy.pauseThreeMonths,
      };

  void _pause() => switch (_option) {
        PauseOption.thisWeek => widget.onThisWeek(),
        PauseOption.twoWeeks => widget.onTwoWeeks(),
        PauseOption.threeMonths => widget.onUntilOn(),
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final back = pauseBackOn(_option, widget.week);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Title(RhythmCopy.pauseTitle, bottom: MmSpace.s4),
        // The date is in the week above; this says only what pausing does to the run.
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s12),
          child: Text(RhythmCopy.pausedKeepsRun, style: type.small.copyWith(color: colors.ink2)),
        ),
        MmSegmented<PauseOption>(
          semanticsLabel: RhythmCopy.pauseTitle,
          segments: [for (final o in PauseOption.values) MmSegment(o, _label(o))],
          value: _option,
          onChanged: widget.busy ? null : (o) => setState(() => _option = o),
        ),
        // One slot for the date, so a change of chip never moves the key: the new date cross-fades
        // in over the old one.
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s8),
          child: SizedBox(
            height: MmSpace.s20,
            child: AnimatedSwitcher(
              duration: Motion.of(context, const Duration(milliseconds: 160)),
              layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
              child: back == null
                  ? const SizedBox.shrink(key: ValueKey('no-date'))
                  : Align(
                      key: ValueKey(back),
                      alignment: Alignment.centerLeft,
                      child: Semantics(
                        liveRegion: true,
                        child: Text(RhythmCopy.backOn(formatDayMonthShort(back)), style: type.caption.copyWith(color: colors.ink2)),
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        KeyButton.secondary(label: RhythmCopy.pauseKey, onPressed: widget.busy ? null : _pause),
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
          padding: const EdgeInsets.only(top: MmSpace.s8),
          child: Text(hint(mode), style: context.mmType.caption.copyWith(color: context.mmColors.ink2)),
        ),
      ],
    );
  }
}
