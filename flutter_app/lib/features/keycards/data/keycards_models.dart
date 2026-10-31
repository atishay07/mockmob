import '../../../core/models/json_helpers.dart';
import '../keycards_copy.dart';
import 'keycards_lines.dart' as lines;

/// Key cards as the server sends them (KEYCARDS-BUILD-SPEC 2e, KEYCARDS-CONTENT-SPEC 3). Every parser is
/// forgiving: a field that is missing or of the wrong type gives its empty value, never a crash, and a card
/// without an id, front or back is left out.

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}

/// Where a card's words come from: the NCERT book, chapter and printed page (or an authored/WordNet source).
class KcSource {
  const KcSource({required this.kind, this.book, this.code, this.chapterNo, this.page, this.section});

  static KcSource parse(Object? raw) {
    final j = asJson(raw);
    return KcSource(
      kind: asStringOr(j['kind'], 'ncert'),
      book: _text(j['book']),
      code: _text(j['code']),
      chapterNo: asInt(j['chapterNo']),
      page: asInt(j['page']),
      section: _text(j['section']),
    );
  }

  final String kind;
  final String? book;
  final String? code;
  final int? chapterNo;
  final int? page;
  final String? section;

  bool get isNcert => kind == 'ncert';

  /// "Business Studies Part 1, Ch 1, p. 3"; for an English card, where its meaning comes from; null when there
  /// is nothing to cite.
  String? get reference => lines.sourceLine(this);

  Json toJson() => {
    'kind': kind,
    'book': ?book,
    'code': ?code,
    'chapterNo': ?chapterNo,
    'page': ?page,
    'section': ?section,
  };
}

/// One Key card, whole (a locked card is a [KcDeckEntry] stub instead).
class KeyCard {
  const KeyCard({
    required this.id,
    required this.kind,
    required this.front,
    required this.back,
    this.v = 1,
    this.subject = '',
    this.chapterKey = '',
    this.chapter,
    this.unit,
    this.quote,
    this.blanks = const [],
    this.source = const KcSource(kind: 'ncert'),
    this.importance = 'good',
    this.asked = 0,
    this.tags = const [],
    this.order = 0,
    this.note,
  });

  static KeyCard? tryParse(Object? raw) {
    final j = asJson(raw);
    final id = _text(j['id']);
    final front = _text(j['front']);
    final back = _text(j['back']);
    if (id == null || front == null || back == null) return null;
    return KeyCard(
      id: id,
      v: asInt(j['v']) ?? 1,
      subject: asStringOr(j['subject'], ''),
      chapterKey: asStringOr(j['chapterKey'], ''),
      chapter: _text(j['chapter']),
      unit: _text(j['unit']),
      kind: asStringOr(j['kind'], 'key_line'),
      front: front,
      back: back,
      quote: _text(j['quote']),
      blanks: asStringList(j['blanks']),
      source: KcSource.parse(j['source']),
      importance: asString(j['importance']) == 'must' ? 'must' : 'good',
      asked: (asInt(j['asked']) ?? 0).clamp(0, 1 << 20),
      tags: asStringList(j['tags']),
      order: asInt(j['order']) ?? 0,
      note: _text(j['note']),
    );
  }

  final String id;
  final int v;
  final String subject;
  final String chapterKey;
  final String? chapter;
  final String? unit;
  final String kind;
  final String front;
  final String back;
  final String? quote;
  final List<String> blanks;
  final KcSource source;

  /// `must` or `good`.
  final String importance;

  /// Real past CUET questions that test this exact point (0 unless certain).
  final int asked;
  final List<String> tags;

  /// Book order.
  final int order;

  /// The one paraphrase a card may carry, shown as "In short".
  final String? note;

  bool get mustKnow => importance == 'must';
  String get label => KeyCardsCopy.kindLabel(kind);

  /// `term` and `key_line` cards ask with blanks in the line itself.
  bool get hasBlanks => front.contains('____');

  Json toJson() => {
    'id': id,
    'v': v,
    'subject': subject,
    'chapterKey': chapterKey,
    'chapter': ?chapter,
    'unit': ?unit,
    'kind': kind,
    'front': front,
    'back': back,
    'quote': ?quote,
    'blanks': blanks,
    'source': source.toJson(),
    'importance': importance,
    'asked': asked,
    'tags': tags,
    'order': order,
    'note': ?note,
  };
}

