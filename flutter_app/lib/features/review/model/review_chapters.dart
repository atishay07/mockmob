// Review led by weak chapters, pass 1018 (docs/design-decisions/pass-1018/REVIEW-RESULT-1018.md 4.1 to 4.4, packet P-RR0).
//
// A port of the website's `data/review_chapters.mjs` (and the label rules of `data/repair_presentation.mjs`). PURE: no
// Flutter, no providers, no clock (the record carries `now`). Both platforms are tested against the same fixture
// (`test/fixtures/review/student-1018.json` is a byte copy of the website's `data/tests/fixtures/review/student-1018.json`),
// so the two never print different numbers for the same student.
//
// The record: papers, the chapters they asked, how many questions of each chapter each paper asked (right answers
// included) and one item per wrong or skipped question. A chapter is priced against the marks it had on offer:
//
//   marks on offer = 5 x the chapter's questions
//   marks lost     = 6 per wrong answer (5 not earned and the 1 taken off) + 5 per blank
//   so marks lost  = marks on offer - marks scored.
//
// Questions whose key is held or corrected are left out of both (RESULT-1017 4.2). A repaired mistake still lost its marks on
// its paper, so it stays in the chapter's figure; it is listed in Saved repairs, not as a row under the chapter. Every number
// on Review comes from [chapterRows]: the head line sums it, and the chapters add up to the papers' lost marks.
//
// Where this differs from the website, and why (each is tested):
//  * a stamp reads in the student's own zone: every function takes a `local` (the website's is fixed to India time, which is
//    the default here, so the fixture gives the same words);
//  * the papers a sentence names are collapsed when two share a name ("2 Quick practices") and capped at three, and the
//    chapters' scope line says "your 17 papers" past four, so a long record never prints a seventeen-name sentence.
import 'dart:math' as math;

import '../../../core/domain/chapter_breakdown.dart' show marksGapPerBlank, marksGapPerWrong;
import '../../../core/domain/marks.dart' show marksPerCorrect;

/// How an instant reads as a wall clock: the student's own zone. The fields of the returned [DateTime] (day, weekday, hour,
/// minute) are the ones the student's clock shows.
typedef LocalTime = DateTime Function(DateTime instant);

/// India time, as a UTC [DateTime] carrying the wall clock (what the website uses everywhere).
DateTime istLocal(DateTime instant) => instant.toUtc().add(const Duration(hours: 5, minutes: 30));

/// The states of one item in the record, the website's words.
abstract final class RecordState {
  /// A wrong answer with no saved repair.
  static const open = 'open';

  /// A skipped question.
  static const blank = 'blank';

  /// A saved repair whose Check it held has not been taken (or is not known here).
  static const repaired = 'repaired';

  /// A saved repair whose check came back right.
  static const held = 'held';

  /// A saved repair whose check came back wrong.
  static const slipped = 'slipped';
}

/// One action label per state (REVIEW-RESULT-1018 section 7, owner D15: "Repair first ... Repair in 1 ... Check it here: a very
/// confusing UI"). The same four words on the result, on Review and in the app. Priority is shown by order, never by a label.
abstract final class ActionLabels {
  static const repair = 'Repair';
  static const check = 'Check it held';
  static const see = 'See repair';
  static const again = 'Try it again';
}

/// The label of the one action on a row, or null when there is none (a key held or corrected). The website's `actionLabel`:
///
///   wrong, no saved repair                 Repair
///   repaired, Check it held not taken      Check it held
///   repaired and checked (held, slipped)   See repair (opens free, never a paid repair again: F17)
///   blank                                  Try it again (free)
///   key held or corrected                  no action
String? actionLabel(String state, {bool keyHeld = false}) {
  if (keyHeld) return null;
  if (state == RecordState.blank) return ActionLabels.again;
  if (state == RecordState.repaired || state == 'check') return ActionLabels.check;
  if (state == RecordState.held || state == RecordState.slipped || state == 'see') return ActionLabels.see;
  return ActionLabels.repair;
}

// ---- The record ----------------------------------------------------------------------------------------------------------

/// One paper (an attempt) of the record.
class RecordPaper {
  const RecordPaper({required this.id, required this.name, this.at, this.subject, this.subjectName});

