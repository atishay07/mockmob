// The week as a ring (you-rhythm spec 2.1): exactly `goal` segments, one inked for every study day
// counted this week, the count in the middle as a monumental number. Days past the goal draw as
// small inner arcs. The segments ink in order with no tick per segment (80 ms of lead, 260 ms
// each, 70 ms apart). A met week is drawn closed; only when [WeekDial.sweep] is set (the moment a
// week is met, never an ordinary open) does one light sweep run round it and close it, 420 ms.
// Night draws a soft volt glow under a met ring; Daylight has no glow and keeps the 1 dp volt edge
// every arc already carries, and its sweep is a dark volt spot (white is invisible on paper). A
// paused week draws dashed grey segments and claims nothing. Everything is one painter on a
// RepaintBoundary; nothing loops. Reduced motion draws the settled ring.
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

  /// Called once when the count in the middle has landed: the screen's lead number gives its one
  /// selection tick there. Null for a dial that is not the lead of its screen.
  final VoidCallback? onLanded;

  /// 80 ms of lead, then each segment inks over 260 ms, 70 ms after the one before it. A whole
  /// seven-segment ring is on screen within 760 ms, inside the 800 ms entrance budget.
  static const int _lead = 80;
  static const int _perMs = 70;
  static const int _inkMs = 260;

  /// The closing light of a met week: one pass, 420 ms, so the whole moment (seven segments plus
  /// the sweep) ends inside `Motion.momentT2`.
  static const int _sweepMs = 420;

  /// How long the ring takes from its first frame to rest. A caller that wants something to happen
  /// once the number has landed (Mobi cheering) waits this long.
  static Duration settleAfter({required int done, required int goal, bool sweep = false}) {
    final filled = math.min(done, goal.clamp(1, 7));
    final gaps = filled > 1 ? filled - 1 : 0;
    final met = done >= goal && goal > 0;
    return Duration(milliseconds: _lead + _inkMs + _perMs * gaps + (sweep && met ? _sweepMs : 120));
  }

  @override
  State<WeekDial> createState() => _WeekDialState();
}

class _WeekDialState extends State<WeekDial> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  bool _started = false;

  int _total(bool sweeps) => WeekDial.settleAfter(done: widget.done, goal: widget.goal, sweep: sweeps).inMilliseconds;

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
    if (old.done == widget.done && old.goal == widget.goal) return;
    if (!widget.animate || Motion.reduced(context)) {
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
    final center = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.paused)
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
            widget.paused ? RhythmCopy.outlookPausedShort : RhythmCopy.ofGoal(goal),
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
            done: widget.done,
            paused: widget.paused,
            progress: controller,
            lead: WeekDial._lead,
            perMs: WeekDial._perMs,
            inkMs: WeekDial._inkMs,
            totalMs: _total(_sweeps),
            met: _met,
            sweeps: _sweeps,
          ),
          child: Center(child: SizedBox(width: s * 0.66, child: FittedBox(fit: BoxFit.scaleDown, child: center))),
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
    required this.done,
    required this.paused,
    required this.progress,
    required this.lead,
    required this.perMs,
    required this.inkMs,
    required this.totalMs,
    required this.met,
    required this.sweeps,
  }) : super(repaint: progress);

  final MmColors colors;
  final int goal;
  final int done;
  final bool paused;
  final Animation<double>? progress;
  final int lead;
  final int perMs;
  final int inkMs;
  final int totalMs;
  final bool met;

  /// The closing light runs (the moment of a met week); false draws a met ring closed.
  final bool sweeps;

  /// 0 to 1 for the filled segment [i]; 1 when drawn settled.
  double _fill(int i) {
    final p = progress;
    if (p == null || p.value >= 1) return 1;
    final ms = p.value * totalMs;
    final start = lead + i * perMs;
    return Curves.easeOutCubic.transform(((ms - start) / inkMs).clamp(0.0, 1.0));
  }

  /// 0 to 1 for the closing sweep of a met week (1 when the ring is only drawn closed).
  double _sweep() {
    final p = progress;
    if (!met) return 0;
    if (!sweeps || p == null || p.value >= 1) return 1;
    final ms = p.value * totalMs;
    final start = lead + inkMs + perMs * math.max(0, math.min(done, goal) - 1);
    return ((ms - start) / WeekDial._sweepMs).clamp(0.0, 1.0);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final stroke = size.width * 0.085;
    final r = size.width / 2 - stroke / 2 - 3;
    final rect = Rect.fromCircle(center: c, radius: r);
    final gap = goal == 1 ? 0.0 : (stroke * 1.25 / r).clamp(0.05, 0.32);
    final sweep = (2 * math.pi - gap * goal) / goal;
    final start0 = -math.pi / 2 + gap / 2;
    final night = colors.isNight;
    final ink = colors.volt;
    final edge = colors.voltEdge;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = colors.line.withValues(alpha: night ? 0.9 : 1);
    final filled = math.min(done, goal);

    if (paused) {
      final dash = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke * 0.5
        ..strokeCap = StrokeCap.round
        ..color = colors.ink2;
      for (var i = 0; i < goal; i++) {
        final a0 = start0 + i * (sweep + gap);
        const dashes = 5;
        final step = sweep / dashes;
        for (var d = 0; d < dashes; d++) {
          canvas.drawArc(rect, a0 + d * step, step * 0.55, false, dash);
        }
      }
      return;
    }

    // Night: the glow of a met week sits under the arcs, once the sweep is under way. Daylight has
    // no glow (it would be a grey smudge on cream); its arcs carry the 1 dp volt edge instead.
    final sw = _sweep();
    if (met && night && sw > 0) {
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke * 1.6
          ..color = colors.volt.withValues(alpha: 0.30 * Curves.easeOut.transform(sw))
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, stroke * 1.1),
      );
    }

    for (var i = 0; i < goal; i++) {
      final a0 = start0 + i * (sweep + gap);
      canvas.drawArc(rect, a0, sweep, false, track);
    }
    for (var i = 0; i < filled; i++) {
      final a0 = start0 + i * (sweep + gap);
      final t = _fill(i);
      if (t <= 0) continue;
      if (!night) {
        // Volt on warm paper needs its own rim to read.
        canvas.drawArc(
          rect,
          a0,
          sweep * t,
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
        sweep * t,
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
      old.done != done ||
      old.paused != paused ||
      old.met != met ||
      old.sweeps != sweeps ||
      old.progress != progress;
}
