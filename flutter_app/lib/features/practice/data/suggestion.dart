import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/domain/domain.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../model/practice_selection.dart';
import 'practice_catalog.dart';

/// The one session the Practice tab suggests at the top, with the evidence behind it. Every
/// suggestion names a reason the student can check: an open session, a chapter that cost marks
/// in a named paper, the last paper's subject, or the order of subjects they chose.
sealed class PracticeSuggestion {
  const PracticeSuggestion(this.subjectId);

  /// Public subject id (`business_studies`, `general_test`).
  final String subjectId;
}

/// A session still open on this phone: the default is to finish it.
class ResumeSuggestion extends PracticeSuggestion {
  ResumeSuggestion(this.draft) : super(draft.subject);

  final SessionDraft draft;
}

/// The chapter that cost the most in the latest paper, as chapter practice of [count].
class ChapterSuggestion extends PracticeSuggestion {
  const ChapterSuggestion({
    required String subjectId,
    required this.chapter,
    required this.attempt,
    required this.marksLost,
    required this.missed,
    this.mockNumber,
  }) : super(subjectId);

  final String chapter;

  /// The evidence: the paper it came from ("Show me" opens it).
  final Attempt attempt;
  final int marksLost;

  /// Wrong plus not attempted in that chapter.
  final int missed;

  /// "Mock 7" when the paper was a mock.
  final int? mockNumber;

  int get count => defaultPracticeCount;

  PracticeSelection get selection => PracticeSelection(mode: PracticeMode.chapter, subjectId: subjectId, count: count, chapters: [chapter]);
}

/// Quick practice in the subject of the latest paper, when no chapter can be named.
class SubjectSuggestion extends PracticeSuggestion {
  const SubjectSuggestion({required String subjectId, required this.attempt}) : super(subjectId);

  final Attempt attempt;

  int get count => defaultPracticeCount;

  PracticeSelection get selection => PracticeSelection(mode: PracticeMode.quick, subjectId: subjectId, count: count);
}

/// No paper yet (or none readable): ten questions in the first subject the student chose, or in
/// the subject they picked on the tiles. [firstEver] is true only when the attempts list is known
/// to be empty; then the quote is asked with `purpose=baseline`, so a first-use allowance shows on
/// the confirm sheet when it exists. [picked] is true when the subject is the student's own pick.
/// [attemptsKnown] is false while the attempts have not loaded: then no sentence may claim there
/// is no paper yet.
class StartingSuggestion extends PracticeSuggestion {
  const StartingSuggestion({required String subjectId, required this.firstEver, this.picked = false, this.attemptsKnown = true}) : super(subjectId);

  final bool firstEver;
  final bool picked;
  final bool attemptsKnown;

  int get count => defaultPracticeCount;

  PracticeSelection get selection => PracticeSelection(
        mode: PracticeMode.quick,
        subjectId: subjectId,
        count: count,
        purpose: firstEver ? 'baseline' : null,
      );
}

/// The public id of an attempt's subject (`gat` is stored for General Test).
String publicSubjectOf(String internal, List<Subject>? catalog) {
  for (final s in catalog ?? const <Subject>[]) {
    if (s.internalId == internal) return s.id;
  }
  return internal == 'gat' ? 'general_test' : internal;
}

/// The rules, in order. Pure, so the precedence is unit tested.
///
/// [pickedSubject] is the subject the student picked on the tiles. When there is one, every
/// suggestion except an open session is about that subject only: its latest paper and the
/// chapter that cost the most there, or ten questions to start it. The card never offers one
/// subject while the tiles show another (owner, 13 October: Business Studies became Accountancy).
PracticeSuggestion suggestPractice({
  required SessionDraft? draft,
  required DateTime now,
  required List<Attempt>? attempts,
  required List<String> chosenSubjects,
  required String fallbackSubject,
  String? pickedSubject,
  List<Subject>? catalog,
}) {
  if (draft != null && resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch)) {
    return ResumeSuggestion(draft);
  }
  final all = attempts;
  if (pickedSubject != null) {
    final mine = [
      for (final a in all ?? const <Attempt>[])
        if (publicSubjectOf(a.subject, catalog) == pickedSubject) a,
    ];
    if (mine.isEmpty) {
      return StartingSuggestion(subjectId: pickedSubject, firstEver: all != null && all.isEmpty, picked: true, attemptsKnown: all != null);
    }
    mine.sort((a, b) => b.completedAt.compareTo(a.completedAt));
    return _fromLatest(mine.first, pickedSubject, all!);
  }

  final first = chosenSubjects.isEmpty ? fallbackSubject : chosenSubjects.first;
  if (all == null || all.isEmpty) return StartingSuggestion(subjectId: first, firstEver: all != null, attemptsKnown: all != null);

  final chosen = chosenSubjects.toSet();
  final sorted = [...all]..sort((a, b) => b.completedAt.compareTo(a.completedAt));
  final latest = sorted.firstWhere(
    (a) => chosen.isEmpty || chosen.contains(publicSubjectOf(a.subject, catalog)),
    orElse: () => sorted.first,
  );
  return _fromLatest(latest, publicSubjectOf(latest.subject, catalog), all);
}

