// The words of the estimate: the two verdict words every screen shares (G18), the typed range's
// help and problems, "I don't know my range yet" and Today's range card (G19, D109), and the row on
// Your plan. Full sentences in plain English; real figures with their scale; an estimate is always
// called one, with its spread, and never a prediction of admission.

import '../../../core/copy/formatters.dart' show categoryWords;
import 'estimate.dart';

abstract final class EstimateCopy {
  // ---- Safe and in reach (one rule for the rows, the headline and Your colleges).

  static String _isAre(int n) => n == 1 ? 'is' : 'are';

  static String _parts(Reach r) => [
        if (r.safe > 0) '${r.safe} ${_isAre(r.safe)} safe',
        if (r.inReach > 0) '${r.inReach} ${_isAre(r.inReach)} in reach',
      ].join(' and ');

  /// "Of your 4 colleges, 2 are safe and 2 are in reach."
  static String yourColleges(Reach r) {
    final n = r.total;
    if (n == 0) return '';
    if (n == 1) {
      if (r.safe == 1) return 'Your college is safe.';
      if (r.inReach == 1) return 'Your college is in reach.';
      return 'Your college is not in reach yet.';
    }
    if (r.safe == n) return 'All $n of your colleges are safe.';
    if (r.inReach == n) return 'All $n of your colleges are in reach.';
    if (r.reachable == 0) return 'None of your $n colleges is in reach yet.';
    return 'Of your $n colleges, ${_parts(r)}.';
  }

  /// The same two words in a few for a row's note: "1 safe, 2 in reach", or "none in reach yet". Empty when no
  /// college has a Round 1 seat for the category (nothing to count).
  static String reachShort(Reach r) {
    if (r.total == 0) return '';
    if (r.reachable == 0) return 'none in reach yet';
    return [if (r.safe > 0) '${r.safe} safe', if (r.inReach > 0) '${r.inReach} in reach'].join(', ');
  }

  /// "Of the 54 B.Com (Hons.) colleges, 3 are safe and 5 are in reach."
  static String courseReach(Reach r, String course) {
    final n = r.total;
    if (n == 0) return '';
    if (n == 1) {
      if (r.safe == 1) return 'The one $course college is safe.';
      if (r.inReach == 1) return 'The one $course college is in reach.';
      return 'The one $course college is not in reach yet.';
    }
    if (r.safe == n) return 'All $n $course colleges are safe.';
    if (r.inReach == n) return 'All $n $course colleges are in reach.';
    if (r.reachable == 0) return 'None of the $n $course colleges is in reach yet.';
    return 'Of the $n $course colleges, ${_parts(r)}.';
  }

  /// "Your estimate puts 3 of 54 colleges here safe and 5 in reach." for a programme's page.
  static String programmeReach(Reach r) {
    final n = r.total;
    if (n == 0) return '';
    if (r.reachable == 0) return 'None of the $n colleges here is in reach yet.';
    if (r.safe == n) return 'All $n colleges here are safe.';
    if (r.inReach == n) return 'All $n colleges here are in reach.';
    return 'Of the $n colleges here, ${_parts(r)}.';
  }

  /// What the two words mean, with the student's own figures, under the headline.
  static String meaning(Estimate e, String category) => e.isPoint
      ? 'Safe means ${estimateFigure(e.low)} clears the Round 1, 2026 cutoff (${categoryWords(category)}).'
      : 'Safe means even ${estimateFigure(e.low)} clears the Round 1, 2026 cutoff (${categoryWords(category)}). '
          'In reach means ${estimateFigure(e.high)} does.';

  // ---- Typing a range.

  static const String fieldHelp = 'Type a score out of 1000, or a range like 900 to 920. Most students aren’t sure yet, and that’s fine.';
  static const String fieldNotANumber = 'Enter a number from 0 to 1000, or a range like 900 to 920.';
  static const String fieldTooWide = 'That range is wider than 200 marks, so it can’t tell you much. Try one like 850 to 950.';
  static const String fieldFromFirst = 'Type the low end of your range in From.';

  static String problem(RangeProblem p) => switch (p) {
        RangeProblem.empty => fieldFromFirst,
        RangeProblem.notANumber || RangeProblem.outOfScale => fieldNotANumber,
        RangeProblem.tooWide => fieldTooWide,
      };

  // ---- From your mocks.

  static const String mocksTruth =
      'Each figure is your raw mark out of 250, averaged over your last 3 full mocks. The range shows how far one paper usually swings.';

  // ---- "I don't know my range yet".

  static const String unknownTitle = 'I don’t know my range yet';
  static const String unknownBody =
      'Sit one full mock in each of your subjects and we’ll estimate your range from them. Today shows how far you’ve got.';
  static const String unknownRing = 'Your range shows here once you’ve sat a full mock in each subject.';

  // ---- Today's range card.

  static const String stepsTitle = 'Don’t know your score range yet?';
  static const String readyTitle = 'Your estimated range';
  static const String of1000 = 'out of 1000';
  static const String knowKey = 'I know my range';
  static const String addSubjectsKey = 'Add your subjects';
  static const String acceptKey = 'Use this as my range';
  static const String restKey = 'Sit more mocks first';
  static const String noColleges = 'Pick your colleges to see which ones this range reaches.';

  static String sitKey(String subject) => 'Sit a full $subject mock';

  // D175 (20 Oct): no full mock is called free here; the line under the key is Practice's own cost line.

  static String count(int done, int total) => '$done of $total ${total == 1 ? 'subject' : 'subjects'} done';

  /// The owner's own sentence (D109): "Sit one full mock in each subject and we'll estimate your
  /// range: English done, Accountancy done, Economics next."
  static String progressLine({required List<String> done, required String? next, required bool canTotal, required int total}) {
    const lead = 'Sit one full mock in each subject and we’ll estimate your range';
    const four = 'DU adds up four papers, a language and three subjects';
    if (next == null) {
      return canTotal ? '$lead.' : 'You’ve sat a full mock in each subject. $four, so add your other subjects and we’ll estimate your range.';
    }
    final tail = canTotal ? '' : ' $four, so add the rest of your subjects too.';
    if (done.isEmpty) {
      return total == 1 ? 'Sit one full $next mock and we’ll estimate your range.$tail' : '$lead. Start with $next.$tail';
    }
    return '$lead: ${[for (final d in done) '$d done', '$next next'].join(', ')}.$tail';
  }

  static String soFar(Estimate e) => 'Your four papers so far add up to about ${estimateRange(e)} out of 1000.';

  static String readyTruth(int mocks) =>
      'We estimated this from your ${mocks == 1 ? 'full mock' : '$mocks full mocks'}. One paper can swing either way, so it’s a range, and it gets sharper with every mock you sit.';

  // ---- Your plan's row.

  static const String planRow = 'Score range';
  static const String planNotSet = 'Not set';

  static String planNote(Estimate e) => '${estimateRange(e)} out of 1000, ${switch (e.source) {
        EstimateSource.typed => 'typed by you',
        EstimateSource.mocks => 'from your full mocks',
        EstimateSource.projection => 'from your practice projection',
      }}';

  static String planFinding(int done, int total) => 'Your full mocks will set it. You have done $done of $total subjects.';
}
