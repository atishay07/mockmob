// The words on an Explore cover: a port of the web's `coverModel.js` (src/components/learn2/feed/, the web build of
// 1 Nov 2026), kept out of the widgets so they are tested on their own. Pure functions: no widgets, no fetch. Every
// line reads the server's fields first (refLine, history, resume, the due-free studentLine) and falls back to the older
// fields (ref, partTitle, unitTitle, a studentLine with due counts), so a cover reads right before and after the
// server's newer fields. `tool/learn2_parity/cover_model.mjs` runs the web's own functions over the recorded covers
// and a set of edge covers; test/unit/learn2/explore/cover_model_parity_test.dart holds this port to every output.
//
// Rounds 2 to 4 of the web (APP-1102-A section 5): a cover is labelled by its place ("Chapter 5", never the NCERT number), its line
// is a card a student can read cold (the first of its hooks that is short and not a fill-in-the-blank), the only verdict word is
// "Needs work", question mistakes are "open mistakes", and a time after a label is " · N min" ("Play · 10 min").
//
// Copy rules (APP-1101 section 8): plain words, sentence case, no due counts on a cover, no exclamation marks, no emoji.
import '../../../core/models/json_helpers.dart' show asString;
import '../../keycards/keycards_copy.dart';
import '../data/learn_models.dart';
import '../data/learn_words.dart';

/// "For you:" and the reason after it ([prefix] is the accent-coloured part).
typedef CoverLine = ({String prefix, String text});

/// What the top of a cover shows: the feed's opening card, the locked card's face, or the questions face.
sealed class CoverMedia {
  const CoverMedia();
}

/// The first Key card its feed opens with: its front, in display type.
final class CoverMediaCard extends CoverMedia {
  const CoverMediaCard(this.text);

  final String text;

  @override
  bool operator ==(Object other) => other is CoverMediaCard && other.text == text;

  @override
  int get hashCode => text.hashCode;
}

/// A card Free cannot open: its kind ("Definition") and "Opens with a Pro card".
final class CoverMediaLocked extends CoverMedia {
  const CoverMediaLocked(this.label);

  final String label;

  @override
  bool operator ==(Object other) => other is CoverMediaLocked && other.label == label;

  @override
  int get hashCode => label.hashCode;
}

/// Only a fill-in-the-blank or a long card is left to lead with (R4 owner-eye#10): the cover says what the feed holds, "16 Key
/// cards" over "and 5 questions" (or "one at a time"), instead of an unfinished sentence.
final class CoverMediaCards extends CoverMedia {
  const CoverMediaCards({required this.text, required this.note});

  final String text;
  final String note;

  @override
  bool operator ==(Object other) => other is CoverMediaCards && other.text == text && other.note == note;

  @override
  int get hashCode => Object.hash(text, note);
}

/// The feed opens on a question: the number of questions and a note ("No Key cards here yet.").
final class CoverMediaQuestions extends CoverMedia {
  const CoverMediaQuestions({required this.text, required this.note});

  final String text;
  final String note;

  @override
  bool operator ==(Object other) => other is CoverMediaQuestions && other.text == text && other.note == note;

  @override
  int get hashCode => Object.hash(text, note);
}

/// The cover words, as static functions (the web's module).
abstract final class CoverModel {
  /// The feed lengths the control offers.
  static const List<int> lengths = [5, 10, 20];

  /// The length with no choice kept.
  static const int defaultLength = 10;

  static final RegExp _bookOrder = RegExp(r'^(chapter 1 of your book|first in the syllabus)$', caseSensitive: false);
  static final RegExp _comma = RegExp(r',\s*');
  static final RegExp _dueCount = RegExp(r'^\d[\d,]*\s+due$', caseSensitive: false);
  static final RegExp _openMistakes = RegExp(r'^(\d[\d,]*\s+open mistakes?)$', caseSensitive: false);
  static final RegExp _oldMistakeWords = RegExp(r'\bold (mistakes?)\b', caseSensitive: false);

  /// The only verdict word on a chapter is "Needs work" (R2 ruling 2): these never show on a cover.
  static final RegExp _quietVerdicts = RegExp(r'^(getting there|holding|too few answers|fading|not started|thin)$', caseSensitive: false);
  static final RegExp _notStarted = RegExp(r'^not started$', caseSensitive: false);

  /// Question mistakes are "open mistakes" everywhere (the server's feed lines may still say "old").
  static String openWords(String? text) => (text ?? '').replaceAllMapped(_oldMistakeWords, (m) => 'open ${m[1]}');

  /// The cover's label (R4 ruling N): "Chapter 5", the chapter's place among the student's playable chapters in roadmap order. The
  /// NCERT number ("Part 1, Ch 2") is never a chapter label: three chapters share "Ch 2". Null when the server sent no `place`, so a
  /// cover then draws no label at all (never "Ch N").
  static String? refLineOf(LearnCover c) {
    final short = LearnWords.chapterShort(c.place);
    return short.isEmpty ? null : short;
  }

