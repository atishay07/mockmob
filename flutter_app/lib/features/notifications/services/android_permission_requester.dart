import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/permission_requester.dart';
import '../../../core/storage/app_prefs.dart';
import '../../../core/storage/prefs_store.dart';
import '../../../core/storage/storage_providers.dart';
import '../data/reminder_store.dart' show reminderPrefsStoreProvider;

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

/// How many system refusals Android allows before it stops showing its dialog. From Android 11
/// a second refusal is final: after it only Android settings can change the answer.
const int systemRefusalsBeforeBlocked = 2;

/// The phone-wide count of refusals of the system dialog (not per account: the permission
/// belongs to the phone).
const String permissionRefusalsKey = 'notif_permission_refusals';

/// The Android implementation of `PermissionRequester` (spec 8). It only asks when the student
/// chose to: the pre-prompt sheet calls [requestNotificationPermission] from its Allow key.
///
/// - Allowed (or below Android 13 with notifications on): granted.
/// - Not allowed and never refused, or refused once: notAsked. Android still shows its dialog
///   after one refusal, so the student can still be asked (the Turn on key stays).
/// - Not allowed after the second refusal: denied. The system stops showing its dialog, so a
///   denied student is told how to change it in Android settings.
class AndroidPermissionRequester implements PermissionRequester {
  AndroidPermissionRequester({required this._driver, required this._prefs, required this._store});

  final NotificationPermissionDriver _driver;
  final AppPrefs _prefs;

  /// Holds the refusal count.
  final PrefsStore _store;

  /// The number of refusals so far. A phone that was asked before the count existed is taken
  /// as one refusal, so it may be asked once more.
  Future<int> refusals() async {
    final stored = await _store.getInt(permissionRefusalsKey);
    if (stored != null) return stored;
    return await _prefs.notificationPermissionAsked() ? 1 : 0;
  }

  @override
  Future<NotificationPermission> notificationPermission() async {
    if (await _driver.isEnabled()) return NotificationPermission.granted;
    return await refusals() >= systemRefusalsBeforeBlocked
        ? NotificationPermission.denied
        : NotificationPermission.notAsked;
  }

  /// Returns granted, or denied for this refusal. [notificationPermission] then reads notAsked
  /// again until the second refusal.
  @override
  Future<NotificationPermission> requestNotificationPermission() async {
    if (await _driver.isEnabled()) return NotificationPermission.granted;
    final before = await refusals();
    final allowed = await _driver.request();
    await _prefs.setNotificationPermissionAsked(true);
    if (allowed) return NotificationPermission.granted;
    await _store.setInt(permissionRefusalsKey, before + 1);
    return NotificationPermission.denied;
  }
}

final notificationPermissionDriverProvider =
    Provider<NotificationPermissionDriver>((ref) => PluginPermissionDriver());

/// What `lib/main.dart` puts in `permissionRequesterProvider`.
final androidPermissionRequesterProvider = Provider<PermissionRequester>(
  (ref) => AndroidPermissionRequester(
    driver: ref.watch(notificationPermissionDriverProvider),
    prefs: ref.watch(appPrefsProvider),
    store: ref.watch(reminderPrefsStoreProvider),
  ),
);