/// One place in a chapter's deck: a whole card, or a locked stub `{ id, kind, label, locked: true }` (Free).
class KcDeckEntry {
  const KcDeckEntry.card(KeyCard this.card) : id = null, kind = null, stubLabel = null;
  const KcDeckEntry.locked({required String this.id, required String this.kind, this.stubLabel}) : card = null;

  static KcDeckEntry? tryParse(Object? raw) {
    final j = asJson(raw);
    if (asBool(j['locked']) == true) {
      final id = _text(j['id']);
      if (id == null) return null;
      return KcDeckEntry.locked(id: id, kind: asStringOr(j['kind'], ''), stubLabel: _text(j['label']));
    }
    final card = KeyCard.tryParse(j);
    return card == null ? null : KcDeckEntry.card(card);
  }

  final KeyCard? card;
  final String? id;
  final String? kind;
  final String? stubLabel;

  bool get locked => card == null;
  String get entryId => card?.id ?? id!;

  Json toJson() => card != null ? card!.toJson() : {'id': id, 'kind': kind, 'label': ?stubLabel, 'locked': true};
}

/// `today` in every Key cards answer: what is left to do today.
class KcToday {
  const KcToday({this.due = 0, this.newLeft, this.reviewsLeft, this.minutes = 0});

  static KcToday parse(Object? raw) {
    final j = asJson(raw);
    return KcToday(
      due: (asInt(j['due']) ?? 0).clamp(0, 1 << 20),
      newLeft: asInt(j['newLeft']),
      reviewsLeft: asInt(j['reviewsLeft']),
      minutes: (asInt(j['minutes']) ?? 0).clamp(0, 1 << 20),
    );
  }

  final int due;

  /// New cards the student may still add today (null: the server did not say).
  final int? newLeft;

  /// Free's reviews left today (null for Pro, who has no cap).
  final int? reviewsLeft;
  final int minutes;

  Json toJson() => {'due': due, 'newLeft': ?newLeft, 'reviewsLeft': ?reviewsLeft, 'minutes': minutes};
}

/// A chapter's state for the new screens (KEYCARDS-BUILD-SPEC 2d).
class KcChapterState {
  const KcChapterState({this.state = 'none', this.label = KeyCardsCopy.stateNone, this.fading = false});

  static const List<String> states = ['none', 'thin', 'weak', 'mid', 'strong'];

  static KcChapterState parse(Object? raw) {
    final j = asJson(raw);
    final state = asString(j['state']);
    final s = states.contains(state) ? state! : 'none';
    return KcChapterState(state: s, label: _text(j['label']) ?? labelFor(s), fading: asBool(j['fading']) ?? false);
  }

  static String labelFor(String state) => switch (state) {
    'thin' => KeyCardsCopy.stateThin,
    'weak' => KeyCardsCopy.stateWeak,
    'mid' => KeyCardsCopy.stateMid,
    'strong' => KeyCardsCopy.stateStrong,
    _ => KeyCardsCopy.stateNone,
  };

  final String state;
  final String label;
  final bool fading;

  String get text => KeyCardsCopy.stateText(label, fading: fading && state == 'strong');

  Json toJson() => {'state': state, 'label': label, 'fading': fading};
}

/// A chapter on the Key cards home.
class KcChapter {
  const KcChapter({
    required this.key,
    required this.title,
    this.ncertBook,
    this.ncertChapter,
    this.chip,
    this.cards = 0,
    this.mustKnow = 0,
    this.unlocked = 0,
    this.added = 0,
    this.due = 0,
    this.state = const KcChapterState(),
  });

