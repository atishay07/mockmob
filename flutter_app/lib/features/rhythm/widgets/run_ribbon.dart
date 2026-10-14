// The run as a ribbon (you-rhythm spec 2.2): one capsule per week, oldest to newest, the height of
// each is the study days of that week out of seven, and a short tick across it marks that week's
// own goal. A week that met its goal is volt, one that did not is a quiet grey, a paused week is
// dashed, this week is outlined until it is met. The ribbon scrolls (40 dp a week, so every week is
// a full-size target) and opens at this week; tapping a week says it in words and ticks. Every
// capsule is a number the server sent. Capsules grow in left to right once; reduced motion draws
// them settled.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/rhythm.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
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

class RunRibbon extends ConsumerStatefulWidget {
  const RunRibbon({super.key, required this.weeks, this.animate = true});

  final List<RibbonWeek> weeks;
  final bool animate;

  static const double slot = 40;
  static const double capsule = 14;
  static const double height = 76;

  @override
  ConsumerState<RunRibbon> createState() => _RunRibbonState();
}

class _RunRibbonState extends ConsumerState<RunRibbon> with SingleTickerProviderStateMixin {
  late final AnimationController _grow = AnimationController(vsync: this, duration: Duration(milliseconds: _totalMs(widget.weeks.length)));
  late List<Animation<double>> _curves = _makeCurves(widget.weeks.length);
  final ScrollController _scroll = ScrollController();
  bool _started = false;
  int? _selected;

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

  static int _totalMs(int n) => 360 + 40 * math.max(0, n - 1);

  /// One curve per week, made once: a curve attaches a listener to the controller.
  List<Animation<double>> _makeCurves(int n) {
    final total = _totalMs(n);
    return [
      for (var i = 0; i < n; i++)
        CurvedAnimation(
          parent: _grow,
          curve: Interval((40 * i / total).clamp(0.0, 0.9), ((40 * i + 360) / total).clamp(0.0, 1.0), curve: Motion.glide),
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
    _grow.duration = Duration(milliseconds: _totalMs(widget.weeks.length));
    _curves = _makeCurves(widget.weeks.length);
    _selected = null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final weeks = widget.weeks;
    final picked = _selected == null ? null : weeks[_selected!];
    final summary = ribbonSummary(weeks);
    final caption = picked?.words ?? summary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: RunRibbon.height + 8 + 18,
          child: ListView.builder(
            controller: _scroll,
            scrollDirection: Axis.horizontal,
            itemCount: weeks.length,
            itemExtent: RunRibbon.slot,
            itemBuilder: (context, i) {
              final w = weeks[i];
              final selected = _selected == i;
              return Semantics(
                container: true,
                button: true,
                selected: selected,
                label: w.words,
                excludeSemantics: true,
                onTap: () => _pick(i),
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _pick(i),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: selected ? (colors.isNight ? colors.raised2.withValues(alpha: 0.7) : colors.sunken) : null,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const SizedBox(height: 4),
                        RepaintBoundary(
                          child: SizedBox(
                            width: RunRibbon.slot,
                            height: RunRibbon.height,
                            child: CustomPaint(painter: _CapsulePainter(colors: colors, week: w, grow: _curves[i])),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          w.label,
                          maxLines: 1,
                          textScaler: TextScaler.noScaling,
                          style: type.caption.copyWith(fontSize: 11, height: 14 / 11, color: w.current || selected ? colors.ink : colors.ink3),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (caption != null) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(
            liveRegion: true,
            child: AnimatedSwitcher(
              duration: Motion.of(context, const Duration(milliseconds: 160)),
              child: Text(caption, key: ValueKey(caption), style: type.small.copyWith(color: colors.ink2)),
            ),
          ),
        ],
      ],
    );
  }

  void _pick(int i) {
    ref.read(hapticsProvider).tick();
    setState(() => _selected = _selected == i ? null : i);
  }
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
    canvas.drawRRect(body, Paint()..color = colors.line.withValues(alpha: night ? 0.85 : 1));

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
          ..color = week.met ? colors.volt : colors.ink2,
      );
    }
    if (week.goal > 0 && week.goal <= 7) {
      final y = size.height - size.height * (week.goal / 7);
      canvas.drawLine(
        Offset(x - 4, y),
        Offset(x + w + 4, y),
        Paint()
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round
          ..color = colors.ink.withValues(alpha: night ? 0.75 : 0.7),
      );
    }
  }

  @override
  bool shouldRepaint(_CapsulePainter old) => old.colors != colors || old.week != week;
}
