/// Schedules the background flush-and-submit job (design spec 5.5.1, point 2). An interface so
/// the engine is tested without WorkManager.
abstract class SessionWorkScheduler {
  /// Registers a one-time job for [sessionId] that flushes events and submits. It runs at about
  /// [runAt] (a normal job with an initial delay: Android may run it late, so it narrows the gap
  /// and is never the only safeguard). Calling again for the same session replaces the job.
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt});

  /// Cancels the job once the attempt is recorded.
  Future<void> cancelSubmit(String sessionId);
}

/// Does nothing. Used where background work is not wanted (tests, previews).
class NoopSessionWorkScheduler implements SessionWorkScheduler {
  const NoopSessionWorkScheduler();

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async {}

  @override
  Future<void> cancelSubmit(String sessionId) async {}
}

/// Passes every call on to [inner] and reports which sessions have the backup job queued from this
/// run ([onTracked]), so the "Sending your answers" strip shows only while a retry is really queued
/// (LK50). A job queued by an earlier run of the app is not known here; the start/resume settler
/// covers those drafts.
class TrackedSessionWorkScheduler implements SessionWorkScheduler {
  TrackedSessionWorkScheduler(this.inner, {required this.onTracked});

  final SessionWorkScheduler inner;
  final void Function(String sessionId, bool queued) onTracked;

  @override
  Future<void> scheduleSubmit({required String userId, required String sessionId, required String draftKey, required DateTime runAt}) async {
    await inner.scheduleSubmit(userId: userId, sessionId: sessionId, draftKey: draftKey, runAt: runAt);
    onTracked(sessionId, true);
  }

  @override
  Future<void> cancelSubmit(String sessionId) async {
    onTracked(sessionId, false);
    await inner.cancelSubmit(sessionId);
  }
}
