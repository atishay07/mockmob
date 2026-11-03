import '../../../core/models/practice_quote.dart';
import '../../../core/models/session_draft.dart';

/// The four ways to start, as they appear in `/practice/setup/:mode`. Chapter practice is
/// Quick practice with one chapter chosen: the same API mode and the same cost.
enum PracticeMode {
  full,
  quick,
  chapter,
  nta;

  static PracticeMode? parse(String? value) {
    for (final m in values) {
      if (m.name == value) return m;
    }
    return null;
  }

  /// What the API calls it (`quick`, `full`, `nta`).
  String get apiMode => this == chapter ? 'quick' : name;

  /// Full mock and NTA-style take a number ("Mock 7") and have a fixed length.
  bool get isMock => this == full || this == nta;

  bool get usesCount => !isMock;
}

/// The question counts the Quick practice stepper offers, and nothing else.
const List<int> practiceCounts = [5, 10, 15, 20];
const int defaultPracticeCount = 10;
const int mockQuestionCount = 50;

/// The offered count closest to [raw], or the default.
int nearestPracticeCount(int? raw) {
  if (raw == null) return defaultPracticeCount;
  var best = practiceCounts.first;
  for (final c in practiceCounts) {
    if ((c - raw).abs() < (best - raw).abs()) best = c;
  }
  return best;
}

/// Subject chip ids are the public ids of `GET /api/subjects`.
class PracticeSelection {
  const PracticeSelection({required this.mode, required this.subjectId, this.count = defaultPracticeCount, this.chapter, this.purpose});

  final PracticeMode mode;
  final String subjectId;
  final int count;

  /// Chapter practice only. The API takes the chapter NAME in the single `chapter` field.
  final String? chapter;

  /// `baseline` or `full_sample`, only from a link that asks for a first-use allowance.
  final String? purpose;

  int get effectiveCount => mode.isMock ? mockQuestionCount : count;

  String? get effectiveChapter => mode == PracticeMode.chapter ? chapter : null;

  /// Chapter practice cannot start before a chapter is chosen.
  bool get isComplete => mode != PracticeMode.chapter || (chapter != null && chapter!.isNotEmpty);

  /// The `purpose` the quote is asked with. A Full mock always asks with `full_sample`, so the
  /// quote reports the first-mock allowance when there is one and the ordinary cost when not.
  String? get quotePurpose => purpose ?? (mode == PracticeMode.full ? 'full_sample' : null);

  QuoteQuery get quoteQuery => QuoteQuery(subject: subjectId, apiMode: mode.apiMode, count: effectiveCount, purpose: quotePurpose);

  /// The same key the session engine stores its draft under.
  String draftKey(String userId) =>
      SessionDraft.keyFor(userId: userId, subject: subjectId, chapter: effectiveChapter, count: effectiveCount, mode: mode.apiMode);

  PracticeSelection copyWith({String? subjectId, int? count, String? chapter, bool clearChapter = false}) => PracticeSelection(
    mode: mode,
    subjectId: subjectId ?? this.subjectId,
    count: count ?? this.count,
    chapter: clearChapter ? null : (chapter ?? this.chapter),
    purpose: purpose,
  );
}

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
