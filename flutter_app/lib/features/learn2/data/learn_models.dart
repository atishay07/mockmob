import '../../../core/models/json_helpers.dart';
import '../../keycards/data/keycards_models.dart';

/// Learn v2 as the server sends it: the shapes of the web's contract (web docs/brain/learn-1031/API-CONTRACT.md) as the
/// production service really answers them, modelled from the recordings in test/fixtures/learn2/ (web commit 4bba8db6f).
///
/// Every parser is tolerant: a missing field or one of the wrong type gives its empty value, unknown fields are ignored and
/// nothing throws on a null; a list entry without what makes it usable (an id, a card that parses) is left out. Field
/// names are the contract's. Every model keeps the [raw] JSON it was read from, so a screen can reach a field added later.
/// Cards inside items, lines and rows are the Key cards model ([KeyCard.tryParse]).

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}

int _int(Object? v, [int fallback = 0]) => asInt(v) ?? fallback;

bool _bool(Object? v, [bool fallback = false]) => asBool(v) ?? fallback;

/// The run kinds (`mix` and `feed` are Free's one session a day; `cards`, `recap` and `level` are not).
abstract final class LearnKinds {
  static const String mix = 'mix';
  static const String recap = 'recap';
  static const String cards = 'cards';
  static const String feed = 'feed';
  static const String level = 'level';

  static const List<String> all = [mix, recap, cards, feed, level];
}

/// The piles a chapter run can leave out.
abstract final class LearnPiles {
  static const String cards = 'cards';
  static const String questions = 'questions';
  static const String mistakes = 'mistakes';
  static const String lesson = 'lesson';

  static const List<String> all = [cards, questions, mistakes, lesson];
}

// ---------------------------------------------------------------- shared pieces

/// `{ id, name }`: one of the student's subjects.
class LearnSubjectRef {
  const LearnSubjectRef({required this.id, required this.name, this.raw = const {}});

  static LearnSubjectRef? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnSubjectRef(id: id, name: _text(j['name']) ?? id, raw: j);
  }

  final String id;
  final String name;
  final Json raw;
}

/// A chapter's state: `{ key: none | thin | needs_work | getting_there | holding | unknown, label }`.
class LearnState {
  const LearnState({this.key = 'none', this.label = '', this.raw = const {}});

  static LearnState parse(Object? raw) {
    final j = asJson(raw);
    return LearnState(key: _text(j['key']) ?? 'none', label: _text(j['label']) ?? '', raw: j);
  }

  final String key;
  final String label;
  final Json raw;
}

/// `{ text }`, and `maxMinutes` where the server sends it: Free's lines (`free`), the looks line, a rating limit.
class LearnNote {
  const LearnNote({required this.text, this.maxMinutes, this.raw = const {}});

  static LearnNote? tryParse(Object? raw) {
    final j = asJson(raw);
    final text = _text(j['text']);
    if (text == null) return null;
    return LearnNote(text: text, maxMinutes: asInt(j['maxMinutes']), raw: j);
  }

  final String text;
  final int? maxMinutes;
  final Json raw;
}

/// Free past 10 minutes: `{ asked, text }` ("Free sessions are up to 10 minutes. Pro has any length.").
class LearnCapped {
  const LearnCapped({required this.asked, required this.text, this.raw = const {}});

  static LearnCapped? tryParse(Object? raw) {
    final j = asJson(raw);
    final text = _text(j['text']);
    if (text == null) return null;
    return LearnCapped(asked: _int(j['asked']), text: text, raw: j);
  }

  final int asked;
  final String text;
  final Json raw;
}

/// A chapter's place among the student's playable chapters, in roadmap order: `{ n, of }` (R4 ruling N). It is what names a
/// chapter on screen ("Chapter 5 of 14"); the NCERT number (`ref`) is only for a card's source line.
class LearnPlace {
  const LearnPlace({required this.n, required this.of});

  static LearnPlace? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final n = _int(j['n']);
    if (n <= 0) return null;
    return LearnPlace(n: n, of: _int(j['of']));
  }

  final int n;
  final int of;

  /// "Chapter 5 of 14"; empty without both numbers (the web's `chapterPlace`).
  String get label => n > 0 && of > 0 ? 'Chapter $n of $of' : '';

  /// "Chapter 5": the short form for tight spots (the web's `chapterShort`).
  String get short => n > 0 ? 'Chapter $n' : '';
}

/// A run the server names for a key: `{ kind, chapterKey, minutes, leaveOut, cardIds?, resume?, fresh? }` (a suggestion's
/// action, an end option, a 402 option, the feed end's lead, next and dueOffer). [toStart] makes the start body.
class LearnRunSpec {
  const LearnRunSpec({
    this.kind = LearnKinds.mix,
    this.chapterKey,
    this.minutes,
    this.leaveOut = const [],
    this.cardIds = const [],
    this.resume,
    this.fresh = false,
    this.raw = const {},
  });

  static LearnRunSpec? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnRunSpec(
      kind: _text(j['kind']) ?? LearnKinds.mix,
      chapterKey: _text(j['chapterKey']),
      minutes: asInt(j['minutes']),
      leaveOut: asStringList(j['leaveOut']),
      cardIds: asStringList(j['cardIds']),
      resume: _text(j['resume']),
      fresh: _bool(j['fresh']),
      raw: j,
    );
  }

  final String kind;
  final String? chapterKey;
  final int? minutes;
  final List<String> leaveOut;
  final List<String> cardIds;

  /// The run to pick up (a pickup suggestion): sent as `resume`.
  final String? resume;

  /// "Another 10 minutes": never resume, a new request key.
  final bool fresh;
  final Json raw;

  /// The start body of this run. [source], [forYou] and [position] say it was started from an Explore cover.
  RunStart toStart({String? source, bool? forYou, int? position}) => RunStart(
    kind: kind,
    chapterKey: chapterKey,
    cardIds: cardIds,
    minutes: minutes ?? 10,
    leaveOut: leaveOut,
    resume: resume,
    fresh: fresh,
    source: source,
    forYou: forYou,
    position: position,
  );
}

/// A key the server writes: a suggestion's action `{ label, run? | href?, go? }`, an end's lead and options
/// `{ kind, title, minutes, label, evidence, run? | href?, go? }`, Free's end lead `{ line, label: 'See Pro', href, go: 'pro' }`
/// and the 402's options `{ label, run? | href?, go? }`. A key either starts [run] or opens [href] (Learn2Links.resolve).
class LearnOption {
  const LearnOption({
    required this.label,
    this.kind,
    this.title,
    this.minutes,
    this.evidence,
    this.run,
    this.href,
    this.go,
    this.line,
    this.raw = const {},
  });

  static LearnOption? tryParse(Object? raw) {
    final j = asJson(raw);
    final label = _text(j['label']) ?? _text(j['title']);
    if (label == null) return null;
    return LearnOption(
      label: label,
      kind: _text(j['kind']),
      title: _text(j['title']),
      minutes: asInt(j['minutes']),
      evidence: _text(j['evidence']),
      run: LearnRunSpec.tryParse(j['run']),
      href: _text(j['href']),
      go: _text(j['go']),
      line: _text(j['line']),
      raw: j,
    );
  }

  final String label;

  /// next | here | fix | revise | recap | mock | explore on an end; null on a suggestion's action and Free's See Pro.
  final String? kind;

  /// The heading that names it ("Next: Goodwill"); null where the server sends only [label].
  final String? title;

  /// The length the key says; null when it is not a timed run (mock, explore).
  final int? minutes;
  final String? evidence;
  final LearnRunSpec? run;
  final String? href;

  /// What [href] opens: feed | find | explore | mock | revise | pro.
  final String? go;

  /// Free's end lead: the session line above its See Pro key.
  final String? line;
  final Json raw;

  bool get startsRun => run != null;
}

/// A lesson: `{ id, title, minutes, read }` (a chapter row's, the preview shelf's, a run's lesson item).
class LearnLesson {
  const LearnLesson({required this.id, this.title, this.minutes, this.read = false, this.raw = const {}});

  static LearnLesson? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnLesson(id: id, title: _text(j['title']), minutes: asInt(j['minutes']), read: _bool(j['read']), raw: j);
  }

  final String id;
  final String? title;
  final int? minutes;
  final bool read;
  final Json raw;
}

/// A chapter the server points at: `{ key, title, label?, ref? }` (the preview's shrink.addNext, a run's `added`).
class LearnChapterLink {
  const LearnChapterLink({required this.key, required this.title, this.label, this.ref, this.place, this.raw = const {}});

  static LearnChapterLink? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnChapterLink(key: key, title: _text(j['title']) ?? key, label: _text(j['label']), ref: _text(j['ref']), place: LearnPlace.tryParse(j['place']), raw: j);
  }

  final String key;
  final String title;

  /// "Add the next chapter, Goodwill: Nature and Valuation".
  final String? label;

  /// "Ch 2" (a source line only).
  final String? ref;

  /// "Chapter 6": how the next chapter is named (R4 ruling N).
  final LearnPlace? place;
  final Json raw;
}

/// A chapter's unfinished run: `{ runId, done, of, minutesLeft, kind? }` (the preview's resume row, a cover's resume).
class LearnOpenRun {
  const LearnOpenRun({required this.runId, this.done = 0, this.of = 0, this.minutesLeft = 0, this.kind, this.raw = const {}});

  static LearnOpenRun? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['runId']);
    if (id == null) return null;
    return LearnOpenRun(runId: id, done: _int(j['done']), of: _int(j['of']), minutesLeft: _int(j['minutesLeft']), kind: _text(j['kind']), raw: j);
  }

  final String runId;
  final int done;
  final int of;
  final int minutesLeft;
  final String? kind;
  final Json raw;
}

/// Why a run came out shorter than asked: `{ minutes?, reason: pool | cap | mistakes, text?, addNext? }`.
class LearnShrink {
  const LearnShrink({this.reason, this.minutes, this.text, this.addNext, this.raw = const {}});

  static LearnShrink? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnShrink(
      reason: _text(j['reason']),
      minutes: asInt(j['minutes']),
      text: _text(j['text']),
      addNext: LearnChapterLink.tryParse(j['addNext']),
      raw: j,
    );
  }

  final String? reason;
  final int? minutes;

  /// "This chapter has about 19 minutes of new things today."
  final String? text;

  /// A short chapter offers its next one ("Add the next chapter").
  final LearnChapterLink? addNext;
  final Json raw;
}

