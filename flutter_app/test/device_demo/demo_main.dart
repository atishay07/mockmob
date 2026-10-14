// A device-only demo build: the real app (router, shell, dock, every screen and every derived
// provider) signed in as a fixture student, with only the data sources replaced. It exists so the
// signed-in screens can be driven on an emulator without a real sign-in. Nothing here talks to
// an account. Not shipped: build it with
//   bash tool/flutter_locked.sh build apk --debug -t test/device_demo/demo_main.dart
// It installs as a separate app, "MockMob demo" (in.mockmob.app.demo.debug): see docs/DEMO-BUILD.md.
//
// One record (demo_book.dart) feeds every screen; Today, Review, the record, the rhythm and the
// milestones are the app's own providers computed from it. A submit is marked from the answers
// given and added to the record at the moment it is made; a repair is kept on the phone as the
// real flow keeps it.
// ignore_for_file: depend_on_referenced_packages
import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/app.dart';
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api.dart';
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
import 'package:mockmob/core/repositories/plan_repository.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/router/app_shell.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/widgets/skeleton.dart' show SkeletonGroup;
import 'package:mockmob/core/widgets/status_tint.dart' show SecureWindow, secureWindowProvider;
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/learn/data/catalog_repository.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/data/practice_notes.dart';
import 'package:mockmob/features/practice/data/practice_starter.dart';
import 'package:mockmob/features/practice/data/result_actions.dart';
import 'package:mockmob/features/practice/data/start_entries.dart';
import 'package:mockmob/features/practice/practice_result_screen.dart' show finishFreshProvider, resultReceivedAtProvider;
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/review/data/repair_api.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show studyDayPlanProvider;
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/today/data/today_profile.dart';
import 'package:mockmob/features/you/data/student_target.dart';

import '../unit/insights/support/insights_fixtures.dart' as insights;
import '../unit/notifications/support.dart' as notif;
import '../unit/notifications/widget_support.dart' as notif_ui;
import '../unit/practice/support/harness.dart' as practice;
import '../unit/today/support/today_fixtures.dart' as today;
import '../unit/you/you_test_support.dart' as you;
import 'demo_book.dart';
import 'demo_insights.dart';
import 'demo_questions.dart';
import 'demo_repair.dart';
import 'demo_session.dart';

const _asha = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
);

/// Starts exactly what was chosen, as a new session every time: the chosen subject, the chosen
/// length, a 60-minute 50-question paper for a full mock or NTA mode.
class _Starter implements PracticeStarting {
  int _n = 0;

  @override
  Future<StartOutcome> start(PracticeSelection selection, {PracticeQuote? quote, int? mockNumber}) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final mock = selection.mode.isMock;
    final id = '${mock ? 'demo-${selection.mode.apiMode}' : 'demo-p'}${++_n}';
    final count = selection.effectiveCount;
    final minutes = mock ? 60 : count;
    demoSessions[id] = DemoSession(
      id,
      questions: demoQuestions(selection.subjectId, count, id),
      mode: selection.mode.apiMode,
      subject: selection.subjectId,
      chapter: selection.chapterLabel,
      remaining: Duration(minutes: minutes),
      endsAt: clock.now().add(Duration(minutes: minutes)),
    );
    return Started(id);
  }
}

Future<RunnerLoad> _open(String sessionId) async {
  final session = demoSessions[sessionId];
  return session == null ? const RunnerMissing() : RunnerReady(session);
}

/// Explains the mistake that was asked about, from that question's own key and explanation.
class _RepairApi implements RepairApi {
  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId}) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    final response = demoRepairResponse(demoBook.detail(attemptId), questionId);
    if (response == null) throw const ApiError(status: 404, kind: ApiErrorKind.notFound, code: 'not_found');
    return response;
  }
}