  factory RecordPaper.fromJson(Map<String, dynamic> j) => RecordPaper(
    id: '${j['id']}',
    name: '${j['name'] ?? j['id']}',
    at: _time(j['at']),
    subject: _text(j['subject']),
    subjectName: _text(j['subjectName']),
  );

  final String id;

  /// "Mock 3" or "Quick practice".
  final String name;

  /// When it was finished.
  final DateTime? at;
  final String? subject;
  final String? subjectName;
}

/// One chapter of the record.
class RecordChapter {
  const RecordChapter({required this.id, required this.name, this.subject, this.subjectName});

  factory RecordChapter.fromJson(Map<String, dynamic> j) => RecordChapter(
    id: '${j['id']}',
    name: '${j['name'] ?? j['id']}',
    subject: _text(j['subject']),
    subjectName: _text(j['subjectName']),
  );

  final String id;
  final String name;
  final String? subject;
  final String? subjectName;
}

/// One question the student got wrong or skipped, with where it stands.
class RecordItem {
  const RecordItem({
    required this.paper,
    required this.q,
    required this.ch,
    required this.state,
    this.qid,
    this.keyState,
    this.stem = '',
    this.pick,
    this.repairedAt,
    this.checkedAt,
    this.chapterName,
  });

  factory RecordItem.fromJson(Map<String, dynamic> j) => RecordItem(
    paper: '${j['paper']}',
    q: (j['q'] as num?)?.toInt() ?? 0,
    qid: _text(j['qid']),
    ch: '${j['ch']}',
    chapterName: _text(j['chapter']),
    state: '${j['state']}',
    keyState: _text(j['keyState']),
    stem: _text(j['stem']) ?? '',
    pick: _text(j['pick']),
    repairedAt: _time(j['repairedAt']),
    checkedAt: _time(j['checkedAt']),
  );

  /// The paper's id.
  final String paper;

  /// The question's number in its paper, from 1.
  final int q;
  final String? qid;

  /// The chapter's id.
  final String ch;
  final String? chapterName;

  /// A [RecordState].
  final String state;

  /// Set when the answer key is held or corrected: the question is left out of every figure.
  final String? keyState;

  /// The first line of the question, or empty.
  final String stem;

  /// The student's letter ("D"), for a wrong answer.
  final String? pick;
  final DateTime? repairedAt;
  final DateTime? checkedAt;

  String get uid => '$paper:${qid ?? q}';
}

/// Everything the weak-chapter page draws, from one read.
class ReviewRecord {
  const ReviewRecord({required this.now, required this.papers, required this.chapters, required this.items, this.chapterQuestions});

  factory ReviewRecord.fromJson(Map<String, dynamic> j) {
    final raw = j['chapterQuestions'];
    return ReviewRecord(
      now: _time(j['now']) ?? DateTime.now().toUtc(),
      papers: [for (final p in (j['papers'] as List? ?? const [])) RecordPaper.fromJson(p as Map<String, dynamic>)],
      chapters: [for (final c in (j['chapters'] as List? ?? const [])) RecordChapter.fromJson(c as Map<String, dynamic>)],
      items: [for (final i in (j['items'] as List? ?? const [])) RecordItem.fromJson(i as Map<String, dynamic>)],
      chapterQuestions: raw is Map
          ? {
              for (final e in raw.entries)
                '${e.key}': {
                  for (final c in (e.value as Map).entries) '${c.key}': (c.value as num).toInt(),
                },
            }
          : null,
    );
  }

  final DateTime now;
  final List<RecordPaper> papers;
  final List<RecordChapter> chapters;
  final List<RecordItem> items;

  /// How many questions of each chapter each paper asked (right answers included): paper id, then chapter id. Null when the
  /// record does not say (an older server): a chapter is then priced by its marks lost alone.
  final Map<String, Map<String, int>>? chapterQuestions;

  /// The same record without its [chapterQuestions] (what an older server sends).
  ReviewRecord withoutChapterQuestions() => ReviewRecord(now: now, papers: papers, chapters: chapters, items: items);
}

// ---- What a row shows ----------------------------------------------------------------------------------------------------

