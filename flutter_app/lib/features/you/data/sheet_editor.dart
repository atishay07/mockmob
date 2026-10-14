// Edits to the parts of the sheet that have no endpoint: the stage, the course and colleges with
// their category, what costs marks, and how solid each subject feels. They change the phone's
// onboarding answers (the same store Today's first move reads) and nothing else, so the screens
// word them as kept on this phone, never as saved.
import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../onboarding/data/subjects.dart' show Confidence, SheetSubject;
import '../../onboarding/model/answers.dart' show OnboardingAnswers;
import '../../onboarding/model/choices.dart' show Stage, Worry;
import '../../onboarding/model/deck.dart' show Steps;
import '../../onboarding/state/answers_controller.dart';
import 'confidence_store.dart';

/// The most colleges a sheet holds.
const int kMaxColleges = 3;

/// The course part of the sheet as it was before a course change, so the change can be undone.
@immutable
class CourseSnapshot {
  const CourseSnapshot({required this.courseId, required this.courseUndecided, required this.colleges, required this.openToAny});

  final String? courseId;
  final bool courseUndecided;
  final List<String> colleges;
  final bool openToAny;
}

class SheetEditor {
  SheetEditor(this._ref);

  final Ref _ref;

  OnboardingAnswers get current => _ref.read(onboardingAnswersProvider).value ?? OnboardingAnswers.empty;

  /// Waits for the phone's sheet to load first, so an early edit is never overwritten by the
  /// load that lands after it.
  Future<void> _edit(OnboardingAnswers Function(OnboardingAnswers a) change) async {
    try {
      await _ref.read(onboardingAnswersProvider.future);
    } on Object {
      // A failed load starts from an empty sheet, as setup does.
    }
    _ref.read(onboardingAnswersProvider.notifier).edit(change);
  }

  void setStage(Stage stage) => _edit((a) => a.copyWith(stage: stage).mark(Steps.stage));

  /// The colleges a change to [courseId] would remove: the saved ones when the course differs from
  /// the current one, none when it is the same course.
  List<String> collegesLostBy(String? courseId) {
    if (courseId == current.courseId && courseId != null) return const [];
    return [...current.colleges];
  }

  /// The course and colleges as they are now.
  CourseSnapshot courseSnapshot() {
    final a = current;
    return CourseSnapshot(courseId: a.courseId, courseUndecided: a.courseUndecided, colleges: [...a.colleges], openToAny: a.openToAny);
  }

  /// Puts the course and colleges back as they were (the undo after a course change).
  void restoreCourse(CourseSnapshot before) => _edit(
        (a) => a.copyWith(courseId: before.courseId, courseUndecided: before.courseUndecided, colleges: before.colleges, openToAny: before.openToAny),
      );

  /// A new course clears the colleges, which belong to the course. Null is "Not sure yet".
  /// Unlike setup, it never changes the subjects: those are the profile's now.
  void setCourse(String? courseId) {
    if (courseId == current.courseId && courseId != null) return;
    _edit((a) => a.copyWith(courseId: courseId, courseUndecided: courseId == null, colleges: const [], openToAny: false).mark(Steps.course));
  }

  /// Adds or drops a college. Returns false when a fourth would be added.
  bool toggleCollege(String college) {
    final picks = [...current.colleges];
    if (!picks.remove(college)) {
      if (picks.length >= kMaxColleges) return false;
      picks.add(college);
    }
    _edit((a) => a.copyWith(colleges: picks, openToAny: picks.isEmpty && a.openToAny));
    return true;
  }

  void setCategory(String category) => _edit((a) => a.copyWith(category: category));

  void setWorry(Worry worry) => _edit((a) => a.copyWith(worry: worry).mark(Steps.worry));

  /// The six setup subjects keep their confidence in the answers (Today ranks by it); the rest
  /// in the You store.
  void setConfidence(String subjectId, Confidence level) {
    final sheetSubject = SheetSubject.byId(subjectId);
    if (sheetSubject == null) {
      _ref.read(youConfidenceProvider.notifier).set(subjectId, level);
      return;
    }
    _edit((a) => a.copyWith(confidence: {...a.confidence, sheetSubject: level}));
  }
}

final sheetEditorProvider = Provider<SheetEditor>(SheetEditor.new);
