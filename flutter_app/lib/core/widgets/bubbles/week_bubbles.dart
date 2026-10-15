import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../copy/formatters.dart';
import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../pressable.dart';
import 'bubble_painter.dart';

/// What one day of the week shows.
enum WeekDayMark {
  /// A study day that happened: inked.
  done,

  /// A planned study day still to come, or one that passed without study (never shamed).
  open,

  /// A chosen rest day: drawn distinct, never as a miss.
  rest,

  /// A study day the student planned and that is still to come: a firmer ring than [open].
  /// [WeekBubbles] (the older row) draws it as [open]; [StudyWeek] keeps them apart.
  planned,
}

class WeekBubbleDay {
  const WeekBubbleDay({this.mark = WeekDayMark.open, this.isToday = false, this.date});

  final WeekDayMark mark;
  final bool isToday;

  /// The day of the month, shown under the bubble by [StudyWeek]'s full variant. Null shows none.
  final int? date;
}

/// The week as seven bubbles, Monday first, with weekday initials beneath (brief section 12).
/// New screens use [StudyWeek], which draws the same bubbles with the ring, the dates and the key.
/// Today is ringed; done days are inked; rest days have their own dashed shape with a bar. The
/// initials follow the student's text size (up to 2x) and the row grows to fit them.
class WeekBubbles extends StatelessWidget {
  const WeekBubbles({super.key, required this.days, this.bubbleSize = 22, this.gap = 8, this.initials = true, this.semanticsLabel})
    : assert(days.length == 7, 'A week has seven days.');

  final List<WeekBubbleDay> days;
  final double bubbleSize;
  final double gap;
  final bool initials;
  final String? semanticsLabel;

  double get width => bubbleSize * 7 + gap * 6 + 10;

  static const double _initialSize = 11;

  String describe() {
    final done = [
      for (var i = 0; i < 7; i++)
        if (days[i].mark == WeekDayMark.done) weekdayNames[i],
    ];
    final rest = [
      for (var i = 0; i < 7; i++)
        if (days[i].mark == WeekDayMark.rest) weekdayNames[i],
    ];
    final today = days.indexWhere((d) => d.isToday);
    return [
      done.isEmpty ? 'No study days yet this week' : 'Studied ${joinWithAnd(done)}',
      if (rest.isNotEmpty) 'Rest ${joinWithAnd(rest)}',
      if (today >= 0) 'Today is ${weekdayNames[today]}',
    ].join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(fontSize: _initialSize, height: 1, fontWeight: FontWeight.w600);
    final scale = (MediaQuery.textScalerOf(context).scale(_initialSize) / _initialSize).clamp(1.0, 2.0);
    final height = bubbleSize + 10 + (initials ? 5 + (_initialSize * scale).ceilToDouble() : 0);
    return Semantics(
      container: true,
      label: semanticsLabel ?? describe(),
      excludeSemantics: true,
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size(width, height),
          painter: _WeekPainter(days: days, size: bubbleSize, gap: gap, colors: colors, style: initials ? style : null, textScaler: TextScaler.linear(scale)),
        ),
      ),
    );
  }
}

class _WeekPainter extends CustomPainter {
  _WeekPainter({required this.days, required this.size, required this.gap, required this.colors, this.style, required this.textScaler});

  final List<WeekBubbleDay> days;
  final double size;
  final double gap;
  final MmColors colors;
  final TextStyle? style;
  final TextScaler textScaler;

  @override
  void paint(Canvas canvas, Size canvasSize) {
    final bubbles = BubblePaint(colors);
    final r = size / 2;
    const pad = 5.0;
    for (var i = 0; i < 7; i++) {
      final day = days[i];
      final c = Offset(pad + r + i * (size + gap), pad + r);
      final state = switch (day.mark) {
        WeekDayMark.done => BubbleState.filled,
        WeekDayMark.open || WeekDayMark.planned => BubbleState.hollow,
        WeekDayMark.rest => BubbleState.rest,
      };
      bubbles.paint(canvas, c, r, state, emphasis: day.isToday);
      if (style != null) {
        final tp = TextPainter(
          text: TextSpan(
            text: weekdayInitials[i],
            style: style!.copyWith(color: day.isToday ? colors.ink : colors.ink3),
          ),
          textDirection: TextDirection.ltr,
          textScaler: textScaler,
        )..layout();
        tp.paint(canvas, Offset(c.dx - tp.width / 2, pad + size + 8));
        tp.dispose();
      }
    }
  }

