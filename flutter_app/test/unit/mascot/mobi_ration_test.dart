import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_details.dart';
import 'package:mockmob/core/mascot/mobi_painter.dart';
import 'package:mockmob/core/mascot/mobi_palette.dart';

import '../../helpers/golden_harness.dart';

/// UI phase 2 (14 Oct 2026): Mobi's discipline (MOTION.md 1.3 and P1-4), the Celebrations
/// setting, next-frame touch response, the Daylight forms of his light (1.4) and the contact
/// shadow set once (SPACING.md 8.4).
const Color _nightGround = Color(0xFF131210);
const Color _dayGround = Color(0xFFF2EEE6);

/// RGBA bytes of a drawing in a 180 by 180 design-unit area at 2x.
Future<List<int>> _render(WidgetTester tester, void Function(Canvas) draw, Color ground) async {
  late List<int> out;
  await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawColor(ground, BlendMode.src);
    canvas.scale(2);
    draw(canvas);
    final image = await recorder.endRecording().toImage(360, 360);
    out = (await image.toByteData())!.buffer.asUint8List().toList();
    image.dispose();
  });
  return out;
}

MobiRig _rigOf(WidgetTester tester) =>
    (tester.widget<CustomPaint>(find.descendant(of: find.byType(MobiCharacter), matching: find.byType(CustomPaint))).painter! as MobiPainter)
        .rig
        .value;

