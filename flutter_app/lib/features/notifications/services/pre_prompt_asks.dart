import 'dart:async';

import '../../../core/storage/app_prefs.dart';
import 'reminder_scheduler.dart';

/// Keeps the pre-prompt's history: how many times it was put to the student and when the last
/// one was. The time lives with the phone's small settings and the count with the reminder
/// state, as before; both are written before the sheet can close, so the spacing holds even if
/// the app is killed.
class PrePromptAsks {
  PrePromptAsks({
    required this._prefs,
    required this._scheduler,
    required this._now,
    this._onRecorded,
  });

  final AppPrefs _prefs;
  final ReminderScheduler _scheduler;
  final DateTime Function() _now;
  final void Function()? _onRecorded;

  /// One ask was put to the student: the time first, then the count.
  Future<void> record() async {
    await _prefs.setLastPrePromptAt(_now());
    await _scheduler.prePromptDismissed();
    _onRecorded?.call();
  }
}