/// One question as a row shows it: its paper and a weekday stamp (F17).
class RowItem {
  const RowItem({
    required this.uid,
    required this.number,
    required this.paper,
    required this.paperName,
    required this.stamp,
    required this.state,
    this.qid,
    this.pick,
    this.stem = '',
  });

  final String uid;

  /// The question's number in its paper.
  final int number;

  /// The paper's id (the attempt).
  final String paper;
  final String paperName;

  /// "Mock 3, Fri 16 Oct, 9:40 PM": the paper and when it was attempted, never relative (F17).
  final String stamp;
  final String state;
  final String? qid;
  final String? pick;
  final String stem;
}

/// A line whose first words are the ones that carry the figure.
class LeadLine {
  const LeadLine({required this.lead, required this.rest});

  final String lead;
  final String rest;

  String get text => '$lead$rest';
}

/// One chapter, priced.
class ChapterRow {
  const ChapterRow({
    required this.id,
    required this.name,
    required this.subject,
    required this.subjectName,
    required this.lost,
    required this.offer,
    required this.questions,
    required this.scored,
    required this.wrong,
    required this.blank,
    required this.papers,
    required this.paperIds,
    required this.line,
    required this.share,
    required this.open,
    required this.blanks,
    required this.repaired,
    required this.held,
    required this.slipped,
    required this.pending,
    required this.keyHeld,
  });

  final String id;
  final String name;

  /// The subject's id and display name, when the record says.
  final String? subject;
  final String? subjectName;

  /// Marks lost: 6 a wrong answer and 5 a blank.
  final int lost;

  /// Marks on offer (5 a question), or null when the record does not say how many questions the chapter asked.
  final int? offer;
  final int? questions;

  /// `offer - lost`, or null with [offer]. Negative when the wrong answers cost more than the chapter had on offer.
  final int? scored;
  final int wrong;
  final int blank;

  /// The papers the chapter lost marks in, newest first.
  final List<String> papers;
  final List<String> paperIds;

  /// "Lost 35 of the 80 marks on offer, 16 questions in Mock 3 and Mock 2. 5 wrong, 1 left blank." When the marks lost pass the
  /// marks on offer ([overOffer]) the "of N" is left out: "Lost 316 marks, 61 questions in Mock 3 and Mock 2. 52 wrong, 9 left blank."
  final LeadLine line;

  /// Marks lost over marks on offer, 0 to 1 (1 when the offer is not known).
  final double share;

  /// True when the marks lost pass the marks on offer (6 lost a wrong answer, 5 on offer a question): the "of N" is not printed.
  bool get overOffer => offer != null && lost > offer!;

  /// The never-repaired wrong answers, newest first.
  final List<RowItem> open;
  final List<RowItem> blanks;

  /// The saved repairs (named in the foot, listed in Saved repairs).
  final List<RowItem> repaired;
  final int held;
  final int slipped;
  final int pending;

  /// Questions whose key is held or corrected: out of every figure of this chapter.
  final int keyHeld;
}

/// One saved repair.
class SavedRepair {
  const SavedRepair({
    required this.item,
    required this.chapter,
    required this.chapterId,
    required this.kind,
    required this.line,
    required this.action,
    required this.subject,
  });

  final RowItem item;
  final String chapter;
  final String chapterId;
  final String? subject;

  /// `pending`, `held` or `slipped`.
  final String kind;

  /// "Slipped on a new question tonight, 8:55 PM. Back in Revise tomorrow."
  final String line;

  /// "Check it held" or "See repair": every saved repair opens free.
  final String? action;

  String get state => item.state;
  int get number => item.number;
}

/// "Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired."
class ReviewSummary {
  const ReviewSummary({required this.lost, required this.wrong, required this.blank, required this.who, required this.what, required this.fixed, required this.text});

  final int lost;
  final int wrong;
  final int blank;

  /// "Your 3 papers" or the one paper's name.
  final String who;

  /// "30 wrong answers and 8 left blank".
  final String what;

  /// " 9 are repaired." (with its leading space), or empty.
  final String fixed;
  final String text;
}

