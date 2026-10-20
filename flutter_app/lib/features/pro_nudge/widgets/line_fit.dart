import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Short copy set so it never leaves one word alone on a line (D185). A line is measured with the real font at the
/// real width and text size: it stays one line when it fits, and otherwise goes on two lines broken where it reads
/// best: after a full stop or a comma when there is one, else where the two lines come out most even, and never with
/// one word alone on a line when another break fits.
abstract final class LineFit {
  /// How wide [text] is set on one line.
  static double widthOf(String text, TextStyle style, TextScaler scaler) {
    final painter = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)
      ..layout();
    final width = painter.width;
    painter.dispose();
    return width;
  }

  /// Whether [text] fits on one line [width] wide.
  static bool fitsOneLine(String text, TextStyle style, TextScaler scaler, double width) => widthOf(text, style, scaler) <= width;

  /// [text] on two lines (joined by a line break), each of which fits [width], or null when no break does that.
  static String? twoLines(String text, TextStyle style, TextScaler scaler, double width) {
    String? best;
    var bestScore = double.infinity;
    for (var i = text.indexOf(' '); i > 0; i = text.indexOf(' ', i + 1)) {
      final first = text.substring(0, i);
      final second = text.substring(i + 1);
      final a = widthOf(first, style, scaler);
      final b = widthOf(second, style, scaler);
      if (a > width || b > width) continue;
      // A break after a full stop or a comma reads as two thoughts, so it wins over a merely even one. A line of one
      // word (a name cut in two, an orphan) is taken only when nothing else fits.
      final seam = first.endsWith('.') || first.endsWith(',');
      final alone = !first.contains(' ') || !second.contains(' ');
      final score = math.max(a, b) - (seam ? width : 0) + (alone ? 4 * width : 0);
      if (score < bestScore) {
        bestScore = score;
        best = '$first\n$second';
      }
    }
    return best;
  }

  /// [text] as it is set: one line when it fits; else two lines when [two] allows ([twoLines]); else null.
  static String? fit(String text, TextStyle style, TextScaler scaler, double width, {bool two = true}) {
    if (fitsOneLine(text, style, scaler, width)) return text;
    return two ? twoLines(text, style, scaler, width) : null;
  }
}
