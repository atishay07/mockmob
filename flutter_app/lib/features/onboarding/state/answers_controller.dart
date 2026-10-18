import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/repositories/student_actions.dart' show onboardedThisRunProvider;
import '../data/eligibility.dart';
import '../data/subjects.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../model/deck.dart';
import 'answers_store.dart';

/// The student's sheet, saved to the phone on every change. A stored sheet that cannot be read
/// leaves this in an error ([SheetReadError]) and blocks every write until a read succeeds, so
/// it is never overwritten by an empty one. No automatic retry: [AnswersController.retry] reads
/// again when the student asks.
final onboardingAnswersProvider = AsyncNotifierProvider<AnswersController, OnboardingAnswers>(
  AnswersController.new,
  retry: (count, error) => null,
);

/// True while the newest change to the sheet could not be written to the phone (a full or
/// failing storage). The flow says so with a "Try again"; the next successful write clears it.
final onboardingSaveFailedProvider = NotifierProvider<SaveFailed, bool>(SaveFailed.new);

class SaveFailed extends Notifier<bool> {
  @override
  bool build() => false;

  /// Called by the write queue after each write.
  void report({required bool failed}) {
    if (state != failed) state = failed;
  }
}

class AnswersController extends AsyncNotifier<OnboardingAnswers> {
  /// True once the stored sheet was read (or found missing) in this build of the provider, or
  /// the student chose to start fresh over a backed-up one. Writes wait for it.
  bool _readOk = false;

  @override
  Future<OnboardingAnswers> build() async {
    _readOk = false;
    final answers = await ref.read(answersStoreProvider).load();
    _readOk = true;
    return answers;
  }

  OnboardingAnswers get _current => state.value ?? OnboardingAnswers.empty;

  Future<void> _writes = Future.value();

  /// The read error, while the stored sheet could not be read.
  SheetReadError? get readError => _readOk ? null : switch (state.error) { final SheetReadError e => e, _ => null };

  Future<OnboardingAnswers>? _retrying;

  /// Reads the stored sheet again after a failed read. Completes with the sheet, or throws the
  /// read error (the state stays an error and writes stay blocked).
  Future<OnboardingAnswers> retry() => _retrying ??= _reread().whenComplete(() => _retrying = null);

  Future<OnboardingAnswers> _reread() async {
    if (_readOk && state.hasValue) return state.requireValue;
    state = const AsyncLoading<OnboardingAnswers>();
    try {
      final answers = await ref.read(answersStoreProvider).load();
      _readOk = true;
      if (ref.mounted) state = AsyncData(answers);
      return answers;
    } on Object catch (e, st) {
      if (ref.mounted) state = AsyncError(e, st);
      rethrow;
    }
  }

  /// Starts an empty sheet over one this build cannot read, once that one is safe in
  /// [AnswersStore.backupKey]. False (and nothing changes) when it is not backed up.
  bool startFresh() {
    final error = readError;
    if (error == null) return _readOk;
    if (!error.backedUp) return false;
    _readOk = true;
    state = const AsyncData(OnboardingAnswers.empty);
    return true;
  }

  /// The way out when the stored sheet cannot be read and could not be backed up either (a
  /// full or failing phone storage), so [startFresh] and Retry would leave the student stuck.
  /// Only after the student confirmed: the unreadable sheet is given up and a new one starts.
  /// One more backup is tried first, so a sheet is kept whenever the storage allows it.
  Future<void> discardUnreadable() async {
    if (readError == null) return;
    await ref.read(answersStoreProvider).backUpStored();
    if (!ref.mounted || readError == null) return;
    _readOk = true;
    state = const AsyncData(OnboardingAnswers.empty);
  }

  void _set(OnboardingAnswers next) {
    // Until the stored sheet is read, a write would replace it with what is on screen.
    if (!_readOk) return;
    // The per-student seed is picked once, with the first answer.
    if (next.seed == null) next = next.copyWith(seed: ref.read(nowProvider)().millisecondsSinceEpoch & 0x7fffffff);
    state = AsyncData(next);
    // Saved on the phone in order, in the background; a failed write is reported (see
    // [onboardingSaveFailedProvider]) and retried by the next one, or by [retrySave].
    final store = ref.read(answersStoreProvider);
    _queue(() => store.save(next));
  }

