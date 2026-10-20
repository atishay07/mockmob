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

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final to = fractionOf(answered, target);
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
              painter: _SegmentsPainter(fraction: v, count: segments, palette: palette, filled: colors.isNight ? ChainPaper.fill(context) : colors.ink, empty: colors.isNight ? colors.raised2 : colors.sunken, edge: colors.line),
            ),
          ),
        ),
      ),
    );
  }
}

class _SegmentsPainter extends CustomPainter {
  _SegmentsPainter({required this.fraction, required this.count, this.palette = const [], required this.filled, required this.empty, required this.edge});

  final double fraction;
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
      canvas.drawRRect(rect, Paint()..color = empty);
      // How much of this segment is filled: the bar's fraction spread over the segments.
      final part = (fraction * count - i).clamp(0.0, 1.0);
      if (part > 0) {
        canvas.save();
        canvas.clipRRect(rect);
        canvas.drawRect(Rect.fromLTWH(x, 0, w * part, size.height), Paint()..color = palette.isEmpty ? filled : palette[i % palette.length]);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(_SegmentsPainter old) => old.fraction != fraction || old.filled != filled || old.empty != empty || old.count != count || !listEquals(old.palette, palette);
}
