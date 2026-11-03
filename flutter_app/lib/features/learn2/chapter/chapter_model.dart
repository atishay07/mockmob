// The rules of the Learn v2 chapter page, as plain Dart: the website's chapterModel.mjs ported function by function
// (web src/components/learn2/chapter/chapterModel.mjs; A4-chapter-run.md 3.2.1 and 3.2.4 to 3.2.6, BUILD-1101 B2 and B7), plus
// the few rules the website keeps inside ChapterPage.jsx (which piles are drawn, what a tap on one does, what the Start key
// says). No widget is built here, so unit tests and the parity test (test/fixtures/learn2/parity/chapter_model.json, written
// by tool/learn2_parity/chapter_model.mjs from the web's own module) can hold every word.
//
// Every number on the page comes from the preview answer; this file only chooses words. The web's `withFlag` (one more
// query flag on a run link) has no twin: the app's RunLaunch carries `next` and `fresh` as fields. Rounds 2 to 4 of the web
// (R2 ruling 9, R3 ruling W and X6, R4 rulings N and owner-eye#9): the words come from learn_words.dart, a chapter is named by its
// place ("Chapter 5 of 14"), the first-visit line and "No lesson yet." are gone, Start reads "Start · 10 min", the recap is a
// quiet key after the first card seen, and "First up" shows the first three real card fronts.
import 'dart:math' as math;

import '../../../core/models/json_helpers.dart';
import '../data/learn_api.dart' show LearnError, LearnErrorKind;
import '../data/learn_models.dart';
import '../data/learn_words.dart';

String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

/// The piles in the order the page draws them: the lesson first, then the cards, the questions, the mistakes.
const List<String> kPileOrder = ['lesson', 'cards', 'questions', 'mistakes'];

/// The rows of "Everything in this chapter", in the order a student reaches for them.
const List<String> kShelfOrder = ['cards', 'questions', 'mistakes', 'lesson', 'print'];

/// How one pile is drawn.
enum PileState {
  /// In the run: a count on the paper, a tick.
  inRun('in'),

  /// Left out by the student (or by the server): dimmed, "Left out", tap to put it back.
  left('left'),

  /// Held by Free until tomorrow (the day's session is used): dimmed, a dashed top edge, not a button.
  held('held');

  const PileState(this.wire);

  /// The website's word for it (`in | left | held`).
  final String wire;
}

/// One pile as the page holds it: the server's pile with the student's own left-outs applied.
class ChapterPile {
  const ChapterPile({required this.id, this.label = '', this.count = 0, this.minutes = 0, this.of, this.note, this.left = false, this.held = false});

  /// A pile as the website's model reads it (`{ id, label, count, minutes, of, note, left, held }`), for the parity test.
  factory ChapterPile.fromJson(Map<String, dynamic> j) {
    final held = j['held'];
    return ChapterPile(
      id: asString(j['id']) ?? '',
      label: asString(j['label']) ?? '',
      count: asInt(j['count']) ?? 0,
      minutes: asInt(j['minutes']) ?? 0,
      of: asInt(j['of']),
      note: _text(j['note']),
      left: asBool(j['left']) ?? false,
      held: held == true || (held is String && held.isNotEmpty),
    );
  }

  final String id;

  /// "Key cards", "Questions", "Your mistakes", "Lesson".
  final String label;
  final int count;
  final int minutes;

  /// The mistakes pile when the run takes only some of the open ones: "2" on the paper, then "of 3".
  final int? of;

  /// The server's note on the pile ("Revise first: 46 due"; shown as "46 due cards").
  final String? note;
  final bool left;
  final bool held;

  /// The pile a left-out or held flag leaves in the list (the paper stays drawn, dimmed).
  ChapterPile copyWith({bool? left, bool? held}) =>
      ChapterPile(id: id, label: label, count: count, minutes: minutes, of: of, note: note, left: left ?? this.left, held: held ?? this.held);
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}

/// What one pile shows: its [state], the [line] under its label, the "of 3" on the paper ([of]), the server's [note] and
/// the words a screen reader hears ([aria]).
class PileView {
  const PileView({required this.state, required this.line, this.of, this.note, required this.aria});

  final PileState state;
  final String line;
  final int? of;
  final String? note;
  final String aria;
}

/// One row of "Everything in this chapter".
class ShelfRowModel {
  const ShelfRowModel({required this.id, required this.title, required this.line, this.locked = false, this.link = true, this.action});

  /// `cards | questions | mistakes | lesson | print`.
  final String id;
  final String title;
  final String line;

  /// Part of Pro, and Free's: a lock beside the line.
  final bool locked;