/// The whole weak-chapter page's numbers: [chapterRows], [savedRepairs] and the lines over them.
class ChaptersBody {
  const ChaptersBody({required this.rows, required this.saved, required this.savedLine, required this.line, required this.across});

  final List<ChapterRow> rows;
  final List<SavedRepair> saved;
  final String savedLine;
  final ReviewSummary line;
  final String across;
}

// ---- Words ---------------------------------------------------------------------------------------------------------------

const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

/// "A", "A and B", "A, B and C".
String joinNames(List<String> list) =>
    list.length <= 1 ? (list.isEmpty ? '' : list.first) : '${list.sublist(0, list.length - 1).join(', ')} and ${list.last}';

/// The papers a sentence names. Two papers with one name are said once with their count ("2 Quick practices": mock numbers
/// are per subject, so "Mock 2" can be two papers), and a long run is cut to its first two and a count, so a record of
/// seventeen papers never prints a seventeen-name sentence. Three or fewer distinct names read as the website's `joinNames`.
String namePapers(List<String> names) {
  final counts = <String, int>{};
  for (final n in names) {
    counts[n] = (counts[n] ?? 0) + 1;
  }
  final parts = [
    for (final e in counts.entries)
      if (e.value == 1)
        e.key
      else if (e.key == 'Quick practice')
        '${e.value} quick practices'
      else
        '${e.key} (${e.value} papers)',
  ];
  if (parts.length <= 3) return joinNames(parts);
  final rest = parts.length - 2;
  return '${parts.take(2).join(', ')} and $rest more papers';
}

/// "Fri 16 Oct, 9:40 PM": a real weekday and a 12-hour clock, never relative (F17, acceptance check 10).
String dayStamp(DateTime? instant, {LocalTime local = istLocal}) {
  if (instant == null) return '';
  final d = local(instant);
  return '${_days[d.weekday % 7]} ${d.day} ${_months[d.month - 1]}, ${_clock(d)}';
}

String _clock(DateTime d) => '${d.hour % 12 == 0 ? 12 : d.hour % 12}:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'AM' : 'PM'}';

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

/// "tonight, 8:30 PM" or "today, 11:05 AM" on the record's day; otherwise "Tue 13 Oct, 10:40 PM".
String whenSaid(DateTime? instant, DateTime now, {LocalTime local = istLocal}) {
  if (instant == null) return '';
  final d = local(instant);
  if (_sameDay(d, local(now))) return '${d.hour >= 17 ? 'tonight' : 'today'}, ${_clock(d)}';
  return dayStamp(instant, local: local);
}

/// The first line of a question's text, whitespace folded and cut at a word near 140 characters, or empty.
String stemLine(String? question) {
  const max = 140;
  String first = '';
  for (final line in (question ?? '').split(RegExp(r'\r?\n'))) {
    final t = line.trim();
    if (t.isNotEmpty) {
      first = t;
      break;
    }
  }
  final text = first.replaceAll(RegExp(r'\s+'), ' ');
  if (text.length <= max) return text;
  final cut = text.substring(0, max);
  final at = math.max(cut.lastIndexOf(' '), 60);
  return '${cut.substring(0, at).trimRight()}…';
}

final _ended = RegExp(r'[.?!:…)]$');

/// The stem as a row prints it: a stem that stops mid-sentence ends in an ellipsis, a missing one reads "Question 42".
String stemShown(String stem, int number) {
  final t = stem.trim();
  if (t.isEmpty) return 'Question $number';
  return _ended.hasMatch(t) ? t : '$t…';
}

// ---- The functions -------------------------------------------------------------------------------------------------------

DateTime? _time(Object? v) {
  if (v is DateTime) return v.toUtc();
  if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.toInt(), isUtc: true);
  if (v is String && v.isNotEmpty) return DateTime.tryParse(v)?.toUtc();
  return null;
}

String? _text(Object? v) {
  if (v == null) return null;
  final s = '$v';
  return s.isEmpty ? null : s;
}

class _PaperRef {
  _PaperRef(this.paper, this.rank);

  final RecordPaper paper;
  final int rank;

  String get id => paper.id;
  String get name => paper.name;
  DateTime? get at => paper.at;
}

