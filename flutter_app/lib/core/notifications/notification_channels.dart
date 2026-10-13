import '../models/notification_prefs.dart';

enum NotificationImportance { low, normal }

/// One Android notification channel. Channels are created at first value, not at install.
class NotificationChannelSpec {
  const NotificationChannelSpec({
    required this.id,
    required this.name,
    required this.description,
    required this.importance,
    this.prefKey,
    this.silent = false,
  });

  final String id;
  final String name;
  final String description;
  final NotificationImportance importance;

  /// The key in the server's channel prefs, or null when the student cannot switch it off.
  final String? prefKey;

  /// No sound or vibration (the ongoing mock status).
  final bool silent;
}

/// The channels of design spec section 8.
abstract final class NotificationChannels {
  static const mockInProgress = NotificationChannelSpec(
    id: 'mock_in_progress',
    name: 'Mock in progress',
    description: 'Shows while a mock is open and the app is in the background.',
    importance: NotificationImportance.low,
    silent: true,
  );

  static const resultsReady = NotificationChannelSpec(
    id: 'results_ready',
    name: 'Results ready',
    description: 'Tells you when a result you submitted in the background is ready.',
    importance: NotificationImportance.normal,
    prefKey: NotificationChannelKeys.resultReady,
  );

  static const studyReminders = NotificationChannelSpec(
    id: 'study_reminders',
    name: 'Study reminders',
    description: 'Reminds you at the study time you chose.',
    importance: NotificationImportance.normal,
    prefKey: NotificationChannelKeys.studyWindow,
  );

  /// Mistakes from a recent mock are waiting for a repair. Its switch lives on this phone (the
  /// server has no key for it), so the engine never skips it for a server channel setting.
  static const repairReady = NotificationChannelSpec(
    id: 'repair_ready',
    name: 'Repair ready',
    description: 'Tells you when mistakes from a recent mock are waiting for a repair.',
    importance: NotificationImportance.normal,
  );

  static const weeklyPlan = NotificationChannelSpec(
    id: 'weekly_plan',
    name: 'Weekly plan',
    description: 'A look back at your week.',
    importance: NotificationImportance.low,
    prefKey: NotificationChannelKeys.weeklyPlan,
  );

  /// Created only when the content gate opens.
  static const freshChecks = NotificationChannelSpec(
    id: 'fresh_checks',
    name: 'Fresh checks',
    description: 'Tells you when a fresh-question check is due.',
    importance: NotificationImportance.normal,
    prefKey: NotificationChannelKeys.checkDue,
  );

  static const accountSafety = NotificationChannelSpec(
    id: 'account_safety',
    name: 'Account and safety',
    description: 'Important messages about your account.',
    importance: NotificationImportance.normal,
  );

  static const all = [mockInProgress, resultsReady, studyReminders, repairReady, weeklyPlan, freshChecks, accountSafety];

  static NotificationChannelSpec byId(String id) => all.firstWhere((c) => c.id == id, orElse: () => accountSafety);
}
