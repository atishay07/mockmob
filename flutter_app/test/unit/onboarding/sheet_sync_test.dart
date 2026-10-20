import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart' show RequestOptions;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/rhythm.dart' show Goal;
import 'package:mockmob/core/repositories/repositories.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/onboarding/state/student_sheet.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/rhythm/data/study_days.dart' show plannedDaysProvider;
import 'package:mockmob/features/tools/data/tools_store.dart' show toolsPrefsProvider;

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';

/// A goal write that fails with something other than an ApiError (here: signed out part way).
class _SignedOutGoal extends GoalRepository {
  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil, String? expectUserId}) async => throw const SignedOutException();
}

class _FakeAuth extends AuthController {
  _FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;
  int reloads = 0;

  @override
  AuthSnapshot build() => snapshot;

  @override
  Future<void> reload() async => reloads++;

  void become(AuthSnapshot next) => state = next;
}

const _newAccount = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com', profileFresh: true);
const _existing = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com', subjects: ['english'], profileFresh: true);
const _otherWithPlan = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2', email: 'ravi@example.com', subjects: ['english'], profileFresh: true);

final _sealed = OnboardingAnswers(
  stage: Stage.classTwelve,
  courseId: 'b-com-hons',
  subjects: const [SheetSubject.english, SheetSubject.accountancy, SheetSubject.economics, SheetSubject.mathematics],
  days: const {0, 2, 4},
  window: StudyTime.late,
  age: AgeAnswer.minor,
  sealedAt: DateTime(2026, 10, 13, 21, 40),
);

/// The same answers sealed three days before "now": not answers the student just gave.
final _oldSheet = _sealed.copyWith(sealedAt: DateTime(2026, 10, 10, 20, 0));

/// The answers just given name SRCC and LSR for B.Com (Hons).
final _withColleges = _sealed.copyWith(colleges: const ['Shri Ram College of Commerce', 'Lady Shri Ram College for Women (W)']);

const _consent = {'ageBand': 'minor', 'analyticsAllowed': false, 'policyVersion': '2026-10-12', 'decidedAt': null, 'withdrawnAt': null};
const _goal = {'daysPerWeek': 3, 'timezone': 'Asia/Kolkata', 'pausedUntil': null};
const _prefs = {
  'timezone': 'Asia/Kolkata',
  'quietStart': '23:00',
  'quietEnd': '07:00',
  'channels': {'check_due': true, 'weekly_plan': true, 'study_window': false, 'result_ready': true},
  'studyWindow': {'start': '22:00', 'end': '23:00'},
  'weeklyCap': 5,
};

