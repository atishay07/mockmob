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

/// The suggestion for the Practice tab, from what is already on the phone (drafts, cached
/// attempts, the chosen subjects, the subject picked on the tiles). Never waits on the network:
/// unknown attempts give the starting suggestion until they arrive. A tile change recomputes it.
final practiceSuggestionProvider = Provider.autoDispose<PracticeSuggestion>((ref) {
  final draft = ref.watch(latestSessionDraftProvider).value;
  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final subjects = ref.watch(authSnapshotProvider.select((a) => a.subjects));
  final catalog = ref.watch(practiceSubjectsProvider).value;
  final now = ref.watch(nowProvider)();
  final tile = ref.watch(practiceSubjectProvider);
  // Only an explicit pick that still stands (the tiles show it) steers the card; with no pick the
  // card follows the student's latest paper, as before.
  final picked = ref.watch(pickedPracticeSubjectProvider);
  return suggestPractice(
    draft: draft,
    now: now,
    attempts: attempts,
    chosenSubjects: subjects,
    fallbackSubject: tile,
    pickedSubject: picked != null && picked == tile ? picked : null,
    catalog: catalog,
  );
});
