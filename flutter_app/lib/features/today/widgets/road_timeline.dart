// The road to May drawn to scale (ui-blitz/today.md 2.4): a track from the start of this month to
// the month after the last stop. The stretch already travelled this month is inked up to Now;
// ahead, the groove carries one small tick per week, so the weeks are countable. The
// registration window and the boards ride as named lanes above the track, the expected CUET
// window is the one volt block at its end, flagged with its name, and a bracket spans Now to the
// next stop with how long that is. Under it, the stops as a vertical timeline: each with its
// mark, its real dates, its note and how far it is, the next one ahead marked "Next". Every
// mark is a date; nothing here predicts marks or chances.
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show ValueListenable, visibleForTesting;
import 'package:flutter/material.dart';

import '../../../core/art/art.dart' show SubjectEmblem;
import '../../../core/copy/formatters.dart' show formatDayMonthShort;
import '../../../core/copy/sentences.dart';
import '../../../core/haptics/haptics.dart' show hapticsOf;
import '../../../core/mascot/mascot.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/mobi_presence.dart';
import '../logic/today_model.dart';
import 'today_entrance.dart';
import 'today_reveal.dart';
import 'today_type.dart';

class RoadTimeline extends StatefulWidget {
  const RoadTimeline({super.key, required this.today, required this.stops, required this.end});

  final DateTime today;
  final List<RoadStop> stops;

  /// The right edge, derived from the last stop (the road model's `end`).
  final DateTime end;

  /// The canvas at 1x text; larger text adds to it (see [heightFor]).
  static const double height = 160;

  /// The canvas height at the text scale: three rows of labels share it.
  static double heightFor(TextScaler scaler) => height + (scaler.scale(12) - 12) * 3;

  /// Mobi's height on the road, in dp.
  static const double walkerSize = 30;

  /// Above this text scale Mobi stays off the road: the labels need the room.
  static const double walkerMaxTextScale = 1.3;

  static bool _walked = false;

  /// Lets a test see the once-per-run walk again.
  @visibleForTesting
  static void debugResetWalker() => _walked = false;

  @override
  State<RoadTimeline> createState() => _RoadTimelineState();
}

class _RoadTimelineState extends State<RoadTimeline> with TickerProviderStateMixin {
  /// The long-press scrub across the road: where the finger is, and the day it snaps to.
  final ValueNotifier<MmScrubValue?> _scrub = ValueNotifier(null);