  /// The row leads somewhere (a quiet row without a link is shown but not pressed: Free's day is used).
  final bool link;

  /// `print` on Pro's Must-know row (the website prints the watermarked sheet there; the app opens the Must-know cards); null elsewhere.
  final String? action;
}

/// The rows of the shelf. What is missing is never announced (R2 ruling 9: "No lesson yet. No open mistakes." is gone), so
/// [missing] is always null; it stays so a caller that read it keeps compiling.
class ShelfView {
  const ShelfView({required this.rows, this.missing});

  final List<ShelfRowModel> rows;
  final String? missing;
}

/// One of "First up": a real card front the run opens with.
class FirstUpCard {
  const FirstUpCard({this.id, required this.front, this.mustKnow = false});

  final String? id;
  final String front;
  final bool mustKnow;
}

/// What a tap on a pile does.
enum PileTap {
  /// A held pile is not a button.
  none,

  /// Back into the run.
  putBack,

  /// Out of the run.
  leaveOut,

  /// The last pile in cannot go: it shakes and the quiet line says why.
  refused,
}

/// The preview's states (the website's `usePreview` status).
enum ChapterReadStatus {
  /// No answer yet.
  loading,

  /// The answer is for what is asked now.
  ready,

  /// An older answer stays on screen while a new one is on its way.
  refreshing,

  /// The new answer failed: the older one stays, with a line.
  stale,

  /// No answer at all and the read failed.
  error,
}

abstract final class ChapterModel {
  /// Kept as a name only: since R2 ruling 9 the first-visit line is never shown (the run's own first card says how it works).
  static const String firstVisitLine = 'Cards and questions, one at a time. Stop whenever you like; everything you do is saved.';
  static const String onlyCardsLine = "Only Key cards here for now. This chapter's questions are still being checked.";
  static const String onlyQuestionsLine = "Only questions here for now. This chapter's Key cards are not ready yet.";
  static const String ratingsUsedLine = "You've used today's 10 free card ratings. In this session, cards show their answers but won't go into Revise.";

  /// R3 ruling W: due Key cards are never a bare "46 due"; the server's "Revise first: 46 due" reads "Revise first: 46 due cards".
  static String dueWords(String? text) => (text ?? '').replaceAllMapped(RegExp(r'\b(\d[\d,]*) due\b(?! cards?)'), (m) {
    final n = int.tryParse(m[1]!.replaceAll(',', '')) ?? 0;
    return '${m[1]} due ${n == 1 ? 'card' : 'cards'}';
  });

  /// The least and most minutes "Your own" can hold, and its step.
  static const int ownMin = 5;
  static const int ownMax = 120;
  static const int ownStep = 5;

  /// The three lengths of the segment, and the ready lengths of "Your own".
  static const List<int> lengths = [5, 10, 20];
  static const List<int> ownPresets = [30, 45, 60];
  static const int defaultMinutes = 10;

  /// A length the page offers: the link's `min`, the one kept on the phone.
  static bool validMinutes(int? m) => m != null && m >= ownMin && m <= ownMax;

  /// "35 min"; a whole hour reads "1 hour", "2 hours".
  static String minutesLabel(int m) => m >= 60 && m % 60 == 0 ? (m == 60 ? '1 hour' : '${m ~/ 60} hours') : '$m min';

  /// "Part 1, Partnership Accounts" reads "Part 1" beside the chapter ref ("Part 1, Ch 1"); a part without a number keeps
  /// its name.
  static String? partShort(String? title) {
    if (title == null || title.isEmpty) return null;
    return RegExp(r'^Part \d+').firstMatch(title)?.group(0) ?? title;
  }

  /// The eyebrow and the ref line (A4 3.2.1): the unit only when it does not repeat the title's start; the ref is the chapter's
  /// place in the roadmap, "Chapter 5 of 14" (R4 ruling N). The NCERT number ("Part 1, Ch 2") is never the label: three chapters
  /// share "Ch 2". With no `place` from the server the page draws no ref (never "Ch N").
  static ({String? eyebrow, String? ref}) headLines(LearnChapterHead? chapter) {
    if (chapter == null) return (eyebrow: null, ref: null);
    final unitTitle = chapter.unitTitle;
    final unit = unitTitle != null && unitTitle.isNotEmpty && unitTitle != chapter.title ? unitTitle : null;
    final echoes = unit != null && chapter.title.toLowerCase().startsWith(unit.toLowerCase());
    final place = LearnWords.chapterPlace(chapter.place);
    return (eyebrow: unit != null && !echoes ? unit : null, ref: place.isEmpty ? null : place);
  }