  /// Whether the student has any history in this subject: the server's `history`, else any cover that is not "New to
  /// you".
  static bool hasHistory(LearnCovers data) {
    final sent = data.raw['history'];
    if (sent is bool) return sent;
    return data.covers.any((c) => (c.studentLine != null && c.studentLine != 'New to you') || c.resume != null || c.mistakes > 0 || c.kept > 0);
  }

  /// Free with its 20 minutes composed as 10 (the only place the server marks `capped`).
  static bool isFreePlan(LearnCovers data) => data.covers.any((c) => c.counts[20]?.capped ?? false);

  /// The lead cover's line. "For you:" only when the reason comes from the student's own history; book order reads
  /// "Start here: first in the syllabus" (never an unearned "For you").
  static CoverLine? leadLine(LearnCover c, {bool history = true}) {
    if (!c.forYou) return null;
    final reason = (c.reason ?? '').trim();
    if (!history || reason.isEmpty || _bookOrder.hasMatch(reason)) return (prefix: 'Start here:', text: 'first in the syllabus');
    return (prefix: 'For you:', text: openWords(_lowerFirst(reason)));
  }

  /// Another cover's one line: resume, else open mistakes, else "Needs work" (the only verdict word), else "New to you" for a
  /// chapter never opened; a studied chapter with nothing to say has no line. Due counts never show (a feed serves no due card).
  /// Null when the student has no history in the subject (every line would say "New to you").
  static String? studentLineOf(LearnCover c, {bool history = true}) {
    if (!history) return null;
    final resume = c.resume;
    if (resume != null && resume.of > 0) return 'You stopped at ${resume.done} of ${resume.of}';
    final raw = (c.studentLine ?? '').trim();
    final parts = [
      for (final p in raw.split(_comma))
        if (p.isNotEmpty && !_dueCount.hasMatch(p) && !_quietVerdicts.hasMatch(p)) p,
    ];
    final line = openWords(parts.join(', ')).replaceFirstMapped(_openMistakes, (m) => '${m.group(1)} to fix');
    if (line.isNotEmpty) return line;
    if (c.mistakes > 0) return '${_plural(c.mistakes, 'open mistake')} to fix';
    if (c.state.key == 'needs_work') return 'Needs work';
    if (c.state.key.isNotEmpty && c.state.key != 'none') return null;
    if (_quietVerdicts.hasMatch(raw) && !_notStarted.hasMatch(raw)) return null;
    return 'New to you';
  }

  /// The counts for the picked length (falls back to 10, then to nothing).
  static LearnCoverCount countsOf(LearnCover c, [int minutes = defaultLength]) =>
      c.counts[minutes] ?? c.counts[defaultLength] ?? LearnCoverCount(minutes: minutes);

  /// The mix line (a first visit: "Cards and questions"): "16 Key cards, 5 questions", "36 Key cards", "8 questions", "16 Key
  /// cards, that's all for today"; empty on resume (the key carries the time). Free never gets "that's all for today" (its five open
  /// cards are Free's rule, not the chapter's size). With no history in the subject it says what a feed holds in plain words, since
  /// "Key card" means nothing yet.
  static String mixLineOf(LearnCover c, int minutes, {bool free = false, bool history = true}) {
    final resume = c.resume;
    if (resume != null && resume.of > 0) return '';
    final n = countsOf(c, minutes);
    if (!history) {
      if (n.cards > 0 && n.questions > 0) return 'Cards and questions';
      if (n.cards > 0) return 'Cards, one at a time';
      if (n.questions > 0) return 'Questions, one at a time';
      return '';
    }
    final parts = [
      if (n.cards > 0) _plural(n.cards, 'Key card'),
      if (n.questions > 0) _plural(n.questions, 'question'),
    ];
    if (parts.isEmpty) return '';
    final short = !free && !n.capped && n.minutes < minutes;
    return '${parts.join(', ')}${short ? ", that's all for today" : ''}';
  }

  /// The key's words (R3 ruling W): "Start · 10 min", "Continue · 4 min" (also at Free's daily limit: the feed resumes its own
  /// run), or at Free's daily limit, for a chapter with no feed to resume, "Questions on this chapter".
  static String keyLabelOf(LearnCover c, int minutes, {bool freeDone = false}) {
    final resume = c.resume;
    if (resume != null && resume.of > 0) return LearnWords.withMinutes(LearnWords.continueWord, _minutesLeft(resume));
    if (freeDone) return 'Questions on this chapter';
    final composed = countsOf(c, minutes).minutes;
    return LearnWords.withMinutes('Start', composed == 0 ? minutes : composed);
  }

  static final RegExp _cloze = RegExp(r'_{2,}|\[\s*(?:\.{2,}|…)\s*\]|[-–]{4,}');

  /// A fill-in-the-blank card front: a run of 2 or more underscores or dashes, or "[...]", standing for the missing word.
  static bool isCloze(String? text) => _cloze.hasMatch(text ?? '');

  /// The longest front a cover sets in display type (five lines at 15 dp is the last tier, [hookTier]).
  static const int hookMax = 105;

  /// Whether a card front can be a cover's line: not a cloze, and short enough for the display type.
  static bool isReadableHook(String? front) {
    final t = (front ?? '').trim();
    return t.isNotEmpty && t.length <= hookMax && !isCloze(t);
  }