  /// The scrub readout's presence: it comes up in 140 ms and eases away in 320 ms on release.
  late final AnimationController _scrubPresence =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 140), reverseDuration: const Duration(milliseconds: 320));

  /// Mobi's caption (the real next stop) for 2 s: 180 ms in, a 1640 ms hold, 180 ms out (AP1-16).
  late final AnimationController _caption = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000));
  final ValueNotifier<String?> _captionText = ValueNotifier(null);

  final MobiController _mobi = MobiController();
  final GlobalKey _canvas = GlobalKey(debugLabel: 'road-canvas');
  RoadFrame? _frame;

  /// Decided once, when Mobi first has room: walk in (the first time this app run) or just stand.
  bool _decided = false;
  bool _walkIn = false;
  bool _arrived = false;

  @override
  void initState() {
    super.initState();
    _caption.addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted) {
        _captionText.value = null;
        _mobi.play(MobiAct.idle);
      }
    });
  }

  @override
  void dispose() {
    _scrub.dispose();
    _scrubPresence.dispose();
    _caption.dispose();
    _captionText.dispose();
    _mobi.dispose();
    super.dispose();
  }

  void _onIndex(int day) {
    // A tick where the finger lands on the edge of a stop (or Now): the date snaps there.
    if (_frame?.edges.contains(day) ?? false) hapticsOf(context)?.selection();
  }

  /// A tap on Mobi: he points at the next stop and says what it is and how far, from the real
  /// calendar. With nothing ahead he waves.
  void _onWalker() {
    final frame = _frame;
    if (frame == null) return;
    hapticsOf(context)?.selection();
    final i = roadNextIndex(widget.stops, widget.today);
    if (i < 0) {
      _mobi.react(MobiAct.wave);
      return;
    }
    final next = widget.stops[i];
    final box = _canvas.currentContext?.findRenderObject();
    if (box is RenderBox && box.hasSize) {
      _mobi.pointAt(box.localToGlobal(Offset(frame.x(next.start), _RoadPainter._trackY)));
    }
    _captionText.value = '${next.title}, ${roadDistance(next, widget.today)}';
    _caption.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) => TodayReveal(child: Builder(builder: _drawn));

  Widget _drawn(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final draw = todayEnterValue(context, delay: const Duration(milliseconds: 80), length: Motion.drawIn);
    final reveal = TodayEntranceScope.of(context) ?? kAlwaysCompleteAnimation;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final rawScale = MediaQuery.textScalerOf(context).scale(12) / 12;
    final reduced = Motion.reduced(context);
    final small = type.micro.copyWith(height: 1, fontWeight: FontWeight.w600, color: colors.ink3);
    final lane = small.copyWith(color: colors.ink2);
    final exam = small.copyWith(fontWeight: FontWeight.w700, color: colors.isNight ? colors.volt : colors.accentText);
    final now = small.copyWith(fontWeight: FontWeight.w700, color: colors.ink);
    final stretch = type.microStrong.copyWith(height: 1, color: colors.ink);
    return Semantics(
      label: 'Timeline from ${TodayCopy.nowLabel.toLowerCase()} to ${_monthName(widget.end.subtract(const Duration(days: 1)))}',
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, box) {
          final width = box.maxWidth;
          RoadFrame measure(double clear) => RoadFrame.measure(
                width: width,
                today: widget.today,
                stops: widget.stops,
                end: widget.end,
                scaler: scaler,
                lane: lane,
                exam: exam,
                now: now,
                stretch: stretch,
                pillClear: clear,
              );
          // Mobi stands on the Now tick only where he covers no label, no bar and not the bracket's
          // pill: the pill first makes room for him (it keeps to his right) and, when it cannot,
          // he is not there. He walks only where the app's ambient motion is on (the same gate as
          // the subject objects), and never at large text.
          final walkerOk = rawScale <= RoadTimeline.walkerMaxTextScale && SubjectEmblem.idleEnabled;
          final clear = MobiFigure.widthFor(RoadTimeline.walkerSize) / 2 + 5;
          var frame = measure(walkerOk ? clear : 0);
          final slot = walkerOk ? frame.walkerRect(RoadTimeline.walkerSize) : null;
          if (walkerOk && slot == null) frame = measure(0);
          _frame = frame;
          final canvas = RepaintBoundary(
            child: CustomPaint(
              key: _canvas,
              size: Size(double.infinity, RoadTimeline.heightFor(scaler)),
              painter: _RoadPainter(
                today: widget.today,
                stops: widget.stops,
                end: widget.end,
                colors: colors,
                draw: draw,
                scaler: scaler,
                label: small,
                lane: lane,
                exam: exam,
                now: now,
                stretch: stretch,
                scrub: _scrub,
                scrubPresence: _scrubPresence,
                caption: _captionText,
                captionPresence: _caption,
                captionLeft: frame.nowX + clear,
                pillClear: slot == null ? 0 : clear,
                reduced: reduced,
              ),
            ),
          );
          return SizedBox(
            height: RoadTimeline.heightFor(scaler),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  // Press and hold, then slide, to read any day on the road.
                  child: MmScrub(
                    count: frame.days + 1,
                    value: _scrub,
                    haptic: false,
                    indexFor: frame.dayAt,
                    onStart: _scrubPresence.forward,
                    onIndex: _onIndex,
                    onEnd: _scrubPresence.reverse,
                    child: canvas,
                  ),
                ),
                // He sets off once the road starts to draw, so the walk is seen, not spent below the fold.
                if (slot != null) _walker(slot, reveal, reduced),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Decided once, the first time he is actually shown: walk in (the first time this app run) or
  /// just stand.
  void _decide(bool reduced) {
    if (_decided) return;
    _decided = true;
    _walkIn = !RoadTimeline._walked && !reduced;
    RoadTimeline._walked = true;
    if (!_walkIn) _arrived = true;
  }

  /// One Mobi per screen: while the header's Mobi is in view the walker is not built; once he has
  /// been built he only steps out of sight (kept, so his walk is never replayed) when the header's
  /// Mobi comes back into view.
  Widget _walker(Rect slot, Animation<double> reveal, bool reduced) {
    return ValueListenableBuilder<bool>(
      valueListenable: TodayMobiPresence.headerVisible,
      builder: (context, headerOn, _) {
        if (!_decided && headerOn) return const Positioned(left: 0, top: 0, width: 0, height: 0, child: SizedBox.shrink());
        _decide(reduced);
        return Positioned(
          left: 0,
          top: slot.top,
          right: 0,
          height: RoadTimeline.walkerSize,
          child: Visibility(
            visible: !headerOn,
            maintainState: true,
            child: _walkerBody(slot, reveal),
          ),
        );
      },
    );
  }

  Widget _walkerBody(Rect slot, Animation<double> reveal) {
    const size = RoadTimeline.walkerSize;
    final Widget mobi = _walkIn
        ? MobiWalker(
            size: size,
            fromX: math.min(slot.left - 90, -slot.width),
            toX: slot.left,
            // 1100 ms (from 1700): the walk is a beat, not a scene (AP1-16, MOTION.md T2 cap).
            duration: const Duration(milliseconds: 1100),
            controller: _mobi,
            seed: 31,
            onArrive: (c) {
              if (mounted) setState(() => _arrived = true);
              c.react(MobiMoments.act(MobiEvent.arrive));
            },
          )
        : Transform.translate(
            offset: Offset(slot.left, 0),
            child: Align(alignment: Alignment.topLeft, child: MobiCharacter(controller: _mobi, size: size, entrance: MobiAct.idle, watchTaps: false, seed: 31)),
          );
    // Held back until the road starts to draw (the gate stays inside the Positioned: a bare
    // placeholder beside it would be a non-positioned child and size the Stack to nothing).
    return _WalkGate(
      progress: reveal,
      child: ValueListenableBuilder<MmScrubValue?>(
        valueListenable: _scrub,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            IgnorePointer(child: mobi),
            // Only once he has arrived does a tap on him mean anything.
            if (_arrived)
              Positioned(
                left: slot.left - 6,
                top: -6,
                width: slot.width + 12,
                height: size + 12,
                child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: _onWalker, child: const SizedBox.expand()),
              ),
          ],
        ),
        builder: (context, scrub, child) => AnimatedOpacity(opacity: scrub == null ? 1 : 0, duration: const Duration(milliseconds: 140), child: child),
      ),
    );
  }
}

