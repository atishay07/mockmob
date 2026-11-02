// Learn home, the pure parts: how a roadmap row reads, what the sort does to the map, which units the part switch shows, what a
// shelf of cards is called and where an offer's key goes. A port of the web's learn2/home/homeModel.mjs (rounds 2 to 4) and the
// few rules of data/learn/roadmap.js it uses (coverageLine, coverageShare, verdictOf), held to the web by
// test/unit/learn2/home/home_model_parity_test.dart over every recorded home read and a set of edge inputs (the cases are
// written by tool/learn2_parity/home_model.mjs, which imports the web's own functions). No widgets in here.
//
// Not ported: matchesQuery and filterParts (the map's own filter left the page when the one search field took its place), kindWord,
// shortAction, splitTitle and pickupProgress (the suggestion tiles are gone: the roadmap's offer is the one start), visibleRefs
// and allNotStarted (a chapter is named by its place and the rows carry no state ring), searchPlaceholder (the field's words are
// the web's findHints).
import 'dart:math' as math;

import '../data/learn_models.dart';

/// A chapter of the map with the part and unit it sits in, and where it stands in book order.
class HomeFlatRow {
  const HomeFlatRow({required this.row, required this.part, required this.unit, required this.at});

  final LearnChapterRow row;
  final LearnPart part;
  final LearnPartUnit unit;
  final int at;
}

/// One entry of the sort menu.
class HomeSort {
  const HomeSort(this.id, this.label);

  final String id;
  final String label;
}

/// One of the student's sets (Find's rows): `id` is due | missed | revise, [title] its name, [name] what a screen reader hears.
class HomeShelfKey {
  const HomeShelfKey({required this.id, required this.count, required this.title, required this.name});

  final String id;
  final int count;
  final String title;
  final String name;
}

/// A roadmap row as drawn: the one coverage line, the 3 dp bar's share, the cards seen, the verdict and the chapter's real size.
class HomeRowView {
  const HomeRowView({required this.line, required this.share, required this.seen, required this.verdict, required this.total});

  final String line;
  final double share;
  final int seen;
  final String? verdict;
  final int total;
}

/// Where an offer's key goes.
sealed class HomeTarget {
  const HomeTarget();
}

/// A run it starts at once (a chapter run, a feed, a cards run, a pick-up).
class HomeRunTarget extends HomeTarget {
  const HomeRunTarget(this.run);

  final LearnRunSpec run;
}

/// An href the server wrote (the feed row, Revise).
class HomeHrefTarget extends HomeTarget {
  const HomeHrefTarget(this.href);

  final String href;
}

/// Explore (`go: 'explore'`: "Answer single questions").
class HomeExploreTarget extends HomeTarget {
  const HomeExploreTarget();
}

/// The Pro page (`go: 'pro'`: Free's "See Pro").
class HomeProTarget extends HomeTarget {
  const HomeProTarget();
}

abstract final class HomeModel {
  static String plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  /// "14 chapters · 866 Key cards · 4 lessons" (the chapters are the playable ones). A count that is 0 is not said. Never a due
  /// count: due cards are the offer's Revise row.
  static String subjectLine(LearnSubjectInfo? subject) {
    if (subject == null) return '';
    return [
      if (subject.chapters > 0) plural(subject.chapters, 'chapter'),
      if (subject.cards > 0) plural(subject.cards, 'Key card'),
      if (subject.lessons > 0) plural(subject.lessons, 'lesson'),
    ].join(' · ');
  }

  /// A chapter is on the roadmap when it has cards: coming-soon chapters and chapters with no cards are not drawn.
  static bool hasCards(LearnChapterRow row) => row.cards > 0;

  /// The parts as the roadmap draws them: only the chapters that have cards; a unit with none is dropped; a part with none is
  /// dropped unless it has an option switch (the student still picks a side, and the page says when that side has no cards yet).
  static List<LearnPart> playableParts(List<LearnPart> parts) {
    final out = <LearnPart>[];
    for (final part in parts) {
      final units = <LearnPartUnit>[];
      for (final unit in part.units) {
        final chapters = [for (final c in unit.chapters) if (hasCards(c)) c];
        if (chapters.isEmpty) continue;
        units.add(LearnPartUnit(title: unit.title, optionId: unit.optionId, chapters: chapters, raw: unit.raw));
      }
      if (units.isNotEmpty || part.option != null) {
        out.add(LearnPart(id: part.id, title: part.title, option: part.option, units: units, raw: part.raw));
      }
    }
    return out;
  }

