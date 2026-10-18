import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth.dart';
import '../../../core/connectivity/connectivity.dart' show networkRestoredProvider;
import '../../../core/models/auth_me.dart' show AuthMe;
import '../../../core/models/consent.dart' show AgeBand;
import '../../../core/models/notification_prefs.dart' as prefs;
import '../../../core/repositories/repositories.dart';
import '../../../core/models/my_colleges.dart';
import '../../auth/sign_in_controller.dart' show resumeSignInSheetProvider;
import '../../rhythm/data/study_days.dart' show plannedDaysProvider;
import '../../tools/data/my_colleges_actions.dart' show MyCollegesOutcome, myCollegesActionsProvider;
import '../../tools/data/my_colleges_repository.dart' show myCollegesRepositoryProvider;
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

  /// A write failed; the sheet is still on the phone. [SheetSync] tries again on its own (after a
  /// wait, when the app comes back to the front, when the network returns), and [SheetSync.run]
  /// tries again at once.
  failed,

  /// The account already had subjects and this sheet was sealed long ago (not answers the student
  /// just gave), so nothing was overwritten. The sheet stays on the phone.
  kept,

  /// The account already had subjects, which stay as they are. The answers this onboarding just
  /// gave are the newest truth (D96 fix pass): its study days, study time and colleges replaced
  /// the older ones, and the server acknowledged every write.
  updated,
}

class SheetSyncState {
  const SheetSyncState(this.phase, {this.offline = false});

  final SheetSyncPhase phase;

  /// The failure was a lost connection.
  final bool offline;
}

/// After sign-in, writes the parts of the sheet the API supports (APP-API-CONTRACT 2.1 to 2.3):
/// the age answer (`PUT /api/me/consent`, only when the account has no age band yet), the subjects (`PATCH /api/users/{id}`,
/// only `{subjects}`), the study days (`PUT /api/me/goal`) and the study time
/// (`PUT /api/me/notification-prefs`, `studyWindow`). Course, colleges, category, confidence,
/// worry and minutes have no endpoint and stay on the phone.
///
/// A sheet belongs to one account ([OnboardingAnswers.owner]): the first account that signs in
/// claims it, and it is written only to that account. Another account on the same phone gets its
/// own sheet (see [AnswersController.takeFor]).
///
/// A new account (no subjects yet) gets everything above. An account that already has subjects
/// keeps its subjects and its consent, but the answers the student just gave win over older ones:
/// the study days goal (and the days themselves), the study time and the colleges (put first on My
/// colleges, so Today's ladder names them) are written through the same calls, and the phase is
/// [SheetSyncPhase.updated]. Only a sheet sealed within [SheetSync.freshFor] counts as just given:
/// an old sheet that comes back on this phone never overwrites what the account has now
/// ([SheetSyncPhase.kept]). "Saved" is reached only after every write is acknowledged.
final sheetSyncProvider = NotifierProvider<SheetSync, SheetSyncState>(SheetSync.new);

/// What wakes a failed sync: the app coming back to the front and the network returning. Built
/// only after a failure, so nothing is watched while there is nothing to send.
final sheetSyncWakeupsProvider = Provider.autoDispose<Stream<void>>((ref) {
  final out = StreamController<void>.broadcast();
  final life = AppLifecycleListener(onResume: () => out.add(null));
  ref.listen<AsyncValue<void>>(networkRestoredProvider, (_, _) {
    if (!out.isClosed) out.add(null);
  });
  ref.onDispose(() {
    life.dispose();
    unawaited(out.close());
  });
  return out.stream;
});

/// The waits before each automatic try after a failure. After the last one, a try comes only
/// when the app comes back to the front or the network returns (or on "Try again").
final sheetSyncRetryDelaysProvider = Provider<List<Duration>>(
  (ref) => const [Duration(seconds: 10), Duration(seconds: 30), Duration(minutes: 2), Duration(minutes: 5), Duration(minutes: 15)],
);

/// The signed-in account changed while a run was out. Nothing more is sent, and nothing is
/// shown or recorded as saved.
class _AccountChanged implements Exception {
  const _AccountChanged();
}

