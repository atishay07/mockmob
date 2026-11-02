// The web's `text-wrap: balance` for a plain text on the Learn screens (the home's offer, the chapter's title and piles, a cover's name
// and hook, a section's bar): a text that needs two lines or more keeps that number of lines and is set at the narrowest width that
// still holds them, so two lines are two even lines and never a long one with a single word under it ("Pick up Admission of a /
// Partner" reads "Pick up Admission / of a Partner"). A text that fits one line, or that has to be cut at `maxLines` anyway, keeps
// its full width. The number of lines never changes, so a height measured at the full width stays true.
import 'package:flutter/widgets.dart';

class BalancedText extends StatelessWidget {
  const BalancedText(this.text, {super.key, required this.style, this.maxLines, this.overflow, this.textAlign = TextAlign.start, this.semanticsLabel});

  final String text;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final TextAlign textAlign;
  final String? semanticsLabel;

  /// The narrowest width at or under [maxWidth] that keeps [text] in as many lines as it takes at [maxWidth]. [maxWidth] itself when it
  /// takes one line, or when it is cut at [maxLines].
  static double balancedWidth(String text, TextStyle style, double maxWidth, {required TextScaler scaler, required TextDirection direction, int? maxLines}) {
    if (!maxWidth.isFinite || maxWidth <= 0 || text.isEmpty) return maxWidth;
    final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: direction, textScaler: scaler, maxLines: maxLines);
    try {
      tp.layout(maxWidth: maxWidth);
      if (tp.didExceedMaxLines) return maxWidth;
      final lines = tp.computeLineMetrics().length;
      if (lines <= 1) return maxWidth;
      var lo = maxWidth / 2;
      var hi = maxWidth;
      for (var k = 0; k < 12 && hi - lo > 1; k++) {
        final mid = (lo + hi) / 2;
        tp.layout(maxWidth: mid);
        if (tp.didExceedMaxLines || tp.computeLineMetrics().length > lines) {
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
    final base = DefaultTextStyle.of(context).style.merge(style);
    return LayoutBuilder(
      builder: (context, c) {
        final width = balancedWidth(text, base, c.maxWidth, scaler: scaler, direction: direction, maxLines: maxLines);
        final alignment = switch (textAlign) {
          TextAlign.center => Alignment.topCenter,
          TextAlign.right || TextAlign.end => AlignmentDirectional.topEnd,
          _ => AlignmentDirectional.topStart,
        };
        return Align(
          alignment: alignment,
          widthFactor: 1,
          heightFactor: 1,
          child: SizedBox(
            width: width.isFinite ? width : null,
            child: Text(text, style: style, maxLines: maxLines, overflow: overflow, textAlign: textAlign, semanticsLabel: semanticsLabel),
          ),
        );
      },
    );
  }
}
