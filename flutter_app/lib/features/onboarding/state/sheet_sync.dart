import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth.dart';
import '../../../core/models/notification_prefs.dart' as prefs;
import '../../../core/repositories/repositories.dart';
import '../model/answers.dart';
import 'answers_controller.dart';

/// Where writing the sealed sheet to the account stands.
enum SheetSyncPhase {
  /// Nothing to write (not signed in, not sealed, or already written).
  idle,

  /// Requests are out; nothing claims saved yet.
  saving,

  /// Every write was acknowledged by the server.
  saved,

  /// A write failed; the sheet is still on the phone. [SheetSync.run] tries again.
  failed,

  /// The account already had subjects, so nothing was overwritten. The sheet stays on the phone.
  kept,
}

class SheetSyncState {
  const SheetSyncState(this.phase, {this.offline = false});

  final SheetSyncPhase phase;

  /// The failure was a lost connection.
  final bool offline;
}

/// After sign-in, writes the parts of the sheet the API supports (APP-API-CONTRACT 2.1 to 2.3):
/// the age answer (`PUT /api/me/consent`, usage data off), the subjects (`PATCH /api/users/{id}`,
/// only `{subjects}`), the study days (`PUT /api/me/goal`) and the study time
/// (`PUT /api/me/notification-prefs`, `studyWindow`). Course, colleges, category, confidence,
/// worry and minutes have no endpoint and stay on the phone.
///
/// Only a new account (no subjects yet) is written to, so signing in never overwrites a plan,
/// or a consent choice, that someone already has. "Saved" is reached only after every write is acknowledged.
final sheetSyncProvider = NotifierProvider<SheetSync, SheetSyncState>(SheetSync.new);

class SheetSync extends Notifier<SheetSyncState> {
  bool _running = false;
  String? _keptFor;

  @override
  SheetSyncState build() {
    ref.listen(authSnapshotProvider, (previous, next) {
      if (previous?.userId != next.userId) _keptFor = null;
      _maybeRun();
    });
    ref.listen(onboardingAnswersProvider, (_, _) => _maybeRun());
    scheduleMicrotask(_maybeRun);
    return const SheetSyncState(SheetSyncPhase.idle);
  }

  void _maybeRun() {
    if (!ref.mounted || _running || state.phase == SheetSyncPhase.failed) return;
    final auth = ref.read(authSnapshotProvider);
    final answers = ref.read(onboardingAnswersProvider).value;
    if (!auth.isSignedIn || answers == null || !answers.sealed) return;
    if (answers.syncedFor == auth.userId) {
      if (state.phase != SheetSyncPhase.saved) state = const SheetSyncState(SheetSyncPhase.saved);
      return;
    }
    if (_keptFor == auth.userId) return;
    unawaited(run());
  }

  /// Writes the sheet. Also the "Try again" action.
  Future<void> run() async {
    if (_running) return;
    final auth = ref.read(authSnapshotProvider);
    final answers = await ref.read(onboardingAnswersProvider.future);
    final userId = auth.userId;
    if (!auth.isSignedIn || userId == null || !answers.sealed) return;
    _running = true;
    state = const SheetSyncState(SheetSyncPhase.saving);
    try {
      // An account that already has a plan keeps everything it has, its consent included.
      if (auth.subjects.isNotEmpty) {
        _keptFor = userId;
        if (ref.mounted) state = const SheetSyncState(SheetSyncPhase.kept);
        return;
      }
      await _writeAge(answers);
      await _writeProfile(userId, answers);
      if (!ref.mounted) return;
      ref.read(onboardingAnswersProvider.notifier).markSynced(userId);
      state = const SheetSyncState(SheetSyncPhase.saved);
      unawaited(_reloadProfile());
    } on ApiError catch (e) {
      if (ref.mounted) state = SheetSyncState(SheetSyncPhase.failed, offline: e.isOffline);
    } finally {
      _running = false;
    }
  }

  Future<void> _writeAge(OnboardingAnswers a) async {
    final age = a.age;
    if (age == null) return;
    final consent = ref.read(consentRepositoryProvider);
    if (consent.isLoaded && consent.consent.ageBand == age.band) return;
    await ref.read(consentRepositoryProvider.notifier).setAgeBand(age.band);
  }

  Future<void> _writeProfile(String userId, OnboardingAnswers a) async {
    final subjects = [for (final s in a.subjects) if (s.syncs) s.id];
    if (subjects.isNotEmpty) {
      await ref.read(apiClientProvider).patch('/api/users/${Uri.encodeComponent(userId)}', body: {'subjects': subjects});
    }
    await ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: a.days.length.clamp(1, 7));
    await ref.read(notificationPrefsRepositoryProvider.notifier).update(
          studyWindow: prefs.StudyWindow(
            start: prefs.ClockTime(a.window.hour, 0),
            end: prefs.ClockTime(a.window.hour + 1, 0),
          ),
        );
  }

  Future<void> _reloadProfile() async {
    try {
      await ref.read(authSnapshotProvider.notifier).reload();
    } on Object {
      // The profile loads again on the next launch.
    }
  }
}
