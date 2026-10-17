import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../../../core/sync/session/session_journal.dart';
import '../../you/you_providers.dart' show lateNightLinesProvider;
import '../copy.dart';
import '../data/practice_catalog.dart';
import '../data/suggestion.dart';
import '../model/practice_selection.dart';
import 'confirm_sheet.dart';
import 'resume_sheet.dart';
import 'suggestion_card.dart';

/// The draft of [sessionId] as the Practice card should read it: the live latest draft when it is
/// this session's (the one the bar's Resume capsule and Today read, written again each time the
/// paper is left or acknowledged), otherwise the stored one. Watching the live draft is what keeps
/// the card's count in step with the capsule: a count read once, while the paper was opening,
/// would show "0 of 10" after leaving it with ten answered (FINDINGS 28).
Future<SessionDraft?> _draftOf(Ref ref, SessionDraftRepository drafts, String sessionId) {
  final live = ref.watch(latestSessionDraftProvider).value;
  if (live != null && live.sessionId == sessionId) return Future.value(live);
  return drafts.bySessionId(sessionId);
}

/// Answer counts of one stored session, read from its journal by the same call the capsule uses
/// ([SessionDraftRepository.summaryOf]), and read again whenever the draft is written again.
final draftSummaryProvider = FutureProvider.autoDispose.family<DraftSummary?, String>((ref, sessionId) async {
  final drafts = ref.watch(sessionDraftRepositoryProvider);
  final draft = await _draftOf(ref, drafts, sessionId);
  return draft == null ? null : drafts.summaryOf(draft);
});

/// Which questions of one stored session have an answer now, in the paper's order, read from its
/// journal (the painted sheet on the resume card inks exactly these). Null when it cannot be read.
final draftAnsweredProvider = FutureProvider.autoDispose.family<List<bool>?, String>((ref, sessionId) async {
  final drafts = ref.watch(sessionDraftRepositoryProvider);
  final db = ref.watch(appDatabaseProvider);
  final draft = await _draftOf(ref, drafts, sessionId);
  if (draft == null) return null;
  final journal = await SessionJournal.open(db, userId: draft.userId, sessionId: draft.sessionId);
  final answers = journal.answers;
  return [for (final q in draft.view.questions) answers.containsKey(q.id)];
});

/// Whether the painted sheet may show beside the printed count: while either is still being read
/// it holds its place, and once both are known it shows only if they agree. They come from the same
/// journal, so they do in the app; if a source ever disagrees the sheet is left out rather than
/// inking bubbles the number does not back up (truthful data only).
@visibleForTesting
bool sheetAgrees({required List<bool>? flags, required int? answered}) =>
    flags == null || answered == null || flags.where((v) => v).length == answered;

/// True when [draft] can still be continued right now.
bool canContinue(SessionDraft? draft, DateTime now) =>
    draft != null && resumableDraft(draft, sessionId: draft.sessionId, nowMs: now.millisecondsSinceEpoch);

/// The location of the paper behind a claim: the mock recap, or the practice result.
String evidenceLocation(Attempt attempt) => attempt.isMock ? AppRoutes.result(attempt.id) : AppRoutes.practiceResult(attempt.id);

/// The top of the Practice tab: [practiceSuggestionProvider] drawn as the lit card. It follows
/// the subject picked on the tiles, and its Start opens the confirm sheet in that same subject.
class SuggestionHero extends ConsumerWidget {
  const SuggestionHero({super.key, this.actionKey, this.compact = false});

  /// Marks the card's Start key (Mobi points at it).
  final GlobalKey? actionKey;

