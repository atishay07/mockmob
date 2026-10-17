// "This week" on Today (TODAY-1017 4.3): the week as seven marks on the ground, the figure
// "3 of 4 study days" and one line that ties the week to tonight ("Tonight makes 4."). No card:
// the row sits in the glance group under the move, and the whole row opens the week. Before the
// rhythm is read the row keeps its height with skeleton marks; a failed first read says so in the
// same space (L03). On the week's close the row shows last week ("Last week: 4 of 4.").
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/logic/plan_week.dart' show PlanDay, PlanDayMark;
import '../copy.dart';
import '../copy_glance.dart';
import '../data/week_cheers.dart';
import '../logic/today_model.dart';
import 'today_type.dart';

/// Weeks whose goal-met cheer already played in this run: Mobi cheers once per week (4.6). The
/// account's record of it is kept on the phone ([weekCheersProvider]), so a restart never replays it.
final Set<String> _cheered = {};

class TodayWeekRow extends ConsumerStatefulWidget {
  const TodayWeekRow({
    super.key,
    this.week,
    this.loading = false,
    this.failed = false,
    this.onTap,
    this.onRetry,
    this.onSetDays,
    this.lastWeek,
    this.allowMobi = true,
    this.readouts,
    this.upNext,
  });

  final WeekModel? week;
  final bool loading;
  final bool failed;

  /// The heading and the caption open the week (Progress).
  final VoidCallback? onTap;
  final VoidCallback? onRetry;

  /// No goal yet: the Set days token opens the study-days sheet.
  final VoidCallback? onSetDays;

  /// The week that just closed (Sunday night and Monday): (done, goal). The row says it and opens
  /// the week's ending.
  final (int, int)? lastWeek;

  /// Another Mobi is already in view (the move card's): the goal-met cheer waits.
  final bool allowMobi;

  /// What each day says when tapped (TODAY-1018 6.3); without them the days are not tappable.
  final List<DayReadout>? readouts;

  /// Today's readout line from the card on screen ("Up next: repair your last paper, about 12
  /// minutes."), so a swap in the card updates it live; null says the move has not loaded.
  final String? upNext;

  /// The marks' side.
  static const double mark = 30;

  @override
  ConsumerState<TodayWeekRow> createState() => _TodayWeekRowState();
}

class _TodayWeekRowState extends ConsumerState<TodayWeekRow> {
  /// The selected day (0 = Monday), or null for today.
  int? _selected;

  int? get _today {
    final w = widget.week;
    if (w == null) return null;
    final i = w.days.indexWhere((d) => d.isToday);
    return i < 0 ? null : i;
  }

