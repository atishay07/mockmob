/// The study stage's text rules, a port of the website's `src/components/learn2/stage/stageText.mjs` and of
/// `stemParts` in `src/components/learn2/run/runMath.js` (web commit 4bba8db6f). Pure, so tests hold them:
/// `test/unit/learn2/stage/stage_text_parity_test.dart` checks every function against what the web's own code
/// returns for the 53 fixture questions and a set of edge strings (`test/fixtures/learn2/parity/stage_text.json`,
/// written by `tool/learn2_parity/stage_text.mjs`).
///
/// Everything lives on [StageText] so the names never meet `plural` (core/copy) or `chapterRef` (Key cards).
library;

/// One numbered or lettered line of a stem: `(A) Record the goodwill`, `Statement II: ...`.
typedef StageListItem = ({String label, String text});

/// An Assertion-Reason stem as its two parts.
typedef StageAssertion = ({String assertion, String reason});

/// A "match List-I with List-II" stem: the lead-in, the two lists and the ask that closes it.
typedef StageMatchLists = ({String lead, List<StageListItem> one, List<StageListItem> two, String tail});

/// A "Statement I / II / III" stem: the lead-in, the statements and the ask.
typedef StageStatements = ({String lead, List<StageListItem> items, String tail});

/// A stem that lists its steps inline: the lead-in, the steps and the ask.
typedef StageStemParts = ({String lead, List<StageListItem> steps, String tail});

/// An answer option as served: its key and its words (the letters on screen are drawn A, B, C...).
typedef StageOption = ({String key, String text});

abstract final class StageText {
  static final RegExp _spaces = RegExp(r'\s+');

  /// `plural`: "1 card", "3 cards".
  static String plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  /// `frontSize`: the front's size step by its length in characters: 's' up to 60, 'm' up to 120, 'l' longer.
  static String frontSize(String? text) {
    final n = (text ?? '').replaceAll(_spaces, ' ').trim().length;
    return n <= 60 ? 's' : (n <= 120 ? 'm' : 'l');
  }

  /// `backSize`: the back's size step: its characters plus 12 per line break; 's' to 110, 'm' to 200, 'l' to
  /// 320, 'xl' longer.
  static String backSize(String? text) {
    final s = text ?? '';
    final n = s.length + 12 * '\n'.allMatches(s).length;
    return n <= 110 ? 's' : (n <= 200 ? 'm' : (n <= 320 ? 'l' : 'xl'));
  }

  /// `speakable`: a front read aloud, where a blank reads "blank".
  static String speakable(String? text) => (text ?? '').replaceAll(RegExp(r'_{3,}'), 'blank').replaceAll(_spaces, ' ').trim();

  static String _keyOnly(String key) => key.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');

  static RegExp _keyPattern(String key) {
    final k = _keyOnly(key);
    return RegExp('^\\(?$k[).:-]\\s*|^$k\\s+(?=\\S)');
  }

  /// `optionTexts`: the options' words. A leading letter ("A. Sacrifice ratio", "(B) Nil") is stripped only
  /// when EVERY option carries its own key that way, so an option that starts with the article "A" keeps it.
  static List<String> optionTexts(List<StageOption> options) {
    final every = options.isNotEmpty &&
        options.every((o) => o.key.isNotEmpty && _keyPattern(o.key).hasMatch(o.text.trim()) && o.text.trim().length > o.key.length + 1);
    return [
      for (final o in options) every ? o.text.trim().replaceFirst(_keyPattern(o.key), '').trim() : o.text.trim(),
    ];
  }

  /// `twoColumns`: two option columns on wide screens when every option is 28 characters or fewer.
  static bool twoColumns(List<String> texts) => texts.length >= 2 && texts.length <= 4 && texts.every((t) => t.length <= 28);

  static final RegExp _assertion = RegExp(
    r'^\s*Assertion\s*(\(A\))?\s*:\s*(.+?)\s*Reason\s*(\(R\))?\s*:\s*(.+)$',
    caseSensitive: false,
    dotAll: true,
  );

