import '../../api/api_error.dart';
import '../../models/session_draft.dart';
import '../../repositories/pending_result_repository.dart';
import '../../repositories/session_draft_repository.dart';
import 'session_api.dart';
import 'session_journal.dart';

/// What happened to a submit. Only [SubmitReceived] means the server has the answers.
sealed class SubmitOutcome {
  const SubmitOutcome();
}

/// `POST /api/attempts` returned 200 (or the server had already finalised the session). The
/// attempt is scored, so the result is openable at once.
class SubmitReceived extends SubmitOutcome {
  const SubmitReceived({required this.attempt, required this.receivedAt, this.finalisedByServer = false});

  /// The scored attempt as the server returned it.
  final Map<String, dynamic> attempt;

  /// When the acknowledgement arrived ("Saved on the server at 10:42 PM").
  final DateTime receivedAt;

  /// The server created the attempt itself at expiry (or a background job submitted it).
  final bool finalisedByServer;

  String get attemptId => (attempt['id'] as String?) ?? '';
}

/// The submit did not reach the server (offline, slow, 5xx). The answers stay on the phone with
/// `pendingSubmission` set, and the submit is retried until `endsAt + 120 s`.
class SubmitPending extends SubmitOutcome {
  const SubmitPending(this.error);

  final ApiError error;
}

/// The server's submission window ended and no attempt exists: this session cannot be recorded.
class SubmitWindowClosed extends SubmitOutcome {
  const SubmitWindowClosed();
}

/// The server refused the submit for a reason retrying cannot fix.
class SubmitRejected extends SubmitOutcome {
  const SubmitRejected(this.error);

  final ApiError error;
}

/// Submits a session: `POST /api/attempts` with the answers and the event log filtered to the
/// session length, the pending-submission bookkeeping, and the `SESSION_EXPIRED` check against
/// `GET /api/attempts/{id}`. Used by the foreground engine and by the WorkManager job.
class SessionSubmitter {
  SessionSubmitter({
    required this.api,
    required this.drafts,
    required this.pendingResults,
    required this.cacheAttempt,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final SessionApi api;
  final SessionDraftRepository drafts;
  final PendingResultRepository pendingResults;

  /// Stores the scored attempt in the local attempts cache (and updates any live list).
  final Future<void> Function(Map<String, dynamic> attempt) cacheAttempt;
  final DateTime Function() _now;

  /// [durationMs] is the session length on the session clock. Events later than it are not sent.
  Future<SubmitOutcome> submit({required SessionDraft draft, required SessionJournal journal, required int durationMs}) async {
    // Persist the intent first: if the process dies mid-call, Today still knows a submit is owed.
    final current = draft.pendingSubmission ? draft : draft.copyWith(pendingSubmission: true);
    await drafts.save(current);

    try {
      final attempt = await api.submit(
        sessionId: draft.sessionId,
        sessionTicket: draft.view.meta.sessionTicket,
        answers: journal.answers,
        events: journal.eventsWithin(durationMs),
      );
      return await _received(draft.sessionId, attempt, finalised: false);
    } on ApiError catch (e) {
      if (e.hasCode(ApiCodes.sessionExpired) || e.hasCode(ApiCodes.sessionAlreadySubmitted)) {
        return _afterExpiry(current);
      }
      if (e.isRetryable || e.isUnauthorized) return SubmitPending(e);
      // Retrying cannot help. Clear the pending flag so the draft is not "being sent" forever
      // and the student has a way out.
      await drafts.save(current.copyWith(pendingSubmission: false, rejected: true));
      return SubmitRejected(e);
    }
  }

  /// `SESSION_EXPIRED`: read the attempt first. A 200 means the server finalised the session
  /// (the result opens), a 404 means the window really closed.
  Future<SubmitOutcome> _afterExpiry(SessionDraft draft) async {
    try {
      final attempt = await api.fetchAttempt(draft.sessionId);
      if (attempt != null) return _received(draft.sessionId, attempt, finalised: true);
    } on ApiError catch (e) {
      // Could not ask (offline): keep the draft and say it is still being sent.
      return SubmitPending(e);
    }
    await drafts.save(draft.copyWith(pendingSubmission: false, windowClosed: true));
    return const SubmitWindowClosed();
  }

  Future<SubmitOutcome> _received(String sessionId, Map<String, dynamic> attempt, {required bool finalised}) async {
    final id = (attempt['id'] as String?) ?? sessionId;
    await cacheAttempt(attempt);
    await pendingResults.recordReceived(id);
    // "Clear drafts": the attempt exists, so the draft and its journal are no longer needed.
    await drafts.deleteSession(sessionId);
    return SubmitReceived(attempt: attempt, receivedAt: _now(), finalisedByServer: finalised);
  }
}
