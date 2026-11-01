/// Balanced wrap (the web's `text-wrap: balance` on the card's prompt, the end's title and the checkpoint's line):
/// the text keeps the number of lines it needs at its full width, set at the narrowest width that still fits in
/// that many, so a two-line prompt is two even lines rather than a long one and a short one.
library;

import 'package:flutter/widgets.dart';

class StageBalancedText extends StatelessWidget {
  const StageBalancedText(this.span, {super.key, this.textAlign = TextAlign.start, this.semanticsLabel});

  /// The text with its whole style on the root span.
  final InlineSpan span;
  final TextAlign textAlign;
  final String? semanticsLabel;

  /// The narrowest width at or under [maxWidth] that keeps [span] in as many lines as it takes at [maxWidth].
  static double balancedWidth(InlineSpan span, double maxWidth, {required TextScaler scaler, required TextDirection direction}) {
    if (!maxWidth.isFinite || maxWidth <= 0) return maxWidth;
    final tp = TextPainter(text: span, textDirection: direction, textScaler: scaler)..layout(maxWidth: maxWidth);
    try {
      final lines = tp.computeLineMetrics().length;
      if (lines <= 1) return maxWidth;
      var lo = maxWidth / 2;
      var hi = maxWidth;
      for (var k = 0; k < 12 && hi - lo > 1; k++) {
        final mid = (lo + hi) / 2;
        tp.layout(maxWidth: mid);
        if (tp.computeLineMetrics().length > lines) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return hi.ceilToDouble().clamp(0.0, maxWidth);
    } finally {
      tp.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    return LayoutBuilder(
      builder: (context, c) {
        final width = balancedWidth(span, c.maxWidth, scaler: scaler, direction: direction);
        final alignment = switch (textAlign) {
          TextAlign.center => Alignment.topCenter,
          TextAlign.right || TextAlign.end => AlignmentDirectional.topEnd,
          _ => AlignmentDirectional.topStart,
        };
        return Align(
          alignment: alignment,
          widthFactor: 1,
          child: SizedBox(
            width: width.isFinite ? width : null,
            child: Text.rich(span, textAlign: textAlign, semanticsLabel: semanticsLabel),
          ),
        );
      },
    );
  }
}