/// A card shown small: `{ id, kind, front, mustKnow }` (an end's reviseCards, a cover's hook); a locked hook is
/// `{ front: null, kind, mustKnow, locked: true }`.
class LearnCardFace {
  const LearnCardFace({this.id, required this.kind, this.front, this.mustKnow = false, this.locked = false, this.raw = const {}});

  static LearnCardFace? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final front = _text(j['front']);
    final locked = _bool(j['locked']);
    if (front == null && !locked) return null;
    return LearnCardFace(id: _text(j['id']), kind: asStringOr(j['kind'], 'key_line'), front: front, mustKnow: _bool(j['mustKnow']), locked: locked, raw: j);
  }

  final String? id;
  final String kind;
  final String? front;
  final bool mustKnow;
  final bool locked;
  final Json raw;
}

/// A card Free cannot open, as the server stubs it: `{ id, kind, label, locked: true }`.
class LearnLockedCard {
  const LearnLockedCard({required this.id, required this.kind, this.label, this.raw = const {}});

  static LearnLockedCard? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnLockedCard(id: id, kind: asStringOr(j['kind'], 'key_line'), label: _text(j['label']), raw: j);
  }

  final String id;
  final String kind;

  /// The kind's label ("Key line").
  final String? label;
  final Json raw;
}

// ---------------------------------------------------------------- GET /api/learn/subject

class LearnSubjectInfo {
  const LearnSubjectInfo({required this.id, required this.name, this.cards = 0, this.chapters = 0, this.lessons = 0, this.note, this.raw = const {}});

  static LearnSubjectInfo parse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']) ?? '';
    return LearnSubjectInfo(
      id: id,
      name: _text(j['name']) ?? id,
      cards: _int(j['cards']),
      chapters: _int(j['chapters']),
      lessons: _int(j['lessons']),
      note: _text(j['note']),
      raw: j,
    );
  }

  final String id;
  final String name;
  final int cards;
  final int chapters;
  final int lessons;

  /// English: "English cards are written for MockMob, not taken from an NCERT book."
  final String? note;
  final Json raw;
}

/// One of the three suggestions: `{ kind, chapterKey, title, headline, chapterTitle, evidence, action }`. Kinds: pickup, due,
/// fix, next, start, level, recap, search, feed.
class LearnSuggestion {
  const LearnSuggestion({
    required this.kind,
    required this.title,
    required this.action,
    this.chapterKey,
    this.headline,
    this.chapterTitle,
    this.evidence,
    this.raw = const {},
  });

  static LearnSuggestion? tryParse(Object? raw) {
    final j = asJson(raw);
    final action = LearnOption.tryParse(j['action']);
    final title = _text(j['title']);
    if (action == null || title == null) return null;
    return LearnSuggestion(
      kind: _text(j['kind']) ?? 'start',
      title: title,
      action: action,
      chapterKey: _text(j['chapterKey']),
      headline: _text(j['headline']),
      chapterTitle: _text(j['chapterTitle']),
      evidence: _text(j['evidence']),
      raw: j,
    );
  }

  final String kind;
  final String title;
  final LearnOption action;
  final String? chapterKey;

  /// The title's first part ("Pick up", "3 cards due"), for a card that sets the chapter on its own line.
  final String? headline;
  final String? chapterTitle;
  final String? evidence;
  final Json raw;
}

/// A chapter in the map: `{ key, title, ref, cards, mustKnow, due, mistakes, questions, lesson, state, meta, marksOpen }`.
class LearnChapterRow {
  const LearnChapterRow({
    required this.key,
    required this.title,
    this.ref,
    this.cards = 0,
    this.mustKnow = 0,
    this.due = 0,
    this.mistakes = 0,
    this.questions = 0,
    this.lesson,
    this.state = const LearnState(),
    this.meta,
    this.marksOpen,
    this.place,
    this.progress,
    this.verdict,
    this.needsWorkFrom,
    this.unit,
    this.raw = const {},
  });

  static LearnChapterRow? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnChapterRow(
      key: key,
      title: _text(j['title']) ?? key,
      ref: _text(j['ref']),
      cards: _int(j['cards']),
      mustKnow: _int(j['mustKnow']),
      due: _int(j['due']),
      mistakes: _int(j['mistakes']),
      questions: _int(j['questions']),
      lesson: LearnLesson.tryParse(j['lesson']),
      state: LearnState.parse(j['state']),
      meta: _text(j['meta']),
      marksOpen: asDouble(j['marksOpen']),
      place: LearnPlace.tryParse(j['place']),
      progress: LearnRowProgress.tryParse(j['progress']),
      verdict: _text(j['verdict']),
      needsWorkFrom: _text(j['needsWorkFrom']),
      unit: _text(j['unit']),
      raw: j,
    );
  }

  final String key;
  final String title;

  /// "Ch 1" (the NCERT number, for source lines only); null for a chapter without a number.
  final String? ref;
  final int cards;
  final int mustKnow;
  final int due;
  final int mistakes;
  final int questions;
  final LearnLesson? lesson;
  final LearnState state;

  /// One true line: "3 due, 3 open mistakes".
  final String? meta;

  /// Marks open in the chapter, only when the server sends them (the "Needs work first" sort uses the state).
  final double? marksOpen;

  /// "Chapter 5 of 14" (R4 ruling N).
  final LearnPlace? place;

  /// Coverage through the chapter (R2 ruling 2): the cards open and seen, the questions and those tried. Never mastery.
  final LearnRowProgress? progress;

  /// The one verdict word a roadmap row may carry: "Needs work", or null.
  final String? verdict;

  /// Where the verdict comes from: `learn` | `papers` (R4 ruling V).
  final String? needsWorkFrom;

  /// The unit's name.
  final String? unit;
  final Json raw;
}

/// A roadmap row's coverage: `{ of, seen, unseen, questions, tried }`.
class LearnRowProgress {
  const LearnRowProgress({this.of = 0, this.seen = 0, this.unseen = 0, this.questions = 0, this.tried = 0, this.raw = const {}});

  static LearnRowProgress? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnRowProgress(of: _int(j['of']), seen: _int(j['seen']), unseen: _int(j['unseen']), questions: _int(j['questions']), tried: _int(j['tried']), raw: j);
  }

  /// The cards open to this student (Free: its free count).
  final int of;
  final int seen;
  final int unseen;
  final int questions;
  final int tried;
  final Json raw;
}

class LearnChoice {
  const LearnChoice(this.id, this.label);

  final String id;
  final String label;
}

/// A part's one-tap choice (LK2): `{ label: 'Your part', choices: [{ id, label }], chosen, hint }`.
class LearnPartOption {
  const LearnPartOption({required this.label, required this.choices, this.chosen, this.hint, this.raw = const {}});

  static LearnPartOption? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final choices = [
      for (final c in asJsonList(j['choices']))
        if (_text(c['id']) case final id?) LearnChoice(id, _text(c['label']) ?? id),
    ];
    if (choices.length < 2) return null;
    return LearnPartOption(label: _text(j['label']) ?? 'Your part', choices: choices, chosen: _text(j['chosen']), hint: _text(j['hint']), raw: j);
  }

  final String label;
  final List<LearnChoice> choices;
  final String? chosen;

  /// "Both parts show until you choose."
  final String? hint;
  final Json raw;
}

/// A unit of a part: `{ title, optionId, chapters }` (`optionId` names the part option it belongs to).
class LearnPartUnit {
  const LearnPartUnit({required this.title, this.optionId, this.chapters = const [], this.raw = const {}});

  static LearnPartUnit parse(Object? raw) {
    final j = asJson(raw);
    return LearnPartUnit(
      title: _text(j['title']) ?? '',
      optionId: _text(j['optionId']),
      chapters: [for (final c in asJsonList(j['chapters'])) ?LearnChapterRow.tryParse(c)],
      raw: j,
    );
  }

  final String title;
  final String? optionId;
  final List<LearnChapterRow> chapters;
  final Json raw;
}

/// A part of the book: `{ id, title, option, units }` ("Part 1, Partnership Accounts").
class LearnPart {
  const LearnPart({required this.id, required this.title, this.option, this.units = const [], this.raw = const {}});

  static LearnPart? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnPart(
      id: id,
      title: _text(j['title']) ?? '',
      option: LearnPartOption.tryParse(j['option']),
      units: [for (final u in asJsonList(j['units'])) LearnPartUnit.parse(u)],
      raw: j,
    );
  }

  final String id;
  final String title;
  final LearnPartOption? option;
  final List<LearnPartUnit> units;
  final Json raw;

  Iterable<LearnChapterRow> get chapters => units.expand((u) => u.chapters);
}

/// `GET /api/learn/subject?subject=`: the Learn home of one subject.
class LearnSubjectData {
  const LearnSubjectData({
    this.plan = 'free',
    this.isNew = false,
    this.subjects = const [],
    this.subject = const LearnSubjectInfo(id: '', name: ''),
    this.freeNote,
    this.free,
    this.suggestions = const [],
    this.roadmap,
    this.parts = const [],
    this.shelves,
    this.raw = const {},
  });

  static LearnSubjectData parse(Object? raw) {
    final j = asJson(raw);
    return LearnSubjectData(
      plan: _text(j['plan']) ?? 'free',
      isNew: _bool(asJson(j['student'])['isNew']),
      subjects: [for (final s in asJsonList(j['subjects'])) ?LearnSubjectRef.tryParse(s)],
      subject: LearnSubjectInfo.parse(j['subject']),
      freeNote: _text(j['freeNote']),
      free: LearnNote.tryParse(j['free']),
      suggestions: [for (final s in asJsonList(j['suggestions'])) ?LearnSuggestion.tryParse(s)],
      roadmap: LearnRoadmap.tryParse(j['roadmap']),
      parts: [for (final p in asJsonList(j['parts'])) ?LearnPart.tryParse(p)],
      shelves: j['shelves'] is Map ? LearnShelves.parse(j['shelves']) : null,
      raw: j,
    );
  }

  /// `pro` or `free`.
  final String plan;

  /// `student.isNew`: nothing studied and nothing answered.
  final bool isNew;
  final List<LearnSubjectRef> subjects;
  final LearnSubjectInfo subject;

  /// Free: "Free opens 5 cards in every chapter. Pro opens all 868."
  final String? freeNote;

  /// Free once today's session is used: `{ text, maxMinutes: 10 }`.
  final LearnNote? free;

