// Today's clock (today-02), the "Not today" expiry that depends on it (today-04) and the
// ended-mock server check that retries when the network returns (today-05).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/dismissal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_clock.dart';

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';
import 'support/today_fixtures.dart';

class _FakeNetwork extends NetworkStatusNotifier {
  _FakeNetwork(this.first);

  final NetworkStatus first;

  @override
  NetworkStatus build() => first;

  void set(NetworkStatus next) => state = next;
}

void main() {
  const kolkata = 'Asia/Kolkata';

  group('untilNextTodayTick', () {
    test("waits for the next hour on the student's wall clock, not UTC", () {
      // 8:40 PM in Kolkata: the next hour is 9:00 PM, 20 minutes away (UTC hours are at :30 there).
      expect(untilNextTodayTick(now: tuesdayEvening, timezone: kolkata), const Duration(minutes: 20));
    });

    test("an open session's deadline comes first when it is sooner", () {
      final ends = tuesdayEvening.add(const Duration(minutes: 7)).millisecondsSinceEpoch;
      expect(untilNextTodayTick(now: tuesdayEvening, timezone: kolkata, sessionEndsAtMs: ends), const Duration(minutes: 7));
    });

    test('the end of an ended notice is a tick too', () {
      final ends = tuesdayEvening.subtract(endedNoticeWindow).add(const Duration(minutes: 5)).millisecondsSinceEpoch;
      expect(untilNextTodayTick(now: tuesdayEvening, timezone: kolkata, sessionEndsAtMs: ends), const Duration(minutes: 5));
    });

    test('a deadline already behind us, or far off, changes nothing', () {
      final past = tuesdayEvening.subtract(const Duration(hours: 3)).millisecondsSinceEpoch;
      final far = tuesdayEvening.add(const Duration(hours: 5)).millisecondsSinceEpoch;
      expect(untilNextTodayTick(now: tuesdayEvening, timezone: kolkata, sessionEndsAtMs: past), const Duration(minutes: 20));
      expect(untilNextTodayTick(now: tuesdayEvening, timezone: kolkata, sessionEndsAtMs: far), const Duration(minutes: 20));
    });

    test('never spins: at least one second', () {
      final ends = tuesdayEvening.add(const Duration(milliseconds: 200)).millisecondsSinceEpoch;
      expect(untilNextTodayTick(now: tuesdayEvening, timezone: kolkata, sessionEndsAtMs: ends), const Duration(seconds: 1));
    });
  });

  group('TodayClock', () {
    ProviderContainer containerAt(DateTime Function() clock) => ProviderContainer(overrides: [
          nowProvider.overrideWithValue(clock),
          studentTimezoneProvider.overrideWithValue(kolkata),
          latestSessionDraftProvider.overrideWith((ref) => Stream<SessionDraft?>.value(null)),
        ]);

    testWidgets('ticks on its own at the next hour and every hour after', (tester) async {
      var now = tuesdayEvening;
      Future<void> pass(Duration d) async {
        now = now.add(d);
        await tester.pump(d);
      }

      final c = containerAt(() => now);
      final seen = <int>[];
      c.listen(todayClockProvider, (_, next) => seen.add(next), fireImmediately: true);
      await pass(const Duration(seconds: 1));
      expect(seen, [0]);
      await pass(const Duration(minutes: 20));
      expect(seen, [0, 1], reason: 'at 9:00 PM the clock re-samples');
      await pass(const Duration(hours: 1));
      expect(seen, [0, 1, 2]);
      c.dispose();
      // The test binding fails the test if the disposed clock left a timer behind.
    });

    // `pump(Duration.zero)` runs zero-length timers too (Riverpod's own refresh and the clock's
    // wake-up); a bare `pump()` only flushes microtasks.
    testWidgets('no timer outlives the last listener (Today closed, container still alive)', (tester) async {
      final c = containerAt(() => tuesdayEvening);
      // Disposed only after the binding's pending-timer check, like the app's own container.
      addTearDown(c.dispose);
      final sub = c.listen(todayClockProvider, (_, _) {}, fireImmediately: true);
      await tester.pump(Duration.zero);
      sub.close();
      await tester.pump(Duration.zero);
      // The binding fails the test here if the clock's next-hour timer is still pending.
    });

    testWidgets('paused while out of view; back in view a missed hour re-samples once', (tester) async {
      var now = tuesdayEvening;
      final c = containerAt(() => now);
      addTearDown(c.dispose);
      final seen = <int>[];
      final sub = c.listen(todayClockProvider, (_, next) => seen.add(next), fireImmediately: true);
      await tester.pump(Duration.zero);
      expect(seen, [0]);

      sub.pause(); // Today went behind another tab.
      now = now.add(const Duration(hours: 2));
      await tester.pump(const Duration(hours: 2));
      expect(seen, [0], reason: 'nothing ticks while nobody is looking');

      sub.resume();
      await tester.pump(Duration.zero);
      expect(seen, [0, 1], reason: 'the 9:00 PM boundary passed while away');

      // Armed again for the next hour (11:00 PM, 20 minutes on from 10:40 PM).
      now = now.add(const Duration(minutes: 20));
      await tester.pump(const Duration(minutes: 20));
      expect(seen, [0, 1, 2]);
      sub.close();
    });

    testWidgets('back in view before the hour: no extra tick', (tester) async {
      var now = tuesdayEvening;
      final c = containerAt(() => now);
      addTearDown(c.dispose);
      final seen = <int>[];
      final sub = c.listen(todayClockProvider, (_, next) => seen.add(next), fireImmediately: true);
      await tester.pump(Duration.zero);
      sub.pause();
      now = now.add(const Duration(minutes: 5));
      await tester.pump(const Duration(minutes: 5));
      sub.resume();
      await tester.pump(Duration.zero);
      expect(seen, [0]);

      // The rest of the 20 minutes to 9:00 PM is still armed.
      now = now.add(const Duration(minutes: 15));
      await tester.pump(const Duration(minutes: 15));
      expect(seen, [0, 1]);
      sub.close();
    });

    testWidgets('refresh re-samples at once (the app came back to the front)', (tester) async {
      final c = containerAt(() => tuesdayEvening);
      c.listen(todayClockProvider, (_, _) {}, fireImmediately: true);
      await tester.pump();
      expect(c.read(todayClockProvider), 0);
      c.read(todayClockProvider.notifier).refresh();
      expect(c.read(todayClockProvider), 1);
      c.dispose();
    });
  });

  group('"Not today" after 4:00 AM (today-04)', () {
    late AppDatabase db;
    late DateTime now;
    late ProviderContainer container;
    const key = DismissalKey(kind: 'repair', subject: 'accountancy', sourceAttemptId: 'm7');

    setUp(() {
      db = newTestDb();
      now = DateTime.utc(2026, 10, 13, 17, 30); // 11:00 PM in Kolkata
      final scope = LocalScope(db, () => 'u1', () => now);
      container = ProviderContainer(overrides: [
        nowProvider.overrideWithValue(() => now),
        studentTimezoneProvider.overrideWithValue(kolkata),
        userIdProvider.overrideWithValue('u1'),
        latestSessionDraftProvider.overrideWith((ref) => Stream<SessionDraft?>.value(null)),
        dismissalRepositoryProvider.overrideWithValue(DismissalRepository(scope, () => kolkata)),
      ]);
    });

    tearDown(() async {
      container.dispose();
      await db.close();
    });

    test('a dismissal made at 11 PM stops hiding the repair once the clock ticks past 4:00 AM', () async {
      await container.read(dismissalRepositoryProvider).dismiss(key);
      final sub = container.listen(todayDismissalsProvider, (_, _) {});
      addTearDown(sub.close);
      expect(await container.read(todayDismissalsProvider.future), {key});

      now = DateTime.utc(2026, 10, 14, 1, 30); // 7:00 AM, app still alive
      container.read(todayClockProvider.notifier).refresh();
      expect(await container.read(todayDismissalsProvider.future), isEmpty);
    });

    test('before 4:00 AM a tick keeps it hidden', () async {
      await container.read(dismissalRepositoryProvider).dismiss(key);
      final sub = container.listen(todayDismissalsProvider, (_, _) {});
      addTearDown(sub.close);
      now = DateTime.utc(2026, 10, 13, 22, 29); // 3:59 AM
      container.read(todayClockProvider.notifier).refresh();
      expect(await container.read(todayDismissalsProvider.future), {key});
    });
  });

  group('the ended-mock server check (today-05)', () {
    late FakeHttpAdapter http;
    late _FakeNetwork network;
    late ProviderContainer container;
    var offline = true;

    setUp(() {
      offline = true;
      http = FakeHttpAdapter()..handler = (o) => offline ? const FakeReply.network() : const FakeReply(200, {'id': 'm8'});
      network = _FakeNetwork(NetworkStatus.offline);
      container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(newApiClient(http)),
        networkStatusProvider.overrideWith(() => network),
      ]);
    });

    tearDown(() => container.dispose());

    test('a read that failed offline is asked again when the network returns', () async {
      final sub = container.listen(endedAttemptExistsProvider('m8'), (_, _) {});
      addTearDown(sub.close);
      expect(await container.read(endedAttemptExistsProvider('m8').future), isNull, reason: 'offline: still checking');

      offline = false;
      network.set(NetworkStatus.online);
      expect(await container.read(endedAttemptExistsProvider('m8').future), isTrue);
    });

    test('an answer that came back is not thrown away when the phone goes offline', () async {
      offline = false;
      final sub = container.listen(endedAttemptExistsProvider('m8'), (_, _) {});
      addTearDown(sub.close);
      expect(await container.read(endedAttemptExistsProvider('m8').future), isTrue);
      final asked = http.requests.length;
      offline = true;
      network.set(NetworkStatus.offline);
      await Future<void>.delayed(Duration.zero);
      expect(await container.read(endedAttemptExistsProvider('m8').future), isTrue);
      expect(http.requests.length, asked, reason: 'a recorded paper is not asked about again');
    });
  });
}
