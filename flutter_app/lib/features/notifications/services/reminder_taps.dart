import '../../../core/notifications/notifications.dart';
import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../logic/reminder_plan.dart';

/// Turns a tap on a notification, or on one of its actions, into what the student asked for.
///
/// - The notification itself and Start open the screen named in the payload.
/// - Not tonight is a clear answer and changes nothing else.
/// - Mute for 7 days pauses reminders on this phone.
/// - Resume (on the answer to Mute) turns the reminders back on.
/// Not tonight and Mute are each answered with a silent replacement notification ([acknowledge]),
/// so the student sees the tap did something.
/// A payload is only ever an in-app route (resolved by the action router, with the query its
/// screen reads, such as a repair's count or a practice run's subject): anything else is ignored.
///
/// [handle] never throws: the route opens first and does not depend on the record write, and a
/// failed write (local storage trouble) is dropped, since the record is only bookkeeping.
class ReminderTapHandler {
  ReminderTapHandler({
    required this.opened,
    required this.declined,
    required this.mute,
    required this.open,
    this.unmute,
    this.acknowledge,
  });

  /// Turns reminders back on (the Resume action).
  final Future<void> Function()? unmute;

  /// Posts the silent answer to Not tonight or Mute.
  final Future<void> Function(ReminderAck ack)? acknowledge;

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
        await _quietly(() async => acknowledge?.call(ReminderAck.notTonight(taskId)));
        return;
      case ReminderActions.mute:
        await _quietly(mute);
        await _quietly(() async => acknowledge?.call(const ReminderAck.muted()));
        return;
      case ReminderActions.resume:
        await _quietly(() async => unmute?.call());
        return;
    }

    // The route goes through the action router (read-only use): it keeps only a native screen of
    // this app and only the query that screen reads, so a payload can never open anything else.
    final target = ActionRouter.resolve(decoded.route);
    if (target is NativeTarget && !AppRoutes.isAuthPath(Uri.parse(target.location).path)) {
      try {
        open(target.location);
      } on Object {
        // The router is not ready: the record below still counts the tap.
      }
    }
    // The answers to Not tonight and Mute open their screen but are not reminders to count.
    if (taskId != null && !taskId.startsWith(ackTaskPrefix)) await _quietly(() => opened(taskId));
  }

  static Future<void> _quietly(Future<void> Function() write) async {
    try {
      await write();
    } on Object {
      // Bookkeeping only: the student's tap has already done what they asked for.
    }
  }
}

/// What a silent answer is for.
class ReminderAck {
  const ReminderAck.notTonight(this.taskId) : muted = false;
  const ReminderAck.muted()
      : muted = true,
        taskId = null;

  /// True for Mute for 7 days, false for Not tonight.
  final bool muted;

  /// The reminder that was declined (Not tonight), so the answer can replace it in the shade.
  final String? taskId;
}
