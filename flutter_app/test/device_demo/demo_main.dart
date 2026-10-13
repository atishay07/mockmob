// A device-only demo build: the real app (router, shell, dock, every screen) signed in as a
// fixture student, with the repositories replaced by the in-memory fixtures the tests use. It
// exists so the signed-in screens can be driven on an emulator without a real sign-in.
// Nothing here talks to an account. Not shipped: build it with
//   bash tool/flutter_locked.sh build apk --debug -t test/device_demo/demo_main.dart
// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/app.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart' show userIdProvider;
import 'package:mockmob/core/repositories/notification_prefs_repository.dart'
    show notificationPrefsRepositoryProvider, studentTimezoneProvider;
import 'package:mockmob/core/repositories/pending_result_repository.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/router/app_shell.dart';
import 'package:mockmob/core/sync/session/session_submitter.dart';
import 'package:mockmob/features/learn/data/catalog_repository.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/data/practice_notes.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/practice_result_screen.dart' show resultReceivedAtProvider;
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart' show buildToday;
import 'package:mockmob/features/you/data/student_target.dart';

import '../unit/core_data/support/fixtures.dart' as core;
import '../unit/notifications/support.dart' as notif;
import '../unit/notifications/widget_support.dart' as notif_ui;
import '../unit/practice/support/harness.dart' as practice;
import '../unit/result/support/fixtures.dart' as result;
import '../unit/review/support/review_fixtures.dart' as review;
import '../unit/runner/support/fake_session.dart' as runner;
import '../unit/today/support/today_fixtures.dart' as today;
import '../unit/you/you_test_support.dart' as you;

const _asha = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
);

/// Starts a quick practice as `demo-quick` and anything else as `demo-mock`.
class _Starter implements PracticeStarting {
  @override
  Future<StartOutcome> start(PracticeSelection selection, {required PracticeQuote quote, int? mockNumber}) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return Started(selection.mode == PracticeMode.full || selection.mode == PracticeMode.nta ? 'demo-mock' : 'demo-quick');
  }
}

/// The fixture session under the id the demo started, so the runner's own links (submit) find it.
class _DemoSession extends runner.FakeRunnerSession {
  _DemoSession(this._id, {super.questions, super.mode, super.remaining, super.endsAt});

  final String _id;

  @override
  String get sessionId => _id;
}

final Map<String, runner.FakeRunnerSession> _sessions = {};

Future<RunnerLoad> _open(String sessionId) async {
  final session = _sessions.putIfAbsent(sessionId, () {
    final quick = sessionId == 'demo-quick';
    final s = _DemoSession(
      sessionId,
      questions: runner.accountancyQuestions(quick ? 10 : 50),
      mode: quick ? 'quick' : 'full',
      remaining: quick ? const Duration(minutes: 10) : const Duration(minutes: 58, seconds: 40),
      endsAt: DateTime.now().add(quick ? const Duration(minutes: 10) : const Duration(minutes: 58)),
    );
    s.nextOutcome = SubmitReceived(attempt: {'id': quick ? 'demo-practice' : 'a7'}, receivedAt: DateTime.now());
    return s;
  });
  return RunnerReady(session);
}

/// Every repair is explained after a short wait, as the server would.
class _RepairApi implements RepairApi {
  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId}) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    return RepairResponse.fromJson(review.explainedJson());
  }
}

AttemptDetail _practiceDetail() => AttemptDetail.fromJson({
  ...core.attemptJson(
    id: 'demo-practice',
    mode: 'quick',
    subject: 'accountancy',
    questions: [
      for (var i = 0; i < 7; i++) ('Admission of a partner', core.V.right),
      ('Admission of a partner', core.V.wrong),
      ('Goodwill', core.V.wrong),
      ('Admission of a partner', core.V.blank),
    ],
  ),
  'answerReviews': <String, dynamic>{},
  'answerReviewState': 'ready',
});

List<Override> _overrides() {
  final now = DateTime.now();
  final mockDetail = result.detail();
  final todayAttempts = today.ashaRecord(now.toUtc());
  return [
    reviewDotProvider.overrideWith((ref) => false),
    authSnapshotProvider.overrideWith(() => practice.FakeAuth(_asha)),
    networkStatusProvider.overrideWith(() => practice.FakeNetwork(NetworkStatus.online)),
    studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
    analyticsClientProvider.overrideWithValue(practice.FakeAnalytics()),
    userIdProvider.overrideWithValue('u1'),

    // Today.
    todayViewProvider.overrideWith((ref) => buildToday(today.ashaInputs(now: now.toUtc(), attempts: todayAttempts))),

    // Practice.
    attemptsRepositoryProvider.overrideWith(() => practice.FakeAttempts(todayAttempts)),
    learnCatalogProvider.overrideWithBuild((ref, notifier) => const RemoteState.idle()),
    quoteRepositoryProvider.overrideWithValue(
      practice.FakeQuoteRepository((s, m, c, p) {
        if (m == 'full') return practice.creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
        if (m == 'nta') return practice.proGate();
        return practice.dailyFree(count: c ?? 10);
      }),
    ),
    practiceCatalogApiProvider.overrideWithValue(practice.FakeCatalog()),
    practiceStarterProvider.overrideWithValue(_Starter()),
    latestSessionDraftProvider.overrideWith((ref) => Stream.value(null)),
    pendingResultRepositoryProvider.overrideWithValue(practice.FakePendingResults()),
    attemptDetailProvider(
      'demo-practice',
    ).overrideWith(() => practice.FakeDetail('demo-practice', detail: _practiceDetail(), fetchedAt: now)),
    resultReceivedAtProvider.overrideWith((ref, id) async => now),
    practiceNoteProvider.overrideWith((ref, id) async => const PracticeNote(chapter: 'Admission of a partner', mode: 'quick')),

    // Runner.
    runnerOpenerProvider.overrideWithValue(_open),

    // Result: Mock 7.
    recapDataProvider('a7').overrideWithValue(
      RecapData(
        model: result.mock7(withDetail: mockDetail),
        attempt: mockDetail.attempt,
        detail: mockDetail,
        fetchedAt: now,
      ),
    ),
    recapProgressProvider('a7').overrideWith((ref) async => null),
    repairLocalRecordsProvider.overrideWith((ref) => Stream.value(const [])),

    // Review.
    reviewInputsProvider.overrideWithValue(
      ReviewInputs(
        attempts: RemoteState(value: review.allAttempts, fetchedAt: now),
        records: const [],
      ),
    ),
    creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
    repairApiProvider.overrideWithValue(_RepairApi()),
    for (final a in review.allAttempts)
      attemptDetailProvider(a.id).overrideWithBuild(
        (ref, n) => RemoteState(
          value: AttemptDetail(attempt: a),
          fetchedAt: now,
        ),
      ),

    // You.
    goalRepositoryProvider.overrideWith(() => you.FakeGoal(you.goalState(4))),
    consentRepositoryProvider.overrideWith(() => you.FakeConsent(you.consentState(AgeBand.adult))),
    rhythmRepositoryProvider.overrideWith(() => you.FakeRhythm(you.rhythmState())),
    studentTargetProvider.overrideWithValue(you.ashaTarget),
    notificationPrefsRepositoryProvider.overrideWith(() => notif_ui.FakePrefsRepo(notif.prefsWith(), cachedAt: now)),
  ];
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
  runApp(ProviderScope(overrides: _overrides(), child: const MockMobApp()));
}
