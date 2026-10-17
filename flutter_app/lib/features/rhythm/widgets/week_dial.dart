// The week as a ring (you-rhythm spec 2.1): exactly `goal` segments, one inked for every study day
// counted this week, the count in the middle as a monumental number. Days past the goal draw as
// small inner arcs. The segments ink in order with no tick per segment (80 ms of lead, 260 ms
// each, 70 ms apart). A met week is drawn closed; only when [WeekDial.sweep] is set (the moment a
// week is met, never an ordinary open) does one light sweep run round it and close it, 420 ms.
// Night draws a soft volt glow under a met ring; Daylight has no glow and keeps the 1 dp volt edge
// every arc already carries, and its sweep is a dark volt spot (white is invisible on paper). A
// paused week draws dashed grey segments and claims nothing. Everything is one painter on a
// RepaintBoundary; nothing loops. Reduced motion draws the settled ring.
//
// A live dial answers what changes under it, and only that:
// - a new counted day inks only the new segment, with one lamp pulse under it (the number rolls
//   one step by itself), never on first load and never under reduced motion;
// - a new goal reshapes the ring: the goal is drawn as a double, so five segments ease into four
//   instead of the ring re-inking;
// - pausing or resuming cross-fades the inked segments and the dashes, and the count and the
//   pause glyph swap places over 320 ms.
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/monumental_number.dart';
import '../copy.dart';

class WeekDial extends StatefulWidget {
  const WeekDial({
    super.key,
    required this.done,
    required this.goal,
    this.size = 184,
    this.paused = false,
    this.animate = true,
    this.showWords = true,
    this.sweep = false,
    this.live = true,
    this.onLanded,
  });

  /// Study days counted this week (the server's count).
  final int done;

  /// The weekly goal, 1 to 7: the number of segments.
  final int goal;
  final double size;

  /// A paused week: dashed grey segments, no fill, no count.
  final bool paused;

  /// False draws the settled ring at once.
  final bool animate;

  /// The "of 4 study days" line under the number. Off for the smallest dials.
  final bool showWords;

  /// Runs the closing light round a met ring once: the T2 moment of a week that has just been met.
  /// Off by default, so opening a screen on a week that is already met only draws it closed.
  final bool sweep;

  /// False says a change of [done] is not a day just counted (a cache that was old, a new week):
  /// the ring then shows the new count settled, with no segment inking and no lamp pulse.
  final bool live;

  /// Called once when the count in the middle has landed: the screen's lead number gives its one
  /// selection tick there. Null for a dial that is not the lead of its screen.
  final VoidCallback? onLanded;

  /// 80 ms of lead, then each segment inks over 260 ms, 70 ms after the one before it. A whole
  /// seven-segment ring is on screen within 760 ms, inside the 800 ms entrance budget.
  static const int _lead = 80;
  static const int _perMs = 70;
  static const int _inkMs = 260;

  /// A day counted while the ring is on screen starts almost at once.
  static const int _liveLead = 40;

  /// The closing light of a met week: one pass, 420 ms, so the whole moment (seven segments plus
  /// the sweep) ends inside `Motion.momentT2`.
  static const int _sweepMs = 420;

  /// The ring reshaping to a new goal, and the pause cross-fade.
  static const Duration reshape = Duration(milliseconds: 420);
  static const Duration pauseMorph = Duration(milliseconds: 320);

  /// How long the ring takes from its first frame to rest. A caller that wants something to happen
  /// once the number has landed (Mobi cheering) waits this long. [from] is the count the ring
  /// showed before: only the segments after it ink (a day counted while the ring is on screen).
  static Duration settleAfter({required int done, required int goal, bool sweep = false, int from = 0}) {
    final g = goal.clamp(1, 7);
    final filled = math.min(done, g);
    final start = from.clamp(0, filled);
    final fresh = filled - start;
    final gaps = fresh > 1 ? fresh - 1 : 0;
    final met = done >= goal && goal > 0;
    final lead = start > 0 ? _liveLead : _lead;
    return Duration(milliseconds: lead + _inkMs + _perMs * gaps + (sweep && met ? _sweepMs : 120));
  }

  @override
  State<WeekDial> createState() => _WeekDialState();
}

class _WeekDialState extends State<WeekDial> with TickerProviderStateMixin {
  AnimationController? _controller;
  late final AnimationController _goalCtl = AnimationController(vsync: this, duration: WeekDial.reshape, value: 1);
  late final AnimationController _morph = AnimationController(vsync: this, duration: WeekDial.pauseMorph, value: widget.paused ? 1 : 0);
  late double _goalFrom = widget.goal.clamp(1, 7).toDouble();
  late double _goalTo = _goalFrom;
  bool _started = false;

