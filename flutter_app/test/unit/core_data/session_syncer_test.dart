import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/session/session_syncer.dart';

import 'support/fakes.dart';
import 'support/test_db.dart';

void main() {
  late AppDatabase db;
  late SessionClock clock;
  late SessionJournal journal;
  late FakeSessionApi api;
  late ManualTimers timers;
  late List<(int, DateTime)> acks;
  var conflicts = 0;
  ApiError? stoppedWith;

  setUp(() async {
    db = newTestDb();
    clock = SessionClock(monotonicMs: () => 0, wallMs: () => 0)..anchor(serverNowMs: 0, startedAtMs: 0, expiresAtMs: 600000);
    journal = await SessionJournal.open(db, userId: 'u1', sessionId: 's1');
    api = FakeSessionApi();
    timers = ManualTimers();
    acks = [];
    conflicts = 0;
    stoppedWith = null;
  });

  tearDown(() => db.close());

  SessionSyncer newSyncer({bool enabled = true, int ack = 0}) => SessionSyncer(
        api: api,
        journal: journal,
        sessionId: 's1',
        enabled: enabled,
        acknowledgedSequence: ack,
        timerFactory: timers.create,
        onAcknowledged: (seq, at) => acks.add((seq, at)),
        onConflict: () => conflicts++,
        onStopped: (e) => stoppedWith = e,
      );

  Future<void> settle() => Future<void>.delayed(Duration.zero);

  test('a change schedules one debounced PUT of the whole cumulative log', () async {
    final syncer = newSyncer();
    await journal.recordVisit('q1', clock);
    syncer.notifyChanged();
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    expect(timers.pendingCount, 1);
    expect(timers.pendingDelays.single, const Duration(milliseconds: 400));
    timers.fireNext();
    await settle();
    expect(api.puts.length, 1);
    expect([for (final e in api.puts.single) e.seq], [1, 2]);
    expect(syncer.acknowledgedSequence, 2);
    expect(acks.single.$1, 2);
    expect(syncer.hasUnacknowledged, isFalse);
    expect(syncer.status.value, SyncStatus.idle);
  });

  test('sends only when events changed', () async {
    final syncer = newSyncer();
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    expect(api.puts.length, 1);
    // No new event: notifyChanged and flushNow do nothing.
    syncer.notifyChanged();
    expect(timers.pendingCount, 0);
    await syncer.flushNow();
    expect(api.puts.length, 1);
    // A new event sends the full log again, with the first events as an identical prefix.
    await journal.recordAnswer('q2', 2, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    expect(api.puts.length, 2);
    expect([for (final e in api.puts.last) e.seq], [1, 2]);
    expect(api.puts.last.first, api.puts.first.first);
  });

  test('ticket mode never sends a PUT', () async {
    final syncer = newSyncer(enabled: false);
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    await syncer.flushNow();
    expect(timers.pendingCount, 0);
    expect(api.puts, isEmpty);
    expect(syncer.acknowledgedSequence, 0);
  });

  test('flushNow sends at once and cancels the debounce', () async {
    final syncer = newSyncer();
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    await syncer.flushNow();
    expect(api.puts.length, 1);
    expect(timers.pendingCount, 0);
  });

  test('network failure backs off 1, 2, 4, 8, 16, 30 then stays at 30 seconds', () async {
    final syncer = newSyncer();
    api.putFailure = () => const ApiError(kind: ApiErrorKind.network, code: 'network');
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    final delays = <Duration>[];
    timers.fireNext();
    await settle();
    expect(syncer.status.value, SyncStatus.failing);
    delays.add(timers.pendingDelays.single);
    for (var i = 0; i < 6; i++) {
      timers.fireNext();
      await settle();
      delays.add(timers.pendingDelays.single);
    }
    expect(delays, [
      const Duration(seconds: 1),
      const Duration(seconds: 2),
      const Duration(seconds: 4),
      const Duration(seconds: 8),
      const Duration(seconds: 16),
      const Duration(seconds: 30),
      const Duration(seconds: 30),
    ]);
    expect(acks, isEmpty);
    expect(syncer.hasUnacknowledged, isTrue);
  });

  test('recovers after a failure and resets the back-off', () async {
    final syncer = newSyncer();
    var fail = true;
    api.putFailure = () => fail ? const ApiError(kind: ApiErrorKind.timeout, code: 'timeout') : null;
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    fail = false;
    timers.fireNext();
    await settle();
    expect(syncer.acknowledgedSequence, 1);
    expect(syncer.status.value, SyncStatus.idle);
  });

  test('retryNow sends immediately and forgets the back-off', () async {
    final syncer = newSyncer();
    var fail = true;
    api.putFailure = () => fail ? const ApiError(kind: ApiErrorKind.network, code: 'network') : null;
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    timers.fireNext();
    await settle();
    fail = false;
    syncer.retryNow();
    expect(timers.pendingDelays.last, Duration.zero);
    timers.fireAll();
    await settle();
    expect(syncer.acknowledgedSequence, 1);
  });

  test('a 429 waits at least the retry-after time', () async {
    final syncer = newSyncer();
    api.putFailure = () => const ApiError(status: 429, kind: ApiErrorKind.rateLimited, code: 'rate_limited', retryAfter: Duration(seconds: 60));
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    expect(timers.pendingDelays.single, const Duration(seconds: 60));
  });

  test('EVENT_CONFLICT reports a conflict and stops sending until the engine resumes', () async {
    final syncer = newSyncer();
    api.putFailure = () => const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.eventConflict);
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    expect(conflicts, 1);
    expect(syncer.status.value, SyncStatus.conflict);
    expect(timers.pendingCount, 0);
    api.putFailure = null;
    syncer.resumeAfterConflict(acknowledgedSequence: 1);
    expect(syncer.acknowledgedSequence, 1);
    expect(syncer.status.value, SyncStatus.idle);
  });

  test('SESSION_EXPIRED stops the sync for good', () async {
    final syncer = newSyncer();
    api.putFailure = () => const ApiError(status: 422, kind: ApiErrorKind.validation, code: ApiCodes.sessionExpired);
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    expect(syncer.status.value, SyncStatus.stopped);
    expect(stoppedWith?.hasCode(ApiCodes.sessionExpired), isTrue);
    await journal.recordAnswer('q2', 1, clock);
    syncer.notifyChanged();
    expect(timers.pendingCount, 0);
  });

  test('events written during an in-flight PUT are sent next', () async {
    final syncer = newSyncer();
    await journal.recordAnswer('q1', 1, clock);
    syncer.notifyChanged();
    timers.fireNext();
    // While the first PUT is still pending, another answer arrives.
    await journal.recordAnswer('q2', 2, clock);
    syncer.notifyChanged();
    await settle();
    await settle();
    timers.fireAll();
    await settle();
    expect(api.puts.last.length, 2);
    expect(syncer.acknowledgedSequence, 2);
  });

  test('the acknowledged sequence never goes backwards', () async {
    final syncer = newSyncer(ack: 5);
    await journal.recordAnswer('q1', 1, clock);
    api.ackOffset = 10; // server answers a lower number than we already hold
    syncer.notifyChanged();
    timers.fireNext();
    await settle();
    expect(syncer.acknowledgedSequence, 5);
  });
}
