import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/art/object_art.dart' show ObjectEmblem;
import 'package:mockmob/core/art/object_life.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/mascot/mobi_ration.dart';
import 'package:mockmob/core/motion/flight.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/golden_harness.dart' show FileAssetBundle;
import '../core/motion/motion_harness.dart' show RecordingHaptics;

final ThemeData _theme = buildTheme(Brightness.dark);
final AssetBundle _files = FileAssetBundle();

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  RecordingHaptics? haptics,
  bool reduced = false,
  GlassQuality glass = GlassQuality.full,
  MobiCelebrationLevel celebrations = MobiCelebrationLevel.full,
}) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics ?? RecordingHaptics()))],
      child: DefaultAssetBundle(
        bundle: _files,
        child: MaterialApp(
          theme: _theme,
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: reduced, devicePixelRatio: 2, size: const Size(400, 800)),
            child: GlassScope(
              quality: glass,
              child: MobiCelebrations(level: celebrations, child: Scaffold(body: Center(child: child))),
            ),
          ),
        ),
      ),
    ),
  );
}

Finder get _life => find.byType(MmObjectLife);

/// The tilt the living object shows now: the matrix of the Transform under its life, or identity.
Matrix4 _tiltNow(WidgetTester tester) {
  final transforms = find.descendant(of: _life, matching: find.byType(Transform));
  for (final element in transforms.evaluate()) {
    final t = element.widget as Transform;
    if (t.transform.entry(3, 2) != 0) return t.transform;
  }
  return Matrix4.identity();
}

