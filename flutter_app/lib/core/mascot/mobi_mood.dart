import 'dart:math' as math;

import 'mobi_rig.dart';
import 'mobi_rig_eval.dart';

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

  // ---- Added 15 Oct 2026 (rig v2) -------------------------------------------------------------

  /// Level, lowered upper lids, eyes steady and a touch down at the work, the bulb faintly on:
  /// concentrating with the student (a timed drill's start sheet, a long read). Never stern.
  focused,
}

/// What each [MobiMood] does to a rig, read from the rig table (`moods` in `mobi_rig_data.dart`).
abstract final class MobiMoods {
  /// How long a change of mood takes.
  static final Duration blend = Duration(microseconds: ((MobiBook.instance.spec['moodBlend']! as num) * 1e6).round());

  static final List<_Mood> _moods = [
    for (final m in MobiMood.values) _Mood.of((MobiBook.instance.section('moods')[m.name] as Map<String, Object?>?) ?? const {}),
  ];

  /// [r] with [mood] laid over it at strength [w] (0 none, 1 full). [MobiMood.calm] changes
  /// nothing, so a calm Mobi paints exactly as before moods existed.
  static MobiRig apply(MobiMood mood, MobiRig r, [double w = 1]) {
    if (mood == MobiMood.calm || w <= 0) return r;
    return _moods[mood.index].apply(r, w);
  }

  /// [r] blending from mood [from] to [to] at progress [k] (0 to 1, already eased).
  static MobiRig between(MobiMood from, MobiMood to, MobiRig r, double k) {
    if (k >= 1 || from == to) return apply(to, r);
    if (k <= 0) return apply(from, r);
    return MobiRig.lerp(apply(from, r), apply(to, r), k);
  }
}

/// One mood's numbers: eye changes (both eyes, then each) and fields added to the rig.
class _Mood {
  const _Mood(this.both, this.left, this.right, this.add);

  factory _Mood.of(Map<String, Object?> m) {
    Map<String, double> nums(Object? v) => {for (final e in ((v as Map<String, Object?>?) ?? const {}).entries) e.key: (e.value! as num).toDouble()};
    return _Mood(nums(m['eyes']), nums(m['eyeL']), nums(m['eyeR']), nums(m['add']));
  }

  final Map<String, double> both, left, right, add;

  static MobiEye _eye(MobiEye e, Map<String, double> m, double w) {
    if (m.isEmpty) return e;
    return e.copyWith(
      open: e.open * (1 + (m['open'] ?? 0) * w),
      lid: math.max(e.lid, (m['lid'] ?? 0) * w),
      smile: math.max(e.smile, (m['smile'] ?? 0) * w),
      slant: e.slant + (m['slant'] ?? 0) * w,
    );
  }

  MobiRig apply(MobiRig r, double w) {
    double a(String k, double v) => v + (add[k] ?? 0) * w;
    return r.copyWith(
      eyeL: _eye(_eye(r.eyeL, both, w), left, w),
      eyeR: _eye(_eye(r.eyeR, both, w), right, w),
      x: a('x', r.x),
      y: a('y', r.y),
      tilt: a('tilt', r.tilt),
      squash: a('squash', r.squash),
      lookX: a('lookX', r.lookX),
      lookY: a('lookY', r.lookY),
      antenna: a('antenna', r.antenna),
      glow: a('glow', r.glow),
    );
  }
}