  void _select(int day) {
    if (_selected == day) return;
    HapticFeedback.selectionClick();
    setState(() => _selected = day);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final w = widget.week;
    final figure = w == null
        ? null
        : Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisSize: MainAxisSize.min,
            children: [
              MmCountUp(
                value: w.done,
                fromZeroOnFirstBuild: false,
                style: type.figureCompact.copyWith(fontSize: 30, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              if (w.goal != null) ...[
                const SizedBox(width: MmSpace.s4),
                Text(TodayCopy.ofDenominator(w.goal!), style: type.title.copyWith(fontSize: 19, color: colors.ink2)),
              ],
              const SizedBox(width: MmSpace.s6),
              Text(TodayCopy.weekStudyDays, style: type.caption.copyWith(fontSize: 14, color: colors.ink2)),
            ],
          );
    final heading = MmPressable(
      onTap: widget.onTap,
      semanticsLabel: w == null ? TodayCopy.weekTitle : '${TodayCopy.weekTitle}. ${TodayCopy.weekFigureSemantics(w.done, w.goal)}.',
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(child: Semantics(header: true, child: Text(TodayCopy.weekTitle, style: type.title.copyWith(fontSize: 19)))),
            ?figure,
          ],
        ),
      ),
    );
    final Widget body;
    if (w == null) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s8),
          const _Days(days: null, before: {}),
          const SizedBox(height: MmSpace.s8),
          SizedBox(
            height: 40,
            child: widget.failed
                ? Row(
                    children: [
                      Expanded(child: Text(TodayCopy.weekNotRead, style: type.caption.copyWith(fontSize: 14, color: colors.ink))),
                      if (widget.onRetry != null) KeyButton.quiet(label: TodayCopy.tryAgain, onPressed: widget.onRetry),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      );
    } else {
      final last = widget.lastWeek;
      final caption = last != null ? '${TodayCopy.lastWeek(last.$1, last.$2)} ${TodayCopy.seeYourWeek}' : w.caption;
      final key = last != null ? TodayCopy.seeYourWeek : w.captionKey;
      final seen = ref.watch(weekCheersProvider);
      final cheer = w.met && widget.allowMobi && w.weekId != null && seen != null && !seen.contains(w.weekId) && !_cheered.contains(w.weekId);
      if (cheer) {
        _cheered.add(w.weekId!);
        final id = w.weekId!;
        final cheers = ref.read(weekCheersProvider.notifier);
        scheduleMicrotask(() => unawaited(cheers.mark(id)));
      }
      final readouts = widget.readouts;
      final selected = _selected ?? _today;
      final readout = readouts == null || selected == null || selected >= readouts.length ? null : readouts[selected];
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s8),
          _Days(
            days: w.days,
            before: w.beforeAccount,
            selected: readouts == null ? null : selected,
            onDay: readouts == null ? null : _select,
          ),
          if (readout != null) ...[
            const SizedBox(height: MmSpace.s12),
            // A day with more lines eases the page to its height instead of jumping it.
            MmSizeEase(
              duration: Motion.ui,
              curve: Motion.out,
              alignment: Alignment.topCenter,
              clipBehavior: Clip.none,
              child: _Readout(readout: readout, upNext: widget.upNext),
            ),
          ],
          const SizedBox(height: MmSpace.s12),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s4),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (cheer || (w.met && _cheeredNow.contains(w.weekId))) ...[
                  _Cheer(weekId: w.weekId!),
                  const SizedBox(width: MmSpace.s8),
                ],
                Expanded(
                  child: MmPressable(
                    onTap: widget.onTap,
                    semanticsLabel: caption,
                    focusRadius: MmRadius.smallAll,
                    pressedScale: 0.99,
                    builder: (context, pressed, _) => ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 40),
                      child: Align(alignment: Alignment.centerLeft, child: _Caption(text: caption, keyClause: key)),
                    ),
                  ),
                ),
                if (w.goal == null && widget.onSetDays != null) _SetDays(onTap: widget.onSetDays!),
              ],
            ),
          ),
        ],
      );
      if (cheer) _cheeredNow.add(w.weekId!);
    }
    return Semantics(
      container: true,
      label: w == null ? null : TodayCopy.weekSemantics(TodayCopy.weekFigureSemantics(w.done, w.goal), _markWords(w), w.caption),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [heading, body],
      ),
    );
  }

  static String _markWords(WeekModel w) => [
        for (final d in w.days)
          '${TodayCopy.weekdayShort[d.index]} ${w.beforeAccount.contains(d.index) ? TodayCopy.markBefore : switch (d.mark) {
              PlanDayMark.done => TodayCopy.markCounted,
              PlanDayMark.planned => TodayCopy.markPlanned,
              PlanDayMark.rest => TodayCopy.markRest,
              PlanDayMark.open => TodayCopy.markOpen,
            }}',
      ].join(', ');
}

/// Weeks whose cheer is showing on this visit (so a rebuild keeps him in place until the row goes).
final Set<String?> _cheeredNow = {};

/// The seven days as buttons: the mark over its weekday, and one indicator that slides between
/// days (240 ms, in-out) instead of seven boxes switching (TODAY-1018 6.3).
class _Days extends StatelessWidget {
  const _Days({required this.days, required this.before, this.selected, this.onDay});

  final List<PlanDay>? days;
  final Set<int> before;
  final int? selected;
  final ValueChanged<int>? onDay;

