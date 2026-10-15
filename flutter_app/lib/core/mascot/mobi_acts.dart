import 'dart:math' as math;

import 'package:flutter/animation.dart';

import 'mobi_rig.dart';
import 'mobi_rig_eval.dart';

/// Something Mobi does. Held acts ([think], [point], [sleepy], [rest], [read], [idle], [loading],
/// [sleep], [nudge], [listen]) change how Mobi stands until the next one; the others play once
/// and return to standing.
///
/// New acts are only ever appended, so existing values keep their meaning and order. Every act's
/// timing and motion is data: `mobi_rig_data.dart` (exported for the website as
/// `mobi_rig.v2.json`).
enum MobiAct {
  /// Stand at ease: breathing, blinking, glancing about, the antenna swaying.
  idle,

  /// Rises into place with its eyes blinking on (a soft settle when Mobi first appears).
  appear,

  /// Waves hello with the left mitten, eyes smiling.
  hello,

  /// Bobs and beats its eyes while a line types in. Usually started by `MobiController.say`.
  talk,

  /// A happy hop with both arms up.
  cheer,

  /// A big jump with lime answer bubbles popping around it.
  celebrate,

  /// Mitten to chin, one eye squinting, looking up, the bulb faintly lit. Held.
  think,

  /// Points with a finger (to the right by default, or at a target). Held.
  point,

  /// Yawns and stretches, then stands with half-closed eyes. Held.
  sleepy,

  /// A small shrug, eyes drooping for a moment. Never sad, never at the student.
  oops,

  /// Sits down. Held.
  rest,

  /// Holds a little answer sheet and reads it. Held.
  read,

  // ---- Added 14 Oct 2026 (UI blitz) --------------------------------------------------------

  /// A right answer: a small crouch and hop, a nod, smiling eyes, and one volt answer bubble
  /// inking beside the head. Proportional: smaller than [cheer], far smaller than [celebrate].
  correct,

  /// After a wrong answer or a lower result: leans in, a chin-up nod and one "come on" pump of
  /// the mitten, warm eyes. Never a frown.
  encourage,

  /// Waiting on the server or the AI: mitten to chin, eyes scanning, the antenna bulb pulsing.
  /// Held; after about 12 seconds the scan settles into quiet thinking.
  loading,

  /// Asleep (late at night, dormant states): sits, eyes shut, slow deep breaths and z's. Held. A
  /// tap wakes Mobi with a start.
  sleep,

  /// Points at the action with two short jabs and a lean toward it. Then holds the point.
  nudge,

  /// A milestone: an anticipation dip, stretches tall, mittens on hips, chin up, glints around
  /// the head. Plays once.
  proud,

  /// Listening while the student types or speaks: leans in, eyes a little wider, a slow nod now
  /// and then. Held.
  listen,

  /// Woken (a tap on a sleeping Mobi, the first open after a night): a start with wide eyes and
  /// a little hop, a quick look round, then a happy blink and standing. Plays once.
  wake,

  // ---- Added 15 Oct 2026 (emotions) ---------------------------------------------------------

  /// A small "got it" nod: two dips of the head, eyes smiling. For a save the server confirmed.
  /// Returns to the stance it was played from.
  nod,

  /// A curious head tilt: the body leans to one side, eyes a little wider, the antenna lagging
  /// after. Returns to the stance it was played from.
  tilt,

  /// Goodbye: the right mitten is up in 320 ms, three easy waves, a small bow. Ends standing.
  wave,

  /// Ticklish: a quick jolt with wide eyes and flung mittens, then a giggling wiggle with happy
  /// eyes. Returns to the stance it was played from.
  startle,

  /// Anticipation: a dip with the fists drawn in and the eyes wide, held for a beat before
  /// something lands (a result about to show). Returns to the stance it was played from.
  brace,

  /// An exhale after an early release: a breath in, then the shoulders drop, the eyes close
  /// softly and open warm. Returns to the stance it was played from.
  relief,

  /// Stepping in place with a bob, boots and mittens swinging in turn: travel. Play it for the
  /// length of the trip (`MobiController.playFor`); `MobiWalker` moves him along. Ends standing.
  walk,

