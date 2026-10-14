import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/analytics/analytics_client.dart';
import 'package:mockmob/core/analytics/analytics_queue_store.dart';
import 'package:mockmob/core/analytics/event_allowlist.dart';
import 'package:mockmob/core/api/api_error.dart';

class FakeTransport implements AnalyticsTransport {
  final List<List<Map<String, Object?>>> batches = [];
  Object? failure;
  bool collecting = true;

  @override
  Future<AnalyticsSendResult> send(List<Map<String, Object?>> events) async {
    if (failure != null) throw failure!;
    batches.add(events);
    return AnalyticsSendResult(accepted: events.length, dropped: 0, collecting: collecting);
  }
}

void main() {
  late MemoryAnalyticsQueueStore store;
  late FakeTransport transport;
  late AnalyticsGate gate;
  late List<String> stoppedFor;
  late DateTime now;
  var idCounter = 0;

  setUp(() {
    store = MemoryAnalyticsQueueStore();
    transport = FakeTransport();
    gate = const AnalyticsGate(userId: 'u1', consentActive: true);
    stoppedFor = [];
    now = DateTime.utc(2026, 10, 12, 18);
    idCounter = 0;
  });

  AnalyticsClient newClient() => AnalyticsClient(
        store: store,
        transport: transport,
        gate: () => gate,
        onServerStopped: (u) async => stoppedFor.add(u),
        appVersion: () => '1.0.3',
        now: () => now,
        newId: () => 'evt-${idCounter++}',
        flushDelay: const Duration(days: 1),
        flushThreshold: 1000,
      );

  group('nothing is queued unless consent is loaded and allows an adult', () {
    test('consent not loaded, failed, or not allowed: closed gate queues nothing', () async {
      gate = const AnalyticsGate(userId: 'u1', consentActive: false);
      expect(await newClient().track(AnalyticsEvents.appOpened), isFalse);
      expect(store.events, isEmpty);
    });

    test('signed out queues nothing', () async {
      gate = const AnalyticsGate(userId: null, consentActive: true);
      expect(await newClient().track(AnalyticsEvents.appOpened), isFalse);
      expect(store.events, isEmpty);
    });

    test('after the server said collecting false, nothing is queued', () async {
      gate = const AnalyticsGate(userId: 'u1', consentActive: true, stoppedForUser: true);
      expect(await newClient().track(AnalyticsEvents.appOpened), isFalse);
      expect(store.events, isEmpty);
    });

    test('an allowed adult queues the event tagged with the user id', () async {
      final queued = await newClient().track(AnalyticsEvents.sessionStarted, props: {'subject': 'accountancy', 'mode': 'full', 'count': 50});
      expect(queued, isTrue);
      final e = store.events.single;
      expect(e.userId, 'u1');
      expect(e.name, 'session_started');
      expect(e.props, {'subject': 'accountancy', 'mode': 'full', 'count': 50});
      expect(e.appVersion, '1.0.3');
      expect(e.eventId, 'evt-0');
    });

    test('nothing is sent when consent is off, even with events waiting', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.appOpened);
      gate = const AnalyticsGate(userId: 'u1', consentActive: false);
      await client.flush();
      expect(transport.batches, isEmpty);
    });

    test('nothing is sent when the consent read failed (gate closed)', () async {
      store.events.add(QueuedEvent(eventId: 'old', userId: 'u1', name: 'app_opened', props: const {}, occurredAt: now));
      gate = const AnalyticsGate(userId: 'u1', consentActive: false);
      await newClient().flush();
      expect(transport.batches, isEmpty);
    });
  });

  group('the schema is the server allowlist', () {
    test('an unknown event name is refused', () async {
      expect(await newClient().track('purchase_completed'), isFalse);
      expect(store.events, isEmpty);
    });

    test('every server event name is accepted', () async {
      final client = newClient();
      for (final name in AnalyticsEvents.all) {
        expect(await client.track(name), isTrue, reason: name);
      }
      expect(store.events.length, 19);
    });

    test('an unknown prop key refuses the whole event', () async {
      expect(await newClient().track(AnalyticsEvents.appOpened, props: {'email': 'a@b.co'}), isFalse);
      expect(await newClient().track(AnalyticsEvents.appOpened, props: {'subject': 'x', 'marks': 115}), isFalse);
      expect(store.events, isEmpty);
    });

    test('wrong prop types and over-long strings are refused', () async {
      final client = newClient();
      expect(await client.track(AnalyticsEvents.appOpened, props: {'count': '5'}), isFalse);
      expect(await client.track(AnalyticsEvents.appOpened, props: {'subject': 5}), isFalse);
      expect(await client.track(AnalyticsEvents.appOpened, props: {'subject': 'x' * 65}), isFalse);
      expect(await client.track(AnalyticsEvents.appOpened, props: {'minutes': double.nan}), isFalse);
      expect(await client.track(AnalyticsEvents.appOpened, props: {'subject': 'x' * 64}), isTrue);
    });

    test('the allowed prop keys are exactly the server ones', () {
      expect(analyticsPropTypes.keys.toSet(), {'subject', 'mode', 'state', 'action_type', 'minutes', 'count', 'outcome', 'source', 'screen', 'variant'});
      expect(analyticsPropTypes['minutes'], AnalyticsPropType.number);
      expect(analyticsPropTypes['count'], AnalyticsPropType.number);
    });

    test('an over-long app version is cut to 32 characters', () async {
      final client = AnalyticsClient(
        store: store,
        transport: transport,
        gate: () => gate,
        onServerStopped: (_) async {},
        appVersion: () => 'v' * 40,
        now: () => now,
      );
      await client.track(AnalyticsEvents.appOpened);
      expect(store.events.single.appVersion!.length, 32);
    });

    test('the wire shape has event_id, name, platform android, app_version, ISO time and props', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.recapSkipped, props: {'screen': '2'});
      await client.flush();
      final wire = transport.batches.single.single;
      expect(wire, {
        'event_id': 'evt-0',
        'name': 'recap_skipped',
        'platform': 'android',
        'app_version': '1.0.3',
        'occurred_at': '2026-10-12T18:00:00.000Z',
        'props': {'screen': '2'},
      });
    });
  });

  group('a flush sends only the signed-in user events', () {
    test('events of another user stay out of the request', () async {
      store.events
        ..add(QueuedEvent(eventId: 'mine', userId: 'u1', name: 'app_opened', props: const {}, occurredAt: now))
        ..add(QueuedEvent(eventId: 'theirs', userId: 'minor-user', name: 'app_opened', props: const {}, occurredAt: now));
      await newClient().flush();
      expect([for (final b in transport.batches) ...b.map((e) => e['event_id'])], ['mine']);
      // The other user's event is neither sent nor deleted by this flush.
      expect([for (final e in store.events) e.eventId], ['theirs']);
    });

    test('after an account switch the earlier account events are never sent under the new one', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.appOpened);
      gate = const AnalyticsGate(userId: 'u2', consentActive: true);
      await client.flush();
      expect(transport.batches, isEmpty);
      await client.discardAll();
      expect(store.events, isEmpty);
    });

    test('batches hold at most 50 events', () async {
      final client = newClient();
      for (var i = 0; i < 120; i++) {
        await client.track(AnalyticsEvents.appOpened);
      }
      await client.flush();
      expect([for (final b in transport.batches) b.length], [50, 50, 20]);
      expect(store.events, isEmpty);
    });

    test('events older than seven days are dropped instead of failing the batch', () async {
      store.events
        ..add(QueuedEvent(eventId: 'old', userId: 'u1', name: 'app_opened', props: const {}, occurredAt: now.subtract(const Duration(days: 8))))
        ..add(QueuedEvent(eventId: 'new', userId: 'u1', name: 'app_opened', props: const {}, occurredAt: now));
      await newClient().flush();
      expect([for (final b in transport.batches) ...b.map((e) => e['event_id'])], ['new']);
      expect(store.events, isEmpty);
    });
  });

  group('stopping and clearing', () {
    test('collecting false stops sending, clears the queue and records the stop', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.appOpened);
      await client.track(AnalyticsEvents.resultOpened);
      transport.collecting = false;
      await client.flush();
      expect(store.events, isEmpty);
      expect(stoppedFor, ['u1']);
      expect(transport.batches.length, 1);
    });

    test('discardAll empties the queue (withdrawal, sign-out, account switch)', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.appOpened);
      await client.track(AnalyticsEvents.finishForNow);
      expect(store.events.length, 2);
      await client.discardAll();
      expect(store.events, isEmpty);
      await client.flush();
      expect(transport.batches, isEmpty);
    });

    test('an offline or server error keeps the events for the next flush', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.appOpened);
      for (final failure in [
        const ApiError(kind: ApiErrorKind.network, code: 'network'),
        const ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'unavailable'),
        const ApiError(status: 429, kind: ApiErrorKind.rateLimited, code: 'rate_limited'),
      ]) {
        transport.failure = failure;
        await client.flush();
        expect(store.events.length, 1);
      }
      transport.failure = null;
      await client.flush();
      expect(store.events, isEmpty);
    });

    test('a batch the server calls invalid is dropped, not retried forever', () async {
      final client = newClient();
      await client.track(AnalyticsEvents.appOpened);
      transport.failure = const ApiError(status: 400, kind: ApiErrorKind.validation, code: 'bad_request');
      await client.flush();
      expect(store.events, isEmpty);
    });

    test('consent withdrawn between batches stops the flush', () async {
      final client = newClient();
      for (var i = 0; i < 60; i++) {
        await client.track(AnalyticsEvents.appOpened);
      }
      var sends = 0;
      final spy = _SpyTransport(() {
        sends++;
        gate = const AnalyticsGate(userId: 'u1', consentActive: false);
      });
      final spied = AnalyticsClient(
        store: store,
        transport: spy,
        gate: () => gate,
        onServerStopped: (_) async {},
        now: () => now,
      );
      await spied.flush();
      expect(sends, 1);
    });
  });
}

class _SpyTransport implements AnalyticsTransport {
  _SpyTransport(this.onSend);

  final void Function() onSend;

  @override
  Future<AnalyticsSendResult> send(List<Map<String, Object?>> events) async {
    onSend();
    return AnalyticsSendResult(accepted: events.length, dropped: 0, collecting: true);
  }
}