  /// The older three suggestions (the app's Learn home no longer draws them: the [roadmap] is the offer).
  final List<LearnSuggestion> suggestions;

  /// The one start offer Learn home leads with (R2 rulings 1 to 3).
  final LearnRoadmap? roadmap;
  final List<LearnPart> parts;

  /// Find's shelves, only on the combined read (`GET /api/learn/home`).
  final LearnShelves? shelves;
  final Json raw;

  bool get isPro => plan == 'pro';

  /// Every chapter row in book order.
  Iterable<LearnChapterRow> get chapters => parts.expand((p) => p.chapters);

  LearnChapterRow? chapter(String key) {
    for (final c in chapters) {
      if (c.key == key) return c;
    }
    return null;
  }
}

/// The chapter the student is in, as the roadmap names it: `{ key, title, seen, of, unseen, place }`.
class LearnRoadmapChapter {
  const LearnRoadmapChapter({required this.key, required this.title, this.seen = 0, this.of = 0, this.unseen = 0, this.place, this.raw = const {}});

  static LearnRoadmapChapter? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnRoadmapChapter(key: key, title: _text(j['title']) ?? key, seen: _int(j['seen']), of: _int(j['of']), unseen: _int(j['unseen']), place: LearnPlace.tryParse(j['place']), raw: j);
  }

  final String key;
  final String title;
  final int seen;
  final int of;
  final int unseen;
  final LearnPlace? place;
  final Json raw;
}

/// Learn home's one start offer (data/learn/roadmap.js): `{ mode, headline, line, sub, progress, key, quiet, or, position,
/// chapter, due? }`. Modes: `pickup` (an unfinished run), `freeDone` (Free, today's session used), `new`, `today`. Every word is
/// the server's; a zero is never in one. [key] and [quiet] are `{ label, run? | href?, go? }`, [or] at most two quiet rows.
class LearnRoadmap {
  const LearnRoadmap({
    required this.mode,
    required this.headline,
    this.line,
    this.sub,
    this.progress,
    this.key,
    this.quiet,
    this.or = const [],
    this.position,
    this.chapter,
    this.dueCount = 0,
    this.raw = const {},
  });

  static LearnRoadmap? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final headline = _text(j['headline']);
    if (headline == null) return null;
    final p = asJson(j['progress']);
    final done = asInt(p['done']);
    final of = asInt(p['of']);
    final at = asJson(j['position']);
    final atKey = _text(at['chapterKey']);
    return LearnRoadmap(
      mode: _text(j['mode']) ?? 'today',
      headline: headline,
      line: _text(j['line']),
      sub: _text(j['sub']),
      progress: done != null && of != null && of > 0 ? (done: done, of: of) : null,
      key: LearnOption.tryParse(j['key']),
      quiet: LearnOption.tryParse(j['quiet']),
      or: [for (final o in asJsonList(j['or'])) ?LearnOption.tryParse(o)],
      position: atKey == null ? null : (chapterKey: atKey, index: _int(at['index']), of: _int(at['of'])),
      chapter: LearnRoadmapChapter.tryParse(j['chapter']),
      dueCount: _int(asJson(j['due'])['count']),
      raw: j,
    );
  }

  /// `pickup` | `freeDone` | `new` | `today`.
  final String mode;

  /// "Start learning Accountancy" | "Pick up Admission of a Partner" | "Today's 10 minutes in Accountancy" | "That was today's free session."
  final String headline;

  /// "Chapter 1 of 14 · Accounting for Partnership: Basic Concepts" | "6 of 16 done" | Free's line.
  final String? line;

  /// "9 due cards first, then new ones here".
  final String? sub;

  /// A pick-up's real "6 of 16".
  final ({int done, int of})? progress;

  /// The one volt key: a run it starts, or (Free after the session) "See Pro" with `go: 'pro'`.
  final LearnOption? key;
  final LearnOption? quiet;

  /// At most two quiet rows, each `{ kind, label, line?, run? | href?, go? }`.
  final List<LearnOption> or;

  /// The chapter the student is in: its key, its 1-based index and the playable count.
  final ({String chapterKey, int index, int of})? position;
  final LearnRoadmapChapter? chapter;

  /// How many due cards today's Start key plays (the `today` mode).
  final int dueCount;
  final Json raw;

  bool get isNew => mode == 'new';
  bool get isPickup => mode == 'pickup';
  bool get isFreeDone => mode == 'freeDone';
}

// ---------------------------------------------------------------- POST /api/learn/runs/preview

/// The chapter a preview is of: `{ key, title, ref, partTitle, unitTitle, state }`.
class LearnChapterHead {
  const LearnChapterHead({required this.key, required this.title, this.ref, this.place, this.partTitle, this.unitTitle, this.state = const LearnState(), this.raw = const {}});

  static LearnChapterHead parse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']) ?? '';
    return LearnChapterHead(
      key: key,
      title: _text(j['title']) ?? key,
      ref: _text(j['ref']),
      place: LearnPlace.tryParse(j['place']),
      partTitle: _text(j['partTitle']),
      unitTitle: _text(j['unitTitle']),
      state: LearnState.parse(j['state']),
      raw: j,
    );
  }

  final String key;
  final String title;
  final String? ref;

  /// "Chapter 5 of 14": the label the page draws (R4 ruling N); none without it.
  final LearnPlace? place;
  final String? partTitle;
  final String? unitTitle;
  final LearnState state;
  final Json raw;
}

/// One pile: `{ id: cards | questions | mistakes | lesson, count, minutes, label, minutesLabel, left, held }`.
class LearnPile {
  const LearnPile({required this.id, this.count = 0, this.minutes = 0, this.label = '', this.minutesLabel, this.left = false, this.held, this.raw = const {}});

  static LearnPile? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnPile(
      id: id,
      count: _int(j['count']),
      minutes: _int(j['minutes']),
      label: _text(j['label']) ?? id,
      minutesLabel: _text(j['minutesLabel']),
      left: _bool(j['left']),
      held: _text(j['held']),
      raw: j,
    );
  }

  final String id;
  final int count;
  final int minutes;

  /// "Key cards", "Questions", "Your mistakes", "Lesson".
  final String label;

  /// "about 5 min".
  final String? minutesLabel;

  /// Left out by the student.
  final bool left;

  /// `free`: Free's session is used today, so Questions and Mistakes wait until tomorrow.
  final String? held;
  final Json raw;
}

/// "Or a quick recap": `{ count, minutes, label }`.
class LearnRecap {
  const LearnRecap({this.count = 0, this.minutes = 0, this.label, this.raw = const {}});

  static LearnRecap? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnRecap(count: _int(j['count']), minutes: _int(j['minutes']), label: _text(j['label']), raw: j);
  }

  final int count;
  final int minutes;
  final String? label;
  final Json raw;
}

/// Free's session for the preview: `{ used, maxMinutes, line }` (null on Pro).
class LearnFreeSession {
  const LearnFreeSession({this.used = false, this.maxMinutes = 10, this.line, this.raw = const {}});

  static LearnFreeSession? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnFreeSession(used: _bool(j['used']), maxMinutes: _int(j['maxMinutes'], 10), line: _text(j['line']), raw: j);
  }

  final bool used;
  final int maxMinutes;
  final String? line;
  final Json raw;
}

/// "Everything in this chapter": `{ cards: { count, open, mustKnow, inRevise }, questions: { linked, total },
/// mistakes: { open }, lesson, print: { mustKnow, locked } }`.
class LearnShelf {
  const LearnShelf({
    this.cards = (count: 0, open: 0, mustKnow: 0, inRevise: 0),
    this.questions = (linked: 0, total: 0),
    this.mistakes = (open: 0),
    this.lesson,
    this.print = (mustKnow: 0, locked: false),
    this.raw = const {},
  });

  static LearnShelf parse(Object? raw) {
    final j = asJson(raw);
    final c = asJson(j['cards']);
    final q = asJson(j['questions']);
    final p = asJson(j['print']);
    return LearnShelf(
      cards: (count: _int(c['count']), open: _int(c['open'], _int(c['count'])), mustKnow: _int(c['mustKnow']), inRevise: _int(c['inRevise'])),
      questions: (linked: _int(q['linked']), total: _int(q['total'])),
      mistakes: (open: _int(asJson(j['mistakes'])['open'])),
      lesson: LearnLesson.tryParse(j['lesson']),
      print: (mustKnow: _int(p['mustKnow']), locked: _bool(p['locked'])),
      raw: j,
    );
  }

  final ({int count, int open, int mustKnow, int inRevise}) cards;
  final ({int linked, int total}) questions;
  final ({int open}) mistakes;
  final LearnLesson? lesson;
  final ({int mustKnow, bool locked}) print;
  final Json raw;
}

/// `POST /api/learn/runs/preview`: the chapter page's numbers for one length and set of piles.
class LearnPreview {
  const LearnPreview({
    this.chapter = const LearnChapterHead(key: '', title: ''),
    this.minutes = 0,
    this.realMinutes,
    this.startLabel,
    this.piles = const [],
    this.leaveOut = const [],
    this.coach,
    this.note,
    this.recap,
    this.shrink,
    this.free,
    this.resume,
    this.firstVisit = false,
    this.asked = 0,
    this.capped,
    this.freeSession,
    this.added,
    this.shelf = const LearnShelf(),
    this.firstUp = const [],
    this.cardsSeen,
    this.raw = const {},
  });

  static LearnPreview parse(Object? raw) {
    final j = asJson(raw);
    final minutes = _int(j['minutes']);
    return LearnPreview(
      chapter: LearnChapterHead.parse(j['chapter']),
      minutes: minutes,
      realMinutes: asInt(j['realMinutes']),
      startLabel: _text(j['startLabel']),
      piles: [for (final p in asJsonList(j['piles'])) ?LearnPile.tryParse(p)],
      leaveOut: asStringList(j['leaveOut']),
      coach: _text(j['coach']),
      note: _text(j['note']),
      recap: LearnRecap.tryParse(j['recap']),
      shrink: LearnShrink.tryParse(j['shrink']),
      free: LearnNote.tryParse(j['free']),
      resume: LearnOpenRun.tryParse(j['resume']),
      firstVisit: _bool(j['firstVisit']),
      asked: _int(j['asked'], minutes),
      capped: LearnCapped.tryParse(j['capped']),
      freeSession: LearnFreeSession.tryParse(j['freeSession']),
      added: LearnChapterLink.tryParse(j['added']),
      shelf: LearnShelf.parse(j['shelf']),
      firstUp: [for (final c in asJsonList(j['firstUp'])) ?LearnCardFace.tryParse(c)],
      cardsSeen: asInt(j['cardsSeen']),
      raw: j,
    );
  }