void main() {
  late AppDatabase db;
  late FakeHttpAdapter http;
  late FakeTokens tokens;
  late MemoryPrefsStore sheetPrefs;
  late StreamController<void> wakeups;
  var today = DateTime(2026, 10, 13, 21, 45);

  ProviderContainer start({
    AuthSnapshot auth = _newAccount,
    OnboardingAnswers? answers,
    bool goalThrows = false,
    List<Duration> retryDelays = const [],
    Map<String, List<String>> serverSubjects = const {},
    Map<String, Object?>? serverConsent,
    List<String> serverColleges = const [],
  }) {
    wakeups = StreamController<void>.broadcast();
    today = DateTime(2026, 10, 13, 21, 45);
    db = newTestDb();
    // The server keeps what it was last told, as the real one does.
    var band = (serverConsent?['ageBand'] as String?) ?? 'unknown';
    ProviderContainer? container;
    // The server's own profile: the signed-in account, with the subjects it really has (the
    // snapshot's, unless the test says the server knows more than the phone's cached copy).
    FakeReply me() {
      final now = container?.read(authSnapshotProvider) ?? auth;
      final id = now.userId;
      if (id == null) return const FakeReply(401, {'error': 'unauthorized'});
      return FakeReply(200, {
        'user': {'id': id, 'subjects': serverSubjects[id] ?? now.subjects},
        'needsOnboarding': false,
      });
    }

    // My colleges as the server keeps it: a PUT replaces the list and answers with it.
    var colleges = [
      for (final name in serverColleges) <String, Object?>{'programmeId': 'b-com-hons', 'programme': 'B.Com (Hons)', 'college': name},
    ];
    FakeReply collegesReply(RequestOptions o) {
      if (o.method == 'PUT') {
        colleges = [for (final c in ((o.data as Map)['colleges'] as List)) Map<String, Object?>.from(c as Map)];
      }
      return FakeReply(200, {'colleges': colleges, 'count': colleges.length, 'max': 8});
    }

    http = FakeHttpAdapter()
      ..handler = (o) => switch (o.path) {
            '/api/me/colleges' => collegesReply(o),
            '/api/auth/me' => me(),
            '/api/me/consent' => FakeReply(200, {
                ..._consent,
                ...?serverConsent,
                'ageBand': o.method == 'PUT' ? band = (o.data as Map)['ageBand'] as String : band,
              }),
            '/api/me/goal' => const FakeReply(200, _goal),
            '/api/me/notification-prefs' => const FakeReply(200, _prefs),
            '/api/users/u1' => const FakeReply(200, {'id': 'u1'}),
            '/api/users/u2' => const FakeReply(200, {'id': 'u2'}),
            _ => const FakeReply(200, {}),
          };
    sheetPrefs = MemoryPrefsStore()..values[AnswersStore.key] = jsonEncode((answers ?? _sealed).toJson());
    tokens = FakeTokens();
    final c = ProviderContainer(overrides: [
      rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      // The account's older lists were moved to My colleges on an earlier sign-in.
      toolsPrefsProvider.overrideWithValue(MemoryPrefsStore()..values['mm.mycolleges.moved.v1.u1'] = true),
      authSnapshotProvider.overrideWith(() => _FakeAuth(auth)),
      appDatabaseProvider.overrideWithValue(db),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      apiClientProvider.overrideWithValue(newApiClient(http, tokens: tokens)),
      answersStoreProvider.overrideWithValue(AnswersStore(sheetPrefs)),
      nowProvider.overrideWithValue(() => today),
      sheetSyncWakeupsProvider.overrideWith((ref) => wakeups.stream),
      sheetSyncRetryDelaysProvider.overrideWithValue(retryDelays),
      if (goalThrows) goalRepositoryProvider.overrideWith(_SignedOutGoal.new),
    ]);
    container = c;
    addTearDown(() async {
      c.dispose();
      await wakeups.close();
      await db.close();
    });
    return c;
  }

  // Every request now passes the API origin guard (C1, 20 Oct) first, a few more turns of the event loop each.
  Future<void> settle() async {
    for (var i = 0; i < 200; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  List<RecordedRequest> writes() => http.requests.where((r) => r.method != 'GET').toList();

  test('a new account gets age, subjects, days and time, and only then is it saved', () async {
    final c = start();
    await c.read(onboardingAnswersProvider.future);
    final gate = http.hold = Completer<void>();
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saving);
    expect((await AnswersStore(sheetPrefs).load()).syncedFor, isNull);

    gate.complete();
    http.hold = null;
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);

    final sent = {for (final r in writes()) '${r.method} ${r.path}': r.body};
    expect(jsonDecode(jsonEncode(sent['PUT /api/me/consent'])), {'ageBand': 'minor', 'analyticsAllowed': false});
    // Every chosen subject is a practice subject the profile takes, Maths included.
    expect(jsonDecode(jsonEncode(sent['PATCH /api/users/u1'])), {'subjects': ['english', 'accountancy', 'economics', 'mathematics']});
    expect(jsonDecode(jsonEncode(sent['PUT /api/me/goal'])), {'daysPerWeek': 3, 'pausedUntil': null});
    expect(jsonDecode(jsonEncode(sent['PUT /api/me/notification-prefs'])), {'studyWindow': {'start': '22:00', 'end': '23:00'}});
    await c.read(onboardingAnswersProvider.notifier).flushed();
    expect((await AnswersStore(sheetPrefs).load()).syncedFor, 'u1');
  });

  // D96 fix pass (walk 26-after-code, 31-today, 66-you): the answers just given are the newest
  // truth. The old contract kept everything of an account that had subjects, so Today showed the
  // old 4-day goal and old colleges after an onboarding that picked 6 days, SRCC and LSR.
  test('an account that already has subjects keeps its subjects and consent; the answers just given replace its week', () async {
    final c = start(auth: _existing);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.updated);
    final sent = {for (final r in writes()) '${r.method} ${r.path}': r.body};
    expect(jsonDecode(jsonEncode(sent['PUT /api/me/goal'])), {'daysPerWeek': 3, 'pausedUntil': null});
    expect(jsonDecode(jsonEncode(sent['PUT /api/me/notification-prefs'])), {'studyWindow': {'start': '22:00', 'end': '23:00'}});
    expect(writes().map((r) => r.path), isNot(contains('/api/users/u1')), reason: 'their subjects stay as they are');
    expect(writes().map((r) => r.path), isNot(contains('/api/me/consent')), reason: 'their consent stays as it is');
    expect(c.read(plannedDaysProvider), {0, 2, 4}, reason: 'the days just picked replace days picked on this phone before');
    await c.read(onboardingAnswersProvider.notifier).flushed();
    expect((await AnswersStore(sheetPrefs).load()).syncedFor, 'u1', reason: 'written once; a later launch never writes it again');
  });

  test('a pause the account set stays when the answers just given replace its goal', () async {
    final c = start(auth: _existing);
    final ok = http.handler!;
    http.handler = (o) => o.path == '/api/me/goal' && o.method == 'GET'
        ? const FakeReply(200, {'daysPerWeek': 4, 'timezone': 'Asia/Kolkata', 'pausedUntil': '2026-10-20'})
        : ok(o);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.updated);
    final goal = writes().where((r) => r.path == '/api/me/goal').single;
    expect(jsonDecode(jsonEncode(goal.body)), {'daysPerWeek': 3, 'pausedUntil': '2026-10-20'});
  });

  test('the colleges just picked go to the top of My colleges; nothing on the list is removed', () async {
    final c = start(auth: _existing, answers: _withColleges, serverColleges: const ['Hindu College', 'Lady Shri Ram College for Women (W)']);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.updated);
    final put = writes().where((r) => r.method == 'PUT' && r.path == '/api/me/colleges').single;
    final names = [for (final e in ((put.body as Map)['colleges'] as List)) (e as Map)['college']];
    expect(names, ['Shri Ram College of Commerce', 'Lady Shri Ram College for Women (W)', 'Hindu College']);
  });

  test('a sheet sealed days ago never overwrites an account that already has subjects', () async {
    final c = start(auth: _existing, answers: _oldSheet);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.kept);
    expect(writes(), isEmpty, reason: 'no goal, study time, subjects, colleges or age band from an old sheet');
  });

  test('a profile still cached on the phone waits: nothing is asked or written until the server profile arrives', () async {
    const cached = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com');
    final c = start(auth: cached);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.idle);
    expect(http.requests, isEmpty, reason: 'a cached copy cannot say the account is new');

    (c.read(authSnapshotProvider.notifier) as _FakeAuth).become(_newAccount);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
    expect(writes().map((r) => r.path), contains('/api/users/u1'));
  });

  // ROBUSTNESS onboarding-01: a profile cached on the phone while the account had no subjects
  // must not make an account that has since been set up elsewhere look new.
  test('a cached profile with no subjects never lets the sheet overwrite the subjects on the server', () async {
    final c = start(serverSubjects: const {'u1': ['english', 'accountancy']});
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    // The server, not the cache, says the account has a plan: its subjects and age band stay; only
    // the answers just given (days, time) replace the older ones.
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.updated);
    expect(writes().map((r) => r.path), isNot(contains('/api/users/u1')), reason: 'no subjects written over the plan');
    expect(writes().map((r) => r.path), isNot(contains('/api/me/consent')), reason: 'no age band written over the plan');
    expect(http.requests.map((r) => r.path), contains('/api/auth/me'), reason: 'decided from the server, not the cache');
  });

  test('when the server profile cannot be read, nothing is written and the run fails to retry', () async {
    final c = start();
    final ok = http.handler!;
    http.handler = (o) => o.path == '/api/auth/me' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);
    expect(writes(), isEmpty);
  });

  // ROBUSTNESS onboarding-02: writing the age band before the consent record is read sent
  // analyticsAllowed false and switched the student's usage-data opt-in off.
  test("an age band the account already has is kept, with its usage-data choice", () async {
    final c = start(serverConsent: const {'ageBand': 'adult', 'analyticsAllowed': true});
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
    expect(writes().map((r) => r.path), isNot(contains('/api/me/consent')), reason: 'usage data stays on, the age band stays adult');
    expect(writes().map((r) => r.path), contains('/api/users/u1'));
  });

  test('a consent record that cannot be read stops the age write instead of guessing', () async {
    final c = start();
    final ok = http.handler!;
    http.handler = (o) => o.path == '/api/me/consent' && o.method == 'GET' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);
    expect(writes().map((r) => r.path), isNot(contains('/api/me/consent')));
  });

  test('a failed write keeps the sheet on the phone and Try again finishes it', () async {
    final c = start();
    final ok = http.handler!;
    http.handler = (o) => o.path == '/api/me/goal' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);
    expect((await AnswersStore(sheetPrefs).load()).syncedFor, isNull);

    http.handler = ok;
    await c.read(sheetSyncProvider.notifier).run();
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
  });

  test('nothing is sent before the sheet is sealed', () async {
    final c = start(answers: _sealed.copyWith(sealedAt: null));
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.idle);
    expect(writes(), isEmpty);
  });

  test('any other failure ends in failed with Try again, not stuck on saving', () async {
    final c = start(goalThrows: true);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    final state = c.read(sheetSyncProvider);
    expect(state.phase, SheetSyncPhase.failed);
    expect(state.offline, isFalse, reason: 'only an ApiError can say the connection was lost');
    expect((await AnswersStore(sheetPrefs).load()).syncedFor, isNull);
  });

  test('two overlapping runs send one set of writes', () async {
    final c = start();
    await c.read(onboardingAnswersProvider.future);
    final gate = http.hold = Completer<void>();
    final sync = c.read(sheetSyncProvider.notifier);
    // The listener's microtask, plus two taps on Try again, all before anything is answered.
    final first = sync.run();
    final second = sync.run();
    await settle();
    gate.complete();
    http.hold = null;
    await Future.wait([first, second]);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
    final sent = [for (final r in writes()) '${r.method} ${r.path}'];
    // The consent repository has its own follow-up PUT, so the sheet's own writes are counted.
    for (final w in ['PUT /api/me/goal', 'PUT /api/me/notification-prefs', 'PATCH /api/users/u1']) {
      expect(sent.where((s) => s == w).length, 1, reason: '$w once: $sent');
    }
  });

  group('after a failure', () {
    test('it tries again on its own once the save sheet is closed', () async {
      // The wait is long enough that the first failure is seen before the retry goes out, even
      // on a loaded machine (at 5 ms the retry could fire inside settle() and fail again).
      final c = start(retryDelays: const [Duration(milliseconds: 250)]);
      final ok = http.handler!;
      http.handler = (o) => o.path == '/api/me/goal' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);

      http.handler = ok;
      await Future<void>.delayed(const Duration(milliseconds: 400));
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
      expect(writes().map((r) => r.path), contains('/api/users/u1'));
    });

    test('it tries again when the app comes back or the network returns', () async {
      final c = start();
      final ok = http.handler!;
      http.handler = (o) => o.path == '/api/me/goal' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);

      http.handler = ok;
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed, reason: 'no timed retry in this test');
      wakeups.add(null);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
      await c.read(onboardingAnswersProvider.notifier).flushed();
      expect((await AnswersStore(sheetPrefs).load()).syncedFor, 'u1');
    });

    test('a retry never runs for an account that has signed out', () async {
      // A long timer: the case is the app coming back after the sign-out (the wake-up below), and
      // a short one would fire inside `settle` on a phone-slow or Windows clock, mid-run.
      final c = start(auth: AuthSnapshot.signedOut, retryDelays: const [Duration(seconds: 30)]);
      final ok = http.handler!;
      http.handler = (o) => o.path == '/api/me/goal' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      final auth = c.read(authSnapshotProvider.notifier) as _FakeAuth;
      auth.become(_newAccount);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);
      auth.become(AuthSnapshot.signedOut);
      await settle();
      http.handler = ok;
      http.requests.clear();
      await Future<void>.delayed(const Duration(milliseconds: 30));
      wakeups.add(null);
      await settle();
      expect(writes(), isEmpty);
    });
  });

  // R3 of the 14 Oct audit: deleting the account removes its unsent sheet from the phone. A plain
  // sign-out puts it away for a month; the deletion screen promises unsent answers are removed.
  group('account deletion', () {
    _FakeAuth authOf(ProviderContainer c) => c.read(authSnapshotProvider.notifier) as _FakeAuth;

    test('removes the unsent sheet, and the sign-out after it puts nothing away', () async {
      final c = start(auth: AuthSnapshot.signedOut, answers: _oldSheet);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      // A signs in to an account that already has a plan with an old sheet: it stays on the phone, unsent.
      authOf(c).become(_existing);
      await settle();
      expect(c.read(onboardingAnswersProvider).value!.owner, 'u1');
      expect(c.read(onboardingAnswersProvider).value!.syncedFor, isNull);

      await c.read(onboardingAnswersProvider.notifier).discard('u1');
      authOf(c).become(AuthSnapshot.signedOut);
      await settle();
      await c.read(onboardingAnswersProvider.notifier).flushed();

      final store = AnswersStore(sheetPrefs);
      expect(await store.parked('u1', today), isNull, reason: 'nothing is put away for a deleted account');
      expect((await store.load()).blank, isTrue, reason: 'the sheet left the phone');
      expect(c.read(studentSheetProvider), isNull);
    });

    test("also removes a copy put away earlier, and leaves another account's sheet alone", () async {
      final c = start(auth: _otherWithPlan);
      await c.read(onboardingAnswersProvider.future);
      final store = AnswersStore(sheetPrefs);
      await store.park(_sealed.copyWith(owner: 'u1'), today);
      final before = c.read(onboardingAnswersProvider).value;

      await c.read(onboardingAnswersProvider.notifier).discard('u1');
      expect(await store.parked('u1', today), isNull);
      expect(c.read(onboardingAnswersProvider).value, same(before), reason: "u2's sheet is not u1's to remove");
    });

    test('a plain sign-out still puts the unsent sheet away for its account', () async {
      final c = start(auth: AuthSnapshot.signedOut, answers: _oldSheet);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      authOf(c).become(_existing);
      await settle();
      authOf(c).become(AuthSnapshot.signedOut);
      await settle();
      await c.read(onboardingAnswersProvider.notifier).flushed();
      expect((await AnswersStore(sheetPrefs).parked('u1', today))?.sealed, isTrue);
    });
  });

  group('another account on the same phone', () {
    const other = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2', email: 'ravi@example.com', profileFresh: true);
    _FakeAuth auth(ProviderContainer c) => c.read(authSnapshotProvider.notifier) as _FakeAuth;

    test('signing out on purpose takes the saved sheet off the phone', () async {
      final c = start();
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);

      auth(c).become(AuthSnapshot.signedOut);
      await settle();
      expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse);
      expect(sheetPrefs.values.containsKey(AnswersStore.key), isFalse);
    });

    test('an expired session keeps the sheet on the phone', () async {
      final c = start();
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      await settle();
      auth(c).become(const AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true));
      await settle();
      expect(c.read(onboardingAnswersProvider).value!.syncedFor, 'u1');
    });

    test('a sheet saved to one account is never written to the next', () async {
      // Student A's sheet is still on the phone (for example, signed out before this fix).
      final c = start(auth: other, answers: _sealed.copyWith(syncedFor: 'u1'));
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      await settle();
      expect(writes(), isEmpty, reason: 'nothing of A goes to B, the age band included');
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.idle);
      expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse, reason: 'B starts a sheet of their own');
    });

    test("one account's failure neither shows to the next nor stops its own sync", () async {
      final c = start(auth: AuthSnapshot.signedOut);
      final ok = http.handler!;
      http.handler = (o) => o.path == '/api/me/goal' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      auth(c).become(other.copyWithId('u1'));
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);

      http.handler = ok;
      auth(c).become(AuthSnapshot.signedOut);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.idle);
      http.requests.clear();
      auth(c).become(other);
      await settle();
      expect(writes(), isEmpty, reason: "A's unsent sheet is never written to B");
      expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse, reason: 'B starts a sheet of their own');

      // A comes back: their unsent sheet is there, and is written to A.
      auth(c).become(AuthSnapshot.signedOut);
      await settle();
      auth(c).become(other.copyWithId('u1'));
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saved);
      expect(c.read(onboardingAnswersProvider).value!.syncedFor, 'u1');
      expect(writes().map((r) => r.path), contains('/api/users/u1'));
      expect(writes().map((r) => r.path), isNot(contains('/api/users/u2')));
    });

    test("a kept sheet stays A's: the next new account gets none of it", () async {
      final c = start(auth: AuthSnapshot.signedOut, answers: _oldSheet);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      // A signs in to an account that already has a plan: nothing is written, the sheet stays.
      auth(c).become(_existing);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.kept);
      expect(c.read(onboardingAnswersProvider).value!.owner, 'u1');

      auth(c).become(AuthSnapshot.signedOut);
      await settle();
      expect(c.read(studentSheetProvider), isNull, reason: "nobody signed in sees A's plan");
      auth(c).become(other);
      await settle();
      expect(writes(), isEmpty, reason: 'no age band, days, study time or subjects of A go to B');
      expect(c.read(studentSheetProvider), isNull, reason: "B's Today never shows A's plan");
      expect(c.read(onboardingAnswersProvider).value!.owner, 'u2');

      // A's answers wait for A on this phone.
      auth(c).become(AuthSnapshot.signedOut);
      await settle();
      auth(c).become(_existing);
      await settle();
      final back = c.read(onboardingAnswersProvider).value!;
      expect(back.owner, 'u1');
      expect(back.sealed, isTrue);
      expect(back.subjects, _sealed.subjects);
      expect(c.read(studentSheetProvider), isNotNull);
    });

    test('an expired session keeps the sheet for A, and B signing in next gets none of it', () async {
      final c = start(auth: AuthSnapshot.signedOut, goalThrows: true);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      auth(c).become(_newAccount);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);
      auth(c).become(const AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true));
      await settle();
      expect(c.read(onboardingAnswersProvider).value!.sealed, isTrue, reason: 'still on the phone for A');

      http.requests.clear();
      auth(c).become(other);
      await settle();
      expect(writes(), isEmpty);
      expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse);
      expect((await AnswersStore(sheetPrefs).parked('u1', today))?.sealed, isTrue);
    });

    test('a sheet not swapped out yet is still never shown to another account', () async {
      final c = start(auth: other, answers: _sealed.copyWith(owner: 'u1'));
      await c.read(onboardingAnswersProvider.future);
      // Read before the sync has swapped sheets.
      expect(c.read(studentSheetProvider), isNull);
    });

    test("A's put-away sheet expires after a month", () async {
      final store = AnswersStore(MemoryPrefsStore());
      final now = DateTime(2026, 10, 13, 21, 45);
      await store.park(_sealed.copyWith(owner: 'u1'), now);
      expect(await store.parked('u1', now.add(const Duration(days: 29))), isNotNull);
      expect(await store.parked('u1', now.add(const Duration(days: 31))), isNull);
    });

    // onboarding-sheet-r2-03, the API side: the signed-in state can lag the session. Each write
    // names A to the API client, which refuses to send it with any other account's token.
    test("no write of A's sheet is sent with B's token, even before the signed-in state says B", () async {
      final c = start();
      await c.read(onboardingAnswersProvider.future);
      // A's session was replaced by B's, whose profile has not loaded: the state still says A.
      tokens
        ..token = 'tok-b'
        ..userId = null;
      c.read(sheetSyncProvider);
      await settle();
      expect(writes(), isEmpty, reason: "nothing of A's sheet goes out with B's token");
      await c.read(onboardingAnswersProvider.notifier).flushed();
      expect((await AnswersStore(sheetPrefs).load()).syncedFor, isNull, reason: 'not recorded as saved to A');
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed, reason: 'A is still on screen, so Try again stays');
    });

    test("writes started for A stop at the first one that would go out after B signed in", () async {
      final c = start();
      await c.read(onboardingAnswersProvider.future);
      final gate = http.hold = Completer<void>();
      c.read(sheetSyncProvider);
      await settle();
      // The first request out (the server's own profile, read before anything is written).
      expect(http.requests, isNotEmpty, reason: "the first request is out with A's token");
      expect(http.requests.map((r) => r.headers['Authorization']).toSet(), {'Bearer tok-1'});
      // B signs in while that request is out; the signed-in state has not caught up yet.
      tokens
        ..token = 'tok-b'
        ..userId = 'u2';
      http.hold = null;
      gate.complete();
      await settle();
      final withB = [for (final r in writes()) if (r.headers['Authorization'] == 'Bearer tok-b') '${r.method} ${r.path}'];
      expect(withB, isEmpty, reason: "nothing of A's sheet goes out with B's token: $withB");
      await c.read(onboardingAnswersProvider.notifier).flushed();
      expect((await AnswersStore(sheetPrefs).load()).syncedFor, isNull);
      expect(c.read(sheetSyncProvider).phase, isNot(SheetSyncPhase.saved));
    });

    test('a switch of account while the writes are out stops them, and nothing is marked saved', () async {
      final c = start();
      await c.read(onboardingAnswersProvider.future);
      final gate = http.hold = Completer<void>();
      c.read(sheetSyncProvider);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.saving);
      // A signs out and B signs in while the first request is out.
      auth(c).become(AuthSnapshot.signedOut);
      await settle();
      auth(c).become(other);
      await settle();
      final before = writes().length;
      http.hold = null;
      gate.complete();
      await settle();
      final after = [for (final r in writes().skip(before)) '${r.method} ${r.path}'];
      expect(after.where((w) => w.contains('/api/me/goal') || w.contains('notification-prefs') || w.contains('/api/users/')), isEmpty,
          reason: "nothing of A's sheet goes out once B is signed in: $after");
      final parked = await AnswersStore(sheetPrefs).parked('u1', today);
      expect(parked?.sealed, isTrue, reason: "A's answers wait for A");
      expect(parked?.syncedFor, isNull, reason: 'not recorded as saved to A');
      expect(c.read(onboardingAnswersProvider).value!.sealed, isFalse);
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.idle);
    });
  });
}

extension on AuthSnapshot {
  AuthSnapshot copyWithId(String id) => AuthSnapshot(status: status, userId: id, email: email, profileFresh: true);
}
