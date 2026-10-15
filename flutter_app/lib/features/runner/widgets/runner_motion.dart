import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

/// The runner's motion vocabulary (docs/brain/ui-blitz/runner.md, section 3). Everything here
/// is a transform or an opacity inside a RepaintBoundary; nothing reflows under the student's
/// eyes, and every piece is skipped under reduced motion.
abstract final class RunnerMotion {
  /// A question arriving: its text, then each option 25 ms behind the one above (MOTION.md 4.6).
  /// The last option (a fourth, order 5) is fully there 325 ms after the switch starts, inside the
  /// 150 to 350 ms the whole swap is allowed. A rapid Next, Next cancels each arrival where it
  /// stands: every question is a fresh widget with its own controller, so nothing queues.
  static const Duration enter = Duration(milliseconds: 200);
  static const Duration stagger = Duration(milliseconds: 25);

  /// The question that was just left fades out at once, over [ghostFade], and is gone. Two question
  /// texts must never read on top of each other for more than about 60 ms (finding 7, 15 Oct): the
  /// leaving text is at 0.25 half way through and at 0 when the 60 ms are up, while the arriving
  /// text is already rising from [enterFloor], so the region is never blank either.
  static const Duration ghostFade = Duration(milliseconds: 60);

  /// An ease-out: most of the fade happens in the first half, so the leaving text is already faint
  /// when the arriving one has risen enough to be read.
  static const Cubic ghostCurve = Cubic(0.25, 0.46, 0.45, 0.94);

  /// The first two staggered items (the question text and the line under it) start from this
  /// opacity, not from nothing, so the arriving question is readable from its first frame.
  static const double enterFloor = 0.35;

  /// The whole cross-fade: the leaving question's fade.
  static const Duration crossFade = ghostFade;

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
