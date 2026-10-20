import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../repositories/consent_repository.dart';
import '../repositories/local_scope.dart';
import '../storage/storage_providers.dart';
import 'analytics_queue_store.dart';
import 'event_allowlist.dart';

/// What the client needs to decide whether it may queue or send right now.
class AnalyticsGate {
  const AnalyticsGate({required this.userId, required this.consentActive, this.stoppedForUser = false});

  /// The signed-in MockMob user id. Null when signed out.
  final String? userId;

  /// The consent read succeeded and says usage data is allowed (the student did not say they are under 18), with
  /// no withdrawal pending.
  final bool consentActive;

  /// The server answered `collecting:false` for this user.
  final bool stoppedForUser;

  bool get open => userId != null && consentActive && !stoppedForUser;
}

class AnalyticsSendResult {
  const AnalyticsSendResult({required this.accepted, required this.dropped, required this.collecting});

  final int accepted;
  final int dropped;
  final bool collecting;
}

abstract class AnalyticsTransport {
  /// Posts one batch. Throws [ApiError] on failure.
  Future<AnalyticsSendResult> send(List<Map<String, Object?>> events);
}

class ApiAnalyticsTransport implements AnalyticsTransport {
  ApiAnalyticsTransport(this._api);

  final ApiClient _api;

  @override
  Future<AnalyticsSendResult> send(List<Map<String, Object?>> events) async {
    final response = await _api.post('/api/events', body: {'events': events}, options: const ApiOptions(retries: 0));
    final map = response.map;
    return AnalyticsSendResult(
      accepted: (map['accepted'] as num?)?.toInt() ?? 0,
      dropped: (map['dropped'] as num?)?.toInt() ?? 0,
      collecting: map['collecting'] != false,
    );
  }
}

/// Consent-gated usage-data client (design spec 5.12.3).
///
/// Rules, each covered by a unit test:
/// - nothing is queued or sent unless the consent record loaded and allows it (never for a student under 18),
/// - the queue is cleared on withdrawal, sign-out and account switch ([discardAll]),
/// - a flush sends only events tagged with the signed-in user's id,
/// - sending stops when the server answers `collecting:false`,
/// - only allowlisted names and props are accepted.
class AnalyticsClient {
  AnalyticsClient({
    required this._store,
    required this._transport,
    required this._gate,
    required this._onServerStopped,
    String Function()? appVersion,
    DateTime Function()? now,
    String Function()? newId,
    this.flushDelay = const Duration(seconds: 30),
    this.flushThreshold = 20,
  })  : _appVersion = appVersion ?? (() => ''),
        _now = now ?? DateTime.now,
        _newId = newId ?? (() => const Uuid().v4());

  final AnalyticsQueueStore _store;
  final AnalyticsTransport _transport;
  final AnalyticsGate Function() _gate;
  final Future<void> Function(String userId) _onServerStopped;
  final String Function() _appVersion;
  final DateTime Function() _now;
  final String Function() _newId;
  final Duration flushDelay;
  final int flushThreshold;

  Timer? _timer;
  Future<void>? _flushing;
  int _sinceFlush = 0;

  /// The user the queue belongs to, as last seen. A provider listener alone cannot be relied
  /// on to clear the queue on sign-out or account switch, so every call also reconciles here.
  Object? _seenUser = _unseen;
  bool _queuedSinceClear = false;
  static const Object _unseen = Object();

  /// Empties the queue when the signed-in user changed or the gate closed since events were
  /// queued, before anything is queued or sent.
  Future<void> _reconcile(AnalyticsGate gate) async {
    final userChanged = !identical(_seenUser, _unseen) && _seenUser != gate.userId;
    _seenUser = gate.userId;
    if (userChanged || (!gate.open && _queuedSinceClear)) await discardAll();
  }

  /// Queues one event when the gate is open. Returns whether it was queued. An unknown name
  /// or prop is refused here rather than being dropped later by the server.
  Future<bool> track(String name, {Map<String, Object?>? props}) async {
    final gate = _gate();
    await _reconcile(gate);
    if (!gate.open) return false;
    if (!AnalyticsEvents.all.contains(name)) return false;
    final clean = validateEventProps(props);
    if (clean == null) return false;
    var version = _appVersion();
    if (version.length > maxAppVersionLength) version = version.substring(0, maxAppVersionLength);
    _queuedSinceClear = true;
    await _store.add(QueuedEvent(
      eventId: _newId(),
      userId: gate.userId!,
      name: name,
      props: clean,
      occurredAt: _now(),
      appVersion: version.isEmpty ? null : version,
    ));
    // The consent may have been withdrawn while the insert was in flight.
    if (!_gate().open) {
      await _store.clearAll();
      return false;
    }
    _scheduleFlush();
    return true;
  }

