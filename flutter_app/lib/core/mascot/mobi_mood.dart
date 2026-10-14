import 'dart:math' as math;

import 'mobi_rig.dart';

/// Mobi's face between acts: a persistent expression that sits under whatever he does, set with
/// `MobiController.setMood` and blended over [MobiMoods.blend]. Mobi has a visor, not a mouth, so
/// a mood lives in the lids (a sloped upper lid is his brow), the warm lower lid, the gaze, the
/// antenna and a hint of posture. Every mood is light enough that an act still reads over it.
enum MobiMood {
  /// Level lids, eyes open: the default face.
  calm,

  /// A warm lower lid and a lifted antenna.
  happy,

  /// Warm eyes, chin a little up, standing a touch taller, the bulb faintly lit.
  proud,

  /// Eyes a little wider (the right one more), gaze up, the antenna leaning in.
  curious,

  /// Heavy lids and a drooping antenna (late at night).
  sleepy,

  /// A soft slope to the upper lids and a gentle warm lower lid, a small lean in. Never sad, never
  /// at the student: "that did not go to plan, and that is fine".
  concerned,
}

/// What each [MobiMood] does to a rig.
abstract final class MobiMoods {
  /// How long a change of mood takes.
  static const Duration blend = Duration(milliseconds: 300);

  /// [r] with [mood] laid over it at strength [w] (0 none, 1 full). [MobiMood.calm] changes
  /// nothing, so a calm Mobi paints exactly as before moods existed.
  static MobiRig apply(MobiMood mood, MobiRig r, [double w = 1]) {
    if (mood == MobiMood.calm || w <= 0) return r;
    MobiEye eye(MobiEye e, {double open = 0, double lid = 0, double smile = 0, double slant = 0}) => e.copyWith(
          open: e.open * (1 + open * w),
          lid: math.max(e.lid, lid * w),
          smile: math.max(e.smile, smile * w),
          slant: e.slant + slant * w,
        );
    switch (mood) {
      case MobiMood.calm:
        return r;
      case MobiMood.happy:
        return r.copyWith(
          eyeL: eye(r.eyeL, smile: 0.38),
          eyeR: eye(r.eyeR, smile: 0.38),
          antenna: r.antenna - 0.05 * w,
        );
      case MobiMood.proud:
        return r.copyWith(
          eyeL: eye(r.eyeL, smile: 0.3),
          eyeR: eye(r.eyeR, smile: 0.3),
          lookY: r.lookY - 0.18 * w,
          squash: r.squash + 0.012 * w,
          y: r.y - 0.6 * w,
          glow: r.glow + 0.18 * w,
        );
      case MobiMood.curious:
        return r.copyWith(
          eyeL: eye(r.eyeL, open: 0.06),
          eyeR: eye(r.eyeR, open: 0.14),
          lookY: r.lookY - 0.14 * w,
          tilt: r.tilt + 0.03 * w,
          antenna: r.antenna - 0.14 * w,
        );
      case MobiMood.sleepy:
        return r.copyWith(
          eyeL: eye(r.eyeL, lid: 0.34),
          eyeR: eye(r.eyeR, lid: 0.34),
          lookY: r.lookY + 0.12 * w,
          antenna: r.antenna + 0.16 * w,
        );
      case MobiMood.concerned:
        return r.copyWith(
          eyeL: eye(r.eyeL, slant: 0.42, smile: 0.16),
          eyeR: eye(r.eyeR, slant: 0.42, smile: 0.16),
          lookY: r.lookY + 0.08 * w,
          tilt: r.tilt - 0.02 * w,
          y: r.y + 0.4 * w,
        );
    }
  }

  /// [r] blending from mood [from] to [to] at progress [k] (0 to 1, already eased).
  static MobiRig between(MobiMood from, MobiMood to, MobiRig r, double k) {
    if (k >= 1 || from == to) return apply(to, r);
    if (k <= 0) return apply(from, r);
    return MobiRig.lerp(apply(from, r), apply(to, r), k);
  }
}
