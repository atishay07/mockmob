import 'package:flutter_riverpod/misc.dart' show Override;

import 'core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'core/connectivity/connectivity_providers.dart' show networkStatusProvider;
import 'core/repositories/repositories.dart';
import 'core/router/quick_start.dart';
import 'core/sync/pending_work.dart' show pendingWorkProvider, pendingWorkCountProvider;
import 'core/widgets/bar/bar_badges.dart';
import 'core/widgets/bar/bar_live.dart';
import 'features/practice/data/practice_catalog.dart' show practiceSubjectProvider, practiceSubjectsProvider;
import 'features/practice/data/start_entries.dart' show practiceQuickNtaProvider;
import 'features/review/data/review_providers.dart' show quickRepairFromReviewProvider, reviewIndexProvider;
import 'features/today/data/today_providers.dart' show todayInputsProvider, todayNextActionProvider, todayViewProvider;
import 'features/today/logic/move_builder.dart' show buildMove, paperLabel;
import 'features/today/logic/subjects.dart' show canonicalSubject;
import 'features/today/logic/today_model.dart' show GoTo, ResumeHero;

/// The Start sheet, the bar's live capsule and its badges, each wired to its real source
/// (DOCK.md 5.3, 5.6 and 6). Core keeps safe defaults so shells under test never open the session
/// journal; the app and the device demo both use this one list, so they cannot drift apart.
List<Override> liveAppOverrides() => [
  // Start's "Repair the next mistake" opens the ten-minute run from tonight's first mistake
  // (one pick for Today, Review and Start; the launcher's 10-min repair opens the same).
  quickStartRepairProvider.overrideWith((ref) => ref.watch(quickRepairFromReviewProvider)),
  // Start's NTA row follows Practice's quote for the student's practice subject.
  quickStartNtaProvider.overrideWith((ref) => ref.watch(practiceQuickNtaProvider)),
  // Start's hero is tonight's move, the same move Today's hero builds.
  startTonightMoveProvider.overrideWith((ref) {
    final action = ref.watch(todayNextActionProvider);
    final target = action?.target;
    if (action == null || target is! GoTo) return null;
    return StartMove(title: buildMove(ref.watch(todayInputsProvider)).summary, location: target.location, kind: action.actionType);
  }),
  // Start's subject chips: the student's practice subjects, opening on Practice's subject.
  startSubjectsProvider.overrideWith((ref) {
    final catalog = ref.watch(practiceSubjectsProvider).value;
    return catalog == null ? const <String>[] : [for (final s in catalog) s.id];
  }),
  startDefaultSubjectProvider.overrideWith((ref) => ref.watch(practiceSubjectProvider)),
  // The bar's live capsule and badges, each from its real source.
  barSendingInputProvider.overrideWith((ref) {
    final draft = ref.watch(latestSessionDraftProvider).value;
    if (draft == null || !draft.pendingSubmission) return null;
    if (ref.watch(networkStatusProvider) == NetworkStatus.offline) return null;
    return _paper(draft.subject, mock: draft.isMock);
  }),
  barMarkedInputProvider.overrideWith((ref) {
    final unopened = ref.watch(unopenedResultsProvider).value ?? const [];
    if (unopened.isEmpty) return null;
    final first = unopened.first;
    final all = ref.watch(attemptsRepositoryProvider).value;
    final attempt = all == null ? null : [for (final a in all) if (a.id == first.attemptId) a].firstOrNull;
    return BarMarked(
      attemptId: first.attemptId,
      paper: all == null || attempt == null ? 'Your paper' : paperLabel(all, attempt),
      subject: attempt == null ? null : subjectDisplayName(canonicalSubject(attempt.subject)),
      more: unopened.length - 1,
    );
  }),
  barResumeInputProvider.overrideWith((ref) {
    final draft = ref.watch(resumeDraftProvider);
    if (draft == null) return null;
    final offer = ref.watch(resumeOfferProvider).value;
    return BarResume(
      sessionId: draft.sessionId,
      paper: _paper(draft.subject, mock: draft.isMock),
      total: draft.view.questions.length,
      answered: offer != null && offer.draft.sessionId == draft.sessionId ? offer.answered : null,
      endsAt: draft.isMock && draft.endsAtWallMs > 0 ? DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs) : null,
    );
  }),
  barOfflineInputProvider.overrideWith((ref) {
    if (ref.watch(networkStatusProvider) != NetworkStatus.offline || !ref.watch(pendingWorkProvider)) return null;
    return ref.watch(pendingWorkCountProvider).value?.unsentAnswers ?? 0;
  }),
  // Today's hero already shows the open draft and the sealed result: the capsule stands down for
  // them on Today.
  todayHeroCoversProvider.overrideWith((ref) {
    final view = ref.watch(todayViewProvider);
    if (view.hero == null) return const {};
    final unopened = ref.watch(unopenedResultsProvider).value ?? const [];
    return {
      if (view.hero is ResumeHero) BarLiveKind.resume,
      if (unopened.isNotEmpty) BarLiveKind.marked,
    };
  }),
  barReviewCountProvider.overrideWith((ref) => ref.watch(reviewIndexProvider)?.tonight?.items.length ?? 0),
];

/// "Accountancy mock", "Business Studies practice".
String _paper(String subject, {required bool mock}) => '${subjectDisplayName(subject)} ${mock ? 'mock' : 'practice'}';
