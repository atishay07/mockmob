import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';

/// 15 Oct 2026: Mobi's emotions. New acts, moods, reactions (rate limit, Celebrations setting,
/// reduced motion), the tap cycle, the event table and the walker.
const List<MobiAct> _newActs = [MobiAct.nod, MobiAct.tilt, MobiAct.wave, MobiAct.startle, MobiAct.brace, MobiAct.relief, MobiAct.walk];

Widget _host(Widget child, {bool reduced = false, MobiCelebrationLevel level = MobiCelebrationLevel.full}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduced),
        child: ReducedMotionSetting(
          enabled: reduced,
          child: MobiCelebrations(level: level, child: Center(child: child)),
        ),
      ),
    );

/// Pumps [d] in 60 fps frames (the character steps at most 0.25 s per frame).
Future<void> _frames(WidgetTester tester, Duration d) async {
  for (var t = Duration.zero; t < d; t += const Duration(milliseconds: 16)) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// The rig the painter of the only Mobi on screen is drawing.
MobiRig _rigOf(WidgetTester tester) {
  final paint = tester.widget<CustomPaint>(find.descendant(of: find.byType(MobiCharacter), matching: find.byType(CustomPaint)).first);
  return (paint.painter! as dynamic).rig.value as MobiRig;
}

void main() {
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  group('acts', () {
    test('every existing act keeps its name and index', () {
      const names = [
        'idle', 'appear', 'hello', 'talk', 'cheer', 'celebrate', 'think', 'point', 'sleepy', 'oops', 'rest', 'read', //
        'correct', 'encourage', 'loading', 'sleep', 'nudge', 'proud', 'listen', 'wake',
      ];
      for (var i = 0; i < names.length; i++) {
        expect(MobiAct.values[i].name, names[i]);
      }
      expect(MobiAct.values.sublist(names.length), _newActs);
    });

    test('each new act moves, then returns to where it started', () {
      for (final act in _newActs) {
        const base = MobiRig();
        final len = MobiMoves.duration(act);
        var moved = 0.0;
        for (var t = 0.0; t <= len; t += 1 / 60) {
          final r = MobiMoves.act(act, t, base);
          moved = [moved, (r.y - base.y).abs(), (r.tilt - base.tilt).abs() * 40, (r.armR.angle - base.armR.angle).abs() * 10].reduce((a, b) => a > b ? a : b);
        }
        expect(moved, greaterThan(0.5), reason: '$act should visibly move');
        final end = MobiMoves.act(act, len, base);
        expect(end.y, closeTo(base.y, 0.05), reason: '$act ends on its spot');
        expect(end.tilt, closeTo(base.tilt, 0.01), reason: '$act ends upright');
        expect(end.armR.angle, closeTo(base.armR.angle, 0.02), reason: '$act ends with the arm down');
      }
    });

    test('the walk lasts as long as its trip and ends standing', () {
      final sim = MobiSim(seed: 3);
      sim.play(MobiAct.walk, seconds: 2.4);
      var lifted = 0.0;
      for (var i = 0; i < 60 * 2; i++) {
        final r = sim.step(1 / 60);
        lifted = r.bootL.dy < lifted ? r.bootL.dy : lifted;
      }
      expect(lifted, lessThan(-2), reason: 'the boots step');
      expect(sim.act, MobiAct.walk, reason: 'still walking at 2 s of a 2.4 s trip');
      sim.run(0.6);
      expect(sim.act, isNull);
      expect(sim.stance, MobiStance.stand);
    });

    test('reactions played from a held stance return to that stance', () {
      for (final act in [MobiAct.nod, MobiAct.tilt, MobiAct.startle, MobiAct.brace, MobiAct.relief]) {
        final sim = MobiSim(seed: 2)..play(MobiAct.read);
        sim.run(1);
        sim.play(act);
        sim.run(MobiMoves.duration(act) + 0.2);
        expect(sim.stance, MobiStance.read, reason: '$act keeps the reading stance');
      }
    });
  });

  group('moods', () {
    test('calm changes nothing; every other mood changes the face', () {
      const r = MobiRig();
      final calm = MobiMoods.apply(MobiMood.calm, r);
      expect(identical(calm, r), isTrue);
      for (final m in MobiMood.values.where((m) => m != MobiMood.calm)) {
        final f = MobiMoods.apply(m, r);
        final face = (f.eyeL.smile - r.eyeL.smile).abs() + (f.eyeL.lid - r.eyeL.lid).abs() + (f.eyeR.open - r.eyeR.open).abs() + f.eyeL.slant.abs();
        expect(face, greaterThan(0.05), reason: '$m shows on the face');
      }
    });

    test('concerned is soft: a gentle slope with a warm lower lid, eyes still open', () {
      final f = MobiMoods.apply(MobiMood.concerned, const MobiRig());
      expect(f.eyeL.slant, inInclusiveRange(0.2, 0.5));
      expect(f.eyeL.smile, greaterThan(0));
      expect(f.eyeL.open, 1);
      expect(f.eyeL.happy, 0);
    });

    test('a mood blends in over 300 ms and stays under acts', () {
      final sim = MobiSim(seed: 4);
      sim.run(0.2);
      sim.setMood(MobiMood.sleepy);
      final half = sim.step(0.15);
      expect(half.eyeL.lid, inExclusiveRange(0.0, 0.34));
      sim.run(0.3);
      expect(sim.rig.eyeL.lid, closeTo(0.34, 0.001));
      sim.play(MobiAct.nod);
      sim.run(0.4);
      expect(sim.rig.eyeL.lid, greaterThan(0.3), reason: 'the mood stays under the act');
      expect(sim.mood, MobiMood.sleepy);
    });

    test('the controller keeps the mood for a Mobi that attaches later', () {
      final c = MobiController()..setMood(MobiMood.curious);
      expect(c.mood, MobiMood.curious);
      c.dispose();
    });
  });

  group('react', () {
    test('rate-limits per key and leaves other keys alone', () {
      var now = DateTime(2026, 10, 15, 10);
      MobiRation.now = () => now;
      expect(MobiRation.reactNow('save'), isTrue);
      expect(MobiRation.reactNow('save'), isFalse);
      expect(MobiRation.reactNow('answer'), isTrue);
      now = now.add(MobiRation.glanceGap);
      expect(MobiRation.reactNow('save'), isTrue);
      expect(MobiRation.reactNow('save', gap: Duration.zero), isTrue);
    });

    test('a keyed reaction before Mobi is on screen still counts against the gap', () {
      MobiRation.now = () => DateTime(2026, 10, 15, 10);
      final c = MobiController();
      expect(c.react(MobiAct.nod, key: 'k'), isTrue);
      expect(c.react(MobiAct.nod, key: 'k'), isFalse);
      expect(c.react(MobiAct.nod), isTrue, reason: 'no key, no limit');
      c.dispose();
    });

    testWidgets('celebrations calm under Quiet and play nothing under Off', (tester) async {
      final quiet = MobiController();
      addTearDown(quiet.dispose);
      await tester.pumpWidget(_host(MobiCharacter(controller: quiet, entrance: MobiAct.idle, watchTaps: false), level: MobiCelebrationLevel.quiet));
      await tester.pump(const Duration(milliseconds: 600));
      expect(quiet.react(MobiAct.celebrate), isTrue);
      await tester.pump(const Duration(milliseconds: 300));
      // Quiet: the big jump becomes the small right-answer hop (never above 13 design units).
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 33));
        expect(_rigOf(tester).y, greaterThan(-14));
        expect(_rigOf(tester).burst, lessThan(0), reason: 'no confetti under Quiet');
      }

      final off = MobiController();
      addTearDown(off.dispose);
      await tester.pumpWidget(_host(MobiCharacter(controller: off, entrance: MobiAct.idle, watchTaps: false), level: MobiCelebrationLevel.off));
      await tester.pump(const Duration(milliseconds: 600));
      expect(off.react(MobiAct.proud), isFalse);
      expect(off.react(MobiAct.nod), isTrue, reason: 'small reactions still play under Off');
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('under reduced motion a reaction shows its still pose with no travel, then the stance', (tester) async {
      final c = MobiController();
      addTearDown(c.dispose);
      await tester.pumpWidget(_host(MobiCharacter(controller: c, entrance: MobiAct.idle, watchTaps: false), reduced: true));
      expect(c.react(MobiAct.startle), isTrue);
      await tester.pump();
      final still = _rigOf(tester);
      expect(still.y, 0, reason: 'no hop');
      expect(still.x, 0, reason: 'no step off the spot');
      expect(still.eyeL.open, greaterThan(1), reason: 'the wide eyes still say it');
      expect(tester.hasRunningAnimations, isFalse);
      await tester.pump(Duration(milliseconds: (MobiMoves.duration(MobiAct.startle) * 1000).round() + 50));
      final after = _rigOf(tester);
      expect(after.eyeL.open, 1);
      expect(after.y, 0);
    });

    test('settled poses keep every act on its spot', () {
      for (final act in MobiAct.values) {
        final r = MobiMoves.settledPose(act);
        final base = MobiMoves.stance(MobiMoves.stanceAfter(act) ?? MobiStance.stand);
        if (MobiMoves.reactions.contains(act) || MobiRation.celebrations.contains(act)) {
          expect(r.y, base.y, reason: '$act');
          expect(r.x, base.x, reason: '$act');
          expect(r.burst, lessThan(0), reason: '$act');
        }
      }
      // A held act settles to its stance.
      expect(MobiMoves.settledPose(MobiAct.read).sheet, 1);
    });
  });

  group('tap cycle', () {
    test('escalates through the standard cycle and never repeats an act back to back', () {
      final run = MobiTapCycle.standard.start();
      var t = DateTime(2026, 10, 15, 10);
      final played = <MobiAct?>[];
      for (var i = 0; i < 6; i++) {
        played.add(run.tap(t));
        t = t.add(const Duration(milliseconds: 600));
      }
      expect(played.take(4), [MobiAct.hello, MobiAct.tilt, MobiAct.correct, MobiAct.startle]);
      for (var i = 1; i < played.length; i++) {
        expect(played[i], isNot(played[i - 1]));
      }
    });

    test('resets after 8 s still, without repeating the last act', () {
      final run = MobiTapCycle.standard.start();
      var t = DateTime(2026, 10, 15, 10);
      expect(run.tap(t), MobiAct.hello);
      t = t.add(const Duration(seconds: 1));
      expect(run.tap(t), MobiAct.tilt);
      t = t.add(const Duration(seconds: 8));
      expect(run.tap(t), MobiAct.hello, reason: 'starts over');
      // Only one tap, then a pause: the restart would repeat hello, so it moves on.
      t = t.add(const Duration(seconds: 9));
      expect(run.tap(t), MobiAct.tilt);
    });

    test('caps at 6 acts per visit; later taps only squash', () {
      final run = MobiTapCycle.standard.start();
      var t = DateTime(2026, 10, 15, 10);
      for (var i = 0; i < 6; i++) {
        expect(run.tap(t), isNotNull);
        t = t.add(const Duration(seconds: 1));
      }
      expect(run.tap(t), isNull);
      expect(run.tap(t.add(const Duration(seconds: 20))), isNull, reason: 'the cap lasts the visit');
      expect(run.played, 6);
    });

    testWidgets('a tapped Mobi with a cycle plays it', (tester) async {
      await tester.pumpWidget(_host(const MobiCharacter(entrance: MobiAct.idle, interactive: true, tapCycle: MobiTapCycle.standard, watchTaps: false)));
      await tester.pump(const Duration(milliseconds: 800));
      await tester.tap(find.byType(MobiCharacter));
      await _frames(tester, const Duration(milliseconds: 600));
      // hello raises the left mitten well above its rest.
      expect(_rigOf(tester).armL.angle, greaterThan(1.5));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });
  });

  group('events', () {
    test('every event maps to an act, including the 15 Oct ones', () {
      const expected = {
        MobiEvent.answerRight: MobiAct.correct,
        MobiEvent.answerWrong: MobiAct.encourage,
        MobiEvent.saveConfirmed: MobiAct.nod,
        MobiEvent.saveFailed: MobiAct.oops,
        MobiEvent.waitLong: MobiAct.loading,
        MobiEvent.choiceWitnessed: MobiAct.listen,
        MobiEvent.dayCounted: MobiAct.correct,
        MobiEvent.goalMet: MobiAct.proud,
        MobiEvent.refused: MobiAct.oops,
        MobiEvent.goodbye: MobiAct.wave,
        MobiEvent.lateNight: MobiAct.sleepy,
      };
      expected.forEach((e, a) => expect(MobiMoments.act(e), a, reason: e.name));
      for (final e in MobiEvent.values) {
        expect(MobiMoments.act(e), isA<MobiAct>());
      }
      expect(MobiMoments.act(MobiEvent.answerRight), MobiMoments.act(MobiEvent.rightAnswer));
      expect(MobiMoments.act(MobiEvent.answerWrong), MobiMoments.act(MobiEvent.wrongAnswer));
    });
  });

  group('follow and walk', () {
    testWidgets('the eyes follow a finger and drift back 1.2 s after it stops', (tester) async {
      final c = MobiController();
      addTearDown(c.dispose);
      await tester.pumpWidget(_host(MobiCharacter(controller: c, entrance: MobiAct.idle, watchTaps: false, followPointer: true)));
      await tester.pump(const Duration(milliseconds: 800));
      final centre = tester.getCenter(find.byType(MobiCharacter));
      final g = await tester.startGesture(centre + const Offset(300, 0));
      await _frames(tester, const Duration(milliseconds: 400));
      expect(_rigOf(tester).lookX, greaterThan(0.6));
      expect(_rigOf(tester).lookX, lessThanOrEqualTo(0.86), reason: 'clamped inside the visor');
      await g.up();
      await _frames(tester, const Duration(milliseconds: 1800));
      expect(_rigOf(tester).lookX.abs(), lessThan(0.3));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('the walker carries Mobi to toX and hands back the controller', (tester) async {
      MobiController? arrived;
      await tester.pumpWidget(_host(MobiWalker(size: 72, fromX: 0, toX: 120, duration: const Duration(milliseconds: 900), onArrive: (c) => arrived = c)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 450));
      final mid = tester.getTopLeft(find.byType(MobiCharacter)).dx - tester.getTopLeft(find.byType(MobiWalker)).dx;
      expect(mid, inExclusiveRange(10, 110));
      await tester.pump(const Duration(milliseconds: 600));
      expect(arrived, isNotNull);
      expect(tester.getTopLeft(find.byType(MobiCharacter)).dx - tester.getTopLeft(find.byType(MobiWalker)).dx, closeTo(120, 0.5));
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('under reduced motion the walker stands at toX and arrives at once', (tester) async {
      MobiController? arrived;
      await tester.pumpWidget(_host(MobiWalker(size: 72, fromX: 0, toX: 120, onArrive: (c) => arrived = c), reduced: true));
      await tester.pump();
      expect(arrived, isNotNull);
      expect(tester.getTopLeft(find.byType(MobiCharacter)).dx - tester.getTopLeft(find.byType(MobiWalker)).dx, closeTo(120, 0.5));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('idle', () {
    test('a Mobi left standing does something small every 6 to 9 s', () {
      final sim = MobiSim(seed: 9);
      final frames = <MobiRig>[];
      for (var i = 0; i < 60 * 20; i++) {
        frames.add(sim.step(1 / 60));
      }
      // In every 9.5 s window the eyes or the antenna make a visible beat (a glance, a twitch).
      const window = 60 * 19 ~/ 2;
      for (var start = 0; start + window <= frames.length; start += 30) {
        var beat = false;
        for (var i = start; i < start + window && !beat; i++) {
          beat = frames[i].antenna.abs() > 0.05 || frames[i].lookX.abs() > 0.2;
        }
        expect(beat, isTrue, reason: 'a beat between ${start / 60} s and ${(start + window) / 60} s');
      }
    });
  });
}