/// The chapter that cost the most in [latest], or quick practice in its subject.
PracticeSuggestion _fromLatest(Attempt latest, String subject, List<Attempt> all) {
  final leader = observedChapterBreakdown(latest).leader;
  if (leader != null && leader.chapter.trim().isNotEmpty && leader.wrong > 0) {
    return ChapterSuggestion(
      subjectId: subject,
      chapter: leader.chapter.trim(),
      attempt: latest,
      marksLost: leader.marksLost,
      missed: leader.wrong + leader.unattempted,
      mockNumber: mockOrdinal(all, latest),
    );
  }
  return SubjectSuggestion(subjectId: subject, attempt: latest);
}

/// A chapter that cost marks in the student's latest paper of a subject: the chapter picker's
/// "From your record" chips. [marksLost] is the observed gap under that paper's own key (wrong
/// answers cost 6, blanks 5), never a forecast.
class RecordChapter {
  const RecordChapter({required this.chapter, required this.marksLost});

  final String chapter;
  final int marksLost;
}

/// Up to [limit] chapters that cost the most marks in the latest paper in [subjectId], most
/// costly first, only those with enough questions to be named. Empty when there is no paper, no
/// loss, or no nameable chapter: the row is then not shown at all.
List<RecordChapter> recordChaptersFor({
  required List<Attempt>? attempts,
  required String subjectId,
  List<Subject>? catalog,
  int limit = 3,
}) {
  Attempt? latest;
  for (final a in attempts ?? const <Attempt>[]) {
    if (publicSubjectOf(a.subject, catalog) != subjectId) continue;
    if (latest == null || a.completedAt.isAfter(latest.completedAt)) latest = a;
  }
  if (latest == null) return const [];
  final out = <RecordChapter>[];
  for (final s in observedChapterBreakdown(latest).stats) {
    if (out.length >= limit) break;
    if (s.marksLost > 0 && s.canBeNamed && s.chapter.trim().isNotEmpty) out.add(RecordChapter(chapter: s.chapter.trim(), marksLost: s.marksLost));
  }
  return out;
}

/// [recordChaptersFor] from what is on the phone, for one subject.
final practiceRecordChaptersProvider = Provider.autoDispose.family<List<RecordChapter>, String>((ref, subjectId) {
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final catalog = ref.watch(practiceSubjectsProvider).value;
  return recordChaptersFor(attempts: attempts, subjectId: subjectId, catalog: catalog);
});

/// The suggestion for the Practice tab, from what is already on the phone (drafts, cached
/// attempts, the chosen subjects, the subject picked on the tiles). Never waits on the network:
/// unknown attempts give the starting suggestion until they arrive. A tile change recomputes it.
final practiceSuggestionProvider = Provider.autoDispose<PracticeSuggestion>((ref) {
  final draft = ref.watch(latestSessionDraftProvider).value;
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final subjects = ref.watch(authSnapshotProvider.select((a) => a.subjects));
  final catalog = ref.watch(practiceSubjectsProvider).value;
  final now = ref.watch(nowProvider)();
  // One subject state (L08): the lit tile always steers the card, picked or defaulted, so the
  // tile, the card's overline and its object never name two subjects. Only a session still open
  // leads whatever the tile is, and it names its own subject.
  final tile = ref.watch(practiceSubjectProvider);
  return suggestPractice(
    draft: draft,
    now: now,
    attempts: attempts,
    chosenSubjects: subjects,
    fallbackSubject: tile,
    pickedSubject: tile.isEmpty ? null : tile,
    catalog: catalog,
  );
});
