import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/json_helpers.dart';
import '../models/notification_prefs.dart';
import '../notifications/timezones.dart';
import 'json_remote_notifier.dart';
import 'remote_state.dart';

/// `GET/PUT /api/me/notification-prefs` (24-hour strings on the wire). The notification
/// engine reads [effectivePrefs] so it always has the spec defaults to fall back on.
class NotificationPrefsRepository extends JsonRemoteNotifier<NotificationPrefs> {
  @override
  String get cacheKey => 'notification-prefs';

  @override
  NotificationPrefs parse(Object? json) => NotificationPrefs.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/me/notification-prefs')).data;

  /// The loaded prefs, or the spec defaults (Asia/Kolkata, 11:00 PM to 7:00 AM) before they load.
  NotificationPrefs get effectivePrefs => state.value ?? NotificationPrefs.defaults;

  /// Sends only the fields given (the server merges). Returns the saved prefs once the
  /// server acknowledges. Throws `ApiError` (422 for a rejected value, such as a timezone
  /// outside the allowlist).
  Future<NotificationPrefs> update({
    String? timezone,
    ClockTime? quietStart,
    ClockTime? quietEnd,
    int? weeklyCap,
    Map<String, bool>? channels,
    StudyWindow? studyWindow,
    bool clearStudyWindow = false,
  }) async {
    final body = <String, Object?>{
      'timezone': ?timezone,
      'quietStart': ?quietStart?.toWire(),
      'quietEnd': ?quietEnd?.toWire(),
      'weeklyCap': ?weeklyCap,
      'channels': ?channels,
      if (clearStudyWindow) 'studyWindow': null else if (studyWindow != null) 'studyWindow': studyWindow.toJson(),
    };
    final response = await ref.read(apiClientProvider).put('/api/me/notification-prefs', body: body);
    final prefs = NotificationPrefs.fromJson(response.map);
    await setAcknowledged(Fetched(prefs, response.data));
    return prefs;
  }
}

final notificationPrefsRepositoryProvider =
    NotifierProvider<NotificationPrefsRepository, RemoteState<NotificationPrefs>>(NotificationPrefsRepository.new);

/// IANA timezone of the student (notification prefs), default Asia/Kolkata until loaded.
final studentTimezoneProvider = Provider<String>(
  (ref) => ref.watch(notificationPrefsRepositoryProvider.select((s) => s.value?.timezone)) ?? defaultTimezoneName,
);