/// Holds its child (Mobi on the road) back until the road's own reveal has begun to draw: a
/// walk that played while the road was still below the fold would be over before it was seen.
/// Once shown it stays (the child is the same widget, so its walk is never restarted).
class _WalkGate extends StatelessWidget {
  const _WalkGate({required this.progress, required this.child});

  final Animation<double> progress;
  final Widget child;

  /// How far into the reveal (0 to 1) he sets off.
  static const double startAt = 0.2;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: progress,
        child: child,
        builder: (context, child) => progress.value >= startAt ? child! : const SizedBox.shrink(),
      );
}

/// The road's geometry at one width: where Now stands, the days the finger can read, and what
/// Mobi must not cover. Pure measurements of the same layout [_RoadPainter] draws.
@visibleForTesting
class RoadFrame {
  RoadFrame._({
    required this.width,
    required this.today,
    required this.start,
    required this.days,
    required this.edges,
    required this.obstacles,
  });

  final double width;
  final DateTime today;

  /// The first day of the road (the first of this month).
  final DateTime start;

  /// Whole days from [start] to the right edge.
  final int days;

  /// The day indices where a stop begins or ends, and Now: a scrub snaps to these.
  final Set<int> edges;

  /// Everything Mobi must not stand on: the lane and flag names, the lane bars, the bracket pill.
  final List<Rect> obstacles;

  static const double inset = 6;

  /// How close to an edge (dp) the finger's date snaps to it.
  static const double snapReach = 5;

  double get _w => width - inset * 2;

  /// The x of a date on the road.
  double x(DateTime d) => inset + _w * (d.difference(start).inDays / days).clamp(0.0, 1.0);

  double get nowX => x(today);

  /// The day (counted from [start]) under a finger at [fingerX] in a box [boxWidth] wide, snapped
  /// to a stop's edge when the finger is within [snapReach] of one.
  int dayAt(double fingerX, double boxWidth) {
    final w = boxWidth - inset * 2;
    if (w <= 0 || days <= 0) return 0;
    var day = (((fingerX - inset) / w).clamp(0.0, 1.0) * days).round();
    for (final e in edges) {
      if ((inset + w * e / days - fingerX).abs() <= snapReach) {
        day = e;
        break;
      }
    }
    return day;
  }

  /// Where the bracket's pill is centred: midway between Now and the next stop, kept inside the
  /// road, and, when Mobi stands on Now ([clear] is half his width and some air), to the right of
  /// him as long as the pill still fits before the next stop. The painter and [measure] both ask
  /// here, so what Mobi avoids is exactly what is drawn.
  static double bracketCentre({required double now, required double to, required double words, required double width, double clear = 0}) {
    double within(double lo) => ((now + to) / 2).clamp(lo, math.max(lo, width - words / 2 - 2)).toDouble();
    final plain = within(now + 8 + words / 2);
    if (clear <= 0) return plain;
    // The pill's own width is the words and 7 dp of padding each side.
    final roomy = within(now + clear + 7 + words / 2);
    return to - (now + clear) >= words + 14 ? roomy : plain;
  }

  /// Mobi's box standing on the Now tick, or null where it would cover a label, a lane bar or the
  /// bracket's pill, or leave the road.
  Rect? walkerRect(double size) {
    final w = MobiFigure.widthFor(size);
    final r = Rect.fromLTWH(nowX - w / 2, _RoadPainter._trackY - 11 - size, w, size);
    if (r.left < 0 || r.right > width) return null;
    for (final o in obstacles) {
      if (o.inflate(3).overlaps(r)) return null;
    }
    return r;
  }

