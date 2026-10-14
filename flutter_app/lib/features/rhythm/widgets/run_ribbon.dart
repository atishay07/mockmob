// The run as a ribbon (you-rhythm spec 2.2): one capsule per week, oldest to newest, the height of
// each is the study days of that week out of seven, and a short tick across it marks that week's
// own goal. A week that met its goal is volt, one that did not is a quiet grey, a paused week is
// dashed, this week is outlined until it is met. The ribbon scrolls (44 dp a week, so every week is
// a full-size target) and opens at this week; tapping a week answers on the next frame (it sinks,
// a veil washes it, a selection tick fires) and says the week in words. Every capsule is a number
// the server sent. Capsules grow in left to right once, the whole ribbon drawing in over
// `Motion.drawIn` (450 ms); reduced motion draws them settled.
//
// Hold and slide along it to read each week (`MmScrub`): the capsule under the finger lifts and
// swells a little, its neighbours dim, and the caption cross-fades to that week in words. Under
// consecutive weeks that met their goal a short volt line joins their capsules, drawn with the
// same grow as the capsules; an unmet or paused week breaks it.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/models/rhythm.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';
import '../copy.dart';
import '../logic/dates.dart';
import '../logic/week_view.dart';

/// One week on the ribbon.
class RibbonWeek {
  const RibbonWeek({
    required this.studyDays,
    required this.goal,
    required this.met,
    required this.words,
    required this.label,
    this.current = false,
    this.paused = false,
  });

  final int studyDays;
  final int goal;
  final bool met;
  final bool current;
  final bool paused;

  /// The week in a sentence: read by TalkBack and shown when the week is tapped.
  final String words;

  /// The short label under the capsule ("28 Sep", "Now").
  final String label;
}

/// Closed weeks as ribbon weeks, oldest first: for a host that has no live week (the return card).
List<RibbonWeek> closedRibbonWeeks(List<RhythmWeek> newestFirst) => [
      for (final w in newestFirst.reversed)
        RibbonWeek(
          studyDays: w.studyDays,
          goal: w.goal,
          met: w.met,
          paused: w.paused,
          words: w.paused ? '${closedWeekText(w)} Paused.' : (w.met ? '${closedWeekText(w)} ${RhythmCopy.goalMet}' : closedWeekText(w)),
          label: _short(w.weekStart),
        ),
    ];

/// The weeks of the ribbon, oldest first: the closed weeks the server sent (at most
/// [maxWeeks] - 1 of them) and this week last. Empty when the server sent no closed week.
List<RibbonWeek> ribbonWeeks(Rhythm rhythm, WeekView week, {int maxWeeks = 13}) {
  final closed = closedWeeks(rhythm);
  if (closed.isEmpty) return const [];
  final past = closed.take(maxWeeks - 1).toList().reversed.toList();
  return [
    for (final w in past)
      RibbonWeek(
        studyDays: w.studyDays,
        goal: w.goal,
        met: w.met,
        paused: w.paused,
        words: w.paused ? '${closedWeekText(w)} Paused.' : (w.met ? '${closedWeekText(w)} ${RhythmCopy.goalMet}' : closedWeekText(w)),
        label: _short(w.weekStart),
      ),
    RibbonWeek(
      studyDays: week.studyDays,
      goal: week.goal,
      met: week.met,
      paused: week.status == WeekStatus.paused,
      current: true,
      words: week.label,
      label: RhythmCopy.ribbonNow,
    ),
  ];
}

String _short(String weekStart) {
  final d = parseIsoDate(weekStart);
  return d == null ? weekStart : formatDayMonthShortDate(d);
}

/// "28 Sep".
String formatDayMonthShortDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${d.day} ${months[d.month - 1]}';
}

/// "4 of the last 5 weeks met your goal." from the closed weeks only; null with fewer than two.
String? ribbonSummary(List<RibbonWeek> weeks) {
  final closed = [for (final w in weeks) if (!w.current && !w.paused) w];
  if (closed.length < 2) return null;
  final met = closed.where((w) => w.met).length;
  return RhythmCopy.ribbonSummary(met, closed.length);
}

class RunRibbon extends StatefulWidget {
  const RunRibbon({super.key, required this.weeks, this.animate = true, this.showCounts = false});

  final List<RibbonWeek> weeks;
  final bool animate;

  /// Prints each week's count under its date ("4 of 4"), for a host that has no tap to say it.
  final bool showCounts;

  static const double slot = 44;
  static const double capsule = 24;
  static const double height = 76;

  @override
  State<RunRibbon> createState() => _RunRibbonState();
}

class _RunRibbonState extends State<RunRibbon> with SingleTickerProviderStateMixin {
  late final AnimationController _grow = AnimationController(vsync: this, duration: Motion.drawIn);
  late List<Animation<double>> _curves = _makeCurves(widget.weeks.length);
  final ScrollController _scroll = ScrollController();
  bool _started = false;
  int? _selected;

