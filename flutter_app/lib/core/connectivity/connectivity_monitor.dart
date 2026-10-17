import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';

enum NetworkStatus {
  /// Not known yet (before the first radio reading).
  unknown,
  online,
  offline,
}

typedef TimerFactory = Timer Function(Duration delay, void Function() callback);

/// Connectivity that knows about pending work (design spec section 10).
///
/// The radio flag is not trusted on its own: a phone can show Wi-Fi with no internet behind
/// it. So:
/// - no radio at all means offline at once,
/// - with a radio the state stays optimistic ("online") until a real request fails with no
///   response; only then, and only while work is pending, a light ping decides,
/// - while offline with work pending, the ping repeats with back-off until it succeeds,
/// - any request that reaches the server proves the network and marks it online,
/// - once a ping has said offline with the radio still present, a slow recovery ping keeps
///   checking even after the pending work is gone, so the status cannot stay offline on a
///   working network.
/// The ping never runs while the app is online with nothing waiting to be sent.
class ConnectivityMonitor implements ApiNetworkObserver {
  ConnectivityMonitor({
    required Stream<bool> radioPresent,
    required this._ping,
    required this._hasPendingWork,
    TimerFactory? timerFactory,
    this.pingBackoff = const [Duration(seconds: 5), Duration(seconds: 15), Duration(seconds: 30), Duration(seconds: 60)],
  }) : _timer = timerFactory ?? Timer.new {
    _radioSub = radioPresent.listen(_onRadio);
  }

  final Future<bool> Function() _ping;
  final bool Function() _hasPendingWork;
  final TimerFactory _timer;
  final List<Duration> pingBackoff;

  late final StreamSubscription<bool> _radioSub;
  final ValueNotifier<NetworkStatus> status = ValueNotifier(NetworkStatus.unknown);
  final StreamController<void> _restored = StreamController<void>.broadcast();
  Timer? _pingTimer;
  bool _radio = true;
  bool _pinging = false;
  int _pingFailures = 0;

  /// The scheduled ping only checks a past offline verdict; nothing is waiting.
  bool _recoveryOnly = false;

  /// Emits each time the network comes back after being offline. Pending work (the outbox, an
  /// unsent submit, unacknowledged answers) retries on this.
  Stream<void> get restored => _restored.stream;

  bool get isOnline => status.value != NetworkStatus.offline;

  void _onRadio(bool present) {
    final had = _radio;
    _radio = present;
    if (!present) {
      _pingTimer?.cancel();
      _set(NetworkStatus.offline);
      return;
    }
    if (!had || status.value == NetworkStatus.offline || status.value == NetworkStatus.unknown) {
      // The radio is back (or first reading). With work waiting, confirm with a ping;
      // otherwise stay optimistic.
      if (_hasPendingWork()) {
        unawaited(_confirm());
      } else {
        _set(NetworkStatus.online);
      }
    }
  }

  @override
  void onNetworkError() {
    if (!_radio) return;
    // A failed request with a radio present: only judge it when something is waiting.
    if (_hasPendingWork()) unawaited(_confirm());
  }

  @override
  void onReachedServer() {
    _pingFailures = 0;
    _pingTimer?.cancel();
    _set(NetworkStatus.online);
  }

  /// Registers new pending work while offline so the ping loop starts (or speeds up from the
  /// slow recovery ping).
  void pendingWorkChanged() {
    if (status.value == NetworkStatus.offline && _hasPendingWork() && (_pingTimer == null || _recoveryOnly) && !_pinging) {
      if (_recoveryOnly) _pingFailures = 0;
      _schedulePing();
    }
  }

  Future<void> _confirm() async {
    if (_pinging) return;
    _pinging = true;
    try {
      final ok = await _ping();
      if (ok) {
        _pingFailures = 0;
        _pingTimer?.cancel();
        _pingTimer = null;
        _set(NetworkStatus.online);
      } else {
        _set(NetworkStatus.offline);
        _schedulePing();
      }
    } finally {
      _pinging = false;
    }
  }

  void _schedulePing() {
    _pingTimer?.cancel();
    _pingTimer = null;
    if (!_radio || status.value != NetworkStatus.offline) return;
    // With nothing waiting the check only exists to clear a wrong offline verdict. It still starts
    // quick (a site that was down for a minute must not keep a working phone "offline" for the
    // next minute: v13 walk, finding 3) and settles at the slowest step, so a long outage costs
    // one light HEAD a minute.
    _recoveryOnly = !_hasPendingWork();
    final step = _pingFailures.clamp(0, pingBackoff.length - 1);
    final delay = pingBackoff[step];
    _pingFailures++;
    _pingTimer = _timer(delay, () {
      _pingTimer = null;
      unawaited(_confirm());
    });
  }

  void _set(NetworkStatus next) {
    final previous = status.value;
    if (previous == next) return;
    status.value = next;
    if (next == NetworkStatus.online && previous == NetworkStatus.offline) _restored.add(null);
  }

  Future<void> dispose() async {
    _pingTimer?.cancel();
    await _radioSub.cancel();
    await _restored.close();
    status.dispose();
  }
}
