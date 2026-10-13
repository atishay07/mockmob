/// The session timer and the event clock (design spec 5.5, contract section 3.4).
///
/// The deadline and every event `at` run on a monotonic clock anchored once from the server's
/// own numbers, so the student changing the phone's clock cannot move them. The server
/// rejects an event later than its own elapsed time plus 2 seconds, so `at` is never taken
/// from the wall clock.
class SessionClock {
  /// [monotonicMs] defaults to a [Stopwatch], which does not jump with wall-clock changes.
  /// [wallMs] defaults to the wall clock and is only used to survive a process kill and to
  /// notice time the phone spent asleep (a monotonic clock may stop in deep sleep).
  SessionClock({int Function()? monotonicMs, int Function()? wallMs})
      : _mono = monotonicMs ?? _stopwatchSource(),
        _wall = wallMs ?? (() => DateTime.now().millisecondsSinceEpoch);

  static int Function() _stopwatchSource() {
    final watch = Stopwatch()..start();
    return () => watch.elapsedMilliseconds;
  }

  final int Function() _mono;
  final int Function() _wall;

  int _startedRefMono = 0;
  int _endsAtMono = 0;
  int _startedRefWall = 0;
  int _endsAtWall = 0;
  bool _anchored = false;

  /// Milliseconds a gap between the monotonic and wall clocks must exceed before it is treated
  /// as time asleep rather than measurement noise.
  static const sleepGapThresholdMs = 2000;

  bool get isAnchored => _anchored;

  /// Anchors on receipt of a session view:
  /// `startedRef = receivedAt - max(0, serverNow - startedAt)` and
  /// `endsAt = receivedAt + (expiresAt - serverNow)`, all in monotonic milliseconds.
  void anchor({required int serverNowMs, required int startedAtMs, required int expiresAtMs}) {
    final receivedMono = _mono();
    final receivedWall = _wall();
    final serverElapsed = serverNowMs > startedAtMs ? serverNowMs - startedAtMs : 0;
    final remaining = expiresAtMs > serverNowMs ? expiresAtMs - serverNowMs : 0;
    _startedRefMono = receivedMono - serverElapsed;
    _endsAtMono = receivedMono + remaining;
    _startedRefWall = receivedWall - serverElapsed;
    _endsAtWall = receivedWall + remaining;
    _anchored = true;
  }

  /// Re-anchors after a process kill from the wall-clock estimates saved in the draft.
  void restore({required int startedRefWallMs, required int endsAtWallMs}) {
    final nowMono = _mono();
    final nowWall = _wall();
    final elapsed = nowWall > startedRefWallMs ? nowWall - startedRefWallMs : 0;
    final remaining = endsAtWallMs > nowWall ? endsAtWallMs - nowWall : 0;
    _startedRefMono = nowMono - elapsed;
    _endsAtMono = nowMono + remaining;
    _startedRefWall = startedRefWallMs;
    _endsAtWall = endsAtWallMs;
    _anchored = true;
  }

  /// Wall-clock estimate of the session start, saved in the draft.
  int get startedRefWallMs => _startedRefWall;

  /// Wall-clock deadline, saved in the draft.
  int get endsAtWallMs => _endsAtWall;

  /// Milliseconds since the session started on the server's timeline.
  int get elapsedMs {
    final v = _mono() - _startedRefMono;
    return v < 0 ? 0 : v;
  }

  /// Length of the session. Submitted events are filtered to `at <= durationMs`.
  int get durationMs => _endsAtMono - _startedRefMono;

  int get remainingMs {
    final v = _endsAtMono - _mono();
    return v < 0 ? 0 : v;
  }

  bool get isOver => _anchored && remainingMs == 0;

  /// The `at` for a new event: integer milliseconds, never below the previous event's `at`.
  int eventAt(int previousAt) {
    final now = elapsedMs;
    return now < previousAt ? previousAt : now;
  }

  int? _pausedWall;
  int? _pausedMono;

  /// The app went to the background: remember both clocks, so [resumeFromPause] can tell time
  /// asleep from a wall-clock change.
  void markPaused() {
    if (!_anchored) return;
    _pausedWall = _wall();
    _pausedMono = _mono();
  }

  /// Corrects for time the phone spent asleep while paused: the part of the pause the wall
  /// clock saw and the monotonic clock did not. A wall-clock step while the app was open (an
  /// old phone correcting itself, the student changing the time) is never applied, so the timer
  /// does not jump and event times stay on the server's timeline. Only ever moves time forward.
  /// Returns the milliseconds applied.
  int resumeFromPause() {
    final wall = _pausedWall;
    final mono = _pausedMono;
    _pausedWall = null;
    _pausedMono = null;
    if (!_anchored || wall == null || mono == null) return 0;
    final gap = (_wall() - wall) - (_mono() - mono);
    if (gap <= sleepGapThresholdMs) return 0;
    _startedRefMono -= gap;
    _endsAtMono -= gap;
    return gap;
  }

  /// Corrects for any gap between the wall and monotonic clocks since the anchor. It cannot
  /// tell sleep from a wall-clock step, so the engine uses [resumeFromPause] instead.
  /// Only ever moves time forward: the student is never given time back.
  void resync() {
    if (!_anchored) return;
    final wallElapsed = _wall() - _startedRefWall;
    final monoElapsed = _mono() - _startedRefMono;
    final gap = wallElapsed - monoElapsed;
    if (gap > sleepGapThresholdMs) {
      _startedRefMono -= gap;
      _endsAtMono -= gap;
    }
  }
}