  static KcChapter? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    final title = _text(j['title']);
    if (key == null || title == null) return null;
    final ncert = asJson(j['ncert']);
    return KcChapter(
      key: key,
      title: title,
      ncertBook: _text(ncert['book']),
      ncertChapter: asInt(ncert['chapter']),
      chip: _text(j['chip']),
      cards: asInt(j['cards']) ?? 0,
      mustKnow: asInt(j['mustKnow']) ?? 0,
      unlocked: asInt(j['unlocked']) ?? 0,
      added: asInt(j['added']) ?? 0,
      due: asInt(j['due']) ?? 0,
      state: KcChapterState.parse(j['state']),
    );
  }

  final String key;
  final String title;
  final String? ncertBook;
  final int? ncertChapter;

  /// 'CUET only' or 'CBSE teaches this in Class 11', or null.
  final String? chip;
  final int cards;
  final int mustKnow;
  final int unlocked;
  final int added;
  final int due;
  final KcChapterState state;

  /// The website's `chapterRef`: nothing when it is only the title again, "Ch 7" under a heading that is the book's name.
  String? ncertLineUnder({String? unit}) => lines.chapterRef(ncertBook, ncertChapter, title: title, unit: unit);

  String? get ncertLine => ncertLineUnder();

  Json toJson() => {
    'key': key,
    'title': title,
    'ncert': {'book': ?ncertBook, 'chapter': ?ncertChapter},
    'chip': chip,
    'cards': cards,
    'mustKnow': mustKnow,
    'unlocked': unlocked,
    'added': added,
    'due': due,
    'state': state.toJson(),
  };
}

class KcUnit {
  const KcUnit({required this.unit, required this.chapters});

  static KcUnit? tryParse(Object? raw) {
    final j = asJson(raw);
    final unit = _text(j['unit']);
    if (unit == null) return null;
    return KcUnit(unit: unit, chapters: [for (final c in asJsonList(j['chapters'])) ?KcChapter.tryParse(c)]);
  }

  final String unit;
  final List<KcChapter> chapters;

  Json toJson() => {'unit': unit, 'chapters': [for (final c in chapters) c.toJson()]};
}

class KcChoice {
  const KcChoice(this.id, this.label);

  final String id;
  final String label;
}

/// A subject's one-tap option (Mathematics, Computer Science, Accountancy): `{ label, choices, default }`.
class KcOptions {
  const KcOptions({required this.label, required this.choices, this.defaultId});

  static KcOptions? tryParse(Object? raw) {
    final j = asJson(raw);
    final choices = [
      for (final c in asJsonList(j['choices']))
        if (_text(c['id']) case final id?) KcChoice(id, _text(c['label']) ?? id),
    ];
    if (choices.length < 2) return null;
    return KcOptions(label: _text(j['label']) ?? 'Section', choices: choices, defaultId: _text(j['default']));
  }

  final String label;
  final List<KcChoice> choices;
  final String? defaultId;

  Json toJson() => {
    'label': label,
    'choices': [for (final c in choices) {'id': c.id, 'label': c.label}],
    'default': ?defaultId,
  };
}

class KcSubject {
  const KcSubject({required this.subject, required this.title, this.option, this.options, this.units = const []});

  static KcSubject? tryParse(Object? raw) {
    final j = asJson(raw);
    final subject = _text(j['subject']);
    if (subject == null) return null;
    return KcSubject(
      subject: subject,
      title: _text(j['title']) ?? subject,
      option: _text(j['option']),
      options: KcOptions.tryParse(j['options']),
      units: [for (final u in asJsonList(j['units'])) ?KcUnit.tryParse(u)],
    );
  }

  final String subject;
  final String title;
  final String? option;
  final KcOptions? options;
  final List<KcUnit> units;

  Iterable<KcChapter> get chapters => units.expand((u) => u.chapters);

  Json toJson() => {
    'subject': subject,
    'title': title,
    'option': option,
    'options': ?options?.toJson(),
    'units': [for (final u in units) u.toJson()],
  };
}

/// `GET /api/keycards`.
class KcHome {
  const KcHome({required this.enabled, this.isPro = false, this.subjects = const [], this.today = const KcToday()});

  static const KcHome off = KcHome(enabled: false);

  static KcHome parse(Object? raw) {
    final j = asJson(raw);
    return KcHome(
      enabled: asBool(j['enabled']) ?? false,
      isPro: asBool(j['isPro']) ?? false,
      subjects: [for (final s in asJsonList(j['subjects'])) ?KcSubject.tryParse(s)],
      today: KcToday.parse(j['today']),
    );
  }

  final bool enabled;
  final bool isPro;
  final List<KcSubject> subjects;
  final KcToday today;

  /// The chapter a stored chapter name of [subject] belongs to: matched on the chapter key's slug or the title.
  KcChapter? chapterFor(String? subject, String name) {
    final want = slug(name);
    for (final s in subjects) {
      if (subject != null && s.subject != subject) continue;
      for (final c in s.chapters) {
        if (c.key.split('.').last == want || slug(c.title) == want) return c;
      }
    }
    return null;
  }

