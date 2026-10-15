import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/flight.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../../helpers/golden_harness.dart' show FileAssetBundle;
import 'motion_harness.dart';

final ThemeData _theme = buildTheme(Brightness.dark);
final AssetBundle _files = FileAssetBundle();

const _source = Key('source-card');
const _go = Key('go');

/// A card with the subject's open hero object and a Start key that arms the flight and pushes
/// [next], named [routeName] (the destination screens' own layout: a framed ticket object).
Widget _app({
  required RecordingHaptics haptics,
  String routeName = '/practice/setup/quick',
  bool destinationHasObject = true,
  bool destinationFramed = true,
  bool reduced = false,
  String subject = 'economics',
}) {
  Widget destination(BuildContext context) => Scaffold(
        body: Align(
          alignment: Alignment.topLeft,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 80, 0, 0),
            child: destinationHasObject
                ? SubjectEmblem(subject: subject, size: 96, framed: destinationFramed, key: const Key('target'))
                : const SizedBox.square(dimension: 96),
          ),
        ),
      );
  return ProviderScope(
    overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
    child: DefaultAssetBundle(
      bundle: _files,
      child: MaterialApp(
        theme: _theme,
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
        home: Scaffold(
          body: Align(
            alignment: Alignment.topRight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(0, 120, 16, 0),
              child: Builder(
                key: _source,
                builder: (card) => Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SubjectEmblem(subject: subject, size: 136, framed: false, key: const Key('origin')),
                    GestureDetector(
                      key: _go,
                      onTap: () {
                        MmFlight.launch(card, subject);
                        Navigator.of(card).push(
                          MaterialPageRoute<void>(settings: RouteSettings(name: routeName), builder: destination),
                        );
                      },
                      child: const SizedBox(width: 120, height: 48, child: Text('Start')),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// The opacity the emblem keyed [key] shows itself at (its flight hiding).
double _shown(WidgetTester tester, Key key) {
  final fade = tester.widget<FadeTransition>(
    find.descendant(of: find.byKey(key, skipOffstage: false), matching: find.byType(FadeTransition, skipOffstage: false)).first,
  );
  return fade.opacity.value;
}

Finder get _copies => find.byWidgetPredicate((w) => w is SubjectEmblem && w.key == null && w.size == 136, skipOffstage: false);

void main() {
  setUp(() {
    SubjectEmblem.objectArt = true;
    MmFlight.debugReset();
  });
  tearDown(() {
    SubjectEmblem.objectArt = false;
    MmFlight.debugReset();
  });

  group('the path', () {
    const from = Rect.fromLTWH(220, 120, 128, 100);
    const to = Rect.fromLTWH(30, 90, 80, 62.5);

    test('starts on the tapped object and ends exactly on the destination', () {
      expect(MmFlight.pathAt(from, to, 0), from);
      expect(MmFlight.pathAt(from, to, 1), to);
    });

    test('translate and scale only: the object keeps its shape all the way', () {
      for (var t = 0.0; t <= 1.0; t += 0.05) {
        final r = MmFlight.pathAt(from, to, t);
        expect(r.width / r.height, closeTo(from.width / from.height, 1e-6), reason: '$t');
      }
    });

    test('rides a low arc, never more than the cap above the straight line', () {
      final mid = MmFlight.pathAt(from, to, 0.5);
      final straight = Offset.lerp(from.center, to.center, Motion.emphasized.transform(0.5))!;
      expect(mid.center.dy, lessThan(straight.dy));
      expect(straight.dy - mid.center.dy, lessThanOrEqualTo(MmFlight.arcMax + 1e-9));
    });

    test('the object rises off the ground in the air and lands on it', () {
      expect(MmFlight.liftAt(0.3, 0), closeTo(0.3, 1e-9));
      expect(MmFlight.liftAt(0, 0.5), closeTo(1, 1e-9));
      expect(MmFlight.liftAt(0.8, 1), 0);
    });

    test('the copy box puts its object exactly on the rect asked', () {
      const copy = MmFlightCopy(size: Size.square(136), objectIn: Rect.fromLTWH(4, 10, 128, 100), build: _none);
      final box = copy.boxFor(to);
      final k = box.width / 136;
      expect(Rect.fromLTWH(box.left + 4 * k, box.top + 10 * k, 128 * k, 100 * k), _rectCloseTo(to));
    });
  });

  group('a flight between two screens', () {
    testWidgets('the object flies, both ends stay hidden, and it lands with one tick', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics));
      await tester.tap(find.byKey(_go));
      await tester.pump();
      // The destination built hidden: it never shows for a frame before the flight takes off.
      expect(_shown(tester, const Key('target')), 0);
      await tester.pump(const Duration(milliseconds: 16));
      expect(MmFlight.inFlight, isTrue);
      expect(_shown(tester, const Key('origin')), 0);
      expect(_copies, findsOneWidget);

      // Mid-flight the copy is between the two and the destination is still hidden.
      await tester.pump(const Duration(milliseconds: 200));
      expect(MmFlight.inFlight, isTrue);
      expect(_shown(tester, const Key('target')), 0);
      expect(haptics.calls, isEmpty);

      // Landed: the framed tile's well fades in under the copy, then the copy goes and the
      // object answers with one tick.
      await tester.pump(const Duration(milliseconds: 260));
      await tester.pump(const Duration(milliseconds: 160));
      expect(MmFlight.inFlight, isFalse);
      expect(_shown(tester, const Key('target')), 1);
      expect(_copies, findsNothing);
      await tester.pumpAndSettle();
      expect(haptics.count('selection'), 1);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an open destination shows the moment the copy lands, in the same frame', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics, destinationFramed: false));
      await tester.tap(find.byKey(_go));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      expect(MmFlight.inFlight, isTrue);
      var landedAt = -1;
      for (var frame = 0; frame < 40 && landedAt < 0; frame++) {
        await tester.pump(const Duration(milliseconds: 16));
        final shown = _shown(tester, const Key('target'));
        final copy = _copies.evaluate().isNotEmpty && MmFlight.inFlight;
        // Never both gone and never both drawn once landed.
        expect(shown == 1 && copy, isFalse, reason: 'frame $frame');
        if (shown == 1) landedAt = frame;
      }
      expect(landedAt, greaterThan(0));
      await tester.pumpAndSettle();
      expect(haptics.count('selection'), 1);
    });

    testWidgets('a pop flies it home and shows the tapped object again', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics));
      await tester.tap(find.byKey(_go));
      await tester.pumpAndSettle();
      expect(MmFlight.inFlight, isFalse);

      Navigator.of(tester.element(find.byKey(const Key('target')))).pop();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 60));
      expect(MmFlight.inFlight, isTrue);
      expect(_shown(tester, const Key('origin')), 0);
      expect(_shown(tester, const Key('target')), 0);
      await tester.pumpAndSettle();
      expect(MmFlight.inFlight, isFalse);
      expect(_shown(tester, const Key('origin')), 1);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an exam page never gets a flight: its page transition runs alone', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics, routeName: '/exam/nta'));
      await tester.tap(find.byKey(_go));
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(MmFlight.inFlight, isFalse);
      }
      expect(_shown(tester, const Key('target')), 1);
      expect(_shown(tester, const Key('origin')), 1);
      await tester.pumpAndSettle();
      expect(haptics.calls, isEmpty);
    });

    testWidgets('no destination within the window: nothing flies and nothing stays hidden', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics, destinationHasObject: false));
      await tester.tap(find.byKey(_go));
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(MmFlight.inFlight, isFalse);
      }
      expect(_shown(tester, const Key('origin')), 1);
      await tester.pumpAndSettle();
    });

    testWidgets('reduced motion: no flight, the page fades as it always does', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics, reduced: true));
      await tester.tap(find.byKey(_go));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 16));
      expect(MmFlight.inFlight, isFalse);
      expect(_shown(tester, const Key('target')), 1);
      await tester.pumpAndSettle();
    });

    testWidgets('a different subject on the next screen is never landed on', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics));
      // Arm a flight for a subject the card does not carry: there is nothing to fly.
      expect(MmFlight.launch(tester.element(find.byKey(_source)), 'physics'), isFalse);
      await tester.pumpAndSettle();
      expect(MmFlight.inFlight, isFalse);
    });

    testWidgets('the object is the launch pair the next page can read', (tester) async {
      final haptics = RecordingHaptics();
      await tester.pumpWidget(_app(haptics: haptics));
      expect(MmFlight.launch(tester.element(find.byKey(_source)), 'eco'), isTrue);
      final pair = MmLaunchRect.peekPair();
      expect(pair?.subjectId, 'eco');
      final origin = tester.getRect(find.byKey(const Key('origin')));
      expect(origin.contains(pair!.rect.center), isTrue);
      await tester.pumpAndSettle();
    });
  });
}

Widget _none(ValueListenable<double> lift) => const SizedBox();

Matcher _rectCloseTo(Rect r) => predicate<Rect>(
      (v) => (v.left - r.left).abs() < 1e-6 && (v.top - r.top).abs() < 1e-6 && (v.width - r.width).abs() < 1e-6 && (v.height - r.height).abs() < 1e-6,
      'close to $r',
    );
