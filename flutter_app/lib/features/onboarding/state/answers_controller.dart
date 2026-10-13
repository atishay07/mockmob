import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
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

  void _set(OnboardingAnswers next) {
    // Until the stored sheet is read, a write would replace it with what is on screen.
    if (!_readOk) return;
    // The per-student seed is picked once, with the first answer.
    if (next.seed == null) next = next.copyWith(seed: ref.read(nowProvider)().millisecondsSinceEpoch & 0x7fffffff);
    state = AsyncData(next);
    // Saved on the phone in order, in the background; a failed write is retried by the next one.
    final store = ref.read(answersStoreProvider);
    _writes = _writes.then((_) => store.save(next)).catchError((Object _) {});
  }

  /// Completes when every change so far is on the phone (tests, and before leaving the flow).
  Future<void> flushed() => _writes;

  void edit(OnboardingAnswers Function(OnboardingAnswers a) change) => _set(change(_current));

  void goTo(String step) => _set(_current.copyWith(step: step));

  void setStage(Stage stage) => _set(_current.copyWith(stage: stage).mark(Steps.stage));

  /// A course resets the college picks (they belong to the course) and, until the student
  /// edits subjects themselves, pre-ticks the subjects the course needs.
  void setCourse(String? courseId, {bool undecided = false}) {
    final a = _current;
    var next = a.copyWith(courseId: courseId, courseUndecided: undecided, colleges: const [], openToAny: false);
    if (!a.subjectsTouched) next = next.copyWith(subjects: suggestedSubjects(next.course));
    _set(undecided ? next.mark(Steps.course) : next);
  }

  /// Picks or drops a college. Up to three; a fourth is ignored (the screen says why).
  bool toggleCollege(String college) {
    final a = _current;
    final picks = [...a.colleges];
    if (picks.remove(college)) {
      _set(a.copyWith(colleges: picks));
      return true;
    }
    if (picks.length >= 3) return false;
    _set(a.copyWith(colleges: [...picks, college], openToAny: false).mark(Steps.course));
    return true;
  }

  void setOpenToAny(bool value) {
    final a = _current.copyWith(openToAny: value, colleges: value ? const [] : null);
    _set(value ? a.mark(Steps.course) : a);
  }

  /// The ladder shows only colleges that seated [category], so a pick that did not drops out:
  /// a pick the student cannot see could neither be unticked nor leave room under the cap.
  void setCategory(String category) {
    final a = _current;
    final course = a.course;
    final colleges = course == null
        ? a.colleges
        : [for (final c in a.colleges) if (course.offeringAt(c)?.scoreFor(category) != null) c];
    _set(a.copyWith(category: category, colleges: colleges));
  }

  /// Adds or removes a subject. At most [kMaxSubjects]; returns false when the cap stops it.
  bool toggleSubject(SheetSubject s) {
    final a = _current;
    final list = [...a.subjects];
    if (!list.remove(s)) {
      if (list.length >= kMaxSubjects) return false;
      list.add(s);
    }
    _set(a.copyWith(subjects: list, subjectsTouched: true));
    return true;
  }

  void setConfidence(SheetSubject s, Confidence c) {
    final a = _current;
    final list = a.subjects.contains(s) ? a.subjects : [...a.subjects, s];
    _set(a.copyWith(subjects: list, confidence: {...a.confidence, s: c}).mark(Steps.subjects));
  }

  /// Makes sure the pre-ticked subjects are on the sheet when the subjects step opens.
  void ensureSubjects() {
    final a = _current;
    if (a.subjects.isEmpty && !a.subjectsTouched) _set(a.copyWith(subjects: suggestedSubjects(a.course)));
  }

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

  void setWindow(StudyTime w) => _set(_current.copyWith(window: w));

  void confirmRhythm() => _set(_current.mark(Steps.rhythm));

  void skip(String step) => _set(_current.skip(step));

  void seal() => _set(_current.copyWith(sealedAt: ref.read(nowProvider)()).mark(Steps.plan));

  void setAge(AgeAnswer age) => _set(_current.copyWith(age: age));

  void chooseNotNow() => _set(_current.copyWith(notNow: true, step: Steps.firstMove));

  void setTonight(bool value) => _set(_current.copyWith(tonight: value));

  /// Called by the sync once every write for [userId] was acknowledged.
  void markSynced(String userId) => _set(_current.copyWith(syncedFor: userId));

  /// Takes the sheet off the phone when it was written to [userId], so the next account on this
  /// phone starts its own. Only a sheet the server already has goes; an unsent one, or one that
  /// cannot be read, stays.
  Future<void> forgetSyncedFor(String userId) async {
    if (!_readOk || state.value?.syncedFor != userId) return;
    state = const AsyncData(OnboardingAnswers.empty);
    final store = ref.read(answersStoreProvider);
    _writes = _writes.then((_) => store.clear()).catchError((Object _) {});
    await _writes;
  }
}
