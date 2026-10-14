import 'dart:async';
import 'dart:convert';

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

const _newAccount = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com');
const _existing = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com', subjects: ['english']);

final _sealed = OnboardingAnswers(
  stage: Stage.classTwelve,
  courseId: 'b-com-hons',
  subjects: const [SheetSubject.english, SheetSubject.accountancy, SheetSubject.economics, SheetSubject.mathematics],
  days: const {0, 2, 4},
  window: StudyTime.late,
  age: AgeAnswer.minor,
  sealedAt: DateTime(2026, 10, 13, 21, 40),
);

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
  }) {
    wakeups = StreamController<void>.broadcast();
    today = DateTime(2026, 10, 13, 21, 45);
    db = newTestDb();
    // The server keeps what it was last told, as the real one does.
    var band = 'unknown';
    http = FakeHttpAdapter()
      ..handler = (o) => switch (o.path) {
            '/api/me/consent' => FakeReply(200, {
                ..._consent,
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
    addTearDown(() async {
      c.dispose();
      await wakeups.close();
      await db.close();
    });
    return c;
  }

  Future<void> settle() async {
    for (var i = 0; i < 40; i++) {
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

  test('an account that already has subjects is never overwritten', () async {
    final c = start(auth: _existing);
    await c.read(onboardingAnswersProvider.future);
    c.read(sheetSyncProvider);
    await settle();
    expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.kept);
    expect(writes().map((r) => r.path), isNot(contains('/api/users/u1')));
    expect(writes().map((r) => r.path), isNot(contains('/api/me/goal')));
    expect(writes().map((r) => r.path), isNot(contains('/api/me/consent')), reason: 'their consent stays as it is');
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
      final c = start(retryDelays: const [Duration(milliseconds: 5)]);
      final ok = http.handler!;
      http.handler = (o) => o.path == '/api/me/goal' ? const FakeReply(503, {'error': 'unavailable'}) : ok(o);
      await c.read(onboardingAnswersProvider.future);
      c.read(sheetSyncProvider);
      await settle();
      expect(c.read(sheetSyncProvider).phase, SheetSyncPhase.failed);

      http.handler = ok;
      await Future<void>.delayed(const Duration(milliseconds: 30));
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
      final c = start(auth: AuthSnapshot.signedOut, retryDelays: const [Duration(milliseconds: 5)]);
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

  group('another account on the same phone', () {
    const other = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2', email: 'ravi@example.com');
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
      final c = start(auth: AuthSnapshot.signedOut);
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
      expect(writes(), isNotEmpty, reason: "the first write is out with A's token");
      expect(writes().map((r) => r.headers['Authorization']).toSet(), {'Bearer tok-1'});
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
  AuthSnapshot copyWithId(String id) => AuthSnapshot(status: status, userId: id, email: email);
}
