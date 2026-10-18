// A paper that is open and that this phone is not running: what Today and Practice offer to continue,
// and what stops a second paid start (v15 walk, credits).
//
// The walk killed the app while "Start mock" was still spinning on a slow server. The server had
// already taken the 50 credits, and the phone had nothing to show for it: no draft (the runner writes it
// after the server answers), and a start key that forgot itself after a quarter of an hour. There are
// three ways a paper can be open without a draft here, and each is read:
//   - a start the phone sent and never saw the answer to: its key is still stored with what it asked
//     for (SessionDraftRepository.pendingStarts), and asking again with that key is the same paper;
//   - a durable session the server holds: the website's resume read, `GET /api/learning/plan`, whose
//     primary action is `resume_session` while the account has a session that is still active. The id
//     it names is checked with `POST /api/sessions {sessionId}` (the same call the runner makes), which
//     answers with the paper's own clock, so the card can say when it ends and a plan read that is
//     stale never offers a paper that is over;
//   - a paper already running on this phone, which Today and Practice already lead with, and which
//     only stops a second paid start here.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/connectivity/connectivity.dart';
import '../../../core/models/learning_plan.dart';
import '../../../core/models/models.dart' show SessionDraft, SessionView, Subject;
import '../../../core/repositories/local_scope.dart' show userIdProvider;
import '../../../core/repositories/plan_repository.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/sync/session/session_engine.dart' show SessionEngine;
import '../../../core/sync/sync_providers.dart';
import '../model/open_paper.dart';
import '../model/pending_start.dart';
import '../copy.dart' show PracticeCopy;
import 'practice_catalog.dart';
import 'practice_starter.dart';
import 'suggestion.dart' show publicSubjectOf;

export '../model/open_paper.dart';

/// What the plan read says about a session the server is holding: its id, and the subject and mode
/// the server named beside it. Null when the plan holds nothing open.
typedef HeldHint = ({String sessionId, String? subject, String? mode});

HeldHint? heldHintOf(LearningPlan? plan) {
  final primary = plan?.primary;
  final id = primary?.resumeSessionId;
  if (primary == null || id == null) return null;
  return (sessionId: id, subject: _text(primary.fields['subject']), mode: _text(primary.fields['mode']));
}

String? _text(Object? v) => v is String && v.isNotEmpty ? v : null;

/// Reads what is open: [offer] for the cards, [blocker] for the start that must wait.
class OpenPaperResolver {
  OpenPaperResolver({required this.drafts, required this.verify, required this.now, required this.catalog});

  final SessionDraftRepository drafts;

  /// Asks the server for a session by its id (`POST /api/sessions {sessionId}`), which answers with the
  /// paper as it stands (its clock and the events it holds) or an error when it is not open.
  final Future<SessionView> Function(String sessionId) verify;
  final DateTime Function() now;
  final List<Subject>? Function() catalog;

  /// The paper to offer the student, or null. A paper already running here is led with by Today and
  /// Practice themselves, so this is only a paper they cannot see: one the server holds (it knows the
  /// clock), else a start whose answer never came.
  Future<OpenPaper?> offer(HeldHint? held) async {
    if ((await drafts.runningDrafts()).isNotEmpty) return null;
    final pendings = await _pendings();
    final paper = await _held(held, pendings);
    if (paper != null) return paper;
    return pendings.isEmpty ? null : _pending(pendings.first);
  }

  /// What a credit-spending start must not run past: a paper running on this phone, or one the server
  /// holds. A start whose answer never came does not stop another paper: nothing says it is open, and
  /// asking for the same paper again is already the same paper.
  Future<OpenPaper?> blocker(HeldHint? held) async {
    final running = await drafts.runningDrafts();
    if (running.isNotEmpty) return _onPhone(running.first);
    return _held(held, const []);
  }

  Future<List<PendingStart>> _pendings() async {
    final stored = await drafts.pendingStarts(within: PendingStart.windowOf);
    return [for (final s in stored) ?PendingStart.from(s)];
  }

  OpenPaper _pending(PendingStart p) => OpenPaper(
    kind: OpenPaperKind.pending,
    subjectId: p.selection.subjectId,
    apiMode: p.selection.mode.apiMode,
    count: p.selection.effectiveCount,
    mockNumber: p.mockNumber,
    start: p,
  );

  OpenPaper _onPhone(SessionDraft draft) => OpenPaper(
    kind: OpenPaperKind.onPhone,
    subjectId: draft.subject,
    apiMode: draft.mode,
    count: draft.count,
    mockNumber: draft.mockNumber,
    endsAt: DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs),
    sessionId: draft.sessionId,
  );

  /// The session the plan names, when the server still holds it open and this phone has no draft of it.
  Future<OpenPaper?> _held(HeldHint? hint, List<PendingStart> pendings) async {
    if (hint == null) return null;
    // A paper this phone has a draft for is the phone's to lead with (resume, or an ended notice).
    if (await drafts.bySessionId(hint.sessionId) != null) return null;
    final SessionView view;
    try {
      view = await verify(hint.sessionId);
    } on ApiError {
      return null; // Not open any more, or the server cannot be reached: nothing to offer.
    } on Object {
      return null;
    }
    if (view.questions.isEmpty || (view.state != null && view.state != 'active')) return null;
    final expires = view.expiresAt.millisecondsSinceEpoch;
    if (expires <= 0 || expires <= view.serverNowMs) return null;
    final mode = view.meta.mode ?? hint.mode ?? 'quick';
    final internal = view.questions.first.subject ?? hint.subject;
    if (internal == null) return null;
    final subject = publicSubjectOf(internal, catalog());
    // The clock the server reports, laid on this phone's: the time left, not the time on the server.
    final endsAt = DateTime.fromMillisecondsSinceEpoch(now().millisecondsSinceEpoch + (expires - view.serverNowMs));
    final asked = [
      for (final p in pendings)
        if (_sameAs(p, subject: subject, apiMode: mode, count: view.questions.length)) p,
    ];
    return OpenPaper(
      kind: OpenPaperKind.held,
      subjectId: subject,
      apiMode: mode,
      count: view.questions.length,
      mockNumber: asked.isEmpty ? null : asked.first.mockNumber,
      endsAt: endsAt,
      sessionId: view.meta.sessionId.isNotEmpty ? view.meta.sessionId : view.id,
      start: asked.isEmpty ? null : asked.first,
      view: view,
    );
  }

  static bool _sameAs(PendingStart p, {required String subject, required String apiMode, required int count}) =>
      p.selection.subjectId == subject && p.selection.mode.apiMode == apiMode && p.selection.effectiveCount == count;
}