class _ItemRef {
  _ItemRef(this.item, this.serverIndex, this.paperRef, this.chapter);

  final RecordItem item;
  final int serverIndex;
  final _PaperRef paperRef;
  final RecordChapter chapter;

  String get state => item.state;
  bool get keyHeld => item.keyState != null;
  bool get isWrong => item.state != RecordState.blank;
}

class _Context {
  _Context(this.papers, this.items, this.now);

  final List<_PaperRef> papers;
  final List<_ItemRef> items;
  final DateTime now;
}

_Context _context(ReviewRecord record) {
  final byTime = [...record.papers]
    ..sort((a, b) {
      final t = (b.at?.millisecondsSinceEpoch ?? 0) - (a.at?.millisecondsSinceEpoch ?? 0);
      return t != 0 ? t : a.id.compareTo(b.id);
    });
  final papers = [for (var i = 0; i < byTime.length; i++) _PaperRef(byTime[i], i)];
  final paperById = {for (final p in papers) p.id: p};
  final chapterById = {for (final c in record.chapters) c.id: c};
  final items = <_ItemRef>[];
  for (var index = 0; index < record.items.length; index++) {
    final item = record.items[index];
    final paper = paperById[item.paper] ?? _PaperRef(RecordPaper(id: item.paper, name: item.paper), papers.length);
    final chapter =
        chapterById[item.ch] ??
        RecordChapter(id: item.ch, name: item.chapterName ?? item.ch, subject: paper.paper.subject, subjectName: paper.paper.subjectName);
    items.add(_ItemRef(item, index, paper, chapter));
  }
  return _Context(papers, items, record.now);
}

RowItem _itemOut(_ItemRef i, LocalTime local) => RowItem(
  uid: i.item.uid,
  number: i.item.q,
  paper: i.paperRef.id,
  paperName: i.paperRef.name,
  stamp: [i.paperRef.name, dayStamp(i.paperRef.at, local: local)].where((s) => s.isNotEmpty).join(', '),
  state: i.state,
  qid: i.item.qid,
  pick: i.item.pick,
  stem: i.item.stem,
);

const _saved = {RecordState.repaired, RecordState.held, RecordState.slipped};

class _Group {
  _Group(this.ref);

  final RecordChapter ref;
  final List<_ItemRef> items = [];
  int held = 0;
}