  static RoadFrame measure({
    required double width,
    required DateTime today,
    required List<RoadStop> stops,
    required DateTime end,
    required TextScaler scaler,
    required TextStyle lane,
    required TextStyle exam,
    required TextStyle now,
    required TextStyle stretch,
    double pillClear = 0,
  }) {
    final start = DateTime.utc(today.year, today.month);
    final days = math.max(1, end.difference(start).inDays);
    final w = width - inset * 2;
    double x(DateTime d) => inset + w * (d.difference(start).inDays / days).clamp(0.0, 1.0);
    TextPainter tp(String text, TextStyle style) =>
        TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
    final obstacles = <Rect>[];
    void add(TextPainter p, Offset topLeft) {
      obstacles.add(topLeft & p.size);
      p.dispose();
    }

    final n = x(today);
    final nowWords = tp('${TodayCopy.nowLabel}, ${formatDayMonthShort(today)}', now);
    add(nowWords, Offset(n < 48 ? n - 4 : n - nowWords.width / 2, _RoadPainter._flagY - nowWords.height / 2));
    var row = 0;
    for (final s in stops) {
      final a = x(s.start);
      final b = s.end == null ? a + 4 : x(s.end!);
      switch (s.kind) {
        case RoadStopKind.registration || RoadStopKind.boards:
          final y = _RoadPainter._laneTop + row * _RoadPainter._laneStep;
          row++;
          obstacles.add(Rect.fromLTRB(a, y + 9, b, y + 9 + _RoadPainter._bar));
          final name = tp(s.kind == RoadStopKind.registration ? TodayCopy.laneRegistration : TodayCopy.laneBoards, lane);
          add(name, Offset(a + name.width > width ? width - name.width : a, y - name.height / 2));
        case RoadStopKind.exam:
          final name = tp(TodayCopy.laneExam, exam);
          final nx = (b - name.width).clamp(0.0, math.max(0.0, width - name.width)).toDouble();
          add(name, Offset(nx, _RoadPainter._laneTop - name.height / 2));
      }
    }
    final next = roadNextIndex(stops, today);
    if (next >= 0) {
      final to = x(stops[next].start);
      if (to - n > 12) {
        final words = tp(TodayCopy.stretchTo(stops[next].start.difference(today).inDays), stretch);
        final cx = bracketCentre(now: n, to: to, words: words.width, width: width, clear: pillClear);
        obstacles.add(Rect.fromCenter(center: Offset(cx, _RoadPainter._bracketY), width: words.width + 14, height: words.height + 8));
        words.dispose();
      }
    }
    final edges = <int>{
      today.difference(start).inDays,
      for (final s in stops) ...[s.start.difference(start).inDays, if (s.end != null) s.end!.difference(start).inDays],
    }..removeWhere((e) => e < 0 || e > days);
    return RoadFrame._(width: width, today: today, start: start, days: days, edges: edges, obstacles: obstacles);
  }
}


const List<String> _monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];

String _monthName(DateTime d) => '${_monthNames[d.month - 1]} ${d.year}';

/// The colour a stop is drawn in, shared by the track and the list so they read as one key.
Color roadStopColor(RoadStopKind kind, MmColors c) => switch (kind) {
      RoadStopKind.registration => c.ink3,
      RoadStopKind.boards => c.ink2,
      RoadStopKind.exam => c.isNight ? c.volt : c.accentText,
    };

/// The first stop that starts after [today], or -1.
int roadNextIndex(List<RoadStop> stops, DateTime today) => stops.indexWhere((s) => s.start.isAfter(today));

/// The road, top to bottom: the Now flag; the registration and boards lanes, each named where it
/// starts (the exam named at the right of the first lane and flagged down to its block); the
/// stretch from Now to the next stop as a bracket with how long it is; the track, with the
/// travelled ink, the weekly ticks, the Now disc and the volt exam window; then the months.
class _RoadPainter extends CustomPainter {
  _RoadPainter({
    required this.today,
    required this.stops,
    required this.end,
    required this.colors,
    required this.draw,
    required this.scaler,
    required this.label,
    required this.lane,
    required this.exam,
    required this.now,
    required this.stretch,
    required this.scrub,
    required this.scrubPresence,
    required this.caption,
    required this.captionPresence,
    required this.captionLeft,
    required this.pillClear,
    required this.reduced,
  }) : super(repaint: Listenable.merge([draw, scrub, scrubPresence, captionPresence]));

  final DateTime today;
  final List<RoadStop> stops;
  final DateTime end;
  final MmColors colors;
  final Animation<double> draw;
  final TextScaler scaler;
  final TextStyle label;
  final TextStyle lane;
  final TextStyle exam;
  final TextStyle now;
  final TextStyle stretch;

  /// The long-press scrub (null when not scrubbing) and how present its readout is (0 to 1).
  final ValueListenable<MmScrubValue?> scrub;
  final Animation<double> scrubPresence;

  /// Mobi's caption, its presence over its 2.8 s, and the x its pill starts at: just right of
  /// him, so he never stands over his own words.
  final ValueListenable<String?> caption;
  final Animation<double> captionPresence;
  final double captionLeft;

  /// Half Mobi's width and some air when he stands on Now, else 0: the bracket's pill keeps to
  /// the right of this (see [RoadFrame.bracketCentre]).
  final double pillClear;
  final bool reduced;

  /// The day the scrub last read, kept so the readout can ease away after the finger lifts.
  int _lastDay = 0;

  // Rows from the top, at 1x text: the Now flag, two lanes, the bracket, the track, the months.
  // Labels are centred on their rows; larger text only adds room at the foot (see heightFor).
  static const double _flagY = 8;
  static const double _laneTop = 32;
  static const double _laneStep = 30;
  static const double _bar = 8;
  static const double _bracketY = 102;
  static const double _trackY = 128;
  static const double _track = 15;
  static const double _monthY = 154;

  // Text is laid out once per painter (its data and theme are fixed for its life); only the
  // draw-in progress repaints.
  final Map<String, TextPainter> _texts = {};

  TextPainter _tp(String text, TextStyle style) => _texts.putIfAbsent(
        '${identityHashCode(style)}|$text',
        () => TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout(),
      );

