import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/notifications/notifications.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/router.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../data/reminder_store.dart';
import '../copy.dart';
import '../logic/next_reminder.dart';
import '../logic/pre_prompt_policy.dart';
import '../logic/reminder_plan.dart';
import '../logic/repair_ready.dart';
import 'pre_prompt_asks.dart';
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

/// Opens a reminder's route. A tap that launched the app arrives while the splash is still
/// deciding who is signed in: then the route is remembered and the redirect continues there,
/// the same way a launch link does.
void openReminderRoute(Ref ref, String route) {
  if (ref.read(authSnapshotProvider).status == AuthStatus.unknown) {
    ref.read(intendedRouteProvider).remember(route);
  } else {
    ref.read(routerProvider).go(route);
  }
}

/// A reminder tap that arrived before anyone was signed in on this run (a tap that launched
/// the app). It is handled once an account is known, or forgotten after [maxAge].
class HeldReminderTap {
  HeldReminderTap({this.maxAge = const Duration(minutes: 10)});

  final Duration maxAge;
  NotificationTap? _tap;
  DateTime? _at;

  void hold(NotificationTap tap, DateTime at) {
    _tap = tap;
    _at = at;
  }

  /// The held tap, once, while it is fresh.
  NotificationTap? take(DateTime now) {
    final tap = _tap;
    final at = _at;
    _tap = null;
    _at = null;
    if (tap == null || at == null || now.difference(at) > maxAge) return null;
    return tap;
  }
}

final heldReminderTapProvider = Provider<HeldReminderTap>((ref) => HeldReminderTap());

/// The tap handler the engine uses: it routes, records the response and mutes.
final reminderTapHandlerProvider = Provider<ReminderTapHandler>((ref) {
  ReminderScheduler scheduler() => ref.read(reminderSchedulerProvider);
  return ReminderTapHandler(
    opened: (id) => scheduler().reminderOpened(id),
    declined: (id) => scheduler().reminderDeclined(id),
    mute: () => scheduler().mute(),
    open: (route) => openReminderRoute(ref, route),
    unmute: () => scheduler().unmute(),
    acknowledge: (ack) => _acknowledge(ref, ack),
  );
});

/// The silent answer to Not tonight or Mute for 7 days: it replaces the reminder, says what the
/// tap did and takes itself away. Mute's answer carries a Resume action and opens the settings.
Future<void> _acknowledge(Ref ref, ReminderAck ack) {
  final service = ref.read(notificationServiceProvider);
  if (ack.muted) {
    return service.acknowledge(
      taskId: '${ackTaskPrefix}mute',
      channel: NotificationChannels.studyReminders,
      title: NotificationsCopy.ackMutedTitle,
      body: NotificationsCopy.ackMutedBody,
      payload: encodeReminderPayload(AppRoutes.youNotifications, '${ackTaskPrefix}mute'),
      actions: const [NotificationActionSpec(id: ReminderActions.resume, label: NotificationsCopy.actionResume)],
      lasts: const Duration(seconds: 15),
    );
  }
  final id = ack.taskId;
  final repair = id != null && id.startsWith(repairTaskPrefix);
  return service.acknowledge(
    // The same id as the reminder, so the answer replaces it in the shade.
    taskId: id ?? '${ackTaskPrefix}not_tonight',
    channel: repair ? NotificationChannels.repairReady : NotificationChannels.studyReminders,
    title: repair ? NotificationsCopy.ackNotTonightTitle : NotificationsCopy.ackNotTonightStudyTitle,
    body: repair ? NotificationsCopy.ackNotTonightBody : NotificationsCopy.ackNotTonightStudyBody,
    payload: encodeReminderPayload(repair ? AppRoutes.reviewMistakes : AppRoutes.today, '${ackTaskPrefix}not_tonight'),
  );
}

/// The next reminder, or why there is none, as the scheduler left it after its last plan. Null
/// until the first plan of this run has finished (never guessed).
class NextReminderNotifier extends Notifier<NextReminder?> {
  @override
  NextReminder? build() {
    // Another account (or signing out) starts from "not planned yet": a time planned for the
    // previous student is never shown to the next one.
    ref.watch(userIdProvider);
    return null;
  }

  void set(NextReminder? next) => state = next;
}

final nextReminderProvider = NotifierProvider<NextReminderNotifier, NextReminder?>(NextReminderNotifier.new);