void main() {
  setUp(() {
    SubjectEmblem.objectArt = true;
    MmFlight.debugReset();
  });
  tearDown(() {
    SubjectEmblem.objectArt = false;
    SubjectEmblem.idleEnabled = false;
    MmFlight.debugReset();
  });

  group('the shared numbers', () {
    test('match the website file and the motion tokens they come from', () {
      expect(ObjectLife.minSize, 96);
      expect(ObjectLife.floatPeriod, const Duration(milliseconds: 7200));
      expect(ObjectLife.floatRise, ObjectEmblem.rise);
      expect(ObjectLife.floatLeanDeg, ObjectEmblem.tilt);
      expect(ObjectLife.tiltMaxDeg, 5);
      expect(ObjectLife.perspective, 0.0011);
      expect(ObjectLife.tapAmplitude, 0.4);
      expect(ObjectLife.tapReaction, const Duration(milliseconds: 420));
    });

    test('the tilt never passes the limit and is flat at rest', () {
      expect(objectTilt(finger: Offset.zero, scroll: 0), Offset.zero);
      final hard = objectTilt(finger: const Offset(3, -3), scroll: 4);
      expect(hard.dx.abs(), lessThanOrEqualTo(1));
      expect(hard.dy.abs(), lessThanOrEqualTo(1));
      expect(objectTiltMatrix(Offset.zero).entry(3, 2), ObjectLife.perspective);
      // Five degrees at most: the cosine of the largest rotation stays above cos(5 degrees).
      final m = objectTiltMatrix(const Offset(0, 1));
      expect(m.entry(1, 1), closeTo(0.99619, 1e-4));
    });

    test('a touched side presses away; the scroll tips the top back', () {
      expect(objectTilt(finger: const Offset(1, 0), scroll: 0).dx, 1);
      expect(objectTilt(finger: Offset.zero, scroll: 1).dy, closeTo(-ObjectLife.scrollShare, 1e-9));
    });
  });

  group('who comes alive', () {
    testWidgets('an open object of 96 dp and up, by default', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'economics', size: 136, framed: false));
      expect(_life, findsOneWidget);
      await _pump(tester, const SubjectEmblem(subject: 'economics', size: 96, framed: false));
      expect(_life, findsOneWidget);
    });

    testWidgets('a smaller object, a drawn emblem and an object asked to stay still keep their look', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'economics', size: 56, framed: false));
      expect(_life, findsNothing);
      expect(find.byType(EmblemSparkle), findsNothing);
      await _pump(tester, const SubjectEmblem(subject: 'economics', size: 136, framed: false, life: false));
      expect(_life, findsNothing);
      SubjectEmblem.objectArt = false;
      await _pump(tester, const SubjectEmblem(subject: 'economics', size: 136, framed: false));
      expect(_life, findsNothing);
    });

    testWidgets('the low glass tiers keep the float only', (tester) async {
      for (final q in const [GlassQuality.lite, GlassQuality.off]) {
        await _pump(tester, const SubjectEmblem(subject: 'physics', size: 136, framed: false), glass: q);
        expect(_life, findsNothing, reason: q.name);
        expect(find.byType(EmblemSparkle), findsNothing, reason: q.name);
      }
    });

    testWidgets('a living object floats without being asked to', (tester) async {
      SubjectEmblem.idleEnabled = true;
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 136, framed: false));
      expect(tester.binding.hasScheduledFrame, isTrue);
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 56, framed: false));
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.binding.hasScheduledFrame, isFalse);
      // Reduced motion: flat.
      await _pump(tester, const SubjectEmblem(subject: 'physics', size: 136, framed: false), reduced: true);
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.binding.hasScheduledFrame, isFalse);
    });
  });

  group('touch', () {
    testWidgets('a tap springs it once with one tick and its sparkle', (tester) async {
      final haptics = RecordingHaptics();
      await _pump(tester, const SubjectEmblem(subject: 'accountancy', size: 136, framed: false), haptics: haptics);
      expect(find.byType(EmblemSparkle), findsOneWidget);
      await tester.tap(find.byType(SubjectEmblem));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 90));
      final scales = find.descendant(of: find.byType(MmObjectReact), matching: find.byType(Transform));
      final pressed = tester.widgetList<Transform>(scales).any((t) => (t.transform.entry(0, 0) - 1).abs() > 0.005);
      expect(pressed, isTrue);
      await tester.pumpAndSettle();
      expect(haptics.count('selection'), 1);
      expect(haptics.count('light'), 0);
    });

    testWidgets('Celebrations Quiet and Off mute the sparkle, never the spring', (tester) async {
      for (final level in const [MobiCelebrationLevel.quiet, MobiCelebrationLevel.off]) {
        await _pump(tester, const SubjectEmblem(subject: 'accountancy', size: 136, framed: false), celebrations: level);
        expect(find.byType(EmblemSparkle), findsNothing, reason: level.name);
        expect(_life, findsOneWidget, reason: level.name);
      }
    });

    testWidgets('a finger resting on one side leans it toward the finger, and it comes back', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'chemistry', size: 136, framed: false));
      final box = tester.getRect(find.byType(SubjectEmblem));
      final gesture = await tester.startGesture(box.center + Offset(box.width * 0.3, 0));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      final leaning = _tiltNow(tester);
      expect(leaning.entry(3, 2), closeTo(ObjectLife.perspective, 0.00005));
      expect(leaning.isIdentity(), isFalse);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(_tiltNow(tester).isIdentity(), isTrue);
    });

    testWidgets('reduced motion: a finger does not tilt it', (tester) async {
      await _pump(tester, const SubjectEmblem(subject: 'chemistry', size: 136, framed: false), reduced: true);
      final box = tester.getRect(find.byType(SubjectEmblem));
      final gesture = await tester.startGesture(box.center + Offset(box.width * 0.3, 0));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(_tiltNow(tester).isIdentity(), isTrue);
      await gesture.up();
      await tester.pumpAndSettle();
    });

    testWidgets('the tap still reaches the card around the object', (tester) async {
      var opened = 0;
      await _pump(
        tester,
        GestureDetector(onTap: () => opened++, child: const SubjectEmblem(subject: 'history', size: 136, framed: false)),
      );
      await tester.tap(find.byType(SubjectEmblem));
      await tester.pumpAndSettle();
      expect(opened, 1);
    });
  });

  group('the scroll', () {
    testWidgets('scrolling leans the object, and it settles flat when the list stops', (tester) async {
      await _pump(
        tester,
        SizedBox(
          height: 600,
          child: ListView(
            children: [
              const SizedBox(height: 200),
              const Center(child: SubjectEmblem(subject: 'biology', size: 136, framed: false)),
              const SizedBox(height: 1200),
            ],
          ),
        ),
      );
      final gesture = await tester.startGesture(const Offset(40, 500));
      var leaned = false;
      for (var i = 0; i < 8; i++) {
        await gesture.moveBy(const Offset(0, -24));
        await tester.pump(const Duration(milliseconds: 16));
        if (!_tiltNow(tester).isIdentity()) leaned = true;
      }
      expect(leaned, isTrue);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(_tiltNow(tester).isIdentity(), isTrue);
    });
  });
}