  @override
  void paint(Canvas canvas, Size size) {
    final start = DateTime.utc(today.year, today.month);
    final span = end.difference(start).inDays.toDouble();
    const inset = 6.0;
    final w = size.width - inset * 2;
    double x(DateTime d) => inset + w * (d.difference(start).inDays / span).clamp(0.0, 1.0);
    final t = draw.value;
    // The scrub readout and Mobi's caption take the bracket's row while they are up.
    final live = math.max(scrubPresence.value, _captionShow).clamp(0.0, 1.0);
    final track = RRect.fromRectAndRadius(
      Rect.fromLTRB(inset, _trackY - _track / 2, size.width - inset, _trackY + _track / 2),
      const Radius.circular(_track / 2),
    );

    // The groove.
    canvas.drawRRect(track, Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.07 : 0.06));
    canvas.drawRRect(
      track.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.line,
    );

    final n = x(today);
    final nextIndex = roadNextIndex(stops, today);

    // The stretch to the next stop is lit a little in the groove, so the eye goes there.
    if (nextIndex >= 0) {
      final to = x(stops[nextIndex].start);
      if (to - n > 12) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTRB(n, _trackY - _track / 2, n + (to - n) * t, _trackY + _track / 2), const Radius.circular(_track / 2)),
          Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.09 : 0.08),
        );
      }
    }

    // One tick a week from Now to the window, inside the groove: the weeks, countable.
    final windowStart = stops.where((s) => s.kind == RoadStopKind.exam).firstOrNull?.start;
    if (windowStart != null) {
      final tick = Paint()
        ..color = colors.ink.withValues(alpha: colors.isNight ? 0.3 : 0.28)
        ..strokeWidth = 1;
      for (var d = today.add(const Duration(days: 7)); d.isBefore(windowStart); d = d.add(const Duration(days: 7))) {
        final tx = x(d);
        canvas.drawLine(Offset(tx, _trackY - 3.5), Offset(tx, _trackY + 3.5), tick);
      }
    }

    // The months: a hairline and a short name for each.
    final hair = Paint()..color = colors.line;
    for (var m = start; m.isBefore(end); m = DateTime.utc(m.year, m.month + 1)) {
      final next = DateTime.utc(m.year, m.month + 1);
      if (m != start) canvas.drawRect(Rect.fromLTWH(x(m) - 0.5, _trackY + _track / 2 + 3, 1, 5), hair);
      _text(canvas, _monthShort(m.month), label, Offset((x(m) + x(next)) / 2, _monthY));
    }

    // The lanes above the track, each named where it starts; the exam window on the track.
    var row = 0;
    for (final s in stops) {
      final color = roadStopColor(s.kind, colors);
      final a = x(s.start);
      final b = s.end == null ? a + 4 : x(s.end!);
      switch (s.kind) {
        case RoadStopKind.registration || RoadStopKind.boards:
          final y = _laneTop + row * _laneStep;
          row++;
          final bar = RRect.fromRectAndRadius(Rect.fromLTRB(a, y + 9, b, y + 9 + _bar), const Radius.circular(_bar / 2));
          if (s.kind == RoadStopKind.registration) {
            canvas.drawRRect(bar, Paint()..color = color.withValues(alpha: 0.2));
            canvas.drawRRect(
              bar,
              Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 1
                ..color = color.withValues(alpha: 0.85),
            );
          } else {
            canvas.drawRRect(bar, Paint()..color = color.withValues(alpha: 0.6));
          }
          final name = _tp(s.kind == RoadStopKind.registration ? TodayCopy.laneRegistration : TodayCopy.laneBoards, lane);
          final lx = a + name.width > size.width ? size.width - name.width : a;
          name.paint(canvas, Offset(lx, y - name.height / 2));
        case RoadStopKind.exam:
          final block = RRect.fromRectAndRadius(Rect.fromLTRB(a, _trackY - 10, b, _trackY + 10), const Radius.circular(10));
          // The flag: the exam's name at the right of the first lane, and its own hairline down
          // from the middle of that name to the block (never a line the name does not stand on).
          final name = _tp(TodayCopy.laneExam, exam);
          final nx = (b - name.width).clamp(0.0, math.max(0.0, size.width - name.width)).toDouble();
          name.paint(canvas, Offset(nx, _laneTop - name.height / 2));
          final fx = (nx + name.width / 2).clamp(a + 3, b - 3);
          canvas.drawRect(Rect.fromLTWH(fx - 0.5, _laneTop + 9, 1, _trackY - 10 - _laneTop - 11), Paint()..color = color.withValues(alpha: 0.45));
          // One fill rule in both themes: the window is a tinted block with a thin edge; only the
          // part that has gone by is solid, so with the window open the fill stops at Now.
          final open = !today.isBefore(s.start) && n > a;
          if (open) {
            canvas.drawRRect(block, Paint()..color = color.withValues(alpha: 0.22));
            canvas.drawRRect(
              block.deflate(0.5),
              Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 1
                ..color = color.withValues(alpha: 0.7),
            );
            final gone = a + (math.min(n, b) - a) * t;
            if (gone > a + 1) {
              canvas.save();
              canvas.clipRRect(block);
              canvas.drawRect(Rect.fromLTRB(a, _trackY - 10, gone, _trackY + 10), Paint()..color = color);
              canvas.restore();
            }
          } else {
            canvas.drawRRect(block, Paint()..color = color);
          }
      }
    }

    // The bracket from Now to the next stop, with how long that stretch is.
    if (nextIndex >= 0) {
      final next = stops[nextIndex];
      final to = x(next.start);
      if (to - n > 12) {
        final reach = n + (to - n) * t;
        final ink = Paint()
          ..color = colors.ink.withValues(alpha: 0.5 * (1 - 0.85 * live))
          ..strokeWidth = 1.2
          ..strokeCap = StrokeCap.round;
        canvas.drawLine(Offset(n + 1, _bracketY), Offset(reach, _bracketY), ink);
        canvas.drawLine(Offset(reach, _bracketY - 4), Offset(reach, _bracketY + 4), ink);
        final words = _tp(TodayCopy.stretchTo(next.start.difference(today).inDays), stretch);
        final cx = RoadFrame.bracketCentre(now: n, to: to, words: words.width, width: size.width, clear: pillClear);
        final o = ((t - 0.55) / 0.45).clamp(0.0, 1.0) * (1 - live);
        if (o > 0.01) {
          final pill = Rect.fromCenter(center: Offset(cx, _bracketY), width: words.width + 14, height: words.height + 8);
          canvas.saveLayer(pill.inflate(1), Paint()..color = Color.fromRGBO(0, 0, 0, o));
          canvas.drawRRect(RRect.fromRectAndRadius(pill, const Radius.circular(10)), Paint()..color = colors.ground);
          canvas.drawRRect(
            RRect.fromRectAndRadius(pill.deflate(0.5), const Radius.circular(10)),
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1
              ..color = colors.lineStrong,
          );
          words.paint(canvas, Offset(cx - words.width / 2, _bracketY - words.height / 2));
          canvas.restore();
        }
      }
    }

    // Travelled: ink from the start of the month up to Now, drawn in on open. With the window
    // open, the stretch inside it is the window's own solid fill, so the ink stops where it starts.
    final inkEnd = windowStart != null && !today.isBefore(windowStart) ? math.min(n, x(windowStart)) : n;
    final reached = inset + (inkEnd - inset) * t;
    if (reached > inset + 1) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTRB(inset, _trackY - _track / 2, reached, _trackY + _track / 2), const Radius.circular(_track / 2)),
        Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.7 : 0.62),
      );
    }

    // Now: a paper-white disc with a soft halo, pinned by a hairline to its flag above.
    canvas.drawRect(Rect.fromLTWH(n - 0.5, _flagY + 8, 1, _trackY - _flagY - 8 - 9), Paint()..color = colors.ink.withValues(alpha: 0.45));
    canvas.drawCircle(Offset(n, _trackY), 16, Paint()..color = colors.ink.withValues(alpha: 0.1 * t));
    canvas.drawCircle(Offset(n, _trackY), 9, Paint()..color = colors.ink);
    canvas.drawCircle(
      Offset(n, _trackY),
      9,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = colors.ground,
    );
    _text(canvas, '${TodayCopy.nowLabel}, ${formatDayMonthShort(today)}', now, Offset(n, _flagY), alignLeft: n < 48);
    _readout(canvas, size, x, start);
  }

  /// Mobi's caption, shown 0 to 1: it eases in, holds and eases out over its 2 s.
  double get _captionShow {
    final t = captionPresence.value;
    if (t <= 0 || t >= 1 || caption.value == null) return 0;
    if (reduced) return 1;
    const edge = 180 / 2000;
    return Motion.emphasized.transform(math.min(t / edge, (1 - t) / edge).clamp(0.0, 1.0));
  }

  /// The names of the stops a date falls inside ("Registration, Boards"), or null between them.
  String? _lanesAt(DateTime date) {
    final names = <String>[
      for (final s in stops)
        if (!date.isBefore(s.start) && !date.isAfter(s.end ?? s.start))
          switch (s.kind) {
            RoadStopKind.registration => TodayCopy.laneRegistration,
            RoadStopKind.boards => TodayCopy.laneBoards,
            RoadStopKind.exam => TodayCopy.laneExam,
          },
    ];
    return names.isEmpty ? null : names.join(', ');
  }

  /// The scrub's hairline and its readout ("3 Dec, 49 days from now" over the lane's name), and
  /// Mobi's caption, in the bracket's row. The readout eases away after the finger lifts.
  void _readout(Canvas canvas, Size size, double Function(DateTime) x, DateTime start) {
    final v = scrub.value;
    if (v != null) _lastDay = v.index;
    final p = scrubPresence.value;
    if (p > 0.01) {
      final a = Curves.easeOut.transform(p.clamp(0.0, 1.0));
      final date = start.add(Duration(days: _lastDay));
      final fx = x(date);
      _hairline(
        canvas,
        fx,
        _flagY + 14,
        _trackY + _track / 2 + 4,
        Paint()
          ..color = colors.ink.withValues(alpha: 0.65 * a)
          ..strokeWidth = 1,
        _labelRects(size, x),
      );
      canvas.drawCircle(Offset(fx, _trackY), 4.5, Paint()..color = colors.ground.withValues(alpha: a));
      canvas.drawCircle(
        Offset(fx, _trackY),
        4.5,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = colors.ink.withValues(alpha: a),
      );
      final away = date.difference(DateTime.utc(today.year, today.month, today.day)).inDays;
      final lanes = _lanesAt(date);
      _pill(canvas, size, fx, ['${formatDayMonthShort(date)}, ${TodayCopy.scrubDistance(away)}', ?lanes], a);
    }
    final text = caption.value;
    final shown = _captionShow;
    if (text != null && shown > 0.01 && p <= 0.01) _pill(canvas, size, captionLeft, [text], shown, fromLeft: true);
  }

  /// Where the names written above the track stand (the lanes and the exam flag), as painted.
  List<Rect> _labelRects(Size size, double Function(DateTime) x) {
    final rects = <Rect>[];
    var row = 0;
    for (final s in stops) {
      final a = x(s.start);
      final b = s.end == null ? a + 4 : x(s.end!);
      switch (s.kind) {
        case RoadStopKind.registration || RoadStopKind.boards:
          final y = _laneTop + row * _laneStep;
          row++;
          final name = _tp(s.kind == RoadStopKind.registration ? TodayCopy.laneRegistration : TodayCopy.laneBoards, lane);
          final lx = a + name.width > size.width ? size.width - name.width : a;
          rects.add(Rect.fromLTWH(lx, y - name.height / 2, name.width, name.height));
        case RoadStopKind.exam:
          final name = _tp(TodayCopy.laneExam, exam);
          final nx = (b - name.width).clamp(0.0, math.max(0.0, size.width - name.width)).toDouble();
          rects.add(Rect.fromLTWH(nx, _laneTop - name.height / 2, name.width, name.height));
      }
    }
    return rects;
  }

  /// A vertical hairline at [x] from [y0] to [y1] that goes round any of [avoid] it would cross,
  /// so a name on the road is never struck through.
  void _hairline(Canvas canvas, double x, double y0, double y1, Paint paint, List<Rect> avoid) {
    final cuts = [
      for (final r in avoid)
        if (x >= r.left - 3 && x <= r.right + 3) r,
    ]..sort((a, b) => a.top.compareTo(b.top));
    var from = y0;
    for (final r in cuts) {
      final to = r.top - 2;
      if (to > from) canvas.drawLine(Offset(x, from), Offset(x, to), paint);
      from = math.max(from, r.bottom + 2);
    }
    if (y1 > from) canvas.drawLine(Offset(x, from), Offset(x, y1), paint);
  }

  /// A pill of one or two lines in the bracket's row, [alpha] of the way shown. [at] is its
  /// centre, or its left edge with [fromLeft].
  void _pill(Canvas canvas, Size size, double at, List<String> lines, double alpha, {bool fromLeft = false}) {
    if (alpha <= 0.01) return;
    final words = <TextPainter>[
      for (var i = 0; i < lines.length; i++)
        TextPainter(
          text: TextSpan(text: lines[i], style: i == 0 ? stretch : lane),
          textDirection: TextDirection.ltr,
          textScaler: scaler,
          maxLines: 1,
          ellipsis: '\u2026',
        )..layout(maxWidth: math.max(40, size.width - 24)),
    ];
    var tw = 0.0, th = 0.0;
    for (final p in words) {
      tw = math.max(tw, p.width);
      th += p.height;
    }
    final w = tw + 16, h = th + 8 + (words.length - 1) * 2;
    final x = (fromLeft ? at + w / 2 : at).clamp(w / 2 + 2, math.max(w / 2 + 2, size.width - w / 2 - 2)).toDouble();
    final pill = Rect.fromCenter(center: Offset(x, _bracketY - (words.length > 1 ? 2 : 0)), width: w, height: h);
    final radius = Radius.circular(math.min(12, h / 2));
    canvas.saveLayer(pill.inflate(2), Paint()..color = Color.fromRGBO(0, 0, 0, alpha.clamp(0.0, 1.0)));
    canvas.drawRRect(RRect.fromRectAndRadius(pill, radius), Paint()..color = colors.ground);
    canvas.drawRRect(
      RRect.fromRectAndRadius(pill.deflate(0.5), radius),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.lineStrong,
    );
    var y = pill.top + 4;
    for (final p in words) {
      p.paint(canvas, Offset(x - p.width / 2, y));
      y += p.height + 2;
      p.dispose();
    }
    canvas.restore();
  }

  static String _monthShort(int month) => _monthNames[month - 1].substring(0, 3);

  void _text(Canvas canvas, String text, TextStyle style, Offset center, {bool alignLeft = false}) {
    final tp = _tp(text, style);
    final dx = alignLeft ? center.dx - 4 : center.dx - tp.width / 2;
    tp.paint(canvas, Offset(dx, center.dy - tp.height / 2));
  }

  @override
  bool shouldRepaint(_RoadPainter old) =>
      old.today != today ||
      old.end != end ||
      old.colors != colors ||
      old.stops != stops ||
      old.draw != draw ||
      old.scaler != scaler ||
      old.pillClear != pillClear ||
      old.captionLeft != captionLeft;
}

