import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/motion/motion_tokens.g.dart';
import 'package:mockmob/core/router/transitions.dart' show FadingBranchContainer;

/// shared/motion-tokens.json, the one source for the app and the website.
final Map<String, dynamic> _tokens =
    jsonDecode(File('../shared/motion-tokens.json').readAsStringSync()) as Map<String, dynamic>;

Object? _at(String path) {
  Object? node = _tokens;
  for (final part in path.split('.')) {
    node = (node as Map<String, dynamic>)[part];
  }
  return node;
}

List<double> _cubic(Cubic c) => [c.a, c.b, c.c, c.d];

List<double> _doubles(Object? list) => [for (final x in list! as List) (x as num).toDouble()];

void _sameSpring(SpringDescription actual, int ms, double bounce, String name) {
  final want = SpringDescription.withDurationAndBounce(duration: Duration(milliseconds: ms), bounce: bounce);
  expect(actual.mass, want.mass, reason: name);
  expect(actual.stiffness, closeTo(want.stiffness, 1e-9), reason: name);
  expect(actual.damping, closeTo(want.damping, 1e-9), reason: name);
}

class _Calls implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selectionClick');

  @override
  Future<void> lightImpact() async => calls.add('lightImpact');

  @override
  Future<void> mediumImpact() async => calls.add('mediumImpact');
}

