import '../../../core/notifications/notifications.dart';
import '../../../core/router/routes.dart';
import '../logic/reminder_plan.dart';

/// Turns a tap on a notification, or on one of its actions, into what the student asked for.
///
/// - The notification itself and Start open the screen named in the payload.
/// - Not tonight is a clear answer and changes nothing else.
/// - Mute for 7 days pauses reminders on this phone.
/// A payload is only ever an in-app route: anything else is ignored.
class ReminderTapHandler {
  ReminderTapHandler({
    required this.opened,
    required this.declined,
    required this.mute,
    required this.open,
  });

  /// A reminder was tapped or started (the task id).
  final Future<void> Function(String taskId) opened;
  final Future<void> Function(String taskId) declined;
  final Future<void> Function() mute;

  /// Opens an in-app route (`router.go`).
  final void Function(String route) open;

  Future<void> handle(NotificationTap tap) async {
    final payload = tap.payload;
    if (payload == null || payload.isEmpty) return;
    final decoded = decodeReminderPayload(payload);
    final taskId = decoded.taskId;

    switch (tap.actionId) {
      case ReminderActions.notTonight:
        if (taskId != null) await declined(taskId);
        return;
      case ReminderActions.mute:
        await mute();
        return;
    }

    if (taskId != null) await opened(taskId);
    if (AppRoutes.isNativePath(decoded.route)) open(decoded.route);
  }
}
