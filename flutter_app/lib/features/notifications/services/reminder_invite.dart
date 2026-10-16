import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/copy.dart' show formatTime12;
import '../../../core/haptics/haptics.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/storage/storage_providers.dart' show appPrefsProvider;
import '../data/invite_store.dart';
import '../logic/next_reminder.dart';
import '../logic/pre_prompt_policy.dart';
import '../screens/notification_settings_screen.dart' show defaultStudyWindow;
import 'notification_providers.dart';
import 'reminder_scheduler.dart';
import 'system_settings.dart';

/// True while at least one reminder kind is switched on in the app's own settings (the same test
/// the settings screen uses). Before the settings load, the defaults answer.
final remindersSettingOnProvider = Provider<bool>((ref) {
  final prefs = ref.watch(notificationPrefsRepositoryProvider.select((s) => s.value)) ?? NotificationPrefs.defaults;
  return NotificationChannelKeys.all.any(prefs.channelOn);
});

/// How the Notifications row in the Account sheet reads.
enum ReminderRowKind {
  /// The permission is still being read: the row says nothing about it yet.
  reading,

  /// Nothing can be asked on this build: a plain row.
  plain,

  /// Off: "Off" and a Turn on key.
  off,

  /// Android is blocking MockMob: "Blocked in Android settings" and an Open settings key.
  blocked,

  /// On, with the next reminder's time when the plan has one.
  on,
}

class ReminderRowState {
  const ReminderRowState(this.kind, {this.nextWhen});

  final ReminderRowKind kind;

  /// "tonight 8:30 PM", "Tue 20 Oct 8:30 PM": the next reminder, when one is planned.
  final String? nextWhen;

  @override
  bool operator ==(Object other) => other is ReminderRowState && other.kind == kind && other.nextWhen == nextWhen;

  @override
  int get hashCode => Object.hash(kind, nextWhen);
}

/// "tonight 8:30 PM" for the next planned reminder, or null when none is.
String? nextReminderWhen(NextReminder? next, DateTime now) {
  final at = next?.at;
  if (next == null || at == null) return null;
  return '${NextReminder.dayWord(now, at)} ${formatTime12(at)}';
}

final reminderRowStateProvider = Provider<ReminderRowState>((ref) {
  final permission = ref.watch(notificationPermissionProvider).value;
  final on = ref.watch(remindersSettingOnProvider);
  final next = ref.watch(nextReminderProvider);
  final now = ref.watch(nowProvider)();
  return switch (permission) {
    null => const ReminderRowState(ReminderRowKind.reading),
    NotificationPermission.unavailable => const ReminderRowState(ReminderRowKind.plain),
    NotificationPermission.denied => const ReminderRowState(ReminderRowKind.blocked),
    NotificationPermission.notAsked => const ReminderRowState(ReminderRowKind.off),
    NotificationPermission.granted =>
      on ? ReminderRowState(ReminderRowKind.on, nextWhen: nextReminderWhen(next, now)) : const ReminderRowState(ReminderRowKind.off),
  };
});

/// What the You strip is told when it first reads: whether to show, which wording (how many times
/// the student has already declined) and which key.
class InviteDue {
  const InviteDue({required this.show, required this.declinedAsks, required this.action});

  final bool show;
  final int declinedAsks;
  final InviteAction action;
}

final youInviteDueProvider = FutureProvider.autoDispose<InviteDue>((ref) async {
  final permission = await ref.watch(permissionRequesterProvider).notificationPermission();
  final history = await ref.watch(inviteStoreProvider).load();
  final postResult = await ref.watch(appPrefsProvider).lastPrePromptAt();
  final on = ref.watch(remindersSettingOnProvider);
  final show = shouldShowYouInvite(
    permission: permission,
    remindersOn: on,
    declinedAsks: history.declinedAsks,
    lastDeclinedAt: history.lastDeclinedAt,
    postResultAskedAt: postResult,
    now: ref.read(nowProvider)(),
  );
  return InviteDue(show: show, declinedAsks: history.declinedAsks, action: inviteActionFor(permission));
});

/// How one Turn on ended.
enum TurnOnResult {
  /// Android allows notifications and the reminders setting is on.
  allowed,

  /// Android allowed them, but the setting could not be saved. The reminders still run on the
  /// defaults; the settings page can change them.
  allowedUnsaved,

  /// Android said no.
  refused,
}

/// The one place Turn on is done, for the strip on You and the Account sheet's row: ask Android,
/// make sure the app's reminders setting is on, plan the reminders. Nothing here shows a screen.
class ReminderInvite {
  ReminderInvite(this._ref);

  final Ref _ref;

  ReminderScheduler get _scheduler => _ref.read(reminderSchedulerProvider);

  Future<TurnOnResult> turnOn() async {
    var permission = NotificationPermission.notAsked;
    try {
      final requester = _ref.read(permissionRequesterProvider);
      permission = await requester.notificationPermission();
      if (permission != NotificationPermission.granted) {
        permission = await requester.requestNotificationPermission();
      }
    } on Object {
      permission = NotificationPermission.denied;
    }
    if (!_ref.mounted) return TurnOnResult.refused;
    _ref.invalidate(notificationPermissionProvider);
    if (permission != NotificationPermission.granted) return TurnOnResult.refused;
    unawaited(_ref.read(hapticsProvider).settle());

    // Android allows it. If the app's own setting has every kind off, switch on the study
    // window (the student's own, or the default one) and the result reminder.
    var saved = true;
    if (!_ref.read(remindersSettingOnProvider)) {
      try {
        final repo = _ref.read(notificationPrefsRepositoryProvider.notifier);
        final current = _ref.read(notificationPrefsRepositoryProvider).value;
        await repo.update(
          channels: {
            NotificationChannelKeys.studyWindow: true,
            NotificationChannelKeys.resultReady: true,
          },
          studyWindow: current?.studyWindow ?? defaultStudyWindow,
        );
      } on Object {
        saved = false;
      }
    }
    try {
      await _scheduler.sync();
    } on Object {
      // The runtime plans again on the next resume or change.
    }
    return saved ? TurnOnResult.allowed : TurnOnResult.allowedUnsaved;
  }

  /// Opens Android's notification settings for MockMob. False when it did not open.
  Future<bool> openSettings() => _ref.read(systemSettingsProvider).openNotificationSettings();

  /// One Not now, or one refusal: the count and the time, so the strip comes back on the gaps.
  Future<void> declined() async {
    try {
      await _ref.read(inviteStoreProvider).recordDeclined(_ref.read(nowProvider)());
    } on Object {
      // The ask simply counts one less.
    }
  }

  /// The invitation is on screen today, so the post-result sheet waits until tomorrow.
  Future<void> shown() async {
    try {
      await _ref.read(inviteStoreProvider).markShown(_ref.read(nowProvider)());
    } on Object {
      // The sheet may then ask on the same day; nothing else changes.
    }
    if (!_ref.mounted) return;
    _ref.invalidate(prePromptDueProvider);
    _ref.invalidate(prePromptDueAtProvider);
  }

  /// The next reminder as words, or null when none is planned.
  String? nextWhen() => nextReminderWhen(_ref.read(nextReminderProvider), _ref.read(nowProvider)());
}

final reminderInviteProvider = Provider<ReminderInvite>(ReminderInvite.new);