  /// The Kc state shape of a Learn chapter state (`getting_there` is a ring with a dot): the word is the first cue, the
  /// shape the second (never colour alone).
  static String stateShape(String? key) => switch (key) {
    'thin' => 'thin',
    'needs_work' => 'weak',
    'getting_there' => 'mid',
    'holding' => 'strong',
    _ => 'none',
  };

  /// A pile's minutes in words: "about 4 min"; a lesson's exact "7 min".
  static String pileMinutes(ChapterPile pile) {
    final m = pile.minutes;
    if (pile.id == 'lesson') return '${math.max(1, m)} min';
    return m >= 1 ? 'about $m min' : 'under a minute';
  }

  /// How one pile is drawn (A4 3.2.4): its state, the line under it, the "of 3" on the paper, its spoken label and the
  /// server's note ("Revise first: 46 due cards"). A held pile (Free, Key cards only today) is not a button. A mistakes pile that
  /// holds fewer than the chapter has says why ("2 fit in 10 min", R4 owner-eye#9), so its "2 of 3" never reads as a different
  /// number from the "Fix 3 open mistakes" row under it ([minutes] is the length the page asks).
  static PileView pileView(ChapterPile pile, {int? minutes}) {
    final label = pile.label;
    if (pile.held) return PileView(state: PileState.held, line: 'Back tomorrow', aria: '$label, back tomorrow');
    if (pile.left) return PileView(state: PileState.left, line: 'Tap to add it back', aria: '$label, left out. Tap to add it back');
    final of = pile.id == 'mistakes' && pile.of != null && pile.of! > pile.count ? pile.of : null;
    final line = of != null && minutes != null && minutes != 0 ? '${pile.count} fit in ${LearnWords.wholeMinutes(minutes)} min' : pileMinutes(pile);
    final note = pile.note == null ? null : dueWords(pile.note);
    return PileView(
      state: PileState.inRun,
      line: line,
      of: of,
      note: note,
      aria: '$label: ${pile.count}${of != null ? ' of $of' : ''}, $line.${note != null ? ' $note.' : ''} Tap to leave it out',
    );
  }

  /// The one quiet line under the Start key, by priority (A4 3.2.5): Free's Key-cards-only day, Free's 10-minute cap (only
  /// when more was chosen), a short chapter, Free's ratings used, one kind only; else null. The old "Ratings join Revise" note
  /// and, since R2 ruling 9, the first-visit line are never shown.
  static String? quietLine(LearnPreview? data) {
    if (data == null) return null;
    final freeText = data.free?.text;
    if (data.freeSession?.used == true && freeText != null) return freeText;
    final cappedText = data.capped?.text;
    if (cappedText != null) return cappedText;
    final shrinkText = data.shrink?.text;
    if (shrinkText != null && data.added == null) return dueWords(shrinkText);
    if (RegExp("ratings are used|used today's 10 free card ratings", caseSensitive: false).hasMatch(freeText ?? '')) return ratingsUsedLine;
    final cards = data.shelf.cards.count;
    final questions = data.shelf.questions.total;
    if (cards > 0 && questions == 0) return onlyCardsLine;
    if (cards == 0 && questions > 0) return onlyQuestionsLine;
    return null;
  }