  // ---- Added 15 Oct 2026 (rig v2, the quality pass) -------------------------------------------

  /// A small happy hop on the spot (a crouch, a tucked flight, a squash and a rebound). Smaller
  /// than [cheer]; gated like a celebration (a nod under Quiet, nothing under Off). Returns to the
  /// stance it was played from.
  hop,

  /// A double take, then a lean in toward what caught his eye, the far eye wider and the
  /// antenna perking toward it. Returns to the stance it was played from.
  curious,

  /// Settling into the work: a breath in, level lowered lids, steady eyes, fists drawn in, the
  /// bulb on. Pair with [MobiMood.focused] to hold the face. Returns to the stance.
  focus,

  /// After a miss: soft sloped eyes with a warm lower lid, a kind head tilt, a mitten to the
  /// chest with two small pats and a slow nod. Never sad, never at the student. Returns to the
  /// stance.
  sympathy,

  /// An idea: a small dip, then the bulb flashes, the eyes pop wide and one finger shoots up
  /// with a little hop, eyes turning happy. Ends standing.
  idea,
}

/// How Mobi stands between acts.
enum MobiStance { stand, point, think, sleepy, rest, read, loading, sleep, listen }

/// The choreography: stance rigs and each act as a function of time, all read from the rig
/// table ([MobiBook], `mobi_rig_data.dart`).
abstract final class MobiMoves {
  static MobiBook get _book => MobiBook.instance;

  static final List<Map<String, Object?>> _specs = [for (final a in MobiAct.values) _book.actSpec(a.name)];
  static final List<MobiProgram?> _programs = [for (final a in MobiAct.values) _book.act(a.name)];

  static Map<String, Object?> _spec(MobiAct act) => _specs[act.index];

  /// The stance an act leaves Mobi in, or null when it returns to the current one.
  static MobiStance? stanceAfter(MobiAct act) {
    final s = _spec(act)['stance'] as String?;
    return s == null ? null : MobiStance.values.byName(s);
  }

  /// Acts that answer a moment and then give way: under reduced motion their still pose shows
  /// for the act's length, then the stance again.
  static const Set<MobiAct> reactions = {
    MobiAct.correct,
    MobiAct.encourage,
    MobiAct.wake,
    MobiAct.nod,
    MobiAct.tilt,
    MobiAct.wave,
    MobiAct.startle,
    MobiAct.brace,
    MobiAct.relief,
    MobiAct.walk,
    MobiAct.hop,
    MobiAct.curious,
    MobiAct.focus,
    MobiAct.sympathy,
    MobiAct.idea,
  };

  /// Whether [act] is held: it changes how Mobi stands until the next act (the others play once).
  static bool isHeld(MobiAct act) => _spec(act)['held'] == true;

  /// Whether [act] shows a still key pose under reduced motion (a reaction or a celebration,
  /// held for the act's length, then the stance). Held acts simply give their stance.
  static bool showsStillPose(MobiAct act) => _spec(act)['still'] == true || _spec(act)['reaction'] == true;

  /// How long an act runs, in seconds ([MobiAct.talk] runs as long as its line).
  static double duration(MobiAct act) => (_spec(act)['seconds']! as num).toDouble();

  /// How long, and with what curve, Mobi moves into [s].
  static (double, Curve) stanceBlend(MobiStance s) {
    final v = _book.section('stanceBlends')[s.name]! as List<Object?>;
    return ((v[0]! as num).toDouble(), _flutterCurve(v[1]! as String));
  }

  static Curve _flutterCurve(String name) => switch (name) {
        'linear' => Curves.linear,
        'easeIn' => Curves.easeIn,
        'easeOut' => Curves.easeOut,
        'easeInOut' => Curves.easeInOut,
        'easeInCubic' => Curves.easeInCubic,
        'easeOutCubic' => Curves.easeOutCubic,
        'easeInOutCubic' => Curves.easeInOutCubic,
        'easeInOutSine' => Curves.easeInOutSine,
        'easeOutBack' => Curves.easeOutBack,
        _ => throw ArgumentError('Mobi rig: no curve "$name"'),
      };