/// How continuing an open paper ended.
sealed class ContinueResult {
  const ContinueResult();
}

/// The paper is on this phone: open `/run/<sessionId>`.
class Continued extends ContinueResult {
  const Continued(this.sessionId);

  final String sessionId;
}

class ContinueFailed extends ContinueResult {
  const ContinueFailed(this.failure, {this.message});

  final StartFailure failure;
  final String? message;
}

/// Opens an open paper, or lets it go. Asking again goes through the same starter a first start does,
/// with the key that is stored, so the server answers with the paper it already has and takes nothing
/// more; a held paper that no stored start asked for is taken over from the server's own copy.
class PaperContinuer {
  const PaperContinuer({required this.starter, required this.startEngine, required this.drafts, required this.changed});

  final PracticeStarting starter;
  final Future<SessionEngine> Function(StartSessionArgs) startEngine;
  final SessionDraftRepository drafts;

  /// Told when a stored start was forgotten, so the cards are read again.
  final void Function() changed;

  Future<ContinueResult> open(OpenPaper paper) async {
    try {
      if (paper.kind == OpenPaperKind.onPhone) return Continued(paper.sessionId!);
      final start = paper.start;
      if (start != null) return _answer(await starter.start(start.selection));
      return await _takeOver(paper);
    } on Object {
      return const ContinueFailed(StartFailure.generic);
    }
  }

  ContinueResult _answer(StartOutcome outcome) => switch (outcome) {
    Started(:final sessionId) => Continued(sessionId),
    // Continuing is not starting: offline it says so in its own words.
    StartFailed(:final failure, :final message) => ContinueFailed(failure, message: message ?? (failure == StartFailure.offline ? PracticeCopy.openOffline : null)),
  };

  Future<ContinueResult> _takeOver(OpenPaper paper) async {
    final view = paper.view!;
    final engine = await startEngine(
      StartSessionArgs(
        view: view,
        subject: paper.subjectId,
        mode: paper.apiMode,
        count: paper.count,
        // The server keeps the key this paper was asked for with; this phone never held it.
        generationKey: '',
        serverEvents: view.events,
      ),
    );
    // The draft and journal are on the phone now; the runner restores its own engine from them.
    engine.dispose();
    await _forgetAsking(paper);
    return Continued(paper.sessionId!);
  }

  /// "Not now" on a card for a start nobody read: the key is forgotten, so the paper is no longer
  /// offered and a new start is a new paper.
  Future<void> letGo(OpenPaper paper) async {
    final start = paper.start;
    if (start == null) return;
    await drafts.clearGenerationKey(start.draftKey);
    changed();
  }

  Future<void> _forgetAsking(OpenPaper paper) async {
    for (final s in await drafts.pendingStarts(within: PendingStart.windowOf)) {
      final p = PendingStart.from(s);
      if (p == null) continue;
      if (OpenPaperResolver._sameAs(p, subject: paper.subjectId, apiMode: paper.apiMode, count: paper.count)) {
        await drafts.clearGenerationKey(p.draftKey);
      }
    }
    changed();
  }
}

/// The plan Today reads is the plan this reads: one request serves both.
const int openPaperPlanMinutes = 10;

final paperContinuerProvider = Provider<PaperContinuer>((ref) {
  return PaperContinuer(
    starter: ref.watch(practiceStarterProvider),
    startEngine: ref.watch(sessionEngineStarterProvider),
    drafts: ref.watch(sessionDraftRepositoryProvider),
    changed: () => ref.read(pendingStartsRevisionProvider.notifier).bump(),
  );
});

final openPaperResolverProvider = Provider<OpenPaperResolver>((ref) {
  return OpenPaperResolver(
    drafts: ref.watch(sessionDraftRepositoryProvider),
    verify: (id) => ref.read(sessionEngineServicesProvider).api.resume(id),
    now: ref.watch(nowProvider),
    catalog: () => ref.read(practiceSubjectsProvider).value,
  );
});

/// The paper Today and Practice offer to continue, or null. Read again when a draft is written or
/// removed, when a start key is written or forgotten, when the plan's resume changes, and when the
/// connection comes back (a paper the server holds cannot be checked offline).
final openPaperProvider = FutureProvider.autoDispose<OpenPaper?>((ref) async {
  ref.watch(userIdProvider);
  ref.watch(latestSessionDraftProvider);
  ref.watch(pendingStartsRevisionProvider);
  ref.watch(networkStatusProvider);
  final held = ref.watch(planRepositoryProvider(openPaperPlanMinutes).select((s) => heldHintOf(s.value)));
  try {
    return await ref.watch(openPaperResolverProvider).offer(held);
  } on Object {
    return null;
  }
});
