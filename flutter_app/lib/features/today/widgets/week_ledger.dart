// The week on Today as a ledger on the ground (ui-blitz/today.md 2.1; owner 13 Oct: every dot
// must earn its place). The count ("1 of 4 study days") and what the rest of the week asks,
// then seven days on a rail: the stretch from Monday to today is inked, so the week visibly
// fills as it goes, and each bubble is a state (counted, planned, rest, passed without study).
// Today is marked by a lit volt edge along the top of its column (no tile, no box). The count
// is a condensed figure, so the week has an anchor. A one-line key names the marks on screen.
//
// Touch (15 Oct): the count row and its chevron open the week sheet. Each day of the rail is a
// column of its own: a tap pops that day's bubble (1, 1.35, 1 over 260 ms) with a selection
// tick and names it in a painted chip above the bubble for 2.2 s ("Tue 14, counted", "Sat, rest
// day"); the weekday letters under the chip step aside and return. Today's bubble breathes a
// ring while it is open (off under reduced motion and when the tab is not on screen); when a
// refresh shows today newly counted by the server, the bubble inks in with one ripple ring and a
// light tick, and the outlook text rolls to its new words. "Goal met" draws one volt underline.
//
// One dialect (design critic 16 Oct, finding 5): every day is drawn with the shared study-week
// mark ([StudyWeekDotPainter]), the weekday letters are the shared 12 sp, and the key is the
// shared [StudyWeekKey] with the shared behaviour: it shows itself on the first study week a
// student sees in the session (when a mark needs words), holds four seconds and folds away; a
// long press on the week brings it back, and screen readers get it as an action. Today keeps its
// own life on top: the inked rail, the lit edge, the breathing ring, the day chips and the pop.
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show ValueListenable;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart' show SubjectEmblem;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/logic/plan_week.dart';
import '../logic/today_model.dart';
import '../logic/week_chip.dart';
import 'today_entrance.dart';
import 'today_tones.dart';
import 'today_type.dart';

class WeekLedger extends ConsumerStatefulWidget {
  const WeekLedger({super.key, required this.week, this.onTap, this.bleed = 0});

  final WeekModel week;
  final VoidCallback? onTap;

  /// How far the ledger's box reaches past the content edge on each side (the screen's gutter,
  /// borrowed). The count row, the key and every drawing stay inset by it, so they sit where they
  /// always did; only the day columns' touch areas use it, so each is at least 48 dp wide on a
  /// 360 dp phone.
  final double bleed;

  /// Height of the rail row at 1x text: the weekday letters, the bubbles and today's lit edge.
  static const double railHeight = 62;

  /// How long a tapped day's chip stays: the chip eases in, holds and eases out around this.
  static const Duration chipHold = Duration(milliseconds: 2200);

  /// The bubble's pop, 1 to 1.35 and back.
  static const Duration popLength = Duration(milliseconds: 260);

  /// Where "the key has been shown" is remembered; null uses the shared session memory, so the
  /// key explains the week once across Today, You and Rhythm.
  static StudyWeekLegendMemory? legendMemory;

  /// Whether the key shows itself on a first view: only when a rest day or a day not counted is
  /// on the rail (filled and hollow read on their own). A long press always brings it.
  static bool needsKey(List<PlanDay> days) => days.any((d) => d.mark == PlanDayMark.rest || d.mark == PlanDayMark.open);

  String describe() => [week.count, ?week.outlook, week.days.map((d) => d.describe()).join('; '), if (onTap != null) 'Opens your week'].join('. ');

  /// The bubble's scale at [t] (0 to 1) of its pop: out to 1.35 by 45%, back to 1.
  static double popScale(double t) {
    if (t <= 0 || t >= 1) return 1;
    const peak = 0.45;
    final p = t < peak ? Curves.easeOut.transform(t / peak) : 1 - Curves.easeInOut.transform((t - peak) / (1 - peak));
    return 1 + 0.35 * p;
  }

  @override
  ConsumerState<WeekLedger> createState() => _WeekLedgerState();
}

class _WeekLedgerState extends ConsumerState<WeekLedger> with TickerProviderStateMixin {
  static const Duration _chipEdge = Duration(milliseconds: 180);
  static const Duration _breatheLength = Duration(milliseconds: 2400);

