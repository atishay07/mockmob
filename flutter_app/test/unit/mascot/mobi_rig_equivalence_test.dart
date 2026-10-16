import 'package:flutter/animation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';

import 'mobi_legacy_moves.dart';

/// Rig v2 moved Mobi's choreography from hand-written functions into a data table, so the website
/// can play the same numbers. This proves the move changed nothing: every act that existed
/// before v2, every overlay, stance, key pose and mood plays the same rig from the table as from
/// the frozen functions, frame by frame, from several starting stances.

const double _tol = 1e-6;

List<double> _flat(MobiRig r) => [
      r.x, r.y, r.tilt, r.squash, r.lookX, r.lookY, r.antenna, r.burst, r.zzz, r.sheet, r.glow, r.glint, r.sparkle, r.bubble, //
      for (final e in [r.eyeL, r.eyeR]) ...[e.open, e.happy, e.lid, e.smile, e.slant],
      for (final a in [r.armL, r.armR]) ...[a.angle, a.bend, a.twist, a.front, a.point, a.reach],
      for (final b in [r.bootL, r.bootR]) ...[b.dx, b.dy, b.rot],
    ];

const List<String> _names = [
  'x', 'y', 'tilt', 'squash', 'lookX', 'lookY', 'antenna', 'burst', 'zzz', 'sheet', 'glow', 'glint', 'sparkle', 'bubble', //
  'eyeL.open', 'eyeL.happy', 'eyeL.lid', 'eyeL.smile', 'eyeL.slant', 'eyeR.open', 'eyeR.happy', 'eyeR.lid', 'eyeR.smile', 'eyeR.slant',
  'armL.angle', 'armL.bend', 'armL.twist', 'armL.front', 'armL.point', 'armL.reach',
  'armR.angle', 'armR.bend', 'armR.twist', 'armR.front', 'armR.point', 'armR.reach',
  'bootL.dx', 'bootL.dy', 'bootL.rot', 'bootR.dx', 'bootR.dy', 'bootR.rot',
];

void _same(MobiRig got, MobiRig want, String what) {
  final a = _flat(got), b = _flat(want);
  for (var i = 0; i < a.length; i++) {
    if ((a[i] - b[i]).abs() > _tol) fail('$what: ${_names[i]} is ${a[i]}, was ${b[i]}');
  }
}

/// The acts that existed before rig v2 (the frozen functions know only these).
const List<MobiAct> _legacyActs = [
  MobiAct.idle, MobiAct.appear, MobiAct.hello, MobiAct.talk, MobiAct.cheer, MobiAct.celebrate, MobiAct.think, MobiAct.point, //
  MobiAct.sleepy, MobiAct.oops, MobiAct.rest, MobiAct.read, MobiAct.correct, MobiAct.encourage, MobiAct.loading, MobiAct.sleep,
  MobiAct.nudge, MobiAct.proud, MobiAct.listen, MobiAct.wake, MobiAct.nod, MobiAct.tilt, MobiAct.wave, MobiAct.startle,
  MobiAct.brace, MobiAct.relief, MobiAct.walk,
];