class SheetSync extends Notifier<SheetSyncState> {
  /// How long after sealing a sheet still counts as answers the student just gave.
  static const Duration freshFor = Duration(hours: 24);

  /// True when [a] was sealed within [freshFor] of [now].
  static bool justGiven(OnboardingAnswers a, DateTime now) {
    final at = a.sealedAt;
    if (at == null) return false;
    final age = now.difference(at);
    return age < freshFor && age > const Duration(minutes: -5);
  }

  bool _running = false;
  bool _taking = false;
  String? _keptFor;
  Timer? _retry;
  int _retries = 0;
  ProviderSubscription<Stream<void>>? _wakeups;
  StreamSubscription<void>? _wake;

  @override
  SheetSyncState build() {
    ref.onDispose(_stopRetrying);
    ref.listen(authSnapshotProvider, (previous, next) {
      final left = previous?.userId;
      if (left != next.userId) {
        _keptFor = null;
        // A result belongs to the account it ran for: the next account starts from idle, so an
        // earlier account's failure neither shows to it, nor retries for it, nor stops its own sync.
        _stopRetrying();
        _retries = 0;
        state = const SheetSyncState(SheetSyncPhase.idle);
        // Signing out on purpose takes that account's sheet off the screen, so the next student
        // on this phone never sees it. Unsent answers are put away for that account. An expired
        // session keeps the sheet where it is; it is still that account's.
        if (left != null && next.status == AuthStatus.signedOut && !next.sessionExpired) {
          unawaited(ref.read(onboardingAnswersProvider.notifier).leave(left));
        }
      }
      _maybeRun();
    });
    ref.listen(onboardingAnswersProvider, (_, _) => _maybeRun());
    scheduleMicrotask(_maybeRun);
    // Always alive at the app root: also picks up a first-sign-in sheet a killed process owed.
    ref.read(resumeSignInSheetProvider);
    return const SheetSyncState(SheetSyncPhase.idle);
  }

  void _maybeRun() {
    if (!ref.mounted || _running || _taking || state.phase == SheetSyncPhase.failed) return;
    final auth = ref.read(authSnapshotProvider);
    final answers = ref.read(onboardingAnswersProvider).value;
    final userId = auth.userId;
    if (!auth.isSignedIn || userId == null || answers == null) {
      // A run that ended without settling (signed out part way) does not leave "Saving" up.
      if (state.phase == SheetSyncPhase.saving) state = const SheetSyncState(SheetSyncPhase.idle);
      return;
    }
    // The sheet on screen is not this account's yet: claim it, or swap in this account's own.
    if (answers.owner != userId) {
      _taking = true;
      unawaited(ref.read(onboardingAnswersProvider.notifier).takeFor(userId).whenComplete(() {
        _taking = false;
        if (ref.mounted && ref.read(onboardingAnswersProvider).value?.owner == userId) _maybeRun();
      }));
      return;
    }
    if (!answers.sealed) {
      if (state.phase == SheetSyncPhase.saving) state = const SheetSyncState(SheetSyncPhase.idle);
      return;
    }
    if (answers.syncedFor == userId) {
      // An account updated this session keeps saying so (its line names what changed).
      if (state.phase != SheetSyncPhase.saved && state.phase != SheetSyncPhase.updated) {
        state = const SheetSyncState(SheetSyncPhase.saved);
      }
      return;
    }
    if (_keptFor == userId) return;
    // The copy of the profile cached on the phone cannot say the account is new: wait for the
    // server's (the auth state changes again when it arrives, and this runs again).
    if (!auth.profileFresh) return;
    unawaited(run());
  }

