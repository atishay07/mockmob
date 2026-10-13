import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/analytics.dart';
import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/local_scope.dart';
import '../../../core/repositories/session_draft_repository.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/sync/sync_providers.dart';
import '../copy.dart';
import '../model/practice_selection.dart';
import 'practice_notes.dart';

/// Why a start did not happen. Each maps to exact copy in `PracticeCopy`.
enum StartFailure { offline, generic, notEnoughQuestions, notEnoughCredits, notIncluded, rateLimited }

sealed class StartOutcome {
  const StartOutcome();
}

/// The session exists and its draft is on this phone: open `/run/<sessionId>`.
class Started extends StartOutcome {
  const Started(this.sessionId);

  final String sessionId;
}

class StartFailed extends StartOutcome {
  const StartFailed(this.failure, {this.message});

  final StartFailure failure;

  /// The server's own words, when it gave a reason (shown in place of the stock copy).
  final String? message;
}

/// The website's rule for an NTA paper (TestPageClient): exactly 50 questions, or no exam. Short
/// papers would make "of 50" and the marks untrue.
String ntaPaperSizeMessage(int n) =>
    'We could put together only $n of the 50 questions an NTA paper needs for this subject. Nothing was charged.';

/// An earlier session for the same selection still has answers the server never received.
///
/// The starter no longer returns this: the engine archives such a session (the backup job still
/// sends it) and starts the new one, so an offline submit never blocks practice. Kept only while
/// the launch flow and its screens still switch on it.
class StartPendingElsewhere extends StartOutcome {
  const StartPendingElsewhere(this.sessionId);

  final String sessionId;
}

StartFailure failureFor(ApiError e) {
  if (e.isOffline) return StartFailure.offline;
  if (e.hasCode(ApiCodes.insufficientPracticeContent) || e.hasCode(ApiCodes.insufficientVerifiedContent)) {
    return StartFailure.notEnoughQuestions;
  }
  if (e.hasCode(ApiCodes.insufficientCredits)) return StartFailure.notEnoughCredits;
  if (e.hasCode(ApiCodes.premiumRequired) || e.hasCode('DIFFICULTY_NOT_ALLOWED')) return StartFailure.notIncluded;
  if (e.isRateLimited) return StartFailure.rateLimited;
  return StartFailure.generic;
}

/// Failures retrying with the same key cannot fix: the stored key is forgotten so the next
/// attempt is a fresh start. Network and server failures keep it, so a retry is the same
/// (idempotent) request and can never create a second session.
bool _definitive(ApiError e) =>
    e.kind == ApiErrorKind.paymentRequired ||
    e.hasCode(ApiCodes.insufficientPracticeContent) ||
    e.hasCode(ApiCodes.insufficientVerifiedContent) ||
    e.hasCode(ApiCodes.sessionAlreadySubmitted) ||
    e.hasCode(ApiCodes.sessionExpired) ||
    e.hasCode('INVALID_CHAPTER') ||
    e.hasCode('SUBJECT_NOT_SUPPORTED');

/// What the screens need from a starter, so widget tests replace it without a database.
abstract interface class PracticeStarting {
  /// [quote] is the fresh quote the caller just checked; its allowance decides the `purpose`.
  /// A fresh-questions check has no quote: the server starts it free.
  Future<StartOutcome> start(PracticeSelection selection, {PracticeQuote? quote, int? mockNumber});
}

/// Starts practice and mocks (spec 5.4): the `generationKey` is stored before the request goes
/// out, a second tap while a start is running joins the first, and the session engine writes the
/// draft and journal before the runner opens.
class PracticeStarter implements PracticeStarting {
  PracticeStarter({
    required this.api,
    required this.drafts,
    required this.userId,
    required this.startEngine,
    required this.rememberSession,
    this.afterStarted,
  });

  final ApiClient api;
  final SessionDraftRepository drafts;
  final String Function() userId;
  final Future<SessionEngine> Function(StartSessionArgs) startEngine;
  final Future<void> Function(String sessionId, PracticeSelection selection) rememberSession;

  /// Analytics and the credit balance refresh. Failures here never fail the start.
  final void Function(PracticeSelection selection)? afterStarted;

