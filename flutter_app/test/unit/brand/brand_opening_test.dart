import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_logo.dart';
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
const double _dpr = 1.875;

/// The "mo" is on the glass as soon as the opening asks (the test binding has no system splash).
Future<void> _onGlass() => Future<void>.value();

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  bool reduced = false,
  _CountingHaptics? haptics,
  List<Override> overrides = const [],
}) async {
  tester.view.devicePixelRatio = _dpr;
  tester.view.physicalSize = _phone * _dpr;
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

/// Where letter [i]'s ink is in word units in [pose], or null when it is folded away.
Rect? _inkOf(LogoPose pose, int i) {
  if (i == LogoGeometry.mobiIndex) return LogoGeometry.mobiSmall.bounds.shift(Offset(LogoGeometry.mobiSmall.x, 0));
  final l = LogoGeometry.letters.firstWhere((l) => l.index == i);
  final g = pose.glyph(i);
  if (g.opacity <= 0 || g.scaleX <= 0) return null;
  double x(double local) => l.x + g.offset.dx + g.hingeX + (local - g.hingeX) * g.scaleX;
  return Rect.fromLTRB(x(l.bounds.left), l.bounds.top + g.offset.dy, x(l.bounds.right), l.bounds.bottom + g.offset.dy);
}

void main() {
  group('timeline', () {
    test('the first frame is the "mo" exactly where the splash draws it', () {
      final pose = OpeningTimeline.poseAt(0, _phone, devicePixelRatio: _dpr);
      final view = pose.view!;
      // The adaptive-icon crop maps onto the 288 dp splash square at the screen centre.
      final s = _phone.width / view.width;
      expect(s, closeTo(OpeningTimeline.splashIconDp / LogoGeometry.adaptiveIconCrop.width, 1e-9));
      expect(view.center.dx, closeTo(LogoGeometry.adaptiveIconCrop.center.dx, 1e-6));
      expect(view.center.dy, closeTo(LogoGeometry.adaptiveIconCrop.center.dy, 1e-6));
      expect(pose.mobi.detail, LogoDetail.full);
      expect(pose.mobi.bodyToSmall, 0);
      expect(pose.mobi.ink, 0);
    });

    test('at the start every letter outside "mo" is folded away', () {
      final pose = OpeningTimeline.poseAt(0, _phone);
      for (final l in LogoGeometry.letters) {
        if (l.index == LogoGeometry.mobiIndex - 1) {
          expect(pose.glyph(l.index), same(LogoGlyphPose.rest));
          continue;
        }
        expect(_inkOf(pose, l.index), isNull, reason: '${l.char} at ${l.index} shows at t = 0');
      }
    });

    test('the letters unfold without ever being cut: whole, in order, never overlapping', () {
      for (var t = OpeningTimeline.expandAt; t <= OpeningTimeline.settledAt + 400; t += 4) {
        final pose = OpeningTimeline.poseAt(t, _phone);
        Rect? previous;
        for (var i = 0; i < LogoGeometry.word.length; i++) {
          expect(pose.glyph(i).clip, isNull, reason: 'no letter is clipped (at $t ms)');
          final ink = _inkOf(pose, i);
          if (ink == null) continue;
          if (previous != null) {
            expect(ink.left, greaterThanOrEqualTo(previous.right - 0.5), reason: 'letter $i overlaps its neighbour at $t ms');
          }
          previous = ink;
        }
        // The letters next to the "mo" stay attached to it: the m's left and Mobi's right edges
        // carry the hinges.
        final k = _inkOf(pose, LogoGeometry.mobiIndex - 2);
        if (k != null) {
          final m = _inkOf(pose, LogoGeometry.mobiIndex - 1)!;
          final restGap = m.left - _inkOf(LogoPose.rest, LogoGeometry.mobiIndex - 2)!.right;
          expect(m.left - k.right, closeTo(restGap * pose.glyph(LogoGeometry.mobiIndex - 2).scaleX, 0.5));
        }
      }
    });

    test('a letter is faint while it is thin, and whole once open', () {
      final k = OpeningTimeline.letterOpen;
      // Find a moment the first letter is a fifth open.
      var t = OpeningTimeline.firstLetterAt;
      while (k(t, 0) < 0.2) {
        t += 1;
      }
      final g = OpeningTimeline.poseAt(t, _phone).glyph(LogoGeometry.mobiIndex - 2);
      expect(g.opacity, lessThan(0.6));
      expect(OpeningTimeline.poseAt(OpeningTimeline.settledAt + 600, _phone).glyph(LogoGeometry.mobiIndex - 2).opacity, 1);
    });

    test('the b unfolds rightwards from behind Mobi, never rising through the baseline', () {
      final b = LogoGeometry.mobiIndex + 1;
      for (var t = 0.0; t <= OpeningTimeline.settledAt + 400; t += 4) {
        final g = OpeningTimeline.poseAt(t, _phone).glyph(b);
        expect(g.offset.dy, 0, reason: 'at $t ms');
        final ink = _inkOf(OpeningTimeline.poseAt(t, _phone), b);
        if (ink != null) expect(ink.left, greaterThanOrEqualTo(_inkOf(LogoPose.rest, LogoGeometry.mobiIndex)!.right - 0.5));
      }
    });

    test('by the hand-off the word is composed and centred', () {
      final pose = OpeningTimeline.poseAt(OpeningTimeline.settledAt + 200, _phone);
      final word = OpeningTimeline.wordView(_phone);
      expect(pose.view!.center.dx, closeTo(word.center.dx, 0.5));
      expect(pose.view!.width, closeTo(word.width, 0.5));
      for (final l in LogoGeometry.letters) {
        final g = pose.glyph(l.index);
        // Within half a dp at the final size.
        expect(g.offset.distance * OpeningTimeline.finalEm(_phone) / 1000, lessThan(0.5), reason: l.char);
        expect((1 - g.scaleX) * l.bounds.width * OpeningTimeline.finalEm(_phone) / 1000, lessThan(0.5), reason: l.char);
      }
      expect(pose.mobi.eyesToSmall, 1);
      expect(pose.mobi.bodyToSmall, 1);
    });

    test('the flap cut fills in where Mobi crosses the 96 px threshold, over 60 ms', () {
      for (final dpr in [1.875, 2.0, 2.625, 3.5]) {
        final swap = OpeningTimeline.detailSwapAt(_phone, dpr);
        final before = OpeningTimeline.poseAt(swap - 31, _phone, devicePixelRatio: dpr).mobi;
        final after = OpeningTimeline.poseAt(swap + 31, _phone, devicePixelRatio: dpr).mobi;
        expect(before.bodyToSmall, 0, reason: '$dpr');
        expect(after.bodyToSmall, 1, reason: '$dpr');
        expect(OpeningTimeline.poseAt(swap, _phone, devicePixelRatio: dpr).mobi.bodyToSmall, closeTo(0.5, 0.05));
        // Mobi's height in physical pixels at the swap.
        final view = OpeningTimeline.poseAt(swap, _phone, devicePixelRatio: dpr).view!;
        final px = LogoGeometry.mobiHeight * (_phone.width / view.width) * dpr;
        final start = LogoGeometry.mobiHeight * (_phone.width / OpeningTimeline.moView(_phone).width) * dpr;
        if (start > LogoGeometry.fullFromMobiPx) {
          expect(px, closeTo(LogoGeometry.fullFromMobiPx, 1), reason: '$dpr');
        }
        expect(swap, greaterThanOrEqualTo(OpeningTimeline.inkAt + OpeningTimeline.inkMs), reason: 'not before the ink lands');
      }
    });

    test('the ring eye inks once, then the eyes settle to the small master', () {
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt - 1, _phone).mobi.ink, 0);
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt + OpeningTimeline.inkMs / 4, _phone).mobi.ink, inExclusiveRange(0, 1));
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt + OpeningTimeline.inkMs / 4, _phone).mobi.eyesToSmall, isNull);
      expect(OpeningTimeline.poseAt(OpeningTimeline.inkAt + OpeningTimeline.inkMs, _phone).mobi.ink, 1);
    });

    test('Mobi blinks once in the hold, and glances toward the rest of the word', () {
      expect(OpeningTimeline.blinkAmount(OpeningTimeline.blinkAt + 60, OpeningTimeline.blinkAt), closeTo(1, 1e-9));
      expect(OpeningTimeline.blinkAmount(OpeningTimeline.blinkAt + 200, OpeningTimeline.blinkAt), 0);
      final look = OpeningTimeline.poseAt(OpeningTimeline.glanceAt + OpeningTimeline.glanceMs, _phone).mobi.look.dx;
      // B: Mobi ends the word, so the word is to the left.
      final towardWord = LogoGeometry.mobiIndex * 2 >= LogoGeometry.word.length ? -1 : 1;
      expect(look.sign, towardWord);
      expect(look.abs(), closeTo(0.8, 1e-6));
    });

    test('under reduced motion the lamp comes up from the flat splash ground', () {
      expect(OpeningTimeline.reducedLamp(0), 0);
      expect(OpeningTimeline.reducedLamp(OpeningTimeline.reducedMs), 1);
      expect(OpeningTimeline.lamp(0), 0);
    });
  });

  group('widget', () {
    testWidgets('plays about 1.3 s when the app is ready, with one light haptic on the ink', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++, shown: _onGlass()), haptics: haptics);
      await tester.pump(const Duration(milliseconds: 380));
      expect(haptics.light, 0);
      await tester.pump(const Duration(milliseconds: 40));
      expect(haptics.light, 1);
      await tester.pump(const Duration(milliseconds: 580));
      expect(done, 0);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(done, 1);
      expect(haptics.light, 1);
    });

    testWidgets('the clock waits until the "mo" is on the glass', (tester) async {
      final haptics = _CountingHaptics();
      final glass = Completer<void>();
      await _pump(tester, BrandOpening(onDone: () {}, shown: glass.future), haptics: haptics);
      // The splash is still up (a slow first frame): nothing plays under it.
      await tester.pump(const Duration(milliseconds: 1200));
      await tester.pump(const Duration(milliseconds: 600));
      expect(haptics.light, 0, reason: 'the hold, blink and ink start once the "mo" is seen');
      glass.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 380));
      expect(haptics.light, 0);
      await tester.pump(const Duration(milliseconds: 40));
      expect(haptics.light, 1);
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('if the platform never answers, the whole opening plays from the 10 s safety net', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++, shown: Completer<void>().future), haptics: haptics);
      // Under a splash that is never reported gone, nothing plays or hands off out of sight, even
      // well past a slow start.
      await tester.pump(const Duration(milliseconds: 6000));
      await tester.pump(const Duration(milliseconds: 3990));
      expect(haptics.light, 0);
      expect(done, 0);
      // From the net, the nominal timeline: the ink at 400 ms, the hand-off at 1000 ms, gone 280
      // ms later.
      await tester.pump(const Duration(milliseconds: 10));
      await tester.pump(const Duration(milliseconds: 380));
      expect(haptics.light, 0);
      await tester.pump(const Duration(milliseconds: 40));
      expect(haptics.light, 1);
      await tester.pump(const Duration(milliseconds: 580));
      expect(done, 0);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1);
      expect(haptics.light, 1);
      // The hand-off asked the silent platform to lift its splash at once; that ask gives up.
      await tester.pump(OpeningGlass.answerCap);
    });

    testWidgets('a tap skips straight to the hand-off', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++, shown: _onGlass()));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.byType(BrandOpening));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1);
    });

    testWidgets('a tap while the app is loading jumps to the word and waits there', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      final opening = GlobalKey();
      Widget build(bool ready) => BrandOpening(key: opening, ready: ready, onDone: () => done++, shown: _onGlass());
      await _pump(tester, build(false), haptics: haptics);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.byType(BrandOpening));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(done, 0, reason: 'nothing to hand off to yet');
      expect(haptics.light, 0, reason: 'a skipped opening stays quiet');
      await _pump(tester, build(true), haptics: haptics);
      // Ready late: the first screen paints under the cover for 150 ms, then the fade.
      await tester.pump(const Duration(milliseconds: 160));
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1);
    });

    testWidgets('while the app is loading, Mobi idles on the word; it hands off once ready', (tester) async {
      var done = 0;
      final opening = GlobalKey();
      Widget build(bool ready) => BrandOpening(key: opening, ready: ready, onDone: () => done++, shown: _onGlass());
      await _pump(tester, build(false));
      await tester.pump(const Duration(milliseconds: 3000));
      expect(done, 0);
      await _pump(tester, build(true));
      await tester.pump(const Duration(milliseconds: 160));
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1);
    });

    testWidgets('it never waits longer than the cap', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(ready: false, onDone: () => done++, shown: _onGlass()));
      await tester.pump(const Duration(milliseconds: 7900));
      expect(done, 0);
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1);
    });

    testWidgets('the first screen paints 150 ms before the fade, and comes alive as it starts', (tester) async {
      final events = <String>[];
      await _pump(
        tester,
        BrandOpening(
          shown: _onGlass(),
          onPrepaint: () => events.add('paint'),
          onReveal: () => events.add('reveal'),
          onDone: () => events.add('done'),
        ),
      );
      for (var ms = 10; ms <= 1500; ms += 10) {
        await tester.pump(const Duration(milliseconds: 10));
        if (ms == 840) expect(events, isEmpty);
        if (ms == 860) expect(events, ['paint']);
        if (ms == 990) expect(events, ['paint']);
        if (ms == 1010) expect(events, ['paint', 'reveal']);
      }
      expect(events, ['paint', 'reveal', 'done']);
    });

    testWidgets('the hand-off fades the word out before the ground lifts', (tester) async {
      await _pump(tester, BrandOpening(onDone: () {}, shown: _onGlass()));
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pump(const Duration(milliseconds: 1));
      List<double> opacities() => tester
          .widgetList<FadeTransition>(find.descendant(of: find.byType(BrandOpening), matching: find.byType(FadeTransition)))
          .map((f) => f.opacity.value)
          .toList();
      // [ground, lamp, word]
      await tester.pump(const Duration(milliseconds: 80));
      var o = opacities();
      expect(o.first, closeTo(1, 1e-3), reason: 'the ground is still up');
      expect(o.last, lessThan(0.7), reason: 'the word is on its way out');
      await tester.pump(const Duration(milliseconds: 50));
      o = opacities();
      expect(o.last, 0, reason: 'the word is gone before the first screen shows much');
      expect(o.first, greaterThan(0.7));
      await tester.pump(const Duration(milliseconds: 300));
    });

    testWidgets('reduced motion: "mo" out, then the word in, then a short fade, no haptic', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++, shown: _onGlass()), reduced: true, haptics: haptics);
      await tester.pump(const Duration(milliseconds: 210));
      await tester.pump(const Duration(milliseconds: 200));
      expect(done, 1);
      expect(haptics.light, 0);
    });

    testWidgets('the saved in-app Reduce motion, read after the first frame, still gives the short opening', (tester) async {
      final haptics = _CountingHaptics();
      final glass = Completer<void>();
      var done = 0;
      await _pump(
        tester,
        ReducedMotionScope(child: BrandOpening(onDone: () => done++, shown: glass.future)),
        haptics: haptics,
      );
      // The setting arrives from storage after the opening has built, still under the splash.
      ProviderScope.containerOf(tester.element(find.byType(BrandOpening)))
          .read(reducedMotionOverrideProvider.notifier)
          .set(true);
      await tester.pump();
      glass.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 210));
      await tester.pump(const Duration(milliseconds: 200));
      expect(done, 1, reason: 'the short version hands off after about 0.4 s');
      expect(haptics.light, 0, reason: 'no haptic under reduced motion');
    });

    testWidgets('Reduce motion landing during the hold restarts the short version from the "mo"', (tester) async {
      final haptics = _CountingHaptics();
      var done = 0;
      await _pump(
        tester,
        ReducedMotionScope(child: BrandOpening(onDone: () => done++, shown: _onGlass())),
        haptics: haptics,
      );
      await tester.pump(const Duration(milliseconds: 100));
      ProviderScope.containerOf(tester.element(find.byType(BrandOpening)))
          .read(reducedMotionOverrideProvider.notifier)
          .set(true);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 210));
      await tester.pump(const Duration(milliseconds: 200));
      expect(done, 1);
      expect(haptics.light, 0);
    });

    testWidgets('a tap once the word is composed hands off even while the app is loading', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(ready: false, onDone: () => done++, shown: _onGlass()));
      await tester.pump(const Duration(milliseconds: 1500));
      expect(done, 0);
      await tester.tap(find.byType(BrandOpening));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(done, 1, reason: 'a tap is never dead');
    });

    testWidgets('a failed load hands off to the retry screen as soon as the word is composed', (tester) async {
      final auth = _Auth(const AuthSnapshot(status: AuthStatus.unknown, loadFailed: true));
      await _pump(
        tester,
        BrandOpeningHost(shown: _onGlass(), child: const Scaffold(body: Center(child: Text('Retry')))),
        overrides: [authSnapshotProvider.overrideWith(() => auth)],
      );
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(BrandOpening), findsNothing, reason: 'not held over the retry screen until the 8 s cap');
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('the host removes the opening and hides the app from screen readers until then', (tester) async {
      final handle = tester.ensureSemantics();
      final auth = _Auth(const AuthSnapshot(status: AuthStatus.unknown));
      await _pump(
        tester,
        BrandOpeningHost(shown: _onGlass(), child: const Scaffold(body: Center(child: Text('First screen')))),
        overrides: [authSnapshotProvider.overrideWith(() => auth)],
      );
      expect(find.byType(BrandOpening), findsOneWidget);
      expect(find.bySemanticsLabel('First screen'), findsNothing);
      // Built and routed underneath, but not painted (and its tickers muted) while covered.
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('First screen', skipOffstage: false), findsOneWidget);
      expect(find.text('First screen'), findsNothing);
      // Painted under the opaque opening, tickers still muted, before the fade (850 ms).
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('First screen'), findsOneWidget);
      final ticking = tester.widget<TickerMode>(
        find.ancestor(of: find.text('First screen'), matching: find.byType(TickerMode)).first,
      );
      expect(ticking.enabled, isFalse);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byType(BrandOpening), findsNothing);
      expect(find.bySemanticsLabel('First screen'), findsOneWidget);
      // Nothing invisible is left over the app: a touch reaches the first screen.
      final text = tester.renderObject(find.text('First screen'));
      final hit = tester.hitTestOnBinding(tester.getCenter(find.text('First screen')));
      expect(hit.path.any((entry) => entry.target == text), isTrue);
      handle.dispose();
    });

    testWidgets('a slow or unknown auth never holds the opening: it unfolds and hands off on its own clock', (tester) async {
      // Auth never resolves (the stored session is still being read, or the network is slow).
      final auth = _Auth(const AuthSnapshot(status: AuthStatus.unknown));
      final haptics = _CountingHaptics();
      await _pump(
        tester,
        BrandOpeningHost(shown: _onGlass(), child: const Scaffold(body: Center(child: Text('First screen')))),
        haptics: haptics,
        overrides: [authSnapshotProvider.overrideWith(() => auth)],
      );
      var inkAt = -1;
      var handedOffAt = -1;
      for (var ms = 0; ms <= 1500; ms += 10) {
        await tester.pump(const Duration(milliseconds: 10));
        if (inkAt < 0 && haptics.light > 0) inkAt = ms;
        if (handedOffAt < 0 && find.byType(BrandOpening).evaluate().isEmpty) handedOffAt = ms;
      }
      expect(inkAt, inInclusiveRange(OpeningTimeline.hapticAt - 20, OpeningTimeline.hapticAt + 40));
      // Unfolded by 1.0 s and gone by about 1.28 s (to a frame or two), with auth still unknown.
      expect(handedOffAt, inInclusiveRange(OpeningTimeline.settledAt, 1340));
      expect(find.text('First screen'), findsOneWidget, reason: 'the first screen, not an endless opening');
    });

    testWidgets('services that read the database and the network start after the hand-off, not before', (tester) async {
      final auth = _Auth(const AuthSnapshot(status: AuthStatus.signedOut));
      var started = 0;
      final services = Consumer(builder: (context, ref, _) {
        started++;
        return const SizedBox.shrink();
      });
      await _pump(
        tester,
        BrandOpeningHost(shown: _onGlass(), afterOpening: services, child: const Scaffold(body: Center(child: Text('First screen')))),
        overrides: [authSnapshotProvider.overrideWith(() => auth)],
      );
      for (var ms = 0; ms < 1000; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(started, 0, reason: 'nothing of them sits in the frames the opening plays in');
      for (var ms = 0; ms < 600; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      expect(find.byType(BrandOpening), findsNothing);
      expect(started, greaterThan(0));
    });

    group('the app is built under the opening, not in front of it (cold start, finding 24)', () {
      setUp(() => BrandOpeningHost.deferApp = true);
      tearDown(() => BrandOpeningHost.deferApp = false);

      testWidgets('the first frame is the "mo" alone: the app builds once the "mo" is on the glass', (tester) async {
        final glass = Completer<void>();
        var builds = 0;
        final auth = _Auth(const AuthSnapshot(status: AuthStatus.signedOut));
        await _pump(
          tester,
          BrandOpeningHost(
            shown: glass.future,
            child: Builder(builder: (context) {
              builds++;
              return const Scaffold(body: Center(child: Text('First screen')));
            }),
          ),
          overrides: [authSnapshotProvider.overrideWith(() => auth)],
        );
        // The splash is still up for seconds: nothing of the app has been built or laid out, so
        // the first frame the splash waits for costs only the logo.
        await tester.pump(const Duration(seconds: 5));
        expect(builds, 0, reason: 'the app does not sit in the frame the splash waits for');
        expect(find.text('First screen', skipOffstage: false), findsNothing);
        expect(find.byType(BrandOpening), findsOneWidget);

        glass.complete();
        await tester.pump();
        await tester.pump();
        expect(builds, greaterThan(0), reason: 'built under the hold, as the "mo" shows');
        expect(find.text('First screen', skipOffstage: false), findsOneWidget);
        expect(find.byType(BrandOpening), findsOneWidget, reason: 'still covered');
        expect(find.text('First screen'), findsNothing, reason: 'built and laid out, not painted yet');
      });

      testWidgets('it still plays and hands off on the nominal timeline once the app is built', (tester) async {
        final auth = _Auth(const AuthSnapshot(status: AuthStatus.signedOut));
        await _pump(
          tester,
          BrandOpeningHost(shown: _onGlass(), child: const Scaffold(body: Center(child: Text('First screen')))),
          overrides: [authSnapshotProvider.overrideWith(() => auth)],
        );
        // The "mo" is seen at once; the app builds in the first frames (real frames, 16 ms
        // apart); the word is composed at 1000 ms and the opening lifts by about 1300 ms.
        for (var ms = 0; ms < 1400; ms += 16) {
          await tester.pump(const Duration(milliseconds: 16));
        }
        expect(find.byType(BrandOpening), findsNothing);
        expect(find.text('First screen'), findsOneWidget);
      });

      testWidgets('with the app deferred, a late glass answer cannot leave the app unbuilt after hand-off', (tester) async {
        final auth = _Auth(const AuthSnapshot(status: AuthStatus.signedOut));
        await _pump(
          tester,
          BrandOpeningHost(shown: Completer<void>().future, child: const Scaffold(body: Center(child: Text('First screen')))),
          overrides: [authSnapshotProvider.overrideWith(() => auth)],
        );
        // Tapping the opening hands off at once, whatever stage it is at.
        await tester.pump(const Duration(milliseconds: 100));
        await tester.tap(find.byType(BrandOpening));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 400));
        expect(tester.takeException(), isNull);
      });
    });

    testWidgets('a frozen frame paints, repaints when moved, and never hands off', (tester) async {
      var done = 0;
      await _pump(tester, BrandOpening(onDone: () => done++, progress: 0.6));
      await tester.pump(const Duration(seconds: 3));
      expect(done, 0);
      CustomPainter painter() => tester
          .widgetList<CustomPaint>(find.descendant(of: find.byType(BrandOpening), matching: find.byType(CustomPaint)))
          .map((c) => c.painter)
          .whereType<CustomPainter>()
          .firstWhere((p) => p.runtimeType.toString() == '_OpeningPainter');
      final a = painter();
      await _pump(tester, BrandOpening(onDone: () => done++, progress: 0.7));
      final b = painter();
      expect(b.shouldRepaint(a), isTrue);
      expect(done, 0);
    });
  });
}