  /// The Practice tab's shorter card (an 88 dp object), so the subject strip above it and the
  /// first mode below it share the first screen. Other callers keep the full card.
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suggestion = ref.watch(practiceSuggestionProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final now = ref.watch(nowProvider)();
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    // The "Late-night lines" setting turns this one off too.
    final late = isLateNight(now) && ref.watch(lateNightLinesProvider);
    final subject = subjectNameFor(suggestion.subjectId, catalog);
    // One title, no repeat (v13 critic): the card's title already names the subject the lit tile
    // chose (L08), so an "Up next in [subject]" line over it said the same thing twice. Only after
    // 11 PM is there a line over the title: it points at the one set.
    final String? overline = late ? PracticeCopy.lateOverline : null;

    void confirm(PracticeSelection selection) => showPracticeConfirm(context, selection: selection);

    final Widget card;
    switch (suggestion) {
      case ResumeSuggestion(:final draft):
        final total = draft.view.questions.length;
        final summary = ref.watch(draftSummaryProvider(draft.sessionId)).value;
        final answered = summary?.answered ?? 0;
        final flagsRead = ref.watch(draftAnsweredProvider(draft.sessionId));
        final flags = flagsRead.value;
        final showSheet = (flagsRead.isLoading || flags != null) && sheetAgrees(flags: flags, answered: summary?.answered);
        card = SuggestionCard(
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
          compact: compact,
          sheet: showSheet ? ResumeSheet(total: total, answered: flags) : null,
        );
      case ChapterSuggestion():
        final s = suggestion;
        card = SuggestionCard(
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
          actionLabel: PracticeCopy.startCount(s.count),
          onAction: () => confirm(s.selection),
          offline: offline,
          compact: compact,
          showFigure: !compact,
        );
      case SubjectSuggestion():
        final s = suggestion;
        card = SuggestionCard(
          subjectId: s.subjectId,
          overline: overline,
          number: '${s.count}',
          unit: PracticeCopy.questionsUnit,
          title: PracticeCopy.subjectTitle(subject),
          kicker: PracticeCopy.subjectKicker,
          reason: PracticeCopy.subjectReason(s.attempt.correct, s.attempt.total, PracticeCopy.when(s.attempt.completedAt.toLocal(), now)),
          onShowMe: () => context.push(evidenceLocation(s.attempt)),
          actionLabel: PracticeCopy.startCount(s.count),
          onAction: () => confirm(s.selection),
          offline: offline,
          compact: compact,
          showFigure: !compact,
        );
      case StartingSuggestion():
        final s = suggestion;
        card = SuggestionCard(
          subjectId: s.subjectId,
          overline: overline,
          number: '${s.count}',
          unit: PracticeCopy.questionsUnit,
          title: s.firstEver ? PracticeCopy.startingTitle : PracticeCopy.subjectTitle(subject),
          kicker: s.firstEver ? PracticeCopy.startingKicker(subject) : PracticeCopy.subjectKicker,
          // A student with no paper at all is told what ten questions do; a subject with no paper
          // while other papers exist says so; the tile always steers the card now (L08).
          reason: s.firstEver && s.attemptsKnown
              ? PracticeCopy.startingReason(subject)
              : s.picked
                  ? (s.attemptsKnown ? PracticeCopy.pickedStartReason(subject) : PracticeCopy.pickedUnknownReason)
                  : (s.firstEver ? PracticeCopy.startingReason(subject) : PracticeCopy.firstOnListReason(subject)),
          actionLabel: PracticeCopy.startCount(s.count),
          onAction: () => confirm(s.selection),
          offline: offline,
          compact: compact,
          showFigure: !compact,
        );
    }

    // What the card is about: a new subject, a new chapter or a resume swaps it; a new count or a
    // pull that brings the same suggestion only updates it in place.
    final identity = switch (suggestion) {
      ResumeSuggestion(:final draft) => 'resume:${draft.sessionId}',
      ChapterSuggestion(:final subjectId, :final chapter, :final attempt) => 'chapter:$subjectId:$chapter:${attempt.id}',
      SubjectSuggestion(:final subjectId, :final attempt) => 'subject:$subjectId:${attempt.id}',
      StartingSuggestion(:final subjectId, :final firstEver) => 'start:$subjectId:$firstEver',
    };
    // The hero swap (brief 2.8): the new card rises into place over the old one (the overlap switcher's rise), 240 ms, and
    // the height eases; never from a small scale. Reduced motion swaps at once. The Start key's
    // mark sits on the swap, so Mobi aims at the card while two cards briefly share the slot.
    final swap = Motion.of(context, Motion.card);
    return KeyedSubtree(
      key: actionKey,
      child: MmSizeEase(
        duration: swap,
        curve: Motion.out,
        alignment: Alignment.topCenter,
        child: MmOverlapSwitcher.rise(
          duration: swap,
          alignment: Alignment.topCenter,
          child: KeyedSubtree(key: ValueKey(identity), child: card),
        ),
      ),
    );
  }
}