  /// Writes the sheet. Also the "Try again" action and the automatic retry. Only one run is out
  /// at a time: a call while one is running returns at once, so the listener, the first
  /// microtask, a retry and a tap on "Try again" never send the writes twice.
  Future<void> run() async {
    if (_running) return;
    // Claimed before the first await, so an overlapping call sees it.
    _running = true;
    _retry?.cancel();
    _retry = null;
    String? runFor;
    try {
      final auth = ref.read(authSnapshotProvider);
      OnboardingAnswers answers;
      try {
        answers = ref.read(onboardingAnswersProvider).value ?? await ref.read(onboardingAnswersProvider.future);
      } on Object {
        // The sheet on the phone could not be read; there is nothing to write yet.
        return;
      }
      final userId = auth.userId;
      if (!ref.mounted || !auth.isSignedIn || userId == null || !answers.sealed) return;
      // A sheet nobody has signed in to yet is claimed by this account first.
      if (answers.owner == null) {
        await ref.read(onboardingAnswersProvider.notifier).takeFor(userId);
        if (!ref.mounted) return;
        final claimed = ref.read(onboardingAnswersProvider).value;
        if (claimed == null) return;
        answers = claimed;
      }
      // Only the account the sheet belongs to is ever written to.
      if (answers.owner != userId || (answers.syncedFor != null && answers.syncedFor != userId)) return;
      // Never decide "new account" (or write) from the cached profile; see [_maybeRun].
      if (!auth.profileFresh) return;
      _stillSignedInAs(userId);
      runFor = userId;
      state = const SheetSyncState(SheetSyncPhase.saving);
      // An account that already has a plan keeps everything it has, its consent included.
      // "New" is decided only from the server's own profile, never from the copy cached on the
      // phone: a cached profile saved while the account had no subjects would make an account
      // that has since been set up elsewhere look new, and its plan would be written over.
      if (auth.subjects.isNotEmpty || await _serverHasPlan(userId)) {
        if (!justGiven(answers, ref.read(nowProvider)())) {
          _keptFor = userId;
          _stopRetrying();
          _settle(userId, const SheetSyncState(SheetSyncPhase.kept));
          return;
        }
        // The answers just given win over the account's older ones; its subjects and consent stay.
        await _writeWeek(userId, answers, hadPlan: true);
        await _putCollegesFirst(userId, answers);
        _stillSignedInAs(userId);
        ref.read(onboardingAnswersProvider.notifier).markSynced(userId);
        _stopRetrying();
        _retries = 0;
        _settle(userId, const SheetSyncState(SheetSyncPhase.updated));
        unawaited(_reloadProfile());
        return;
      }
      await _writeAge(userId, answers);
      await _writeProfile(userId, answers);
      // Every write went out, and was acknowledged, while this account was the one signed in.
      _stillSignedInAs(userId);
      ref.read(onboardingAnswersProvider.notifier).markSynced(userId);
      _stopRetrying();
      _retries = 0;
      _settle(userId, const SheetSyncState(SheetSyncPhase.saved));
      unawaited(_reloadProfile());
    } on _AccountChanged {
      // Not marked saved. The account signed in now gets its own sheet and its own sync.
    } on ApiError catch (e) {
      // A write the API client refused for another account's token ends here too: shown and
      // retried only while this run's account is still the one signed in.
      if (_settle(runFor, SheetSyncState(SheetSyncPhase.failed, offline: e.isOffline))) _scheduleRetry();
    } on Object {
      // Anything else (signed out part way, a reply that would not parse): not saved, and
      // "Try again" stays on screen. Only an ApiError can say the connection was lost.
      if (_settle(runFor, const SheetSyncState(SheetSyncPhase.failed))) _scheduleRetry();
    } finally {
      _running = false;
      // Another account signed in while this run was out: its own sync starts now.
      if (runFor != null && ref.mounted && ref.read(authSnapshotProvider).userId != runFor) _maybeRun();
    }
  }

  /// Throws [_AccountChanged] unless [userId] is still the signed-in account. Checked right
  /// before each write; each write also names [userId] to the API client, which refuses to send
  /// it with any other account's token (the session can change while a request waits).
  void _stillSignedInAs(String userId) {
    if (!ref.mounted) throw const _AccountChanged();
    final now = ref.read(authSnapshotProvider);
    if (!now.isSignedIn || now.userId != userId) throw const _AccountChanged();
  }

  /// Shows [next] only while [userId] is still the signed-in account. True when it did.
  bool _settle(String? userId, SheetSyncState next) {
    if (!ref.mounted || userId == null || ref.read(authSnapshotProvider).userId != userId) return false;
    state = next;
    return true;
  }