  /// `assertionReason`: an Assertion-Reason stem as two parts, else null. A trailing instruction stays with the
  /// reason; the options say the rest.
  static StageAssertion? assertionReason(String? stem) {
    final m = _assertion.firstMatch(stem ?? '');
    if (m == null) return null;
    return (assertion: m.group(2)!.trim(), reason: m.group(4)!.trim());
  }

  static List<StageListItem> _listItems(String text, String labels) {
    final marks = RegExp('\\(($labels)\\)\\s*').allMatches(text).toList();
    return [
      for (final (i, m) in marks.indexed)
        (label: m.group(1)!, text: text.substring(m.end, i + 1 < marks.length ? marks[i + 1].start : text.length).trim()),
    ].where((x) => x.text.isNotEmpty).toList();
  }

  static final RegExp _headOne = RegExp(r'\bList[\s-]*(?:I|1)\b\s*:?\s*(?=\(A\))', caseSensitive: false);
  static final RegExp _headTwo = RegExp(r'\bList[\s-]*(?:II|2)\b\s*:?\s*(?=\((?:I|1|P)\))', caseSensitive: false);
  static final RegExp _matchAsk = RegExp(r'^(.*?)\s*((?:Choose|Select|Pick|Identify|Match)\b[^()]*)$', caseSensitive: false);

  /// `matchLists`: a "match List-I with List-II" stem as two lists, else null. CUET prints both lists inline
  /// ("... List-I (A) ... (D) ... List-II (I) ... (IV) ... Choose the correct answer ..."); set as lists they read.
  static StageMatchLists? matchLists(String? stem) {
    final s = (stem ?? '').replaceAll(_spaces, ' ').trim();
    final a = _headOne.firstMatch(s)?.start ?? -1;
    final b = _headTwo.firstMatch(s)?.start ?? -1;
    if (a < 0 || b < a) return null;
    final lead = s.substring(0, a).trim();
    final listOne = s.substring(a, b).replaceFirst(_headOne, '');
    var rest = s.substring(b).replaceFirst(_headTwo, '');
    var tail = '';
    final ask = _matchAsk.firstMatch(rest);
    if (ask != null) {
      rest = ask.group(1)!;
      tail = ask.group(2)!.trim();
    }
    final one = _listItems(listOne, '[A-F]');
    final two = _listItems(rest, 'IV|VI|V|I{1,3}|[1-6]|[P-T]');
    if (one.length < 2 || two.length < 2) return null;
    return (lead: lead, one: one, two: two, tail: tail);
  }

  static final RegExp _statement = RegExp(r'Statement\s+(I{1,3}|IV|V|[1-5])\s*[:.–-]\s*');
  static final RegExp _statementAsk = RegExp(r'(?<=[.?!:])\s+(?=(?:Choose|Which|Select|Pick|Identify)\b)');

  /// `statementList`: a "Statement I / Statement II / Statement III" stem as a list, else null. The lead is what
  /// comes before the first statement; the tail is the ask that closes the last one. Two or more are needed.
  static StageStatements? statementList(String? stem) {
    final s = (stem ?? '').replaceAll(_spaces, ' ').trim();
    final marks = _statement.allMatches(s).toList();
    if (marks.length < 2) return null;
    final texts = [
      for (final (i, m) in marks.indexed) s.substring(m.end, i + 1 < marks.length ? marks[i + 1].start : s.length).trim(),
    ];
    var tail = '';
    final ask = _statementAsk.firstMatch(texts.last);
    if (ask != null) {
      tail = texts.last.substring(ask.start).trim();
      texts[texts.length - 1] = texts.last.substring(0, ask.start).trim();
    }
    if (texts.any((t) => t.isEmpty)) return null;
    return (
      lead: s.substring(0, marks.first.start).trim(),
      items: [for (final (i, m) in marks.indexed) (label: m.group(1)!, text: texts[i])],
      tail: tail,
    );
  }

  /// `stemSize`: the stem's size step: 's' up to 200 characters, else 'l'.
  static String stemSize(String? stem) => (stem ?? '').length <= 200 ? 's' : 'l';

