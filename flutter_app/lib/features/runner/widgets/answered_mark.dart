import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The one look of "answered" across the runner: a solid disc of paper ink, with the question's
/// number (when it has one) in the ground colour. The timing track, the palette and the submit
/// sheet all draw it, so a student learns it once. Volt is kept for the moment an answer is
/// locked in and for the sheet being received: it floods in, then cools to this ink (or, on the
/// receipt, stays as the server's acknowledgement).
abstract final class AnsweredMark {
  /// Draws the answered disc of radius [r] at [c]. [emphasis] adds the current-question ring.
  static void paint(Canvas canvas, Offset c, double r, MmColors colors, {bool emphasis = false}) {
    if (emphasis) {
      canvas.drawCircle(
        c,
        r + 4.5,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = colors.ink,
      );
    }
    canvas.drawCircle(c, r, Paint()..color = colors.ink);
  }

  /// The colour of a number written on an answered disc.
  static Color numberColor(MmColors colors) => colors.ground;
}