  /// The week under a held finger (a scrub), or null.
  int? _scrubbed;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || Motion.reduced(context)) {
      _grow.value = 1;
    } else {
      _grow.forward();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  @override
  void dispose() {
    for (final c in _curves) {
      (c as CurvedAnimation).dispose();
    }
    _grow.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// Each capsule grows over two thirds of the ribbon's 450 ms, and the starts are spread over the
  /// other third, so a long ribbon is still drawn in the same time as a short one.
  static const double _own = 2 / 3;

  /// One curve per week, made once: a curve attaches a listener to the controller.
  List<Animation<double>> _makeCurves(int n) {
    return [
      for (var i = 0; i < n; i++)
        CurvedAnimation(
          parent: _grow,
          curve: () {
            final start = n <= 1 ? 0.0 : (1 - _own) * i / (n - 1);
            return Interval(start, start + _own, curve: Motion.glide);
          }(),
        ),
    ];
  }

  @override
  void didUpdateWidget(RunRibbon old) {
    super.didUpdateWidget(old);
    if (old.weeks.length == widget.weeks.length) return;
    for (final c in _curves) {
      (c as CurvedAnimation).dispose();
    }
    _curves = _makeCurves(widget.weeks.length);
    _selected = null;
    _scrubbed = null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final weeks = widget.weeks;
    final shown = _scrubbed ?? _selected;
    final picked = shown == null || shown >= weeks.length ? null : weeks[shown];
    final summary = ribbonSummary(weeks);
    final caption = picked?.words ?? summary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmScrub(
          count: weeks.length,
          // The week under the finger: the slots are 44 dp each, in the list's own scrolled space.
          indexFor: (x, width) => (((x + (_scroll.hasClients ? _scroll.offset : 0)) / RunRibbon.slot).floor()).clamp(0, weeks.length - 1),
          onIndex: (i) => setState(() => _scrubbed = i),
          onEnd: () => setState(() => _scrubbed = null),
          child: SizedBox(
          height: RunRibbon.height + 8 + 18 + (widget.showCounts ? 14 : 0),
          child: ListView.builder(
            controller: _scroll,
            scrollDirection: Axis.horizontal,
            itemCount: weeks.length,
            itemExtent: RunRibbon.slot,
            itemBuilder: (context, i) {
              final w = weeks[i];
              final selected = _selected == i;
              final lifted = _scrubbed == i;
              final dimmed = _scrubbed != null && !lifted;
              final glide = Motion.of(context, const Duration(milliseconds: 180));
              return MmPressable(
                onTap: () => _pick(i),
                semanticsLabel: w.words,
                selected: selected,
                highlight: true,
                focusRadius: MmRadius.smallAll,
                haptic: MmPressHaptic.selection,
                builder: (context, pressed, focused) => DecoratedBox(
                    decoration: BoxDecoration(
                      color: selected ? (colors.isNight ? colors.raised2.withValues(alpha: 0.7) : colors.sunken) : null,
                      borderRadius: MmRadius.smallAll,
                    ),
                    child: Column(
                      children: [
                        const SizedBox(height: 4),
                        // The held week lifts 6 dp and swells; the others dim. Transforms and opacity only.
                        AnimatedOpacity(
                          opacity: dimmed ? 0.5 : 1,
                          duration: glide,
                          child: AnimatedSlide(
                            offset: lifted ? const Offset(0, -0.08) : Offset.zero,
                            duration: glide,
                            curve: Motion.emphasized,
                            child: AnimatedScale(
                              scale: lifted ? 1.1 : 1,
                              duration: glide,
                              curve: Motion.emphasized,
                              child: RepaintBoundary(
                                child: SizedBox(
                                  width: RunRibbon.slot,
                                  height: RunRibbon.height,
                                  child: CustomPaint(painter: _CapsulePainter(colors: colors, week: w, grow: _curves[i])),
                                ),
                              ),
                            ),
                          ),
                        ),
                        // The run: a volt line to the next capsule when both weeks met their goal.
                        SizedBox(
                          width: RunRibbon.slot,
                          height: 6,
                          child: RepaintBoundary(
                            child: CustomPaint(
                              painter: _LinkPainter(
                                colors: colors,
                                linked: i + 1 < weeks.length && _met(w) && _met(weeks[i + 1]),
                                grow: _curves[i],
                              ),
                            ),
                          ),
                        ),
                        Text(
                          w.label,
                          maxLines: 1,
                          textScaler: TextScaler.noScaling,
                          style: type.caption.copyWith(fontSize: 11, height: 14 / 11, color: w.current || selected ? colors.ink : colors.ink3),
                        ),
                        if (widget.showCounts)
                          Text(
                            w.paused ? RhythmCopy.outlookPausedShort : '${w.studyDays} of ${w.goal}',
                            maxLines: 1,
                            textScaler: TextScaler.noScaling,
                            style: type.caption.copyWith(fontSize: 11, height: 14 / 11, fontWeight: FontWeight.w600, color: w.met ? colors.ink : colors.ink2),
                          ),
                      ],
                    ),
                  ),
              );
            },
          ),
        ),
        ),
        if (caption != null) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(
            liveRegion: true,
            child: AnimatedSwitcher(
              duration: Motion.of(context, const Duration(milliseconds: 160)),
              layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
              child: Text(caption, key: ValueKey(caption), style: type.small.copyWith(color: colors.ink2)),
            ),
          ),
        ],
      ],
    );
  }

  /// A week that met its goal and was not paused: the only kind a run line joins.
  static bool _met(RibbonWeek w) => w.met && !w.paused;

  /// The selection tick is the press's own (`MmPressHaptic.selection`).
  void _pick(int i) => setState(() => _selected = _selected == i ? null : i);
}

