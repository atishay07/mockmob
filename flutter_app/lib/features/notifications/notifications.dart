/// What other modules use from the notifications feature.
///
/// - `openRemindersSheet(context)` opens the "Remind me when it matters" sheet. Ask
///   `prePromptDueProvider` first: it is true only after the student has had a first result and
///   the 14 day rule allows the sheet.
/// - `notificationsRuntimeProvider` starts the tap handler and the re-planning; read it once
///   after the first frame.
/// - `reminderStateProvider` holds the mute and the "Want fewer reminders?" signal.
library;

export 'copy.dart' show NotificationsCopy;
export 'data/reminder_state.dart' show CategoryStatus, ReminderState;
export 'data/reminder_store.dart' show reminderStateProvider;
export 'logic/reminder_plan.dart' show RepairReady;
export 'services/android_permission_requester.dart'
    show androidPermissionRequesterProvider;
export 'services/notification_providers.dart'
    show
        notificationPermissionProvider,
        notificationsRuntimeProvider,
        openRemindersSheet,
        prePromptDueProvider,
        reminderSchedulerProvider,
        repairReadyProvider;