  /// Mittens on hips, elbows out (proud, point's free arm).
  static final MobiArm hip = _book.namedArm('hip');
  static final MobiArm akimbo = _book.namedArm('akimbo');

  /// The pointing arm's reach, and the free arm's hip, kept tight so the finger stays inside the
  /// paint box (140 design units wide) even in the nudge's jab.
  static final double pointReach = ((_book.section('stances')['point']! as Map)['pointing'] as Map)['reach'] as double;
  static final MobiArm pointHip = _book.namedArm('pointHip');

  /// Fists up at the chest ("you've got this").
  static final MobiArm fist = _book.namedArm('fist');

  /// Mitten to chin.
  static final MobiArm chin = _book.namedArm('chin');

  static final Map<MobiStance, MobiRig> _stances = {
    for (final s in MobiStance.values)
      if (s != MobiStance.point) s: _book.rigOf(_book.section('stances')[s.name]! as Map<String, Object?>),
  };

  /// The resting rig of a stance. [pointAngle] and [pointSide] aim the pointing arm.
  static MobiRig stance(MobiStance s, {double pointAngle = 1.5, double pointSide = 1}) {
    if (s != MobiStance.point) return _stances[s]!;
    final p = _book.section('stances')['point']! as Map<String, Object?>;
    final aim = p['pointing']! as Map<String, Object?>;
    final pointing = _book.armOf({...aim, 'angle': pointAngle});
    final free = _book.armOf(p['free']);
    final x = p['x']! as Map<String, Object?>;
    return MobiRig(
      armR: pointSide > 0 ? pointing : free,
      armL: pointSide > 0 ? free : pointing,
      // Weight shifted away from the finger, so the reach stays inside the paint box.
      x: ((pointSide > 0 ? x['right'] : x['left'])! as num).toDouble(),
      tilt: (p['tilt']! as num) * pointSide,
      lookX: (p['lookX']! as num) * pointSide,
      lookY: (math.cos(pointAngle) * (p['lookYFromAim']! as num)).clamp(-1.0, 1.0),
    );
  }

  // ---- Envelopes ---------------------------------------------------------------------------

  /// How much shorter an arm reaches while it sweeps through the sideways swing (progress [w] 0 to
  /// 1, deepest halfway): a bent elbow, so a mitten raised from the hip never goes out wide.
  static double swingDip(double w, double depth) => depth * math.sin(math.pi * w.clamp(0.0, 1.0));

