// Learn home, the pure parts: how a chapter row reads, what the sort does to the map, which units the part switch shows,
// how a suggestion splits into words and what a shelf tile says. A port of the web's learn2/home/homeModel.mjs, held to it
// by test/unit/learn2/home/home_model_parity_test.dart over every recorded subject and a set of edge inputs (the cases are
// written by tool/learn2_parity/home_model.mjs, which imports the web's own functions). No widgets in here.
//
// Not ported: matchesQuery and filterParts (the map's own filter left the page when the one search field took its place),
// kindWord (the kind line above a suggestion is gone) and shortAction (a phone shows the whole label).
import '../../../core/models/json_helpers.dart';
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

/// One of the three shelf tiles: `id` is due | missed | revise, [zero] a true zero (drawn, quiet), [name] what a screen
/// reader hears.
class HomeShelfKey {
  const HomeShelfKey({required this.id, required this.count, required this.label, required this.zero, required this.name});

  final String id;
  final int count;
  final String label;
  final bool zero;
  final String name;
}

/// Where a suggestion's key goes: a run it starts at once, or an href the server wrote.
sealed class HomeTarget {
  const HomeTarget();
}

class HomeRunTarget extends HomeTarget {
  const HomeRunTarget(this.run);

  final LearnRunSpec run;
}

class HomeHrefTarget extends HomeTarget {
  const HomeHrefTarget(this.href);

  final String href;
}

abstract final class HomeModel {
  /// The ring beside a state word: the word is the first cue, the shape the second (never colour alone).
  static const Map<String, String> _shape = {
    'none': 'none',
    'thin': 'thin',
    'needs_work': 'weak',
    'getting_there': 'mid',
    'holding': 'strong',
    'unknown': 'unknown',
  };

  static String stateShape(String? key) => _shape[key] ?? 'none';

  static String plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  /// "868 Key cards, 14 chapters, 4 lessons". A count that is 0 is not said.
  static String subjectLine(LearnSubjectInfo? subject) {
    if (subject == null) return '';
    return [
      if (subject.cards > 0) plural(subject.cards, 'Key card'),
      if (subject.chapters > 0) plural(subject.chapters, 'chapter'),
      if (subject.lessons > 0) plural(subject.lessons, 'lesson'),
    ].join(', ');
  }

  /// The count at the end of a row. A chapter with no cards says so in its meta line instead.
  static String cardsText(LearnChapterRow row) => row.cards > 0 ? plural(row.cards, 'card') : '';

  /// A chapter with no cards and no questions has nothing to play: its row says so and is drawn in ink-2.
  static bool nothingToPlay(LearnChapterRow row) => !(row.cards > 0) && !(row.questions > 0);

  /// The one meta line: the server's own when it sends one, the truthful fallback for a chapter with no cards.
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

  /// The map's sorts. "Marks open" is offered only when at least one chapter carries a figure.
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

  /// The reference ("Ch 1") each row shows. The app splits NCERT chapters into topics, so a reference repeats down a unit; it
  /// is drawn only where it differs from the row above. [always] (a sorted list, where the row above is somebody else's)
  /// draws every one.
  static List<String> visibleRefs(List<LearnChapterRow> rows, {bool always = false}) {
    String? prev;
    final out = <String>[];
    for (final row in rows) {
      final ref = row.ref ?? '';
      out.add(ref.isNotEmpty && (always || ref != prev) ? ref : '');
      if (ref.isNotEmpty) prev = ref;
    }
    return out;
  }