  /// "Everything in this chapter" (A4 3.2.6): only rows that lead somewhere, with plain lines. What is missing is never announced
  /// (R2 ruling 9). Free's taste is said here only ("46 cards. 5 open on Free."). [mistakeMinutes] gives the minutes n mistakes take. The
  /// The last row is the website's "Chapter sheet" ("12 Must-know lines, with your name on it": it prints the watermarked sheet). The app
  /// builds no such sheet, so with [webSheet] false (the app's page) the row is named for what it opens, "Must-know lines", with
  /// its count as the note ("12 lines"): round 5, LK45 fix 3. The default is the web's words, which the parity test holds.
  static ShelfView shelfView(LearnPreview? data, {int Function(int n) mistakeMinutes = _same, bool webSheet = true}) {
    final shelf = data?.shelf ?? const LearnShelf();
    final isPro = !shelf.print.locked;
    final used = data?.freeSession?.used ?? false;
    final rows = <ShelfRowModel>[];
    final missing = <String>[];
    final cards = shelf.cards.count;
    if (cards > 0) {
      final open = shelf.cards.open;
      final inRevise = shelf.cards.inRevise;
      final line = !isPro && open < cards ? '${_plural(cards, 'card')}. $open open on Free.' : (inRevise > 0 ? 'All $cards, $inRevise in Revise' : 'All $cards, by section');
      rows.add(ShelfRowModel(id: 'cards', title: 'Key cards', line: line));
    } else {
      missing.add('Key cards are not ready yet.');
    }
    final questions = shelf.questions.total;
    if (questions > 0) {
      rows.add(ShelfRowModel(id: 'questions', title: 'Questions only', line: used ? '${_plural(questions, 'question')}, back tomorrow' : '${_plural(questions, 'question')} in this chapter', link: !used));
    } else {
      missing.add('Questions are still being checked.');
    }
    final lesson = shelf.lesson;
    if (lesson != null) {
      final m = lesson.minutes != null && lesson.minutes! > 0 ? lesson.minutes : null;
      final title = lesson.title;
      rows.add(ShelfRowModel(id: 'lesson', title: title != null && title.isNotEmpty ? title : 'Lesson', line: '${m != null ? LearnWords.withMinutes('Lesson', m) : 'Lesson'}, ${lesson.read ? 'read' : 'not read yet'}'));
    } else {
      missing.add('No lesson yet.');
    }
    final mistakes = shelf.mistakes.open;
    if (mistakes > 0) {
      rows.add(ShelfRowModel(id: 'mistakes', title: 'Your mistakes', line: used ? '${_plural(mistakes, 'open mistake')}, back tomorrow' : LearnWords.fixMistakes(mistakes, mistakeMinutes(mistakes)), link: !used));
    } else {
      missing.add('No open mistakes.');
    }
    final must = shelf.print.mustKnow;
    if (must > 0) {
      final locked = shelf.print.locked;
      rows.add(
        ShelfRowModel(
          id: 'print',
          title: webSheet ? 'Chapter sheet' : 'Must-know lines',
          line: locked ? 'Part of Pro' : (webSheet ? '${_plural(must, 'Must-know line')}, with your name on it' : _plural(must, 'line')),
          locked: locked,
          link: locked,
          action: locked ? null : 'print',
        ),
      );
    }
    // What is missing is collected for reading and never drawn (R2 ruling 9).
    return ShelfView(rows: _stableSorted(rows, (r) => kShelfOrder.indexOf(r.id)));
  }

  /// The chapter's verdict beside its place (R2 ruling 2): only "Needs work", and only when the server says the chapter is weak
  /// above its evidence floor (state key needs_work). Not started, Too few answers, Getting there and Holding are never shown.
  static String? chapterVerdict(LearnState? state) {
    if (state == null || state.key != 'needs_work') return null;
    return state.label.isEmpty ? 'Needs work' : state.label;
  }

  /// The quick recap as a quiet key: "Quick recap · 1 min" (the server's minutes). Null when the chapter has no Must-know line,
  /// and (R3 X6) until the student has seen at least 1 card in this chapter: a recap of what they have not met is not a recap.
  static String? recapLabel(LearnRecap? recap, {bool seen = true}) =>
      recap != null && recap.count > 0 && seen ? LearnWords.withMinutes(LearnWords.quickRecap, recap.minutes) : null;

  /// Whether the student has seen at least 1 card of this chapter: the dry run's `cardsSeen`, else (an older server) "not a first visit".
  static bool hasSeenCards(LearnPreview? data) {
    if (data == null) return false;
    final seen = data.cardsSeen;
    return seen != null ? seen > 0 : !data.firstVisit;
  }

  /// The Start key (R3 ruling W: " · N min" after a label). The server's "Start 10 minutes" becomes "Start · 10 min"; with a run to
  /// continue the new-run key is "Start fresh · 10 min". Any other server label ("Start the 7-minute lesson") is kept as it is.
  static String startKeyLabel(String? serverLabel, int minutes, {bool fresh = false}) {
    final m = RegExp(r'^Start (\d+) minutes?$').firstMatch(serverLabel ?? '');
    final int? n = m != null ? int.parse(m[1]!) : ((serverLabel == null || serverLabel.isEmpty) ? minutes : null);
    if (n != null) return LearnWords.withMinutes(fresh ? 'Start fresh' : 'Start', n);
    return fresh ? serverLabel!.replaceFirst(RegExp(r'^Start '), 'Start fresh: ') : serverLabel!;
  }

  /// The key that continues today's unfinished run: "Continue · 6 min" (R3 ruling W).
  static String continueLabel(LearnOpenRun? resume) {
    final left = resume?.minutesLeft ?? 0;
    return LearnWords.withMinutes(LearnWords.continueWord, left == 0 ? 1 : left);
  }

  /// The pile tip's storage key: once per student, so a new account on the same device sees it again.
  static String coachKeyFor(String? userId) => 'mm:learn2:coach:piles:${userId == null || userId.isEmpty ? 'anon' : userId}';

