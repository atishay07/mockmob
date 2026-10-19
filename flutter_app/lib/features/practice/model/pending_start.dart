import '../../../core/domain/session_rules.dart' show submissionGraceMs;
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/session_draft_repository.dart' show StoredStart;
import 'practice_selection.dart';

/// A start the phone began and has not seen the answer to: the app was killed, or the signal went,
/// after the request left. The server may already have opened the paper and taken the credits, so
/// the phone keeps what it asked for beside the start key and can ask again with the same key. The
/// server treats a repeat of a key as the same paper in both of its modes (a durable session is
/// returned, a device-held one is rebuilt under the same ledger reference), so asking again is
/// never charged twice (v15 walk, credits).
class PendingStart {
  const PendingStart({
    required this.draftKey,
    required this.generationKey,
    required this.at,
    required this.selection,
    this.purpose,
    this.mockNumber,
    this.firstFree = false,
  });

  /// The draft row (one per selection) the start belongs to.
  final String draftKey;
  final String generationKey;

  /// When the key was made: when the paper may have opened.
  final DateTime at;

  /// What was asked for, rebuilt from the record.
  final PracticeSelection selection;

  /// The allowance the request was sent with (`baseline`, `full_sample`), so asking again names the
  /// same one.
  final String? purpose;

  /// "Mock 7": the number the paper would carry.
  final int? mockNumber;

  /// The quote the start was launched from said it was the free first full mock, so asking again says
  /// so too: the server then refuses a start that would be charged instead of charging it unseen.
  final bool firstFree;

  bool get isMock => selection.mode.isMock;

  /// How long this key is the one a start uses again: the length of the paper it may have opened,
  /// plus the grace the server allows a submit after it.
  Duration get window => windowFor(selection);

  /// The record the starter writes beside a key.
  static Map<String, Object?> record(PracticeSelection s, {String? purpose, int? mockNumber, bool firstFree = false}) => {
    'subject': s.subjectId,
    'mode': s.mode.name,
    'count': s.effectiveCount,
    if (s.effectiveChapters.isNotEmpty) 'chapters': s.effectiveChapters,
    'difficulty': s.difficulty.name,
    'purpose': ?purpose,
    'mockNumber': ?mockNumber,
    if (firstFree) 'firstFree': true,
  };

  /// The selection a record describes, or null when it names something this build does not know.
  static PracticeSelection? selectionOf(Map<String, dynamic> start) {
    final mode = PracticeMode.parse(asString(start['mode']));
    final subject = asString(start['subject']);
    final count = asInt(start['count']);
    if (mode == null || subject == null || subject.isEmpty || count == null) return null;
    return PracticeSelection(
      mode: mode,
      subjectId: subject,
      count: count,
      chapters: asStringList(start['chapters']),
      difficulty: PracticeDifficulty.parse(asString(start['difficulty'])),
    );
  }

  /// The pending start a stored key holds, or null when it has no usable record.
  static PendingStart? from(StoredStart stored) {
    final selection = selectionOf(stored.start);
    if (selection == null) return null;
    return PendingStart(
      draftKey: stored.draftKey,
      generationKey: stored.generationKey,
      at: stored.at,
      selection: selection,
      purpose: asString(stored.start['purpose']),
      mockNumber: asInt(stored.start['mockNumber']),
      firstFree: stored.start['firstFree'] == true,
    );
  }

  /// How long a start's key stays the one a retry uses for [s]: the paper's own length (a mock is
  /// an hour, practice a minute a question, Smart up to a minute and a half) plus the submit grace,
  /// and never under the fifteen minutes a key always had. Past it the paper cannot be open any
  /// more, so the next start is a new paper.
  static Duration windowFor(PracticeSelection s) {
    final seconds = s.mode.isMock ? 3600 : s.effectiveCount * (s.mode == PracticeMode.smart ? 90 : 60);
    final length = Duration(milliseconds: seconds * 1000 + submissionGraceMs);
    return length < _floor ? _floor : length;
  }

  /// [windowFor] for a stored record, or the floor when the record is not one this build reads.
  static Duration windowOf(Map<String, dynamic> start) {
    final s = selectionOf(start);
    return s == null ? _floor : windowFor(s);
  }

  static const Duration _floor = Duration(minutes: 15);
}