  static String slug(String s) => s.toLowerCase().replaceAll('&', 'and').replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');

  Json toJson() => {'enabled': enabled, 'isPro': isPro, 'subjects': [for (final s in subjects) s.toJson()], 'today': today.toJson()};
}

/// The chapter a deck belongs to.
class KcDeckChapter {
  const KcDeckChapter({required this.key, required this.title, this.unit, this.ncertBook, this.ncertChapter, this.chip});

  static KcDeckChapter parse(Object? raw, String fallbackKey) {
    final j = asJson(raw);
    final ncert = asJson(j['ncert']);
    return KcDeckChapter(
      key: _text(j['key']) ?? fallbackKey,
      title: _text(j['title']) ?? fallbackKey,
      unit: _text(j['unit']),
      ncertBook: _text(ncert['book']),
      ncertChapter: asInt(ncert['chapter']),
      chip: _text(j['chip']),
    );
  }

  final String key;
  final String title;
  final String? unit;
  final String? ncertBook;
  final int? ncertChapter;
  final String? chip;

  /// The website's `chapterRef`: nothing when it is only the title again, "Ch 7" under a heading that is the book's name.
  String? ncertLineUnder({String? unit}) => lines.chapterRef(ncertBook, ncertChapter, title: title, unit: unit);

  String? get ncertLine => ncertLineUnder();
}

/// `GET /api/keycards/deck?chapter=`.
class KcDeck {
  const KcDeck({required this.chapter, required this.entries, this.total = 0, this.mustKnow = 0, this.locked = 0, this.added = const {}});

  static KcDeck parse(Object? raw, {String chapterKey = ''}) {
    final j = asJson(raw);
    final counts = asJson(j['counts']);
    final entries = [for (final e in asJsonList(j['cards'])) ?KcDeckEntry.tryParse(e)];
    return KcDeck(
      chapter: KcDeckChapter.parse(j['chapter'], chapterKey),
      entries: entries,
      total: asInt(counts['total']) ?? entries.length,
      mustKnow: asInt(counts['mustKnow']) ?? entries.where((e) => e.card?.mustKnow ?? false).length,
      locked: asInt(counts['locked']) ?? entries.where((e) => e.locked).length,
      added: {...asStringList(j['added'])},
    );
  }

  final KcDeckChapter chapter;
  final List<KcDeckEntry> entries;
  final int total;
  final int mustKnow;
  final int locked;

  /// Cards of this chapter already in the student's Revise.
  final Set<String> added;

  List<KeyCard> get cards => [for (final e in entries) ?e.card];
  List<KeyCard> get mustKnowCards => [for (final c in cards) if (c.mustKnow) c];

  /// Every Must-know card that is open is already in Revise.
  bool get allAdded => mustKnowCards.isNotEmpty && mustKnowCards.every((c) => added.contains(c.id));

  KcDeck withAdded(Iterable<String> ids) =>
      KcDeck(chapter: chapter, entries: entries, total: total, mustKnow: mustKnow, locked: locked, added: {...added, ...ids});
}

/// A due card: the card and where its schedule stands.
class KcDueCard {
  const KcDueCard({required this.card, this.reps = 0, this.lapses = 0, this.due});

  static KcDueCard? tryParse(Object? raw) {
    final card = KeyCard.tryParse(raw);
    if (card == null) return null;
    final s = asJson(asJson(raw)['state']);
    return KcDueCard(card: card, reps: asInt(s['reps']) ?? 0, lapses: asInt(s['lapses']) ?? 0, due: asDate(s['due']));
  }

  final KeyCard card;
  final int reps;
  final int lapses;
  final DateTime? due;

  bool get isNew => reps == 0;

  Json toJson() => {...card.toJson(), 'state': {'reps': reps, 'lapses': lapses, 'due': ?due?.toUtc().toIso8601String()}};
}

/// `GET /api/keycards/due`.
class KcDue {
  const KcDue({this.cards = const [], this.today = const KcToday()});

  static const KcDue none = KcDue();

  static KcDue parse(Object? raw) {
    final j = asJson(raw);
    return KcDue(cards: [for (final c in asJsonList(j['cards'])) ?KcDueCard.tryParse(c)], today: KcToday.parse(j['today']));
  }

  final List<KcDueCard> cards;
  final KcToday today;

  Json toJson() => {'cards': [for (final c in cards) c.toJson()], 'today': today.toJson()};
}

