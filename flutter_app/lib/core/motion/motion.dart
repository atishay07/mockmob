import 'package:flutter/widgets.dart';

import 'reduced_motion.dart';

/// Motion tokens (spec 3.1). Only opacity and transform animate. Never ease-in on UI, never
/// scale(0) (start at 0.95 with opacity 0), no page-level `Opacity`, no `BackdropFilter`.
abstract final class Motion {
  /// Key press travel (spec 2.4 says 80 ms; the press token is the 100 ms ceiling).
  static const Duration keyDown = Duration(milliseconds: 80);
  static const Duration press = Duration(milliseconds: 100);
  static const Duration release = Duration(milliseconds: 140);
  static const Duration ui = Duration(milliseconds: 200);
  static const Duration card = Duration(milliseconds: 240);
  static const Duration result = Duration(milliseconds: 320);
  static const Duration figureRoll = Duration(milliseconds: 420);

  /// Ceiling for a milestone, optional.
  static const Duration milestone = Duration(milliseconds: 500);

  /// Page transitions (spec 3.2).
  static const Duration tabSwitch = Duration(milliseconds: 140);
  static const Duration pagePush = Duration(milliseconds: 220);
  static const Duration pagePop = Duration(milliseconds: 180);
  static const Duration runner = Duration(milliseconds: 120);
  static const Duration sheetIn = Duration(milliseconds: 280);
  static const Duration sheetOut = Duration(milliseconds: 200);

  /// Reduced-motion replacement for any movement: a short fade.
  static const Duration reducedFade = Duration(milliseconds: 120);

  static const Cubic out = Cubic(0.23, 1, 0.32, 1);
  static const Cubic arena = Cubic(0.16, 1, 0.3, 1);
  static const Cubic drawer = Cubic(0.32, 0.72, 0, 1);

  /// Position change only.
  static const Cubic inOut = Cubic(0.77, 0, 0.175, 1);

  /// [d], or zero when motion is reduced.
  static Duration of(BuildContext c, Duration d) => reduced(c) ? Duration.zero : d;

  static bool reduced(BuildContext c) => MediaQuery.disableAnimationsOf(c) || ReducedMotionSetting.of(c);
}
