import '../../../core/notifications/notifications.dart';
import '../../../core/router/routes.dart';
import '../logic/reminder_plan.dart';

/// Turns a tap on a notification, or on one of its actions, into what the student asked for.
///
/// - The notification itself and Start open the screen named in the payload.
/// - Not tonight is a clear answer and changes nothing else.
/// - Mute for 7 days pauses reminders on this phone.
/// A payload is only ever an in-app route: anything else is ignored.
///
/// [handle] never throws: the route opens first and does not depend on the record write, and a
/// failed write (local storage trouble) is dropped, since the record is only bookkeeping.
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
        if (taskId != null) await _quietly(() => declined(taskId));
        return;
      case ReminderActions.mute:
        await _quietly(mute);
        return;
    }

    if (AppRoutes.isNativePath(decoded.route)) {
      try {
        open(decoded.route);
      } on Object {
        // The router is not ready: the record below still counts the tap.
      }
    }
    if (taskId != null) await _quietly(() => opened(taskId));
  }

  static Future<void> _quietly(Future<void> Function() write) async {
    try {
      await write();
    } on Object {
      // Bookkeeping only: the student's tap has already done what they asked for.
    }
  }
}