  /// Segments before this one were already inked: only the ones after it ink.
  int _from = 0;

  /// The ring's goal now, between the old and the new while it reshapes.
  double get _goalNow => _goalFrom + (_goalTo - _goalFrom) * Curves.easeOutCubic.transform(_goalCtl.value);

  int _total(bool sweeps) => WeekDial.settleAfter(done: widget.done, goal: widget.goal, sweep: sweeps, from: _from).inMilliseconds;

  /// The closing light runs only for the moment a week is met.
  bool get _sweeps => widget.sweep && _met;

  bool get _met => !widget.paused && widget.done >= widget.goal && widget.goal > 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || Motion.reduced(context) || widget.paused || widget.done <= 0) return;
    _controller = AnimationController(vsync: this, duration: Duration(milliseconds: _total(_sweeps)))..forward();
  }

  @override
  void didUpdateWidget(WeekDial old) {
    super.didUpdateWidget(old);
    final live = widget.animate && !Motion.reduced(context);
    // Only a day counted while the ring is on screen inks in; any other change settles at once.
    final counted = live && widget.live;

    if (old.paused != widget.paused) {
      if (live) {
        _morph.animateTo(widget.paused ? 1 : 0, duration: WeekDial.pauseMorph, curve: Curves.easeInOut);
      } else {
        _morph.value = widget.paused ? 1 : 0;
      }
    }

    final newGoal = widget.goal.clamp(1, 7).toDouble();
    if (old.goal != widget.goal) {
      _goalFrom = _goalNow;
      _goalTo = newGoal;
      if (live) {
        _goalCtl.forward(from: 0);
      } else {
        _goalFrom = newGoal;
        _goalCtl.value = 1;
      }
    }

    if (old.done == widget.done) return;
    if (!counted || widget.paused) {
      _from = 0;
      _controller?.dispose();
      _controller = null;
      return;
    }
    // A day counted on a ring that stays as it is: only the new segment inks. Any other change
    // (a new week, a lower count, a new goal at once) inks the ring again.
    final incremental = old.goal == widget.goal && !old.paused && widget.done > old.done;
    final g = widget.goal.clamp(1, 7);
    _from = incremental ? old.done.clamp(0, g) : 0;
    if (incremental && _from >= math.min(widget.done, g)) {
      // The new day is past the goal: an inner arc, drawn at once.
      _controller?.dispose();
      _controller = null;
      return;
    }
    _controller ??= AnimationController(vsync: this);
    _controller!
      ..duration = Duration(milliseconds: _total(_sweeps))
      ..forward(from: 0);
  }

  @override
  void dispose() {
    _controller?.dispose();
    _goalCtl.dispose();
    _morph.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = widget.size;
    final goal = widget.goal.clamp(1, 7);
    final numberSize = s * (widget.showWords ? 0.40 : 0.46);
    final controller = _controller;
    final paused = widget.paused;
    final center = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (paused)
          // Drawn, not an icon font glyph, so the sheet and the screen always show the same two bars.
          PauseBars(height: s * 0.24, color: colors.ink)
        else
          MonumentalNumber(
            value: '${widget.done}',
            style: type.figure.copyWith(fontSize: numberSize),
            onLanded: widget.onLanded,
          ),
        if (widget.showWords) ...[
          SizedBox(height: s * 0.02),
          Text(
            paused ? RhythmCopy.outlookPausedShort : RhythmCopy.ofGoal(goal),
            textAlign: TextAlign.center,
            textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.2),
            style: type.caption.copyWith(color: colors.ink2, fontSize: math.max(12, s * 0.075)),
          ),
        ],
      ],
    );
    final dial = SizedBox.square(
      dimension: s,
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _DialPainter(
            colors: colors,
            goal: goal,
            goalFrom: _goalFrom,
            goalTo: _goalTo,
            goalAnim: _goalCtl,
            morph: _morph,
            done: widget.done,
            paused: paused,
            progress: controller,
            lead: _from > 0 ? WeekDial._liveLead : WeekDial._lead,
            perMs: WeekDial._perMs,
            inkMs: WeekDial._inkMs,
            totalMs: _total(_sweeps),
            from: _from,
            met: _met,
            sweeps: _sweeps,
          ),
          child: Center(
            child: SizedBox(
              width: s * 0.66,
              // The count and the pause glyph swap places: one scales and fades out as the other
              // scales and fades in.
              child: AnimatedSwitcher(
                duration: Motion.of(context, WeekDial.pauseMorph),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: ScaleTransition(scale: Tween<double>(begin: 0.86, end: 1).animate(anim), child: child),
                ),
                child: FittedBox(key: ValueKey(paused), fit: BoxFit.scaleDown, child: center),
              ),
            ),
          ),
        ),
      ),
    );
    return ExcludeSemantics(child: dial);
  }
}