class _BookAttempts extends AttemptsRepository {
  @override
  RemoteState<List<Attempt>> build() {
    ref.watch(demoBookProvider);
    return RemoteState(value: demoBook.attempts, fetchedAt: DateTime.now());
  }

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _BookDetail extends AttemptDetailRepository {
  _BookDetail(super.attemptId);

  @override
  RemoteState<AttemptDetail> build() {
    ref.watch(demoBookProvider);
    final d = demoBook.detail(attemptId);
    return RemoteState(value: d, error: d == null ? const ApiError(kind: ApiErrorKind.notFound, code: 'not_found') : null, fetchedAt: DateTime.now());
  }

  @override
  Future<void> refresh({bool force = false}) async {}
}

class _Plan extends PlanRepository {
  _Plan(super.minutes);

  @override
  RemoteState<LearningPlan> build() => RemoteState(value: today.readyPlan(minutes: minutes), fetchedAt: DateTime.now());

  @override
  Future<void> refresh({bool force = false}) async {}
}

/// The rhythm the server would report: study days from the papers and acknowledged repairs,
/// the goal of four, the milestones as they are earned.
class _Rhythm extends RhythmRepository {
  @override
  RemoteState<Rhythm> build() {
    ref.watch(demoBookProvider);
    final repairs = ref.watch(repairLocalRecordsProvider).value ?? const <RepairLocalRecord>[];
    final now = DateTime.now().toUtc();
    final week = demoBook.week(now);
    final days = demoBook.studyDays(repairs);
    final thisWeek = [for (final d in week.dates) if (days.contains(d)) d];
    return RemoteState(
      value: Rhythm(
        timeZone: 'Asia/Kolkata',
        weekStart: week.weekStart,
        studyDays: thisWeek.length,
        studyDayDates: thisWeek,
        daysGoal: 4,
        metThisWeek: thisWeek.length >= 4,
        paused: false,
        weeksMetStreak: 3,
        bestRun: 6,
        milestones: demoBook.milestones(repairs),
        repairsThisWeek: [for (final r in repairs) if (r.isRepaired && r.ackedAt != null && thisWeek.contains(dayKey(r.ackedAt!))) r].length,
        mocksThisWeek: [for (final a in demoBook.attempts) if (a.isMock && thisWeek.contains(dayKey(a.completedAt))) a].length,
      ),
      fetchedAt: DateTime.now(),
    );
  }

