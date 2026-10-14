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
