import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import 'reduced_motion.dart';

export 'springs.dart';

/// Motion tokens (Night Sheet brief, section 7). Only opacity and transform animate, inside a
/// RepaintBoundary. Things glide and land with weight; they do not bounce.
///
/// Never moves: question text, options, the timer, explanation body, numbers after landing.
abstract final class Motion {
  // ---- Night Sheet vocabulary -------------------------------------------------------------

  /// Default enter: cubic-bezier(0.15, 0.5, 0.5, 1), 300 ms.
  static const Cubic glide = Cubic(0.15, 0.5, 0.5, 1);
  static const Duration glideDuration = Duration(milliseconds: 300);

  /// Default exit: cubic-bezier(0.4, 0.3, 0.8, 0.6), 200 ms.
  static const Cubic exit = Cubic(0.4, 0.3, 0.8, 0.6);
  static const Duration exitDuration = Duration(milliseconds: 200);

  /// Container transforms (Start to sheet, card to detail): cubic-bezier(0.16, 1, 0.3, 1), 420 ms.
  static const Cubic emphasized = Cubic(0.16, 1, 0.3, 1);
  static const Duration emphasizedDuration = Duration(milliseconds: 420);

  /// A soft light band crossing a surface once.
  static const Cubic sweepCurve = Cubic(0.45, 0, 0.55, 1);
  static const Duration sweep = Duration(milliseconds: 700);

  /// Text revealed left to right by a mask.
  static const Duration engrave = Duration(milliseconds: 280);

  /// Digits rolling into place.
  static const Duration numberRoll = Duration(milliseconds: 500);

  /// The wordmark hairline drawing left to right.
  static const Duration hairline = Duration(milliseconds: 500);

  /// The first-launch cold open, end to end.
  static const Duration coldOpen = Duration(milliseconds: 1400);

  /// A bubble inking from the touch point.
  static const Duration ink = Duration(milliseconds: 260);

  /// Reduced-motion replacement for an unfold or a reveal.
  static const Duration crossFade = Duration(milliseconds: 200);

  // ---- Shared tokens (kept for existing screens) --------------------------------------------

  /// Key press travel.
  static const Duration keyDown = Duration(milliseconds: 80);
  static const Duration press = Duration(milliseconds: 100);
  static const Duration release = Duration(milliseconds: 140);
  static const Duration ui = Duration(milliseconds: 200);
  static const Duration card = Duration(milliseconds: 240);
  static const Duration result = Duration(milliseconds: 320);
  static const Duration figureRoll = numberRoll;

  /// Ceiling for a milestone, optional.
  static const Duration milestone = Duration(milliseconds: 500);

  /// Page transitions.
  static const Duration tabSwitch = Duration(milliseconds: 180);
  static const Duration pagePush = glideDuration;
  static const Duration pagePop = Duration(milliseconds: 220);
  static const Duration runner = Duration(milliseconds: 160);
  static const Duration sheetIn = emphasizedDuration;
  static const Duration sheetOut = Duration(milliseconds: 240);

  /// Reduced-motion replacement for any movement: a short fade.
  static const Duration reducedFade = Duration(milliseconds: 120);

  /// Decelerating ease for UI that settles (the glide family).
  static const Cubic out = Cubic(0.23, 1, 0.32, 1);
  static const Cubic arena = emphasized;
  static const Cubic drawer = Cubic(0.32, 0.72, 0, 1);

  /// Position change only.
  static const Cubic inOut = Cubic(0.77, 0, 0.175, 1);

  /// [d], or zero when motion is reduced.
  static Duration of(BuildContext c, Duration d) => reduced(c) ? Duration.zero : d;

  static bool reduced(BuildContext c) => MediaQuery.disableAnimationsOf(c) || ReducedMotionSetting.of(c);

  /// A [SpringSimulation] from [from] to [to] with [spring], keeping [velocity].
  static SpringSimulation spring(SpringDescription spring, double from, double to, {double velocity = 0}) =>
      SpringSimulation(spring, from, to, velocity);
}