  final LearnChapterHead chapter;

  /// The length composed (Free: at most 10).
  final int minutes;

  /// What the piles really add up to.
  final int? realMinutes;

  /// "Start 10 minutes" (names the real length).
  final String? startLabel;
  final List<LearnPile> piles;
  final List<String> leaveOut;

  /// "Tap a pile to leave it out."
  final String? coach;

  /// Kept for the record; the B7 page does not print it.
  final String? note;
  final LearnRecap? recap;
  final LearnShrink? shrink;

  /// Free: "Free opens 5 of this chapter's 53 cards." or, after the day's session, the Key cards only line.
  final LearnNote? free;

  /// The chapter's unfinished mix or cards run (24 hours).
  final LearnOpenRun? resume;
  final bool firstVisit;

  /// The length the student chose.
  final int asked;
  final LearnCapped? capped;
  final LearnFreeSession? freeSession;

  /// The next chapter, once added (`addNext: true`).
  final LearnChapterLink? added;
  final LearnShelf shelf;

  /// "First up" (R2 ruling 9): the first three Key cards this run opens with, as small cards; empty when it starts with none.
  final List<LearnCardFace> firstUp;

  /// The chapter's cards this student has seen; null from an older server (then "not a first visit" stands in).
  final int? cardsSeen;
  final Json raw;

  LearnPile? pile(String id) {
    for (final p in piles) {
      if (p.id == id) return p;
    }
    return null;
  }
}

// ---------------------------------------------------------------- POST /api/learn/runs (and GET /api/learn/runs/:id)

/// A run's chapter: `{ key, title, ref, partTitle, number }`.
class LearnRunChapter {
  const LearnRunChapter({required this.key, required this.title, this.ref, this.partTitle, this.number, this.place, this.spans = false, this.raw = const {}});

  static LearnRunChapter parse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']) ?? '';
    return LearnRunChapter(
      key: key,
      title: _text(j['title']) ?? key,
      ref: _text(j['ref']),
      partTitle: _text(j['partTitle']),
      number: asInt(j['number']),
      place: LearnPlace.tryParse(j['place']),
      spans: _bool(j['spans']),
      raw: j,
    );
  }

  final String key;
  final String title;

  /// A run over several chapters (Revise's due cards, a Find set): the server heads it "Revise" with no place, no ref and no
  /// chapter bar, and its Close goes to Learn home (round 5, LK45 fix 4). `key` stays the first card's, for routing only.
  final bool spans;

  /// "Ch 2": the NCERT number, for source lines only.
  final String? ref;
  final String? partTitle;
  final int? number;

  /// "Chapter 5 of 14": how the rails name the chapter (R4 ruling N); none without it.
  final LearnPlace? place;
  final Json raw;
}

/// A question's option as served: `{ key, text }` (keys upper case; a repeated "A. " already stripped by the server).
class LearnQuestionOption {
  const LearnQuestionOption({required this.key, required this.text});

  static LearnQuestionOption? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnQuestionOption(key: key.toUpperCase(), text: asStringOr(j['text'], ''));
  }

  final String key;
  final String text;
}

/// A question as a run serves it: `{ id, body, options }`. No key is ever sent before an answer.
class LearnQuestion {
  const LearnQuestion({required this.id, this.body = '', this.options = const [], this.raw = const {}});

  static LearnQuestion? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnQuestion(id: id, body: asStringOr(j['body'], ''), options: [for (final o in asJsonList(j['options'])) ?LearnQuestionOption.tryParse(o)], raw: j);
  }

  final String id;
  final String body;
  final List<LearnQuestionOption> options;
  final Json raw;
}

/// Where an old mistake was made: `{ where, when, label }` ("You missed this in Mock 4 on 24 Oct").
class LearnMistake {
  const LearnMistake({this.where, this.when, this.label, this.raw = const {}});

  static LearnMistake? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnMistake(where: _text(j['where']), when: _text(j['when']), label: _text(j['label']), raw: j);
  }

  final String? where;
  final String? when;
  final String? label;
  final Json raw;
}

/// One item of a run or feed: a card, a question or a lesson. Every item carries its `seconds`.
sealed class LearnItem {
  const LearnItem({required this.id, this.seconds = 0, this.raw = const {}});

  /// An item the app can draw, else null (an unknown type, a card that does not parse, a question without an id).
  static LearnItem? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    final seconds = _int(j['seconds']);
    switch (_text(j['type'])) {
      case 'card':
        final card = KeyCard.tryParse(j['card']);
        if (card == null) return null;
        return LearnCardItem(
          id: id,
          card: card,
          stage: _text(j['stage']) ?? 'new',
          look: _bool(j['look']),
          recap: _bool(j['recap']),
          reason: _text(j['reason']),
          returns: LearnReturns.tryParse(j['returns']),
          seconds: seconds,
          raw: j,
        );
      case 'question':
        final question = LearnQuestion.tryParse(j['question']);
        if (question == null) return null;
        return LearnQuestionItem(
          id: id,
          question: question,
          origin: _text(j['origin']) ?? 'chapter',
          mistake: LearnMistake.tryParse(j['mistake']),
          seconds: seconds,
          raw: j,
        );
      case 'lesson':
        final lesson = LearnLesson.tryParse(j['lesson']);
        if (lesson == null) return null;
        return LearnLessonItem(id: id, lesson: lesson, seconds: seconds, raw: j);
    }
    return null;
  }

  final String id;
  final int seconds;
  final Json raw;
}

/// When each rating would bring a card back, in the server's words (round 5, LK38; the web's `returnWords`):
/// `{ missed, got, easy }`, e.g. `{ missed: 'in this run, then tomorrow', got: 'in 3 days', easy: 'in 8 days' }`. A key's second line is
/// "back " and these words; the stamp after a rating is "Back " and them. Absent for a look, a recap, a feed and a card back from
/// earlier: those keys have no second line.
class LearnReturns {
  const LearnReturns({this.missed, this.got, this.easy});

  static LearnReturns? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final missed = _text(j['missed']);
    final got = _text(j['got']);
    final easy = _text(j['easy']);
    if (missed == null && got == null && easy == null) return null;
    return LearnReturns(missed: missed, got: got, easy: easy);
  }

  final String? missed;
  final String? got;
  final String? easy;

  /// The words for a rating (1 Missed it, 3 Got it, 4 Easy); null when the server gave none.
  String? forRating(int rating) => switch (rating) {
    1 => missed,
    3 => got,
    4 => easy,
    _ => null,
  };
}

/// A Key card: `{ id, type: 'card', stage, card, look, recap, reason?, returns?, seconds }`.
class LearnCardItem extends LearnItem {
  const LearnCardItem({
    required super.id,
    required this.card,
    this.stage = 'new',
    this.look = false,
    this.recap = false,
    this.reason,
    this.returns,
    super.seconds,
    super.raw,
  });

  final KeyCard card;

  /// new | due | again | later.
  final String stage;

  /// Shown without a rating (Free past its ratings, a recap card).
  final bool look;
  final bool recap;

  /// A copy put back in: `earlier` ("Back from earlier") or `line` ("The line you needed").
  final String? reason;

  /// What each rating key promises (see [LearnReturns]); null when the card has no words.
  final LearnReturns? returns;

  /// This card with other rating words (a card moved closer after Missed: the server's fresh words).
  LearnCardItem withReturns(LearnReturns? words) =>
      LearnCardItem(id: id, card: card, stage: stage, look: look, recap: recap, reason: reason, returns: words, seconds: seconds, raw: raw);
}

/// A question: `{ id, type: 'question', origin: mistake | linked | chapter, question, mistake, seconds }`.
class LearnQuestionItem extends LearnItem {
  const LearnQuestionItem({required super.id, required this.question, this.origin = 'chapter', this.mistake, super.seconds, super.raw});

  final LearnQuestion question;
  final String origin;

  /// Only for an old mistake (origin `mistake`).
  final LearnMistake? mistake;

  bool get isMistake => origin == 'mistake';
}

/// A lesson: `{ id, type: 'lesson', lesson: { id, title, minutes }, seconds }`.
class LearnLessonItem extends LearnItem {
  const LearnLessonItem({required super.id, required this.lesson, super.seconds, super.raw});

  final LearnLesson lesson;
}

/// `POST /api/learn/runs` and `GET /api/learn/runs/:id`: a run or a feed, with only the items not done when it is picked up.
class LearnRun {
  const LearnRun({
    required this.id,
    this.kind = LearnKinds.mix,
    this.chapter = const LearnRunChapter(key: '', title: ''),
    this.minutes = 0,
    this.asked = 0,
    this.items = const [],
    this.revisePile = 0,
    this.resumed,
    this.added,
    this.looks,
    this.free,
    this.capped,
    this.shrink,
    this.raw = const {},
  });

  static LearnRun parse(Object? raw) {
    final j = asJson(raw);
    final minutes = _int(j['minutes']);
    final resumed = asJson(j['resumed']);
    return LearnRun(
      id: _text(j['id']) ?? '',
      kind: _text(j['kind']) ?? LearnKinds.mix,
      chapter: LearnRunChapter.parse(j['chapter']),
      minutes: minutes,
      asked: _int(j['asked'], minutes),
      items: [for (final i in asJsonList(j['items'])) ?LearnItem.tryParse(i)],
      revisePile: _int(asJson(j['revisePile'])['count']),
      resumed: j['resumed'] is Map ? (done: _int(resumed['done']), of: _int(resumed['of'])) : null,
      added: LearnChapterLink.tryParse(j['added']),
      looks: LearnNote.tryParse(j['looks']),
      free: LearnNote.tryParse(j['free']),
      capped: LearnCapped.tryParse(j['capped']),
      shrink: LearnShrink.tryParse(j['shrink']),
      raw: j,
    );
  }

  final String id;
  final String kind;
  final LearnRunChapter chapter;

  /// The real length (a shrunk run says less than [asked]).
  final int minutes;
  final int asked;
  final List<LearnItem> items;

  /// `revisePile.count`: the cards this run sent to Revise (every rated card: Missed it, Got it and Easy all schedule it).
  final int revisePile;