  /// After a failure: tries again after the next wait, and whenever the app comes back to the
  /// front or the network returns, until the sheet is saved or the account changes.
  void _scheduleRetry() {
    if (!ref.mounted) return;
    if (_wakeups == null) {
      final wakeups = _wakeups = ref.listen(sheetSyncWakeupsProvider, (_, _) {});
      _wake = wakeups.read().listen((_) => _retryNow());
    }
    _retry?.cancel();
    _retry = null;
    final delays = ref.read(sheetSyncRetryDelaysProvider);
    if (_retries >= delays.length) return;
    _retry = Timer(delays[_retries++], _retryNow);
  }

  void _retryNow() {
    if (!ref.mounted || _running || state.phase != SheetSyncPhase.failed) return;
    unawaited(run());
  }

  void _stopRetrying() {
    _retry?.cancel();
    _retry = null;
    unawaited(_wake?.cancel());
    _wake = null;
    _wakeups?.close();
    _wakeups = null;
  }

  /// Reads the signed-in profile from the server (one request, no retries of its own: a failure
  /// fails this run, which is retried on the usual schedule). True when it already has subjects.
  Future<bool> _serverHasPlan(String userId) async {
    _stillSignedInAs(userId);
    final response = await ref.read(apiClientProvider).get(
          '/api/auth/me',
          options: const ApiOptions(retries: 0),
          expectUserId: userId,
        );
    final me = AuthMe.fromJson(response.map);
    final user = me.user;
    // No profile in the reply: not known, so nothing is written (this run fails and retries).
    if (user == null) throw const ApiError(kind: ApiErrorKind.unknown, code: 'no_profile');
    // A profile for another account (the session changed under the request) is not this one's.
    if (user.id != userId) throw const _AccountChanged();
    _stillSignedInAs(userId);
    return user.subjects.isNotEmpty;
  }

  /// Writes the age answer only to an account whose age band is not set yet. The consent record
  /// is read from the server first: writing it blind would send usage data off and replace an
  /// age band the student already gave. A read that fails fails this run (retried later); it
  /// never falls through to a write.
  Future<void> _writeAge(String userId, OnboardingAnswers a) async {
    final age = a.age;
    if (age == null) return;
    final repo = ref.read(consentRepositoryProvider.notifier);
    if (!ref.read(consentRepositoryProvider).isLoaded) {
      _stillSignedInAs(userId);
      await repo.load();
      _stillSignedInAs(userId);
    }
    final consent = ref.read(consentRepositoryProvider);
    if (!consent.isLoaded) throw const ApiError(kind: ApiErrorKind.unknown, code: 'consent_not_loaded');
    // Set already (this answer, or one given before): the account keeps it, with its usage-data
    // choice as it is.
    if (consent.consent.ageBand != AgeBand.unknown) return;
    _stillSignedInAs(userId);
    await repo.setAgeBand(age.band, expectUserId: userId);
  }

  /// The subjects go last: an account with subjects counts as "already has a plan" on the next
  /// run, so if the goal or the study time failed first, the retry still writes them instead of
  /// keeping an account whose week the server never got.
  Future<void> _writeProfile(String userId, OnboardingAnswers a) async {
    await _writeWeek(userId, a);
    final subjects = [for (final s in a.subjects) if (s.syncs) s.id];
    if (subjects.isNotEmpty) {
      _stillSignedInAs(userId);
      await ref.read(apiClientProvider).patch('/api/users/${Uri.encodeComponent(userId)}', body: {'subjects': subjects}, expectUserId: userId);
    }
  }