class _CapsulePainter extends CustomPainter {
  _CapsulePainter({required this.colors, required this.week, required this.grow}) : super(repaint: grow);

  final MmColors colors;
  final RibbonWeek week;
  final Animation<double> grow;

  @override
  void paint(Canvas canvas, Size size) {
    final w = RunRibbon.capsule;
    final x = (size.width - w) / 2;
    final body = RRect.fromRectAndRadius(Rect.fromLTWH(x, 0, w, size.height), Radius.circular(w / 2));
    final night = colors.isNight;
    canvas.drawRRect(body, Paint()..color = colors.ink.withValues(alpha: night ? 0.14 : 0.10));

    if (week.paused) {
      final dash = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round
        ..color = colors.ink3;
      final path = Path()..addRRect(body.deflate(0.75));
      for (final m in path.computeMetrics()) {
        for (var d = 0.0; d < m.length; d += 7) {
          canvas.drawPath(m.extractPath(d, math.min(d + 3.5, m.length)), dash);
        }
      }
      return;
    }

    final frac = (week.studyDays / 7).clamp(0.0, 1.0) * grow.value;
    if (frac > 0) {
      final h = math.max(w, size.height * frac);
      final fill = RRect.fromRectAndRadius(Rect.fromLTWH(x, size.height - h, w, h), Radius.circular(w / 2));
      final Color color = week.met ? colors.volt : (week.current ? colors.ink2.withValues(alpha: 0.5) : colors.ink3.withValues(alpha: night ? 0.55 : 0.6));
      if (week.met && !night) {
        canvas.drawRRect(fill.inflate(1), Paint()..color = colors.voltEdge);
      }
      canvas.drawRRect(fill, Paint()..color = color);
    }
    if (week.current) {
      canvas.drawRRect(
        body.inflate(1.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          // A stroke on the ground: volt on Night, the dark volt on Daylight (`accentText`).
          ..color = week.met ? colors.accentText : colors.ink2,
      );
    }
    if (week.goal > 0 && week.goal <= 7) {
      // The goal tick: a ground-coloured keyline under an ink bar, so it reads on volt, on grey
      // and on the empty track alike.
      final y = size.height - size.height * (week.goal / 7);
      final from = Offset(x - 5, y), to = Offset(x + w + 5, y);
      canvas.drawLine(
        from,
        to,
        Paint()
          ..strokeWidth = 4.5
          ..strokeCap = StrokeCap.round
          ..color = colors.ground,
      );
      canvas.drawLine(
        from.translate(1, 0),
        to.translate(-1, 0),
        Paint()
          ..strokeWidth = 2.5
          ..strokeCap = StrokeCap.round
          ..color = colors.ink,
      );
    }
  }

  @override
  bool shouldRepaint(_CapsulePainter old) => old.colors != colors || old.week != week;
}

/// The volt line between two capsules of consecutive met weeks, from this capsule's centre to the
/// next one's, drawn in as the ribbon grows. Nothing for a week that ends the run.
class _LinkPainter extends CustomPainter {
  _LinkPainter({required this.colors, required this.linked, required this.grow}) : super(repaint: grow);

  final MmColors colors;
  final bool linked;
  final Animation<double> grow;

  @override
  void paint(Canvas canvas, Size size) {
    if (!linked || grow.value <= 0) return;
    final y = size.height / 2;
    final from = Offset(size.width / 2, y);
    // To the next capsule's centre: one slot on. The next slot's own capsule is where it ends.
    final to = Offset(size.width / 2 + RunRibbon.slot * grow.value, y);
    if (!colors.isNight) {
      canvas.drawLine(
        from,
        to,
        Paint()
          ..strokeWidth = 4
          ..strokeCap = StrokeCap.round
          ..color = colors.voltEdge,
      );
    }
    canvas.drawLine(
      from,
      to,
      Paint()
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..color = colors.volt,
    );
  }

  @override
  bool shouldRepaint(_LinkPainter old) => old.colors != colors || old.linked != linked;
}
