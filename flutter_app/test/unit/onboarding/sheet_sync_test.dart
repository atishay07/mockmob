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

import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';

/// A goal write that fails with something other than an ApiError (here: signed out part way).
class _SignedOutGoal extends GoalRepository {
  @override
  Future<Goal> save({required int daysPerWeek, String? pausedUntil}) async => throw const SignedOutException();
}

class _FakeAuth extends AuthController {
  _FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;
  int reloads = 0;

  @override
  AuthSnapshot build() => snapshot;

  @override
  Future<void> reload() async => reloads++;
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
  late MemoryPrefsStore sheetPrefs;

  ProviderContainer start({AuthSnapshot auth = _newAccount, OnboardingAnswers? answers, bool goalThrows = false}) {
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
            _ => const FakeReply(200, {}),
          };
    sheetPrefs = MemoryPrefsStore()..values[AnswersStore.key] = jsonEncode((answers ?? _sealed).toJson());
    final c = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(() => _FakeAuth(auth)),
      appDatabaseProvider.overrideWithValue(db),
      appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      apiClientProvider.overrideWithValue(newApiClient(http)),
      answersStoreProvider.overrideWithValue(AnswersStore(sheetPrefs)),
      nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 45)),
      if (goalThrows) goalRepositoryProvider.overrideWith(_SignedOutGoal.new),
    ]);
    addTearDown(() async {
      c.dispose();
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
}