  static const List<String> _numberWord = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

  /// "Part 2 has two options. Pick the one your school teaches." (one line above the option pills). [at] is the part's place (0-based).
  static String optionLine(LearnPart? part, [int at = 0]) {
    final n = part?.option?.choices.length ?? 0;
    final m = RegExp(r'^Part\s+(\d+)', caseSensitive: false).firstMatch(part?.title ?? '');
    final number = m?.group(1) ?? '${at + 1}';
    return 'Part $number has ${n < _numberWord.length ? _numberWord[n] : '$n'} options. Pick the one your school teaches.';
  }

  /// The one line when the picked option has no chapters with cards at all.
  static const String optionComing = 'Cards for this option are coming.';

  /// "5 Key cards free in each chapter" for the roadmap's header, said once; null on Pro. [rows] are the roadmap rows; the 5 is the
  /// open count a Free chapter carries in `progress.of`, never a row's own size.
  static String? freeEach(Iterable<LearnChapterRow> rows, bool isPro) {
    if (isPro) return null;
    var n = 0;
    for (final r in rows) {
      n = math.max(n, r.progress?.of ?? 0);
    }
    return n > 0 ? '${plural(n, 'Key card')} free in each chapter' : null;
  }

  /// The line under the part's pills while no option is saved: which option the list below really shows ("Showing Analysis of
  /// Financial Statements until you pick."). The name is the choice's own label from the data. When both options show, or one is
  /// saved, there is nothing to say. [part] holds the playable units, so an option with no cards is not among them.
  static String? impliedOptionLine(LearnPart? part, String? choice) {
    final option = part?.option;
    if (part == null || option == null || (choice != null && choice.isNotEmpty)) return null;
    final ids = <String>{
      for (final u in part.units)
        if (u.optionId != null && u.optionId!.isNotEmpty) u.optionId!,
    };
    if (ids.length != 1) return null;
    final label = option.choices.where((c) => c.id == ids.first).firstOrNull?.label;
    return label != null && label.isNotEmpty ? 'Showing $label until you pick.' : null;
  }

  /// The count at the end of a row. A chapter with no cards says so in its meta line instead.
  static String cardsText(LearnChapterRow row) => row.cards > 0 ? plural(row.cards, 'card') : '';

  /// A chapter with no cards and no questions has nothing to play.
  static bool nothingToPlay(LearnChapterRow row) => !(row.cards > 0) && !(row.questions > 0);

  /// The one meta line: the server's own when it sends one; the truthful fallback for a chapter with no cards.
  static String metaLine(LearnChapterRow row) {
    if (nothingToPlay(row)) return 'Nothing to practise here yet.';
    final meta = row.meta;
    if (meta != null && meta.isNotEmpty) return meta;
    if (!(row.cards > 0)) return 'No Key cards yet. Questions ready.';
    return '';
  }

