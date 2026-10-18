// Fakes and helpers shared by the You unit and golden tests.

import 'dart:async';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart' show WalletRead, walletRepositoryProvider;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart' show NetworkStatus, networkStatusProvider;
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier;
import 'package:mockmob/core/models/attempt.dart' show Attempt;
import 'package:mockmob/core/repositories/attempts_repository.dart' show attemptsRepositoryProvider;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/models/notification_prefs.dart' show NotificationPrefs;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/core/sync/pending_work.dart';
import 'package:mockmob/features/account_access/state/password_hints.dart';
import 'package:mockmob/features/credits/data/credits_data.dart';
import 'package:mockmob/features/credits/data/credits_models.dart';
import 'package:mockmob/core/router/external_link_opener.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/you/data/confidence_store.dart';
import 'package:mockmob/features/you/data/student_target.dart';
import 'package:mockmob/features/you/data/subject_catalog.dart';
import 'package:mockmob/features/you/you_providers.dart';
import 'package:mockmob/core/models/lab_loop.dart' show RulesRead;
import 'package:mockmob/features/rules/data/rules_data.dart' show rulesRepositoryProvider;
import 'package:mocktail/mocktail.dart';

import '../../golden/rhythm/rhythm_test_kit.dart' show FakeAttemptsRepo, FakeBestsRepo;
import 'package:mockmob/features/rhythm/data/bests.dart' show PersonalBest, bestsRepositoryProvider;

const youUser = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
);

/// What setup kept for Asha: B.Com (Hons) and three colleges in order.
const ashaTarget = StudentTarget(
  course: 'B.Com (Hons)',
  colleges: ['Shri Ram College of Commerce', 'Hansraj College', 'Kirori Mal College'],
);

/// The registry as `GET /api/subjects` gives it: the 15 practice subjects, plus one retired
/// subject the server says practice cannot open.
final registryCatalog = SubjectCatalog(
  options: [
    for (final e in youSubjectNames.entries) SubjectOption(id: e.key, name: e.value),
    const SubjectOption(
      id: 'entrepreneurship',
      name: 'Entrepreneurship',
      supported: false,
      reason: 'Practice for this paper is not open yet. Your other subjects are ready.',
    ),
  ],
);

/// Two of the three tokens earned.
final earnedMilestones = [
  RhythmMilestone(id: 'first_scored_session', achievedAt: DateTime.utc(2026, 9, 21, 9)),
  RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 9, 27, 12)),
  RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 9, 15)),
  const RhythmMilestone(id: 'first_week_met'),
];

/// A signed-in snapshot with the given plan.
AuthSnapshot userWith({bool pro = false, DateTime? until}) => AuthSnapshot(
      status: AuthStatus.signedIn,
      userId: 'u1',
      email: 'asha.verma@example.com',
      name: 'Asha Verma',
      isPro: pro,
      premiumUntil: until,
    );

class FakeAuth extends AuthController {
  FakeAuth(this.initial, {this.signOutError});

  final AuthSnapshot initial;
  final Object? signOutError;
  int signOutCalls = 0;

  /// What the last sign-out was told to do with queued study writes.
  bool? lastKeepQueuedWork;
  int reloads = 0;

  @override
  AuthSnapshot build() => initial;

  /// The real one reads `/api/auth/me`; here the test sets [state] itself.
  @override
  Future<void> reload() async => reloads++;

  @override
  Future<void> signOut({bool keepQueuedWork = true}) async {
    signOutCalls++;
    lastKeepQueuedWork = keepQueuedWork;
    if (signOutError != null) throw signOutError!;
    state = AuthSnapshot.signedOut;
  }
}

class FakeGoal extends GoalRepository {
  FakeGoal(this.initial, {this.saveError});

  final RemoteState<Goal> initial;
  final Object? saveError;
  final List<(int, String?)> saves = [];
  int refreshes = 0;

  @override
  RemoteState<Goal> build() => initial;

