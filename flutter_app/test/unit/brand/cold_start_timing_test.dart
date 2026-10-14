import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_opening.dart';

/// Cold start, finding 24: the brand opening runs on its own clock and never waits for the
/// stored session or the first screen's data. These tests run the real host with a session that
/// takes 5 s (fake async: the clock only moves when the test pumps) and read the opening's own
/// timeline, so "the unfold starts by 1.0 s" is measured, not assumed.

class _QuietHaptics implements HapticDriver {
  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}

/// A session that is read slowly: unknown until [after], then [result].
class _SlowAuth extends AuthController {
  _SlowAuth({required this.after, required this.result});

  final Duration after;
  final AuthSnapshot result;

  @override
  AuthSnapshot build() {
    Timer(after, () {
      if (ref.mounted) state = result;
    });
    return AuthSnapshot.unknown;
  }
}

const Size _phone = Size(384, 853);
const double _dpr = 1.875;

/// The launch screen while the session is unknown, the first screen once it is.
class _App extends ConsumerWidget {
  const _App();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final known = ref.watch(authSnapshotProvider.select((a) => a.status != AuthStatus.unknown));
    return Scaffold(body: Center(child: Text(known ? 'First screen' : 'Launch screen')));
  }
}

Future<void> _pump(WidgetTester tester, {required Duration authAfter, AuthStatus result = AuthStatus.signedOut}) async {
  tester.view.devicePixelRatio = _dpr;
  tester.view.physicalSize = _phone * _dpr;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: _QuietHaptics())),
        authSnapshotProvider.overrideWith(() => _SlowAuth(after: authAfter, result: AuthSnapshot(status: result))),
      ],
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: BrandOpeningHost(shown: Future<void>.value(), child: const _App()),
      ),
    ),
  );
}

/// The opening's own time in ms, or null once it is gone.
double? _timeline(WidgetTester tester) {
  final painters = tester
      .widgetList<CustomPaint>(find.descendant(of: find.byType(BrandOpening), matching: find.byType(CustomPaint)))
      .map((c) => c.painter)
      .whereType<CustomPainter>()
      .where((p) => p.runtimeType.toString() == '_OpeningPainter');
  if (painters.isEmpty) return null;
  // ignore: avoid_dynamic_calls
  return (painters.first as dynamic).time() as double;
}

void main() {
  group('the opening on its own clock, a session that takes 5 s', () {
    testWidgets('the unfold starts at 500 ms and the word is composed by 1.0 s, whatever the session does', (tester) async {
      await _pump(tester, authAfter: const Duration(seconds: 5));
      var unfoldStartedAt = -1;
      double? atHalfSecond;
      double? atOneSecond;
      for (var ms = 16; ms <= 1008; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
        final t = _timeline(tester)!;
        if (unfoldStartedAt < 0 && OpeningTimeline.camera(t) > 0) unfoldStartedAt = ms;
        if (ms == 496) atHalfSecond = t;
        if (ms == 1008) atOneSecond = t;
      }
      // The timeline is the wall clock from the first frame (the "mo" is on the glass at once in a
      // test), not stalled on the session: the camera starts to pull back at 500 ms ...
      expect(atHalfSecond, closeTo(496, 20));
      expect(unfoldStartedAt, inInclusiveRange(OpeningTimeline.expandAt, OpeningTimeline.expandAt + 40));
      // ... and the word is composed (the view has settled on the whole word, every letter open
      // enough to read) by 1.0 s.
      expect(atOneSecond, greaterThanOrEqualTo(OpeningTimeline.settledAt));
      expect(OpeningTimeline.camera(atOneSecond!), closeTo(1, 1e-6));
      for (var k = 0; k < 2; k++) {
        expect(OpeningTimeline.letterOpen(atOneSecond, k), greaterThan(0.9), reason: 'letter $k is open by the time the word is composed');
      }
      expect(find.text('Launch screen', skipOffstage: false), findsOneWidget, reason: 'the session is still unknown at 1.0 s');
      // Let the rest run out so no timer is left pending.
      await tester.pump(const Duration(seconds: 6));
    });

    testWidgets('it hands off to the launch screen after the grace and never waits on the 5 s', (tester) async {
      await _pump(tester, authAfter: const Duration(seconds: 5));
      var goneAt = -1;
      for (var ms = 16; ms <= 3000; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
        if (goneAt < 0 && find.byType(BrandOpening).evaluate().isEmpty) goneAt = ms;
      }
      const handOffAt = OpeningTimeline.settledAt + OpeningTimeline.authGraceMs;
      expect(goneAt, inInclusiveRange(handOffAt + OpeningTimeline.fadeMs - 20, handOffAt + OpeningTimeline.fadeMs + 40));
      // Gone at about 1.6 s with the session still unknown at 3 s: the app shows its launch screen.
      expect(find.text('Launch screen'), findsOneWidget);
      expect(find.text('First screen'), findsNothing);
      // The session lands at 5 s: the first screen replaces the launch screen.
      await tester.pump(const Duration(seconds: 2, milliseconds: 100));
      expect(find.text('First screen'), findsOneWidget);
      expect(find.text('Launch screen'), findsNothing);
    });

    testWidgets('a session that answers a little late (1.1 s) lands the hand-off on the first screen, not the launch screen', (tester) async {
      await _pump(tester, authAfter: const Duration(milliseconds: 1100));
      var goneAt = -1;
      var launchWasShown = false;
      for (var ms = 16; ms <= 2000; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
        if (goneAt < 0 && find.byType(BrandOpening).evaluate().isEmpty) goneAt = ms;
        // The launch screen is never what the student sees: it is only ever under the cover.
        if (find.byType(BrandOpening).evaluate().isEmpty && find.text('Launch screen').evaluate().isNotEmpty) launchWasShown = true;
      }
      expect(launchWasShown, isFalse);
      // The session was known at 1.1 s: the first screen paints under the cover for 150 ms, then
      // the fade: gone at about 1.25 s + 0.28 s.
      expect(goneAt, inInclusiveRange(1100 + OpeningTimeline.prepaintLead + OpeningTimeline.fadeMs - 20, 1100 + OpeningTimeline.prepaintLead + OpeningTimeline.fadeMs + 60));
      expect(find.text('First screen'), findsOneWidget);
    });

    testWidgets('a session already known at the word (the usual start) hands off at 1.0 s', (tester) async {
      await _pump(tester, authAfter: const Duration(milliseconds: 300));
      var goneAt = -1;
      for (var ms = 16; ms <= 1800; ms += 16) {
        await tester.pump(const Duration(milliseconds: 16));
        if (goneAt < 0 && find.byType(BrandOpening).evaluate().isEmpty) goneAt = ms;
      }
      expect(goneAt, inInclusiveRange(OpeningTimeline.settledAt + OpeningTimeline.fadeMs - 20, OpeningTimeline.settledAt + OpeningTimeline.fadeMs + 40));
      expect(find.text('First screen'), findsOneWidget);
    });
  });
}