  /// `doneLine`: the end's done line, "All 21 done in 9 min." / "You stopped at 8 of 21."; null without a total.
  static String? doneLine({int reached = 0, int of = 0, num? minutes}) {
    if (of == 0) return null;
    final m = minutes;
    final mins = m != null && m.isFinite && m > 0 ? (m.round() < 1 ? 1 : m.round()) : null;
    if (reached >= of) return mins != null ? 'All $of done in $mins min.' : 'All $of done.';
    return 'You stopped at ${reached < 0 ? 0 : reached} of $of.';
  }

  /// `timeLeft`: "About 6 min left" / "Under a minute left" from seconds (Learn's one minutes rule: the 10
  /// percent, rounded, at least 1); null for nothing left.
  static String? timeLeft(num? seconds) {
    final s = seconds == null || !seconds.isFinite ? 0 : seconds;
    if (s <= 0) return null;
    if (s * 1.1 < 60) return 'Under a minute left';
    final m = (s * 1.1 / 60).round();
    return 'About ${m < 1 ? 1 : m} min left';
  }

  /// `chapterRef`: the book line of a chapter, "Ch 4, Accountancy Part 1" (either part may be missing); null
  /// when both are. The part title is left out when it is only the chapter's title again.
  static String? chapterRef({String? ref, String? partTitle, String? title}) {
    final parts = [
      if (ref != null && ref.isNotEmpty) ref,
      if (partTitle != null && partTitle.isNotEmpty && partTitle != title) partTitle,
    ];
    return parts.isEmpty ? null : parts.join(', ');
  }

  static const List<List<String>> _stepRuns = [
    ['A', 'B', 'C', 'D', 'E', 'F'],
    ['a', 'b', 'c', 'd', 'e', 'f'],
    ['i', 'ii', 'iii', 'iv', 'v', 'vi'],
    ['1', '2', '3', '4', '5', '6'],
  ];
  static final RegExp _stepMark = RegExp(r'\(((?:[A-Fa-f]|i{1,3}|iv|vi?|[1-6]))\)\s');
  static final RegExp _stepAsk = RegExp(r'^(.*?[.;:])\s+((?:Choose|Select|Identify|Pick|Find|Mark|Which|What|Arrange|Give)\b.*)$');

  /// `stemParts` (runMath.js): a stem that lists its steps inline ("Arrange ...: (A) Record ... (B) Record ...
  /// (C) ... Choose the correct sequence.") split so the steps show as a list. Null when it is not a clean list:
  /// fewer than three steps, steps out of order, or a step label used again after the list.
  static StageStemParts? stemParts(String? body) {
    final s = (body ?? '').replaceAll(_spaces, ' ').trim();
    if (s.isEmpty) return null;
    final marks = _stepMark.allMatches(s).toList();
    for (final seq in _stepRuns) {
      final start = marks.indexWhere((x) => x.group(1) == seq[0]);
      if (start < 0) continue;
      final run = <RegExpMatch>[];
      for (var i = start; i < marks.length && run.length < seq.length && marks[i].group(1) == seq[run.length]; i++) {
        run.add(marks[i]);
      }
      if (run.length < 3 || marks.length != start + run.length) continue;
      final texts = [
        for (final (i, x) in run.indexed) s.substring(x.end, i + 1 < run.length ? run[i + 1].start : s.length).trim(),
      ];
      var tail = '';
      final last = _stepAsk.firstMatch(texts.last);
      if (last != null) {
        texts[texts.length - 1] = last.group(1)!.trim();
        tail = last.group(2)!.trim();
      }
      if (texts.any((t) => t.isEmpty)) continue;
      return (
        lead: s.substring(0, run.first.start).trim(),
        steps: [for (final (i, x) in run.indexed) (label: x.group(1)!, text: texts[i])],
        tail: tail,
      );
    }
    return null;
  }

  /// The letter drawn for option [index] (A, B, C...), or [fallback] past F.
  static String letterAt(int index, String fallback) => index >= 0 && index < 6 ? 'ABCDEF'[index] : fallback;

  /// `letterOf` (Question.jsx): the answer's letter as drawn, from the served options.
  static String letterOf(List<StageOption> options, String key) => letterAt(options.indexWhere((o) => o.key == key), key);
}