  /// The server's answer changes under the screen (another phone, a refresh).
  void push(RemoteState<Goal> next) => state = next;

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;

  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil, String? expectUserId}) async {
    saves.add((daysPerWeek, pausedUntil));
    if (saveError != null) throw saveError!;
    final goal = Goal(daysPerWeek: daysPerWeek, pausedUntil: pausedUntil);
    state = RemoteState(value: goal, fetchedAt: DateTime.now());
    return goal;
  }
}

RemoteState<Goal> goalState(int days, {String? pausedUntil}) =>
    RemoteState(value: Goal(daysPerWeek: days, pausedUntil: pausedUntil), fetchedAt: DateTime(2026, 10, 12, 21, 15));

class FakeRhythm extends RhythmRepository {
  FakeRhythm(this.initial);

  final RemoteState<Rhythm> initial;

  @override
  RemoteState<Rhythm> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {}
}

RemoteState<Rhythm> rhythmState({
  int streak = 3,
  int best = 6,
  List<String> studyDayDates = const ['2026-10-12'],
  List<RhythmMilestone> milestones = const [],
}) =>
    RemoteState(
      value: Rhythm(
        timeZone: 'Asia/Kolkata',
        weekStart: '2026-10-12',
        studyDays: studyDayDates.length,
        studyDayDates: studyDayDates,
        daysGoal: 4,
        metThisWeek: false,
        paused: false,
        weeksMetStreak: streak,
        bestRun: best,
        // The server always lists the two newer badges (a date once earned), so none of the sixteen is "not read".
        milestones: [
          ...milestones,
          if (!milestones.any((m) => m.id == 'first_hold')) const RhythmMilestone(id: 'first_hold'),
          if (!milestones.any((m) => m.id == 'run_weeks_3')) const RhythmMilestone(id: 'run_weeks_3'),
        ],
      ),
      fetchedAt: DateTime(2026, 10, 12, 21, 15),
    );

/// A consent repository the test drives. [gate] holds the server answer until the test completes it.
class FakeConsent extends ConsentRepository {
  FakeConsent(this.initial);

  final ConsentState initial;
  Completer<Consent>? gate;
  Object? failWith;
  final List<bool> allowedCalls = [];
  final List<AgeBand> ageCalls = [];
  int loads = 0;

  @override
  ConsentState build() => initial;

  @override
  Future<void> load() async => loads++;

  @override
  Future<Consent> setAnalyticsAllowed(bool allowed, {String? expectUserId}) async {
    allowedCalls.add(allowed);
    final band = allowed ? AgeBand.adult : state.consent.ageBand;
    if (!allowed) {
      // Exactly what the real repository does: the gate closes before the network call.
      state = state.copyWith(consent: Consent(ageBand: band), withdrawalPending: true);
    }
    final answer = await (gate?.future ?? Future.value(Consent(ageBand: band, analyticsAllowed: allowed, deletedEvents: allowed ? null : 4)));
    if (failWith != null) throw failWith!;
    state = ConsentState(status: ConsentStatus.loaded, consent: answer);
    return answer;
  }

  @override
  Future<Consent> setAgeBand(AgeBand band, {String? expectUserId}) async {
    ageCalls.add(band);
    if (failWith != null) throw failWith!;
    final next = Consent(ageBand: band, decidedAt: DateTime(2026, 10, 12));
    state = ConsentState(status: ConsentStatus.loaded, consent: next);
    return next;
  }
}

ConsentState consentState(AgeBand band, {bool on = false, ConsentStatus status = ConsentStatus.loaded}) => ConsentState(
      status: status,
      consent: Consent(ageBand: band, analyticsAllowed: on, decidedAt: DateTime(2026, 10, 12)),
    );

class MockApi extends Mock implements ApiClient {}

/// `GET /api/me/credits` as the test sets it: nothing reaches the network or the database.
class FakeMeCredits extends MeCreditsRepository {
  FakeMeCredits(this.initial);

  final RemoteState<CreditsOverview> initial;
  int refreshes = 0;

