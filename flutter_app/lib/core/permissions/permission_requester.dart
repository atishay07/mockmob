import 'package:flutter_riverpod/flutter_riverpod.dart';

enum NotificationPermission {
  /// The student allowed notifications (or the OS does not ask, below Android 13).
  granted,

  /// Refused. Final until changed in You or system settings; it never blocks study.
  denied,

  /// The question has not been asked yet.
  notAsked,

  /// No implementation is wired in, so nothing can be asked.
  unavailable,
}

/// Asks the operating system for permissions. Core defines the interface and the UI calls it
/// (for example the "Set a reminder" row on the last recap card); the notifications module
/// provides the implementation by overriding [permissionRequesterProvider].
abstract class PermissionRequester {
  Future<NotificationPermission> notificationPermission();

  /// Shows the Android 13+ system dialog. Only call after the student chose to set a reminder.
  Future<NotificationPermission> requestNotificationPermission();
}

class _UnwiredPermissionRequester implements PermissionRequester {
  const _UnwiredPermissionRequester();

  @override
  Future<NotificationPermission> notificationPermission() async => NotificationPermission.unavailable;

  @override
  Future<NotificationPermission> requestNotificationPermission() async => NotificationPermission.unavailable;
}

/// Overridden with the real implementation. Until then it reports `unavailable` and never prompts.
final permissionRequesterProvider = Provider<PermissionRequester>((ref) => const _UnwiredPermissionRequester());
