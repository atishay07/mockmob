// The quest bar of C2: twelve paper segments, filled in order as the Mob answers (spec C2, F8). The fill is
// the server's answered over its target; past the target the bar stays full while the number beside it
// keeps its true total ("70 answered. The quest needed 60."). The bar never counts down and never shows
// who filled it.
//
// It fills once when it first appears (600 ms, segment after segment) and again, from where it was, when
// the total changes; reduced motion draws the end state at once.

import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import 'chain_paper.dart';

class QuestSegments extends StatelessWidget {
  const QuestSegments({super.key, required this.answered, required this.target, this.segments = 12, this.animate = true, this.semanticsLabel, this.palette = const []});

  final int answered;
  final int target;
  final int segments;
  final bool animate;
  final String? semanticsLabel;

  /// V4: filled segments take the Mob's member colours in turn (decoration only: a segment never says who
  /// filled it). Empty keeps the paper fill.
  final List<Color> palette;

  /// 0 to 1: how much of the bar is filled. Full at or past the target, empty with no target.
  static double fractionOf(int answered, int target) => target <= 0 ? 0 : (answered / target).clamp(0.0, 1.0);

  /// Whole segments only (paper, never a sliver): 51 of 60 fills 10 of 12; all 12 only at or past the target.
  static int filledOf(int answered, int target, [int segments = 12]) {
    if (target <= 0 || answered <= 0) return 0;
    if (answered >= target) return segments;
    return (answered * segments / target).floor().clamp(0, segments - 1);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final to = filledOf(answered, target, segments).toDouble();
    final still = !animate || Motion.reduced(context);
    return Semantics(
      label: semanticsLabel,
      container: true,
      child: ExcludeSemantics(
        child: SizedBox(
          height: 14,
          child: TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: still ? to : 0, end: to),
            duration: still ? Duration.zero : const Duration(milliseconds: 600),
            curve: Motion.glide,
            builder: (context, v, _) => CustomPaint(
              size: const Size(double.infinity, 14),
              painter: _SegmentsPainter(filledCount: v.floor(), count: segments, palette: palette, filled: colors.isNight ? ChainPaper.fill(context) : colors.ink, empty: colors.isNight ? colors.raised2 : colors.sunken, edge: colors.line),
            ),
          ),
        ),
      ),
    );
  }
}

class _SegmentsPainter extends CustomPainter {
  _SegmentsPainter({required this.filledCount, required this.count, this.palette = const [], required this.filled, required this.empty, required this.edge});

  final int filledCount;
  final int count;
  final List<Color> palette;
  final Color filled;
  final Color empty;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    const gap = 4.0;
    final w = (size.width - gap * (count - 1)) / count;
    for (var i = 0; i < count; i++) {
      final x = i * (w + gap);
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(x, 0, w, size.height), const Radius.circular(4));
      // A segment is filled whole or not at all; the 600 ms fill steps segment by segment.
      canvas.drawRRect(rect, Paint()..color = i < filledCount ? (palette.isEmpty ? filled : palette[i % palette.length]) : empty);
    }
  }

  @override
  bool shouldRepaint(_SegmentsPainter old) => old.filledCount != filledCount || old.filled != filled || old.empty != empty || old.count != count || !listEquals(old.palette, palette);
}