  final Map<String, Future<StartOutcome>> _inFlight = {};

  @override
  Future<StartOutcome> start(PracticeSelection selection, {PracticeQuote? quote, int? mockNumber}) {
    // A fresh check keeps its own generation key, apart from an ordinary set of the same shape.
    final draftKey = selection.draftKey(userId()) + (selection.isFreshCheck ? ':fresh:${selection.recoveryFrom}' : '');
    // A block body on purpose: `remove` returns the very future being completed, and whenComplete
    // waits for a returned future, so an arrow here would wait on itself forever.
    return _inFlight[draftKey] ??= _start(selection, draftKey, quote, mockNumber).whenComplete(() {
      _inFlight.remove(draftKey);
    });
  }

  Future<StartOutcome> _start(PracticeSelection s, String draftKey, PracticeQuote? quote, int? mockNumber) async {
    final generationKey = await drafts.generationKeyFor(draftKey);
    final purpose = quote == null || s.isFreshCheck ? null : launchPurposeFor(quote);
    final SessionView view;
    try {
      final response = await api.post(
        '/api/sessions',
        // Subject, mode, length, chapters and difficulty exactly as chosen; the web sends every
        // value as a string and the server accepts both.
        body: {'generationKey': generationKey, ...s.sessionFields, 'experience': s.isFreshCheck ? 'recovery' : 'practice', 'purpose': ?purpose},
        options: const ApiOptions(retries: 0, receiveTimeout: Duration(seconds: 60)),
      );
      view = SessionView.fromJson(response.map);
    } on ApiError catch (e) {
      if (_definitive(e)) await drafts.clearGenerationKey(draftKey);
      return StartFailed(failureFor(e));
    }
    if (view.questions.isEmpty || (view.meta.sessionId.isEmpty && view.id.isEmpty)) {
      return const StartFailed(StartFailure.generic);
    }
    if (s.mode.isMock && view.questions.length != mockQuestionCount) {
      // Retrying the same key returns the same short paper: forget it.
      await drafts.clearGenerationKey(draftKey);
      return StartFailed(StartFailure.notEnoughQuestions, message: view.meta.message ?? ntaPaperSizeMessage(view.questions.length));
    }

    try {
      final engine = await startEngine(
        StartSessionArgs(
          view: view,
          subject: s.subjectId,
          mode: s.mode.apiMode,
          count: s.effectiveCount,
          generationKey: generationKey,
          chapter: s.chapterLabel,
          difficulty: s.effectiveDifficulty,
          mockNumber: s.mode.isMock ? mockNumber : null,
        ),
      );
      // The draft and journal are on the phone now. The runner restores its own engine from
      // them, so this one only existed to write them.
      engine.dispose();
    } on Object {
      // The session exists on the server; the same key returns it on the next try.
      return const StartFailed(StartFailure.generic);
    }

    await drafts.clearGenerationKey(draftKey);
    final sessionId = view.meta.sessionId.isNotEmpty ? view.meta.sessionId : view.id;
    try {
      await rememberSession(sessionId, s);
      afterStarted?.call(s);
    } on Object {
      // Bookkeeping only: the session is already running.
    }
    return Started(sessionId);
  }
}

final practiceStarterProvider = Provider<PracticeStarting>((ref) {
  return PracticeStarter(
    api: ref.watch(apiClientProvider),
    drafts: ref.watch(sessionDraftRepositoryProvider),
    userId: () => ref.read(userIdProvider) ?? (throw const SignedOutException()),
    startEngine: ref.watch(sessionEngineStarterProvider),
    rememberSession: (id, s) => ref
        .read(practiceNotesProvider)
        .write(id, chapter: s.effectiveChapters.isEmpty ? null : PracticeCopy.chaptersSummary(s.effectiveChapters), mode: s.mode.apiMode),
    afterStarted: (s) {
      unawaited(
        ref
            .read(analyticsClientProvider)
            .track(AnalyticsEvents.sessionStarted, props: {'mode': s.mode.apiMode, 'subject': s.subjectId, 'count': s.effectiveCount}),
      );
      // Credits were spent (or an allowance used): read the balance again.
      unawaited(ref.read(authSnapshotProvider.notifier).reload());
    },
  );
});