  @override
  Future<void> refresh({bool force = false}) async {}
}

/// Screenshots of the demo's exam stay possible; the real app keeps FLAG_SECURE.
class _OpenWindow implements SecureWindow {
  @override
  Future<void> set({required bool on}) async {}
}

/// Asha's colleges, the same three on Today's ladder and on You.
const _ashaTarget = StudentTarget(course: 'B.Com (Hons)', colleges: ['Shri Ram College of Commerce', 'Hindu College', 'Deshbandhu College']);

List<Override> _overrides() {
  final now = DateTime.now();
  return [
    reviewDotProvider.overrideWith((ref) => false),
    // Start: the same rows as the real app.
    quickStartRepairProvider.overrideWith((ref) => ref.watch(quickRepairFromReviewProvider)),
    quickStartNtaProvider.overrideWith((ref) => ref.watch(practiceQuickNtaProvider)),
    authSnapshotProvider.overrideWith(() => practice.FakeAuth(_asha)),
    networkStatusProvider.overrideWith(() => practice.FakeNetwork(NetworkStatus.online)),
    studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
    analyticsClientProvider.overrideWithValue(practice.FakeAnalytics()),
    userIdProvider.overrideWithValue('u1'),
    secureWindowProvider.overrideWithValue(_OpenWindow()),

    // The record.
    attemptsRepositoryProvider.overrideWith(_BookAttempts.new),
    attemptDetailProvider.overrideWith2(_BookDetail.new),
    planRepositoryProvider.overrideWith2(_Plan.new),
    rhythmRepositoryProvider.overrideWith(_Rhythm.new),
    todayProfileProvider.overrideWithValue(today.ashaProfile),
    studentTargetProvider.overrideWithValue(_ashaTarget),
    // Asha's study days: Monday, Tuesday, Thursday, Saturday.
    studyDayPlanProvider.overrideWithValue(const {0, 1, 3, 5}),
    insightsRepositoryProvider.overrideWithBuild((ref, n) {
      ref.watch(demoBookProvider);
      return RemoteState(value: demoInsights(demoBook.attempts, DateTime.now().toUtc()), fetchedAt: DateTime.now());
    }),

    // Practice.
    learnCatalogProvider.overrideWithBuild((ref, notifier) => const RemoteState.idle()),
    quoteRepositoryProvider.overrideWithValue(
      practice.FakeQuoteRepository((s, m, c, p) {
        if (m == 'full') return practice.creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
        if (m == 'nta') return practice.quoteOf(cost: 50, balance: 120, durationSec: 3600, count: 50, mode: 'nta');
        return practice.dailyFree(count: c ?? 10);
      }),
    ),
    practiceCatalogApiProvider.overrideWithValue(practice.FakeCatalog()),
    practiceStarterProvider.overrideWithValue(_Starter()),
    latestSessionDraftProvider.overrideWith((ref) => Stream.value(null)),
    pendingResultRepositoryProvider.overrideWithValue(practice.FakePendingResults()),
    unopenedResultsProvider.overrideWith((ref) => Stream.value(const <PendingResult>[])),
    // The receipt says when this run's submit was acknowledged.
    resultReceivedAtProvider.overrideWith((ref, id) async => demoBook.receivedAt[id]),
    finishFreshProvider.overrideWith((ref, id) async => demoBook.fresh.remove(id)),
    practiceNoteProvider.overrideWith((ref, id) async {
      final session = demoSessions[id.replaceFirst(RegExp(r'-result$'), '')];
      return PracticeNote(chapter: session?.chapter, mode: session?.mode ?? 'quick');
    }),

    // Five fresh questions: offered for a demo practice in a launch subject, from the chapter of
    // its first wrong answer, as the server's inventory would.
    replayInventoryProvider.overrideWith((ref, id) async {
      final paper = demoBook.detail(id)?.attempt;
      if (paper == null || !const {'english', 'accountancy', 'business_studies', 'economics'}.contains(paper.subject)) {
        return const ReplayInventory(supported: false);
      }
      final wrong = paper.details.where((d) => d.isCorrect == false).firstOrNull;
      final chapter = wrong == null ? null : paper.questions.where((q) => q.id == wrong.qid).firstOrNull?.chapter;
      return ReplayInventory(supported: true, chapters: [if (chapter != null) ReplayChapter(chapter: chapter, available: true)]);
    }),

    // Saved questions: three questions from the papers above.
    savedRepositoryProvider.overrideWithBuild(
      (ref, n) => RemoteState(
        value: SavedList(
          ids: const ['q1', 'q2', 'q3'],
          questions: [
            insights.question('q1', saved: true),
            insights.question(
              'q2',
              saved: true,
              subject: 'economics',
              chapter: 'Money and banking',
              body: 'If the legal reserve ratio is 20%, the money multiplier is',
            ),
            insights.question(
              'q3',
              saved: true,
              subject: 'business_studies',
              chapter: 'Principles of management',
              body: 'Which principle of Fayol says each employee should receive orders from one superior only?',
            ),
          ],
          count: 3,
        ),
        fetchedAt: now,
      ),
    ),

    // Runner.
    runnerOpenerProvider.overrideWithValue(_open),

    // Result and Review.
    recapProgressProvider.overrideWith((ref, id) async => null),
    creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
    repairApiProvider.overrideWithValue(_RepairApi()),

    // You.
    goalRepositoryProvider.overrideWith(() => you.FakeGoal(you.goalState(4))),
    consentRepositoryProvider.overrideWith(() => you.FakeConsent(you.consentState(AgeBand.adult))),
    notificationPrefsRepositoryProvider.overrideWith(() => notif_ui.FakePrefsRepo(notif.prefsWith(), cachedAt: now)),
  ];
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Every loading skeleton carries the soft sweep in the app; tests keep the static default.
  SkeletonGroup.shimmerByDefault = true;
  unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
  runApp(ProviderScope(overrides: _overrides(), child: const MockMobApp()));
}
