// The paper the chains are made of (BRAND-MOTION-KIT 1): a cream sheet with a hairline edge, ink on it,
// a folded corner. One place for the tokens, so the strip, the pennant and the quest bar agree and the
// den can borrow them. Night paper is warm cream; Day paper is the brighter sheet with a warm edge.

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';

abstract final class ChainPaper {
  /// The sheet.
  static Color fill(BuildContext context) => context.mmColors.isNight ? const Color(0xFFECE4D2) : const Color(0xFFFFFBF1);

  /// A sheet in shade: the fold, a pressed corner.
  static Color shade(BuildContext context) => context.mmColors.isNight ? const Color(0xFFCFC6B0) : const Color(0xFFEADFC4);

  /// The hairline round a sheet.
  static Color edge(BuildContext context) => context.mmColors.isNight ? const Color(0xFFF6F0E2) : const Color(0xFFD9CDB0);

  /// Ink on paper, the same in both themes.
  static const Color ink = Color(0xFF1B1A16);

  /// Quiet ink on paper (a caption, a dashed stitch line).
  static Color inkQuiet(BuildContext context) => context.mmColors.isNight ? const Color(0xFF6A6455) : const Color(0xFF8A8270);
}

/// Dashes along a path, for the rested days, the open day and the dashed rounded outline of paper not
/// yet earned.
Path dashedPath(Path source, {double dash = 4, double gap = 3}) {
  final out = Path();
  for (final m in source.computeMetrics()) {
    var d = 0.0;
    while (d < m.length) {
      final end = (d + dash).clamp(0.0, m.length);
      out.addPath(m.extractPath(d, end), Offset.zero);
      d += dash + gap;
    }
  }
  return out;
}