  @override
  bool shouldRepaint(_WeekPainter old) {
    if (old.colors != colors || old.size != size || old.gap != gap || old.style != style || old.textScaler != textScaler) return true;
    for (var i = 0; i < 7; i++) {
      if (old.days[i].mark != days[i].mark || old.days[i].isToday != days[i].isToday) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// StudyWeek: the one study-week widget (design critic 16 Oct, finding 5)
// ---------------------------------------------------------------------------------------------

/// How much of the study week to draw.
enum StudyWeekVariant {
  /// Seven weekday columns: the letter, one bubble (22 dp), nothing else. Today's strip.
  compact,

  /// The ring (one segment per goal day, one inked per counted day, the count in the middle) with
  /// an optional headline and caption beside it, a hairline, then the seven columns. The You hub
  /// and the Rhythm screen.
  ring,

  /// Larger columns (28 dp bubble) with the date under each, a chosen day lifted onto a well and
  /// every column a 48 dp-tall button when [StudyWeek.onDay] is set. The week sheet.
  full,
}

/// When [StudyWeek] draws its key ("Counted, Planned, Rest, Not counted").
enum StudyWeekLegendMode {
  /// The key shows the first time a student ever sees a study week (see [StudyWeekLegendMemory]),
  /// holds for four seconds, then folds away; a long press on the week brings it back for four
  /// seconds. Screen readers get the same through a custom action, and every day is read in words.
  auto,

  /// The key is always drawn (a sheet whose whole job is explaining the week, a golden).
  always,

  /// No key and no long-press.
  never,
}

/// Remembers whether the study-week key has been shown. The default [session] remembers for the
/// life of the app process; a feature that wants "first time ever" gives [StudyWeek] its own
/// subclass backed by the preferences store.
class StudyWeekLegendMemory {
  StudyWeekLegendMemory();

  /// The shared default.
  static final StudyWeekLegendMemory session = StudyWeekLegendMemory();

  bool _seen = false;

  bool get seen => _seen;

  void markSeen() => _seen = true;

  @visibleForTesting
  void reset() => _seen = false;
}

/// The words for each mark, shared by the key and by screen readers.
abstract final class StudyWeekWords {
  static const String counted = 'Counted';
  static const String planned = 'Planned';
  static const String rest = 'Rest';
  static const String notCounted = 'Not counted';

  static String key(WeekDayMark mark) => switch (mark) {
    WeekDayMark.done => counted,
    WeekDayMark.planned => planned,
    WeekDayMark.rest => rest,
    WeekDayMark.open => notCounted,
  };

  /// One day read out: "Wednesday, today, planned study day".
  static String day(WeekBubbleDay day, int index) {
    final state = switch (day.mark) {
      WeekDayMark.done => 'study day, counted',
      WeekDayMark.planned => 'planned study day',
      WeekDayMark.rest => 'rest day',
      WeekDayMark.open => 'not counted',
    };
    return '${weekdayNames[index]}${day.isToday ? ', today' : ''}, $state';
  }

  /// The whole week in a breath.
  static String week(List<WeekBubbleDay> days) {
    List<String> named(WeekDayMark mark) => [
      for (var i = 0; i < 7; i++)
        if (days[i].mark == mark) weekdayNames[i],
    ];
    final done = named(WeekDayMark.done);
    final planned = named(WeekDayMark.planned);
    final rest = named(WeekDayMark.rest);
    final today = days.indexWhere((d) => d.isToday);
    return [
      done.isEmpty ? 'No study days yet this week' : 'Studied ${joinWithAnd(done)}',
      if (planned.isNotEmpty) 'Planned ${joinWithAnd(planned)}',
      if (rest.isNotEmpty) 'Rest ${joinWithAnd(rest)}',
      if (today >= 0) 'Today is ${weekdayNames[today]}',
    ].join('. ');
  }
}

/// Draws one day's mark, for a column and for the key beneath the week, so the key is always a
/// true sample of what the week shows. The bubble is the shared answer bubble ([BubblePaint]); a
/// planned day is the hollow bubble with a firmer ink ring; today is ringed.
class StudyWeekDotPainter extends CustomPainter {
  StudyWeekDotPainter({required this.colors, required this.mark, this.today = false, this.fill, this.pad = 12}) : super(repaint: fill);

  final MmColors colors;
  final WeekDayMark mark;
  final bool today;

  /// Room kept clear round the bubble for today's ring (the columns use 12, the key 0).
  final double pad;

  /// 0 to 1 ink for a counted day; null draws it inked.
  final Animation<double>? fill;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = math.max(1.0, (size.shortestSide - pad) / 2);
    final bubbles = BubblePaint(colors);
    switch (mark) {
      case WeekDayMark.done:
        bubbles.paint(canvas, c, r, BubbleState.filled, fill: fill?.value ?? 1, origin: const Offset(-0.6, -0.6), emphasis: today);
      case WeekDayMark.open:
        bubbles.paint(canvas, c, r, BubbleState.hollow, emphasis: today);
      case WeekDayMark.rest:
        bubbles.paint(canvas, c, r, BubbleState.rest, emphasis: today);
      case WeekDayMark.planned:
        bubbles.paint(canvas, c, r, BubbleState.hollow, emphasis: today);
        final stroke = (r * 0.12).clamp(1.2, 2.2) * 1.2;
        canvas.drawCircle(
          c,
          r - stroke / 2,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = stroke
            ..color = colors.ink2,
        );
    }
  }

  @override
  bool shouldRepaint(StudyWeekDotPainter old) => old.colors != colors || old.mark != mark || old.today != today || old.fill != fill || old.pad != pad;
}

/// The key under a study week: a small mark and its word for each kind of mark the week shows.
/// One line (it scales down rather than wrapping), 12 sp. Decorative for screen readers, which
/// read each day in words.
class StudyWeekKey extends StatelessWidget {
  const StudyWeekKey({super.key, required this.days});

  final List<WeekBubbleDay> days;

  /// Counted, Planned, Rest, Not counted: the order the week is read in.
  static const List<WeekDayMark> order = [WeekDayMark.done, WeekDayMark.planned, WeekDayMark.rest, WeekDayMark.open];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = {for (final d in days) d.mark};
    final marks = [
      for (final m in order)
        if (shown.contains(m)) m,
    ];
    return ExcludeSemantics(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < marks.length; i++) ...[
              if (i > 0) const SizedBox(width: MmSpace.s16),
              SizedBox.square(
                dimension: 14,
                child: CustomPaint(
                  painter: StudyWeekDotPainter(colors: colors, mark: marks[i], pad: 0),
                ),
              ),
              const SizedBox(width: MmSpace.s6),
              Text(
                StudyWeekWords.key(marks[i]),
                style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink2),
                textScaler: TextScaler.noScaling,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The study-week ring: exactly [goal] segments (1 to 7), one inked for every counted day up to
/// the goal, the count in the middle. A paused week is dashed grey and claims nothing. Draws
/// settled; [StudyWeek] hands it ink animations for the first view.
class StudyWeekRing extends StatelessWidget {
  const StudyWeekRing({super.key, required this.done, required this.goal, this.size = 88, this.paused = false, this.fills = const []});

  final int done;
  final int goal;
  final double size;
  final bool paused;

  /// One 0 to 1 ink per segment, in order; a segment without one is drawn inked.
  final List<Animation<double>> fills;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final g = goal.clamp(1, 7);
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: _RingPainter(colors: colors, goal: g, done: done, paused: paused, fills: fills),
            child: Center(
              child: SizedBox(
                width: size * 0.58,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: paused
                      ? _PauseBars(height: size * 0.26, color: colors.ink)
                      : Text(
                          '$done',
                          style: type.figure.copyWith(fontSize: size * 0.42, color: colors.ink),
                          textScaler: TextScaler.noScaling,
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PauseBars extends StatelessWidget {
  const _PauseBars({required this.height, required this.color});

  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final bar = height * 0.3;
    return SizedBox(
      width: height * 0.84,
      height: height,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (var i = 0; i < 2; i++)
            DecoratedBox(
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(bar / 2)),
              child: SizedBox(width: bar, height: height),
            ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.colors, required this.goal, required this.done, required this.paused, required this.fills})
    : super(repaint: Listenable.merge(fills));

  final MmColors colors;
  final int goal;
  final int done;
  final bool paused;
  final List<Animation<double>> fills;

  @override
  void paint(Canvas canvas, Size size) {
    final side = size.shortestSide;
    final stroke = math.max(5.0, side * 0.085);
    final c = size.center(Offset.zero);
    final radius = side / 2 - stroke / 2 - 1;
    final rect = Rect.fromCircle(center: c, radius: radius);
    final filled = paused ? 0 : math.min(done, goal);

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = paused ? colors.ink4 : colors.lineStrong;
    final dash = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt
      ..color = colors.ink4;
    final ink = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = colors.volt;
    // Daylight: volt on paper is faint, so a 1 dp olive rim carries each inked arc (as the bubble does).
    final rim = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke + 2
      ..strokeCap = StrokeCap.round
      ..color = colors.accentText.withValues(alpha: 0.55);

    double inkOf(int index) => index < fills.length ? Curves.easeOut.transform(fills[index].value.clamp(0.0, 1.0)) : 1.0;

    void dashed(double start, double sweep) {
      // Three dashes per segment: the week is on hold, nothing is claimed.
      const dashes = 3;
      final part = sweep / (dashes * 2 - 1);
      for (var d = 0; d < dashes; d++) {
        canvas.drawArc(rect, start + d * part * 2, part, false, dash);
      }
    }

    void arc(double start, double sweep, int index, {required bool inked}) {
      canvas.drawArc(rect, start, sweep, false, track);
      if (!inked) return;
      final t = inkOf(index);
      if (t <= 0) return;
      if (!colors.isNight) canvas.drawArc(rect, start, sweep * t, false, rim);
      canvas.drawArc(rect, start, sweep * t, false, ink);
    }

    if (goal == 1) {
      if (paused) {
        dashed(-math.pi / 2, 2 * math.pi);
      } else {
        canvas.drawCircle(c, radius, track);
        final t = inkOf(0);
        if (filled > 0 && t > 0) {
          if (!colors.isNight) canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * t, false, rim);
          canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * t, false, ink);
        }
      }
      return;
    }
    // The visible gap between segments includes the round caps.
    final gap = math.max(0.16, stroke * 1.25 / radius);
    final seg = (2 * math.pi - goal * gap) / goal;
    final cap = stroke / 2 / radius;
    for (var i = 0; i < goal; i++) {
      final start = -math.pi / 2 + gap / 2 + i * (seg + gap) + cap;
      if (paused) {
        dashed(start, seg - 2 * cap);
      } else {
        arc(start, seg - 2 * cap, i, inked: i < filled);
      }
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.colors != colors || old.goal != goal || old.done != done || old.paused != paused || !listEquals(old.fills, fills);
}

/// The study week, one widget for every screen that shows it (Today, You, Rhythm, the week sheet):
/// the same seven bubbles, the same ring, the same words, the same key.
///
/// [StudyWeekVariant.compact] is the weekday letters over seven bubbles; [StudyWeekVariant.ring]
/// adds the segment ring with a headline and caption; [StudyWeekVariant.full] is the larger
/// columns with dates, a chosen day and tap targets. All three share [days] (Monday first) and
/// the key: it appears on a student's first look at a week and on a long press, never as a
/// permanent line of small print ([StudyWeekLegendMode]).
///
/// The columns share the width equally, so give it a bounded width. Weekday letters are 12 sp and
/// follow the text size up to 1.3x. Under reduced motion everything is drawn settled; with
/// [animateIn] the counted days (and ring segments) ink one after another when the week first
/// appears, 120 ms of lead, 260 ms each, 70 ms apart.
class StudyWeek extends ConsumerStatefulWidget {
  const StudyWeek({
    super.key,
    required this.days,
    this.variant = StudyWeekVariant.compact,
    this.done,
    this.goal,
    this.paused = false,
    this.headline,
    this.caption,
    this.ringSize = 88,
    this.bubble,
    this.showDates,
    this.animateIn = false,
    this.onDay,
    this.selected,
    this.legend = StudyWeekLegendMode.auto,
    this.legendMemory,
    this.semanticsLabel,
  }) : assert(days.length == 7, 'A week has seven days.');

  final List<WeekBubbleDay> days;
  final StudyWeekVariant variant;

  /// Ring only: the count in the middle and the inked segments. Defaults to the counted days.
  final int? done;

  /// Ring only: the weekly goal, 1 to 7, the number of segments. Defaults to the counted and
  /// planned days.
  final int? goal;

  /// Ring only: a paused week.
  final bool paused;

  /// Ring only: the line beside the ring in the title cut ("3 of 4 study days").
  final String? headline;

  /// Ring only: one quiet line under [headline].
  final String? caption;
  final double ringSize;

  /// The bubble's diameter: 22 for compact and ring, 28 for full.
  final double? bubble;

  /// Dates under the bubbles. Defaults to on for full when the days carry dates.
  final bool? showDates;

  /// Ink the counted days one after another on first appearance.
  final bool animateIn;

  /// Makes every column a button. It reports the day's index, 0 for Monday; the week never
  /// decides what a tap means.
  final ValueChanged<int>? onDay;

  /// The day (0 = Monday) the caller is describing; its column sits on a soft well.
  final int? selected;
  final StudyWeekLegendMode legend;

  /// Where "the key has been shown" is remembered. Defaults to [StudyWeekLegendMemory.session].
  final StudyWeekLegendMemory? legendMemory;

  /// Overrides the generated description of the week.
  final String? semanticsLabel;

  /// How long the key stays up when it appears by itself or on a long press.
  static const Duration legendHold = Duration(seconds: 4);

  static const int _leadMs = 120;
  static const int _inkMs = 260;
  static const int _perDayMs = 70;

  @override
  ConsumerState<StudyWeek> createState() => _StudyWeekState();
}

class _StudyWeekState extends ConsumerState<StudyWeek> with TickerProviderStateMixin {
  late final AnimationController _legendCtl;
  late final AnimationController _hold;
  late final CurvedAnimation _legendCurve;

  AnimationController? _ink;
  List<Animation<double>> _fills = const [];
  bool _inkStarted = false;

  int get _daysDone => widget.days.where((d) => d.mark == WeekDayMark.done).length;
  int get _ringDone => widget.done ?? _daysDone;
  int get _ringGoal => (widget.goal ?? widget.days.where((d) => d.mark == WeekDayMark.done || d.mark == WeekDayMark.planned).length).clamp(1, 7);

  @override
  void initState() {
    super.initState();
    _legendCtl = AnimationController(vsync: this, duration: Motion.glideDuration, reverseDuration: Motion.exitDuration);
    _legendCurve = CurvedAnimation(parent: _legendCtl, curve: Motion.glide, reverseCurve: Motion.exit);
    _hold = AnimationController(vsync: this, duration: StudyWeek.legendHold)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed && mounted) _legendCtl.reverse();
      });
    switch (widget.legend) {
      case StudyWeekLegendMode.always:
        _legendCtl.value = 1;
      case StudyWeekLegendMode.never:
        break;
      case StudyWeekLegendMode.auto:
        final memory = widget.legendMemory ?? StudyWeekLegendMemory.session;
        if (!memory.seen) {
          // The first study week a student sees explains itself; the next ones stay quiet.
          memory.markSeen();
          _legendCtl.value = 1;
          _hold.forward();
        }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_inkStarted) return;
    _inkStarted = true;
    final units = widget.variant == StudyWeekVariant.ring ? math.max(_daysDone, math.min(_ringDone, _ringGoal)) : _daysDone;
    if (!widget.animateIn || Motion.reduced(context) || units == 0) return;
    final total = StudyWeek._leadMs + StudyWeek._inkMs + StudyWeek._perDayMs * (units - 1);
    final ink = _ink = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: total),
    )..forward();
    _fills = [
      for (var i = 0; i < units; i++)
        CurvedAnimation(
          parent: ink,
          curve: Interval(
            ((StudyWeek._leadMs + i * StudyWeek._perDayMs) / total).clamp(0.0, 1.0),
            ((StudyWeek._leadMs + i * StudyWeek._perDayMs + StudyWeek._inkMs) / total).clamp(0.0, 1.0),
            curve: Motion.glide,
          ),
        ),
    ];
  }

  @override
  void didUpdateWidget(StudyWeek old) {
    super.didUpdateWidget(old);
    if (old.legend == widget.legend) return;
    _hold.stop();
    _legendCtl.value = widget.legend == StudyWeekLegendMode.always ? 1 : 0;
  }

  @override
  void dispose() {
    for (final fill in _fills) {
      (fill as CurvedAnimation).dispose();
    }
    _ink?.dispose();
    _legendCurve.dispose();
    _hold.dispose();
    _legendCtl.dispose();
    super.dispose();
  }

  void _showLegend() {
    if (widget.legend != StudyWeekLegendMode.auto) return;
    ref.read(hapticsProvider).selection();
    (widget.legendMemory ?? StudyWeekLegendMemory.session).markSeen();
    _legendCtl.duration = Motion.of(context, Motion.glideDuration);
    _legendCtl.forward();
    _hold.forward(from: 0);
  }

  Animation<double>? _fillFor(int order) => order < _fills.length ? _fills[order] : null;

  String get _label {
    final week = widget.semanticsLabel ?? StudyWeekWords.week(widget.days);
    if (widget.variant != StudyWeekVariant.ring) return week;
    return [if (widget.headline != null) widget.headline!, if (widget.caption != null) widget.caption!, week].join('. ');
  }

  List<Animation<double>> _ringFills() {
    final inked = math.min(_ringDone, _ringGoal);
    return [for (var i = 0; i < inked && i < _fills.length; i++) _fills[i]];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final variant = widget.variant;
    final full = variant == StudyWeekVariant.full;
    final ring = variant == StudyWeekVariant.ring;
    final bubble = widget.bubble ?? (full ? 28.0 : 22.0);
    final dates = widget.showDates ?? (full && widget.days.any((d) => d.date != null));
    final perDay = widget.onDay != null;

    var order = 0;
    final columns = <Widget>[];
    for (var i = 0; i < 7; i++) {
      final day = widget.days[i];
      final fill = day.mark == WeekDayMark.done ? _fillFor(order++) : null;
      Widget column = _StudyDayColumn(day: day, index: i, bubble: bubble, showDate: dates, roomy: full, fill: fill, selected: widget.selected == i);
      final onDay = widget.onDay;
      if (onDay != null) {
        final inner = column;
        column = MmPressable(
          onTap: () => onDay(i),
          button: false,
          highlight: true,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          builder: (context, pressed, focused) => inner,
        );
        column = Semantics(
          container: true,
          button: true,
          selected: widget.selected == i,
          onTap: () => onDay(i),
          label: StudyWeekWords.day(day, i),
          excludeSemantics: true,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: MmSpace.s48),
            child: column,
          ),
        );
      }
      columns.add(Expanded(child: column));
    }
    final row = Row(crossAxisAlignment: CrossAxisAlignment.start, children: columns);

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (ring) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              StudyWeekRing(done: _ringDone, goal: _ringGoal, size: widget.ringSize, paused: widget.paused, fills: _ringFills()),
              if (widget.headline != null || widget.caption != null) ...[
                const SizedBox(width: MmSpace.s16),
                Expanded(
                  child: ExcludeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (widget.headline != null) Text(widget.headline!, style: type.title),
                        if (widget.headline != null && widget.caption != null) const SizedBox(height: MmSpace.s4),
                        if (widget.caption != null)
                          Text(
                            widget.caption!,
                            style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: colors.ink2),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          SizedBox(height: 1, child: ColoredBox(color: colors.line)),
          const SizedBox(height: MmSpace.s4),
        ],
        row,
        if (widget.legend != StudyWeekLegendMode.never)
          // Built only while it is on its way in, up or on its way out: a folded key is no widget.
          AnimatedBuilder(
            animation: _legendCtl,
            builder: (context, _) => _legendCtl.isDismissed
                ? const SizedBox.shrink()
                : SizeTransition(
                    sizeFactor: _legendCurve,
                    alignment: Alignment.topCenter,
                    child: FadeTransition(
                      opacity: _legendCurve,
                      child: Padding(
                        padding: const EdgeInsets.only(top: MmSpace.s8),
                        child: StudyWeekKey(days: widget.days),
                      ),
                    ),
                  ),
          ),
      ],
    );