  /// A pick-up: `{ done, of }` over the whole run; [items] are only the ones not done.
  final ({int done, int of})? resumed;

  /// The next chapter added to a short one.
  final LearnChapterLink? added;

  /// Free past its ratings: the rest of the cards show without ratings.
  final LearnNote? looks;

  /// Free after the day's session: "Key cards only".
  final LearnNote? free;
  final LearnCapped? capped;
  final LearnShrink? shrink;
  final Json raw;

  bool get isFeed => kind == LearnKinds.feed;

  int indexOf(String itemId) => items.indexWhere((i) => i.id == itemId);

  LearnItem? item(String itemId) {
    final at = indexOf(itemId);
    return at < 0 ? null : items[at];
  }
}

// ---------------------------------------------------------------- POST /api/learn/runs/:id/answer

/// "The line you needed": `{ card, source, collapsed }`, or for a card Free cannot open `{ card: stub, locked: true, text }`.
class LearnNeededLine {
  const LearnNeededLine({this.card, this.lockedCard, this.source, this.collapsed = false, this.locked = false, this.text, this.raw = const {}});

  static LearnNeededLine? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final locked = _bool(j['locked']);
    final card = locked ? null : KeyCard.tryParse(j['card']);
    final stub = locked ? LearnLockedCard.tryParse(j['card']) : null;
    if (card == null && !locked) return null;
    return LearnNeededLine(card: card, lockedCard: stub, source: _text(j['source']), collapsed: _bool(j['collapsed']), locked: locked, text: _text(j['text']), raw: j);
  }

  /// The card with NCERT's line (null when [locked]).
  final KeyCard? card;
  final LearnLockedCard? lockedCard;

  /// linked | matched.
  final String? source;

  /// Under a fixed mistake the line starts folded.
  final bool collapsed;
  final bool locked;

  /// The locked line: "The line for this is in a card that is part of Pro."
  final String? text;
  final Json raw;
}

/// An item put back in after a wrong answer or a Missed: `{ itemId, at, item, moved? }` (moved: the card was ahead and came
/// closer, no copy).
class LearnReinsert {
  const LearnReinsert({required this.itemId, required this.at, this.item, this.moved = false, this.raw = const {}});

  static LearnReinsert? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['itemId']);
    if (id == null) return null;
    return LearnReinsert(itemId: id, at: _int(j['at']), item: LearnItem.tryParse(j['item']), moved: _bool(j['moved']), raw: j);
  }

  final String itemId;
  final int at;
  final LearnItem? item;
  final bool moved;
  final Json raw;
}

/// `POST /api/learn/runs/:id/answer`: `{ correct, key, choice, explanation, fixed, fixedText, retired?, line, reinsert }`.
class LearnAnswer {
  const LearnAnswer({
    required this.correct,
    this.key,
    this.choice,
    this.explanation = '',
    this.fixed = false,
    this.fixedText,
    this.retired,
    this.line,
    this.reinsert,
    this.raw = const {},
  });

  static LearnAnswer parse(Object? raw) {
    final j = asJson(raw);
    return LearnAnswer(
      correct: _bool(j['correct']),
      key: _text(j['key'])?.toUpperCase(),
      choice: _text(j['choice'])?.toUpperCase(),
      explanation: asStringOr(j['explanation'], ''),
      fixed: _bool(j['fixed']),
      fixedText: _text(j['fixedText']),
      retired: asBool(j['retired']),
      line: LearnNeededLine.tryParse(j['line']),
      reinsert: LearnReinsert.tryParse(j['reinsert']),
      raw: j,
    );
  }

  final bool correct;

  /// The right key, sent only now.
  final String? key;

  /// The key the student sent (a replay echoes the first answer's).
  final String? choice;
  final String explanation;

  /// An old mistake answered right.
  final bool fixed;

  /// "Right this time. Back on Wed to check it held." | "Fixed. You missed this in Mock 3 on 16 Oct."
  final String? fixedText;

  /// A retried mistake that Revise now retires (null for a question that was not a mistake).
  final bool? retired;
  final LearnNeededLine? line;
  final LearnReinsert? reinsert;
  final Json raw;
}

// ---------------------------------------------------------------- POST /api/learn/runs/:id/rate (and Keep)

/// `POST /api/learn/runs/:id/rate`: `{ ok, stamp, revisePile, limit, reinsert }`; Keep adds `kept`, `line`; a replay `replay`;
/// a card back again `again`; a look `saved: false, look: true`.
class LearnRateResult {
  const LearnRateResult({
    this.ok = false,
    this.stamp,
    this.line,
    this.kept = false,
    this.revisePile = 0,
    this.limit,
    this.reinsert,
    this.replay = false,
    this.again = false,
    this.saved,
    this.look = false,
    this.raw = const {},
  });

  static LearnRateResult parse(Object? raw) {
    final j = asJson(raw);
    return LearnRateResult(
      ok: _bool(j['ok']),
      stamp: _text(j['stamp']),
      line: _text(j['line']),
      kept: _bool(j['kept']),
      revisePile: _int(asJson(j['revisePile'])['count']),
      limit: LearnNote.tryParse(j['limit']),
      reinsert: LearnReinsert.tryParse(j['reinsert']),
      replay: _bool(j['replay']),
      again: _bool(j['again']),
      saved: asBool(j['saved']),
      look: _bool(j['look']),
      raw: j,
    );
  }

  final bool ok;

  /// "Back Tue" | "Back in 20 days" | "Back later in this run" | "In Revise" | "Due now".
  final String? stamp;

  /// Keep's line: "In Revise" | "In Revise, back Wed" | "In Revise, due now".
  final String? line;
  final bool kept;

  /// `revisePile.count` after this rating.
  final int revisePile;

  /// Free's ratings are used: the cards continue as looks.
  final LearnNote? limit;

  /// Missed: the card comes back later in this run.
  final LearnReinsert? reinsert;
  final bool replay;
  final bool again;

  /// false for a look (nothing scheduled); null when the server did not say.
  final bool? saved;
  final bool look;
  final Json raw;
}

// ---------------------------------------------------------------- GET /api/learn/runs/:id/end

/// How far a run got: `{ reached, of, minutes }` ("You stopped at 8 of 21." / "All 21 done in 9 min.").
class LearnDone {
  const LearnDone({this.reached = 0, this.of = 0, this.minutes = 1, this.raw = const {}});

  static LearnDone parse(Object? raw) {
    final j = asJson(raw);
    return LearnDone(reached: _int(j['reached']), of: _int(j['of']), minutes: _int(j['minutes'], 1), raw: j);
  }

  final int reached;
  final int of;
  final int minutes;
  final Json raw;

  bool get all => of > 0 && reached >= of;
}

/// An end's numbers: `{ cards, questions, fixed, mistakes, detail: { cards, questions, fixed } }`.
class LearnNumbers {
  const LearnNumbers({this.cards = 0, this.questions = 0, this.fixed = 0, this.mistakes = 0, this.detail = (cards: null, questions: null, fixed: null), this.raw = const {}});

  static LearnNumbers parse(Object? raw) {
    final j = asJson(raw);
    final d = asJson(j['detail']);
    return LearnNumbers(
      cards: _int(j['cards']),
      questions: _int(j['questions']),
      fixed: _int(j['fixed']),
      mistakes: _int(j['mistakes']),
      detail: (cards: _text(d['cards']), questions: _text(d['questions']), fixed: _text(d['fixed'])),
      raw: j,
    );
  }

  final int cards;
  final int questions;
  final int fixed;
  final int mistakes;

  /// "1 got it, 1 easy, 1 missed", "1 of 1 right", "1 of 2, 1 still open".
  final ({String? cards, String? questions, String? fixed}) detail;
  final Json raw;
}

/// A hairline row of an end: `{ label, text }` ("Cards" / "9 got it, 2 easy, 2 missed").
class LearnEndLine {
  const LearnEndLine({required this.label, required this.text, this.raw = const {}});

  static LearnEndLine? tryParse(Object? raw) {
    final j = asJson(raw);
    final label = _text(j['label']);
    if (label == null) return null;
    return LearnEndLine(label: label, text: asStringOr(j['text'], ''), raw: j);
  }

  final String label;
  final String text;
  final Json raw;
}

/// A return-day group of the Revise pile: `{ label, count }` ("back tomorrow" 1).
class LearnPileGroup {
  const LearnPileGroup({required this.label, this.count = 0, this.raw = const {}});

  static LearnPileGroup? tryParse(Object? raw) {
    final j = asJson(raw);
    final label = _text(j['label']);
    if (label == null) return null;
    return LearnPileGroup(label: label, count: _int(j['count']), raw: j);
  }

  final String label;
  final int count;
  final Json raw;
}

/// The feed end's kept pile: `{ count, cards, groups, stamp, line }` (line: "6 kept. They are first in Revise.").
class LearnKept {
  const LearnKept({this.count = 0, this.cards = const [], this.groups = const [], this.stamp, this.line, this.raw = const {}});

  static LearnKept parse(Object? raw) {
    final j = asJson(raw);
    return LearnKept(
      count: _int(j['count']),
      cards: [for (final c in asJsonList(j['cards'])) ?KeyCard.tryParse(c)],
      groups: [for (final g in asJsonList(j['groups'])) ?LearnPileGroup.tryParse(g)],
      stamp: _text(j['stamp']),
      line: _text(j['line']),
      raw: j,
    );
  }

  final int count;

  /// Up to five real cards, in the order kept.
  final List<KeyCard> cards;
  final List<LearnPileGroup> groups;
  final String? stamp;
  final String? line;
  final Json raw;
}

/// The feed end's next chapter: `{ label: 'Next chapter: ...', key, run }` (run null on Free after the day's session).
class LearnFeedNext {
  const LearnFeedNext({required this.label, required this.key, this.title, this.place, this.run, this.raw = const {}});

  static LearnFeedNext? tryParse(Object? raw) {
    final j = asJson(raw);
    final label = _text(j['label']);
    final key = _text(j['key']);
    if (label == null || key == null) return null;
    return LearnFeedNext(label: label, key: key, title: _text(j['title']), place: LearnPlace.tryParse(j['place']), run: LearnRunSpec.tryParse(j['run']), raw: j);
  }

  /// "Next chapter · 10 min".
  final String label;
  final String key;

  /// The chapter's own title (the label no longer carries it).
  final String? title;
  final LearnPlace? place;
  final LearnRunSpec? run;
  final Json raw;
}

