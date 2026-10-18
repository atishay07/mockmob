// M1 and M2 of the v15 emulator walk. After the network came back Today kept saying "Not refreshed" for over a
// minute until the student tapped the line, and the line's time read as the failed try. Now one debounced read runs
// by itself when the connection returns, the line carries the time of the last GOOD read, and Today and Review say
// the same words over a saved copy.
import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier, networkRestoredProvider, networkStatusProvider;
import 'package:mockmob/core/copy/state_words.dart' show SavedCopy;
import 'package:mockmob/features/review/widgets/page_header.dart' show HeaderNotice;
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart' show buildHeader;
import 'package:mockmob/features/today/logic/today_inputs.dart';

class _FakeNetwork extends NetworkStatusNotifier {
  _FakeNetwork(this.initial);

  final NetworkStatus initial;

  @override
  NetworkStatus build() => initial;

  void set(NetworkStatus next) => state = next;
}

/// Counts the reads Today makes; the real ones need a signed-in account and a server.
class _CountingActions extends TodayActions {
  _CountingActions(super.ref, this.log);

  final List<String> log;

  @override
  Future<void> refresh() async => log.add('refresh');

  @override
  void noteTry() => log.add('noteTry');

  /// What the copy on screen looks like after each read: true while the test says it is still a saved one.
  bool saved = false;

  @override
  bool stillSaved() => saved;
}

