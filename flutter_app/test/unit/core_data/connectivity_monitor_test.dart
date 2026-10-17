import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart';

class _Timers {
  final List<_T> timers = [];

  Timer create(Duration delay, void Function() cb) {
    final t = _T(delay, cb);
    timers.add(t);
    return t;
  }

  int get active => timers.where((t) => t.active).length;
  List<Duration> get delays => [for (final t in timers) if (t.active) t.delay];

  void fireNext() => timers.firstWhere((t) => t.active).fire();
}

class _T implements Timer {
  _T(this.delay, this.cb);

  final Duration delay;
  final void Function() cb;
  bool active = true;

  void fire() {
    active = false;
    cb();
  }

  @override
  void cancel() => active = false;

  @override
  bool get isActive => active;

  @override
  int get tick => 0;
}

void main() {
  late StreamController<bool> radio;
  late _Timers timers;
  late bool pending;
  late List<bool> pingResults;
  late int pings;
  late ConnectivityMonitor monitor;
  late int restored;

  setUp(() {
    radio = StreamController<bool>();
    timers = _Timers();
    pending = false;
    pingResults = [];
    pings = 0;
    restored = 0;
    monitor = ConnectivityMonitor(
      radioPresent: radio.stream,
      ping: () async {
        pings++;
        return pingResults.isEmpty ? true : pingResults.removeAt(0);
      },
      hasPendingWork: () => pending,
      timerFactory: timers.create,
    );
    monitor.restored.listen((_) => restored++);
  });

  tearDown(() async {
    await monitor.dispose();
    await radio.close();
  });

  Future<void> settle() async {
    for (var i = 0; i < 5; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  test('no radio is offline at once, without a ping', () async {
    radio.add(false);
    await settle();
    expect(monitor.status.value, NetworkStatus.offline);
    expect(pings, 0);
  });

  test('a radio with nothing pending stays optimistic and never pings', () async {
    radio.add(true);
    await settle();
    expect(monitor.status.value, NetworkStatus.online);
    expect(pings, 0);
  });

  test('a failed request with a radio but nothing pending does not ping', () async {
    radio.add(true);
    await settle();
    monitor.onNetworkError();
    await settle();
    expect(pings, 0);
    expect(monitor.status.value, NetworkStatus.online);
  });

  test('a failed request while work is pending pings, and a failed ping means offline', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false];
    monitor.onNetworkError();
    await settle();
    expect(pings, 1);
    expect(monitor.status.value, NetworkStatus.offline);
  });

  test('a good ping keeps the app online', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [true];
    monitor.onNetworkError();
    await settle();
    expect(monitor.status.value, NetworkStatus.online);
  });

  test('while offline with work pending the ping repeats with back-off until it succeeds, then restored fires', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false, false, true];
    monitor.onNetworkError();
    await settle();
    expect(monitor.status.value, NetworkStatus.offline);
    expect(timers.delays.single, const Duration(seconds: 5));

    timers.fireNext();
    await settle();
    expect(pings, 2);
    expect(timers.delays.single, const Duration(seconds: 15));

    timers.fireNext();
    await settle();
    expect(pings, 3);
    expect(monitor.status.value, NetworkStatus.online);
    expect(restored, 1);
    expect(timers.active, 0);
  });

  test('with nothing pending any more, only the recovery ping remains', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false, false];
    monitor.onNetworkError();
    await settle();
    pending = false;
    timers.fireNext();
    await settle();
    expect(pings, 2);
    // Nothing waiting, but the app still says offline with a radio present: one more check, on
    // the back-off's next step (not the slowest), so a wrong offline verdict clears quickly and
    // cannot stick (sync-storage-api-02; v13 walk finding 3).
    expect(timers.delays, [const Duration(seconds: 15)]);
  });

  test('online with nothing pending schedules no ping at all', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false, true];
    monitor.onNetworkError();
    await settle();
    pending = false;
    timers.fireNext();
    await settle();
    expect(monitor.status.value, NetworkStatus.online);
    expect(timers.active, 0);
  });

  test('any request that reaches the server proves the network', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false];
    monitor.onNetworkError();
    await settle();
    expect(monitor.status.value, NetworkStatus.offline);
    monitor.onReachedServer();
    await settle();
    expect(monitor.status.value, NetworkStatus.online);
    expect(restored, 1);
    expect(timers.active, 0);
  });

  test('the radio coming back with work pending confirms with a ping before saying restored', () async {
    radio.add(false);
    await settle();
    pending = true;
    pingResults = [false, true];
    radio.add(true);
    await settle();
    expect(pings, 1);
    expect(monitor.status.value, NetworkStatus.offline);
    expect(restored, 0);
    timers.fireNext();
    await settle();
    expect(monitor.status.value, NetworkStatus.online);
    expect(restored, 1);
  });

  test('the radio coming back with nothing pending is online at once', () async {
    radio.add(false);
    await settle();
    radio.add(true);
    await settle();
    expect(monitor.status.value, NetworkStatus.online);
    expect(pings, 0);
    expect(restored, 1);
  });

  test('losing the radio cancels the ping loop', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false];
    monitor.onNetworkError();
    await settle();
    expect(timers.active, 1);
    radio.add(false);
    await settle();
    expect(timers.active, 0);
    expect(monitor.status.value, NetworkStatus.offline);
  });

  test('new pending work while offline starts the ping loop', () async {
    radio.add(true);
    await settle();
    pending = true;
    pingResults = [false, false];
    monitor.onNetworkError();
    await settle();
    timers.fireNext();
    pending = false;
    await settle();
    expect(monitor.status.value, NetworkStatus.offline);
    // Only the recovery ping is left, on the back-off's next step.
    expect(timers.delays, [const Duration(seconds: 15)]);
    pending = true;
    monitor.pendingWorkChanged();
    // New work brings back the quick back-off.
    expect(timers.delays, [const Duration(seconds: 5)]);
  });
}