/// "Revise 3 due cards, about 1 min": `{ count, minutes, label, run }`.
class LearnDueOffer {
  const LearnDueOffer({required this.label, this.count = 0, this.minutes = 0, this.run, this.raw = const {}});

  static LearnDueOffer? tryParse(Object? raw) {
    final j = asJson(raw);
    final label = _text(j['label']);
    if (label == null) return null;
    return LearnDueOffer(label: label, count: _int(j['count']), minutes: _int(j['minutes']), run: LearnRunSpec.tryParse(j['run']), raw: j);
  }

  final String label;
  final int count;
  final int minutes;
  final LearnRunSpec? run;
  final Json raw;
}

/// The Explore feed's end: `{ title, done, kept, lines, lead, free, next, dueOffer }`.
class LearnFeedEnd {
  const LearnFeedEnd({
    this.title = '',
    this.done = const LearnDone(),
    this.kept = const LearnKept(),
    this.lines = const [],
    this.lead,
    this.free,
    this.next,
    this.dueOffer,
    this.raw = const {},
  });

  static LearnFeedEnd? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnFeedEnd(
      title: asStringOr(j['title'], ''),
      done: LearnDone.parse(j['done']),
      kept: LearnKept.parse(j['kept']),
      lines: [for (final l in asJsonList(j['lines'])) ?LearnEndLine.tryParse(l)],
      lead: LearnOption.tryParse(j['lead']),
      free: LearnNote.tryParse(j['free']),
      next: LearnFeedNext.tryParse(j['next']),
      dueOffer: LearnDueOffer.tryParse(j['dueOffer']),
      raw: j,
    );
  }

  final String title;
  final LearnDone done;
  final LearnKept kept;
  final List<LearnEndLine> lines;

  /// "Another 10 minutes" (fresh); null on Free after the day's session.
  final LearnOption? lead;
  final LearnNote? free;
  final LearnFeedNext? next;
  final LearnDueOffer? dueOffer;
  final Json raw;
}

/// A level run's pick: `{ chapterKey, title, right, of }`.
class LearnLevel {
  const LearnLevel({required this.chapterKey, required this.title, this.right = 0, this.of = 0, this.raw = const {}});

  static LearnLevel? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['chapterKey']);
    if (key == null) return null;
    return LearnLevel(chapterKey: key, title: _text(j['title']) ?? key, right: _int(j['right']), of: _int(j['of']), raw: j);
  }

  final String chapterKey;
  final String title;
  final int right;
  final int of;
  final Json raw;
}

/// `GET /api/learn/runs/:id/end` (idempotent: a second read returns the same numbers).
class LearnEnd {
  const LearnEnd({
    this.title = '',
    this.done = const LearnDone(),
    this.numbers = const LearnNumbers(),
    this.lines = const [],
    this.revisePile = const [],
    this.reviseCards = const [],
    this.moved,
    this.free,
    this.lead,
    this.options = const [],
    this.feed,
    this.level,
    this.stopped = false,
    this.progress,
    this.chapter,
    this.raw = const {},
  });

  static LearnEnd parse(Object? raw) {
    final j = asJson(raw);
    return LearnEnd(
      title: asStringOr(j['title'], ''),
      done: LearnDone.parse(j['done']),
      numbers: LearnNumbers.parse(j['numbers']),
      lines: [for (final l in asJsonList(j['lines'])) ?LearnEndLine.tryParse(l)],
      revisePile: [for (final g in asJsonList(j['revisePile'])) ?LearnPileGroup.tryParse(g)],
      reviseCards: [for (final c in asJsonList(j['reviseCards'])) ?LearnCardFace.tryParse(c)],
      moved: _text(j['moved']),
      free: LearnNote.tryParse(j['free']),
      lead: LearnOption.tryParse(j['lead']),
      options: [for (final o in asJsonList(j['options'])) ?LearnOption.tryParse(o)],
      feed: LearnFeedEnd.tryParse(j['feed']),
      level: LearnLevel.tryParse(j['level']),
      stopped: _bool(j['stopped']),
      progress: LearnEndProgress.tryParse(j['progress']),
      chapter: LearnEndChapter.tryParse(j['chapter']),
      raw: j,
    );
  }

  /// "10 minutes on Admission of a Partner" | "Quick recap of ...".
  final String title;
  final LearnDone done;
  final LearnNumbers numbers;
  final List<LearnEndLine> lines;

  /// The Revise pile by return day.
  final List<LearnPileGroup> revisePile;

  /// The cards rated Got it or Easy, in run order, at most 4 (the end's fan).
  final List<LearnCardFace> reviseCards;

  /// The chapter's state moved ("Admission of a Partner moved to Getting there").
  final String? moved;

  /// Free with rating looks: what Free opened of the chapter.
  final LearnNote? free;

  /// The lead key (Free after the day's session: `{ line, label: 'See Pro', href: '/pricing', go: 'pro' }`).
  final LearnOption? lead;
  final List<LearnOption> options;

  /// Only for a feed.
  final LearnFeedEnd? feed;

  /// Only for a level run.
  final LearnLevel? level;

  /// The run was stopped part way (`GET /end?stop=1`) and is still open: Continue resumes it (R2 ruling 6).
  final bool stopped;

  /// The chapter's cards seen, before this run and now: the end's bar grows from [LearnEndProgress.before] to `seen`.
  final LearnEndProgress? progress;

  /// The chapter this run was in: `{ key, title, place }`.
  final LearnEndChapter? chapter;
  final Json raw;
}

/// The end's bar: `{ of, seen, before, open? }` (`open`: Free's open cards in the chapter, so the bar can say the rest open with Pro).
class LearnEndProgress {
  const LearnEndProgress({this.of = 0, this.seen = 0, this.before = 0, this.open, this.raw = const {}});

  static LearnEndProgress? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return LearnEndProgress(of: _int(j['of']), seen: _int(j['seen']), before: _int(j['before']), open: asInt(j['open']), raw: j);
  }

  final int of;
  final int seen;
  final int before;
  final int? open;
  final Json raw;
}

/// The end's chapter: `{ key, title, place }`.
class LearnEndChapter {
  const LearnEndChapter({required this.key, required this.title, this.place, this.spans = false, this.raw = const {}});

  static LearnEndChapter? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnEndChapter(key: key, title: _text(j['title']) ?? key, place: LearnPlace.tryParse(j['place']), spans: _bool(j['spans']), raw: j);
  }

  final String key;
  final String title;
  final LearnPlace? place;

  /// A run over several chapters: "Revise", no place (see [LearnRunChapter.spans]).
  final bool spans;
  final Json raw;
}

// ---------------------------------------------------------------- GET /api/learn/cards

/// `counts`: `{ total, all, must, revise, missed, due }` (`total` is every card of the chapter, `all` the ones listed).
class LearnCardCounts {
  const LearnCardCounts({this.total = 0, this.all = 0, this.must = 0, this.revise = 0, this.missed = 0, this.due = 0, this.raw = const {}});

  static LearnCardCounts parse(Object? raw) {
    final j = asJson(raw);
    final all = _int(j['all']);
    return LearnCardCounts(
      total: _int(j['total'], all),
      all: all,
      must: _int(j['must']),
      revise: _int(j['revise']),
      missed: _int(j['missed']),
      due: _int(j['due']),
      raw: j,
    );
  }

  final int total;
  final int all;
  final int must;
  final int revise;
  final int missed;
  final int due;
  final Json raw;

  /// The count of one filter (all | must | revise | missed | due).
  int of(String filter) => switch (filter) {
    'must' => must,
    'revise' => revise,
    'missed' => missed,
    'due' => due,
    _ => all,
  };
}

/// A card row: a whole [card] with `inRevise`, `missedLately` and `locked`; a locked row may come as a [stub].
class LearnCardRow {
  const LearnCardRow({this.card, this.stub, this.inRevise = false, this.missedLately = false, this.locked = false, this.raw = const {}});

  static LearnCardRow? tryParse(Object? raw) {
    final j = asJson(raw);
    final card = KeyCard.tryParse(j);
    final stub = card == null && _bool(j['locked']) ? LearnLockedCard.tryParse(j) : null;
    if (card == null && stub == null) return null;
    return LearnCardRow(card: card, stub: stub, inRevise: _bool(j['inRevise']), missedLately: _bool(j['missedLately']), locked: _bool(j['locked'], card == null), raw: j);
  }

  final KeyCard? card;
  final LearnLockedCard? stub;
  final bool inRevise;
  final bool missedLately;
  final bool locked;
  final Json raw;

  String get id => card?.id ?? stub!.id;
}

/// A section of the Cards view: `{ title, cards }` (the book's section).
class LearnCardSection {
  const LearnCardSection({required this.title, this.cards = const [], this.raw = const {}});

  static LearnCardSection parse(Object? raw) {
    final j = asJson(raw);
    return LearnCardSection(title: _text(j['title']) ?? '', cards: [for (final c in asJsonList(j['cards'])) ?LearnCardRow.tryParse(c)], raw: j);
  }

  final String title;
  final List<LearnCardRow> cards;
  final Json raw;
}

/// `{ key, title, ref }`.
class LearnChapterRef {
  const LearnChapterRef({required this.key, required this.title, this.ref, this.place, this.raw = const {}});

  static LearnChapterRef parse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']) ?? '';
    return LearnChapterRef(key: key, title: _text(j['title']) ?? key, ref: _text(j['ref']), place: LearnPlace.tryParse(j['place']), raw: j);
  }

  final String key;
  final String title;
  final String? ref;
  final LearnPlace? place;
  final Json raw;
}

/// `GET /api/learn/cards?chapter=&filter=`: the chapter's Cards view.
class LearnChapterCards {
  const LearnChapterCards({
    this.chapter = const LearnChapterRef(key: '', title: ''),
    this.plan = 'free',
    this.counts = const LearnCardCounts(),
    this.sections = const [],
    this.lockedCount = 0,
    this.lockedLine,
    this.raw = const {},
  });

  static LearnChapterCards parse(Object? raw) {
    final j = asJson(raw);
    return LearnChapterCards(
      chapter: LearnChapterRef.parse(j['chapter']),
      plan: _text(j['plan']) ?? 'free',
      counts: LearnCardCounts.parse(j['counts']),
      sections: [for (final s in asJsonList(j['sections'])) LearnCardSection.parse(s)],
      lockedCount: _int(j['lockedCount']),
      lockedLine: _text(j['lockedLine']),
      raw: j,
    );
  }

