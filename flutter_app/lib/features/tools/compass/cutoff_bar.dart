import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../domain/du_helpers.dart';

/// A programme's Round I cutoff range drawn as a bar: the lowest college cutoff at the left end,
/// the highest at the right, both as real figures under it. With a score, a pin sits where the
/// score falls along the range (held at an end when it is outside it) and the track is inked up
/// to the pin, so "where do I stand" is the first thing the eye reads, before any number.
///
/// The bar's own scale is the programme's range, so the pin's place is comparable down a list
/// (left means "near the lowest cutoff", right means "near the highest"); the figures say how far
/// that is in marks. The pin glides to its place when it first draws (and when the score changes; drawn at
/// once under reduced motion). The words for a screen reader are the caller's row label.
class CutoffBar extends StatelessWidget {
  const CutoffBar({super.key, required this.category, required this.low, required this.high, this.score});

  final String category;
  final double low;
  final double high;

  /// The student's score on the same 1000-mark scale, or null when none is set.
  final double? score;

  static const double trackHeight = 6;
  static const double pin = 14;

  /// Where [score] falls along the range, 0 to 1 (0.5 for a one-figure range).
  static double fraction(double low, double high, double score) {
    if (high <= low) return score >= high ? 1 : 0;
    return ((score - low) / (high - low)).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = type.caption.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]);
    final s = score;
    final inked = colors.isNight ? colors.volt : colors.accentText;
    final f = s == null ? null : fraction(low, high, s);
    final reached = s != null && s >= low;
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(ToolsCopy.roundOneLabel(category), style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s6),
          SizedBox(
            height: pin,
            child: LayoutBuilder(
              builder: (context, box) {
                final reduced = Motion.reduced(context);
                return TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: f ?? 0),
                  duration: reduced ? Duration.zero : Motion.emphasizedDuration,
                  curve: Motion.glide,
                  builder: (context, t, _) {
                    final x = (box.maxWidth - pin) * t;
                    return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned(
                          left: 0,
                          right: 0,
                          top: (pin - trackHeight) / 2,
                          height: trackHeight,
                          child: DecoratedBox(decoration: ShapeDecoration(shape: const StadiumBorder(), color: colors.lineStrong)),
                        ),
                        if (s != null && reached)
                          Positioned(
                            left: 0,
                            width: x + pin / 2,
                            top: (pin - trackHeight) / 2,
                            height: trackHeight,
                            child: DecoratedBox(decoration: ShapeDecoration(shape: const StadiumBorder(), color: inked)),
                          ),
                        if (s != null)
                          Positioned(
                            left: x,
                            top: 0,
                            width: pin,
                            height: pin,
                            child: DecoratedBox(
                              key: const ValueKey('cutoff-pin'),
                              decoration: ShapeDecoration(
                                shape: CircleBorder(side: BorderSide(color: reached ? colors.ground : colors.ink3, width: 2)),
                                color: reached ? inked : colors.raised,
                                shadows: reached ? [BoxShadow(color: inked.withValues(alpha: 0.4), blurRadius: 6)] : null,
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                );
              },
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              Text(duFormatScore(low), style: figure),
              const Spacer(),
              Text(duFormatScore(high), style: figure),
            ],
          ),
        ],
      ),
    );
  }
}