/// How far a stop is from [today]: "On now" inside it, "in 5 days" under a week, else weeks.
String roadDistance(RoadStop s, DateTime today) {
  final end = s.end ?? s.start;
  if (!today.isBefore(s.start) && !today.isAfter(end)) return TodayCopy.onNow;
  final days = s.start.difference(today).inDays;
  if (days < 7) return TodayCopy.inDays(days);
  return TodayCopy.inWeeks(days ~/ 7);
}

/// The stops as a vertical timeline: a rail with each stop's mark, its name, its dates (each
/// says "Expected" while NTA or CBSE has not published them), a note where one helps and, given
/// [today], how far it is, the first one ahead marked "Next". The mark is the key to the track.
class RoadStops extends StatelessWidget {
  const RoadStops({super.key, required this.stops, this.today});

  final List<RoadStop> stops;

  /// When given, each stop says how far it is and the next one ahead is marked.
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // When every date is still expected, the word is said once above the list, not on each row.
    final allExpected = stops.length > 1 && stops.every((s) => s.expected);
    final now = today;
    final next = now == null ? -1 : roadNextIndex(stops, now);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (allExpected) ...[
          Semantics(
            container: true,
            label: TodayCopy.expectedDates,
            excludeSemantics: true,
            child: Text(TodayCopy.expectedDates, style: type.caption.copyWith(color: colors.ink3, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: MmSpace.s8),
        ],
        for (final (i, s) in stops.indexed)
          _StopRow(
            stop: s,
            last: i == stops.length - 1,
            isNext: i == next,
            distance: now == null ? null : roadDistance(s, now),
            tagExpected: s.expected && !allExpected,
          ),
      ],
    );
  }
}

