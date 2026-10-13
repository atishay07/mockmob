// A reminder tapped while the app was killed starts the app, and the plugin reports that tap only
// through its launch details. These tests cover the cold-start path with a fake gateway: the tap
// reaches the handler exactly once per process, however often the engine initialises.
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/notifications/notification_gateway.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/features/notifications/logic/reminder_plan.dart';
import 'package:mockmob/features/notifications/services/notification_providers.dart';
import 'package:mockmob/features/notifications/services/reminder_taps.dart';

import 'support.dart';

/// A gateway whose app was launched by a tap on a notification: like the real gateway, it hands
/// the launch tap over through [LaunchTapLatch] after it initialises.
class _ColdStartGateway extends FakeGateway {
  _ColdStartGateway(this.launch);

  final NotificationAppLaunchDetails? launch;
  int initializeCalls = 0;
  int launchReads = 0;

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {
    initializeCalls++;
    await LaunchTapLatch.deliverOnce(() async {
      launchReads++;
      return launchTapFrom(launch);
    }, onTap);
  }
}

NotificationAppLaunchDetails _launchedBy(String payload, {String? actionId}) => NotificationAppLaunchDetails(
      true,
      notificationResponse: NotificationResponse(
        notificationResponseType: actionId == null ? NotificationResponseType.selectedNotification : NotificationResponseType.selectedNotificationAction,
        payload: payload,
        actionId: actionId,
      ),
    );

NotificationService _service(LocalNotificationsGateway gateway) => NotificationService(
      gateway: gateway,
      ledger: MemoryNotificationLedgerStore(),
      prefs: prefsWith,
      weeklyCap: () async => 3,
      createdChannels: () async => <String>{},
      saveCreatedChannels: (_) async {},
    );

void main() {
  setUp(LaunchTapLatch.reset);

  group('launchTapFrom', () {
    test('a launch by a notification becomes a tap with its payload', () {
      final tap = launchTapFrom(_launchedBy('/today?nx=study_window:2026-10-12'));
      expect(tap!.payload, '/today?nx=study_window:2026-10-12');
      expect(tap.actionId, isNull);
    });

    test('an action keeps its id; an empty id is no action', () {
      expect(launchTapFrom(_launchedBy('/today?nx=x', actionId: 'not_tonight'))!.actionId, 'not_tonight');
      expect(launchTapFrom(_launchedBy('/today?nx=x', actionId: ''))!.actionId, isNull);
    });

    test('an ordinary launch is no tap', () {
      expect(launchTapFrom(null), isNull);
      expect(launchTapFrom(const NotificationAppLaunchDetails(false)), isNull);
      expect(launchTapFrom(const NotificationAppLaunchDetails(true)), isNull);
    });
  });

  group('cold start', () {
    test('the launch tap reaches the handler once, though the engine initialises again', () async {
      final gateway = _ColdStartGateway(_launchedBy(encodeReminderPayload('/review/mistakes', 'repair_ready:att-9')));
      final taps = <NotificationTap>[];

      // The first service of the process, then a rebuilt one (new prefs), then ensureReady again.
      await _service(gateway).initialize(onTap: taps.add);
      await _service(gateway).initialize(onTap: taps.add);
      final third = _service(gateway);
      await third.initialize(onTap: taps.add);
      await third.initialize(onTap: taps.add);

      expect(gateway.initializeCalls, 3, reason: 'each new service initialises the plugin');
      expect(gateway.launchReads, 1, reason: 'the launch details are read once per process');
      expect(taps, hasLength(1));
      expect(decodeReminderPayload(taps.single.payload!).taskId, 'repair_ready:att-9');
    });

    test('the tap opens the route and counts as opened', () async {
      final gateway = _ColdStartGateway(_launchedBy(encodeReminderPayload('/review/mistakes', 'repair_ready:att-9')));
      final opened = <String>[];
      final routes = <String>[];
      final handler = ReminderTapHandler(
        opened: (id) async => opened.add(id),
        declined: (_) async {},
        mute: () async {},
        open: routes.add,
      );
      await _service(gateway).initialize(onTap: handler.handle);
      await Future<void>.delayed(Duration.zero);
      expect(opened, ['repair_ready:att-9']);
      expect(routes, ['/review/mistakes']);
    });

    test('an app not launched by a notification hands nothing over', () async {
      final gateway = _ColdStartGateway(const NotificationAppLaunchDetails(false));
      final taps = <NotificationTap>[];
      await _service(gateway).initialize(onTap: taps.add);
      expect(taps, isEmpty);
    });

    test('a failed read of the launch details is no tap, and is not retried', () async {
      final taps = <NotificationTap>[];
      var reads = 0;
      Future<NotificationTap?> failing() async {
        reads++;
        throw StateError('plugin not ready');
      }

      await LaunchTapLatch.deliverOnce(failing, taps.add);
      await LaunchTapLatch.deliverOnce(failing, taps.add);
      expect(taps, isEmpty);
      expect(reads, 1);
    });
  });

  group('a launch tap before the account is known', () {
    test('is held, then handed over once while fresh', () {
      final held = HeldReminderTap();
      final at = DateTime.utc(2026, 10, 13, 4);
      held.hold(const NotificationTap(payload: '/today?nx=study_window:2026-10-13'), at);
      expect(held.take(at.add(const Duration(seconds: 3)))!.payload, '/today?nx=study_window:2026-10-13');
      expect(held.take(at.add(const Duration(seconds: 4))), isNull);
    });

    test('is forgotten when it went stale', () {
      final held = HeldReminderTap();
      final at = DateTime.utc(2026, 10, 13, 4);
      held.hold(const NotificationTap(payload: '/today'), at);
      expect(held.take(at.add(const Duration(minutes: 11))), isNull);
    });
  });
}
