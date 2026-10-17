import 'model/paper_reel_model.dart' show ReelResult;

/// Every word of the paper reel (D29). Plain, truthful, no marking wait.
abstract final class ReelCopy {
  static const kicker = 'Your paper, played back';
  static const skip = 'Skip';
  static const done = 'Done';
  static const marks = 'marks';
  static const playAgain = 'Play again';

  static String outOf(int max) => 'of $max';

  static String changedFromRight(int n) => 'Q$n: you changed a right answer to wrong.';
  static String changedToWrong(int n) => 'Q$n: you changed this answer, and it ended wrong.';

  static String stall(int n, int? sec, ReelResult result) {
    final where = sec == null ? 'Q$n: you stayed a long time here' : 'Q$n: ${duration(sec)} here';
    final end = switch (result) {
      ReelResult.right => 'It ended right.',
      ReelResult.wrong => 'It ended wrong.',
      ReelResult.blank => 'It was left blank.',
      ReelResult.held => 'Its key is being checked.',
    };
    return '$where. $end';
  }

  static String duration(int sec) {
    if (sec < 60) return '$sec s';
    final m = sec ~/ 60;
    final s = sec % 60;
    return s == 0 ? '$m min' : '$m min $s s';
  }

  static String ticker(int n, String? chapter) => chapter == null ? 'Q$n' : 'Q$n  ·  $chapter';

  static const chapterKicker = 'Most marks went in';
  static String chapterLine(int lost, int max, int wrong, int blank) {
    final parts = <String>[
      if (wrong > 0) '$wrong wrong',
      if (blank > 0) '$blank left blank',
    ];
    return '$lost of $max marks missed${parts.isEmpty ? '' : ': ${parts.join(', ')}'}.';
  }

  static const noChapter = 'Every chapter held up.';
  static String tally(int right, int wrong, int blank) => '$right right  ·  $wrong wrong  ·  $blank blank';

  static String repairChapter(int wrong, String chapter) => 'Repair the $wrong wrong in $chapter';
  static const reviewMistakes = 'Go through what you missed';
  static const nextMock = 'Take the next mock';

  // Entry points.
  static String todayTitle(int seconds) => 'Play your paper back, $seconds s';
  static String todayLine(String subject) => 'Your $subject mock, question by question: where the marks went and what to fix first.';
  static const todayKey = 'Play it back';
  static const todayLater = 'Not now';
  static const resultEntry = 'Play it back';
  static String resultEntrySub(int seconds) => 'Your paper, question by question, in $seconds s';

  static String semantics(int marks, int max, String? chapter) =>
      'Paper played back. $marks of $max marks.${chapter == null ? '' : ' Most marks went in $chapter.'}';
}