  bool _lastSaveOk = true;

  /// Completes when every change so far has been written, with whether the newest write
  /// reached the phone. The flow waits on it before moving to the next step, and when the app
  /// goes to the background, so an answer the student saw is an answer on the phone.
  Future<bool> flushed() => _writes.then((_) => _lastSaveOk);

  /// Writes the sheet on screen again after a failed save ("Try again" on the notice).
  Future<bool> retrySave() {
    final a = state.value;
    if (!_readOk || a == null) return flushed();
    final store = ref.read(answersStoreProvider);
    _queue(() => store.save(a));
    return flushed();
  }

  void edit(OnboardingAnswers Function(OnboardingAnswers a) change) => _set(change(_current));

  void goTo(String step) => _set(_current.copyWith(step: step));

  void setStage(Stage stage) => _set(_current.copyWith(stage: stage).mark(Steps.stage));

  /// A course resets the college picks (they belong to the course) and, until the student
  /// edits subjects themselves, pre-ticks the subjects the course needs.
  void setCourse(String? courseId, {bool undecided = false}) {
    final a = _current;
    var next = a.copyWith(courseId: courseId, courseUndecided: undecided, colleges: const [], openToAny: false);
    if (!a.subjectsTouched) next = next.copyWith(subjects: neededSubjects(next.course));
    _set(undecided ? next.mark(Steps.course) : next);
  }

  /// After a pick is dropped the Aim step is no longer answered unless something still answers it
  /// (a college, "any college is fine" or "undecided"). Otherwise the step stayed marked done
  /// with nothing picked: Skip was hidden and Continue stayed off, so the student was stuck (L28).
  OnboardingAnswers _settleAim(OnboardingAnswers a) =>
      (a.colleges.isEmpty && !a.openToAny && !a.courseUndecided) ? a.copyWith(done: {...a.done}..remove(Steps.course)) : a;

  /// Picks or drops a college. Up to [kMaxColleges]; a ninth is ignored (the screen says why).
  bool toggleCollege(String college) {
    final a = _current;
    final picks = [...a.colleges];
    if (picks.remove(college)) {
      _set(_settleAim(a.copyWith(colleges: picks)));
      return true;
    }
    if (picks.length >= kMaxColleges) return false;
    _set(a.copyWith(colleges: [...picks, college], openToAny: false).mark(Steps.course));
    return true;
  }

  void setOpenToAny(bool value) {
    final a = _current.copyWith(openToAny: value, colleges: value ? const [] : null);
    _set(value ? a.mark(Steps.course) : _settleAim(a));
  }

  /// The ladder shows only colleges that seated [category], so a pick that did not drops out:
  /// a pick the student cannot see could neither be unticked nor leave room under the cap.
  void setCategory(String category) {
    final a = _current;
    final course = a.course;
    final colleges = course == null
        ? a.colleges
        : [for (final c in a.colleges) if (course.offeringAt(c)?.scoreFor(category) != null) c];
    _set(_settleAim(a.copyWith(category: category, colleges: colleges)));
  }

  /// Adds or removes a subject. At most [kMaxSubjects]; returns false when the cap stops it.
  bool toggleSubject(SheetSubject s) {
    final a = _current;
    final list = [...a.subjects];
    if (!list.remove(s)) {
      if (list.length >= kMaxSubjects) return false;
      list.add(s);
    }
    var next = a.copyWith(subjects: list, subjectsTouched: true);
    // With every subject dropped the step is unanswered again: its Skip comes back (L28).
    if (list.isEmpty) next = next.copyWith(done: {...next.done}..remove(Steps.subjects));
    _set(next);
    return true;
  }

  /// A one-tap common set: the sheet's subjects become exactly [set] (ratings already given are
  /// kept). Tapping the set that is already on clears it back to what the course needs.
  void applySubjectSet(List<SheetSubject> set) {
    final a = _current;
    final on = a.subjects.length == set.length && a.subjects.toSet().containsAll(set);
    final list = on ? neededSubjects(a.course) : set.take(kMaxSubjects).toList();
    var next = a.copyWith(subjects: list, subjectsTouched: true);
    if (list.isEmpty) next = next.copyWith(done: {...next.done}..remove(Steps.subjects));
    _set(next);
  }

