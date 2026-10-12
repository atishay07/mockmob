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

/// The slice of the local notifications plugin the engine uses, so scheduling logic is tested
/// with a fake and the plugin stays replaceable.
abstract class LocalNotificationsGateway {
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
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: (response) => onTap?.call(
        NotificationTap(payload: response.payload, actionId: response.actionId?.isEmpty ?? true ? null : response.actionId),
      ),
    );
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