  /// Eased progress of [t] through [a] to [b].
  static double ease(double t, double a, double b, [Curve curve = Curves.easeInOutCubic]) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    return curve.transform((t - a) / (b - a));
  }

  /// A smooth hump from 0 at [a] to 1 at the middle and 0 at [b].
  static double bump(double t, double a, double b) {
    if (t <= a || t >= b) return 0;
    return math.sin(math.pi * (t - a) / (b - a));
  }

  /// A ballistic hop of [height] between [a] and [b] (negative is up).
  static double hop(double t, double a, double b, double height) {
    if (t <= a || t >= b) return 0;
    final p = (t - a) / (b - a);
    return -height * 4 * p * (1 - p);
  }

  /// Progress of an effect running from [a] to [b], or -1 outside it.
  static double span(double t, double a, double b) => (t < a || t > b) ? -1 : (t - a) / (b - a);

  // ---- Acts --------------------------------------------------------------------------------

  /// Mobi at time [t] (seconds) into [act], starting from and returning to [base].
  static MobiRig act(MobiAct act, double t, MobiRig base) {
    if (act == MobiAct.talk) return talk(t, base, 1);
    if (act == MobiAct.walk) return walk(t, base, duration(MobiAct.walk));
    return _programs[act.index]?.run(t, base) ?? base;
  }

  /// Talking at [t] with strength [w] (0 to 1, for fading in and out).
  static MobiRig talk(double t, MobiRig b, double w) => _talk.run(t, b, w: w);
  static final MobiProgram _talk = _book.overlay('talk');

  /// One step of the walk, in seconds.
  static final double stepLength = _idle('stepSeconds');

  static double _idle(String k) => (_book.section('idle')[k]! as num).toDouble();

  /// Walking at [t] of a trip lasting [length] seconds: a bob on every step, the boots lifting in
  /// turn, the mittens swinging against them. It eases in and out, so it starts and ends standing.
  static MobiRig walk(double t, MobiRig b, double length) => _walk.run(t, b, len: length);
  static final MobiProgram _walk = _book.overlay('walk');

  /// How long a micro-fidget lasts, in seconds.
  static final double microLength = _idle('microSeconds');

  static final List<MobiProgram> _micros = [
    for (final k in _book.section('idle')['microKinds']! as List<Object?>) _book.overlay(k! as String),
  ];

  /// A small idle beat between the longer fidgets: 0 a quick glance aside and back, 1 an antenna
  /// twitch with a flick of the bulb.
  static MobiRig micro(int kind, double t, MobiRig b) => _micros[kind.clamp(0, _micros.length - 1)].run(t, b);

  // ---- Held stance motion ------------------------------------------------------------------

  /// The loading scan at [t] seconds into the stance with strength [w] (0 to 1): eyes sweep
  /// left and right, the bulb pulses, a slow sway.
  static MobiRig loadingLoop(double t, MobiRig b, double w) => _loading.run(t, b, w: w);
  static final MobiProgram _loading = _book.overlay('loading');

  /// How long a fidget lasts, in seconds.
  static final double fidgetLength = _idle('fidgetSeconds');

  static final List<MobiProgram> _fidgets = [
    for (final k in _book.section('idle')['fidgetKinds']! as List<Object?>) _book.overlay(k! as String),
  ];

  /// A small idle beat at [t] seconds: 0 smiles at the student (eyes come to the middle, warm,
  /// a small nod), 1 shifts its weight with a toe tap, 2 flicks the antenna with a dip and a
  /// flash of the bulb.
  static MobiRig fidget(int kind, double t, MobiRig b) => _fidgets[kind.clamp(0, _fidgets.length - 1)].run(t, b);

  /// One listening nod (0.7 s) at [t].
  static MobiRig listenNod(double t, MobiRig b) => _listenNod.run(t, b);
  static final MobiProgram _listenNod = _book.overlay('listenNod');

  /// A tap on Mobi ("boop", 0.45 s): squashes away from the touch, blinks happily, springs back.
  static MobiRig boop(double t, MobiRig b, double side) => _boop.run(t, b, side: side);
  static final MobiProgram _boop = _book.overlay('boop');

  /// A representative still frame of [act] for reduced motion and previews.
  static MobiRig keyPose(MobiAct act, {double pointAngle = 1.5, double pointSide = 1, MobiStance from = MobiStance.stand}) {
    final after = stanceAfter(act) ?? from;
    final base = stance(after, pointAngle: pointAngle, pointSide: pointSide);
    final key = _spec(act)['key'] as Map<String, Object?>?;
    if (key == null) return base;
    final at = (key['at'] as num?)?.toDouble();
    final overlay = key['overlay'] as String?;
    MobiRig r;
    if (overlay != null) {
      r = _book.overlay(overlay).run(at ?? 0, base, w: (key['w'] as num?)?.toDouble() ?? 1, len: (key['len'] as num?)?.toDouble() ?? 1);
    } else if (at != null) {
      r = MobiMoves.act(act, at, base);
    } else {
      r = base;
    }
    final set = key['set'] as Map<String, Object?>?;
    return set == null ? r : _book.setOver(r, set);
  }

  /// The still pose for [act] under reduced motion, played from stance [from]: the act's key pose
  /// with no travel (no hop, no step off its spot, no effects in flight), so the information is
  /// there without movement. A held act gives its stance.
  static MobiRig settledPose(MobiAct act, {MobiStance from = MobiStance.stand, double pointAngle = 1.5, double pointSide = 1}) {
    final k = keyPose(act, pointAngle: pointAngle, pointSide: pointSide, from: from);
    if (!showsStillPose(act)) return k;
    final base = stance(stanceAfter(act) ?? from, pointAngle: pointAngle, pointSide: pointSide);
    return k.copyWith(
      x: base.x,
      y: base.y,
      squash: base.squash,
      bootL: base.bootL,
      bootR: base.bootR,
      burst: -1,
      sparkle: -1,
      glint: -1,
    );
  }
}
