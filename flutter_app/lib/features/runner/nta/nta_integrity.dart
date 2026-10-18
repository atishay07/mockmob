import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleState;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';
import 'nta_copy.dart';

/// Where the NTA skin keeps its per-session warning count and the reader's text size. A plain
/// key-value store, so tests use the in-memory one.
final ntaPrefsProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

enum NtaViolation {
  left(NtaCopy.reasonLeft),
  window(NtaCopy.reasonWindow),
  restored(NtaCopy.reasonRestored);

  const NtaViolation(this.reason);

  final String reason;
}

/// The website's exam-integrity guard (three warnings, the third submits) translated to a
/// phone. A warning counts once per absence: when the app is hidden or paused, when another
/// window covers it for longer than [inactiveGrace] (3 s, owner decision 14 Oct 2026: a quick look at
/// notifications or a call banner is shorter and free, a split screen is not), or when the paper is opened again after it was closed without a recorded absence.
/// The count survives a restart. Warnings never reach the server and never change the score.
class NtaIntegrity extends ChangeNotifier {
  NtaIntegrity({
    required this.sessionId,
    required this.store,
    required this.onTerminate,
    required this.isLive,
    this.inactiveGrace = defaultInactiveGrace,
  }) {
    _live[sessionId] = (_live[sessionId] ?? 0) + 1;
  }

  /// Guards alive per session in this process. A second guard while the first is still alive is
  /// the same paper rebuilt on screen, not a paper opened again.
  static final Map<String, int> _live = {};

  /// How long another window may cover the exam before it counts as a warning.
  static const Duration defaultInactiveGrace = Duration(seconds: 3);

  final String sessionId;
  final PrefsStore store;

  /// Called once, on the third warning: submit the answers already given.
  final VoidCallback onTerminate;

  /// False once a submit started or the time ran out: nothing counts after that.
  final bool Function() isLive;
  final Duration inactiveGrace;

  int _strikes = 0;
  bool _away = false;
  bool _showing = false;
  bool _terminated = false;
  bool _endedSeen = false;
  bool _disposed = false;
  NtaViolation? _last;
  Timer? _inactive;

  int get strikes => _strikes;
  bool get terminated => _terminated;
  NtaViolation? get lastViolation => _last;

  /// The warning card is up, or the "Session ended" card is still waiting for the student to
  /// read it and continue.
  bool get showing => _showing || (_terminated && !_endedSeen);

  /// Answering waits behind a warning, and stays locked for good once the session has ended.
  bool get locksAnswers => _showing || _terminated;

  String get _strikesKey => 'nta.strikes.$sessionId';
  String get _awayKey => 'nta.away.$sessionId';
  String get _openedKey => 'nta.opened.$sessionId';

  /// Reads the stored count. A paper opened before, with no absence on record, was closed some
  /// other way (the leave key, a crash): that is the website's "restored" warning.
  Future<void> load() async {
    final remount = (_live[sessionId] ?? 0) > 1;
    try {
      _strikes = await store.getInt(_strikesKey) ?? 0;
      final wasAway = await store.getBool(_awayKey) ?? false;
      final opened = await store.getBool(_openedKey) ?? false;
      await store.setBool(_openedKey, true);
      if (_disposed) return;
      if (_strikes >= NtaRules.strikes) {
        _terminate();
      } else if (wasAway) {
        // The absence that was already counted ends now.
        await store.setBool(_awayKey, false);
        _showing = _strikes > 0;
      } else if (opened && !remount) {
        _violate(NtaViolation.restored, returned: true);
      }
    } on Object {
      // A missing store only loses the count; the exam carries on.
    }
    if (!_disposed) notifyListeners();
  }

  /// The app's lifecycle, the way the website reads the tab (M-003, owner 13 Oct): a deliberate switch
  /// to another app ([AppLifecycleState.hidden], [AppLifecycleState.paused]) counts at once; a cover
  /// that leaves the app showing ([AppLifecycleState.inactive]: the notification shade, a call banner)
  /// counts only if it outlasts [inactiveGrace]; coming back clears the pending cover. There is no other grace.
  void onLifecycle(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.inactive:
        onInactive();
      case AppLifecycleState.hidden || AppLifecycleState.paused:
        onLeft();
      case AppLifecycleState.resumed:
        onReturned();
      case AppLifecycleState.detached:
        break;
    }
  }

  /// Another window covers the app (split screen, a dialog, the recents swipe beginning).
  void onInactive() {
    _inactive?.cancel();
    _inactive = Timer(inactiveGrace, () => _violate(NtaViolation.window));
  }

  /// The app is hidden or paused: the student left the exam screen.
  void onLeft([NtaViolation why = NtaViolation.left]) {
    _inactive?.cancel();
    _violate(why);
  }

  /// Back on the exam screen.
  void onReturned() {
    _inactive?.cancel();
    if (!_away) return;
    _away = false;
    unawaited(_write(_awayKey, false));
    if (!_disposed) notifyListeners();
  }

  /// "Return to the exam".
  void acknowledge() {
    if (!_showing || _terminated) return;
    _showing = false;
    notifyListeners();
  }

  /// "Continue" on the ended card: the student has read why the session ended, and the submit
  /// page may open.
  void acknowledgeEnded() {
    if (!_terminated || _endedSeen) return;
    _endedSeen = true;
    notifyListeners();
  }

  /// The paper was received: the count has no further use.
  Future<void> clear() async {
    for (final k in [_strikesKey, _awayKey, _openedKey]) {
      try {
        await store.remove(k);
      } on Object {
        // Stale keys are harmless.
      }
    }
  }

  void _violate(NtaViolation why, {bool returned = false}) {
    if (_disposed || _terminated || _away || !isLive()) return;
    _away = !returned;
    _strikes++;
    _last = why;
    _showing = true;
    unawaited(_write(_strikesKey, _strikes));
    unawaited(_write(_awayKey, _away));
    if (_strikes >= NtaRules.strikes) {
      _terminate();
    }
    notifyListeners();
  }

  void _terminate() {
    if (_terminated) return;
    _terminated = true;
    onTerminate();
  }

  Future<void> _write(String key, Object value) async {
    try {
      if (value is int) await store.setInt(key, value);
      if (value is bool) await store.setBool(key, value);
    } on Object {
      // As in load.
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    final left = (_live[sessionId] ?? 1) - 1;
    if (left > 0) {
      _live[sessionId] = left;
    } else {
      _live.remove(sessionId);
    }
    _disposed = true;
    _inactive?.cancel();
    super.dispose();
  }
}
