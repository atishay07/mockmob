import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/domain/domain.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/router/routes.dart';
import '../copy.dart';
import '../data/practice_catalog.dart';
import '../data/suggestion.dart';
import '../model/practice_selection.dart';
import 'confirm_sheet.dart';
import 'suggestion_card.dart';

/// Answer counts of one stored session, read from its journal.
final draftSummaryProvider = FutureProvider.autoDispose.family<DraftSummary?, String>((ref, sessionId) async {
  final drafts = ref.watch(sessionDraftRepositoryProvider);
  final draft = await drafts.bySessionId(sessionId);
  return draft == null ? null : drafts.summaryOf(draft);
});

/// True when [draft] can still be continued right now.
bool canContinue(SessionDraft? draft, DateTime now) =>
    draft != null && resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch);

/// The location of the paper behind a claim: the mock recap, or the practice result.
String evidenceLocation(Attempt attempt) =>
    attempt.isMock ? AppRoutes.result(attempt.id) : AppRoutes.practiceResult(attempt.id);

/// The top of the Practice tab: [practiceSuggestionProvider] drawn as the lit card. It follows
/// the subject picked on the tiles, and its Start opens the confirm sheet in that same subject.
class SuggestionHero extends ConsumerWidget {
  const SuggestionHero({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suggestion = ref.watch(practiceSuggestionProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final now = ref.watch(nowProvider)();
    final late = isLateNight(now);
    final subject = subjectNameFor(suggestion.subjectId, catalog);
    final overline = late ? PracticeCopy.lateOverline : PracticeCopy.suggestedOverline;

    void confirm(PracticeSelection selection) => showPracticeConfirm(context, selection: selection);

    switch (suggestion) {
      case ResumeSuggestion(:final draft):
        final total = draft.view.questions.length;
        final answered = ref.watch(draftSummaryProvider(draft.sessionId)).value?.answered ?? 0;
        return SuggestionCard(
          subjectId: draft.subject,
          overline: PracticeCopy.resumeOverline,
          number: '$answered',
          unit: '${PracticeCopy.resumeOf(total)} answered',
          title: draft.isMock
              ? PracticeCopy.resumeMockTitle(draft.mockNumber == null ? null : 'Mock ${draft.mockNumber}', subject)
              : PracticeCopy.resumePracticeTitle(subject),
          reason: draft.isMock
              ? PracticeCopy.resumeMockReason(DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs))
              : PracticeCopy.resumePracticeReason,
          actionLabel: PracticeCopy.resumeKey,
          onAction: () => context.go(AppRoutes.run(draft.sessionId)),
        );
      case ChapterSuggestion():
        final s = suggestion;
        return SuggestionCard(
          subjectId: s.subjectId,
          overline: overline,
          number: '${s.count}',
          unit: PracticeCopy.questionsUnit,
          title: s.chapter,
          kicker: PracticeCopy.chapterKicker(subject),
          reason: s.mockNumber != null
              ? PracticeCopy.chapterReasonMock(s.marksLost, 'Mock ${s.mockNumber}')
              : PracticeCopy.chapterReasonPractice(s.missed),
          onShowMe: () => context.push(evidenceLocation(s.attempt)),
          actionLabel: PracticeCopy.startKey,
          onAction: () => confirm(s.selection),
        );
      case SubjectSuggestion():
        final s = suggestion;
        return SuggestionCard(
          subjectId: s.subjectId,
          overline: overline,
          number: '${s.count}',
          unit: PracticeCopy.questionsUnit,
          title: PracticeCopy.subjectTitle(subject),
          kicker: PracticeCopy.subjectKicker,
          reason: PracticeCopy.subjectReason(subject, PracticeCopy.when(s.attempt.completedAt.toLocal(), now)),
          onShowMe: () => context.push(evidenceLocation(s.attempt)),
          actionLabel: PracticeCopy.startKey,
          onAction: () => confirm(s.selection),
        );
      case StartingSuggestion():
        final s = suggestion;
        return SuggestionCard(
          subjectId: s.subjectId,
          overline: overline,
          number: '${s.count}',
          unit: PracticeCopy.questionsUnit,
          title: s.firstEver ? PracticeCopy.startingTitle : PracticeCopy.subjectTitle(subject),
          kicker: s.firstEver ? PracticeCopy.startingKicker(subject) : PracticeCopy.subjectKicker,
          reason: s.picked
              ? (s.attemptsKnown ? PracticeCopy.pickedStartReason(subject) : PracticeCopy.pickedUnknownReason)
              : (s.firstEver ? PracticeCopy.startingReason(subject) : PracticeCopy.firstOnListReason(subject)),
          actionLabel: PracticeCopy.startKey,
          onAction: () => confirm(s.selection),
        );
    }
  }
}