/// The two bars of a pause: the same glyph on the full screen, in the sheet and on the You hub.
class PauseBars extends StatelessWidget {
  const PauseBars({super.key, required this.height, required this.color});

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

class _DialPainter extends CustomPainter {
  _DialPainter({
    required this.colors,
    required this.goal,
    required this.goalFrom,
    required this.goalTo,
    required this.goalAnim,
    required this.morph,
    required this.done,
    required this.paused,
    required this.progress,
    required this.lead,
    required this.perMs,
    required this.inkMs,
    required this.totalMs,
    required this.from,
    required this.met,
    required this.sweeps,
  }) : super(repaint: Listenable.merge([progress, goalAnim, morph]));

  final MmColors colors;

  /// The goal as an integer (the target).
  final int goal;

  /// The goal drawn: [goalFrom] to [goalTo] by [goalAnim], so the ring can be five segments
  /// easing into four.
  final double goalFrom;
  final double goalTo;
  final Animation<double> goalAnim;

  /// 0 = a running week, 1 = a paused week.
  final Animation<double> morph;
  final int done;
  final bool paused;
  final Animation<double>? progress;
  final int lead;
  final int perMs;
  final int inkMs;
  final int totalMs;

  /// Segments before this one are already inked (a day counted on a ring on screen).
  final int from;
  final bool met;

  /// The closing light runs (the moment of a met week); false draws a met ring closed.
  final bool sweeps;

  double get _goalNow => goalFrom + (goalTo - goalFrom) * Curves.easeOutCubic.transform(goalAnim.value);

  /// 0 to 1 for the filled segment [i] on its own clock (not eased); 1 when drawn settled.
  double _raw(int i) {
    final p = progress;
    if (p == null || p.value >= 1 || i < from) return 1;
    final ms = p.value * totalMs;
    final start = lead + (i - from) * perMs;
    return ((ms - start) / inkMs).clamp(0.0, 1.0);
  }

  double _fill(int i) => Curves.easeOutCubic.transform(_raw(i));

  /// 0 to 1 to 0 over the life of a lamp pulse under a segment that has just been counted, or 0.
  double _pulse(int i) {
    final p = progress;
    if (from <= 0 || i < from || p == null || p.value >= 1) return 0;
    final ms = p.value * totalMs;
    final start = lead + (i - from) * perMs;
    final t = ((ms - start) / (inkMs + 160)).clamp(0.0, 1.0);
    return math.sin(math.pi * t);
  }

  /// 0 to 1 for the closing sweep of a met week (1 when the ring is only drawn closed).
  double _sweep() {
    final p = progress;
    if (!met) return 0;
    if (!sweeps || p == null || p.value >= 1) return 1;
    final ms = p.value * totalMs;
    final fresh = math.max(0, math.min(done, goal) - from);
    final start = lead + inkMs + perMs * math.max(0, fresh - 1);
    return ((ms - start) / WeekDial._sweepMs).clamp(0.0, 1.0);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final stroke = size.width * 0.085;
    final r = size.width / 2 - stroke / 2 - 3;
    final rect = Rect.fromCircle(center: c, radius: r);
    final g = _goalNow;
    // One gap between two segments; a ring of one segment has none, and it grows in as the second
    // segment arrives.
    final gap = (stroke * 1.25 / r).clamp(0.05, 0.32) * (g - 1).clamp(0.0, 1.0);
    final seg = (2 * math.pi - gap * g) / g;
    final start0 = -math.pi / 2 + gap / 2;
    final whole = g.floor();
    final fraction = g - whole;
    // The segments as (start angle, share of a full segment): whole ones, then the one that is
    // appearing or going.
    final segments = <(double, double)>[
      for (var i = 0; i < whole; i++) (start0 + i * (seg + gap), 1.0),
      if (fraction > 0.004) (start0 + whole * (seg + gap), fraction),
    ];
    final m = Curves.easeInOut.transform(morph.value);

    if (m >= 1) {
      _dashes(canvas, rect, stroke, segments, seg, 1);
      return;
    }
    final layer = m > 0;
    if (layer) canvas.saveLayer(Offset.zero & size, Paint()..color = Color.fromRGBO(0, 0, 0, 1 - m));
    _ring(canvas, c, r, rect, stroke, segments, seg);
    if (layer) {
      canvas.restore();
      _dashes(canvas, rect, stroke, segments, seg, m);
    }
  }

