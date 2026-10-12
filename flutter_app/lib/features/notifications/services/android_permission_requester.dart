import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/permission_requester.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/storage/storage_providers.dart';

/// The two operating-system questions the requester needs, so the logic is tested without a
/// device.
abstract class NotificationPermissionDriver {
  /// Whether notifications can be shown right now (below Android 13 this is the app's
  /// notification setting; from Android 13 it follows `POST_NOTIFICATIONS`).
  Future<bool> isEnabled();

  /// Shows the Android 13 and later system dialog. Returns whether it ended allowed. Below
  /// Android 13 nothing is asked.
  Future<bool> request();
}

class PluginPermissionDriver implements NotificationPermissionDriver {
  PluginPermissionDriver([FlutterLocalNotificationsPlugin? plugin])
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;

  AndroidFlutterLocalNotificationsPlugin? get _android => _plugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();

  @override
  Future<bool> isEnabled() async =>
      await _android?.areNotificationsEnabled() ?? false;

  @override
  Future<bool> request() async =>
      await _android?.requestNotificationsPermission() ?? false;
}

/// The Android implementation of `PermissionRequester` (spec 8). It only asks when the student
/// chose to: the pre-prompt sheet calls [requestNotificationPermission] from its Allow key.
///
/// - Allowed (or below Android 13 with notifications on): granted.
/// - Not allowed and never asked: notAsked.
/// - Not allowed and asked before: denied. The system stops showing its dialog after two
///   refusals, so a denied student is told how to change it in Android settings.
class AndroidPermissionRequester implements PermissionRequester {
  AndroidPermissionRequester({required this._driver, required this._prefs});

  final NotificationPermissionDriver _driver;
  final AppPrefs _prefs;

  @override
  Future<NotificationPermission> notificationPermission() async {
    if (await _driver.isEnabled()) return NotificationPermission.granted;
    return await _prefs.notificationPermissionAsked()
        ? NotificationPermission.denied
        : NotificationPermission.notAsked;
  }

  @override
  Future<NotificationPermission> requestNotificationPermission() async {
    if (await _driver.isEnabled()) return NotificationPermission.granted;
    final allowed = await _driver.request();
    await _prefs.setNotificationPermissionAsked(true);
    return allowed
        ? NotificationPermission.granted
        : NotificationPermission.denied;
  }
}

final notificationPermissionDriverProvider =
    Provider<NotificationPermissionDriver>((ref) => PluginPermissionDriver());

/// What `lib/main.dart` puts in `permissionRequesterProvider`.
final androidPermissionRequesterProvider = Provider<PermissionRequester>(
  (ref) => AndroidPermissionRequester(
    driver: ref.watch(notificationPermissionDriverProvider),
    prefs: ref.watch(appPrefsProvider),
  ),
);