void main() {
  final bases = <String, MobiRig>{
    'stand': MobiMoves.stance(MobiStance.stand),
    'point right': MobiMoves.stance(MobiStance.point),
    'point left': MobiMoves.stance(MobiStance.point, pointAngle: 1.1, pointSide: -1),
    'think': MobiMoves.stance(MobiStance.think),
    'read': MobiMoves.stance(MobiStance.read),
    'sleep': MobiMoves.stance(MobiStance.sleep),
    'listen': MobiMoves.stance(MobiStance.listen),
    'concerned': MobiMoods.apply(MobiMood.concerned, MobiMoves.stance(MobiStance.stand)),
  };

  test('every stance is the same rig', () {
    for (final s in MobiStance.values) {
      _same(MobiMoves.stance(s), LegacyMoves.stance(s), 'stance ${s.name}');
    }
    for (final (angle, side) in const [(0.6, 1.0), (1.5, -1.0), (2.6, 1.0)]) {
      _same(MobiMoves.stance(MobiStance.point, pointAngle: angle, pointSide: side), LegacyMoves.stance(MobiStance.point, pointAngle: angle, pointSide: side), 'point $angle $side');
    }
  });

  test('every pre-v2 act plays the same, frame by frame, from every stance', () {
    for (final act in _legacyActs) {
      expect(MobiMoves.duration(act), LegacyMoves.duration(act), reason: '${act.name} duration');
      expect(MobiMoves.stanceAfter(act), LegacyMoves.stanceAfter(act), reason: '${act.name} stance');
      expect(MobiMoves.isHeld(act), LegacyMoves.isHeld(act), reason: '${act.name} held');
      expect(MobiMoves.showsStillPose(act), LegacyMoves.showsStillPose(act), reason: '${act.name} still pose');
      final len = MobiMoves.duration(act);
      for (final b in bases.entries) {
        for (var t = 0.0; t <= len + 0.1; t += 1 / 60) {
          _same(MobiMoves.act(act, t, b.value), LegacyMoves.act(act, t, b.value), '${act.name} at ${t.toStringAsFixed(3)} from ${b.key}');
        }
      }
    }
  });

  test('overlays: talk, walk, the loading scan, nods, boops, fidgets and micro-fidgets', () {
    for (final b in bases.entries) {
      for (var t = 0.0; t <= 3; t += 1 / 60) {
        for (final w in const [0.3, 1.0]) {
          _same(MobiMoves.talk(t, b.value, w), LegacyMoves.talk(t, b.value, w), 'talk $t w $w from ${b.key}');
          _same(MobiMoves.loadingLoop(t, b.value, w), LegacyMoves.loadingLoop(t, b.value, w), 'loading $t from ${b.key}');
        }
        _same(MobiMoves.walk(t, b.value, 2.4), LegacyMoves.walk(t, b.value, 2.4), 'walk $t from ${b.key}');
        _same(MobiMoves.listenNod(t, b.value), LegacyMoves.listenNod(t, b.value), 'listen nod $t');
        for (final side in const [-0.6, 0.0, 1.0]) {
          _same(MobiMoves.boop(t, b.value, side), LegacyMoves.boop(t, b.value, side), 'boop $t side $side');
        }
        for (var k = 0; k < 3; k++) {
          _same(MobiMoves.fidget(k, t, b.value), LegacyMoves.fidget(k, t, b.value), 'fidget $k at $t');
        }
        for (var k = 0; k < 2; k++) {
          _same(MobiMoves.micro(k, t, b.value), LegacyMoves.micro(k, t, b.value), 'micro $k at $t');
        }
      }
    }
    expect(MobiMoves.stepLength, LegacyMoves.stepLength);
    expect(MobiMoves.fidgetLength, LegacyMoves.fidgetLength);
    expect(MobiMoves.microLength, LegacyMoves.microLength);
  });

  test('key poses and reduced-motion poses are the same', () {
    for (final act in _legacyActs) {
      for (final from in MobiStance.values) {
        for (final side in const [1.0, -1.0]) {
          _same(MobiMoves.keyPose(act, from: from, pointSide: side), LegacyMoves.keyPose(act, from: from, pointSide: side), 'key ${act.name} from ${from.name}');
          _same(MobiMoves.settledPose(act, from: from, pointSide: side), LegacyMoves.settledPose(act, from: from, pointSide: side), 'settled ${act.name} from ${from.name}');
        }
      }
    }
  });

  test('stance blends are the same', () {
    for (final s in MobiStance.values) {
      final (d, c) = MobiMoves.stanceBlend(s);
      final (ld, lc) = LegacyMoves.stanceBlend(s);
      expect(d, ld, reason: s.name);
      expect(c, lc, reason: s.name);
    }
  });

  test('the table evaluates Flutter curves number for number', () {
    for (final (name, curve) in const [
      ('easeInOutCubic', Curves.easeInOutCubic),
      ('easeOutBack', Curves.easeOutBack),
      ('easeOut', Curves.easeOut),
      ('easeInOutSine', Curves.easeInOutSine),
      ('easeOutCubic', Curves.easeOutCubic),
    ]) {
      final mine = MobiBook.instance.curve(name);
      for (var t = 0.0; t <= 1.0; t += 0.01) {
        expect(mine.transform(t), curve.transform(t), reason: '$name at $t');
      }
    }
  });
}
