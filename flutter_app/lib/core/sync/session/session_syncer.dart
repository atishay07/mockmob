import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../api/api_error.dart';
import 'session_api.dart';
import 'session_journal.dart';

/// Where the cumulative event sync stands.
enum SyncStatus {
  /// Nothing waiting, or sync is off (ticket mode).
  idle,

  /// A PUT is in flight.
  sending,

  /// The last PUT failed for a reason that retrying may fix (offline, slow, 5xx, rate limit).
  failing,

  /// The server holds a different log: the engine must resume from the server and rebuild.
  conflict,

  /// The server will not take events any more (`SESSION_EXPIRED`, session gone, invalid log).
  stopped,
}

/// Retry delays while the runner is open: 1, 2, 4, 8, 16, then 30 seconds.
const syncBackoff = [
  Duration(seconds: 1),
  Duration(seconds: 2),
  Duration(seconds: 4),
  Duration(seconds: 8),
  Duration(seconds: 16),
  Duration(seconds: 30),
];

typedef TimerFactory = Timer Function(Duration delay, void Function() callback);

/// Sends the cumulative event log with `PUT /api/sessions`: debounced about 400 ms, only when
/// the log changed since the last successful send, and tracking `acknowledgedSequence`. Ticket
/// mode never syncs: the server holds nothing, so the app holds the ticket and the events.
class SessionSyncer {
  SessionSyncer({
    required this.api,
    required this.journal,
    required this.sessionId,
    this.enabled = true,
    int acknowledgedSequence = 0,
    this.onAcknowledged,
    this.onConflict,
    this.onStopped,
    this.debounce = const Duration(milliseconds: 400),
    TimerFactory? timerFactory,
    DateTime Function()? now,
  })  : _acknowledged = acknowledgedSequence,
        _timer = timerFactory ?? Timer.new,
        _now = now ?? DateTime.now;

  final SessionApi api;
  final SessionJournal journal;
  final String sessionId;

  /// False in ticket mode: no PUT is ever sent.
  final bool enabled;
  final Duration debounce;
  final void Function(int acknowledgedSequence, DateTime at)? onAcknowledged;
  final void Function()? onConflict;
  final void Function(ApiError error)? onStopped;
  final TimerFactory _timer;
  final DateTime Function() _now;

  final ValueNotifier<SyncStatus> status = ValueNotifier(SyncStatus.idle);

  int _acknowledged;
  int _sentThroughSeq = 0;
  int _failures = 0;
  Timer? _pending;
  Future<void>? _inFlight;
  bool _stopped = false;
  bool _disposed = false;

  /// Highest event `seq` the server confirmed.
  int get acknowledgedSequence => _acknowledged;

  /// The log has events the server has not acknowledged.
  bool get hasUnacknowledged => journal.lastSeq > _acknowledged;

  /// Call after every journal write. Schedules one PUT after the debounce.
  void notifyChanged() {
    if (!enabled || _stopped) return;
    if (journal.lastSeq <= _sentThroughSeq) return;
    _schedule(debounce);
  }

  /// The network is back: try again at once and forget the back-off.
  void retryNow() {
    if (!enabled || _stopped) return;
    _failures = 0;
    _schedule(Duration.zero);
  }

  /// Sends immediately and waits (app paused, submit about to start). Returns when the call
  /// finished, whether it succeeded or not.
  Future<void> flushNow() async {
    if (!enabled || _stopped) return;
    _pending?.cancel();
    _pending = null;
    await (_inFlight ?? _send());
  }

  void _schedule(Duration delay) {
    _pending?.cancel();
    _pending = _timer(delay, () {
      _pending = null;
      unawaited(_send());
    });
  }

  Future<void> _send() {
    final running = _inFlight;
    if (running != null) return running;
    return _inFlight = _doSend().whenComplete(() => _inFlight = null);
  }

  Future<void> _doSend() async {
    if (_stopped || journal.lastSeq <= _sentThroughSeq) {
      if (status.value != SyncStatus.stopped) _set(SyncStatus.idle);
      return;
    }
    final events = journal.events;
    final lastSeq = events.last.seq;
    _set(SyncStatus.sending);
    try {
      final ack = await api.putEvents(sessionId: sessionId, events: events);
      _sentThroughSeq = lastSeq;
      if (ack > _acknowledged) _acknowledged = ack;
      _failures = 0;
      onAcknowledged?.call(_acknowledged, _now());
      _set(SyncStatus.idle);
    } on ApiError catch (e) {
      _handleError(e);
      return;
    }
    // More events arrived while this call was in flight.
    if (journal.lastSeq > _sentThroughSeq) _schedule(debounce);
  }

  void _handleError(ApiError e) {
    if (e.hasCode(ApiCodes.eventConflict)) {
      _set(SyncStatus.conflict);
      onConflict?.call();
      return;
    }
    final fatal = e.hasCode(ApiCodes.sessionExpired) ||
        e.hasCode(ApiCodes.sessionNotFound) ||
        e.kind == ApiErrorKind.notFound ||
        e.kind == ApiErrorKind.validation;
    if (fatal) {
      _stopped = true;
      _set(SyncStatus.stopped);
      onStopped?.call(e);
      return;
    }
    // Offline, slow, 5xx, 429 or an auth hiccup: keep trying with back-off. Network loss never
    // stops answering.
    _set(SyncStatus.failing);
    var delay = syncBackoff[_failures.clamp(0, syncBackoff.length - 1)];
    if (e.isRateLimited && e.retryAfter != null && e.retryAfter! > delay) delay = e.retryAfter!;
    _failures++;
    _schedule(delay);
  }

  /// After a conflict the engine resumed from the server: adopt its acknowledged sequence and
  /// start sending again.
  void resumeAfterConflict({required int acknowledgedSequence}) {
    _acknowledged = acknowledgedSequence;
    _sentThroughSeq = acknowledgedSequence;
    _stopped = false;
    _set(SyncStatus.idle);
    notifyChanged();
  }

  void _set(SyncStatus value) {
    if (!_disposed) status.value = value;
  }

  void dispose() {
    _pending?.cancel();
    _pending = null;
    _stopped = true;
    _disposed = true;
    status.dispose();
  }
}