  final LearnChapterRef chapter;
  final String plan;
  final LearnCardCounts counts;
  final List<LearnCardSection> sections;

  /// Cards Free cannot open in this chapter.
  final int lockedCount;

  /// "48 more cards in this chapter. Pro opens every card in every chapter and keeps them on a schedule."
  final String? lockedLine;
  final Json raw;

  bool get isPro => plan == 'pro';

  List<LearnCardRow> get cards => [for (final s in sections) ...s.cards];
}

/// One chapter of Find's shelf: `{ key, title, ref, counts, cards }`.
class LearnCardsChapter {
  const LearnCardsChapter({required this.key, required this.title, this.ref, this.place, this.counts = const LearnCardCounts(), this.cards = const [], this.raw = const {}});

  static LearnCardsChapter? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnCardsChapter(
      key: key,
      title: _text(j['title']) ?? key,
      ref: _text(j['ref']),
      place: LearnPlace.tryParse(j['place']),
      counts: LearnCardCounts.parse(j['counts']),
      cards: [for (final c in asJsonList(j['cards'])) ?LearnCardRow.tryParse(c)],
      raw: j,
    );
  }

  final String key;
  final String title;
  final String? ref;
  final LearnPlace? place;
  final LearnCardCounts counts;
  final List<LearnCardRow> cards;
  final Json raw;
}

/// `GET /api/learn/cards?subject=&filter=`: Find's shelf over a whole subject in one read.
class LearnSubjectCards {
  const LearnSubjectCards({this.plan = 'free', this.filter = 'all', this.lockedCount = 0, this.chapters = const [], this.raw = const {}});

  static LearnSubjectCards parse(Object? raw) {
    final j = asJson(raw);
    return LearnSubjectCards(
      plan: _text(j['plan']) ?? 'free',
      filter: _text(j['filter']) ?? 'all',
      lockedCount: _int(j['lockedCount']),
      chapters: [for (final c in asJsonList(j['chapters'])) ?LearnCardsChapter.tryParse(c)],
      raw: j,
    );
  }

  final String plan;
  final String filter;
  final int lockedCount;
  final List<LearnCardsChapter> chapters;
  final Json raw;

  bool get isPro => plan == 'pro';

  List<LearnCardRow> get cards => [for (final c in chapters) ...c.cards];
}

// ---------------------------------------------------------------- GET /api/learn/shelves

/// `GET /api/learn/shelves?subject=`: `{ due: { count, minutes, all, subjects, bySubject }, missed: { count, days },
/// revise: { count, chapters }, must: { count, chapters } }`.
class LearnShelves {
  const LearnShelves({
    this.due = (count: 0, minutes: 0, all: 0, subjects: 0, bySubject: const <String, int>{}),
    this.missed = (count: 0, days: 7),
    this.revise = (count: 0, chapters: 0),
    this.must = (count: 0, chapters: 0),
    this.raw = const {},
  });

  static LearnShelves parse(Object? raw) {
    final j = asJson(raw);
    final d = asJson(j['due']);
    final m = asJson(j['missed']);
    final r = asJson(j['revise']);
    final k = asJson(j['must']);
    return LearnShelves(
      due: (
        count: _int(d['count']),
        minutes: _int(d['minutes']),
        all: _int(d['all']),
        subjects: _int(d['subjects']),
        bySubject: {
          for (final e in asJson(d['bySubject']).entries)
            e.key: ?asInt(e.value),
        },
      ),
      missed: (count: _int(m['count']), days: _int(m['days'], 7)),
      revise: (count: _int(r['count']), chapters: _int(r['chapters'])),
      must: (count: _int(k['count']), chapters: _int(k['chapters'])),
      raw: j,
    );
  }

  /// This subject's due cards ([count]) and minutes; [all] over every subject; [bySubject] each subject's own count.
  final ({int count, int minutes, int all, int subjects, Map<String, int> bySubject}) due;
  final ({int count, int days}) missed;
  final ({int count, int chapters}) revise;
  final ({int count, int chapters}) must;
  final Json raw;

  /// The Key cards due today over every subject: the server's own `due.all` (R3 ruling C1: one function behind the home and
  /// the shelves, the sum of `due.bySubject`), so a badge, the subject rows and the Revise row agree; the sum of the subjects
  /// only when a body carries no `all` (the web's `dueTotal`).
  int get dueTotal {
    final d = asJson(raw['due']);
    if (asInt(d['all']) != null) return due.all;
    return due.bySubject.isNotEmpty ? due.bySubject.values.fold(0, (s, n) => s + n) : due.all;
  }
}

// ---------------------------------------------------------------- GET /api/learn/search

/// A matched stretch of a field: `{ start, end }` (UTF-16 offsets into the field's text).
class LearnSpan {
  const LearnSpan(this.start, this.end);

  static LearnSpan? tryParse(Object? raw) {
    final j = asJson(raw);
    final start = asInt(j['start']);
    final end = asInt(j['end']);
    if (start == null || end == null || end <= start || start < 0) return null;
    return LearnSpan(start, end);
  }

  final int start;
  final int end;

  @override
  bool operator ==(Object other) => other is LearnSpan && other.start == start && other.end == end;

  @override
  int get hashCode => Object.hash(start, end);

  @override
  String toString() => 'LearnSpan($start, $end)';
}

/// What matched, per field: `{ title: [spans], name: [spans] }` for a chapter, `{ title }` for a lesson,
/// `{ front, quote, kind }` for a card.
class LearnMatch {
  const LearnMatch(this.fields);

  static const LearnMatch none = LearnMatch({});

  static LearnMatch parse(Object? raw) {
    final j = asJson(raw);
    return LearnMatch({
      for (final e in j.entries)
        if (e.value is List) e.key: [for (final s in e.value as List) ?LearnSpan.tryParse(s)],
    });
  }

  final Map<String, List<LearnSpan>> fields;

  List<LearnSpan> spans(String field) => fields[field] ?? const [];

  bool get isEmpty => fields.values.every((s) => s.isEmpty);
}

class LearnSearchChapter {
  const LearnSearchChapter({required this.key, required this.title, this.cards = 0, this.match = LearnMatch.none, this.raw = const {}});

  static LearnSearchChapter? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    return LearnSearchChapter(key: key, title: _text(j['title']) ?? key, cards: _int(j['cards']), match: LearnMatch.parse(j['match']), raw: j);
  }

  final String key;
  final String title;
  final int cards;
  final LearnMatch match;
  final Json raw;
}

class LearnSearchLesson {
  const LearnSearchLesson({required this.id, required this.title, this.chapterKey, this.match = LearnMatch.none, this.raw = const {}});

  static LearnSearchLesson? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnSearchLesson(id: id, title: _text(j['title']) ?? id, chapterKey: _text(j['chapterKey']), match: LearnMatch.parse(j['match']), raw: j);
  }

  final String id;
  final String title;
  final String? chapterKey;
  final LearnMatch match;
  final Json raw;
}

/// A card hit: `{ card, chapterKey, chapterTitle, match, locked }`; a locked hit is a [stub] with no match.
class LearnSearchCard {
  const LearnSearchCard({this.card, this.stub, this.chapterKey, this.chapterTitle, this.match = LearnMatch.none, this.locked = false, this.raw = const {}});

  static LearnSearchCard? tryParse(Object? raw) {
    final j = asJson(raw);
    final locked = _bool(j['locked']);
    final card = KeyCard.tryParse(j['card']);
    final stub = card == null ? LearnLockedCard.tryParse(j['card']) : null;
    if (card == null && stub == null) return null;
    return LearnSearchCard(
      card: card,
      stub: stub,
      chapterKey: _text(j['chapterKey']) ?? card?.chapterKey,
      chapterTitle: _text(j['chapterTitle']),
      match: LearnMatch.parse(j['match']),
      locked: locked || card == null,
      raw: j,
    );
  }

  final KeyCard? card;
  final LearnLockedCard? stub;
  final String? chapterKey;
  final String? chapterTitle;
  final LearnMatch match;
  final bool locked;
  final Json raw;

  String get id => card?.id ?? stub!.id;
}

/// `GET /api/learn/search?subject=&q=`: `{ query, tooShort, chapters, lessons, cards, more, total, cardCounts }`.
class LearnSearch {
  const LearnSearch({
    this.query = '',
    this.tooShort = false,
    this.chapters = const [],
    this.lessons = const [],
    this.cards = const [],
    this.more = 0,
    this.total = 0,
    this.cardCounts = const {},
    this.raw = const {},
  });

  static LearnSearch parse(Object? raw) {
    final j = asJson(raw);
    return LearnSearch(
      query: asStringOr(j['query'], ''),
      tooShort: _bool(j['tooShort']),
      chapters: [for (final c in asJsonList(j['chapters'])) ?LearnSearchChapter.tryParse(c)],
      lessons: [for (final l in asJsonList(j['lessons'])) ?LearnSearchLesson.tryParse(l)],
      cards: [for (final c in asJsonList(j['cards'])) ?LearnSearchCard.tryParse(c)],
      more: _int(j['more']),
      total: _int(j['total']),
      cardCounts: {
        for (final e in asJson(j['cardCounts']).entries)
          e.key: ?asInt(e.value),
      },
      raw: j,
    );
  }

  final String query;

  /// Under 2 characters: nothing was searched.
  final bool tooShort;
  final List<LearnSearchChapter> chapters;
  final List<LearnSearchLesson> lessons;

  /// The first card hits (the server's limit), open cards first.
  final List<LearnSearchCard> cards;

  /// Card hits past the limit.
  final int more;

  /// Every card hit.
  final int total;

  /// Every card hit per chapter key ("27 cards in 1 chapter").
  final Map<String, int> cardCounts;
  final Json raw;
}

// ---------------------------------------------------------------- GET /api/learn/covers

/// One length of a cover: `{ cards, questions, minutes, hook, shrink?: { reason }, capped? }`.
class LearnCoverCount {
  const LearnCoverCount({this.cards = 0, this.questions = 0, this.minutes = 0, this.hook, this.hooks = const [], this.shrinkReason, this.capped = false, this.raw = const {}});