  @override
  RemoteState<CreditsOverview> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

/// The two pools as Asha has them: 38 Practice credits, 8 AI credits renewing 1 November, Free.
RemoteState<CreditsOverview> creditsState({
  int? practice = 38,
  int? ai = 8,
  bool pro = false,
  String? proUntil,
  List<Map<String, Object?>> history = const [],
  String? nextCursor,
}) =>
    RemoteState(
      value: CreditsOverview.fromJson({
        'practice': {'balance': practice, 'renewsOn': null, 'label': 'Practice credits'},
        'ai': {'balance': ai, 'renewsOn': '2026-11-01', 'label': 'AI credits'},
        'plan': {'name': pro ? 'Pro' : 'Free', 'until': proUntil},
        'history': history,
        'nextCursor': nextCursor,
      }),
      fetchedAt: DateTime(2026, 10, 12, 21, 15),
    );

/// `GET /api/wallet` on a server without the wallet route (release 9 production): a 404.
const walletMissing = RemoteState<WalletRead>(error: ApiError(status: 404, kind: ApiErrorKind.notFound, code: 'not_found'));

/// The credits read of a one-balance server (owner D78): the two stored parts, which add up to the one
/// total, the `total` block, and history lines that state the one balance after them this month. The
/// numbers follow the website's own fixture: 38 free credits left of 50 and 70 held, 108 in all.
RemoteState<CreditsOverview> oneBalanceState({
  int? total = 108,
  int freeLeft = 38,
  int held = 70,
  bool pro = false,
  List<Map<String, Object?>> history = const [],
}) =>
    RemoteState(
      value: CreditsOverview.fromJson({
        'practice': {'balance': total == null ? null : held, 'renewsOn': null, 'label': 'Practice credits'},
        'ai': {'balance': total == null ? null : freeLeft, 'renewsOn': '2026-11-01', 'label': 'AI credits'},
        'plan': {'name': pro ? 'Pro' : 'Free', 'until': pro ? '2027-07-31' : null},
        'history': history,
        'nextCursor': null,
        'total': {
          'balance': total,
          'freeLeft': total == null ? null : freeLeft,
          'freeAllowance': total == null ? null : 50,
          'held': total == null ? null : held,
          'renewsOn': total == null ? null : '2026-11-01',
          'label': 'Credits',
        },
      }),
      fetchedAt: DateTime(2026, 10, 12, 21, 15),
    );

class MockAnalytics extends Mock implements AnalyticsClient {}

MockAnalytics quietAnalytics() {
  final analytics = MockAnalytics();
  when(() => analytics.track(any(), props: any(named: 'props'))).thenAnswer((_) async => true);
  return analytics;
}

class MockDrafts extends Mock implements SessionDraftRepository {}

class MockOutbox extends Mock implements OutboxRepository {}

/// An outbox holding [queued] writes.
MockOutbox outboxWith(int queued) {
  final outbox = MockOutbox();
  when(outbox.pending).thenAnswer(
    (_) async => [
      for (var i = 0; i < queued; i++)
        OutboxItem(
          id: i,
          kind: 'study_event',
          idempotencyKey: 'k$i',
          method: 'POST',
          path: '/api/x',
          createdAt: DateTime(2026, 10, 12),
          attempts: 0,
          nextAttemptAt: DateTime(2026, 10, 12),
        ),
    ],
  );
  return outbox;
}

class RecordingOpener implements ExternalLinkOpener {
  RecordingOpener({this.result = true});

  final bool result;
  final List<Uri> opened = [];

  @override
  Future<bool> open(Uri uri) async {
    opened.add(uri);
    return result;
  }
}

class RecordingMailer implements SupportMailer {
  RecordingMailer({this.composes = true});

  final bool composes;
  int composed = 0;
  int copied = 0;

  @override
  Future<bool> compose() async {
    composed++;
    return composes;
  }

