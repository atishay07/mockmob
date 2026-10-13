// Fakes and helpers shared by the You unit and golden tests.

import 'dart:async';

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/analytics/analytics.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/consent.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/consent_repository.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/router/external_link_opener.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';
import 'package:mockmob/features/you/data/student_target.dart';
import 'package:mockmob/features/you/you_providers.dart';
import 'package:mocktail/mocktail.dart';

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

  @override
  AuthSnapshot build() => initial;

  @override
  Future<void> signOut() async {
    signOutCalls++;
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

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;

  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil}) async {
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
        milestones: milestones,
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
  Future<Consent> setAnalyticsAllowed(bool allowed) async {
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
  Future<Consent> setAgeBand(AgeBand band) async {
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

class MockAnalytics extends Mock implements AnalyticsClient {}

MockAnalytics quietAnalytics() {
  final analytics = MockAnalytics();
  when(() => analytics.track(any(), props: any(named: 'props'))).thenAnswer((_) async => true);
  return analytics;
}

class MockDrafts extends Mock implements SessionDraftRepository {}

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
  MockApi? api,
  MockAnalytics? analytics,
  ExternalLinkOpener? opener,
  SupportMailer? mailer,
  AppPrefs? prefs,
  PrefsStore? rhythmStore,
  StudentTarget? target,
  String? version = '1.0.0 (1)',
}) {

  return [
    authSnapshotProvider.overrideWith(() => fakeAuth ?? FakeAuth(auth)),
    goalRepositoryProvider.overrideWith(() => goal ?? FakeGoal(goalState(4))),
    consentRepositoryProvider.overrideWith(() => consent ?? FakeConsent(consentState(AgeBand.adult))),
    rhythmRepositoryProvider.overrideWith(() => rhythm ?? FakeRhythm(rhythmState())),
    if (drafts != null) sessionDraftRepositoryProvider.overrideWithValue(drafts),
    if (api != null) apiClientProvider.overrideWithValue(api),
    if (opener != null) externalLinkOpenerProvider.overrideWithValue(opener),
    analyticsClientProvider.overrideWithValue(analytics ?? quietAnalytics()),
    nowProvider.overrideWithValue(() => DateTime(2026, 10, 12, 22, 39, 30)),
    supportMailerProvider.overrideWithValue(mailer ?? RecordingMailer()),
    appPrefsProvider.overrideWithValue(prefs ?? AppPrefs(MemoryPrefsStore())),
    rhythmPrefsStoreProvider.overrideWithValue(rhythmStore ?? MemoryPrefsStore()),
    studentTargetProvider.overrideWithValue(target ?? StudentTarget.none),
    userIdProvider.overrideWithValue('u1'),
    studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
    appVersionProvider.overrideWith((ref) async => version),
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
