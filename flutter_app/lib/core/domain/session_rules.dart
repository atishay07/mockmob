import '../models/session_draft.dart';

/// The server accepts a submit until `expiresAt + 120 s` [API 2.7].
const submissionGraceMs = 120000;

/// Resume rules ported from `data/session_draft.js`.
///
/// A draft can resume only when it has a session id, 1 to 50 questions, a finite deadline,
/// matches the requested session id (or generation key), and either the deadline is still in
/// the future or a submit is pending and the grace window has not closed.
bool resumableDraft(SessionDraft? saved, {String? generationKey, String? sessionId, required int nowMs}) {
  if (saved == null) return false;
  if (saved.view.meta.sessionId.isEmpty || saved.rejected) return false;
  final count = saved.view.questions.length;
  if (count < 1 || count > 50) return false;
  if (saved.endsAtWallMs <= 0) return false;
  if (sessionId != null) {
    if (saved.view.meta.sessionId != sessionId) return false;
  } else if (saved.generationKey != generationKey) {
    return false;
  }
  return saved.endsAtWallMs > nowMs || (saved.pendingSubmission && saved.endsAtWallMs + submissionGraceMs > nowMs);
}

/// True while a submit is still allowed by the server.
bool submissionWindowOpen({required int endsAtMs, required int nowMs}) => nowMs <= endsAtMs + submissionGraceMs;

/// What Today says about a mock whose time ran out while the student was away (spec 5.3).
enum EndedMockOutcome {
  /// The server has not been asked yet. Read `GET /api/attempts/{id}` first (200 or 404).
  needsCheck,

  /// The attempt exists on the server: "Your 31 answers sent before then were recorded."
  recorded,

  /// No attempt yet and the window is open: "Your answers are on this phone and are being sent."
  beingSent,

  /// No attempt and the window closed: "...so it could not be recorded."
  windowClosed,
}

/// Chooses the ended-mock copy from real state. [attemptExistsOnServer] is true after a read of
/// the attempt returned 200, false after a 404, and null when the server was not asked yet.
EndedMockOutcome endedMockOutcome({required bool? attemptExistsOnServer, required int endsAtMs, required int nowMs}) {
  if (attemptExistsOnServer == null) return EndedMockOutcome.needsCheck;
  if (attemptExistsOnServer) return EndedMockOutcome.recorded;
  return submissionWindowOpen(endsAtMs: endsAtMs, nowMs: nowMs) ? EndedMockOutcome.beingSent : EndedMockOutcome.windowClosed;
}
