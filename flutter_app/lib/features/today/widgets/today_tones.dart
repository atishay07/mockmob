// Today's own colour values that the shared palette has no name for, in one place with their
// night and day values, so a palette change is made here and nowhere in a painter. Everything
// else reads straight from `context.mmColors`.
import 'package:flutter/painting.dart';

import '../../../core/theme/theme.dart';

extension TodayTones on MmColors {
  /// The band of light that crosses the hero once when it opens.
  Color get sweepPeak => isNight ? const Color(0x24FFF4D6) : const Color(0x38FFFFFF);

  /// The sealed sheet: its face, the flap folded over it, the crease and the folded corner.
  Color get foldPaper => isNight ? const Color(0xFF1A1915) : const Color(0xFFE9DFCB);
  List<Color> get foldFlap => isNight ? const [Color(0x33FFE2B0), Color(0x66000000)] : const [Color(0x55FFFFFF), Color(0x1A2A2010)];
  Color get foldCrease => isNight ? const Color(0xCC000000) : const Color(0x552A2010);
  Color get foldLip => isNight ? const Color(0x2EFFF0D8) : const Color(0x99FFFFFF);
  Color get foldCorner => isNight ? const Color(0xFF2C2A24) : const Color(0xFFD3CCBC);
  Color get foldCornerEdge => isNight ? const Color(0x40FFF0D8) : const Color(0x332A2010);

  /// The one volt used as a mark on the ground (today's edge on the week): the lit volt at
  /// night, the readable accent text colour on paper.
  Color get litMark => isNight ? volt : accentText;
}