  void setConfidence(SheetSubject s, Confidence c) {
    final a = _current;
    final list = a.subjects.contains(s) ? a.subjects : [...a.subjects, s];
    _set(a.copyWith(subjects: list, confidence: {...a.confidence, s: c}).mark(Steps.subjects));
  }

  /// Makes sure the pre-ticked subjects are on the sheet when the subjects step opens.
  void ensureSubjects() {
    final a = _current;
    if (a.subjects.isEmpty && !a.subjectsTouched) _set(a.copyWith(subjects: neededSubjects(a.course)));
  }

  /// Picks or drops a "where do your marks go" answer. Up to [kMaxWorries]: a fourth pick
  /// replaces the Third (never the First, which decides where the student starts) and returns
  /// the pick it replaced, so the step can name it. The step stays answered while at least one
  /// pick is left.
  Worry? toggleWorry(Worry w) {
    final a = _current;
    final list = [...a.worries];
    Worry? swapped;
    if (!list.remove(w)) {
      if (list.length >= kMaxWorries) swapped = list.removeLast();
      list.add(w);
    }
    final next = a.copyWith(worries: list);
    _set(list.isEmpty ? next.copyWith(done: {...next.done}..remove(Steps.worry)) : next.mark(Steps.worry));
    return swapped;
  }

  /// One answer as the primary (kept for callers that set a single worry).
  void setWorry(Worry w) => _set(_current.copyWith(worry: w).mark(Steps.worry));

  void recordWarmup(WarmupResult result) => _set(_current.copyWith(warmup: result).mark(Steps.question));

  void setMinutes(int m) => _set(_current.copyWith(minutes: m));

  /// Toggles a study day. At least one day always stays chosen.
  void toggleDay(int day) {
    final days = {..._current.days};
    if (!days.remove(day)) days.add(day);
    if (days.isEmpty) return;
    _set(_current.copyWith(days: days));
  }

  /// The order the "days a week" slider lights days in: Monday to Friday, then Saturday, then
  /// Sunday (D47). Lowering it unlights in the reverse order.
  static const List<int> dayOrder = [0, 1, 2, 3, 4, 5, 6];

  /// Sets how many study days a week (1 to 7), keeping the days already chosen where it can:
  /// more lights the next usual days, fewer drops the least usual ones first.
  void setDayCount(int n) {
    final want = n.clamp(1, 7);
    final days = {..._current.days};
    for (final d in dayOrder) {
      if (days.length >= want) break;
      days.add(d);
    }
    for (final d in dayOrder.reversed) {
      if (days.length <= want) break;
      days.remove(d);
    }
    if (days.length == _current.days.length && days.containsAll(_current.days)) return;
    _set(_current.copyWith(days: days));
  }

  void setWindow(StudyTime w) => _set(_current.copyWith(window: w));

  void confirmRhythm() => _set(_current.mark(Steps.rhythm));

  void skip(String step) => _set(_current.skip(step));

  void seal() {
    _set(_current.copyWith(sealedAt: ref.read(nowProvider)()).mark(Steps.plan));
    // Onboarding is finished in this run: the first-session Pro pop-up counts from here (D81).
    ref.read(onboardedThisRunProvider.notifier).sealed();
  }

  void setAge(AgeAnswer age) => _set(_current.copyWith(age: age));

  void chooseNotNow() => _set(_current.copyWith(notNow: true, step: Steps.firstMove));

  void setTonight(bool value) => _set(_current.copyWith(tonight: value));

  /// Called by the sync once every write for [userId] was acknowledged.
  void markSynced(String userId) => _set(_current.copyWith(syncedFor: userId));

