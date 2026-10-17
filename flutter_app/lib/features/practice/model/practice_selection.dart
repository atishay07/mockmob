import '../../../core/models/practice_quote.dart';
import '../../../core/models/session_draft.dart';

/// The ways to start, as they appear in `/practice/setup/:mode`. Chapter practice is Quick
/// practice with chapters chosen: the same API mode and the same cost.
enum PracticeMode {
  full,
  quick,
  chapter,
  smart,
  nta;

  static PracticeMode? parse(String? value) {
    for (final m in values) {
      if (m.name == value) return m;
    }
    return null;
  }

  /// What the API calls it (`quick`, `smart`, `full`, `nta`).
  String get apiMode => this == chapter ? 'quick' : name;

  /// Full mock and NTA mode take a number ("Mock 7") and have a fixed length.
  bool get isMock => this == full || this == nta;

  bool get usesCount => !isMock;

  /// The lengths the server offers for this mode (`TEST_MODES[mode].countOptions`).
  List<int> get counts => this == smart ? smartCounts : practiceCounts;

  int get defaultCount => this == smart ? 15 : defaultPracticeCount;

  /// What Fine-tune offers in this mode (owner, 17 Oct, F9): chapters and level in Quick practice
  /// (By chapter is Quick practice with the chapters asked first), the level alone in a Full mock
  /// (it covers every chapter, like the exam), and nothing in Smart practice and NTA mode, where
  /// we choose.
  FineTuneScope get fineTune => switch (this) {
    quick || chapter => FineTuneScope.chaptersAndLevel,
    full => FineTuneScope.levelOnly,
    smart || nta => FineTuneScope.none,
  };

  /// Modes whose server definition allows a difficulty override (`allowDifficultyOverride`).
  bool get allowsDifficulty => fineTune != FineTuneScope.none;

  /// Only Quick practice takes a chapter choice: the other modes cover the syllabus themselves.
  bool get allowsChapters => fineTune == FineTuneScope.chaptersAndLevel;
}

/// Which Fine-tune controls a mode shows (see [PracticeMode.fineTune]).
enum FineTuneScope { chaptersAndLevel, levelOnly, none }

/// The question counts Quick and chapter practice offer, and nothing else.
const List<int> practiceCounts = [5, 10, 15, 20];

/// Smart practice starts at 10 (`TEST_MODES.smart.countOptions`).
const List<int> smartCounts = [10, 15, 20];
const int defaultPracticeCount = 10;
const int mockQuestionCount = 50;

/// The most chapters one session takes (the server keeps the first 12).
const int maxChapters = 12;

/// The offered count closest to [raw] among [counts], or the default.
int nearestPracticeCount(int? raw, {List<int> counts = practiceCounts, int fallback = defaultPracticeCount}) {
  if (raw == null) return fallback;
  var best = counts.first;
  for (final c in counts) {
    if ((c - raw).abs() < (best - raw).abs()) best = c;
  }
  return best;
}

/// Balanced is the server's own mix; the others ask for one level (Pro only).
enum PracticeDifficulty {
  balanced,
  easy,
  medium,
  hard;

  static PracticeDifficulty parse(String? value) {
    for (final d in values) {
      if (d.name == value) return d;
    }
    return balanced;
  }

  /// The `difficulty` sent to `POST /api/sessions`, or null for the balanced mix.
  String? get apiValue => this == balanced ? null : name;
}

/// Subject ids are the public ids of `GET /api/subjects`.
class PracticeSelection {
  PracticeSelection({
    required this.mode,
    required this.subjectId,
    int? count,
    List<String> chapters = const [],
    String? chapter,
    this.difficulty = PracticeDifficulty.balanced,
    this.purpose,
    this.recoveryFrom,
  }) : count = count ?? mode.defaultCount,
       chapters = List.unmodifiable(chapter != null && chapter.isNotEmpty && chapters.isEmpty ? [chapter] : chapters);

  final PracticeMode mode;
  final String subjectId;
  final int count;

  /// Quick practice only (By chapter included). The API takes chapter NAMES: one goes in `chapter`, several in
  /// `chapters`.
  final List<String> chapters;

  /// Quick, chapter and Full only; ignored for Smart and NTA.
  final PracticeDifficulty difficulty;

  /// `baseline` or `full_sample`, only from a link that asks for a first-use allowance.
  final String? purpose;

  /// The attempt a "5 fresh questions" check proves (`recoveryFrom`, WEB-PARITY A8): the server
  /// picks new questions from the chapter of that attempt's mistakes, free, as a recovery
  /// session. Null for every ordinary start.
  final String? recoveryFrom;

