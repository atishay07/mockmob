// C1, the "You" tab of the chains (spec 5.3): the run of days in a row, the strip of seven paper ticks,
// the rest passes, a make-up when one is open, the month calendar, the milestones, and the two links
// ("Exam pause days", "Hide my chain"). A hidden chain shows one calm line and "Show my chain".
//
// Nothing here counts down, warns or marks a missed day in red. Today undone is a plain fact on this screen
// only ("Answer 3 more questions today to count it."). Every figure is the server's.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'chain_calendar.dart';
import 'chain_paper.dart';
import 'chain_strip.dart';
import 'pause_sheet.dart';
import 'sheet_parts.dart' show KeepInView, LinkKey;

class ChainYouBody extends ConsumerStatefulWidget {
  const ChainYouBody({super.key, required this.chain});

  final ChainState chain;

  @override
  ConsumerState<ChainYouBody> createState() => _ChainYouBodyState();
}

class _ChainYouBodyState extends ConsumerState<ChainYouBody> {
  bool _busy = false;
  String? _error;

  /// The exam pause days open in place under their link (no sheet over the sheet).
  bool _pauseOpen = false;

  ChainState get c => widget.chain;

  Future<void> _hide(bool hidden) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(chainProvider.notifier).setHidden(hidden);
      if (mounted) setState(() => _busy = false);
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = MobV3Copy.error(e);
        });
      }
    }
  }

  /// The IST day key of today: the strip's last day, which the server wrote.
  String get _today => c.week.isNotEmpty ? c.week.last.day : (c.calendar.isNotEmpty ? c.calendar.last.day : '');

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (c.hidden) return _Hidden(busy: _busy, error: _error, onShow: () => _hide(false));

    final broke = c.days == 0 && (c.best > 0 || c.brokeFrom != null);
    final best = c.brokeFrom != null && c.brokeFrom! > c.best ? c.brokeFrom! : c.best;
    final line = broke ? MobV3Copy.newChain(best) : MobV3Copy.chainBreakdown(c);
    final left = (c.todayNeeded - c.todayAnswered).clamp(0, c.todayNeeded);
    final makeUp = c.makeUpDay != null;
    final showRule = makeUp || c.madeUp > 0;

    final today = DateTime.tryParse(_today);
    final monthStates = <String, ChainDayState>{
      for (final d in c.calendar) d.day: d.state == ChainDayState.today ? (c.todayDone ? ChainDayState.practised : ChainDayState.none) : d.state,
      for (final d in c.pauseDays) d: ChainDayState.paused,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The figure and what it counts.
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            MonumentalNumber(value: '${c.days}', style: type.figureHero, color: colors.ink, memoryKey: 'v3.chain.days', semanticsLabel: '${c.days} ${MobV3Copy.daysInARow(c.days)}'),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(MobV3Copy.daysInARow(c.days), style: type.title.copyWith(fontSize: 20, height: 1.15)),
                    const SizedBox(height: 2),
                    Text(line, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: MmSpace.s20),
        ChainStrip(days: c.week, todayAnswered: c.todayAnswered, todayNeeded: c.todayNeeded, todayDone: c.todayDone),
        if (!c.todayDone && c.week.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          Text(MobV3Copy.answerMore(left), style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        _PassesCard(held: c.passesHeld, max: c.passesMax),
        if (makeUp) ...[
          const SizedBox(height: MmSpace.s12),
          _MakeUpCard(day: c.makeUpDay!, needed: c.makeUpNeeded, answered: c.makeUpAnsweredToday),
        ],
        if (showRule) ...[
          const SizedBox(height: MmSpace.s8),
          Text(MobV3Copy.makeUpOnce, style: type.small.copyWith(color: colors.ink3)),
        ],
        const SizedBox(height: MmSpace.s32),
        if (today != null) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(MobTime.monthName(today.month), style: type.cardTitle),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(MobV3Copy.calendarCaption, textAlign: TextAlign.end, style: type.small.copyWith(color: colors.ink2))),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          ChainCalendar(year: today.year, month: today.month, states: monthStates, today: _today),
          const SizedBox(height: MmSpace.s24),
        ],
        _Milestones(milestones: c.milestones),
        const SizedBox(height: MmSpace.s24),
        Row(
          children: [
            Expanded(child: LinkKey(label: MobV3Copy.examPause, icon: LucideIcons.pause, onPressed: () => setState(() => _pauseOpen = !_pauseOpen))),
            const SizedBox(width: MmSpace.s12),
            Flexible(child: LinkKey(label: MobV3Copy.hideChain, icon: LucideIcons.eyeOff, alignment: Alignment.centerRight, onPressed: _busy ? null : () => _hide(true))),
          ],
        ),
        KeepInView(
          open: _pauseOpen,
          child: MmSizeEase(
            duration: Motion.reduced(context) ? Duration.zero : Motion.card,
            curve: Motion.glide,
            alignment: Alignment.topCenter,
            child: _pauseOpen ? const Padding(padding: EdgeInsets.only(top: MmSpace.s12), child: PauseInline(key: ValueKey('chain-pause-inline'))) : const SizedBox(width: double.infinity),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(_error!, style: type.small.copyWith(color: colors.ink2)),
        ],
      ],
    );
  }
}

