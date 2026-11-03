import 'learn_models.dart' show LearnPlace;

/// The one word for each thing in Learn v2 (the web's `data/learn/words.js`, R3 ruling W, and the Free lines of
/// `data/learn/allowance.js`, ruling F): Learn home, the chapter page, Explore's covers, the run, the feed and the ends take
/// their labels from here, so a word changes in one place and the copy tests pin it once. Held to the web's own module by
/// test/unit/learn2/data/learn_words_parity_test.dart (cases written by tool/learn2_parity/words.mjs).
///
/// A time after a label is " · N min" (the middle dot is allowed for this, and only this; APP-1102-A section 0).
abstract final class LearnWords {
  /// Button "Turn over"; the first-run cue "Tap the card to turn it over".
  static const String turnOver = 'Turn over';
  static const String turnCue = 'Tap the card to turn it over';

  /// The hint on a question, shown once on the first question a student ever sees.
  static const String pickHint = 'Pick the answer you think is right.';

  /// "Continue · 6 min": the key to pick up an unfinished or stopped run, on every surface.
  static const String continueWord = 'Continue';
  static const String keepGoing = 'Keep going';
  static const String nextChapter = 'Next chapter';

  /// A Key card to Revise: "Revise later"; after the server confirms, "In Revise".
  static const String reviseLater = 'Revise later';
  static const String inRevise = 'In Revise';

  /// The head line of a run over several chapters (Revise's due cards, a Find set): no chapter, no place (round 5, LK45 fix 4).
  static const String revise = 'Revise';

  /// The first rating key (round 5, LK38): "Missed it", never "Missed" alone.
  static const String missedIt = 'Missed it';

  /// The one coach line under the rating keys, once per student, on the first card they can rate (round 5, LK38).
  static const String coachRatings = 'Missed it brings a card back soonest. Easy sends it furthest away.';

  /// A question to Saved (questions only, by design).
  static const String save = 'Save';
  static const String saved = 'Saved';

  /// Learn's level check (kind `level`).
  static const String skipKnown = 'Skip what you already know';
  static const String quickRecap = 'Quick recap';
  static const String seePro = 'See Pro';
  static const String singles = 'Answer single questions';

  /// A whole number of minutes for a label: rounded up, at least 1.
  static int wholeMinutes(num? minutes) {
    final m = minutes == null || minutes.isNaN ? 0 : minutes;
    final up = m.isInfinite ? 0 : m.ceil();
    return up < 1 ? 1 : up;
  }

  /// "Continue · 6 min": a label with its length.
  static String withMinutes(String label, num? minutes) => '$label · ${wholeMinutes(minutes)} min';

  static int _count(num? n) {
    if (n == null || n.isNaN || n.isInfinite) return 0;
    final f = n.floor();
    return f < 0 ? 0 : f;
  }

  static String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  /// "Fix 3 open mistakes · 3 min".
  static String fixMistakes(num? n, num? minutes) => withMinutes('Fix ${_plural(_count(n), 'open mistake')}', minutes);

  /// "Revise 9 due cards · 3 min" (due Key cards; never a bare "9 due").
  static String reviseDue(num? n, num? minutes) => withMinutes('Revise ${_plural(_count(n), 'due card')}', minutes);

  /// "Revise · 5 questions".
  static String reviseQuestions(num? n) => 'Revise · ${_plural(_count(n), 'question')}';

  /// "4 to revise": the Revise-later pile's label.
  static String pileLabel(num? n) => '${_count(n)} to revise';

  /// "Chapter 5 of 14": a chapter's place among the student's playable chapters; empty without one.
  static String chapterPlace(LearnPlace? place) => place == null || place.n <= 0 || place.of <= 0 ? '' : place.label;

  /// When a rated card comes back, in words (round 5, LK38), from the days FSRS gives it: under 1.5 days "tomorrow", then "in N
  /// days" to 13, "in N weeks" to 8 weeks, then "in N months". The server writes these words (`returns`); this port is held to
  /// the web's by the parity test, so the keys, the stamp and the tests cannot drift apart.
  static String returnWords(num? days) {
    final raw = days == null || days.isNaN ? 0 : days;
    final d = raw < 0 ? 0 : raw;
    if (d < 1.5) return 'tomorrow';
    final n = d.round();
    if (n <= 13) return 'in $n days';
    if (n < 56) return 'in ${_plural((n / 7).round(), 'week')}';
    return 'in ${_plural((n / 30.4).round(), 'month')}';
  }

  /// "Back tomorrow", "Back in 3 days": the stamp after a rating (the words are [returnWords]).
  static String backStamp(String words) => 'Back $words';

  /// "back tomorrow": a rating key's second line.
  static String backLine(String words) => 'back $words';

  /// The words for a Missed card: when the run also shows it again, "in this run, then tomorrow".
  static String missedWords(String scheduled, bool inRun) => inRun ? 'in this run, then $scheduled' : scheduled;

  /// "Chapter 5": the short form for tight spots.
  static String chapterShort(LearnPlace? place) => place == null || place.n <= 0 ? '' : place.short;
}

/// Free after the day's session says one thing everywhere (R3 ruling F), true to the server: a new feed is refused, a new
/// chapter run is Key cards only, Revise, the recap, the level check and today's own run stay open, single questions stay free.
abstract final class LearnFreeWords {
  static const String doneHeadline = "That was today's free session.";
  static const String doneLine = 'Questions come back tomorrow. Your Key cards stay open.';

  /// The 402's line: the headline and the line, word for word.
  static const String sessionDone = '$doneHeadline $doneLine';

  /// The one quiet line of a Free run end or feed end once the day's session is used, directly above the keys.
  static const String endLine = "$doneHeadline Questions come back tomorrow.";
  static const String capped = 'Free sessions are up to 10 minutes. Pro has any length.';
  static const String cardsOnly = "That was today's free session, so this one is Key cards only. Questions come back tomorrow.";
}
