
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart' show appPrefsProvider;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/brand/brand_opening.dart';
import 'package:mockmob/core/widgets/brand/first_launch_opening.dart';

/// M-001 (owner, 18 Oct): the brand opening plays its whole 3 second version once, on the first
/// launch after install; every launch after it is the short one (about 1.3 s). Reduced motion is
/// the same short fade either way. These tests cover the flag, the timeline's extension and the
/// host that ties them together.

class _QuietHaptics implements HapticDriver {
  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}

/// A store whose reads and writes fail, as a phone with a broken preferences file would.
class _BrokenStore extends MemoryPrefsStore {
  @override
  Future<bool?> getBool(String key) => Future<bool?>.error(StateError('unreadable'));

  @override
  Future<void> setBool(String key, bool value) => Future<void>.error(StateError('unwritable'));
}

class _KnownAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedOut);
}

const Size _phone = Size(384, 853);
const double _dpr = 1.875;

Future<AppPrefs> _pump(
  WidgetTester tester, {
  required bool firstLaunch,
  bool reduced = false,
  MemoryPrefsStore? store,
}) async {
  tester.view.devicePixelRatio = _dpr;
  tester.view.physicalSize = _phone * _dpr;
  addTearDown(tester.view.reset);
  final prefs = AppPrefs(store ?? MemoryPrefsStore());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: _QuietHaptics())),
        authSnapshotProvider.overrideWith(_KnownAuth.new),
        appPrefsProvider.overrideWithValue(prefs),
        firstLaunchOpeningProvider.overrideWithValue(firstLaunch),
      ],
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
        home: BrandOpeningHost(shown: Future<void>.value(), child: const Scaffold(body: Center(child: Text('First screen')))),
      ),
    ),
  );
  return prefs;
}

/// How many ms of 16 ms frames pass before the opening has left the tree, or -1.
Future<int> _goneAt(WidgetTester tester, {int limit = 4000}) async {
  for (var ms = 16; ms <= limit; ms += 16) {
    await tester.pump(const Duration(milliseconds: 16));
    if (find.byType(BrandOpening).evaluate().isEmpty) return ms;
  }
  return -1;
}

