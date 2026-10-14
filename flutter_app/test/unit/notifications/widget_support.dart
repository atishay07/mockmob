import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/notifications/notification_service.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/notifications/data/reminder_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/notifications/logic/reminder_plan.dart' show RepairReady;
import 'package:mockmob/features/notifications/services/notification_providers.dart';

import 'support.dart';

/// A notification prefs repository that answers from memory and records what was saved.
class FakePrefsRepo extends NotificationPrefsRepository {
  FakePrefsRepo(this.initial, {this.loadError, this.updateError, this.cachedAt});

  final NotificationPrefs? initial;

  /// When set, `update` throws it and the state carries it as a failed read.
  final ApiError? loadError;
  final ApiError? updateError;
  final DateTime? cachedAt;
  final saved = <Map<String, Object?>>[];

  @override
  RemoteState<NotificationPrefs> build() {
    final value = initial;
    if (value != null) {
      return RemoteState(value: value, fetchedAt: cachedAt ?? kolkata(2026, 10, 12, 21).toUtc(), error: loadError);
    }
    return loadError == null ? const RemoteState.idle() : RemoteState(error: loadError);
  }

  @override
  Future<void> refresh({bool force = false}) async {}

  @override
  Future<NotificationPrefs> update({
    String? timezone,
    ClockTime? quietStart,
    ClockTime? quietEnd,
    int? weeklyCap,
    Map<String, bool>? channels,
    StudyWindow? studyWindow,
    bool clearStudyWindow = false,
    String? expectUserId,
  }) async {
    if (updateError != null) throw updateError!;
    final current = state.value ?? NotificationPrefs.defaults;
    saved.add({
      'quietStart': quietStart?.toWire(),
      'quietEnd': quietEnd?.toWire(),
      'weeklyCap': weeklyCap,
      'channels': channels,
      'studyWindow': studyWindow == null ? null : '${studyWindow.start.toWire()}-${studyWindow.end.toWire()}',
      'clearStudyWindow': clearStudyWindow,
    });
    final next = NotificationPrefs(
      timezone: current.timezone,
      quietStart: quietStart ?? current.quietStart,
      quietEnd: quietEnd ?? current.quietEnd,
      channels: {...current.channels, ...?channels},
      studyWindow: clearStudyWindow ? null : (studyWindow ?? current.studyWindow),
      weeklyCap: weeklyCap ?? current.weeklyCap,
    );
    state = RemoteState(value: next, fetchedAt: kolkata(2026, 10, 12, 21, 42).toUtc());
    return next;
  }
}

class FakePermissionRequester implements PermissionRequester {
  FakePermissionRequester(this.current, {this.afterRequest = NotificationPermission.granted});

  NotificationPermission current;
  NotificationPermission afterRequest;
  int requests = 0;

  @override
  Future<NotificationPermission> notificationPermission() async => current;

  @override
  Future<NotificationPermission> requestNotificationPermission() async {
    requests++;
    current = afterRequest;
    return afterRequest;
  }
}

/// The overrides that put the feature on fakes: a rig for the engine and storage, a prefs
/// repository, and a permission requester.
List<Override> featureOverrides({
  required Rig rig,
  required FakePrefsRepo repo,
  required FakePermissionRequester permission,
  AppPrefs? appPrefs,
  RepairReady? repair,
}) =>
    [
      notificationServiceProvider.overrideWithValue(rig.service),
      reminderStoreProvider.overrideWithValue(rig.store),
      nowProvider.overrideWithValue(() => rig.now),
      repairReadyProvider.overrideWithValue(repair),
      notificationPrefsRepositoryProvider.overrideWith(() => repo),
      permissionRequesterProvider.overrideWithValue(permission),
      appPrefsProvider.overrideWithValue(appPrefs ?? AppPrefs(MemoryPrefsStore())),
      freshChecksOpenProvider.overrideWithValue(false),
      // The Celebrations choice is read from memory, never from the phone.
      rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ];