  late final AnimationController _pop = AnimationController(vsync: this, duration: WeekLedger.popLength);
  late final AnimationController _chip = AnimationController(vsync: this, duration: WeekLedger.chipHold + _chipEdge * 2);
  late final AnimationController _breathe = AnimationController(vsync: this, duration: _breatheLength);
  late final AnimationController _ink = AnimationController(vsync: this, duration: Motion.ink);

  /// Each change plays one ring from today's bubble (see [MmRippleRing]).
  final ValueNotifier<int> _ripplePulse = ValueNotifier(0);

  /// The shared key: up while it is shown, folding on [Motion.exit].
  late final AnimationController _legend = AnimationController(vsync: this, duration: Motion.glideDuration, reverseDuration: Motion.exitDuration);
  late final CurvedAnimation _legendCurve = CurvedAnimation(parent: _legend, curve: Motion.glide, reverseCurve: Motion.exit);

  /// How long the key holds before it folds (the shared [StudyWeek.legendHold]).
  late final AnimationController _legendHold = AnimationController(vsync: this, duration: StudyWeek.legendHold)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) _legend.reverse();
    });

  int? _popIndex;
  int? _chipIndex;
  int? _inkIndex;

  int get _todayIndex => widget.week.days.indexWhere((d) => d.isToday);

  /// Today's bubble is still open: planned or not yet studied.
  bool get _todayOpen {
    final i = _todayIndex;
    return i >= 0 && widget.week.days[i].mark != PlanDayMark.done && !widget.week.paused;
  }

  @override
  void initState() {
    super.initState();
    _chip.addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted) setState(() => _chipIndex = null);
    });
    _ink.value = 1;
  }

  bool _firstLookJudged = false;

  /// The first study week of the session explains itself, when a mark on it needs words: the key
  /// unfolds under the rail (at once under reduced motion), holds, then folds.
  void _judgeFirstLook() {
    if (_firstLookJudged) return;
    _firstLookJudged = true;
    final memory = WeekLedger.legendMemory ?? StudyWeekLegendMemory.session;
    if (memory.seen || !WeekLedger.needsKey(widget.week.days)) return;
    memory.markSeen();
    if (Motion.reduced(context)) {
      _legend.value = 1;
    } else {
      _legend.forward();
    }
    _legendHold.forward();
  }

  /// A long press (or the screen reader's action) brings the key back for four seconds.
  void _showKey() {
    ref.read(hapticsProvider).selection();
    (WeekLedger.legendMemory ?? StudyWeekLegendMemory.session).markSeen();
    if (Motion.reduced(context)) {
      _legend.value = 1;
    } else {
      _legend.forward();
    }
    _legendHold.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncBreathe();
    _judgeFirstLook();
  }

  @override
  void didUpdateWidget(WeekLedger old) {
    super.didUpdateWidget(old);
    _syncBreathe();
    final before = old.week.days.indexWhere((d) => d.isToday);
    final now = _todayIndex;
    if (before >= 0 && before == now && old.week.days[before].mark != PlanDayMark.done && widget.week.days[now].mark == PlanDayMark.done) {
      _inkIn(now);
    }
  }

  /// The ring breathes only while today is open, the app has its ambient loops on (the same gate
  /// as the subject objects), and motion is not reduced. A tab that is not on screen mutes the
  /// ticker on its own, so it costs nothing there.
  void _syncBreathe() {
    final run = _todayOpen && SubjectEmblem.idleEnabled && !Motion.reduced(context);
    if (run && !_breathe.isAnimating) {
      _breathe.repeat();
    } else if (!run && _breathe.isAnimating) {
      _breathe.stop();
      _breathe.value = 0;
    }
  }

  /// The server counted today: the bubble inks in, one ring leaves it, one light tick.
  void _inkIn(int index) {
    ref.read(hapticsProvider).light();
    if (Motion.reduced(context)) return;
    _inkIndex = index;
    _ink.forward(from: 0);
    _ripplePulse.value++;
  }

  void _tapDay(int i) {
    ref.read(hapticsProvider).selection();
    setState(() {
      _chipIndex = i;
      _popIndex = i;
    });
    if (!Motion.reduced(context)) _pop.forward(from: 0);
    _chip.forward(from: 0);
  }

  @override
  void dispose() {
    _pop.dispose();
    _chip.dispose();
    _breathe.dispose();
    _ink.dispose();
    _ripplePulse.dispose();
    _legendHold.dispose();
    _legendCurve.dispose();
    _legend.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final week = widget.week;
    final tap = widget.onTap;
    final bleed = widget.bleed;
    final ledger = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The count row is the control that opens the week sheet; the rail below has controls
          // of its own, one per day. The shared key (first view, a long press) takes the count
          // row's place for its hold and hands it back: it never adds or removes a line, so the
          // hero under the week never moves when it folds (L03). A folded key is no widget.
          Stack(
            alignment: AlignmentDirectional.centerStart,
            children: [
              FadeTransition(
                opacity: ReverseAnimation(_legendCurve),
                child: Padding(
            padding: EdgeInsets.symmetric(horizontal: bleed),
            child: MmPressable(
            semanticsLabel: [week.count, ?week.outlook, if (tap != null) 'Opens your week'].join('. '),
            onTap: tap == null
                ? null
                : () {
                    ref.read(hapticsProvider).selection();
                    tap();
                  },
            pressedScale: 0.985,
            focusRadius: MmRadius.panelAll,
            // At least 48 dp tall: the whole count row is one touch target.
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // The count never breaks mid-phrase: when the outlook does not fit beside it
                    // (large text), the outlook drops to its own line.
                    Expanded(
                      child: Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: MmSpace.s8,
                        runSpacing: 2,
                        children: [
                          _Count(count: week.count),
                          // The chevron travels with the outlook, so a wrapped line keeps its
                          // arrow beside it instead of leaving one orphaned at the edge.
                          if (week.outlook != null || tap != null)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (week.outlook != null)
                                  _Outlook(
                                    text: week.outlook!,
                                    met: week.met,
                                    style: type.caption.copyWith(color: week.met ? colors.accentText : colors.ink2, fontWeight: FontWeight.w600),
                                    rule: colors.litMark,
                                  ),
                                if (tap != null) ...[if (week.outlook != null) const SizedBox(width: MmSpace.s4), Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3)],
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            ),
          ),
              ),
              Positioned.fill(
                child: IgnorePointer(
                  child: AnimatedBuilder(
                    animation: _legend,
                    builder: (context, _) => _legend.isDismissed
                        ? const SizedBox.shrink()
                        : FadeTransition(
                            opacity: _legendCurve,
                            child: SlideTransition(
                              position: Tween(begin: const Offset(0, 0.12), end: Offset.zero).animate(_legendCurve),
                              child: Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: Padding(
                                  padding: EdgeInsets.symmetric(horizontal: MmSpace.s4 + bleed),
                                  child: StudyWeekKey(days: [for (final d in week.days) d.toBubble()]),
                                ),
                              ),
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
          // The 48 dp count row already carries its own air above the rail.
          const SizedBox(height: MmSpace.s4),
          _Rail(
            days: week.days,
            paused: week.paused,
            pop: _pop,
            popIndex: _popIndex,
            chip: _chip,
            chipIndex: _chipIndex,
            ink: _ink,
            inkIndex: _inkIndex,
            ripple: _ripplePulse,
            breathe: _todayOpen ? _breathe : null,
            onDay: _tapDay,
            bleed: bleed,
          ),
        ],
      ),
    );
    const showKeyAction = CustomSemanticsAction(label: 'Show what the marks mean');
    return Semantics(
      customSemanticsActions: {showKeyAction: _showKey},
      child: GestureDetector(behavior: HitTestBehavior.translucent, onLongPress: _showKey, child: ledger),
    );
  }
}

/// The outlook line ("2 more by Sunday", "Goal met"). Its words roll when they change, and a met
/// goal underlines itself once in volt.
class _Outlook extends StatefulWidget {
  const _Outlook({required this.text, required this.met, required this.style, required this.rule});

  final String text;
  final bool met;
  final TextStyle style;
  final Color rule;

  @override
  State<_Outlook> createState() => _OutlookState();
}

class _OutlookState extends State<_Outlook> with SingleTickerProviderStateMixin {
  late final AnimationController _draw = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  bool _drew = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _maybeDraw();
  }

  @override
  void didUpdateWidget(_Outlook old) {
    super.didUpdateWidget(old);
    _maybeDraw();
  }

  void _maybeDraw() {
    if (!widget.met) {
      _drew = false;
      _draw.value = 0;
      return;
    }
    if (_drew) return;
    _drew = true;
    if (Motion.reduced(context)) {
      _draw.value = 1;
    } else {
      _draw.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final roll = Motion.of(context, const Duration(milliseconds: 280));
    return CustomPaint(
      painter: _UnderlinePainter(progress: _draw, color: widget.rule),
      child: AnimatedSwitcher(
        duration: roll,
        switchInCurve: Motion.emphasized,
        switchOutCurve: Curves.easeIn,
        layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
        transitionBuilder: (child, animation) {
          final incoming = child.key == ValueKey(widget.text);
          final slide = Tween<Offset>(begin: incoming ? const Offset(0, 0.6) : const Offset(0, -0.6), end: Offset.zero).animate(animation);
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(position: slide, child: child),
          );
        },
        child: Text(widget.text, key: ValueKey(widget.text), style: widget.style),
      ),
    );
  }
}

class _UnderlinePainter extends CustomPainter {
  _UnderlinePainter({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.emphasized.transform(progress.value.clamp(0.0, 1.0));
    if (t <= 0) return;
    final y = size.height - 1;
    canvas.drawLine(
      Offset(0, y),
      Offset(size.width * t, y),
      Paint()
        ..color = color
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_UnderlinePainter old) => old.progress != progress || old.color != color;
}

/// The rail's shared geometry: seven columns, the bubble's row near the foot.
class _Geo {
  _Geo(this.size, this.n) : col = size.width / n, cy = size.height - bubble - 10;

  final Size size;
  final int n;
  final double col;
  final double cy;

  static const double bubble = 11;

  double cx(int i) => col * (i + 0.5);
}

class _Rail extends StatelessWidget {
  const _Rail({
    required this.days,
    required this.paused,
    required this.pop,
    required this.popIndex,
    required this.chip,
    required this.chipIndex,
    required this.ink,
    required this.inkIndex,
    required this.ripple,
    required this.breathe,
    required this.onDay,
    this.bleed = 0,
  });

  final List<PlanDay> days;
  final bool paused;
  final Animation<double> pop;
  final int? popIndex;
  final Animation<double> chip;
  final int? chipIndex;
  final Animation<double> ink;
  final int? inkIndex;
  final ValueListenable<int> ripple;

  /// Drives today's breathing ring; null while today is not open.
  final Animation<double>? breathe;
  final ValueChanged<int> onDay;

  /// The gutter this rail's box borrows on each side: the drawing is inset by it, the touch columns
  /// are not, so a day's column is as wide as the box allows (48 dp at 360 dp).
  final double bleed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    // The shared study-week letters: 12 sp, up to 1.3x.
    final letter = type.caption.copyWith(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w500, color: colors.ink2, letterSpacing: 0.4);
    // The rail's ink draws from Monday to today, then the counted days ink in, left to right.
    final draw = todayEnterValue(context, delay: const Duration(milliseconds: 120));
    final fill = todayEnterValue(context, delay: const Duration(milliseconds: 220), length: Motion.drawIn);
    final reduced = Motion.reduced(context);
    final chipText = chipIndex == null || chipIndex! >= days.length ? null : dayChipText(days[chipIndex!]);
    return SizedBox(
      height: WeekLedger.railHeight + (scaler.scale(16) - 16),
      width: double.infinity,
      child: Stack(
        children: [
          // The drawing, inset by the borrowed gutter so it sits where it always did.
          Positioned.fill(
            left: bleed,
            right: bleed,
            child: Stack(
              children: [
              Positioned.fill(
                child: ExcludeSemantics(
                  child: RepaintBoundary(
                    child: CustomPaint(
                      painter: _RailPainter(
                        days: days,
                        colors: colors,
                        paused: paused,
                        draw: draw,
                        fill: fill,
                        pop: pop,
                        popIndex: popIndex,
                        chip: chip,
                        chipIndex: chipIndex,
                        chipText: chipText,
                        chipStyle: type.microStrong.copyWith(height: 1, color: colors.ground),
                        ink: ink,
                        inkIndex: inkIndex,
                        reduced: reduced,
                        letter: letter,
                        today: letter.copyWith(fontWeight: FontWeight.w700, color: colors.ink),
                        rest: letter.copyWith(color: colors.ink3),
                        scaler: scaler,
                      ),
                    ),
                  ),
                ),
              ),
              // Today's breathing ring on a layer of its own, so the rail itself never repaints for it.
              Positioned.fill(
                child: IgnorePointer(
                  child: ExcludeSemantics(
                    child: RepaintBoundary(
                      child: CustomPaint(
                        painter: _RingPainter(days: days, colors: colors, breathe: breathe),
                      ),
                    ),
                  ),
                ),
              ),
              // The one ring that leaves a day the server has just counted (MmRippleRing): a box the
              // size of the bubble on today's column, painting only its own band.
              if (days.any((d) => d.isToday))
                Positioned.fill(
                  child: IgnorePointer(
                    child: LayoutBuilder(
                      builder: (context, box) {
                        final g = _Geo(Size(box.maxWidth, box.maxHeight), days.length);
                        final at = days.indexWhere((d) => d.isToday);
                        const r = _Geo.bubble;
                        return Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Positioned(
                              left: g.cx(at) - r,
                              top: g.cy - r,
                              width: r * 2,
                              height: r * 2,
                              child: MmRippleRing(pulse: ripple, color: colors.litMark, from: 0.6, to: 1.7, child: const SizedBox.expand()),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
          // One touch column per day: each is a button of its own.
          Positioned.fill(
            child: Row(
              children: [
                for (var i = 0; i < days.length; i++)
                  Expanded(
                    child: Semantics(
                      button: true,
                      label: days[i].describe(),
                      excludeSemantics: true,
                      onTap: () => onDay(i),
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => onDay(i),
                        // A finger on a day is answered at once: a soft veil behind its bubble.
                        child: const PressHalo(radius: 16, inset: EdgeInsets.symmetric(horizontal: 2, vertical: 6), child: SizedBox.expand()),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RailPainter extends CustomPainter {
  _RailPainter({
    required this.days,
    required this.colors,
    required this.paused,
    required this.draw,
    required this.fill,
    required this.pop,
    required this.popIndex,
    required this.chip,
    required this.chipIndex,
    required this.chipText,
    required this.chipStyle,
    required this.ink,
    required this.inkIndex,
    required this.reduced,
    required this.letter,
    required this.today,
    required this.rest,
    required this.scaler,
  }) : super(repaint: Listenable.merge([draw, fill, pop, chip, ink]));

  final List<PlanDay> days;
  final MmColors colors;
  final bool paused;
  final Animation<double> draw;
  final Animation<double> fill;
  final Animation<double> pop;
  final int? popIndex;
  final Animation<double> chip;
  final int? chipIndex;
  final String? chipText;
  final TextStyle chipStyle;
  final Animation<double> ink;
  final int? inkIndex;
  final bool reduced;
  final TextStyle letter;
  final TextStyle today;
  final TextStyle rest;
  final TextScaler scaler;

  static const double _bubble = _Geo.bubble;

  final Map<String, TextPainter> _texts = {};

  TextPainter _tp(String text, TextStyle style) => _texts.putIfAbsent(
    '${identityHashCode(style)}|$text',
    () => TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
      maxLines: 1,
    )..layout(),
  );

  /// How far the chip is shown, 0 to 1: it eases in, holds and eases out.
  double get _chipShow {
    if (chipIndex == null || chipText == null) return 0;
    final t = chip.value;
    if (t <= 0 || t >= 1) return 0;
    if (reduced) return 1;
    final edge = 180 / (WeekLedger.chipHold.inMilliseconds + 360);
    return Motion.emphasized.transform(math.min(t / edge, (1 - t) / edge).clamp(0.0, 1.0));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final n = days.length;
    if (n == 0) return;
    final g = _Geo(size, n);
    final col = g.col;
    final cy = g.cy;
    double cx(int i) => g.cx(i);
    final todayIndex = days.indexWhere((d) => d.isToday);

    // Today: the screen's lit edge in small. A 1.5 dp volt line along the top of its column,
    // and the light it throws a little way down, behind the letter and the bubble.
    if (todayIndex >= 0) {
      final half = (col - 14).clamp(24.0, 40.0) / 2;
      final x0 = cx(todayIndex) - half, x1 = cx(todayIndex) + half;
      final lit = colors.litMark;
      final wash = Rect.fromLTRB(x0, 0, x1, 34);
      canvas.drawRect(
        wash,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              lit.withValues(alpha: colors.isNight ? 0.2 : 0.16),
              lit.withValues(alpha: 0),
            ],
          ).createShader(wash),
      );
      canvas.drawRRect(RRect.fromLTRBR(x0, 0, x1, 1.5, const Radius.circular(0.75)), Paint()..color = lit);
    }

    // The rail: a groove between the bubbles, Monday to Sunday, inked from Monday up to today.
    const gap = _bubble + 4;
    final groove = Paint()
      ..color = colors.line
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final inked = Paint()
      ..color = colors.ink.withValues(alpha: colors.isNight ? 0.6 : 0.55)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final inkTo = todayIndex <= 0 || paused ? -1.0 : cx(0) + (cx(todayIndex) - cx(0)) * draw.value;
    for (var i = 0; i < n - 1; i++) {
      final a = cx(i) + gap, b = cx(i + 1) - gap;
      if (b <= a) continue;
      canvas.drawLine(Offset(a, cy), Offset(b, cy), groove);
      if (inkTo > a) canvas.drawLine(Offset(a, cy), Offset(inkTo.clamp(a, b), cy), inked);
    }

    // The chip's place, so the weekday letters under it can step aside.
    final show = _chipShow;
    Rect? chipRect;
    TextPainter? chipWords;
    if (show > 0) {
      chipWords = _tp(chipText!, chipStyle);
      final w = chipWords.width + 20;
      final h = chipWords.height + 10;
      final centre = cx(chipIndex!).clamp(w / 2, math.max(w / 2, size.width - w / 2)).toDouble();
      chipRect = Rect.fromCenter(center: Offset(centre, 14), width: w, height: h);
    }

    for (var i = 0; i < n; i++) {
      final d = days[i];
      final c = Offset(cx(i), cy);
      // Counted days ink in one after another; a planned day ahead is a full ring, a day that
      // passed without study a dim one.
      final stagger = n <= 1 ? 0.0 : i / (n - 1) * 0.5;
      var f = d.mark == PlanDayMark.done ? ((fill.value - stagger) / 0.5).clamp(0.0, 1.0) : 1.0;
      // A day the server just counted inks in on its own clock, after the rail had drawn.
      if (i == inkIndex && d.mark == PlanDayMark.done) f = Motion.emphasized.transform(ink.value.clamp(0.0, 1.0));
      final dim = d.mark == PlanDayMark.open && !d.isToday ? 0.5 : (paused ? 0.6 : 1.0);
      final scale = i == popIndex && !reduced ? WeekLedger.popScale(pop.value) : 1.0;
      final r = _bubble * scale;
      // The shared study-week mark, so this rail, the You hub, Rhythm and the week sheet draw the
      // same bubble for the same day.
      if (dim < 1) canvas.saveLayer(Rect.fromCircle(center: c, radius: r + 4), Paint()..color = Color.fromRGBO(0, 0, 0, dim));
      if (d.mark == PlanDayMark.done && f < 1) _dot(canvas, c, r, WeekDayMark.open, d.isToday, null);
      _dot(canvas, c, r, d.toBubble().mark, d.isToday, d.mark == PlanDayMark.done ? f : null);
      if (dim < 1) canvas.restore();
      final tp = _tp(d.initial, d.isToday ? today : (d.mark == PlanDayMark.rest ? rest : letter));
      final at = Offset(c.dx - tp.width / 2, 8);
      final covered = chipRect != null && chipRect.inflate(4).overlaps(Rect.fromLTWH(at.dx, at.dy, tp.width, tp.height));
      if (covered) {
        final keep = 1 - show;
        if (keep > 0.01) {
          canvas.saveLayer(Rect.fromLTWH(at.dx - 1, at.dy - 1, tp.width + 2, tp.height + 2), Paint()..color = Color.fromRGBO(0, 0, 0, keep));
          tp.paint(canvas, at);
          canvas.restore();
        }
      } else {
        tp.paint(canvas, at);
      }
    }

    // The chip: an ink pill with the day named in the ground's colour, above its bubble.
    if (chipRect != null && chipWords != null) {
      final scale = reduced ? 1.0 : 0.9 + 0.1 * show;
      canvas.saveLayer(chipRect.inflate(4), Paint()..color = Color.fromRGBO(0, 0, 0, show));
      canvas.translate(chipRect.center.dx, chipRect.bottom);
      canvas.scale(scale);
      canvas.translate(-chipRect.center.dx, -chipRect.bottom);
      canvas.drawRRect(RRect.fromRectAndRadius(chipRect, Radius.circular(chipRect.height / 2)), Paint()..color = colors.ink);
      chipWords.paint(canvas, Offset(chipRect.center.dx - chipWords.width / 2, chipRect.center.dy - chipWords.height / 2));
      canvas.restore();
    }
  }

  /// One day's mark, radius [r] at [c], through the shared [StudyWeekDotPainter].
  void _dot(Canvas canvas, Offset c, double r, WeekDayMark mark, bool today, double? fill) {
    canvas.save();
    canvas.translate(c.dx - r, c.dy - r);
    StudyWeekDotPainter(colors: colors, mark: mark, today: today, pad: 0, fill: fill == null ? null : AlwaysStoppedAnimation<double>(fill))
        .paint(canvas, Size.square(r * 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_RailPainter old) =>
      old.days != days ||
      old.colors != colors ||
      old.paused != paused ||
      old.draw != draw ||
      old.fill != fill ||
      old.pop != pop ||
      old.popIndex != popIndex ||
      old.chip != chip ||
      old.chipIndex != chipIndex ||
      old.chipText != chipText ||
      old.ink != ink ||
      old.inkIndex != inkIndex ||
      old.reduced != reduced ||
      old.letter != letter ||
      old.scaler != scaler;
}

/// Today's breathing ring (2.4 s, while today is open). Nothing else is drawn here.
class _RingPainter extends CustomPainter {
  _RingPainter({required this.days, required this.colors, required this.breathe}) : super(repaint: breathe);

  final List<PlanDay> days;
  final MmColors colors;
  final Animation<double>? breathe;

  @override
  void paint(Canvas canvas, Size size) {
    final n = days.length;
    if (n == 0) return;
    final g = _Geo(size, n);
    final b = breathe;
    final todayIndex = days.indexWhere((d) => d.isToday);
    if (b != null && todayIndex >= 0 && b.isAnimating) {
      // A slow swell outward that fades as it goes: one ring every 2.4 s.
      final t = Curves.easeOut.transform(b.value);
      canvas.drawCircle(
        Offset(g.cx(todayIndex), g.cy),
        _Geo.bubble + 3 + 5 * t,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = colors.litMark.withValues(alpha: 0.5 * (1 - t)),
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.days != days || old.colors != colors || old.breathe != breathe;
}

/// "1 of 4 study days" with the figure in the condensed cut and the rest in the body, so the
/// week has one number to read first. A count that does not start with a figure stays a line.
class _Count extends StatelessWidget {
  const _Count({required this.count});

  final String count;

  static final RegExp _shape = RegExp(r'^(\d+)\s+(.+)$');

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = _shape.firstMatch(count);
    // A changed count (a refresh counted a day) rolls from the old words to the new, like the
    // outlook beside it; the first paint and an unchanged count stand still.
    final Widget words = m == null
        ? Text(
            count,
            key: ValueKey(count),
            style: type.cardTitle.copyWith(color: colors.ink),
          )
        // One run of text: the figure and its words share a baseline and never split apart.
        : Text.rich(
            key: ValueKey(count),
            TextSpan(
              children: [
                TextSpan(
                  text: m.group(1),
                  style: type.countFigure.copyWith(color: colors.ink),
                ),
                TextSpan(
                  text: ' ${m.group(2)}',
                  style: type.labelLarge.copyWith(color: colors.ink),
                ),
              ],
            ),
          );
    return AnimatedSwitcher(
      duration: Motion.of(context, const Duration(milliseconds: 280)),
      switchInCurve: Motion.emphasized,
      switchOutCurve: Curves.easeIn,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
      transitionBuilder: (child, animation) {
        final incoming = child.key == ValueKey(count);
        final slide = Tween<Offset>(begin: incoming ? const Offset(0, 0.4) : const Offset(0, -0.4), end: Offset.zero).animate(animation);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: slide, child: child),
        );
      },
      child: words,
    );
  }
}