/// The chapters, most marks lost first. `open` is the never-repaired wrong answers, newest first; `blanks` the blanks;
/// `repaired` the saved repairs (named in the foot). `offer` is null when the record does not say how many questions the
/// chapter asked (an older server): the line then states the marks lost alone.
/// Ties: more wrong answers, then the newest paper.
List<ChapterRow> chapterRows(ReviewRecord record, {LocalTime local = istLocal}) {
  final ctx = _context(record);
  final counts = record.chapterQuestions;
  final groups = <String, _Group>{};
  for (final item in ctx.items) {
    final g = groups.putIfAbsent(item.chapter.id, () => _Group(item.chapter));
    if (item.keyHeld) {
      g.held += 1;
    } else {
      g.items.add(item);
    }
  }
  final built = <({ChapterRow row, int newest, int order})>[];
  var order = 0;
  for (final MapEntry(key: id, value: g) in groups.entries) {
    if (g.items.isEmpty) continue;
    final wrong = g.items.where((i) => i.isWrong).length;
    final blank = g.items.length - wrong;
    final lost = wrong * marksGapPerWrong + blank * marksGapPerBlank;
    // Questions on offer across the papers that asked this chapter, less those whose key is held.
    int? questions;
    if (counts != null) {
      final askedIn = <String>{
        for (final e in counts.entries)
          if ((e.value[id] ?? 0) > 0) e.key,
        for (final i in g.items) i.paperRef.id,
      };
      var n = 0;
      for (final p in askedIn) {
        n += counts[p]?[id] ?? 0;
      }
      n -= g.held;
      if (n >= g.items.length) questions = n;
    }
    final offer = questions == null ? null : questions * marksPerCorrect;
    final scored = offer == null ? null : offer - lost;
    final paperRefs = <String, _PaperRef>{for (final i in g.items) i.paperRef.id: i.paperRef}.values.toList()..sort((a, b) => a.rank.compareTo(b.rank));
    final papers = [for (final p in paperRefs) p.name];
    int newestFirst(_ItemRef a, _ItemRef b) {
      final r = a.paperRef.rank.compareTo(b.paperRef.rank);
      return r != 0 ? r : a.serverIndex.compareTo(b.serverIndex);
    }

    List<_ItemRef> pick(bool Function(_ItemRef) test) => g.items.where(test).toList()..sort(newestFirst);
    final open = pick((i) => i.state == RecordState.open);
    final blanks = pick((i) => i.state == RecordState.blank);
    final repaired = pick((i) => _saved.contains(i.state));
    final counted = [if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank left blank'].join(', ');
    final names = namePapers(papers);
    final asked = questions == null ? '' : ', ${_plural(questions, 'question')} in $names';
    // Six marks go for a wrong answer and only five are on offer for a question, so a chapter of mostly wrong answers can lose
    // more than it had on offer. "Lost 316 of the 310 marks" cannot be true: such a row says the marks lost alone.
    final line = offer == null
        ? LeadLine(lead: 'Lost $lost marks', rest: ' in $names. $counted.')
        : lost > offer
        ? LeadLine(lead: 'Lost $lost marks', rest: '$asked. $counted.')
        : LeadLine(lead: 'Lost $lost of the $offer marks', rest: ' on offer$asked. $counted.');
    built.add((
      row: ChapterRow(
        id: id,
        name: g.ref.name,
        subject: g.ref.subject,
        subjectName: g.ref.subjectName ?? g.ref.subject,
        lost: lost,
        offer: offer,
        questions: questions,
        scored: scored,
        wrong: wrong,
        blank: blank,
        papers: papers,
        paperIds: [for (final p in paperRefs) p.id],
        line: line,
        share: offer != null && offer > 0 ? math.min(1, lost / offer) : 1,
        open: [for (final i in open) _itemOut(i, local)],
        blanks: [for (final i in blanks) _itemOut(i, local)],
        repaired: [for (final i in repaired) _itemOut(i, local)],
        held: repaired.where((i) => i.state == RecordState.held).length,
        slipped: repaired.where((i) => i.state == RecordState.slipped).length,
        pending: repaired.where((i) => i.state == RecordState.repaired).length,
        keyHeld: g.held,
      ),
      newest: g.items.map((i) => i.paperRef.rank).reduce(math.min),
      order: order++,
    ));
  }
  built.sort((a, b) {
    final lost = b.row.lost.compareTo(a.row.lost);
    if (lost != 0) return lost;
    final wrong = b.row.wrong.compareTo(a.row.wrong);
    if (wrong != 0) return wrong;
    final newest = a.newest.compareTo(b.newest);
    if (newest != 0) return newest;
    final byName = a.row.name.toLowerCase().compareTo(b.row.name.toLowerCase());
    if (byName != 0) return byName;
    final raw = a.row.name.compareTo(b.row.name);
    return raw != 0 ? raw : a.order.compareTo(b.order);
  });
  return [for (final b in built) b.row];
}

/// The saved repairs, slipped first, then those waiting for Check it held, then those that held; newest first inside each.
/// Every one opens free (F17).
List<SavedRepair> savedRepairs(ReviewRecord record, {LocalTime local = istLocal}) {
  final ctx = _context(record);
  const rank = {RecordState.slipped: 0, RecordState.repaired: 1, RecordState.held: 2};
  final list = [for (final i in ctx.items) if (_saved.contains(i.state)) i];
  int at(_ItemRef i) => (i.item.checkedAt ?? i.item.repairedAt)?.millisecondsSinceEpoch ?? 0;
  final indexed = [for (var n = 0; n < list.length; n++) (item: list[n], n: n)]
    ..sort((a, b) {
      final r = rank[a.item.state]!.compareTo(rank[b.item.state]!);
      if (r != 0) return r;
      final t = at(b.item).compareTo(at(a.item));
      if (t != 0) return t;
      final p = a.item.paperRef.rank.compareTo(b.item.paperRef.rank);
      return p != 0 ? p : a.n.compareTo(b.n);
    });
  return [for (final e in indexed) _savedFrom(e.item, ctx.now, local)];
}

SavedRepair _savedFrom(_ItemRef i, DateTime now, LocalTime local) {
  final repairedAt = whenSaid(i.item.repairedAt, now, local: local);
  final checkedAt = whenSaid(i.item.checkedAt, now, local: local);
  final line = switch (i.state) {
    RecordState.slipped => 'Slipped on a new question${checkedAt.isNotEmpty ? ' $checkedAt' : ''}. Back in Revise tomorrow.',
    RecordState.repaired => 'Repaired${repairedAt.isNotEmpty ? ' $repairedAt' : ''}. One new question shows whether it held.',
    _ => 'Held on a new question.${repairedAt.isNotEmpty ? ' Repaired $repairedAt.' : ''}',
  };
  return SavedRepair(
    item: _itemOut(i, local),
    chapter: i.chapter.name,
    chapterId: i.chapter.id,
    subject: i.chapter.subject,
    kind: i.state == RecordState.repaired ? 'pending' : i.state,
    line: line,
    action: actionLabel(i.state, keyHeld: i.keyHeld),
  );
}

/// "6 held on a new question, 1 slipped, 2 waiting for Check it held."
String savedLine(List<SavedRepair> saved) {
  final held = saved.where((s) => s.state == RecordState.held).length;
  final slipped = saved.where((s) => s.state == RecordState.slipped).length;
  final pending = saved.where((s) => s.state == RecordState.repaired).length;
  final parts = [
    if (held > 0) '$held held on a new question',
    if (slipped > 0) '$slipped slipped',
    if (pending > 0) '$pending waiting for Check it held',
  ];
  return parts.isEmpty ? '' : '${parts.join(', ')}.';
}

/// The action label of an item as the record holds it (the website's `actionFor`).
String? actionFor(RecordItem item) => actionLabel(item.state, keyHeld: item.keyState != null);

/// "Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired." Summed from [chapterRows].
ReviewSummary reviewLine(ReviewRecord record, {List<ChapterRow>? rows, List<SavedRepair>? saved, LocalTime local = istLocal}) {
  final chapters = rows ?? chapterRows(record, local: local);
  final repairs = saved ?? savedRepairs(record, local: local);
  final ctx = _context(record);
  final lost = chapters.fold(0, (s, r) => s + r.lost);
  final wrong = chapters.fold(0, (s, r) => s + r.wrong);
  final blank = chapters.fold(0, (s, r) => s + r.blank);
  final who = ctx.papers.length == 1 ? ctx.papers.first.name : 'Your ${ctx.papers.length} papers';
  final what = [if (wrong > 0) _plural(wrong, 'wrong answer'), if (blank > 0) '$blank left blank'].join(' and ');
  final fixed = repairs.isEmpty ? '' : ' ${repairs.length == 1 ? '1 is repaired' : '${repairs.length} are repaired'}.';
  return ReviewSummary(
    lost: lost,
    wrong: wrong,
    blank: blank,
    who: who,
    what: what,
    fixed: fixed,
    text: lost > 0 ? '$who lost $lost marks: $what.$fixed' : '$who lost no marks.',
  );
}

/// "Each chapter across Mock 3, Quick practice and Mock 2." One paper: "Each chapter in Mock 3." Past four papers the list is
/// not printed: "Each chapter across your 17 papers."
String acrossLine(ReviewRecord record) {
  final names = [for (final p in _context(record).papers) p.name];
  if (names.length == 1) return 'Each chapter in ${names.first}.';
  if (names.length > 4) return 'Each chapter across your ${names.length} papers.';
  return 'Each chapter across ${joinNames(names)}.';
}

/// The numbers the weak-chapter page draws, from the one record.
ChaptersBody chaptersBody(ReviewRecord record, {LocalTime local = istLocal}) {
  final rows = chapterRows(record, local: local);
  final saved = savedRepairs(record, local: local);
  return ChaptersBody(
    rows: rows,
    saved: saved,
    savedLine: savedLine(saved),
    line: reviewLine(record, rows: rows, saved: saved, local: local),
    across: acrossLine(record),
  );
}