  static LearnCoverCount parse(Object? raw) {
    final j = asJson(raw);
    return LearnCoverCount(
      cards: _int(j['cards']),
      questions: _int(j['questions']),
      minutes: _int(j['minutes']),
      hook: LearnCardFace.tryParse(j['hook']),
      hooks: [for (final h in asJsonList(j['hooks'])) ?LearnCardFace.tryParse(h)],
      shrinkReason: _text(asJson(j['shrink'])['reason']),
      capped: _bool(j['capped']),
      raw: j,
    );
  }

  final int cards;
  final int questions;
  final int minutes;

  /// The first card of the feed a start at this length serves; null: no card, the cover shows its questions.
  final LearnCardFace? hook;

  /// Up to 5 fronts in feed order (R4 owner-eye#10): the cover shows the first readable one, never a fill-in-the-blank.
  final List<LearnCardFace> hooks;

  /// pool | cap | mistakes, only when this length was cut.
  final String? shrinkReason;

  /// Free only: the 10-minute clamp really cut this length.
  final bool capped;
  final Json raw;

  bool get shrunk => shrinkReason != null;
}

/// One chapter cover of Explore.
class LearnCover {
  const LearnCover({
    required this.key,
    required this.title,
    this.name,
    this.ref,
    this.refLine,
    this.number,
    this.partTitle,
    this.unitTitle,
    this.place,
    this.reason,
    this.forYou = false,
    this.hook,
    this.hooks = const [],
    this.state = const LearnState(),
    this.studentLine,
    this.resume,
    this.counts = const {},
    this.kept = 0,
    this.due = 0,
    this.mistakes = 0,
    this.raw = const {},
  });

  static LearnCover? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    final counts = <int, LearnCoverCount>{
      for (final e in asJson(j['counts']).entries)
        ?int.tryParse(e.key): LearnCoverCount.parse(e.value),
    };
    return LearnCover(
      key: key,
      title: _text(j['title']) ?? key,
      name: _text(j['name']),
      ref: _text(j['ref']),
      refLine: _text(j['refLine']),
      number: asInt(j['number']),
      partTitle: _text(j['partTitle']),
      unitTitle: _text(j['unitTitle']),
      place: LearnPlace.tryParse(j['place']),
      reason: _text(j['reason']),
      forYou: _bool(j['forYou']),
      hook: LearnCardFace.tryParse(j['hook']),
      hooks: [for (final h in asJsonList(j['hooks'])) ?LearnCardFace.tryParse(h)],
      state: LearnState.parse(j['state']),
      studentLine: _text(j['studentLine']),
      resume: LearnOpenRun.tryParse(j['resume']),
      counts: counts,
      kept: _int(j['kept']),
      due: _int(j['due']),
      mistakes: _int(j['mistakes']),
      raw: j,
    );
  }

  final String key;
  final String title;

  /// The syllabus name ("Admission of Partner"), for filters and the Free-limit action.
  final String? name;
  final String? ref;

  /// "Part 1, Ch 2" | "Microeconomics, Ch 2" | the unit when the chapter has no number.
  final String? refLine;
  final int? number;
  final String? partTitle;
  final String? unitTitle;

  /// "Chapter 5" on the cover (R4 ruling N); the NCERT `refLine` is no longer a label.
  final LearnPlace? place;

  /// For you only: "Pick up where you stopped" | "2 open mistakes to fix" | "Next after Goodwill" | "First in the syllabus".
  final String? reason;
  final bool forYou;

  /// `counts[10].hook`.
  final LearnCardFace? hook;

  /// `counts[10].hooks`: up to 5 fronts in feed order.
  final List<LearnCardFace> hooks;
  final LearnState state;

  /// One true line: "You stopped at 6 of 16" | "2 old mistakes to fix" | the state label | "New to you".
  final String? studentLine;

  /// Today's unfinished feed of this chapter with something done.
  final LearnOpenRun? resume;

  /// By length (5, 10, 20).
  final Map<int, LearnCoverCount> counts;
  final int kept;
  final int due;
  final int mistakes;
  final Json raw;

  LearnCoverCount? count(int minutes) => counts[minutes];
}

/// `GET /api/learn/covers?subject=`: `{ subject, lengths, covers, history, free }`.
class LearnCovers {
  const LearnCovers({this.subject, this.lengths = const [5, 10, 20], this.covers = const [], this.history = false, this.free, this.raw = const {}});

  static LearnCovers parse(Object? raw) {
    final j = asJson(raw);
    final lengths = [
      if (j['lengths'] is List)
        for (final m in j['lengths'] as List) ?asInt(m),
    ];
    return LearnCovers(
      subject: LearnSubjectRef.tryParse(j['subject']),
      lengths: lengths.isEmpty ? const [5, 10, 20] : lengths,
      covers: [for (final c in asJsonList(j['covers'])) ?LearnCover.tryParse(c)],
      history: _bool(j['history']),
      free: LearnNote.tryParse(j['free']),
      raw: j,
    );
  }

  final LearnSubjectRef? subject;
  final List<int> lengths;

  /// For you first, then book order from the chapter after it, wrapping.
  final List<LearnCover> covers;

  /// Any chapter studied in the subject.
  final bool history;

  /// Free once today's session is used: `{ text, maxMinutes: 10 }`.
  final LearnNote? free;
  final Json raw;
}

// ---------------------------------------------------------------- 402 FREE_SESSION_USED

/// The run that holds Free's day: `{ id, chapterKey, title, done, of, minutesLeft, kind }`.
class LearnSessionHolder {
  const LearnSessionHolder({required this.id, this.chapterKey, this.title, this.done = 0, this.of = 0, this.minutesLeft = 0, this.kind, this.label, this.raw = const {}});

  static LearnSessionHolder? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    if (id == null) return null;
    return LearnSessionHolder(
      id: id,
      chapterKey: _text(j['chapterKey']),
      title: _text(j['title']),
      done: _int(j['done']),
      of: _int(j['of']),
      minutesLeft: _int(j['minutesLeft']),
      kind: _text(j['kind']),
      label: _text(j['label']),
      raw: j,
    );
  }

  final String id;
  final String? chapterKey;
  final String? title;
  final int done;
  final int of;
  final int minutesLeft;
  final String? kind;

  /// "Continue · 6 min" (R3 ruling W).
  final String? label;
  final Json raw;
}

/// What a 402 FREE_SESSION_USED says: `{ line, options: [{ label, run? | href? }], resume }` (read from LearnError.data).
class LearnSessionUsed {
  const LearnSessionUsed({required this.line, this.options = const [], this.resume, this.raw = const {}});

  static LearnSessionUsed parse(Object? raw) {
    final j = asJson(raw);
    return LearnSessionUsed(
      line: _text(j['line']) ?? '',
      options: [for (final o in asJsonList(j['options'])) ?LearnOption.tryParse(o)],
      resume: LearnSessionHolder.tryParse(j['resume']),
      raw: j,
    );
  }

  /// "Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like."
  final String line;
  final List<LearnOption> options;

  /// The run that holds the day (a feed start after the claim): "Pick up where you stopped".
  final LearnSessionHolder? resume;
  final Json raw;
}

// ---------------------------------------------------------------- requests

/// A start of a run or a feed (`POST /api/learn/runs`), as the web's `startRun` sends it. A null [requestKey] takes the kept
/// key of its [scope] (see LearnRequestKeys); [fresh] takes a new one and never resumes.
class RunStart {
  const RunStart({
    this.kind = LearnKinds.mix,
    this.chapterKey,
    this.cardIds = const [],
    this.minutes = 10,
    this.leaveOut = const [],
    this.requestKey,
    this.resume,
    this.fresh = false,
    this.addNext = false,
    this.source,
    this.forYou,
    this.position,
  });

  final String kind;
  final String? chapterKey;
  final List<String> cardIds;
  final int minutes;
  final List<String> leaveOut;
  final String? requestKey;

  /// A run of the student's own to pick up (under 24 hours).
  final String? resume;
  final bool fresh;
  final bool addNext;

  /// `explore_cover` for a start from an Explore cover (anything else is dropped by the server).
  final String? source;
  final bool? forYou;

  /// 0-based place of the cover in the row.
  final int? position;

  /// The start's place: `kind|chapter` (or the first card of a set), the web's `startScope` without the page.
  String get scope => '$kind|${chapterKey ?? (cardIds.isNotEmpty ? cardIds.first : '')}';

  RunStart copyWith({String? requestKey, bool? fresh}) => RunStart(
    kind: kind,
    chapterKey: chapterKey,
    cardIds: cardIds,
    minutes: minutes,
    leaveOut: leaveOut,
    requestKey: requestKey ?? this.requestKey,
    resume: resume,
    fresh: fresh ?? this.fresh,
    addNext: addNext,
    source: source,
    forYou: forYou,
    position: position,
  );

  /// The body, with the web's rules: resume, fresh and addNext only when set; forYou and position only with a source.
  Json toJson() => {
    'chapterKey': ?chapterKey,
    if (cardIds.isNotEmpty) 'cardIds': cardIds,
    'minutes': minutes,
    'leaveOut': leaveOut,
    'kind': kind,
    'requestKey': ?requestKey,
    if (resume != null && resume!.isNotEmpty) 'resume': resume,
    if (fresh) 'fresh': true,
    if (addNext) 'addNext': true,
    if (source != null && source!.isNotEmpty) ...{
      'source': source,
      if (forYou == true) 'forYou': true,
      'position': ?position,
    },
  };
}

/// A preview read: `(chapterKey, minutes, leaveOut, addNext)`, equal by value (the preview provider's family key).
class LearnPreviewKey {
  LearnPreviewKey({required this.chapterKey, required this.minutes, Iterable<String> leaveOut = const [], this.addNext = false})
    : leaveOut = List.unmodifiable({...leaveOut}.toList()..sort());

  final String chapterKey;
  final int minutes;

  /// Sorted, each pile once.
  final List<String> leaveOut;
  final bool addNext;

  /// The web's `previewRun` body.
  Json toJson() => {'chapterKey': chapterKey, 'minutes': minutes, 'leaveOut': leaveOut, if (addNext) 'addNext': true};

  @override
  bool operator ==(Object other) =>
      other is LearnPreviewKey && other.chapterKey == chapterKey && other.minutes == minutes && other.addNext == addNext && other.leaveOut.join(',') == leaveOut.join(',');

  @override
  int get hashCode => Object.hash(chapterKey, minutes, addNext, leaveOut.join(','));

  @override
  String toString() => 'LearnPreviewKey($chapterKey, $minutes, $leaveOut${addNext ? ', addNext' : ''})';
}
