import 'package:flutter/foundation.dart';

/// Marks on the way from launch to Today's first card, written to the log once each as
/// `MMT +1234 ms <what>` (L01: the first card took about 8 s online and over 14 s offline on the
/// test phone, against 5 s). `adb logcat -s flutter | grep MMT` reads one cold start end to end,
/// so the next device run names the step that holds the card instead of guessing at it.
///
/// The clock starts in `main`. Only the first mark of each name is written, so a screen that
/// rebuilds does not flood the log; [reset] is for tests.
abstract final class StartupTrace {
  static final Stopwatch _clock = Stopwatch();
  static final Set<String> _seen = {};

  /// Turned off in tests that do not want the log.
  static bool enabled = !kIsWeb;

  /// Starts the clock (once, in `main`).
  static void start() {
    if (_clock.isRunning) return;
    _clock.start();
    mark('main');
  }

  /// Milliseconds since [start].
  static int get elapsedMs => _clock.elapsedMilliseconds;

  /// Writes `MMT +<ms> <name>[ <detail>]` the first time [name] is marked.
  static void mark(String name, [String? detail]) {
    if (!enabled || !_clock.isRunning || !_seen.add(name)) return;
    debugPrint('MMT +${_clock.elapsedMilliseconds} ms $name${detail == null ? '' : ' $detail'}');
  }

  @visibleForTesting
  static void reset() {
    _clock
      ..stop()
      ..reset();
    _seen.clear();
  }
}