class _Hidden extends StatelessWidget {
  const _Hidden({required this.busy, required this.error, required this.onShow});

  final bool busy;
  final String? error;
  final VoidCallback onShow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.s32),
        Center(
          child: Container(
            width: 72,
            height: 88,
            decoration: BoxDecoration(color: ChainPaper.fill(context), borderRadius: BorderRadius.circular(16), border: Border.all(color: ChainPaper.edge(context))),
            child: const Icon(LucideIcons.eyeOff, size: 30, color: ChainPaper.ink),
          ),
        ),
        const SizedBox(height: MmSpace.s24),
        Text(MobV3Copy.hiddenLine, textAlign: TextAlign.center, style: type.lead.copyWith(color: colors.ink)),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: MobV3Copy.showChain, loading: busy, onPressed: onShow),
        if (error != null) ...[
          const SizedBox(height: MmSpace.s12),
          Text(error!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
        ],
      ],
    );
  }
}

class _PassesCard extends StatelessWidget {
  const _PassesCard({required this.held, required this.max});

  final int held;
  final int max;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmSurface.plain(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < max.clamp(1, 3); i++) ...[
                if (i > 0) const SizedBox(width: MmSpace.s6),
                _PassChip(held: i < held),
              ],
            ],
          ),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(MobV3Copy.passesHeld(held, max), style: type.cardTitle),
                const SizedBox(height: 4),
                Text(MobV3Copy.passesRule, style: type.small.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A rest pass: a small paper card with a moon, cream when held and a dashed outline when not.
class _PassChip extends StatelessWidget {
  const _PassChip({required this.held});

  final bool held;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox(
      width: 30,
      height: 40,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: held ? ChainPaper.fill(context) : null,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: held ? ChainPaper.edge(context) : colors.ink4, width: held ? 1 : 1.5),
        ),
        child: Icon(LucideIcons.moon, size: 16, color: held ? ChainPaper.ink : colors.ink3),
      ),
    );
  }
}

class _MakeUpCard extends StatelessWidget {
  const _MakeUpCard({required this.day, required this.needed, required this.answered});

  final String day;
  final int needed;
  final int answered;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final weekday = MobTime.weekdayOfKey(day);
    return MmSurface.plain(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 44,
            decoration: BoxDecoration(color: ChainPaper.fill(context), borderRadius: BorderRadius.circular(10), border: Border.all(color: ChainPaper.edge(context))),
            child: const Icon(LucideIcons.pencilLine, size: 18, color: ChainPaper.ink),
          ),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(MobV3Copy.makeUpOpen(weekday, needed), style: type.small.copyWith(color: colors.ink)),
                const SizedBox(height: 6),
                Text(MobV3Copy.makeUpProgress(answered, needed), style: type.small.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The milestones, one row each: a paper disc with the day number, what it gives, and "Done" or
/// how many days are left. Only the next one carries a number of days; the rest wait quietly.
class _Milestones extends StatelessWidget {
  const _Milestones({required this.milestones});

  final List<ChainMilestone> milestones;

  @override
  Widget build(BuildContext context) {
    if (milestones.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final done = [for (final m in milestones) if (m.done) m];
    final todo = [for (final m in milestones) if (!m.done) m];
    // What has been earned (the last one or two), the next, and two more to look forward to.
    final shown = <ChainMilestone>[
      ...done.reversed.take(2).toList().reversed,
      ...todo.take(3),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < shown.length; i++)
          _MilestoneRow(
            m: shown[i],
            next: !shown[i].done && shown[i] == todo.first,
            first: i == 0,
            last: i == shown.length - 1,
            colors: colors,
            type: type,
          ),
      ],
    );
  }
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow({required this.m, required this.next, required this.first, required this.last, required this.colors, required this.type});

  final ChainMilestone m;
  final bool next;
  final bool first;
  final bool last;
  final MmColors colors;
  final MmType type;

  @override
  Widget build(BuildContext context) {
    final done = m.done;
    final disc = Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done ? ChainPaper.fill(context) : null,
        border: done ? Border.all(color: ChainPaper.edge(context)) : Border.all(color: next ? colors.ink2 : colors.ink4, width: next ? 2 : 1.5),
      ),
      child: Text('${m.at}', style: type.figureCompact.copyWith(fontSize: 18, height: 1, color: done ? ChainPaper.ink : (next ? colors.ink : colors.ink3))),
    );
    final left = m.left;
    return Semantics(
      container: true,
      label: '${MobV3Copy.milestone(m)}, ${done ? MobV3Copy.doneWord : (left != null ? MobV3Copy.moreDays(left) : '')}',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              disc,
              const SizedBox(width: MmSpace.s16),
              Expanded(child: Text(MobV3Copy.milestone(m), style: type.labelLarge.copyWith(color: done || next ? colors.ink : colors.ink2))),
              if (done) Icon(LucideIcons.check, size: 20, color: colors.ink2) else if (next && left != null) Text(MobV3Copy.moreDays(left), style: type.label.copyWith(color: colors.ink)),
            ],
          ),
        ),
      ),
    );
  }
}
