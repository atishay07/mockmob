import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// The runner's motion vocabulary (docs/brain/ui-blitz/runner.md, section 3). Everything here
/// is a transform or an opacity inside a RepaintBoundary; nothing reflows under the student's
/// eyes, and every piece is skipped under reduced motion.
abstract final class RunnerMotion {
  /// A question arriving: its text, then each option 35 ms behind the one above (MOTION.md 4.6).
  /// A rapid Next, Next cancels each arrival where it stands: every question is a fresh widget with
  /// its own controller, so nothing queues.
  static const Duration enter = Duration(milliseconds: 260);
  static const Duration stagger = Duration(milliseconds: 35);

  /// The question that was just left stays fully visible under the arriving one until the arriving
  /// question's text is half visible ([ghostHold]), then fades out over [ghostFade], so a switch is
  /// never a blank frame: the two texts together never drop below 0.7 (finding 7).
  static const Duration ghostFade = Duration(milliseconds: 90);

  /// The first two staggered items (the question text and the line under it) start from this
  /// opacity, not from nothing, so the arriving question is readable from its first frame.
  static const double enterFloor = 0.35;

  /// How long the arriving question's text (order 0) takes to reach 0.5 opacity.
  static final Duration ghostHold = _timeToReach(0.5);

  /// The whole cross-fade: the hold, then the fade.
  static Duration get crossFade => ghostHold + ghostFade;

  static Duration _timeToReach(double opacity) {
    final target = (opacity - enterFloor) / (1 - enterFloor);
    var lo = 0.0, hi = 1.0;
    for (var i = 0; i < 30; i++) {
      final mid = (lo + hi) / 2;
      if (Motion.glide.transform(mid) < target) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return Duration(microseconds: (hi * enter.inMicroseconds).ceil());
  }

  /// The opacity of an arriving item of [order] at its own progress [t] (0 to 1).
  static double enterOpacity(int order, double t) {
    final floor = order <= 1 ? enterFloor : 0.0;
    return floor + (1 - floor) * t;
  }

  /// The count "19 of 20" changing.
  static const Duration countFlip = Duration(milliseconds: 220);

  /// The lock-in dot flying from the option's badge, up the gutter and along the track (practice
  /// only: a timed mock has no flight).
  static const Duration flight = Duration(milliseconds: 240);

  /// The spark on the track cell: it floods volt, then cools to paper ink.
  static const Duration spark = Duration(milliseconds: 640);

  /// A volt wash bleeding out of the chosen option's bubble.
  static const Duration wash = Duration(milliseconds: 320);
  static const Duration washOut = Duration(milliseconds: 140);

  /// Changing the answer from one option to another: the wash slides from the old row to the new.
  static const Duration washGlide = Duration(milliseconds: 240);

  /// A light band crossing a surface once.
  static const Duration sweep = Duration(milliseconds: 700);

  /// The sheet inking in order when the server has it.
  static const Duration inkInOrder = Duration(milliseconds: 700);

  /// One pass of the scan over the sheet while the answers are on their way.
  static const Duration scan = Duration(milliseconds: 1400);

  /// How far a question travels in from the side it came from, and how far it rises.
  static const double enterShift = 6;
  static const double enterRise = 10;

  /// True when motion is off (the phone's setting or the in-app switch).
  static bool reduced(BuildContext context) => Motion.reduced(context);
}
