import '../runner/nta/nta_copy.dart' show NtaRules;

/// Every word of the free exam-screen preview. The exam's own key names ("Save & Next", "Mark for
/// Review & Next") come from NtaCopy through the real widgets; these are only the preview's own.
abstract final class ExamPreviewCopy {
  // The entry under NTA mode on Practice.
  static const String entryTitle = 'See the exam screen first';
  static const String entryNote = 'Free. Fifteen sample questions, nothing scored or saved.';

  static const String screenSemantics = 'Exam screen preview';
  static const String back = 'Back to Practice';

  /// The five things to try, in the order the walk offers them.
  static const String stepAnswer = 'Pick an answer for this question.';
  static const String stepMark = 'Tap Mark for Review & Next. It shows as a purple circle in the palette.';
  static const String stepPalette = 'Open the palette to see what every question looks like.';
  static const String stepSection = 'Switch section from the tabs above.';
  static const String stepClock = 'Tap the clock to see its last minute.';

  static String triedCount(int done, int total) => '$done of $total';
  static String triedSemantics(int done, int total) => '$done of $total things tried';

  /// Shown once all five are tried: the real paper's own numbers.
  static String allTried(int total) =>
      'All $total tried. A real paper has ${NtaRules.questions} questions in ${NtaRules.minutes} minutes.';

  static const String clockTip = 'Clock. Tap to jump to the last minute, tap again to reset';

  // The end of the walk (Submit Test).
  static const String endTitle = 'Preview finished';
  static String endBody({required int answered, required int total, required int marked}) =>
      'You answered $answered of $total and marked $marked for review. On exam day this is where the paper is submitted. Here nothing is scored or saved.';
  static const String again = 'Walk through again';
}
