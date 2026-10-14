import 'package:flutter/physics.dart';

/// Springs of the Night Sheet (brief section 7): nearly critical, bounce at most 0.12, except the
/// dock's lit tile at 0.18 so it reads as liquid.
abstract final class Springs {
  /// Cards, sheets with velocity, rows: 360 ms, bounce 0.12.
  static final SpringDescription smooth =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 360), bounce: 0.12);

  /// Press feedback (0.96 scale): 220 ms, bounce 0.
  static final SpringDescription snappy =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 220), bounce: 0);

  /// The dock's lit tile: 360 ms, bounce 0.18.
  static final SpringDescription dock =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 360), bounce: 0.18);

  /// Unfold release and container landings: 420 ms, bounce 0.
  static final SpringDescription settle =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 420), bounce: 0);

  /// A pressed surface coming back: 300 ms, bounce 0.1, a short physical give.
  static final SpringDescription release =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 300), bounce: 0.1);

  /// The dock pill's leading edge (quick) and trailing edge (slow): the pill stretches toward the
  /// new tab, then gathers itself.
  static final SpringDescription edgeLead =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 260), bounce: 0.12);
  static final SpringDescription edgeTrail =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 440), bounce: 0.04);

  /// A dock icon arriving: 420 ms, the dock's 0.18 bounce.
  static final SpringDescription iconPop =
      SpringDescription.withDurationAndBounce(duration: const Duration(milliseconds: 420), bounce: 0.18);

  /// The pressed scale of every tappable surface.
  static const double pressedScale = 0.96;
}