  /// The hook's size tier by length: up to 24, 48, 80, 105 characters, then longer (five lines at the smallest size).
  static String hookTier(String? text) {
    final n = (text ?? '').length;
    return n <= 24
        ? 's'
        : n <= 48
        ? 'm'
        : n <= 80
        ? 'l'
        : n <= 105
        ? 'xl'
        : 'xxl';
  }

  /// What the cover's media shows: a card a student can read cold (the first of the length's `hooks`, in feed order, then the
  /// hook, that is short and not a fill-in-the-blank), else what the feed holds ("16 Key cards" and "and 5 questions"), a card Free
  /// cannot open (its kind and "Pro card", never null), or, when the feed opens on a question, the questions face: "Your cards
  /// here are in Revise." when the chapter's cards are kept or due (so none is served in a feed), else "No Key cards here yet."
  static CoverMedia mediaOf(LearnCover c, int minutes) {
    final n = countsOf(c, minutes);
    final own = n.hook ?? c.hook;
    final lengthHooks = n.raw['hooks'] is List ? n.hooks : (c.raw['hooks'] is List ? c.hooks : const <LearnCardFace>[]);
    final candidates = [...lengthHooks, ?own];
    for (final h in candidates) {
      if (h.front != null && isReadableHook(h.front)) return CoverMediaCard(h.front!);
    }
    final h = own;
    final front = h?.front;
    if (h != null && front != null && front.isNotEmpty) {
      return CoverMediaCards(text: n.cards > 0 ? _plural(n.cards, 'Key card') : 'Key cards', note: n.questions > 0 ? 'and ${_plural(n.questions, 'question')}' : 'one at a time');
    }
    if (h != null && h.locked) return CoverMediaLocked(kindLabel(asString(h.raw['kind'])));
    final q = countsOf(c, minutes).questions > 0 ? countsOf(c, minutes).questions : countsOf(c, defaultLength).questions;
    final inRevise = c.kept > 0 || c.due > 0;
    return CoverMediaQuestions(
      text: q > 0 ? _plural(q, 'question') : 'Questions',
      note: inRevise ? 'Your cards here are in Revise.' : 'No Key cards here yet.',
    );
  }

  /// Whether a cover's key opens the chapter's own questions (Free at the day's limit, no feed of its own to pick up).
  static bool opensQuestions(LearnCover c, {bool freeDone = false}) {
    final resume = c.resume;
    return freeDone && !(resume != null && resume.of > 0);
  }

  /// The label of a card kind ("Definition"); a kind the table does not know reads "Key card".
  static String kindLabel(String? kind) {
    final label = KeyCardsCopy.kindLabel((kind ?? '').toLowerCase());
    return label == KeyCardsCopy.kindLabel('') ? 'Key card' : label;
  }

  /// "accountancy.admission-of-partner" gives "admission-of-partner"; "Admission of Partner" the same.
  static String slugOf(String? s) => (s ?? '')
      .toLowerCase()
      .replaceFirst(RegExp(r'^[a-z_]+\.'), '')
      .replaceAll('&', ' and ')
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');

  /// The syllabus chapter name (the Untimed questions Chapter filter's value) for a cover: the server's `name`, else
  /// the syllabus chapter whose slug matches the cover's key or title. Null when none matches.
  static String? chapterNameOf(LearnCover c, [List<String> names = const []]) {
    final name = c.name;
    if (name != null) return name;
    final want = {slugOf(c.key), slugOf(c.title)};
    for (final n in names) {
      if (want.contains(slugOf(n))) return n;
    }
    return null;
  }

  // ---- words ----------------------------------------------------------------------------------------------------------

  static String _lowerFirst(String s) => s.isEmpty ? s : s[0].toLowerCase() + s.substring(1);

  /// The minutes left of a feed to pick up, as the web reads them: a whole number rounded up, at least 1 (a missing or zero figure
  /// is 1).
  static int _minutesLeft(LearnOpenRun resume) {
    final sent = resume.raw['minutesLeft'];
    final n = sent is num ? sent : resume.minutesLeft;
    if (n == 0 || (n is double && n.isNaN)) return 1;
    return LearnWords.wholeMinutes(n);
  }


  /// "3 Key cards", "1 question": the figure grouped the Indian way ("1,23,456"), then the word.
  static String _plural(int n, String one, [String? many]) => '${_group(n)} ${n == 1 ? one : (many ?? '${one}s')}';

  static String _group(int n) {
    final digits = n.abs().toString();
    final sign = n < 0 ? '-' : '';
    if (digits.length <= 3) return '$sign$digits';
    final tail = digits.substring(digits.length - 3);
    var rest = digits.substring(0, digits.length - 3);
    final groups = <String>[];
    while (rest.length > 2) {
      groups.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) groups.insert(0, rest);
    return '$sign${[...groups, tail].join(',')}';
  }

  /// The figure for a count of chapters or covers ("14", "1,234"), grouped as the web groups it.
  static String grouped(int n) => _group(n);

  /// "chapter" or "chapters" after the count.
  static String chaptersText(int n) => _plural(n, 'chapter');
}