void main() {
  group('generated tokens', () {
    test('motion_tokens.g.dart matches shared/motion-tokens.json (run tool/gen_motion_tokens.py)', () {
      expect(motionTokensVersion, _tokens['version']);
      for (final e in motionTokenTable.entries) {
        final want = _at(e.key);
        final got = e.value;
        switch (got) {
          case Duration d when want is List:
            expect(d.inMilliseconds, want.whereType<int>().single, reason: e.key);
          case Duration d:
            expect(d.inMilliseconds, want, reason: e.key);
          case Cubic c:
            final points = want is String ? (_tokens['curves'] as Map<String, dynamic>)[want] : want;
            expect(_cubic(c), _doubles(points), reason: e.key);
          case int n:
            expect(n, want, reason: e.key);
          case double n:
            expect(n, (want! as num).toDouble(), reason: e.key);
          default:
            fail('${e.key}: unexpected ${got.runtimeType}');
        }
      }
    });

    test('every JSON token has a generated constant', () {
      final paths = <String>[
        for (final k in (_tokens['durations'] as Map).keys) 'durations.$k',
        for (final k in (_tokens['curves'] as Map).keys) 'curves.$k',
        for (final k in (_tokens['springs'] as Map).keys) ...['springs.$k.ms', 'springs.$k.bounce'],
        for (final k in (_tokens['numbers'] as Map).keys) 'numbers.$k',
        for (final k in (_tokens['counts'] as Map).keys) 'counts.$k',
        for (final g in (_tokens['transitions'] as Map<String, dynamic>).entries)
          for (final k in (g.value as Map).keys) 'transitions.${g.key}.$k',
      ];
      expect(paths.where((p) => !motionTokenTable.containsKey(p)), isEmpty);
    });
  });

  group('no value changed (15 Oct 2026 values, before the tokens)', () {
    test('durations', () {
      final today = <String, (Duration, int)>{
        'glideDuration': (Motion.glideDuration, 300),
        'exitDuration': (Motion.exitDuration, 200),
        'emphasizedDuration': (Motion.emphasizedDuration, 420),
        'sweep': (Motion.sweep, 700),
        'engrave': (Motion.engrave, 280),
        'numberRoll': (Motion.numberRoll, 500),
        'ink': (Motion.ink, 260),
        'crossFade': (Motion.crossFade, 200),
        'press': (Motion.press, 100),
        'release': (Motion.release, 140),
        'ui': (Motion.ui, 200),
        'card': (Motion.card, 240),
        'result': (Motion.result, 320),
        'figureRoll': (Motion.figureRoll, 500),
        'milestone': (Motion.milestone, 500),
        'tabSwitch': (Motion.tabSwitch, 180),
        'pagePush': (Motion.pagePush, 300),
        'pagePop': (Motion.pagePop, 220),
        'runner': (Motion.runner, 160),
        'sheetIn': (Motion.sheetIn, 420),
        'sheetOut': (Motion.sheetOut, 240),
        'reducedFade': (Motion.reducedFade, 120),
        'staggerStep': (Motion.staggerStep, 45),
        'enterDuration': (Motion.enterDuration, 360),
        'fadeThroughOut': (Motion.fadeThroughOut, 90),
        'fadeThroughIn': (Motion.fadeThroughIn, 210),
        'countUp': (Motion.countUp, 720),
        'shimmerSweep': (Motion.shimmerSweep, 1400),
        'shimmerRest': (Motion.shimmerRest, 250),
        'leaveDuration': (Motion.leaveDuration, 180),
        'momentT2': (Motion.momentT2, 1200),
        'momentT3': (Motion.momentT3, 2000),
        'handOffOut': (Motion.handOffOut, 180),
        'handOffIn': (Motion.handOffIn, 300),
        'drawIn': (Motion.drawIn, 450),
      };
      for (final e in today.entries) {
        expect(e.value.$1, Duration(milliseconds: e.value.$2), reason: e.key);
      }
    });

    test('curves', () {
      expect(_cubic(Motion.glide), [0.15, 0.5, 0.5, 1.0]);
      expect(_cubic(Motion.exit), [0.4, 0.3, 0.8, 0.6]);
      expect(_cubic(Motion.emphasized), [0.16, 1.0, 0.3, 1.0]);
      expect(_cubic(Motion.sweepCurve), [0.45, 0.0, 0.55, 1.0]);
      expect(_cubic(Motion.out), [0.23, 1.0, 0.32, 1.0]);
      expect(_cubic(Motion.drawer), [0.32, 0.72, 0.0, 1.0]);
      expect(_cubic(Motion.inOut), [0.77, 0.0, 0.175, 1.0]);
      expect(_cubic(Motion.leave), [0.5, 0.0, 0.75, 0.0]);
    });

    test('choreography numbers', () {
      expect(Motion.staggerCap, 8);
      expect(Motion.enterRise, 14);
      expect(Motion.enterScale, 0.97);
      expect(Motion.axisTravel, 28);
      expect(Motion.recedeShare, 0.22);
      expect(Motion.recedeScrim, 0.45);
      expect(Motion.fadeThroughScale, 0.985);
      expect(Motion.shimmerSweeps, 4);
      expect(Springs.pressedScale, 0.96);
      expect(MmOverlapSwitcher.releaseAt, 0.5);
      expect(MmOverlapSwitcher.floor, 0.7);
      expect(const MmOverlapSwitcher(child: SizedBox()).outDuration, const Duration(milliseconds: 90));
    });

    test('springs', () {
      _sameSpring(Springs.smooth, 360, 0.12, 'smooth');
      _sameSpring(Springs.snappy, 220, 0, 'snappy');
      _sameSpring(Springs.dock, 360, 0.18, 'dock');
      _sameSpring(Springs.settle, 420, 0, 'settle');
      _sameSpring(Springs.release, 300, 0.1, 'release');
      _sameSpring(Springs.edgeLead, 260, 0.12, 'edgeLead');
      _sameSpring(Springs.edgeTrail, 440, 0.04, 'edgeTrail');
      _sameSpring(Springs.iconPop, 420, 0.18, 'iconPop');
      _sameSpring(Springs.celebrate, 520, 0.22, 'celebrate');
      _sameSpring(Springs.toggle, 240, 0.14, 'toggle');
      _sameSpring(Springs.lift, 300, 0, 'lift');
    });
  });

  test('transitions in the JSON are the ones the router draws', () {
    expect(MotionTransitions.placeOut, FadingBranchContainer.fadeOut);
    expect(MotionTransitions.placeIn, FadingBranchContainer.fadeIn);
    expect(MotionTransitions.placeSlide, FadingBranchContainer.slide);
    expect(MotionTransitions.placeDrift, FadingBranchContainer.drift);
    expect(MotionTransitions.placeInCurve, Motion.glide);
    expect(MotionTransitions.placeOutCurve, Motion.exit);
    expect(MotionTransitions.pushIn, Motion.pagePush);
    expect(MotionTransitions.pushOut, Motion.pagePop);
    expect(MotionTransitions.pushTravel, Motion.axisTravel);
    expect(MotionTransitions.pushRecedeShare, Motion.recedeShare);
    expect(MotionTransitions.pushRecedeScrim, Motion.recedeScrim);
    expect(MotionTransitions.pushCurve, Motion.glide);
    expect(MotionTransitions.riseIn, Motion.glideDuration + const Duration(milliseconds: 40));
    expect(MotionTransitions.riseOut, Motion.pagePop);
    expect(MotionTransitions.riseFromScale, Motion.enterScale);
    expect(MotionTransitions.containerIn, Motion.emphasizedDuration);
    expect(MotionTransitions.fadeIn, Motion.runner);
    expect(MotionTransitions.sheetIn, Motion.sheetIn);
    expect(MotionTransitions.sheetOut, Motion.sheetOut);
    expect(MotionTransitions.reducedIn, Motion.reducedFade);
  });

  group('haptics in the JSON are the ones the app plays', () {
    test('the verbs are the same names, in the same order', () {
      final verbs = (_tokens['haptics'] as Map<String, dynamic>)['verbs'] as Map<String, dynamic>;
      expect(HapticVerb.values.map((v) => v.name).toList(), verbs.keys.toList());
    });

    test('a phone without the verbs plays the JSON fallback; the base calls match', () async {
      final verbs = (_tokens['haptics'] as Map<String, dynamic>)['verbs'] as Map<String, dynamic>;
      final base = (_tokens['haptics'] as Map<String, dynamic>)['base'] as Map<String, dynamic>;
      Future<List<String>> play(Future<void> Function(Haptics h) call) async {
        final driver = _Calls();
        await call(Haptics(enabled: true, driver: driver));
        return driver.calls;
      }

      final byVerb = <String, Future<void> Function(Haptics h)>{
        'confirm': (h) => h.confirm(),
        'gestureStart': (h) => h.gestureStart(),
        'gestureEnd': (h) => h.gestureEnd(),
        'segmentTick': (h) => h.segmentTick(),
        'toggleOn': (h) => h.toggle(true),
        'toggleOff': (h) => h.toggle(false),
      };
      for (final e in verbs.entries) {
        final want = ((e.value as Map<String, dynamic>)['fallback'] as List).whereType<String>().toList();
        expect(await play(byVerb[e.key]!), want, reason: e.key);
      }
      final byBase = <String, Future<void> Function(Haptics h)>{
        'tick': (h) => h.tick(),
        'settle': (h) => h.settle(),
        'open': (h) => h.open(),
        'warn': (h) => h.warn(),
      };
      for (final e in base.entries) {
        final want = ((e.value as Map<String, dynamic>)['flutter'] as List).whereType<String>().toList();
        expect(await play(byBase[e.key]!), want, reason: e.key);
      }
    });
  });
}
