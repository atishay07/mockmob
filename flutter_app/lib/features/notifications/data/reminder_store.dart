import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/local_scope.dart';
import '../../../core/storage/prefs_store.dart';
import 'reminder_state.dart';

/// Reads and writes [ReminderState] for one signed-in student on this phone. Writes are
/// serialised, so two quick edits (a tap and an app resume) cannot overwrite each other.
class ReminderStore {
  ReminderStore(this._prefs, {required this.userId});

  final PrefsStore _prefs;

  /// Null while signed out: nothing is read or kept.
  final String? userId;
  Future<void> _queue = Future<void>.value();

  String get _key => 'notif_feature_state_${userId ?? 'none'}';

  Future<ReminderState> load() async {
    if (userId == null) return const ReminderState();
    return ReminderState.fromJsonString(await _prefs.getString(_key));
  }

  /// Applies [change] to the current state and saves the result. Returns the new state.
  Future<ReminderState> update(ReminderState Function(ReminderState) change) {
    final completer = Completer<ReminderState>();
    _queue = _queue.then((_) async {
      try {
        final current = await load();
        final next = change(current);
        if (userId != null) await _prefs.setString(_key, next.toJsonString());
        completer.complete(next);
      } on Object catch (error, stack) {
        completer.completeError(error, stack);
      }
    });
    return completer.future;
  }
}

/// The phone's key-value store. Tests override it with a memory store.
final reminderPrefsStoreProvider = Provider<PrefsStore>(
  (ref) => SharedPrefsStore(),
);

final reminderStoreProvider = Provider<ReminderStore>(
  (ref) => ReminderStore(
    ref.watch(reminderPrefsStoreProvider),
    userId: ref.watch(userIdProvider),
  ),
);

/// The live reminder state for the settings screen and the Today module. It is read only:
/// change it through `ReminderScheduler`, so every change is followed by a re-plan, then
/// invalidate this provider.
final reminderStateProvider = FutureProvider<ReminderState>(
  (ref) => ref.watch(reminderStoreProvider).load(),
);