final Provider<ReminderScheduler> reminderSchedulerProvider = Provider<ReminderScheduler>((ref) {
  final service = ref.watch(notificationServiceProvider);
  final taps = ref.read(reminderTapHandlerProvider);
  return ReminderScheduler(
    service: service,
    store: ref.watch(reminderStoreProvider),
    prefs: () => ref.read(notificationPrefsRepositoryProvider).value,
    repair: () => ref.read(repairReadyProvider),
    onNext: (next) {
      if (ref.mounted) ref.read(nextReminderProvider.notifier).set(next);
    },
    // The tap callback must be registered the first time the engine starts.
    ensureReady: () => service.initialize(
      onTap: (tap) {
        // A tap that launched the app can arrive before the account is known. Its record
        // belongs to that account, so it waits and is handled once someone is signed in.
        if (ref.read(userIdProvider) == null) {
          ref.read(heldReminderTapProvider).hold(tap, ref.read(nowProvider)());
        } else {
          // handle() never throws; the guard keeps a future change from leaking an error.
          unawaited(taps.handle(tap).catchError((Object _) {}));
        }
      },
    ),
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

Future<bool> _prePromptDue(Ref ref, PrePromptMoment moment) async {
  if (!moment.mayAsk) return false;
  final permission = await ref
      .watch(permissionRequesterProvider)
      .notificationPermission();
  final state = await ref.watch(reminderStoreProvider).load();
  final last = await ref.watch(appPrefsProvider).lastPrePromptAt();
  return shouldOfferPrePrompt(
    permission: permission,
    askCount: state.prePromptAskCount,
    lastAskedAt: last,
    now: ref.read(nowProvider)(),
    moment: moment,
  );
}

/// True when the "Remind me when it matters" sheet may be shown now, at the moment right after a
/// finished session's result: reminders are still off, and the spacing since the last ask has
/// passed (2, 4, 7, then every 10 days; never twice in a day). A refusal does not end it. The
/// Result module reads this when a result is on screen.
final prePromptDueProvider = FutureProvider.autoDispose<bool>(
  (ref) => _prePromptDue(ref, PrePromptMoment.afterResult),
);

/// The same answer for another moment: false for [PrePromptMoment.inSession],
/// [PrePromptMoment.ntaMode] and [PrePromptMoment.appOpen]. A caller that knows the result is an
/// NTA mode one asks with `ntaMode`.
final prePromptDueAtProvider = FutureProvider.autoDispose
    .family<bool, PrePromptMoment>((ref, moment) => _prePromptDue(ref, moment));

/// Records each time the pre-prompt is put to the student (the time and the count).
final prePromptAsksProvider = Provider<PrePromptAsks>(
  (ref) => PrePromptAsks(
    prefs: ref.watch(appPrefsProvider),
    scheduler: ref.watch(reminderSchedulerProvider),
    now: ref.read(nowProvider),
    // The recap row and the sheet answer from the new history straight away.
    onRecorded: () {
      if (!ref.mounted) return;
      ref.invalidate(prePromptDueProvider);
      ref.invalidate(prePromptDueAtProvider);
    },
  ),
);

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
        if (next != null) unawaited(_sync());
      },
    );
    _ref.listen(repairReadyProvider, (_, _) => unawaited(_sync()));
    _ref.listen<String?>(userIdProvider, (_, id) {
      if (id != null) unawaited(_open());
    });
    _lifecycle = AppLifecycleListener(onResume: () => unawaited(_open()));
    unawaited(_open());
  }

  /// Whenever the app opens: settle what came due, then plan what is ahead.
  Future<void> _open() async {
    try {
      // A held launch tap counts as opened before settling, or it would read as unopened.
      await _replayHeldTap();
      await _scheduler.settle();
      await _scheduler.sync();
      if (_ref.mounted) _ref.invalidate(notificationPermissionProvider);
    } on Object {
      // Reminders are a convenience: a failure here must never reach the student.
    }
  }

  /// A re-plan started by a settings or repair change. Nothing awaits it, so a failure (a plugin
  /// or storage error) is caught here instead of becoming an unhandled error. The next change or
  /// app open plans again.
  Future<void> _sync() async {
    try {
      await _scheduler.sync();
    } on Object {
      // Reminders are a convenience: a failure here must never reach the student.
    }
  }

  /// A launch tap held until the account was known: handled now, before re-planning, so the
  /// response counts and the route opens.
  Future<void> _replayHeldTap() async {
    if (_ref.read(userIdProvider) == null) return;
    final tap = _ref.read(heldReminderTapProvider).take(_ref.read(nowProvider)());
    if (tap != null) await _ref.read(reminderTapHandlerProvider).handle(tap);
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
