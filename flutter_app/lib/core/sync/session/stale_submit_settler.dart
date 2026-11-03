import 'dart:async';

import '../../domain/session_rules.dart';
import '../../models/session_draft.dart';
import '../../repositories/session_draft_repository.dart';
import '../../storage/app_database.dart';
import 'session_clock.dart';
import 'session_heartbeat.dart';
import 'session_journal.dart';
import 'session_submitter.dart';
import 'session_work_scheduler.dart';

/// What the settler did with one owed draft.
class SettledDraft {
  const SettledDraft(this.sessionId, this.outcome);

  final String sessionId;
  final SubmitOutcome outcome;
}

/// Settles submits left owed on this phone by an earlier run (LK50): a draft keeps
/// `pendingSubmission` when its window passed while the app was closed, or when the backup job gave
/// up (the background token refresher lost the session). Nothing would ever clear that flag, and
/// every screen said "Sending your answers" for good.
///
/// Run on app start, on resume and when the network comes back. For each owed draft that no live
/// engine owns:
/// - window still open: send it now (the submit is idempotent); still pending afterwards, the
///   backup job is queued again;
/// - window closed: ask the server whether the session was received (`GET /api/attempts/{id}`).
///   Received: the draft is cleared and the result opens as usual. Not received: the draft is marked
///   window-closed, so the existing missed-submit copy shows, never "Sending".
/// Offline, or the server could not be asked: nothing changes until the next run.
class StaleSubmitSettler {
  StaleSubmitSettler({
    required this.db,
    required this.userId,
    required this.drafts,
    required this.submitter,
    required this.scheduler,
    required this.isOnline,
    this.onRetryLive,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final AppDatabase db;
  final String userId;
  final SessionDraftRepository drafts;
  final SessionSubmitter submitter;
  final SessionWorkScheduler scheduler;
  final bool Function() isOnline;

  /// Told when a retry for a session starts (true) or ends without one queued (false).
  final void Function(String sessionId, bool live)? onRetryLive;
  final DateTime Function() _now;

  Future<List<SettledDraft>>? _running;

  /// Settles every owed draft once. A call made while one runs joins it.
  Future<List<SettledDraft>> settle() => _running ??= _settleAll().whenComplete(() => _running = null);

  Future<List<SettledDraft>> _settleAll() async {
    final out = <SettledDraft>[];
    if (!isOnline()) return out;
    final List<SessionDraft> owed;
    try {
      owed = await drafts.owedSubmits();
    } on Object {
      return out;
    }
    final heartbeat = SessionHeartbeat(db, userId: userId, now: _now);
    for (final draft in owed) {
      if (!isOnline()) break;
      if (draft.userId != userId) continue;
      try {
        // A paper open on screen is its engine's to send.
        if (await heartbeat.isLive(draft.sessionId)) continue;
      } on Object {
        continue;
      }
      final outcome = await _settleOne(draft);
      if (outcome != null) out.add(SettledDraft(draft.sessionId, outcome));
    }
    return out;
  }

  Future<SubmitOutcome?> _settleOne(SessionDraft draft) async {
    final nowMs = _now().millisecondsSinceEpoch;
    if (!submissionWindowOpen(endsAtMs: draft.endsAtWallMs, nowMs: nowMs)) {
      final SubmitOutcome outcome;
      try {
        outcome = await submitter.settleAfterWindow(draft);
      } on Object {
        return null;
      }
      if (outcome is! SubmitPending) await _settled(draft.sessionId);
      return outcome;
    }
    // The window is still open: the submit can happen, so make it happen now.
    _live(draft.sessionId, true);
    SubmitOutcome outcome;
    try {
      final journal = await SessionJournal.open(db, userId: draft.userId, sessionId: draft.sessionId, now: _now);
      final clock = SessionClock()..restore(startedRefWallMs: draft.startedRefWallMs, endsAtWallMs: draft.endsAtWallMs);
      outcome = await submitter.submit(draft: draft, journal: journal, durationMs: clock.durationMs);
    } on Object {
      _live(draft.sessionId, false);
      return null;
    }
    if (outcome is SubmitPending) {
      // Still owed: the backup job takes it from here while the window lasts.
      try {
        await scheduler.scheduleSubmit(userId: draft.userId, sessionId: draft.sessionId, draftKey: draft.draftKey, runAt: _now());
        return outcome;
      } on Object {
        // No job queued: no retry is running, so the strip must not say "Sending".
      }
    }
    if (outcome is! SubmitPending) await _settled(draft.sessionId);
    _live(draft.sessionId, false);
    return outcome;
  }

  /// The session is settled: a backup job still queued for it has nothing left to send.
  Future<void> _settled(String sessionId) async {
    try {
      await scheduler.cancelSubmit(sessionId);
    } on Object {
      // The job finds the draft settled and stops by itself.
    }
  }

  void _live(String sessionId, bool live) {
    try {
      onRetryLive?.call(sessionId, live);
    } on Object {
      // Only the strip's bookkeeping.
    }
  }
}