void main() {
  group('Today reads again by itself when the network returns (M1)', () {
    late List<String> log;
    late _FakeNetwork network;
    late StreamController<void> restored;
    late ProviderContainer container;

    void open() {
      log = [];
      network = _FakeNetwork(NetworkStatus.offline);
      restored = StreamController<void>.broadcast();
      container = ProviderContainer(overrides: [
        networkStatusProvider.overrideWith(() => network),
        networkRestoredProvider.overrideWith((ref) => restored.stream),
        todayActionsProvider.overrideWith((ref) => _CountingActions(ref, log)),
      ]);
      container.listen(todayReconnectRefreshProvider, (_, _) {});
    }

    void close() {
      container.dispose();
      unawaited(restored.close());
    }

    test('offline to online reads once, about a second after the connection settles, and notes the try', () {
      fakeAsync((async) {
        open();
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce - const Duration(milliseconds: 100));
        expect(log, isEmpty, reason: 'not before the connection has settled');
        async.elapse(const Duration(milliseconds: 200));
        async.flushMicrotasks();
        expect(log, ['refresh', 'noteTry']);
        close();
      });
    });

    test('the restored signal and the status change for one reconnect read once, not twice', () {
      fakeAsync((async) {
        open();
        network.set(NetworkStatus.online);
        restored.add(null);
        async.elapse(const Duration(milliseconds: 300));
        restored.add(null);
        async.elapse(todayReconnectDebounce * 3);
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(1));
        close();
      });
    });

    test('a connection that flaps reads once, after it settles', () {
      fakeAsync((async) {
        open();
        for (var i = 0; i < 3; i++) {
          network.set(NetworkStatus.online);
          async.elapse(const Duration(milliseconds: 200));
          network.set(NetworkStatus.offline);
          async.elapse(const Duration(milliseconds: 200));
        }
        expect(log, isEmpty, reason: 'still flapping');
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce + const Duration(milliseconds: 50));
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(1));
        close();
      });
    });

    test('going offline, or never having been offline, reads nothing', () {
      fakeAsync((async) {
        open();
        network.set(NetworkStatus.unknown);
        network.set(NetworkStatus.online);
        network.set(NetworkStatus.offline);
        async.elapse(todayReconnectDebounce * 3);
        async.flushMicrotasks();
        expect(log, isEmpty);
        close();
      });
    });

    test('a copy that is still a saved one after the read is read again at 8 s and 25 s, then left alone', () {
      fakeAsync((async) {
        open();
        (container.read(todayActionsProvider) as _CountingActions).saved = true;
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce + const Duration(milliseconds: 50));
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(1));
        async.elapse(todayReconnectRetries[0] + const Duration(milliseconds: 50));
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(2), reason: 'the first quiet look');
        async.elapse(todayReconnectRetries[1] + const Duration(milliseconds: 50));
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(3), reason: 'the second quiet look');
        async.elapse(const Duration(minutes: 10));
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(3), reason: 'never a timer that runs for ever');
        close();
      });
    });

    test('a copy that came back fresh is not read again', () {
      fakeAsync((async) {
        open();
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce + const Duration(milliseconds: 50));
        async.flushMicrotasks();
        async.elapse(const Duration(minutes: 2));
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(1));
        close();
      });
    });

    test('a second reconnect later reads again', () {
      fakeAsync((async) {
        open();
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce * 2);
        async.flushMicrotasks();
        network.set(NetworkStatus.offline);
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce * 2);
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(2));
        close();
      });
    });
  });

  group('Today returning to the front reads a saved copy again (v15 final walk, M-c)', () {
    // What the walk saw: the radio dropped on the Review tab, came back, and Today kept "Offline. Last loaded" for over a minute
    // until its line was tapped. Not the cause, checked below: Riverpod pausing what a hidden Today listens to. A paused
    // listener of todayReconnectRefreshProvider still sees the reconnect, because the provider's own listeners are not paused.
    // The cause is in the data: the one read after the reconnect can fail (the link is not usable for a second or two), or wait
    // behind a read the dropped radio left hanging (the API client waits 30 s), and ended as a connection error with the monitor
    // already saying online. Two quiet re-reads cover the first seconds; a Today that was out of sight when they ran, or had given
    // up, has nothing left that looks again. So Today reads a saved copy again at the moment it comes back to the front.
    late List<String> log;
    late _FakeNetwork network;
    late ProviderContainer container;
    late DateTime clock;

    _CountingActions actions() => container.read(todayActionsProvider) as _CountingActions;

    void open() {
      log = [];
      clock = DateTime.utc(2026, 10, 18, 10);
      network = _FakeNetwork(NetworkStatus.offline);
      container = ProviderContainer(overrides: [
        networkStatusProvider.overrideWith(() => network),
        networkRestoredProvider.overrideWith((ref) => const Stream<void>.empty()),
        nowProvider.overrideWithValue(() => clock),
        todayActionsProvider.overrideWith((ref) => _CountingActions(ref, log)),
      ]);
    }

    test('a hidden Today (a paused listener) still sees the reconnect: the listener is not the gap', () {
      fakeAsync((async) {
        open();
        final sub = container.listen(todayReconnectRefreshProvider, (_, _) {});
        sub.pause();
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce * 2);
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(1));
        container.dispose();
      });
    });

    test('the read after the reconnect failed and the retries are used up: coming back to the front reads once more', () {
      fakeAsync((async) {
        open();
        container.listen(todayReconnectRefreshProvider, (_, _) {});
        actions().saved = true;
        network.set(NetworkStatus.online);
        async.elapse(todayReconnectDebounce + todayReconnectRetries[0] + todayReconnectRetries[1] + const Duration(seconds: 5));
        async.flushMicrotasks();
        final before = log.where((e) => e == 'refresh').length;
        expect(before, 3, reason: 'the reconnect read and the two quiet looks, all still saved');
        async.elapse(const Duration(minutes: 3));
        expect(log.where((e) => e == 'refresh').length, before, reason: 'nothing runs by itself any more');
        clock = clock.add(const Duration(minutes: 3));
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh').length, before + 1);
        container.dispose();
      });
    });

    test('back in front with a saved copy and the network up: one read, and the try is noted', () {
      fakeAsync((async) {
        open();
        actions().saved = true;
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        expect(log, ['refresh', 'noteTry']);
        container.dispose();
      });
    });

    test('back in front with a fresh copy reads nothing', () {
      fakeAsync((async) {
        open();
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        expect(log, isEmpty);
        container.dispose();
      });
    });

    test('flicking between tabs reads once in ten seconds, and again after that', () {
      fakeAsync((async) {
        open();
        actions().saved = true;
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        clock = clock.add(const Duration(seconds: 4));
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(1), reason: 'the second visit came inside the gap');
        clock = clock.add(TodayActions.shownReadGap);
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        expect(log.where((e) => e == 'refresh'), hasLength(2));
        container.dispose();
      });
    });

    test('it sets no timer: nothing is left running after the read', () {
      fakeAsync((async) {
        open();
        actions().saved = true;
        unawaited(actions().refreshWhenShown());
        async.flushMicrotasks();
        expect(async.pendingTimers, isEmpty);
        container.dispose();
      });
    });
  });

  group('the line over a saved copy (M2)', () {
    // Papers last read at 7:26 AM IST; a try failed at 7:32 AM. The line is about the data on screen.
    final goodRead = DateTime.utc(2026, 10, 18, 1, 56);
    final failedTry = DateTime.utc(2026, 10, 18, 2, 2);
    final now = DateTime.utc(2026, 10, 18, 2, 5);

    TodayInputs inputs({bool stale = false, bool offline = false, bool readOffline = false, DateTime? tried, DateTime? planRead}) => TodayInputs(
          now: now,
          timezone: 'Asia/Kolkata',
          attempts: const [],
          attemptsFetchedAt: goodRead,
          attemptsStale: stale,
          planFetchedAt: planRead ?? goodRead,
          offline: offline,
          readOffline: readOffline,
          lastTriedAt: tried,
        );

    test('"Not refreshed" names the last good read, never the failed try', () {
      final line = buildHeader(inputs(stale: true)).updatedLine!;
      expect(line, 'Not refreshed. Last loaded 7:26 AM.');
      expect(line, isNot(contains('7:32')));
    });

    test('after a Try again that changed nothing, the line still names the last good read and fits one line', () {
      final header = buildHeader(inputs(stale: true, tried: failedTry));
      expect(header.updatedLine, 'Still not loading. Last loaded 7:26 AM.');
      expect(header.refreshable, isTrue, reason: 'the line still runs Try again');
    });

    test('the older of the two reads stands: a newer plan never makes days-old papers look fresh', () {
      final line = buildHeader(inputs(stale: true, planRead: failedTry)).updatedLine!;
      expect(line, 'Not refreshed. Last loaded 7:26 AM.');
    });

    test('a fresh read says nothing', () {
      expect(buildHeader(inputs()).updatedLine, isNull);
    });

    test('offline says the same words Review says, with the same time', () {
      final today = buildHeader(inputs(stale: true, offline: true)).updatedLine;
      final review = HeaderNotice.forFailure(offline: true, lastGoodRead: DateTime.utc(2026, 10, 18, 7, 26));
      expect(today, 'Offline. Last loaded 7:26 AM.');
      expect(review, today);
    });

    test('a refresh that failed for a connection error reads as offline even while the monitor says online', () {
      final header = buildHeader(inputs(stale: true, readOffline: true));
      expect(header.updatedLine, 'Offline. Last loaded 7:26 AM.');
      expect(header.offline, isTrue);
      expect(header.refreshable, isTrue, reason: 'online by the monitor: a tap on the line still reads again');
    });

    test('a server error stays "Not refreshed", the same words Review uses', () {
      final today = buildHeader(inputs(stale: true)).updatedLine;
      final review = HeaderNotice.forFailure(offline: false, lastGoodRead: DateTime.utc(2026, 10, 18, 7, 26));
      expect(review, today);
    });

    test('an unknown time never invents one', () {
      expect(SavedCopy.offline(null), 'Offline. Showing what is saved on this phone.');
      expect(SavedCopy.refreshFailed(null), 'Not refreshed. Showing your saved record.');
    });

    test('the connection and timeout errors are the offline cause; a server error is not', () {
      expect(const ApiError(kind: ApiErrorKind.network, code: 'network').isOffline, isTrue);
      expect(const ApiError(kind: ApiErrorKind.timeout, code: 'timeout').isOffline, isTrue);
      expect(const ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500).isOffline, isFalse);
    });
  });
}