    const showKeyAction = CustomSemanticsAction(label: 'Show what the marks mean');
    final auto = widget.legend == StudyWeekLegendMode.auto;
    Widget result = body;
    if (auto) {
      result = GestureDetector(behavior: HitTestBehavior.translucent, onLongPress: _showLegend, child: result);
    }
    if (!perDay) {
      result = Semantics(
        container: true,
        label: _label,
        excludeSemantics: true,
        customSemanticsActions: auto ? {showKeyAction: _showLegend} : null,
        child: result,
      );
    } else if (auto) {
      result = Semantics(customSemanticsActions: {showKeyAction: _showLegend}, child: result);
    }
    return result;
  }
}

class _StudyDayColumn extends StatelessWidget {
  const _StudyDayColumn({
    required this.day,
    required this.index,
    required this.bubble,
    required this.showDate,
    required this.roomy,
    required this.fill,
    required this.selected,
  });

  final WeekBubbleDay day;
  final int index;
  final double bubble;
  final bool showDate;
  final bool roomy;
  final Animation<double>? fill;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final today = day.isToday;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final letterStyle = type.caption.copyWith(
      fontSize: 12,
      height: 16 / 12,
      fontWeight: today || selected ? FontWeight.w700 : FontWeight.w500,
      color: today || selected ? colors.ink : (day.mark == WeekDayMark.rest ? colors.ink3 : colors.ink2),
      letterSpacing: 0.4,
    );
    // The box is a little larger than the bubble so today's ring is inside it.
    final box = bubble + 12;
    final column = Padding(
      padding: EdgeInsets.symmetric(vertical: roomy ? MmSpace.s8 : MmSpace.s4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(weekdayInitials[index], style: letterStyle, textScaler: scaler),
          const SizedBox(height: MmSpace.s6),
          RepaintBoundary(
            child: SizedBox.square(
              dimension: box,
              child: CustomPaint(
                painter: StudyWeekDotPainter(colors: colors, mark: day.mark, today: today, fill: fill),
              ),
            ),
          ),
          if (showDate && day.date != null) ...[
            const SizedBox(height: MmSpace.s2),
            Text(
              '${day.date}',
              style: type.caption.copyWith(fontSize: 12, height: 16 / 12, color: today || selected ? colors.ink : colors.ink3),
              textScaler: scaler,
            ),
          ],
        ],
      ),
    );
    if (!selected) return column;
    return DecoratedBox(
      // The chosen column is a well in both themes (Night a lifted dark well, Day the sunken cream).
      decoration: BoxDecoration(color: colors.isNight ? colors.raised2.withValues(alpha: 0.7) : colors.sunken, borderRadius: MmRadius.smallAll),
      child: column,
    );
  }
}
