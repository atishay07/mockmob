import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// The weeks left to CUET as a slim runway: one column per week, seven small cells in each, the
/// week's study sessions lit from the bottom (board weeks hold two). When the student changes
/// their days the runway fills or empties in a wave from today towards the exam (520 ms, at once
/// under reduced motion), so the choice is felt across every week it covers (owner, 18 Oct, D47).
/// Decorative: the caller says the same in words.
class RunwayStrip extends StatefulWidget {
  const RunwayStrip({super.key, required this.weeks});

  /// Sessions per week, from this week to the last before the window.
  final List<int> weeks;

  static const double cell = 5;
  static const double gap = 1.5;

  /// The gap between weeks: wider than between days, so each week reads as one column.
  static const double weekGap = 3;
  static const double height = cell * 7 + gap * 6;
  static const Duration fill = Duration(milliseconds: 520);

  @override
  State<RunwayStrip> createState() => _RunwayStripState();
}

class _RunwayStripState extends State<RunwayStrip> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: RunwayStrip.fill, value: 1);
  late List<int> _from = widget.weeks;

  @override
  void didUpdateWidget(RunwayStrip old) {
    super.didUpdateWidget(old);
    if (_same(old.weeks, widget.weeks)) return;
    // From what is drawn now, so a change mid-wave carries on from where the light is.
    _from = _lit(old.weeks, _t.value);
    if (Motion.reduced(context)) {
      _t.value = 1;
    } else {
      _t.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  static bool _same(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  /// The whole cells lit per week at [t] on the way from [_from] to [to].
  List<int> _lit(List<int> to, double t) => [for (var w = 0; w < to.length; w++) _at(w, to, t).round()];

  double _at(int w, List<int> to, double t) {
    final n = to.length;
    final from = w < _from.length ? _from[w] : 0;
    // Each week starts a little after the one before it: a wave from today to the exam.
    final start = n <= 1 ? 0.0 : 0.4 * w / (n - 1);
    final local = Motion.out.transform(((t - start) / 0.6).clamp(0.0, 1.0));
    return from + (to[w] - from) * local;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _t,
          builder: (context, _) => CustomPaint(
            size: const Size(double.infinity, RunwayStrip.height),
            painter: _RunwayPainter(
              lit: [for (var w = 0; w < widget.weeks.length; w++) _at(w, widget.weeks, _t.value)],
              // A 4 dp cell reads as a stroke: the text accent (olive on Day, where volt on
              // cream would vanish), as the course tiles' ladder bars do (SPACING.md 8.3).
              // Night stays subtle: the volt is held back, so a full runway is not a block of light.
              on: colors.isNight ? colors.volt.withValues(alpha: 0.6) : colors.accentText,
              off: colors.line,
            ),
          ),
        ),
      ),
    );
  }
}

class _RunwayPainter extends CustomPainter {
  _RunwayPainter({required this.lit, required this.on, required this.off});

  final List<double> lit;
  final Color on;
  final Color off;

  @override
  void paint(Canvas canvas, Size size) {
    final n = lit.length;
    if (n == 0) return;
    const gap = RunwayStrip.weekGap;
    final w = math.max(1.0, (size.width - gap * (n - 1)) / n);
    final radius = Radius.circular(math.min(1.5, w / 2));
    final paint = Paint();
    for (var i = 0; i < n; i++) {
      final x = i * (w + gap);
      for (var d = 0; d < 7; d++) {
        final y = size.height - (d + 1) * RunwayStrip.cell - d * RunwayStrip.gap;
        // The cell the light is passing through blends in, so the fill moves smoothly.
        final f = (lit[i] - d).clamp(0.0, 1.0);
        paint.color = Color.lerp(off, on, f)!;
        canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, RunwayStrip.cell), radius), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_RunwayPainter old) => old.on != on || old.off != off || !_eq(old.lit, lit);

  static bool _eq(List<double> a, List<double> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