  static String _norm(String? s) => (s ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  /// A unit heading is drawn only when it says something the chapter's own name does not.
  static String? unitHeading(LearnPartUnit unit) {
    if (unit.title.isEmpty) return null;
    if (unit.chapters.length == 1 && _norm(unit.chapters.first.title) == _norm(unit.title)) return null;
    return unit.title;
  }

  /// The part's option choice as drawn: a choice the student just tapped (held until the server agrees), else the saved one.
  static String? effectiveChoice(LearnPart part, Map<String, String> local) => local[part.id] ?? part.option?.chosen;

  /// The option units a part shows: the chosen one's, or every one while nothing is chosen.
  static List<LearnPartUnit> shownOptionUnits(List<LearnPartUnit> units, String? choice) {
    final options = [for (final u in units) if (u.optionId != null) u];
    return choice != null && choice.isNotEmpty ? [for (final u in options) if (u.optionId == choice) u] : options;
  }

  /// A signature of a set of units, so the part switch knows when what is drawn really changes.
  static String unitsSignature(List<LearnPartUnit> units) =>
      units.map((u) => '${u.optionId ?? ''}:${u.chapters.map((r) => r.key).join(',')}').join('|');

  /// Every chapter of the map in book order, each with its part and unit.
  static List<HomeFlatRow> flatRows(List<LearnPart> parts) {
    final flat = <HomeFlatRow>[];
    for (final part in parts) {
      for (final unit in part.units) {
        for (final row in unit.chapters) {
          flat.add(HomeFlatRow(row: row, part: part, unit: unit, at: flat.length));
        }
      }
    }
    return flat;
  }

  static double? _figure(LearnChapterRow row) {
    final m = row.marksOpen;
    return m != null && m.isFinite && m != 0 ? m.abs() : null;
  }

  /// Marks open: every chapter in one list, the most marks open first; chapters with no figure last, each group in book order.
  static List<HomeFlatRow> marksOrder(List<LearnPart> parts) {
    return flatRows(parts)..sort((a, b) {
      final x = _figure(a.row);
      final y = _figure(b.row);
      if (x == null && y == null) return a.at - b.at;
      if (x == null) return 1;
      if (y == null) return -1;
      final d = y.compareTo(x);
      return d != 0 ? d : a.at - b.at;
    });
  }

  /// The web's sorts. The roadmap's menu offers Book order and Needs work first only ([mapSorts]): its rows carry no due counts or
  /// marks, so a sort by them would order by something unseen.
  static const List<HomeSort> sorts = [
    HomeSort('book', 'Book order'),
    HomeSort('due', 'Due first'),
    HomeSort('needs', 'Needs work first'),
    HomeSort('marks', 'Marks open'),
  ];

  static bool hasMarks(List<LearnPart> parts) => flatRows(parts).any((f) => marksText(f.row).isNotEmpty);

  static List<HomeSort> sortsFor(List<LearnPart> parts) {
    final marks = hasMarks(parts);
    return [for (final s in sorts) if (s.id != 'marks' || marks) s];
  }

  /// The roadmap's own menu: Book order and Needs work first.
  static List<HomeSort> mapSorts(List<LearnPart> parts) => [for (final s in sortsFor(parts)) if (s.id == 'book' || s.id == 'needs') s];

  /// Needs work, Getting there, Too few answers, Not started, Holding, then unknown.
  static const Map<String, int> _needsRank = {'needs_work': 0, 'getting_there': 1, 'thin': 2, 'none': 3, 'holding': 4, 'unknown': 5};

  /// The chapters in one flat list in the chosen order. Ties keep book order.
  static List<HomeFlatRow> sortRows(List<LearnPart> parts, String sort) {
    if (sort == 'marks') return marksOrder(parts);
    final flat = flatRows(parts);
    if (sort == 'due') {
      return flat..sort((a, b) {
        var d = b.row.due - a.row.due;
        if (d != 0) return d;
        d = b.row.mistakes - a.row.mistakes;
        return d != 0 ? d : a.at - b.at;
      });
    }
    if (sort == 'needs') {
      int rank(LearnChapterRow row) => row.raw['state'] is Map ? (_needsRank[row.state.key] ?? 5) : 5;
      return flat..sort((a, b) {
        final d = rank(a.row) - rank(b.row);
        return d != 0 ? d : a.at - b.at;
      });
    }
    return flat;
  }

  static int chapterTotal(List<LearnPart> parts) => flatRows(parts).length;

  /// The chapters behind one choice of "Your part": "5 chapters", "1 chapter".
  static int optionChapterCount(List<LearnPartUnit> units, String optionId) =>
      units.where((u) => u.optionId == optionId).fold(0, (n, u) => n + u.chapters.length);

  /// "−35": the marks a chapter still has open, with a real minus sign. Empty when the server has no figure.
  static String marksText(LearnChapterRow row) {
    final m = row.marksOpen;
    if (m == null || !m.isFinite || m == 0) return '';
    final a = m.abs();
    return '−${a == a.roundToDouble() ? a.toInt().toString() : a.toString()}';
  }

  /// A name as it is read: the book's slash between two words is "and" ("Retirement/Death of a Partner"), a " / " is a
  /// comma ("Economics, Business Economics").
  static String displayTitle(String? text) => (text ?? '')
      .replaceAllMapped(RegExp(r'(\p{L})/(\p{L})', unicode: true), (m) => '${m[1]} and ${m[2]}')
      .replaceAll(RegExp(r'\s+/\s+'), ', ');

  // ---------------------------------------------------------------------------------------------------- roadmap rows

  /// "31 of 46 cards seen · 4 of 10 questions tried"; a part that is 0 says the total instead ("46 cards"), never "0 of".
  static String coverageLine({required int of, int seen = 0, int questions = 0, int tried = 0}) {
    final cards = math.max(0, of);
    final s = math.min(math.max(0, seen), cards);
    final qs = math.max(0, questions);
    final t = math.min(math.max(0, tried), qs);
    return [
      if (cards > 0) s > 0 ? '$s of ${plural(cards, 'card')} seen' : plural(cards, 'card'),
      if (qs > 0) t > 0 ? '$t of ${plural(qs, 'question')} tried' : plural(qs, 'question'),
    ].join(' · ');
  }

  /// The share of a chapter's cards seen, 0 to 1, for the 3 dp bar. Coverage, never mastery.
  static double coverageShare({required int of, int seen = 0}) => of > 0 ? math.min(1.0, seen / of) : 0.0;

  /// The one verdict word a roadmap row may carry: "Needs work", only when the chapter state is weak above its evidence floor.
  static String? verdictOf(String? stateKey) => stateKey == 'needs_work' ? 'Needs work' : null;

  /// The verdict a row carries: "Needs work" and nothing else. When the evidence is only from the student's papers
  /// (`needsWorkFrom == 'papers'`) it says so.
  static String? verdictText(LearnChapterRow? row) {
    if (row == null) return null;
    final word = row.verdict ?? verdictOf(row.state.key);
    if (word == null || word.isEmpty) return null;
    return row.needsWorkFrom == 'papers' ? '$word · from your papers' : word;
  }

  /// A roadmap row: the coverage line, the 3 dp bar's share and the verdict. The size is the chapter's real card count (`row.cards`)
  /// on Free and Pro alike: Free's open count (`progress.of`, 5) is only what it may play, so it is the header's line and never a
  /// row's total ("5 of 45 cards seen"). A row without `cards` falls back to `progress.of`. Never a zero, a % or "mastered".
  static HomeRowView roadmapRow(LearnChapterRow? row) {
    final p = row?.progress;
    if (row == null || p == null) return HomeRowView(line: '', share: 0, seen: 0, verdict: verdictText(row), total: 0);
    final total = row.cards > 0 ? row.cards : p.of;
    return HomeRowView(
      line: coverageLine(of: total, seen: p.seen, questions: p.questions, tried: p.tried),
      share: coverageShare(of: total, seen: p.seen),
      seen: math.min(math.max(0, p.seen), total),
      verdict: verdictText(row),
      total: total,
    );
  }

  /// What a screen reader hears for a row: the name, where the student is, the verdict and the coverage line.
  static String rowSpoken(LearnChapterRow row, {String? here}) {
    final view = roadmapRow(row);
    final line = view.line.isNotEmpty ? view.line : metaLine(row);
    return [displayTitle(row.title), here ?? '', view.verdict ?? '', line].where((s) => s.isNotEmpty).join('. ');
  }

  // ------------------------------------------------------------------------------------------------ the offer's keys

  /// Where a key of the offer goes: its `run`, Explore (`go: 'explore'`), the Pro page (`go: 'pro'`), else its `href`.
  static HomeTarget? target(LearnOption? option) {
    if (option == null) return null;
    final run = option.run;
    if (run != null && run.chapterKey != null) return HomeRunTarget(run);
    if (option.go == 'explore') return const HomeExploreTarget();
    if (option.go == 'pro') return const HomeProTarget();
    final href = option.href;
    if (href != null && href.isNotEmpty) return HomeHrefTarget(href);
    return null;
  }

  // ------------------------------------------------------------------------------------------------------------- Find

  /// Find with nothing typed: a few words from the book to start with, per subject (a tap searches it).
  static const Map<String, List<String>> _findHints = {
    'accountancy': ['goodwill', 'sacrificing ratio', 'revaluation', 'debentures'],
    'business_studies': ['delegation', 'marketing mix', 'planning', 'motivation'],
    'economics': ['elasticity', 'national income', 'money multiplier', 'opportunity cost'],
    'english': ['synonym', 'antonym', 'idiom', 'one word substitution'],
    'biology': ['pollination', 'DNA replication', 'Mendel', 'enzymes'],
    'political_science': ['cold war', 'federalism', 'non-aligned', 'planning commission'],
  };

  static List<String> findHints(String? subject) => _findHints[subject] ?? const [];

  static String findHintLine(String? subject) {
    final hints = findHints(subject);
    return hints.isNotEmpty ? 'Search any word from the book, like “${hints.first}”.' : 'Search any word from the book.';
  }

  /// The field's words: "Find a topic, like goodwill" (the subject's first word to try), else "Find a chapter or topic".
  static String findPlaceholder(String? subject) {
    final hints = findHints(subject);
    return hints.isNotEmpty ? 'Find a topic, like ${hints.first}' : 'Find a chapter or topic';
  }

  /// The student's own sets (Find's rows): Due today, Missed lately, In Revise, each with its count and its spoken name. A count that
  /// is 0 is never drawn (LK27: "Revise should not be 0"); with every count at 0 there are no rows at all.
  static List<HomeShelfKey> shelfKeys(LearnShelves? shelves, [String subjectName = '']) {
    if (shelves == null) return const [];
    final sub = subjectName.isEmpty ? '' : '$subjectName ';
    final due = shelves.due.count;
    final missed = shelves.missed.count;
    final revise = shelves.revise.count;
    final days = shelves.missed.days != 0 ? shelves.missed.days : 14;
    final chapters = shelves.revise.chapters;
    String cardWord(int n) => n == 1 ? 'card' : 'cards';
    return [
      HomeShelfKey(id: 'due', count: due, title: 'Due today', name: 'Due today: $due $sub${cardWord(due)}. Show them'),
      HomeShelfKey(id: 'missed', count: missed, title: 'Missed lately', name: 'Missed lately: $missed ${cardWord(missed)} in the last $days days. Show them'),
      HomeShelfKey(id: 'revise', count: revise, title: 'In Revise', name: 'In Revise: $revise ${cardWord(revise)} in ${plural(math.max(1, chapters), 'chapter')}. Show them'),
    ].where((k) => k.count > 0).toList();
  }

  /// Find with nothing typed, "Your cards": a row per set that holds cards (Due today with its minutes, Missed lately, In Revise) and
  /// the Must-know lines of the subject. Empty when every count is 0 (then the page says a word to try instead).
  static List<({String id, String title, String line})> findRows(LearnShelves? shelves) {
    final sets = shelfKeys(shelves);
    final must = shelves?.must.count ?? 0;
    final mustChapters = shelves?.must.chapters ?? 0;
    final minutes = shelves?.due.minutes ?? 0;
    return [
      for (final k in sets) (id: k.id, title: k.title, line: k.id == 'due' && minutes != 0 ? '${plural(k.count, 'card')} · about $minutes min' : plural(k.count, 'card')),
      if (must > 0) (id: 'must', title: 'Must-know lines', line: '${plural(must, 'card')} in ${plural(mustChapters != 0 ? mustChapters : 1, 'chapter')}'),
    ];
  }

  static const List<String> shelfIds = ['due', 'missed', 'revise', 'must'];

  static String? shelfFromParam(String? value) => shelfIds.contains(value) ? value : null;

  /// The name and the one line of an opened set: "Due today" / "9 cards in 3 chapters, about 2 min".
  static ({String title, String line}) setHead(String id, {int count = 0, int chapters = 0, LearnShelves? shelves}) {
    final base = '${plural(count, 'card')} in ${plural(chapters, 'chapter')}';
    switch (id) {
      case 'due':
        final minutes = shelves?.due.minutes ?? 0;
        return (title: 'Due today', line: minutes != 0 ? '$base, about $minutes min' : base);
      case 'missed':
        final days = shelves?.missed.days ?? 0;
        return (title: 'Missed lately', line: '$base, missed in the last ${days != 0 ? days : 14} days');
      case 'revise':
        return (title: 'In Revise', line: base);
      default:
        return (title: 'Must-know', line: base);
    }
  }

  /// India's calendar day (UTC+5:30), as the service counts a Free session.
  static String istDay([DateTime? now]) {
    final ist = (now ?? DateTime.now()).toUtc().add(const Duration(hours: 5, minutes: 30));
    String two(int n) => n.toString().padLeft(2, '0');
    return '${ist.year.toString().padLeft(4, '0')}-${two(ist.month)}-${two(ist.day)}';
  }
}
