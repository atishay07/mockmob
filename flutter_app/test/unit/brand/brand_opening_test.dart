import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_opening.dart';
import 'package:mockmob/core/widgets/brand/logo_geometry.g.dart';

class _CountingHaptics implements HapticDriver {
  int light = 0;

  @override
  Future<void> lightImpact() async => light++;

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}

class _Auth extends AuthController {
  _Auth(this.initial);

  final AuthSnapshot initial;

  @override
  AuthSnapshot build() => initial;

  void become(AuthStatus status) => state = AuthSnapshot(status: status);
}

const Size _phone = Size(384, 853);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  bool reduced = false,
  _CountingHaptics? haptics,
  List<Override> overrides = const [],
}) async {
  tester.view.devicePixelRatio = 1.875;
  tester.view.physicalSize = _phone * 1.875;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics ?? _CountingHaptics())),
        ...overrides,
      ],
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
        home: child,
      ),
    ),
  );
}

void main() {
  group('timeline', () {
    test('the first frame is the "mo" exactly where the splash draws it', () {
      final pose = OpeningTimeline.poseAt(0, _phone);
      final view = pose.view!;
      // The adaptive-icon crop maps onto the 288 dp splash square at the screen centre.
      final s = _phone.width / view.width;
      expect(s, closeTo(OpeningTimeline.splashIconDp / LogoGeometry.adaptiveIconCrop.width, 1e-9));
      expect(view.center.dx, closeTo(LogoGeometry.adaptiveIconCrop.center.dx, 1e-6));
      expect(view.center.dy, closeTo(LogoGeometry.adaptiveIconCrop.center.dy, 1e-6));
      expect(pose.mobi.detail, LogoDetail.full);
      expect(pose.mobi.ink, 0);
    });

    test('at the start every letter outside "mo" is hidden behind its clip', () {
      final pose = OpeningTimeline.poseAt(0, _phone);
      for (final l in LogoGeometry.letters) {
        if (l.index == LogoGeometry.mobiIndex - 1) continue;
        final g = pose.glyph(l.index);
        final ink = l.bounds.shift(Offset(l.x, 0) + g.offset);
        expect(g.clip, isNotNull, reason: l.char);
        expect(ink.intersect(g.clip!).isEmpty || ink.intersect(g.clip!).width <= 0 || ink.intersect(g.clip!).height <= 0, isTrue,
            reason: '${l.char} at ${l.index} shows at t = 0');
      }
    });

    test('by the hand-off the word is composed and centred', () {
      final pose = OpeningTimeline.poseAt(OpeningTimeline.settledAt + 200, _phone);
      final word = OpeningTimeline.wordView(_phone);
      expect(pose.view!.center.dx, closeTo(word.center.dx, 0.5));
      expect(pose.view!.width, closeTo(word.width, 0.5));
      for (final l in LogoGeometry.letters) {
        // Within half a dp at the final size.
        expect(pose.glyph(l.index).offset.distance * OpeningTimeline.finalEm(_phone) / 1000, lessThan(0.5), reason: l.char);
      }
      expect(pose.mobi.eyesToSmall, 1);
    });

    test('the ring eye inks once, then the eyes settle to the small master', () {
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt - 1, _phone).mobi.ink, 0);
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt + OpeningTimeline.inkMs / 4, _phone).mobi.ink, inExclusiveRange(0, 1));
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt + OpeningTimeline.inkMs / 4, _phone).mobi.eyesToSmall, isNull);
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt + OpeningTimeline.inkMs, _phone).mobi.ink, 1);
    });

    test('Mobi blinks once in the hold', () {
      expect(OpeningTimeline.blinkAmount(OpeningTimeline.blinkAt + 60, OpeningTimeline.blinkAt), closeTo(1, 1e-9));
      expect(OpeningTimeline.blinkAmount(OpeningTimeline.blinkAt + 200, OpeningTimeline.blinkAt), 0);
    });
  });

  group('widget', () {
    testWidgets('plays about 1.2 s when the app is ready, with one light haptic on the ink', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++), haptics: haptics);
      await tester.pump(const Duration(milliseconds: 900));
      expect(done, 0);
      expect(haptics.light, 1);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump(const Duration(milliseconds: 250));
      expect(done, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(done, 1);
    });

    testWidgets('a tap skips straight to the hand-off', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.byType(BrandOpening));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      expect(done, 1);
    });

    testWidgets('while the app is loading, Mobi idles on the word; it hands off once ready', (tester) async {
      var done = 0;
      final opening = GlobalKey();
      Widget build(bool ready) => BrandOpening(key: opening, ready: ready, onDone: () => done++);
      await _pump(tester, build(false));
      await tester.pump(const Duration(milliseconds: 3000));
      expect(done, 0);
      await _pump(tester, build(true));
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 250));
      expect(done, 1);
    });

    testWidgets('it never waits longer than the cap', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(ready: false, onDone: () => done++));
      await tester.pump(const Duration(milliseconds: 7900));
      expect(done, 0);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 250));
      expect(done, 1);
    });

    testWidgets('reduced motion: a 200 ms crossfade, then a short fade, no haptic', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++), reduced: true, haptics: haptics);
      await tester.pump(const Duration(milliseconds: 210));
      await tester.pump(const Duration(milliseconds: 150));
      expect(done, 1);
      expect(haptics.light, 0);
    });

    testWidgets('the host removes the opening and hides the app from screen readers until then', (tester) async {
      final handle = tester.ensureSemantics();
      final auth = _Auth(const AuthSnapshot(status: AuthStatus.unknown));
      await _pump(
        tester,
        const BrandOpeningHost(child: Scaffold(body: Center(child: Text('First screen')))),
        overrides: [authSnapshotProvider.overrideWith(() => auth)],
      );
      expect(find.byType(BrandOpening), findsOneWidget);
      expect(find.bySemanticsLabel('First screen'), findsNothing);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.byType(BrandOpening), findsOneWidget, reason: 'waits for auth');
      auth.become(AuthStatus.signedOut);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.byType(BrandOpening), findsNothing);
      expect(find.bySemanticsLabel('First screen'), findsOneWidget);
      // Nothing invisible is left over the app: a touch reaches the first screen.
      final text = tester.renderObject(find.text('First screen'));
      final hit = tester.hitTestOnBinding(tester.getCenter(find.text('First screen')));
      expect(hit.path.any((entry) => entry.target == text), isTrue);
      handle.dispose();
    });

    testWidgets('a frozen frame paints and never hands off', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++, progress: 0.6));
      await tester.pump(const Duration(seconds: 3));
      expect(done, 0);
      expect(find.byType(CustomPaint), findsWidgets);
    });
  });
}