void main() {
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  group('gates', () {
    test('hello once a day per screen, again the next day', () {
      var now = DateTime(2026, 10, 14, 9);
      MobiRation.now = () => now;
      expect(MobiRation.helloToday('you'), isTrue);
      expect(MobiRation.helloToday('you'), isFalse);
      expect(MobiRation.helloToday('ask'), isTrue, reason: 'each screen has its own gate');
      now = DateTime(2026, 10, 14, 22);
      expect(MobiRation.helloToday('you'), isFalse);
      now = DateTime(2026, 10, 15, 8);
      expect(MobiRation.helloToday('you'), isTrue);
    });

    test('the greeting waves once, then stands; late at night it is sleepy', () {
      MobiRation.now = () => DateTime(2026, 10, 14, 18);
      expect(MobiRation.greeting('you'), MobiAct.hello);
      expect(MobiRation.greeting('you'), MobiAct.idle);
      expect(MobiRation.greeting('you', otherwise: MobiAct.rest), MobiAct.rest);
      MobiRation.now = () => DateTime(2026, 10, 14, 23, 30);
      expect(MobiRation.greeting('ask'), MobiAct.sleepy);
    });

    test('a nudge once per screen per day, and only after four seconds of quiet', () {
      MobiRation.now = () => DateTime(2026, 10, 14, 18);
      expect(MobiRation.nudgeAfter, const Duration(seconds: 4));
      expect(MobiRation.nudgeToday('today'), isTrue);
      expect(MobiRation.nudgeToday('today'), isFalse);
    });

    test('oops once per failure run, again after a recovery', () {
      expect(MobiRation.oops('today'), isTrue);
      expect(MobiRation.oops('today'), isFalse, reason: 'a retry that fails again stays calm');
      expect(MobiRation.oops('review'), isTrue);
      MobiRation.recovered('today');
      expect(MobiRation.oops('today'), isTrue);
    });

    test('a screen speaks once per app run', () {
      final controller = MobiController();
      addTearDown(controller.dispose);
      expect(controller.sayOnce('result', 'Recorded.'), isTrue);
      expect(controller.speech.value?.text, 'Recorded.');
      controller.hush();
      expect(controller.sayOnce('result', 'Recorded again.'), isFalse);
      expect(controller.speech.value, isNull);
    });

    test('the Celebrations setting maps onto the Mobi level by name, one mapping for everyone', () {
      expect(MobiCelebrationLevel.fromName('full'), MobiCelebrationLevel.full);
      expect(MobiCelebrationLevel.fromName('quiet'), MobiCelebrationLevel.quiet);
      expect(MobiCelebrationLevel.fromName('off'), MobiCelebrationLevel.off);
      expect(MobiCelebrationLevel.fromName(null), MobiCelebrationLevel.full);
      expect(MobiCelebrationLevel.fromName('loud'), MobiCelebrationLevel.full);
      for (final level in MobiCelebrationLevel.values) {
        expect(celebrationLevelFor(level), level);
      }
    });

    test('the Celebrations setting calms the big acts and leaves the rest', () {
      for (final act in MobiRation.celebrations) {
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.full), act);
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.quiet), MobiAct.nod, reason: 'Quiet is a small nod');
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.quiet, held: true), MobiAct.rest, reason: 'a held hero rests');
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.off), isNull);
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.off, held: true), isNull);
      }
      for (final act in [MobiAct.hello, MobiAct.point, MobiAct.oops, MobiAct.correct, MobiAct.talk]) {
        expect(MobiRation.underLevel(act, MobiCelebrationLevel.off), act, reason: act.name);
      }
    });
  });

  group('character', () {
    testWidgets('glances at taps elsewhere at most once every 2.5 s', (tester) async {
      var now = DateTime(2026, 10, 14, 18);
      MobiRation.now = () => now;
      await pumpMockmob(
        tester,
        const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          MobiCharacter(size: 100, entrance: MobiAct.idle),
          SizedBox(height: 200),
          SizedBox(key: ValueKey('target'), width: 60, height: 60),
        ]),
      );
      await tester.pumpAndSettle();
      final target = tester.getCenter(find.byKey(const ValueKey('target')));
      await tester.tapAt(target);
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue, reason: 'the first tap gets a glance');
      await tester.pumpAndSettle();

      now = now.add(const Duration(milliseconds: 1500));
      await tester.tapAt(target);
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isFalse, reason: 'a second tap inside the gap is let go');

      now = now.add(const Duration(milliseconds: 1100));
      await tester.tapAt(target);
      await tester.pump();
      expect(tester.binding.hasScheduledFrame, isTrue, reason: 'after the gap he glances again');
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('a touch on Mobi is answered on the next frame, before the finger lifts', (tester) async {
      await pumpMockmob(tester, const Center(child: MobiCharacter(entrance: MobiAct.idle, interactive: true)));
      await tester.pumpAndSettle();
      expect(_rigOf(tester).squash.abs(), lessThan(0.01));
      final gesture = await tester.startGesture(tester.getCenter(find.byType(MobiCharacter)));
      await tester.pump(const Duration(milliseconds: 16));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(_rigOf(tester).squash, lessThan(-0.02), reason: 'the squash has begun while the finger is down');
      await gesture.up();
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('Quiet turns a celebration into a nod with no confetti; Off plays nothing', (tester) async {
      for (final level in [MobiCelebrationLevel.quiet, MobiCelebrationLevel.off]) {
        final controller = MobiController();
        await pumpMockmob(
          tester,
          MobiCelebrations(level: level, child: Center(child: MobiCharacter(controller: controller, entrance: MobiAct.idle, watchTaps: false))),
        );
        await tester.pumpAndSettle();
        controller.play(MobiAct.celebrate);
        var burst = false;
        var bubble = false;
        var top = 0.0;
        var low = 0.0;
        for (var i = 0; i < 150; i++) {
          await tester.pump(const Duration(milliseconds: 16));
          final rig = _rigOf(tester);
          if (rig.burst >= 0 || rig.sparkle >= 0) burst = true;
          if (rig.bubble >= 0) bubble = true;
          if (rig.y < top) top = rig.y;
          if (rig.y > low) low = rig.y;
        }
        expect(burst, isFalse, reason: '${level.name}: no confetti, no glints');
        expect(bubble, isFalse, reason: '${level.name}: no answer bubble either');
        if (level == MobiCelebrationLevel.quiet) {
          expect(low, greaterThan(1), reason: 'quiet: the small nod dips him');
          expect(top, greaterThan(-4), reason: 'quiet: a nod, never a hop');
        } else {
          expect(top, greaterThan(-1.5), reason: 'off: no hop');
        }
        await tester.pumpAndSettle();
        await tester.pumpWidget(const SizedBox());
        controller.dispose();
      }
    });

    testWidgets('under a sheet Mobi looks down at it, and ahead again when it goes', (tester) async {
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => Column(mainAxisAlignment: MainAxisAlignment.start, children: [
            const MobiCharacter(size: 100, entrance: MobiAct.idle, watchTaps: false),
            TextButton(
              onPressed: () => showModalBottomSheet<void>(context: context, builder: (_) => const SizedBox(height: 200)),
              child: const Text('Open'),
            ),
          ]),
        ),
      );
      await tester.pumpAndSettle();
      final ahead = _rigOf(tester).lookY;
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(_rigOf(tester).lookY, greaterThan(ahead + 0.3), reason: 'he looks down at the sheet');
      Navigator.of(tester.element(find.text('Open'))).pop();
      await tester.pumpAndSettle();
      expect(_rigOf(tester).lookY, closeTo(ahead, 0.15), reason: 'and ahead again');
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('bubble', () {
    testWidgets('a line already typed is not retyped when the insets or text scale change', (tester) async {
      const line = 'Ten minutes tonight?';
      final insets = ValueNotifier<double>(0);
      addTearDown(insets.dispose);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<double>(
          valueListenable: insets,
          builder: (context, bottom, _) => MediaQuery(
            data: MediaQuery.of(context).copyWith(viewInsets: EdgeInsets.only(bottom: bottom), textScaler: TextScaler.linear(1 + bottom / 1000)),
            child: const Center(child: MobiBubble(speech: MobiSpeech(line, id: 1))),
          ),
        ),
      );
      await tester.pumpAndSettle();
      String shown() =>
          (tester.widget<RichText>(find.descendant(of: find.byType(MobiBubble), matching: find.byType(RichText))).text as TextSpan)
              .children!
              .first
              .toPlainText();
      expect(shown(), line);
      insets.value = 300;
      await tester.pump();
      expect(shown(), line, reason: 'the keyboard opening keeps the whole line');
      expect(tester.binding.hasScheduledFrame, isFalse, reason: 'nothing retypes');
    });
  });

  group('daylight', () {
    testWidgets('the contact shadow is black 24% at Night and sepia 12% in Daylight, at most', (tester) async {
      expect(MobiPalette.nightPalette.shadowAlpha, 0.24);
      expect(MobiPalette.dayPalette.shadowAlpha, 0.12);
      for (final p in [MobiPalette.nightPalette, MobiPalette.dayPalette]) {
        final ground = p.night ? _nightGround : _dayGround;
        void draw(Canvas c, bool shadow) {
          c.translate(20, 4);
          paintRig(c, const MobiRig(), p, shadow: shadow);
        }

        final on = await _render(tester, (c) => draw(c, true), ground);
        final off = await _render(tester, (c) => draw(c, false), ground);
        var darkest = 0.0;
        for (var i = 0; i < on.length; i += 4) {
          final d = (off[i] - on[i]) / (off[i] - (p.shadow.r * 255)).clamp(1, 255);
          if (off[i] - on[i] > 2 && d > darkest) darkest = d;
        }
        expect(darkest, greaterThan(0.05), reason: 'night ${p.night}: there is a shadow');
        expect(darkest, lessThanOrEqualTo(p.shadowAlpha + 0.04), reason: 'night ${p.night}: and no stronger than the rule');
      }
    });

    testWidgets('the lit bulb glows at Night and carries an olive edge, not a glow, in Daylight', (tester) async {
      expect(MobiPalette.nightPalette.lit, isNull);
      expect(MobiPalette.dayPalette.lit, const Color(0xFF526700));
      Future<int> spread(MobiPalette p, double glow) async {
        final ground = p.night ? _nightGround : _dayGround;
        final px = await _render(tester, (c) => MobiDetails.antenna(c, 0, p, glow: glow), ground);
        final g = [(ground.r * 255).round(), (ground.g * 255).round(), (ground.b * 255).round()];
        var n = 0;
        for (var i = 0; i < px.length; i += 4) {
          if ((px[i] - g[0]).abs() + (px[i + 1] - g[1]).abs() + (px[i + 2] - g[2]).abs() > 12) n++;
        }
        return n;
      }

      final nightGlow = await spread(MobiPalette.nightPalette, 1) - await spread(MobiPalette.nightPalette, 0);
      final dayGlow = await spread(MobiPalette.dayPalette, 1) - await spread(MobiPalette.dayPalette, 0);
      expect(nightGlow, greaterThan(400), reason: 'a halo at Night');
      expect(dayGlow, greaterThan(20), reason: 'the edge shows in Daylight');
      expect(dayGlow, lessThan(nightGlow / 3), reason: 'no halo on paper');

      final day = await _render(tester, (c) => MobiDetails.antenna(c, 0, MobiPalette.dayPalette, glow: 1), _dayGround);
      var olive = 0;
      for (var i = 0; i < day.length; i += 4) {
        if (day[i] < 140 && day[i + 1] > 80 && day[i + 1] < 170 && day[i + 2] < 90 && day[i + 1] > day[i] + 10) olive++;
      }
      expect(olive, greaterThan(10), reason: 'the edge is olive');
    });
  });
}
