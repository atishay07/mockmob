import 'package:flutter/widgets.dart';

/// A title that wraps into even lines instead of one long line and a short orphan ("Remind me
/// when it / matters"). It keeps the text, the style and the number of lines the plain wrap
/// would use, and only narrows the box to the least width that holds that many lines. A title
/// that fits on one line is left alone. Measured with the real text scale.
class BalancedText extends StatelessWidget {
  const BalancedText(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);

    return LayoutBuilder(
      builder: (context, box) {
        final plain = Text(text, style: style);
        final max = box.maxWidth;
        if (!max.isFinite || max <= 0) return plain;

        int linesAt(double width) {
          final painter = TextPainter(
            text: TextSpan(text: text, style: style),
            textDirection: direction,
            textScaler: scaler,
          )..layout(maxWidth: width);
          final n = painter.computeLineMetrics().length;
          painter.dispose();
          return n;
        }

        final target = linesAt(max);
        if (target <= 1) return plain;

        // The least width that still wraps into the same number of lines.
        var lo = max * 0.4;
        var hi = max;
        for (var i = 0; i < 9; i++) {
          final mid = (lo + hi) / 2;
          if (linesAt(mid) <= target) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        // A little air so the real layout never wraps one line more than the measured one.
        final width = (hi + 2).clamp(0.0, max);
        return Align(
          alignment: AlignmentDirectional.centerStart,
          child: ConstrainedBox(constraints: BoxConstraints(maxWidth: width), child: plain),
        );
      },
    );
  }
}
