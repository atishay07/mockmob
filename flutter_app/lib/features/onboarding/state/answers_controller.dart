import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../data/eligibility.dart';
import '../data/subjects.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../model/deck.dart';
import 'answers_store.dart';

/// The student's sheet, saved to the phone on every change.
final onboardingAnswersProvider = AsyncNotifierProvider<AnswersController, OnboardingAnswers>(AnswersController.new);

class AnswersController extends AsyncNotifier<OnboardingAnswers> {
  @override
  Future<OnboardingAnswers> build() => ref.read(answersStoreProvider).load();

  OnboardingAnswers get _current => state.value ?? OnboardingAnswers.empty;

  Future<void> _writes = Future.value();

  void _set(OnboardingAnswers next) {
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

  void setCategory(String category) => _set(_current.copyWith(category: category));

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
}
