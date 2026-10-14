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

  /// The pressed scale of every tappable surface.
  static const double pressedScale = 0.96;
}
