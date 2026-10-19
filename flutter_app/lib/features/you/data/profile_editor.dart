import '../../../core/domain/cuet_rules.dart';

// The writes You makes to the account. Every one returns only after the server acknowledged it,
// so a screen can say "Saved" truthfully; on failure nothing local changes and the ApiError
// reaches the screen.
//
// Endpoints (APP-API-CONTRACT 2.1 to 2.3, WEB-PARITY F1 and F2):
// - `PATCH /api/users/{id}` with `{subjects}` (at most 5 registry ids) or `{name}` (1 to 80
//   characters, trimmed). The server's `profilePatch` accepts nothing else. Then `GET
//   /api/auth/me` through the auth controller, so Practice, Today and the quote re-read.
// - `PUT /api/me/goal` for how many days a week, keeping any pause.
// - `PUT /api/me/notification-prefs` for the study window.
// - `PUT /api/study/preferences` for the usual length, when study preferences are open.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/notification_prefs.dart' as prefs;
import '../../../core/repositories/repositories.dart';
import '../../onboarding/data/subjects.dart' show SheetSubject;
import '../../onboarding/model/answers.dart' show OnboardingAnswers;
import '../../onboarding/model/choices.dart' show StudyTime;
import '../../onboarding/model/deck.dart' show Steps;
import '../../onboarding/state/answers_controller.dart';
import 'goal_pause.dart';
import 'student_target.dart' show daysForCount;
import 'study_length.dart';

/// The most subjects a profile holds (the server's `profilePatch` cap).
const int kMaxProfileSubjects = kCuetMaxSubjects;

/// The longest name the server accepts.
const int kMaxNameLength = 80;

/// Which part of saving the week failed.
enum WeekSavePart { goal, studyTime, length }

/// Saving the week stopped at [part]. Parts before it were acknowledged.
class WeekSaveError implements Exception {
  const WeekSaveError(this.part, this.error);

  final WeekSavePart part;
  final ApiError error;
}

class ProfileEditor {
  ProfileEditor(this._ref);

  final Ref _ref;

  String _userId() {
    final id = _ref.read(authSnapshotProvider).userId;
    if (id == null) throw const ApiError(kind: ApiErrorKind.unauthorized, code: 'signed_out', status: 401);
    return id;
  }

  /// Saves the profile subjects. Returns what the server stored.
  Future<List<String>> saveSubjects(List<String> ids) async {
    final userId = _userId();
    final response =
        await _ref.read(apiClientProvider).patch('/api/users/${Uri.encodeComponent(userId)}', body: {'subjects': ids}, expectUserId: userId);
    // Only what the server says it stored counts. A reply without the list is not an
    // acknowledgement: read the account back and compare before saying "saved".
    var saved = asStringList(response.map['subjects']);
    if (saved.isEmpty && ids.isNotEmpty) {
      await _reloadProfile();
      saved = _ref.read(authSnapshotProvider).subjects;
      if (saved.toSet().difference(ids.toSet()).isNotEmpty || ids.toSet().difference(saved.toSet()).isNotEmpty) {
        throw const ApiError(kind: ApiErrorKind.unavailable, code: 'subjects_not_confirmed');
      }
      _mirrorSubjects(saved);
      return saved;
    }
    _mirrorSubjects(saved);
    await _reloadProfile();
    return saved;
  }

  /// Saves the display name. Returns the stored name.
  Future<String> saveName(String name) async {
    final trimmed = name.trim();
    final userId = _userId();
    final response =
        await _ref.read(apiClientProvider).patch('/api/users/${Uri.encodeComponent(userId)}', body: {'name': trimmed}, expectUserId: userId);
    final stored = asString(response.map['name'])?.trim();
    final saved = stored == null || stored.isEmpty ? trimmed : stored;
    // The server answered: the name shows on You and Today at once, then the profile is read back (I11).
    try {
      await _ref.read(authSnapshotProvider.notifier).acknowledgeName(saved);
    } on Object {
      // The read back below brings it anyway.
    }
    await _reloadProfile();
    return saved;
  }

  /// Saves the study week: how many days to the goal (keeping any pause that is still running),
  /// the study window to the reminders and the usual minutes to the study preferences, keeping the
  /// chosen weekdays and minutes on this phone too. Returns the weekdays now kept.
  ///
  /// [daysEdited] is false when the student left the day picker alone. The goal then stays as the
  /// server has it, so a stale phone copy of the days can never lower it, and the phone's weekdays
  /// are brought to the server's count instead.
  Future<Set<int>> saveWeek({required Set<int> days, required StudyTime window, required int minutes, bool daysEdited = true}) async {
    // Every part is for the account that started the save, never one that signed in during it.
    final userId = _ref.read(authSnapshotProvider).userId;
    final goals = _ref.read(goalRepositoryProvider.notifier);
    var goal = _ref.read(goalRepositoryProvider).value;
    if (goal == null) {
      await goals.refresh(force: true);
      goal = _ref.read(goalRepositoryProvider).value;
    }
    // Saving without the current pause would end it, so never save blind.
    if (goal == null) throw const WeekSaveError(WeekSavePart.goal, ApiError(kind: ApiErrorKind.unavailable, code: 'goal_unknown'));
    final count = daysEdited ? days.length.clamp(1, 7) : goal.daysPerWeek.clamp(1, 7);
    if (!daysEdited) days = daysForCount(days, count);
    if (goal.daysPerWeek != count) {
      try {
        await goals.save(daysPerWeek: count, pausedUntil: pauseToKeep(goal.pausedUntil, _ref.read(nowProvider)()), expectUserId: userId);
      } on ApiError catch (e) {
        throw WeekSaveError(WeekSavePart.goal, e);
      }
    }
    _editAnswers((a) => a.copyWith(days: days, minutes: minutes).mark(Steps.rhythm));
    try {
      await _ref.read(notificationPrefsRepositoryProvider.notifier).update(
            studyWindow: prefs.StudyWindow(start: prefs.ClockTime(window.hour, 0), end: prefs.ClockTime(window.hour + 1, 0)),
            expectUserId: userId,
          );
    } on ApiError catch (e) {
      throw WeekSaveError(WeekSavePart.studyTime, e);
    }
    _editAnswers((a) => a.copyWith(window: window));
    try {
      await _ref.read(studyLengthProvider).save(sessionMinutesForServer(minutes), expectUserId: userId);
    } on ApiError catch (e) {
      throw WeekSaveError(WeekSavePart.length, e);
    }
    return days;
  }

  /// Keeps the phone's sheet in step with the profile, so Today's first move and the sheet card
  /// read the same subjects. Only the subjects the sheet knows are kept there.
  void _mirrorSubjects(List<String> ids) {
    final known = [for (final id in ids) ?SheetSubject.byId(id)];
    _editAnswers((a) => a.copyWith(subjects: known, subjectsTouched: true));
  }

  void _editAnswers(OnboardingAnswers Function(OnboardingAnswers a) change) {
    try {
      _ref.read(onboardingAnswersProvider.notifier).edit(change);
    } on Object {
      // The phone copy is a convenience; the server already has the change.
    }
  }

  Future<void> _reloadProfile() async {
    try {
      await _ref.read(authSnapshotProvider.notifier).reload();
    } on Object {
      // The server has it; the profile loads again on the next launch.
    }
  }
}

final profileEditorProvider = Provider<ProfileEditor>(ProfileEditor.new);
