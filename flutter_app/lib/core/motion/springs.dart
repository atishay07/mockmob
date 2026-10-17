import 'package:flutter/physics.dart';

import 'motion_tokens.g.dart';

/// Springs of the Night Sheet (brief section 7): nearly critical, bounce at most 0.12, except the
/// dock's lit tile at 0.18 so it reads as liquid.
///
/// Each is a settle duration and a bounce from `shared/motion-tokens.json` (generated into
/// `motion_tokens.g.dart`); the website builds its CSS springs from the same pairs.
abstract final class Springs {
  static SpringDescription _of(Duration duration, double bounce) =>
      SpringDescription.withDurationAndBounce(duration: duration, bounce: bounce);

  /// Cards, sheets with velocity, rows: 360 ms, bounce 0.12.
  static final SpringDescription smooth = _of(MotionSprings.smoothDuration, MotionSprings.smoothBounce);

  /// Press feedback (0.96 scale): 220 ms, bounce 0.
  static final SpringDescription snappy = _of(MotionSprings.snappyDuration, MotionSprings.snappyBounce);

  /// The dock's lit tile: 360 ms, bounce 0.18.
  static final SpringDescription dock = _of(MotionSprings.dockDuration, MotionSprings.dockBounce);

  /// Unfold release and container landings: 420 ms, bounce 0.
  static final SpringDescription settle = _of(MotionSprings.settleDuration, MotionSprings.settleBounce);

  /// A pressed surface coming back: 300 ms, bounce 0.1, a short physical give.
  static final SpringDescription release = _of(MotionSprings.releaseDuration, MotionSprings.releaseBounce);

  /// The dock pill's leading edge (quick) and trailing edge (slow): the pill stretches toward the
  /// new tab, then gathers itself.
  static final SpringDescription edgeLead = _of(MotionSprings.edgeLeadDuration, MotionSprings.edgeLeadBounce);
  static final SpringDescription edgeTrail = _of(MotionSprings.edgeTrailDuration, MotionSprings.edgeTrailBounce);

  /// A dock icon arriving: 420 ms, the dock's 0.18 bounce.
  static final SpringDescription iconPop = _of(MotionSprings.iconPopDuration, MotionSprings.iconPopBounce);

  /// A T3 stamp and Mobi: 520 ms, bounce 0.22. Nothing else may use it.
  static final SpringDescription celebrate = _of(MotionSprings.celebrateDuration, MotionSprings.celebrateBounce);

  /// A switch thumb reaching its end: 240 ms, bounce 0.14, a slight overshoot that reads as a
  /// physical detent.
  static final SpringDescription toggle = _of(MotionSprings.toggleDuration, MotionSprings.toggleBounce);

  /// A released surface rising past rest (to about 1.03) before it settles; and a dragged row or
  /// card springing home or away. 300 ms, bounce 0.
  static final SpringDescription lift = _of(MotionSprings.liftDuration, MotionSprings.liftBounce);

  /// The bar's lens rising out of the glass under a finger: 180 ms, bounce 0 (GLASS-1017 5.5).
  static final SpringDescription lensLift = _of(MotionSprings.lensLiftDuration, MotionSprings.lensLiftBounce);

  /// The lifted lens sinking back into the glass as it lands: 320 ms, bounce 0.14.
  static final SpringDescription lensDrop = _of(MotionSprings.lensDropDuration, MotionSprings.lensDropBounce);

  /// The pressed scale of every tappable surface.
  static const double pressedScale = MotionNumbers.pressedScale;
}