  /// A column's height: the mark, its gap and the weekday.
  static const double height = 76;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final h = height + (scaler.scale(12) - 12) * 1.4;
    final sel = selected;
    return SizedBox(
      height: h,
      child: Stack(
        children: [
          if (sel != null)
            AnimatedAlign(
              alignment: Alignment(-1 + 2 * sel / 6, 0),
              duration: Motion.of(context, const Duration(milliseconds: 240)),
              curve: const Cubic(0.77, 0, 0.175, 1),
              child: FractionallySizedBox(
                widthFactor: 1 / 7,
                heightFactor: 1,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.isNight ? colors.raised2 : colors.raised2.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ),
          Row(
            children: [
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: _DayButton(
                    label: days != null && days![i].isToday ? GlanceCopy.todayWord : TodayCopy.weekdayShort[i],
                    semantics: days == null ? TodayCopy.weekdayShort[i] : GlanceCopy.daySemantics(days![i].describe(), sel == i),
                    strong: days != null && (days![i].isToday || sel == i),
                    selected: sel == i,
                    onTap: onDay == null ? null : () => onDay!(i),
                    letter: type.micro.copyWith(fontSize: 12, fontWeight: FontWeight.w600),
                    scaler: scaler,
                    colors: colors,
                    mark: days == null ? const Skeleton.circle(size: TodayWeekRow.mark) : _Mark(day: days![i], before: before.contains(i), order: i),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DayButton extends StatelessWidget {
  const _DayButton({
    required this.label,
    required this.semantics,
    required this.strong,
    required this.selected,
    required this.onTap,
    required this.letter,
    required this.scaler,
    required this.colors,
    required this.mark,
  });

  final String label;
  final String semantics;
  final bool strong;
  final bool selected;
  final VoidCallback? onTap;
  final TextStyle letter;
  final TextScaler scaler;
  final MmColors colors;
  final Widget mark;

  @override
  Widget build(BuildContext context) {
    final column = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox.square(dimension: TodayWeekRow.mark + 8, child: Center(child: mark)),
        const SizedBox(height: MmSpace.s6),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.visible,
          softWrap: false,
          textScaler: scaler,
          style: letter.copyWith(color: strong ? colors.ink : colors.ink3, fontWeight: strong ? FontWeight.w700 : FontWeight.w600),
        ),
      ],
    );
    if (onTap == null) return column;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semantics,
      selected: selected,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.96,
      builder: (context, pressed, _) => column,
    );
  }
}

/// The selected day in words, swapped with a 4 dp rise (220 ms).
class _Readout extends StatelessWidget {
  const _Readout({required this.readout, this.upNext});

  final DayReadout readout;
  final String? upNext;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final lines = [
      ...readout.lines,
      if (readout.isToday) upNext ?? GlanceCopy.moveNotLoaded,
    ];
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Duration.zero : const Duration(milliseconds: 220),
      switchInCurve: const Cubic(0.23, 1, 0.32, 1),
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero).animate(animation), child: child),
      ),
      child: Semantics(
        key: ValueKey('${readout.title}|${lines.join('|')}'),
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(readout.title, style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: colors.ink)),
            for (final l in lines) ...[
              const SizedBox(height: MmSpace.s2),
              Text(l, style: type.caption.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2)),
            ],
          ],
        ),
      ),
    );
  }
}

/// One day (TODAY-1018 3): counted is a volt disc with an ink tick (volt marks counted days);
/// planned is an ink ring; planned but passed is a dashed ring; a rest day is a dot; a day before
/// the account is a short dash. Today's ring is ink, 2 dp.
class _Mark extends StatelessWidget {
  const _Mark({required this.day, required this.before, this.order = 0});

  final PlanDay day;
  final bool before;

  /// The day's place in the week: the counted days pop in this order (30 ms apart).
  final int order;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    const size = TodayWeekRow.mark;
    if (before) {
      return SizedBox.square(
        dimension: size,
        child: Center(child: Container(width: 10, height: 2, decoration: BoxDecoration(color: colors.ink3, borderRadius: BorderRadius.circular(1)))),
      );
    }
    switch (day.mark) {
      case PlanDayMark.done:
        return _CountedPop(
          order: order,
          disc: Container(width: size, height: size, decoration: BoxDecoration(color: colors.markFill, shape: BoxShape.circle)),
          tick: Icon(LucideIcons.check, size: 16, color: colors.voltInk),
        );
      case PlanDayMark.rest:
        return SizedBox.square(
          dimension: size,
          child: Center(child: Container(width: 4, height: 4, decoration: BoxDecoration(color: colors.ink3, shape: BoxShape.circle))),
        );
      case PlanDayMark.planned:
      case PlanDayMark.open:
        final passed = day.mark == PlanDayMark.open && day.isPast;
        return CustomPaint(
          size: const Size.square(size),
          painter: _RingPainter(
            color: day.isToday ? colors.ink : (passed ? colors.ink3 : (day.mark == PlanDayMark.planned ? colors.ink2 : colors.line)),
            dashed: passed,
            width: day.isToday ? 2 : 1.5,
          ),
        );
    }
  }
}