void main() {
  group('the flag', () {
    test('a fresh install is due for the whole opening, and is not once it has played', () async {
      final prefs = AppPrefs(MemoryPrefsStore());
      expect(await FirstLaunchOpening.due(prefs), isTrue);
      await FirstLaunchOpening.markPlayed(prefs);
      expect(await FirstLaunchOpening.due(prefs), isFalse);
      // Every launch after that stays short.
      expect(await FirstLaunchOpening.due(prefs), isFalse);
    });

    test('it lives in the phone\'s own preferences (the key the app already kept for the first-launch opening)', () async {
      final store = MemoryPrefsStore();
      await FirstLaunchOpening.markPlayed(AppPrefs(store));
      expect(store.values['cold_open_seen'], isTrue);
      // A second AppPrefs over the same store (the next launch) reads it.
      expect(await FirstLaunchOpening.due(AppPrefs(store)), isFalse);
    });

    test('a flag that cannot be read plays the short opening, and one that cannot be written never throws', () async {
      final prefs = AppPrefs(_BrokenStore());
      expect(await FirstLaunchOpening.due(prefs), isFalse);
      await FirstLaunchOpening.markPlayed(prefs);
    });
  });

  group('the timeline', () {
    test('the whole opening is 3 s: the hand-off starts at 2720 ms and its 280 ms fade ends at 3000 ms', () {
      expect(OpeningTimeline.fullHandOffAt + OpeningTimeline.fadeMs, OpeningTimeline.fullMs);
      expect(OpeningTimeline.fullMs, 3000);
      expect(OpeningTimeline.fullHandOffAt, greaterThan(OpeningTimeline.settledAt));
    });

    test('the swell starts and ends at rest, and peaks once in the middle of the hold', () {
      expect(OpeningTimeline.breath(0), 0);
      expect(OpeningTimeline.breath(OpeningTimeline.settledAt), 0);
      expect(OpeningTimeline.breath(OpeningTimeline.fullHandOffAt), 0);
      expect(OpeningTimeline.breath(OpeningTimeline.fullHandOffAt + 200), 0);
      const mid = (OpeningTimeline.settledAt + OpeningTimeline.fullHandOffAt) / 2;
      expect(OpeningTimeline.breath(mid), closeTo(1, 1e-9));
      // Rises, then falls: never a second peak, never negative.
      var peaks = 0;
      var last = 0.0;
      var rising = true;
      for (var t = OpeningTimeline.settledAt; t <= OpeningTimeline.fullHandOffAt; t += 10) {
        final b = OpeningTimeline.breath(t);
        expect(b, inInclusiveRange(0, 1));
        if (rising && b < last) {
          rising = false;
          peaks++;
        }
        if (!rising && b > last + 1e-12) peaks++;
        last = b;
      }
      expect(peaks, 1);
    });

    test('up to the composed word the first launch is the short opening, frame for frame', () {
      const size = Size(384, 853);
      for (var t = 0.0; t <= OpeningTimeline.settledAt; t += 40) {
        final short = OpeningTimeline.poseAt(t, size);
        final first = OpeningTimeline.poseAt(t, size, firstLaunch: true);
        expect(first.view, short.view, reason: 'view at $t ms');
      }
    });

    test('the hold swells the word by 3 percent at most, and the hand-off starts from the exact still word', () {
      const size = Size(384, 853);
      final rest = OpeningTimeline.wordView(size);
      const mid = (OpeningTimeline.settledAt + OpeningTimeline.fullHandOffAt) / 2;
      final peak = OpeningTimeline.poseAt(mid, size, firstLaunch: true).view!;
      expect(peak.width, closeTo(rest.width / (1 + OpeningTimeline.breathZoom), 1e-6));
      expect(peak.center.dx, closeTo(rest.center.dx, 1e-6));
      expect(peak.center.dy, closeTo(rest.center.dy, 1e-6));
      final atHandOff = OpeningTimeline.poseAt(OpeningTimeline.fullHandOffAt, size, firstLaunch: true).view!;
      expect(atHandOff.width, closeTo(rest.width, 1e-6));
      expect(atHandOff.height, closeTo(rest.height, 1e-6));
      // The short opening never swells.
      expect(OpeningTimeline.poseAt(mid, size).view!.width, closeTo(rest.width, 1e-6));
    });

    test('the hold is never blank: the word is whole and Mobi is alive through it', () {
      const size = Size(384, 853);
      for (var t = OpeningTimeline.settledAt; t <= OpeningTimeline.fullHandOffAt; t += 20) {
        final pose = OpeningTimeline.poseAt(t, size, firstLaunch: true);
        for (var i = 0; i < 7; i++) {
          expect(pose.glyph(i).opacity, 1, reason: 'letter $i is on the glass at $t ms');
        }
      }
      // The glance returns and a blink lands inside the hold.
      expect(OpeningTimeline.idleReturnAt, inInclusiveRange(OpeningTimeline.settledAt, OpeningTimeline.fullHandOffAt));
      expect(OpeningTimeline.idleFirstBlinkAt, inInclusiveRange(OpeningTimeline.settledAt, OpeningTimeline.fullHandOffAt));
    });
  });

  group('the host', () {
    testWidgets('the first launch plays the whole 3 s, then the flag is set', (tester) async {
      final prefs = await _pump(tester, firstLaunch: true);
      await tester.pump(const Duration(milliseconds: 2500));
      expect(find.byType(BrandOpening), findsOneWidget, reason: 'still playing at 2.5 s');
      // The flag is not spent before the word has been seen through.
      expect(await prefs.coldOpenSeen(), isFalse);
      final goneAt = await _goneAt(tester);
      // Gone at about 3.0 s counted from the 2.5 s already pumped.
      expect(2500 + goneAt, inInclusiveRange(2960, 3100));
      await tester.pump();
      expect(await prefs.coldOpenSeen(), isTrue);
      expect(find.text('First screen'), findsOneWidget);
    });

    testWidgets('a launch after that is the short opening, about 1.3 s', (tester) async {
      final prefs = await _pump(tester, firstLaunch: false);
      final goneAt = await _goneAt(tester);
      expect(goneAt, inInclusiveRange(OpeningTimeline.settledAt.round() + OpeningTimeline.fadeMs.round() - 40, 1400));
      expect(await prefs.coldOpenSeen(), isFalse, reason: 'a short launch never writes the flag');
      expect(find.text('First screen'), findsOneWidget);
    });

    testWidgets('the whole opening followed by the next launch: long once, then short', (tester) async {
      final store = MemoryPrefsStore();
      // Launch one: the provider main would build from the empty store.
      var due = await FirstLaunchOpening.due(AppPrefs(store));
      expect(due, isTrue);
      await _pump(tester, firstLaunch: due, store: store);
      final first = await _goneAt(tester);
      expect(first, greaterThan(2900));
      await tester.pump();
      // Launch two, a new process reading the same store.
      due = await FirstLaunchOpening.due(AppPrefs(store));
      expect(due, isFalse);
      await tester.pumpWidget(const SizedBox.shrink());
      await _pump(tester, firstLaunch: due, store: store);
      final second = await _goneAt(tester);
      expect(second, lessThan(1500));
    });

    testWidgets('a tap during the hold hands off at once, so the 3 s is never forced on anyone', (tester) async {
      await _pump(tester, firstLaunch: true);
      await tester.pump(const Duration(milliseconds: 1500));
      expect(find.byType(BrandOpening), findsOneWidget);
      await tester.tap(find.byType(BrandOpening));
      final goneAt = await _goneAt(tester, limit: 600);
      expect(goneAt, inInclusiveRange(1, 400));
      expect(find.text('First screen'), findsOneWidget);
    });

    testWidgets('reduced motion: the same short fade on the first launch', (tester) async {
      final prefs = await _pump(tester, firstLaunch: true, reduced: true);
      final goneAt = await _goneAt(tester);
      expect(goneAt, lessThan(700), reason: 'a fade, not 3 s');
      await tester.pump();
      expect(await prefs.coldOpenSeen(), isTrue, reason: 'it still counts as the first opening played');
    });
  });
}