  @override
  Future<void> copyAddress() async => copied++;
}

/// Overrides every You test needs. Pass only what a test cares about.
List<Override> youOverrides({
  AuthSnapshot auth = youUser,
  FakeAuth? fakeAuth,
  FakeGoal? goal,
  FakeConsent? consent,
  FakeRhythm? rhythm,
  MockDrafts? drafts,
  int queued = 0,
  ExpiredWorkNotice? expired,
  MockApi? api,
  MockAnalytics? analytics,
  ExternalLinkOpener? opener,
  SupportMailer? mailer,
  AppPrefs? prefs,
  PrefsStore? rhythmStore,
  StudentTarget? target,
  SubjectCatalog? catalog,
  String? version = '1.0.0 (1)',
  RemoteState<RulesRead>? rules,
  RemoteState<CreditsOverview>? credits,
  RemoteState<WalletRead>? wallet,
  Override? walletOverride,
  DateTime? now,
  NotificationPrefs? notificationPrefs,
  Override? notificationPrefsProvider,
  RemoteState<List<Attempt>>? attempts,
  RemoteState<List<PersonalBest>>? bests,
}) {

  return [
    authSnapshotProvider.overrideWith(() => fakeAuth ?? FakeAuth(auth)),
    // The papers and bests read the local database and the network plugin; settle both.
    attemptsRepositoryProvider.overrideWith(() => FakeAttemptsRepo(attempts ?? const RemoteState<List<Attempt>>(value: <Attempt>[]))),
    bestsRepositoryProvider.overrideWith(() => FakeBestsRepo(bests ?? const RemoteState(value: []))),
    networkStatusProvider.overrideWith(_OnlineNetwork.new),
    goalRepositoryProvider.overrideWith(() => goal ?? FakeGoal(goalState(4))),
    consentRepositoryProvider.overrideWith(() => consent ?? FakeConsent(consentState(AgeBand.adult))),
    rhythmRepositoryProvider.overrideWith(() => rhythm ?? FakeRhythm(rhythmState())),
    if (drafts != null) sessionDraftRepositoryProvider.overrideWithValue(drafts),
    outboxRepositoryProvider.overrideWithValue(outboxWith(queued)),
    expiredWorkNoticeProvider.overrideWithValue(expired ?? ExpiredWorkNotice(MemoryPrefsStore())),
    accessPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    if (api != null) apiClientProvider.overrideWithValue(api),
    if (opener != null) externalLinkOpenerProvider.overrideWithValue(opener),
    analyticsClientProvider.overrideWithValue(analytics ?? quietAnalytics()),
    nowProvider.overrideWithValue(() => now ?? DateTime(2026, 10, 12, 22, 39, 30)),
    supportMailerProvider.overrideWithValue(mailer ?? RecordingMailer()),
    appPrefsProvider.overrideWithValue(prefs ?? AppPrefs(MemoryPrefsStore())),
    rhythmPrefsStoreProvider.overrideWithValue(rhythmStore ?? MemoryPrefsStore()),
    studentTargetProvider.overrideWithValue(target ?? StudentTarget.none),
    answersStoreProvider.overrideWithValue(AnswersStore(MemoryPrefsStore())),
    youPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    youSubjectCatalogProvider.overrideWith((ref) async => catalog ?? registryCatalog),
    userIdProvider.overrideWithValue('u1'),
    studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
    appVersionProvider.overrideWith((ref) async => version),
    notificationPrefsProvider ?? notificationPrefsRepositoryProvider.overrideWithBuild((ref, n) => RemoteState(value: notificationPrefs ?? NotificationPrefs.defaults)),
    meCreditsProvider.overrideWith(() => FakeMeCredits(credits ?? creditsState())),
    // `GET /api/wallet`: by default today's production answer (404, no wallet route), so nothing reaches the
    // network or the database.
    walletOverride ?? walletRepositoryProvider.overrideWithBuild((ref, n) => wallet ?? walletMissing),
    creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
    // Across your mocks on the hub (Mistake Lab v4 slice 3): settled, no network.
    rulesRepositoryProvider.overrideWithBuild((ref, n) => rules ?? const RemoteState()),
  ];
}

MockDrafts draftsWithUnsent(int count) {
  final drafts = MockDrafts();
  when(drafts.unsentAnswerCount).thenAnswer((_) async => count);
  return drafts;
}

ApiError offlineError() => const ApiError(kind: ApiErrorKind.network, code: 'network');
ApiError unavailableError() => const ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'unavailable');
ApiError validationError() => const ApiError(status: 422, kind: ApiErrorKind.validation, code: 'invalid_request');

class _OnlineNetwork extends NetworkStatusNotifier {
  @override
  NetworkStatus build() => NetworkStatus.online;
}