  void _scheduleFlush() {
    _sinceFlush++;
    if (_sinceFlush >= flushThreshold) {
      unawaited(flush());
      return;
    }
    _timer ??= Timer(flushDelay, () {
      _timer = null;
      unawaited(flush());
    });
  }

  /// Sends queued events of the signed-in user, oldest first, in batches of at most 50.
  Future<void> flush() => _flushing ??= _flush().whenComplete(() => _flushing = null);

  Future<void> _flush() async {
    _timer?.cancel();
    _timer = null;
    _sinceFlush = 0;
    while (true) {
      final gate = _gate();
      await _reconcile(gate);
      if (!gate.open) return;
      final userId = gate.userId!;
      var batch = await _store.forUser(userId, limit: maxEventsPerBatch);
      if (batch.isEmpty) return;

      // The server rejects events older than 7 days; drop them instead of failing the batch.
      final cutoff = _now().subtract(maxEventAge);
      final stale = [for (final e in batch) if (e.occurredAt.isBefore(cutoff)) e.eventId];
      if (stale.isNotEmpty) {
        await _store.remove(stale);
        batch = [for (final e in batch) if (!stale.contains(e.eventId)) e];
        if (batch.isEmpty) continue;
      }

      final AnalyticsSendResult result;
      try {
        result = await _transport.send([for (final e in batch) e.toWire()]);
      } on ApiError catch (e) {
        // A malformed batch can never succeed: drop it. Anything else (offline, 429, 5xx,
        // 401) keeps the events for the next flush.
        if (e.kind == ApiErrorKind.validation || e.kind == ApiErrorKind.payloadTooLarge) {
          await _store.remove([for (final b in batch) b.eventId]);
        }
        return;
      }
      if (!result.collecting) {
        await _stopForUser(userId);
        return;
      }
      await _store.remove([for (final b in batch) b.eventId]);
      if (batch.length < maxEventsPerBatch) return;
    }
  }

  Future<void> _stopForUser(String userId) async {
    await _store.clearAll();
    await _onServerStopped(userId);
  }

  /// Deletes the whole queue and cancels pending sends. Called on withdrawal, sign-out and
  /// account switch.
  Future<void> discardAll() async {
    _timer?.cancel();
    _timer = null;
    _sinceFlush = 0;
    _queuedSinceClear = false;
    await _store.clearAll();
  }

  void dispose() => _timer?.cancel();
}

final analyticsQueueStoreProvider = Provider<AnalyticsQueueStore>((ref) => DriftAnalyticsQueueStore(ref.watch(appDatabaseProvider)));

final appVersionProvider = FutureProvider<String>((ref) async {
  final info = await PackageInfo.fromPlatform();
  return info.version;
});

/// The client. Gated on the signed-in user and the consent record, and cleared on withdrawal,
/// sign-out and account switch.
final analyticsClientProvider = Provider<AnalyticsClient>((ref) {
  final prefs = ref.watch(appPrefsProvider);
  var stoppedFor = <String?>{};
  unawaited(prefs.analyticsStoppedFor().then((id) => stoppedFor = {id}));

  final client = AnalyticsClient(
    store: ref.watch(analyticsQueueStoreProvider),
    transport: ApiAnalyticsTransport(ref.watch(apiClientProvider)),
    gate: () {
      final userId = ref.read(userIdProvider);
      return AnalyticsGate(
        userId: userId,
        consentActive: ref.read(consentRepositoryProvider).analyticsActive,
        stoppedForUser: userId != null && stoppedFor.contains(userId),
      );
    },
    onServerStopped: (userId) async {
      stoppedFor = {userId};
      await prefs.setAnalyticsStoppedFor(userId);
    },
    appVersion: () => ref.read(appVersionProvider).value ?? '',
    now: ref.watch(nowProvider),
  );

  // Withdrawal: drop the queue before the consent call goes out, and again when the state flips.
  ref.onDispose(ref.read(consentRepositoryProvider.notifier).addBeforeWithdrawalHook(client.discardAll));
  ref.listen(consentRepositoryProvider, (previous, next) {
    if (!next.analyticsActive) {
      unawaited(client.discardAll());
    } else if (previous?.analyticsActive != true) {
      // Turned on again: the server-side stop no longer applies.
      unawaited(prefs.analyticsStoppedFor().then((id) => stoppedFor = {id}));
    }
  });
  // Sign-out and account switch: a user id change always empties the queue.
  ref.listen(userIdProvider, (previous, next) {
    if (previous != next) unawaited(client.discardAll());
  });
  ref.onDispose(client.dispose);
  return client;
});