  bool get isFreshCheck => recoveryFrom != null;

  int get effectiveCount => mode.isMock ? mockQuestionCount : count;

  /// The single chapter, when exactly one is chosen.
  String? get chapter => chapters.length == 1 ? chapters.first : null;

  List<String> get effectiveChapters => mode.allowsChapters ? chapters : const [];

  /// What the draft and the runner call the chapter selection ("Goodwill", or the names joined).
  String? get chapterLabel => effectiveChapters.isEmpty ? null : effectiveChapters.join(' | ');

  String? get effectiveDifficulty => mode.allowsDifficulty ? difficulty.apiValue : null;

  /// Chapter practice cannot start before a chapter is chosen.
  bool get isComplete => mode != PracticeMode.chapter || chapters.isNotEmpty;

  /// The `purpose` the quote is asked with. A Full mock always asks with `full_sample`, so the
  /// quote reports the first-mock allowance when there is one and the ordinary cost when not.
  String? get quotePurpose => purpose ?? (mode == PracticeMode.full ? 'full_sample' : null);

  QuoteQuery get quoteQuery => QuoteQuery(subject: subjectId, apiMode: mode.apiMode, count: effectiveCount, purpose: quotePurpose);

  /// The key the generation key and the draft are stored under: every field that changes the
  /// session (subject, chapters, length, difficulty, mode), so a stored key or draft for one
  /// selection is never reused for another.
  String draftKey(String userId) => SessionDraft.keyFor(
    userId: userId,
    subject: subjectId,
    chapter: chapterLabel,
    count: effectiveCount,
    difficulty: effectiveDifficulty,
    mode: mode.apiMode,
  );

  /// The body fields of `POST /api/sessions` that describe the selection. `count` is a string,
  /// as the website sends it.
  Map<String, Object> get sessionFields {
    final chosen = effectiveChapters;
    return {
      'subject': subjectId,
      'mode': mode.apiMode,
      'count': '$effectiveCount',
      if (chosen.length == 1) 'chapter': chosen.first,
      // The server splits `chapters` on commas; the picker never offers several chapters of a
      // subject whose names contain one (see `canMultiSelect`).
      if (chosen.length > 1) 'chapters': chosen.join(','),
      'difficulty': ?effectiveDifficulty,
      'recoveryFrom': ?recoveryFrom,
    };
  }

  PracticeSelection copyWith({
    PracticeMode? mode,
    String? subjectId,
    int? count,
    List<String>? chapters,
    PracticeDifficulty? difficulty,
    bool clearChapters = false,
  }) {
    final nextMode = mode ?? this.mode;
    return PracticeSelection(
      mode: nextMode,
      subjectId: subjectId ?? this.subjectId,
      count: nearestPracticeCount(count ?? this.count, counts: nextMode.counts, fallback: nextMode.defaultCount),
      chapters: clearChapters ? const [] : (chapters ?? this.chapters),
      difficulty: difficulty ?? this.difficulty,
      purpose: purpose,
      recoveryFrom: recoveryFrom,
    );
  }

  @override
  String toString() => 'PracticeSelection(${mode.name}, $subjectId, $effectiveCount, $chapters, ${difficulty.name})';
}

/// Several chapters go to the server joined by commas, so a subject with a comma in any chapter
/// name takes one chapter at a time until the server accepts a list.
bool canMultiSelect(Iterable<String> chapterNames) => !chapterNames.any((n) => n.contains(','));

/// What the quote endpoint is asked. A value type, so it keys a Riverpod family.
class QuoteQuery {
  const QuoteQuery({required this.subject, required this.apiMode, required this.count, this.purpose});

  final String subject;
  final String apiMode;
  final int count;
  final String? purpose;

  @override
  bool operator ==(Object other) =>
      other is QuoteQuery && other.subject == subject && other.apiMode == apiMode && other.count == count && other.purpose == purpose;

  @override
  int get hashCode => Object.hash(subject, apiMode, count, purpose);

  @override
  String toString() => 'QuoteQuery($subject, $apiMode, $count, $purpose)';
}

/// The `purpose` a launch is sent with: only when the quote says the matching free allowance is
/// available. Otherwise the launch would claim an allowance the server will not honour.
String? launchPurposeFor(PracticeQuote quote) {
  final allowance = quote.allowance;
  if (allowance == null || !allowance.isAvailable) return null;
  if (allowance.kind.startsWith('baseline:')) return 'baseline';
  if (allowance.kind.startsWith('full_sample:')) return 'full_sample';
  return null;
}