class _StopRow extends StatelessWidget {
  const _StopRow({required this.stop, required this.last, required this.isNext, required this.distance, required this.tagExpected});

  final RoadStop stop;
  final bool last;
  final bool isNext;
  final String? distance;
  final bool tagExpected;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = stop;
    final current = isNext || distance == TodayCopy.onNow;
    final when = distance == null ? null : '${isNext ? '${TodayCopy.nextTag}, ' : ''}${distance!}';
    return Semantics(
      container: true,
      label: joinSentences([s.title, if (s.expected) TodayCopy.expectedTag, s.when, s.note, when]),
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The rail: the stop's mark, and a hairline down to the next stop.
            SizedBox(
              width: 28,
              child: Column(
                children: [
                  _Node(kind: s.kind, current: isNext || distance == TodayCopy.onNow),
                  if (!last)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Container(width: 1.5, color: colors.lineStrong),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: last ? 0 : MmSpace.s16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: MmSpace.s8,
                            runSpacing: MmSpace.s4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                s.title,
                                style: type.labelLarge.copyWith(
                                  color: current || distance == null || s.kind == RoadStopKind.exam ? colors.ink : colors.ink2,
                                  fontWeight: current ? FontWeight.w700 : FontWeight.w600,
                                ),
                              ),
                              if (tagExpected) const _ExpectedTag(),
                            ],
                          ),
                        ),
                        if (distance != null) ...[
                          const SizedBox(width: MmSpace.s8),
                          _Distance(text: distance!, next: isNext),
                        ],
                      ],
                    ),
                    Text(s.when, style: type.caption.copyWith(color: colors.ink2)),
                    if (s.note != null) Text(s.note!, style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "in 16 weeks", with "Next" in a small ink pill before it on the next stop ahead.
class _Distance extends StatelessWidget {
  const _Distance({required this.text, required this.next});

  final String text;
  final bool next;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = Text(
      text,
      style: type.caption.copyWith(color: next ? colors.ink : colors.ink2, fontWeight: next ? FontWeight.w700 : FontWeight.w500),
    );
    if (!next) return words;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(color: colors.ink, borderRadius: MmRadius.pillAll),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            child: Text(
              TodayCopy.nextTag,
              style: type.micro.copyWith(fontWeight: FontWeight.w700, color: colors.ground),
            ),
          ),
        ),
        const SizedBox(width: MmSpace.s6),
        words,
      ],
    );
  }
}