  /// Every chapter of the map is "Not started": one line says it, the rows draw no state.
  static bool allNotStarted(List<LearnPart> parts) {
    final rows = flatRows(parts);
    return rows.isNotEmpty && rows.every((f) => f.row.raw['state'] is! Map || f.row.state.key == 'none');
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

  /// What a screen reader hears for a row: name, reference, state, count, meta, and the marks when they are shown.
  static String rowSpoken(LearnChapterRow row, {bool marks = false}) {
    final m = marks ? marksText(row) : '';
    return [
      displayTitle(row.title),
      row.ref ?? '',
      row.state.label,
      cardsText(row),
      metaLine(row),
      if (m.isNotEmpty) '${m.substring(1)} marks open' else '',
    ].where((s) => s.isNotEmpty).join('. ');
  }

  /// The suggestion's destination: its `run` (the key starts at once) or its `href`.
  static HomeTarget? suggestionTarget(LearnSuggestion suggestion) {
    final run = suggestion.action.run;
    if (run != null && run.chapterKey != null) return HomeRunTarget(run);
    final href = suggestion.action.href;
    if (href != null && href.isNotEmpty) return HomeHrefTarget(href);
    return null;
  }

  /// A name as it is read: the book's slash between two words is "and" ("Retirement/Death of a Partner"), a " / " is a
  /// comma ("Economics, Business Economics").
  static String displayTitle(String? text) => (text ?? '')
      .replaceAllMapped(RegExp(r'(\p{L})/(\p{L})', unicode: true), (m) => '${m[1]} and ${m[2]}')
      .replaceAll(RegExp(r'\s+/\s+'), ', ');

  /// The suggestions as Learn home draws them: a search suggestion is never drawn here, the field is on screen.
  static List<LearnSuggestion> homeSuggestions(List<LearnSuggestion> list) => [for (final s in list) if (s.kind != 'search') s];

  /// A suggestion's title as two parts: the engine's bold `headline`, then the rest ("3 cards due" and " in Accounting Ratios").
  static ({String headline, String rest}) splitTitle(LearnSuggestion suggestion) {
    final title = suggestion.title;
    final headline = suggestion.headline ?? '';
    if (headline.isNotEmpty && title.length > headline.length && title.startsWith(headline)) {
      return (headline: headline, rest: title.substring(headline.length));
    }
    return (headline: '', rest: title);
  }

  static final RegExp _stopped = RegExp(r'stopped at (\d+) of (\d+)', caseSensitive: false);

  /// "6 of 16 done" for a pick-up suggestion: its own fields when the service sends them, else the numbers its evidence line says.
  static ({int done, int of})? pickupProgress(LearnSuggestion suggestion) {
    if (suggestion.kind != 'pickup') return null;
    final raw = suggestion.raw;
    final progress = asJson(raw['progress']);
    final own = raw['done'] is num ? raw['done'] as num : (progress['done'] is num ? progress['done'] as num : null);
    final of = raw['of'] is num ? raw['of'] as num : (progress['of'] is num ? progress['of'] as num : null);
    if (own != null && own.isFinite && of != null && of.isFinite && of > 0) {
      return (done: (own < of ? own : of).toInt(), of: of.toInt());
    }
    final m = _stopped.firstMatch(suggestion.evidence ?? '');
    if (m == null) return null;
    final total = int.tryParse(m[2]!);
    final reached = int.tryParse(m[1]!);
    if (total == null || reached == null) return null;
    return total > 0 ? (done: reached < total ? reached : total, of: total) : null;
  }

  /// The field's placeholder: the card count when there are cards, what it can still find when there are none, and a plain
  /// word while it is unknown.
  static String searchPlaceholder(int? cards) => cards == null ? 'Search Key cards' : (cards > 0 ? 'Search $cards Key cards' : 'Search chapters and lessons');

  /// The three shelf tiles, from GET /api/learn/shelves. Zero is a true value: it is drawn, quiet, and says so.
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
      HomeShelfKey(
        id: 'due',
        count: due,
        label: 'due today',
        zero: due == 0,
        name: due != 0 ? 'Due today: $due $sub${cardWord(due)}. Show them' : 'No cards due today',
      ),
      HomeShelfKey(
        id: 'missed',
        count: missed,
        label: 'missed lately',
        zero: missed == 0,
        name: missed != 0 ? 'Missed lately: $missed ${cardWord(missed)} in the last $days days. Show them' : 'None missed lately',
      ),
      HomeShelfKey(
        id: 'revise',
        count: revise,
        label: 'in Revise',
        zero: revise == 0,
        name: revise != 0 ? 'In Revise: $revise ${cardWord(revise)} in ${plural(chapters, 'chapter')}. Show them' : 'Nothing in Revise yet',
      ),
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
