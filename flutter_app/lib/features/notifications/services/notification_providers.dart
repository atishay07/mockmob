import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/notifications/notifications.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/router.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../data/reminder_store.dart';
import '../logic/pre_prompt_policy.dart';
import '../logic/reminder_plan.dart';
import '../logic/repair_ready.dart';
import 'reminder_scheduler.dart';
import 'reminder_taps.dart';

/// The repair waiting for the student, if any, from the attempts and repair records on this
/// phone. Drives the repair-ready reminder and cancels it once the repair is done.
final repairReadyProvider = Provider<RepairReady?>((ref) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final records = ref.watch(repairLocalRecordsProvider).value;
  if (attempts == null || records == null) return null;
  return computeRepairReady(
    attempts: attempts,
    records: records,
    now: ref.read(nowProvider)(),
  );
});

final Provider<ReminderScheduler> reminderSchedulerProvider = Provider<ReminderScheduler>((ref) {
  final service = ref.watch(notificationServiceProvider);
  ReminderScheduler self() => ref.read(reminderSchedulerProvider);
  final taps = ReminderTapHandler(
    opened: (id) => self().reminderOpened(id),
    declined: (id) => self().reminderDeclined(id),
    mute: () => self().mute(),
    open: (route) => ref.read(routerProvider).go(route),
  );
  return ReminderScheduler(
    service: service,
    store: ref.watch(reminderStoreProvider),
    prefs: () => ref.read(notificationPrefsRepositoryProvider).value,
    repair: () => ref.read(repairReadyProvider),
    // The tap callback must be registered the first time the engine starts.
    ensureReady: () =>
        service.initialize(onTap: (tap) => unawaited(taps.handle(tap))),
    now: ref.read(nowProvider),
    onStateChanged: () {
      if (ref.mounted) ref.invalidate(reminderStateProvider);
    },
  );
});

/// The system permission as the settings screen shows it. Refresh with `ref.invalidate` after
/// the sheet closes and when the app resumes.
final notificationPermissionProvider =
    FutureProvider.autoDispose<NotificationPermission>(
      (ref) => ref.watch(permissionRequesterProvider).notificationPermission(),
    );

/// True when the "Remind me when it matters" sheet may be shown now: the system question has
/// not been asked, and the sheet has not been put off twice or put off less than 14 days ago.
/// The Result module reads this after the first result is opened and closed.
final prePromptDueProvider = FutureProvider.autoDispose<bool>((ref) async {
  final permission = await ref
      .watch(permissionRequesterProvider)
      .notificationPermission();
  final state = await ref.watch(reminderStoreProvider).load();
  final last = await ref.watch(appPrefsProvider).lastPrePromptAt();
  return shouldOfferPrePrompt(
    permission: permission,
    notNowCount: state.prePromptNotNowCount,
    lastNotNowAt: last,
    now: ref.read(nowProvider)(),
  );
});

/// Opens the pre-prompt sheet. The Result module calls this from the recap's reminder row.
Future<void> openRemindersSheet(BuildContext context) =>
    context.push<void>(AppRoutes.permissionsNotifications);

/// Fresh checks and their channel appear only when the content gate is open.
final freshChecksOpenProvider = Provider<bool>(
  (ref) => ref.watch(appConfigProvider).freshChecksLive,
);

/// Starts everything that must run for the whole life of the app: the tap handler, settling of
/// reminders that came due while the app was closed, and re-planning whenever the student's
/// settings, their repairs or the signed-in account change, and on every resume. Read it once
/// after the first frame (`ref.read(notificationsRuntimeProvider)`).
final notificationsRuntimeProvider = Provider<NotificationsRuntime>((ref) {
  final runtime = NotificationsRuntime(ref)..start();
  ref.onDispose(runtime.dispose);
  return runtime;
});

class NotificationsRuntime {
  NotificationsRuntime(this._ref);

  final Ref _ref;
  AppLifecycleListener? _lifecycle;

  ReminderScheduler get _scheduler => _ref.read(reminderSchedulerProvider);

  void start() {
    _ref.listen<NotificationPrefs?>(
      notificationPrefsRepositoryProvider.select((s) => s.value),
      (_, next) {
        if (next != null) unawaited(_scheduler.sync());
      },
    );
    _ref.listen(repairReadyProvider, (_, _) => unawaited(_scheduler.sync()));
    _ref.listen<String?>(userIdProvider, (_, id) {
      if (id != null) unawaited(_open());
    });
    _lifecycle = AppLifecycleListener(onResume: () => unawaited(_open()));
    unawaited(_open());
  }

  /// Whenever the app opens: settle what came due, then plan what is ahead.
  Future<void> _open() async {
    try {
      await _scheduler.settle();
      await _scheduler.sync();
      if (_ref.mounted) _ref.invalidate(notificationPermissionProvider);
    } on Object {
      // Reminders are a convenience: a failure here must never reach the student.
    }
  }

  void dispose() => _lifecycle?.dispose();
}

/// The weekly cap in force on this phone: the client-side choice, lowered by the server's own
/// `weeklyCap` when that is smaller (the engine applies the same rule).
final weeklyCapProvider = FutureProvider.autoDispose<int>((ref) async {
  final local = await ref.watch(appPrefsProvider).weeklyCap();
  final server = ref.watch(
    notificationPrefsRepositoryProvider.select((s) => s.value?.weeklyCap),
  );
  return server != null && server < local ? server : local;
});