  /// The study days goal and the study time, through the calls a new account's sheet uses. For an
  /// account that already had a plan ([hadPlan]) a pause it set stays, and the days chosen here
  /// replace any days picked on this phone before, so the week draws the days just given.
  Future<void> _writeWeek(String userId, OnboardingAnswers a, {bool hadPlan = false}) async {
    String? pausedUntil;
    if (hadPlan) {
      if (ref.read(goalRepositoryProvider).value == null) {
        _stillSignedInAs(userId);
        await ref.read(goalRepositoryProvider.notifier).refresh(force: true);
      }
      pausedUntil = ref.read(goalRepositoryProvider).value?.pausedUntil;
    }
    _stillSignedInAs(userId);
    await ref.read(goalRepositoryProvider.notifier).save(daysPerWeek: a.days.length.clamp(1, 7), pausedUntil: pausedUntil, expectUserId: userId);
    _stillSignedInAs(userId);
    await ref.read(notificationPrefsRepositoryProvider.notifier).update(
          studyWindow: prefs.StudyWindow(
            start: prefs.ClockTime(a.window.hour, 0),
            end: prefs.ClockTime(a.window.hour + 1, 0),
          ),
          expectUserId: userId,
        );
    if (hadPlan && a.days.isNotEmpty) {
      _stillSignedInAs(userId);
      try {
        await ref.read(plannedDaysProvider.notifier).save(a.days);
      } on Object {
        // The days live only on this phone; the goal above is what the server keeps. A days
        // store that cannot be written leaves the week drawn from the sheet (same count).
      }
    }
  }

  /// Puts the colleges picked in this onboarding at the top of My colleges, in the student's
  /// order, with the rest of the list after them (Today's ladder is the first three). Nothing is
  /// removed: a pick not on the list yet is added only while the list has room. Reads the
  /// server's own list first; a list that cannot be read or saved fails this run (retried later).
  Future<void> _putCollegesFirst(String userId, OnboardingAnswers a) async {
    final course = a.course;
    if (course == null || a.colleges.isEmpty) return;
    final picks = <MyCollege>[
      for (final name in a.colleges)
        if (course.offeringAt(name) case final o?) MyCollege(programmeId: course.id, programme: course.name, college: o.college),
    ];
    if (picks.isEmpty) return;
    var list = ref.read(myCollegesRepositoryProvider);
    if (list.value == null || list.fromCache || list.error != null) {
      _stillSignedInAs(userId);
      await ref.read(myCollegesRepositoryProvider.notifier).refresh(force: true);
      list = ref.read(myCollegesRepositoryProvider);
    }
    final shown = list.value;
    if (shown == null || list.fromCache || list.error != null) {
      final error = list.error;
      throw error is ApiError ? error : const ApiError(kind: ApiErrorKind.unknown, code: 'colleges_not_loaded');
    }
    final next = collegesWithPicksFirst(shown, picks);
    if (next == null) return;
    _stillSignedInAs(userId);
    final outcome = await ref.read(myCollegesActionsProvider.notifier).replace(next);
    switch (outcome) {
      case MyCollegesOutcome.saved:
        return;
      case MyCollegesOutcome.offline:
        throw const ApiError(kind: ApiErrorKind.network, code: 'colleges_offline');
      case MyCollegesOutcome.full:
      case MyCollegesOutcome.notLoaded:
      case MyCollegesOutcome.failed:
        throw const ApiError(kind: ApiErrorKind.unknown, code: 'colleges_not_saved');
    }
  }

  Future<void> _reloadProfile() async {
    try {
      await ref.read(authSnapshotProvider.notifier).reload();
    } on Object {
      // The profile loads again on the next launch.
    }
  }
}

/// [list] with [picks] first, in their order, then every other college as it was. A pick not on
/// the list yet is added only while there is room, so nothing already on it is ever removed.
/// Null when the list already starts that way (nothing to send).
MyColleges? collegesWithPicksFirst(MyColleges list, List<MyCollege> picks) {
  final first = <MyCollege>[];
  var room = list.max - list.colleges.length;
  for (final p in picks) {
    if (first.any(p.sameAs)) continue;
    final onList = list.colleges.where(p.sameAs).firstOrNull;
    if (onList != null) {
      first.add(onList);
    } else if (room > 0) {
      first.add(p);
      room--;
    }
  }
  if (first.isEmpty) return null;
  final ordered = [...first, for (final c in list.colleges) if (!first.any(c.sameAs)) c];
  var same = ordered.length == list.colleges.length;
  for (var i = 0; same && i < ordered.length; i++) {
    same = ordered[i].sameAs(list.colleges[i]);
  }
  return same ? null : MyColleges(colleges: ordered, max: list.max);
}
