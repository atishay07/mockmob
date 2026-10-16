/// What other modules use from the notifications feature.
///
/// - `openRemindersSheet(context)` opens the "Remind me when it matters" sheet. Ask
///   `prePromptDueProvider` first, when a finished session's result is on screen: it is true
///   while reminders are off and the spacing since the last ask has passed (2, 4, 7, then every
///   10 days, never twice in a day), also after a refusal. The sheet counts itself as one ask
///   when it opens and asks a different way each time. For a moment that is not a result (NTA
///   mode, a running session, the app just opened) ask `prePromptDueAtProvider` with the
///   matching `PrePromptMoment`: it is false for all of them.
/// - `notificationsRuntimeProvider` starts the tap handler and the re-planning; read it once
///   after the first frame.
/// - `NotificationsInvite` is the strip on You that keeps inviting the student to turn reminders
///   on while they are off (the You area places it). It is never placed in a paper.
/// - `reminderStateProvider` holds the mute and the "Want fewer reminders?" signal.
library;

export 'copy.dart' show NotificationsCopy;
export 'data/reminder_state.dart' show CategoryStatus, ReminderState;
export 'data/reminder_store.dart' show reminderStateProvider;
export 'logic/pre_prompt_policy.dart' show PrePromptMoment;
export 'logic/reminder_plan.dart' show RepairReady;
export 'services/android_permission_requester.dart'
    show androidPermissionRequesterProvider;
export 'services/notification_providers.dart'
    show
        notificationPermissionProvider,
        notificationsRuntimeProvider,
        openRemindersSheet,
        prePromptDueAtProvider,
        prePromptDueProvider,
        reminderSchedulerProvider,
        repairReadyProvider;
export 'widgets/notifications_invite.dart' show NotificationsInvite;