  /// The title's size step by length, so a long title keeps to 2 lines on a phone (R2 ruling 9): `m` (32), `l` (28), `xl` (25).
  static String titleSize(String? title) {
    final n = (title ?? '').length;
    return n <= 24 ? 'm' : (n <= 40 ? 'l' : 'xl');
  }

  /// "First up" (R2 ruling 9): up to 3 real card fronts from the dry run's `firstUp`, cleaned; none when there is nothing to show
  /// (the cards pile left out, or none open), so the row is not drawn.
  static List<FirstUpCard> firstUpCards(LearnPreview? data) => [
    for (final c in data?.firstUp ?? const <LearnCardFace>[])
      if ((c.front ?? '').trim().isNotEmpty) FirstUpCard(id: c.id, front: c.front!.trim(), mustKnow: c.mustKnow),
  ].take(3).toList();

  static int _same(int n) => n;

  /// Learn's one minutes rule (the web's `minutesFor`, data/learn/compose.js): seconds with the 10 percent, rounded, at least 1;
  /// nothing for no seconds.
  static int minutesFor(num seconds) => seconds > 0 ? math.max(1, (seconds * 1.1 / 60).round()) : 0;

  /// A dry run or a start that failed because the chapter is not in the book list (404 CHAPTER_NOT_FOUND). The website also
  /// reads any other 404 that is not the Learn switch as a missing chapter.
  static bool isChapterMissing(Object? error) =>
      error is LearnError &&
      (error.kind == LearnErrorKind.chapterNotFound || error.code == 'CHAPTER_NOT_FOUND' || (error.status == 404 && error.code != 'LEARN_OFF'));

  /// The piles the page draws (ChapterPage.jsx): the server's, with the student's own left-outs; a pile Free holds until
  /// tomorrow is not a button; a pile left out stays drawn (dimmed) and an empty one is not drawn; in the page's order.
  static List<ChapterPile> pilesFor(LearnPreview? data, List<String> leaveOut) {
    if (data == null) return const [];
    final used = data.freeSession?.used ?? false;
    final list = <ChapterPile>[];
    for (final p in data.piles) {
      final out = leaveOut.contains(p.id);
      final held = p.held == 'free' || (used && p.left && (p.id == 'questions' || p.id == 'mistakes') && !out);
      list.add(
        ChapterPile(
          id: p.id,
          label: p.label,
          count: p.count,
          minutes: p.minutes,
          of: asInt(p.raw['of']),
          note: _text(p.raw['note']),
          left: p.left || out,
          held: held,
        ),
      );
    }
    return _stableSorted([for (final p in list) if (p.left || p.count > 0) p], (p) => kPileOrder.indexOf(p.id));
  }

  /// What a tap on [pile] does when the page draws [piles]: a held pile nothing; a left-out pile goes back; the last pile in
  /// is refused; any other leaves the run.
  static PileTap tapOn(ChapterPile pile, List<ChapterPile> piles) {
    if (pile.held) return PileTap.none;
    if (pile.left) return PileTap.putBack;
    if (piles.where((p) => !p.left).length <= 1) return PileTap.refused;
    return PileTap.leaveOut;
  }

  /// The Start key's words for a preview: [startKeyLabel] of the server's label.
  static String startLabel(LearnPreview? data, int minutes, {bool resume = false}) => startKeyLabel(data?.startLabel, minutes, fresh: resume);

  /// Today's unfinished run of this chapter, when it has something left to do.
  static LearnOpenRun? openRun(LearnPreview? data) {
    final r = data?.resume;
    return r != null && r.done < r.of ? r : null;
  }

  /// The minutes the next chapter adds ("+3 min"): the dry run's length with it less the length without it.
  static int addedMinutes({required int? realMinutes, required int? baseMinutes}) =>
      realMinutes == null || baseMinutes == null || baseMinutes <= 0 ? 0 : math.max(0, realMinutes - baseMinutes);

  /// The piles to leave out of a run that holds only [keep] (a shelf row: Questions only, Your mistakes).
  static List<String> onlyPile(String keep) => [for (final id in const ['cards', 'questions', 'mistakes', 'lesson']) if (id != keep) id];

  /// The same list sorted by [rank], equal ranks keeping their order (Dart's own sort is not stable).
  static List<T> _stableSorted<T>(List<T> items, int Function(T item) rank) {
    final indexed = [for (var i = 0; i < items.length; i++) (i, items[i])];
    indexed.sort((a, b) {
      final c = rank(a.$2).compareTo(rank(b.$2));
      return c != 0 ? c : a.$1.compareTo(b.$1);
    });
    return [for (final e in indexed) e.$2];
  }
}
