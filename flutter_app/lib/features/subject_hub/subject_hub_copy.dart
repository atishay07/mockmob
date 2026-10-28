import '../../core/copy/formatters.dart';

/// The words of the subject hub that are the app's own. Everything the student reads about the
/// subject itself (the introduction, the approach, the questions and answers, the previous-year
/// guide) is the website's text in `subject_hub_content.dart`.
abstract final class SubjectHubCopy {
  static const String back = 'Back to Practice';

  static String practise(String name) => 'Practise $name';

  // The record.
  static const String notPractisedTitle = 'Not practised yet';
  static const String notPractisedNote = 'Your answers will show here, chapter by chapter.';
  static const String loadingRecord = 'Reading your answers';
  static const String recordFailedTitle = 'Your answers could not be read';
  static const String recordFailedNote = 'The chapters below are the syllabus. Your accuracy comes back when the connection does.';
  static const String tryAgain = 'Try again';

  static String recordTitle(int correct, int answered) =>
      answered == 0 ? 'No answers given yet' : '$correct of $answered answers right';

  static String recordNote(int attempts, DateTime? last) {
    final base = 'From ${plural(attempts, 'attempt')}';
    return last == null ? '$base.' : '$base, the last on ${formatDayMonthShort(last)}.';
  }

  /// A saved copy is showing because the read failed: say when it is from.
  static String savedCopy(DateTime at) => 'Saved copy from ${formatTime12(at)}.';

  // Chapters.
  static const String chaptersTitle = 'Chapters';
  static const String chaptersNoneTitle = 'Chapters are not loaded yet';
  static const String chaptersNoneNote = 'They appear when the subject list reads. You can still practise the whole subject.';

  static String chaptersNote(int count, {required bool hasRecord}) => hasRecord
      ? '${plural(count, 'chapter')}. A percentage shows from $_minAnswers answers in a chapter.'
      : '${plural(count, 'chapter')}. Tap one to practise it.';

  static const int _minAnswers = 5;

  static const String chapterNotPractised = 'No answers yet';
  static const String chapterTooFew = 'Too few to rate';

  static String chapterCounts(int correct, int answered) => '$correct of $answered right';

  static String chapterBlankOnly(int blank) => 'No answers, ${plural(blank, 'question')} left blank';

  // The previous-year guide.
  static const String guideTitle = 'Previous-year questions';

  // Questions.
  static String questionsTitle(String name) => 'Questions about $name';
}