/// A counted day lands once, as part of the page's one load moment (TODAY-1018 6): its disc pops
/// from 0.6 to full size (220 ms, 30 ms after the day before it), then its tick draws from the
/// left (160 ms). It plays once per mark, never on a refresh; reduced motion shows it at rest.
class _CountedPop extends StatefulWidget {
  const _CountedPop({required this.order, required this.disc, required this.tick});

  final int order;
  final Widget disc;
  final Widget tick;

  @override
  State<_CountedPop> createState() => _CountedPopState();
}

class _CountedPopState extends State<_CountedPop> with SingleTickerProviderStateMixin {
  static const Duration _pop = Duration(milliseconds: 220);
  static const Duration _draw = Duration(milliseconds: 160);

  late final AnimationController _c = AnimationController(vsync: this, duration: _pop + _draw);
  bool _decided = false;
  Timer? _start;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
      return;
    }
    // After the block itself has risen in (TodayEnter, about 260 ms), the days pop in order.
    _start = Timer(Duration(milliseconds: 260 + 30 * widget.order), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _start?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final split = _pop.inMilliseconds / (_pop + _draw).inMilliseconds;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        final pop = Curves.easeOutBack.transform((t / split).clamp(0.0, 1.0));
        final draw = Motion.out.transform(((t - split) / (1 - split)).clamp(0.0, 1.0));
        return Opacity(
          opacity: (t / split * 1.6).clamp(0.0, 1.0),
          child: Transform.scale(
            scale: 0.6 + 0.4 * pop,
            child: Stack(
              alignment: Alignment.center,
              children: [
                widget.disc,
                // The tick's own box stays put; its clip opens from the left.
                SizedBox(
                  width: 16,
                  height: 16,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: ClipRect(child: Align(alignment: Alignment.centerLeft, widthFactor: draw, child: widget.tick)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.color, required this.dashed, this.width = 1.5});

  final Color color;
  final bool dashed;
  final double width;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    final r = size.width / 2 - width / 2;
    final c = size.center(Offset.zero);
    if (!dashed) {
      canvas.drawCircle(c, r, paint);
      return;
    }
    const dashes = 12;
    const sweep = 3.14159265 * 2 / dashes;
    for (var k = 0; k < dashes; k++) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), k * sweep, sweep * 0.55, false, paint);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color || old.dashed != dashed || old.width != width;
}

/// The caption with its key clause in ink at weight 600.
class _Caption extends StatelessWidget {
  const _Caption({required this.text, this.keyClause});

  final String text;
  final String? keyClause;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.caption.copyWith(fontSize: 14, height: 20 / 14, color: colors.ink2);
    final k = keyClause;
    final at = k == null ? -1 : text.indexOf(k);
    return MmOverlapSwitcher.fade(
      alignment: Alignment.centerLeft,
      child: Text.rich(
        key: ValueKey(text),
        at < 0
            ? TextSpan(text: text)
            : TextSpan(children: [
                TextSpan(text: text.substring(0, at)),
                TextSpan(text: k, style: TextStyle(color: colors.ink, fontWeight: FontWeight.w600)),
                TextSpan(text: text.substring(at + k!.length)),
              ]),
        style: style,
      ),
    );
  }
}

/// No goal yet: "Set days" as a pressable token.
class _SetDays extends StatelessWidget {
  const _SetDays({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => KeyButton.quiet(label: TodayCopy.setDays, onPressed: onTap);
}

/// Mobi's cheer beside the caption, 52 dp, once per week.
class _Cheer extends StatelessWidget {
  const _Cheer({required this.weekId});

  final String weekId;

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 52,
    child: MobiCharacter(size: 52, entrance: MobiAct.cheer, shadow: false),
  );
}