  /// Makes the sheet on screen [userId]'s, run when that account is signed in.
  ///
  /// - A sheet nobody has signed in to yet is claimed by this account. When it is blank and this
  ///   account has a sheet put away on this phone, that one comes back instead.
  /// - Another account's sheet is never this account's: it is put away for its owner (or, when it
  ///   is already on that account, leaves the phone), and this account gets its own put-away sheet
  ///   back, or starts a new one.
  ///
  /// Nothing happens while the stored sheet cannot be read.
  ///
  /// A change made while the hand-over waits on the phone's storage (a tap on the step still on
  /// screen) does not stop it: the hand-over decides again with the changed sheet, which is put
  /// away for its owner, so the signed-in account never keeps the previous one's sheet.
  Future<void> takeFor(String userId) async {
    final store = ref.read(answersStoreProvider);
    for (var attempt = 0; attempt < _takeAttempts; attempt++) {
      final a = state.value;
      if (!ref.mounted || !_readOk || a == null || a.owner == userId) return;
      final now = ref.read(nowProvider)();
      if (a.owner == null && !a.blank) {
        _set(a.copyWith(owner: userId));
        // A finished sheet made since replaces the one this account had put away.
        if (a.sealed) _queue(() => store.dropParked(userId, now));
        return;
      }
      await _writes;
      final OnboardingAnswers? own;
      try {
        own = await store.parked(userId, now);
        // The leaving sheet is safely put away before anything replaces it. If that write
        // fails, nothing changes and the next change tries again.
        if (identical(state.value, a)) await _putAway(a, store, now);
      } on Object {
        return;
      }
      if (!ref.mounted || !_readOk) return;
      // Something changed the sheet meanwhile: decide again with the sheet as it is now.
      if (!identical(state.value, a)) continue;
      // A blank sheet nobody owned keeps its place in the deck; another account's starts over.
      final next = own ?? (a.owner == null ? a : OnboardingAnswers.empty).copyWith(owner: userId);
      state = AsyncData(next);
      _queue(() => store.save(next));
      if (own != null) _queue(() => store.dropParked(userId, now));
      await _writes;
      return;
    }
  }

  /// How many times [takeFor] decides again when the sheet keeps changing under it.
  static const int _takeAttempts = 5;

  /// Takes the sheet off the screen when [userId] signs out on purpose, so the next student on
  /// this phone starts their own. Unsent answers are put away for [userId] until it signs in
  /// again (or [AnswersStore.parkedFor] passes); a sheet already on that account leaves the phone.
  /// When putting it away fails, the sheet stays as it is: it is still [userId]'s, so no other
  /// account is given it (see [takeFor]).
  Future<void> leave(String userId) async {
    final a = state.value;
    if (!_readOk || a == null || a.owner != userId) return;
    final store = ref.read(answersStoreProvider);
    try {
      await _writes;
      await _putAway(a, store, ref.read(nowProvider)());
    } on Object {
      return;
    }
    if (!ref.mounted || !identical(state.value, a) || !_readOk) return;
    state = const AsyncData(OnboardingAnswers.empty);
    _queue(store.clear);
    await _writes;
  }

  /// Removes [userId]'s sheet from the phone when its account is being deleted: the sheet on
  /// screen (when it is that account's) and any copy put away for it. Unlike [leave], nothing is
  /// kept for a later sign-in. Call it before the sign-out, so the sign-out has nothing of that
  /// account's to put away. Throws when the put-away copy could not be removed.
  Future<void> discard(String userId) async {
    final store = ref.read(answersStoreProvider);
    try {
      // The stored sheet is read first, so one that has not loaded yet is removed too.
      await future;
    } on Object {
      // Unreadable: handled below.
    }
    await _writes;
    await store.dropParked(userId, ref.read(nowProvider)());
    final a = state.value;
    // A sheet that could not be read stays as it is (its backup is the student's to recover).
    if (!ref.mounted || !_readOk || a == null || a.owner != userId) return;
    state = const AsyncData(OnboardingAnswers.empty);
    _queue(store.clear);
    await _writes;
  }

  /// Puts [a] away for its owner, unless it is blank, has no owner, or is already on its account.
  Future<void> _putAway(OnboardingAnswers a, AnswersStore store, DateTime now) async {
    if (a.owner == null || a.blank || a.syncedFor == a.owner) return;
    await store.park(a, now);
  }

  void _queue(Future<void> Function() write) {
    _writes = _writes.then((_) => write()).then(
      (_) => _reportSave(ok: true),
      onError: (Object _) => _reportSave(ok: false),
    );
  }

  void _reportSave({required bool ok}) {
    _lastSaveOk = ok;
    if (ref.mounted) ref.read(onboardingSaveFailedProvider.notifier).report(failed: !ok);
  }
}
