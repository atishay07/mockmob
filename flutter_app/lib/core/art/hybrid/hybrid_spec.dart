import 'package:flutter/widgets.dart';

/// One generated photo-real object whose moving part is drawn in code: the render in
/// `assets/art/hybrid-*.webp` (straight alpha, lamp-lit brass) and where its moving part sits.
///
/// Every place is a fraction of the render's own width and height, measured on the file
/// (tmp/art-hybrid/NOTES.md), so the drawn part lands on the pin at any size.
@immutable
class HybridSpec {
  const HybridSpec._(
    this.name,
    this.width,
    this.height, {
    required this.pivot,
    this.radiusX = 0,
    this.radiusY = 0,
    this.faceTilt = 0,
    this.foot,
    this.footWidth = 0,
  });

  /// The file name without `hybrid-` and `.webp`.
  final String name;

  /// The render's size in pixels.
  final int width;
  final int height;

  /// The pin the moving part turns on (needle, hands, arm) or the point the bell rocks on.
  final Offset pivot;

  /// The dial as drawn, as semi-axes in fractions of [width] and [height]. A needle or a hand is
  /// squashed into this ellipse so it lies in the same perspective as the face.
  final double radiusX;
  final double radiusY;

  /// How far the face is turned clockwise in the picture, in radians.
  final double faceTilt;

  /// Where the object meets the ground (centre of its footprint), or null for one that hangs.
  final Offset? foot;

  /// How wide that footprint is, as a share of [width].
  final double footWidth;

  String get asset => 'assets/art/hybrid-$name.webp';

  double get aspect => width / height;

  /// Gimbal ship's compass, charcoal dial with brass ticks and a lime lubber line at 12.
  static const compass = HybridSpec._(
    'compass',
    751,
    768,
    pivot: Offset(0.499, 0.335),
    radiusX: 0.246,
    radiusY: 0.190,
    foot: Offset(0.49, 0.94),
    footWidth: 0.44,
  );

  /// Frontal pyramid metronome; the pin sits at the foot of the slot. [slotTop] is where the arm's
  /// tip rests, so the arm's upright leans the way the slot does.
  static const metronome = HybridSpec._(
    'metronome',
    550,
    768,
    pivot: Offset(0.464, 0.680),
    foot: Offset(0.50, 0.945),
    footWidth: 0.82,
  );

  /// The metronome's slot top (the arm tip at rest).
  static const Offset metronomeSlotTop = Offset(0.495, 0.195);

  /// The metronome's arm, as a share of the render's height.
  static const double metronomeArm = 0.48;

  /// Near face-on stopwatch, white enamel face, lime marker at 12. The 12 tick under the lime
  /// marker stands 6.5 degrees clockwise of straight up from the pin (measured on the file, 19 Oct:
  /// tick at 301.5, 282.5 px, pin at 280.7, 464.6 px). It was 4.4 degrees, so a hand at rest or
  /// landing on 12 stopped about 2 degrees short of the marker, to its left (H4).
  static const stopwatch = HybridSpec._(
    'stopwatch',
    596,
    768,
    pivot: Offset(0.471, 0.605),
    radiusX: 0.341,
    radiusY: 0.260,
    faceTilt: stopwatchTwelve,
  );

  /// The stopwatch's 12, in radians clockwise from straight up (see [stopwatch]).
  static const double stopwatchTwelve = 0.1138;

  /// Wide brass desk bell with a lime stripe on its black base. [pivot] is where the base meets
  /// the desk (the bell rocks on it); [bellKnob] is the knob the rings start from.
  static const deskbell = HybridSpec._(
    'deskbell',
    768,
    702,
    pivot: Offset(0.508, 0.926),
    foot: Offset(0.50, 0.93),
    footWidth: 0.86,
  );

  /// The desk bell's knob centre.
  static const Offset bellKnob = Offset(0.501, 0.117);
}