/// "Expected": the stop's date is not published yet. The same sunken pill the practice chips use.
class _ExpectedTag extends StatelessWidget {
  const _ExpectedTag();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sunken,
        borderRadius: MmRadius.pillAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 2),
        child: Text(TodayCopy.expectedTag, style: context.mmType.caption.copyWith(color: colors.ink2), maxLines: 1, softWrap: false),
      ),
    );
  }
}

/// A stop's node on the timeline rail. The stop that is next (or on now) is a full-ink node with
/// a halo; the exam window is the one volt node; the stops after it are quiet hollow rings. The
/// colour of each is the colour of its lane or block on the track above.
class _Node extends StatelessWidget {
  const _Node({required this.kind, required this.current});

  final RoadStopKind kind;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final exam = kind == RoadStopKind.exam;
    final accent = roadStopColor(kind, colors);
    final fill = exam ? accent : (current ? colors.ink : null);
    final size = current ? 14.0 : 12.0;
    return SizedBox(
      width: 20,
      height: 20,
      child: Center(
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: fill,
            border: fill == null ? Border.all(color: accent, width: 1.5) : null,
            boxShadow: current ? [BoxShadow(color: (exam ? accent : colors.ink).withValues(alpha: 0.18), spreadRadius: 3)] : null,
          ),
          child: SizedBox.square(dimension: size),
        ),
      ),
    );
  }
}
