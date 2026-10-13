import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import 'notification_channels.dart';
import 'notification_planner.dart';

/// A tap on a notification or one of its actions.
class NotificationTap {
  const NotificationTap({required this.payload, this.actionId});

  final String? payload;
  final String? actionId;
}

/// The tap that started the app from a killed state, read from the plugin's launch details. Null
/// when the app was not launched by a notification, or the launch carried no response.
NotificationTap? launchTapFrom(NotificationAppLaunchDetails? details) {
  if (details == null || !details.didNotificationLaunchApp) return null;
  final response = details.notificationResponse;
  if (response == null) return null;
  final action = response.actionId;
  return NotificationTap(payload: response.payload, actionId: action == null || action.isEmpty ? null : action);
}

/// Hands the cold-start tap to the app exactly once per process.
///
/// A tap on a reminder while the app is killed starts the app, but the plugin only reports it
/// through its launch details: the tap callback fires for a running app only. The engine can
/// initialise more than once in a process (a rebuilt service, a scheduler that calls
/// `ensureReady` again), and the launch details stay the same for the whole process, so the tap
/// is delivered on the first initialise only. Otherwise the same reminder would route and count
/// twice.
class LaunchTapLatch {
  LaunchTapLatch._();

  static bool _consumed = false;

  /// Reads the launch tap with [read] and passes it to [onTap], once per process. Later calls do
  /// nothing. A failed read is treated as no tap and still closes the latch.
  static Future<void> deliverOnce(Future<NotificationTap?> Function() read, void Function(NotificationTap tap)? onTap) async {
    if (_consumed) return;
    _consumed = true;
    NotificationTap? tap;
    try {
      tap = await read();
    } on Object {
      return;
    }
    if (tap != null) onTap?.call(tap);
  }

  @visibleForTesting
  static void reset() => _consumed = false;
}

/// The slice of the local notifications plugin the engine uses, so scheduling logic is tested
/// with a fake and the plugin stays replaceable.
abstract class LocalNotificationsGateway {
  /// Prepares the plugin and registers [onTap]. Also hands [onTap] the tap that launched the app
  /// from a killed state, once per process (see [LaunchTapLatch]).
  Future<void> initialize({void Function(NotificationTap tap)? onTap});
  Future<void> createChannel(NotificationChannelSpec spec);

  /// Inexact scheduling only: the app never requests `SCHEDULE_EXACT_ALARM`.
  Future<void> schedule({
    required int id,
    required NotificationChannelSpec channel,
    required tz.TZDateTime at,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    List<NotificationActionSpec> actions = const [],
  });

  Future<void> show({
    required int id,
    required NotificationChannelSpec channel,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    bool ongoing = false,
    List<NotificationActionSpec> actions = const [],
  });

  Future<void> cancel(int id);
  Future<void> cancelAll();
  Future<bool> areNotificationsEnabled();
}

/// Implementation on `flutter_local_notifications`.
class FlutterLocalNotificationsGateway implements LocalNotificationsGateway {
  FlutterLocalNotificationsGateway([FlutterLocalNotificationsPlugin? plugin]) : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  @override
  Future<void> initialize({void Function(NotificationTap tap)? onTap}) async {
    await _plugin.initialize(
      // The status-bar icon: "mo" in one white ink (Android draws only a small icon's alpha, so
      // the full-colour launcher icon would show as a solid blob). Kept from resource shrinking
      // by res/raw/keep.xml.
      settings: const InitializationSettings(android: AndroidInitializationSettings('ic_stat_mockmob')),
      onDidReceiveNotificationResponse: (response) => onTap?.call(
        NotificationTap(payload: response.payload, actionId: response.actionId?.isEmpty ?? true ? null : response.actionId),
      ),
    );
    // A tap that launched the app from a killed state never reaches the callback above.
    await LaunchTapLatch.deliverOnce(() async => launchTapFrom(await _plugin.getNotificationAppLaunchDetails()), onTap);
  }

  Importance _importance(NotificationChannelSpec c) => c.importance == NotificationImportance.low ? Importance.low : Importance.defaultImportance;

  @override
  Future<void> createChannel(NotificationChannelSpec spec) async {
    await _android?.createNotificationChannel(
      AndroidNotificationChannel(
        spec.id,
        spec.name,
        description: spec.description,
        importance: _importance(spec),
        playSound: !spec.silent,
        enableVibration: !spec.silent,
        showBadge: false,
      ),
    );
  }

  NotificationDetails _details(NotificationChannelSpec c, {required bool silent, bool ongoing = false, List<NotificationActionSpec> actions = const []}) =>
      NotificationDetails(
        android: AndroidNotificationDetails(
          c.id,
          c.name,
          channelDescription: c.description,
          importance: _importance(c),
          priority: c.importance == NotificationImportance.low ? Priority.low : Priority.defaultPriority,
          playSound: !silent && !c.silent,
          enableVibration: !silent && !c.silent,
          silent: silent || c.silent,
          ongoing: ongoing,
          autoCancel: !ongoing,
          actions: [for (final a in actions) AndroidNotificationAction(a.id, a.label)],
        ),
      );

  @override
  Future<void> schedule({
    required int id,
    required NotificationChannelSpec channel,
    required tz.TZDateTime at,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    List<NotificationActionSpec> actions = const [],
  }) =>
      _plugin.zonedSchedule(
        id: id,
        scheduledDate: at,
        notificationDetails: _details(channel, silent: silent, actions: actions),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        title: title,
        body: body,
        payload: payload,
      );

  @override
  Future<void> show({
    required int id,
    required NotificationChannelSpec channel,
    required String title,
    required String body,
    String? payload,
    bool silent = false,
    bool ongoing = false,
    List<NotificationActionSpec> actions = const [],
  }) =>
      _plugin.show(
        id: id,
        title: title,
        body: body,
        notificationDetails: _details(channel, silent: silent, ongoing: ongoing, actions: actions),
        payload: payload,
      );

  @override
  Future<void> cancel(int id) => _plugin.cancel(id: id);

  @override
  Future<void> cancelAll() => _plugin.cancelAll();

  @override
  Future<bool> areNotificationsEnabled() async => await _android?.areNotificationsEnabled() ?? false;
}