/// `POST /api/keycards/review`.
class KcReviewResult {
  const KcReviewResult({required this.ok, this.nextDueAt, this.intervalDays, this.today});

  static KcReviewResult parse(Object? raw) {
    final j = asJson(raw);
    final next = asJson(j['next']);
    return KcReviewResult(
      ok: asBool(j['ok']) ?? false,
      nextDueAt: asDate(next['due_at']),
      intervalDays: asDouble(next['interval_days']),
      today: j['today'] == null ? null : KcToday.parse(j['today']),
    );
  }

  final bool ok;
  final DateTime? nextDueAt;
  final double? intervalDays;
  final KcToday? today;
}

/// `POST /api/keycards/add`.
class KcAddResult {
  const KcAddResult({required this.added, this.today = const KcToday()});

  static KcAddResult parse(Object? raw) {
    final j = asJson(raw);
    return KcAddResult(added: asInt(j['added']) ?? 0, today: KcToday.parse(j['today']));
  }

  final int added;
  final KcToday today;
}

/// `GET /api/keycards/line?questionId=`: "The line you needed".
class KcLine {
  const KcLine({this.cards = const [], this.source = 'none', this.left, this.proRequired = false});

  static const KcLine none = KcLine();

  /// Free read today's lines already: the server answered 402 `PRO_REQUIRED` (reason `keycard_line`).
  static const KcLine gated = KcLine(proRequired: true);

  static KcLine parse(Object? raw) {
    final j = asJson(raw);
    final source = asString(j['source']);
    return KcLine(
      cards: [for (final c in asJsonList(j['cards'])) ?KeyCard.tryParse(c)].take(2).toList(),
      source: source == 'linked' || source == 'matched' ? source! : 'none',
      left: asInt(j['left']),
    );
  }

  final List<KeyCard> cards;

  /// 'linked', 'matched' or 'none'.
  final String source;

  /// Free's lines left today.
  final int? left;

  /// True for [gated]: no line, and the Pro gate stands in its place.
  final bool proRequired;

  bool get shows => source != 'none' && cards.isNotEmpty;
}

/// One chapter of `GET /api/me/chapters` (n, right, reason and memory only for Pro).
class KcMyChapter {
  const KcMyChapter({
    required this.key,
    required this.title,
    required this.state,
    this.n,
    this.right,
    this.reason,
    this.memory,
    this.marksLost,
    this.questions,
    this.cards,
  });

  static KcMyChapter? tryParse(Object? raw) {
    final j = asJson(raw);
    final key = _text(j['key']);
    if (key == null) return null;
    final available = asJson(j['available']);
    final memory = asJson(j['memory']);
    return KcMyChapter(
      key: key,
      title: _text(j['title']) ?? key,
      state: KcChapterState.parse(j),
      n: asInt(j['n']),
      right: asInt(j['right']),
      reason: _text(j['reason']),
      memory: memory.isEmpty ? null : (holding: asInt(memory['holding']) ?? 0, added: asInt(memory['added']) ?? 0, mustKnow: asInt(memory['mustKnow']) ?? 0),
      marksLost: asDouble(j['marksLost']),
      questions: asInt(available['questions']),
      cards: asInt(available['cards']),
    );
  }

  final String key;
  final String title;
  final KcChapterState state;
  final int? n;
  final int? right;
  final String? reason;
  final ({int holding, int added, int mustKnow})? memory;
  final double? marksLost;
  final int? questions;
  final int? cards;
}

/// `GET /api/me/chapters?subject=`.
class KcMyChapters {
  const KcMyChapters({required this.subject, this.option, this.units = const []});

  static KcMyChapters parse(Object? raw) {
    final j = asJson(raw);
    return KcMyChapters(
      subject: asStringOr(j['subject'], ''),
      option: _text(j['option']),
      units: [
        for (final u in asJsonList(j['units']))
          (unit: asStringOr(u['unit'], ''), chapters: [for (final c in asJsonList(u['chapters'])) ?KcMyChapter.tryParse(c)]),
      ],
    );
  }

  final String subject;
  final String? option;
  final List<({String unit, List<KcMyChapter> chapters})> units;

  KcMyChapter? chapter(String key) {
    for (final u in units) {
      for (final c in u.chapters) {
        if (c.key == key) return c;
      }
    }
    return null;
  }
}
