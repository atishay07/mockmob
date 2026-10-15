import '../../api/api_error.dart';
import '../../models/session.dart';
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
    this.signedInUserId,
    this.appVersion,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final SessionApi api;
  final SessionDraftRepository drafts;
  final PendingResultRepository pendingResults;

  /// Stores the scored attempt in the local attempts cache (and updates any live list).
  final Future<void> Function(Map<String, dynamic> attempt) cacheAttempt;

  /// Who is signed in now, for a submitter whose stores follow the current account. A submit
  /// can take 45 s, and the student can sign out and another can sign in meanwhile: then the
  /// attempts cache and the result note would land in the other account. Null when the stores
  /// are already pinned to one user (the background job).
  final String? Function()? signedInUserId;

  /// This build's version for the submit's `client` meta ("1.0.0"); empty or null leaves it out.
  final String Function()? appVersion;
  final DateTime Function() _now;

  /// The attempt meta sent with the submit (spec 6, item 6): which runner (`android`), its version
  /// and the paper's start on this phone's clock, and how the paper ended when its record says so.
  /// A description of the device: the server stores it and never scores with it.
  Map<String, Object?> submitMeta(SessionDraft draft, List<SessionEvent> events) {
    if (!kRichSessionEvents) return const {};
    String version;
    try {
      version = appVersion?.call() ?? '';
    } on Object {
      version = '';
    }
    final last = events.isEmpty ? null : events.last;
    return {
      'client': {
        'platform': 'android',
        if (version.isNotEmpty) 'appVersion': version,
        if (draft.startedRefWallMs > 0) 'startedAt': draft.startedRefWallMs,
      },
      if (last != null && last.type == SessionEvent.end && last.reason != null) 'endedBy': last.reason,
    };
  }

  /// True while the account that owns [draft] is still the one the stores write for.
  bool _ownerSignedIn(SessionDraft draft) {
    final current = signedInUserId;
    if (current == null) return true;
    try {
      return current() == draft.userId;
    } on Object {
      return false;
    }
  }

  /// [durationMs] is the session length on the session clock. Events later than it are not sent.
  Future<SubmitOutcome> submit({required SessionDraft draft, required SessionJournal journal, required int durationMs}) async {
    // Persist the intent first: if the process dies mid-call, Today still knows a submit is owed.
    final current = draft.pendingSubmission ? draft : draft.copyWith(pendingSubmission: true);
    try {
      await _saveOwned(current);
    } on Object {
      // A failed local write must not stop the send: the answers go to the server first.
    }

    try {
      final events = journal.eventsWithin(durationMs);
      final attempt = await api.submit(
        sessionId: draft.sessionId,
        sessionTicket: draft.view.meta.sessionTicket,
        answers: journal.answers,
        events: events,
        meta: submitMeta(draft, events),
        // Only ever with the owner's token: sent with another account's, the server would refuse
        // the paper and the refusal would end it. The guard's refusal is not definitive, so the
        // submit stays owed and goes out once the owner is signed in again.
        forUserId: draft.userId,
      );
      return await _received(draft, attempt, finalised: false);
    } on ApiError catch (e) {
      if (e.hasCode(ApiCodes.sessionExpired) || e.hasCode(ApiCodes.sessionAlreadySubmitted)) {
        return _afterExpiry(current);
      }
      // Offline, slow, busy, signed out, or a failure the app cannot name: the submit is still
      // owed and the answers stay on the phone. Only a clear refusal ends it.
      if (!e.isDefinitiveRefusal) return SubmitPending(e);
      // Retrying cannot help. Clear the pending flag so the draft is not "being sent" forever
      // and the student has a way out.
      await _tryDraftSave(current.copyWith(pendingSubmission: false, rejected: true));
      return SubmitRejected(e);
    } on Object {
      // Not an API failure: a parsing or local error before the server's answer was known. The
      // submit is still owed, so say pending and keep the draft; the next try (a reconnect, the
      // backup job, the next start) sends it again. The server's submit is idempotent.
      return const SubmitPending(ApiError(kind: ApiErrorKind.unknown, code: 'unknown'));
    }
  }

  /// Writes [draft] to its own row, or to its archive row when a newer session of the same
  /// selection has taken the row over since (a submit that outlives the screen): the flags of a
  /// paper still owed must never replace another paper's draft.
  Future<void> _saveOwned(SessionDraft draft) async {
    if (!await drafts.saveIfOwned(draft)) await drafts.archive(draft);
  }

  Future<void> _tryDraftSave(SessionDraft draft) async {
    try {
      await _saveOwned(draft);
    } on Object {
      // Best effort: the outcome is returned either way.
    }
  }

  /// `SESSION_EXPIRED`: read the attempt first. A 200 means the server finalised the session
  /// (the result opens), a 404 means the window really closed.
  Future<SubmitOutcome> _afterExpiry(SessionDraft draft) async {
    try {
      final attempt = await api.fetchAttempt(draft.sessionId, forUserId: draft.userId);
      if (attempt != null) return _received(draft, attempt, finalised: true);
    } on ApiError catch (e) {
      // Could not ask (offline): keep the draft and say it is still being sent.
      return SubmitPending(e);
    } on Object {
      return const SubmitPending(ApiError(kind: ApiErrorKind.unknown, code: 'unknown'));
    }
    await _tryDraftSave(draft.copyWith(pendingSubmission: false, windowClosed: true));
    return const SubmitWindowClosed();
  }

  Future<SubmitOutcome> _received(SessionDraft draft, Map<String, dynamic> attempt, {required bool finalised}) async {
    final sessionId = draft.sessionId;
    final raw = attempt['id'];
    // No attempt id means no proof the server recorded the paper. Keep the draft and its
    // journal, and keep the submit owed: deleting them here would lose the answers.
    if (raw is! String || raw.trim().isEmpty) {
      return const SubmitPending(ApiError(kind: ApiErrorKind.server, code: unusableAttemptCode));
    }
    final id = raw;
    // The server has accepted and scored the attempt. From here a local failure (the attempts
    // cache, the pending-result note, clearing the draft) must not turn a recorded submit into
    // an error: each step is best effort, and a draft that could not be cleared is settled by
    // the next start or the backup job, since the submit is idempotent.
    // The attempts cache and the result note follow whoever is signed in now. After an
    // account switch they belong to someone else, so they are skipped: the attempt is on the
    // server and the owner sees it in their list.
    if (_ownerSignedIn(draft)) {
      try {
        await cacheAttempt(attempt);
      } on Object {
        // The result opens from the server copy.
      }
    }
    if (_ownerSignedIn(draft)) {
      try {
        await pendingResults.recordReceived(id);
      } on Object {
        // Only a note for Today; losing it is harmless.
      }
    }
    try {
      // "Clear drafts": the attempt exists, so the draft and its journal are no longer needed.
      // Pinned to the draft's owner, whoever is signed in now.
      await drafts.deleteSession(sessionId, userId: draft.userId);
    } on Object {
      // Left behind, not lost: it is submitted again, and answered by the server as already done.
    }
    return SubmitReceived(attempt: attempt, receivedAt: _now(), finalisedByServer: finalised);
  }
}