  void _dashes(Canvas canvas, Rect rect, double stroke, List<(double, double)> segments, double seg, double alpha) {
    final dash = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke * 0.5
      ..strokeCap = StrokeCap.round
      ..color = colors.ink2.withValues(alpha: colors.ink2.a * alpha);
    for (final (a0, share) in segments) {
      const dashes = 5;
      final len = seg * share;
      final step = len / dashes;
      for (var d = 0; d < dashes; d++) {
        canvas.drawArc(rect, a0 + d * step, step * 0.55, false, dash);
      }
    }
  }

  void _ring(Canvas canvas, Offset c, double r, Rect rect, double stroke, List<(double, double)> segments, double seg) {
    final night = colors.isNight;
    final ink = colors.volt;
    final edge = colors.voltEdge;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = colors.line.withValues(alpha: night ? 0.9 : 1);
    final filled = math.min(done, segments.length);

    // No standing glow under a met week (17 Oct: glow is banned); the closed ring and its sweep say it.
    final sw = _sweep();

    for (final (a0, share) in segments) {
      canvas.drawArc(rect, a0, seg * share, false, track);
    }
    for (var i = 0; i < filled; i++) {
      final (a0, share) = segments[i];
      final t = _fill(i);
      if (t <= 0) continue;
      final len = seg * share * t;
      final pulse = _pulse(i);
      if (pulse > 0) {
        // The lamp pulse: the newly counted segment lights its own surroundings once. Night is a
        // soft glow; Daylight widens the volt rim instead (a glow is a smudge on paper).
        final glow = Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round;
        if (night) {
          glow
            ..strokeWidth = stroke * 1.7
            ..color = colors.lamp.withValues(alpha: 0.55 * pulse)
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, stroke * 0.9);
        } else {
          glow
            ..strokeWidth = stroke + 7 * pulse
            ..color = edge.withValues(alpha: 0.42 * pulse);
        }
        canvas.drawArc(rect, a0, len, false, glow);
      }
      if (!night) {
        // Volt on warm paper needs its own rim to read.
        canvas.drawArc(
          rect,
          a0,
          len,
          false,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = stroke + 2
            ..strokeCap = StrokeCap.round
            ..color = edge,
        );
      }
      canvas.drawArc(
        rect,
        a0,
        len,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = ink,
      );
    }

    // Days past the goal: small inner arcs, one per extra day.
    final extra = done - goal;
    if (extra > 0) {
      final ri = r - stroke - 5;
      final inner = Rect.fromCircle(center: c, radius: ri);
      final esw = (2 * math.pi) / 7 - 0.12;
      for (var i = 0; i < math.min(extra, 7 - goal); i++) {
        canvas.drawArc(
          inner,
          -math.pi / 2 + 0.06 + i * (esw + 0.12),
          esw,
          false,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = stroke * 0.32
            ..strokeCap = StrokeCap.round
            ..color = colors.volt.withValues(alpha: 0.85),
        );
      }
    }

    // The closing light: a bright spot runs once round the ring. Night: warm white on volt.
    // Daylight: the dark volt edge colour, because white on a volt arc over cream cannot be seen.
    if (sweeps && met && sw > 0 && sw < 1) {
      final a = -math.pi / 2 + 2 * math.pi * Curves.easeInOut.transform(sw);
      final p = c + Offset(math.cos(a), math.sin(a)) * r;
      final spot = night ? Colors.white.withValues(alpha: 0.85) : edge.withValues(alpha: 0.75);
      canvas.drawCircle(
        p,
        stroke * 0.9,
        Paint()..shader = RadialGradient(colors: [spot, spot.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: p, radius: stroke * 0.9)),
      );
    }
  }

  @override
  bool shouldRepaint(_DialPainter old) =>
      old.colors != colors ||
      old.goal != goal ||
      old.goalFrom != goalFrom ||
      old.goalTo != goalTo ||
      old.done != done ||
      old.paused != paused ||
      old.met != met ||
      old.sweeps != sweeps ||
      old.from != from ||
      old.progress != progress;
}
