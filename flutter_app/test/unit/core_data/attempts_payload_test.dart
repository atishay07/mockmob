// The student's attempts list on a phone that was upgraded over an older build (APK v10 over v9,
// 16 Oct 2026): the first Today after the upgrade said "Could not reach MockMob just now" while the
// record card loaded. These tests hold three things: a real, heavy `GET /api/attempts` body (the
// shape the live route and finaliser send, newest fields included) reads through the same path the
// app uses; an upgrade keeps the cache it finds; and when the list cannot be read, what the student
// is told is what happened and the rows already on the phone stay visible.
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/fakes.dart';
import 'support/test_db.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co');
}

const _qTypes = ['concept', 'calc', 'passage'];

/// One question as `questions_snapshot` holds it: the whole `questionOut` row the paper was built
/// from (`data/db.js`), with the evidence record, not the slim view the runner shows.
Map<String, dynamic> _snapshotQuestion(String attempt, int i) => {
      'id': '$attempt-q$i',
      'subject': 'accountancy',
      'internalSubject': 'Accountancy',
      'chapter': i.isEven ? 'Partnership fundamentals' : 'Goodwill',
      'body': 'A firm of partners revalues its assets and liabilities on the admission of a new partner, question $i. ' * 3,
      'question': 'A firm of partners revalues its assets and liabilities on the admission of a new partner, question $i. ' * 3,
      'options': [
        for (final k in 'ABCD'.split('')) {'key': k, 'text': 'Option $k of question $i, worked through in full so it has a realistic length.'},
      ],
      'correctIndex': i % 4,
      'correctAnswer': 'ABCD'[i % 4],
      'explanation': 'The gain on revaluation is shared in the old ratio, so the answer is option ${'ABCD'[i % 4]}. ' * 6,
      'difficulty': const ['easy', 'medium', 'hard'][i % 3],
      'difficultyWeight': 2,
      'topic': 'Admission of a partner',
      'concept': 'Revaluation account',
      'conceptId': 'acc-revaluation',
      'familyId': 'fam-$i',
      'pyqAnchorId': null,
      'sourceKind': 'authored',
      'questionType': _qTypes[i % 3],
      'passageGroupId': i % 3 == 2 ? 'grp-$attempt' : null,
      'passageText': i % 3 == 2 ? 'A long passage about a partnership deed. ' * 40 : null,
      'qualityScore': 0.92,
      'source': 'MockMob',
      'status': 'live',
      'verificationState': 'verified',
      'verificationEvidence': {
        'state': 'verified',
        'content_hash': 'h' * 64,
        'family_id': 'fam-$i',
        'checks': [
          for (var c = 0; c < 6; c++) {'name': 'check$c', 'passed': true, 'detail': 'Independent solve $c agrees with the key. ' * 3},
        ],
      },
      'upvotes': 0,
      'downvotes': 0,
      'score': 0,
      'createdAt': 1760000000000 + i,
      // Only on an NTA paper: which way the options were laid out for this student.
      'optionOrder': [2, 0, 3, 1],
      'optionsShuffled': true,
    };

/// One row of `GET /api/attempts` as `attemptOut` plus the server finaliser build it, with every
/// recent addition to `selection_meta`: marks, strikes, time away, the end, the client's own meta.
Map<String, dynamic> _liveAttempt(int n, {int total = 50}) {
  final id = 'att_${n.toString().padLeft(4, '0')}';
  final questions = [for (var i = 0; i < total; i++) _snapshotQuestion(id, i)];
  final details = [
    for (var i = 0; i < total; i++)
      {'qid': '$id-q$i', 'givenIndex': i % 7 == 0 ? null : (i % 5 == 0 ? (i + 1) % 4 : i % 4), 'isCorrect': i % 7 == 0 ? null : i % 5 != 0},
  ];
  var correct = 0, wrong = 0;
  for (final d in details) {
    if (d['isCorrect'] == true) correct++;
    if (d['isCorrect'] == false) wrong++;
  }
  final startedAt = 1760100000000 + n * 86400000;
  return {
    'id': id,
    'userId': 'u1',
    'subject': 'accountancy',
    'score': ((correct * 5 - wrong) / (total * 5) * 100).round(),
    'correct': correct,
    'wrong': wrong,
    'unattempted': total - correct - wrong,
    'total': total,
    'details': details,
    'questionsSnapshot': questions,
    'selectionMeta': {
      'mode': n.isEven ? 'nta' : 'full',
      'sessionId': 'sess-$n',
      'scoringVersion': 'server_snapshot_v1',
      'durationMinutes': 60,
      'contentEvidence': 'released_pathway',
      'scoringAuthority': 'server_snapshot',
      'ntaOptionLayout': {
        'version': 1,
        'sections': [
          for (var i = 0; i < total; i++) [2, 0, 3, 1],
        ],
      },
      'client': {'platform': 'android', 'appVersion': '1.0.0', 'startedAt': startedAt},
      'finalisedBy': 'server_deadline',
      'endedBy': 'time_up',
      'recovery': {
        'version': 1,
        'scoring': 'server_snapshot',
        'telemetry': 'self_reported',
        'observed': {
          'answerChanges': [
            {'qid': '$id-q5', 'at': 4200000, 'before': 0, 'after': 1, 'markEffect': -6},
            {'qid': '$id-q9', 'at': 9100000, 'before': 3, 'after': 1, 'markEffect': 6},
          ],
          'lostOnChanges': 6,
          'netFirstToFinal': 0,
          'unanswered': total - correct - wrong,
        },
        'timeline': [
          for (var i = 0; i < total * 3; i++)
            i % 3 == 2
                ? {'seq': i, 'qid': '$id-q${i ~/ 3}', 'at': i * 41000, 'answer': i % 4}
                : {'seq': i, 'qid': '$id-q${i ~/ 3}', 'at': i * 41000, 'via': 'next'},
        ],
        'marks': [
          {'seq': 301, 'qid': '$id-q3', 'at': 2000000, 'marked': true},
        ],
        'presence': [
          {'seq': 302, 'qid': '$id-q4', 'at': 3000000, 'type': 'away'},
          {'seq': 303, 'qid': '$id-q4', 'at': 3040000, 'type': 'back'},
        ],
        'strikes': [
          {'seq': 304, 'qid': '$id-q6', 'at': 5000000, 'option': 2, 'on': true},
        ],
        'end': {'seq': 305, 'qid': '$id-q49', 'at': 3600000, 'reason': 'time_up'},
        'recommendation': {'kind': 'concept_repair', 'title': 'Practise one concept you missed', 'reason': 'Suggested from this attempt.'},
      },
    },
    'mode': n.isEven ? 'nta' : 'full',
    'formatId': 'nta:accountancy:q$total:server_snapshot_v1',
    'completedAt': startedAt + 3600000,
  };
}

/// An attempt as the first builds wrote it: device scored, no mode, no meta, a chapter object.
Map<String, dynamic> _legacyAttempt() => {
      'id': 'att_legacy',
      'userId': 'u1',
      'subject': 'accountancy',
      'score': 40,
      'correct': 2,
      'wrong': 1,
      'unattempted': 0,
      'total': 3,
      'details': [
        {'qid': 'l1', 'givenIndex': 0, 'isCorrect': true},
        {'qid': 'l2', 'givenIndex': '1', 'isCorrect': false},
        {'qid': 'l3', 'givenIndex': 2, 'isCorrect': true},
      ],
      'questionsSnapshot': [
        {
          'id': 'l1',
          'chapter': {'name': 'Goodwill'},
          'question': 'Q1',
          'options': ['a', 'b'],
          'correctIndex': '0',
        },
        {
          'id': 'l2',
          'chapter': 'Goodwill',
          'question': 'Q2',
          'options': ['a', 'b'],
          'correctIndex': 0,
        },
        {
          'id': 'l3',
          'chapter': null,
          'question': 'Q3',
          'options': [],
          'correctIndex': null,
        },
      ],
      'selectionMeta': {},
      'mode': null,
      'formatId': null,
      'completedAt': null, // `new Date(bad).getTime()` is NaN, which JSON writes as null
    };

void main() {
  // The upgrade tests open the same file twice on purpose, one after the other.
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  late AppDatabase db;
  late FakeHttpAdapter http;
  late DateTime now;
  late ProviderContainer container;

  ProviderContainer containerFor(AppDatabase database, FakeHttpAdapter adapter) {
    final c = ProviderContainer(overrides: [
      authSnapshotProvider.overrideWith(_FakeAuth.new),
      appDatabaseProvider.overrideWithValue(database),
      apiClientProvider.overrideWithValue(newApiClient(adapter, now: () => now)),
      nowProvider.overrideWithValue(() => now),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  setUp(() {
    db = newTestDb();
    http = FakeHttpAdapter();
    now = DateTime.utc(2026, 10, 16, 4, 48);
    container = containerFor(db, http);
  });

  tearDown(() async => db.close());

  Future<void> settled(ProviderContainer c) async {
    for (var i = 0; i < 4000; i++) {
      final s = c.read(attemptsRepositoryProvider);
      if (!s.loading && (s.value != null || s.error != null)) return;
      await Future<void>.delayed(const Duration(milliseconds: 1));
    }
    fail('the attempts read never settled');
  }

  group('a heavy live body reads through the app path', () {
    test('fourteen papers of fifty questions with every recent field', () async {
      final live = [for (var n = 13; n >= 0; n--) _liveAttempt(n), _legacyAttempt()];
      final body = jsonEncode(live);
      // The real list for an active student is megabytes: far past the point the app reads a body
      // in an isolate, so this is that path.
      expect(body.length, greaterThan(1500000));
      http.replies.add(FakeReply(200, body));
      container.read(attemptsRepositoryProvider);
      await settled(container);
      final state = container.read(attemptsRepositoryProvider);
      expect(state.error, isNull);
      final attempts = state.value!;
      expect(attempts.length, 15);

      final first = attempts.firstWhere((a) => a.id == 'att_0013');
      expect(first.total, 50);
      expect(first.questions.length, 50);
      expect(first.details.length, 50);
      expect(first.mode, 'full');
      expect(first.formatId, 'nta:accountancy:q50:server_snapshot_v1');
      expect(first.selectionMeta.isServerScored, isTrue);
      expect(first.selectionMeta.recovery!.isUsable, isTrue);
      expect(first.selectionMeta.recovery!.answerChangeQids, ['att_0013-q5', 'att_0013-q9']);
      expect(first.questions.first.options.length, 4);
      expect(first.marks, first.correct * 5 - first.wrong);
      expect(attempts.firstWhere((a) => a.id == 'att_0012').mode, 'nta');

      // The device-scored row from the first builds reads too: no mode, a chapter object, an
      // option list that is plain strings, a completion time the server could not give.
      final legacy = attempts.firstWhere((a) => a.id == 'att_legacy');
      expect(legacy.questions.first.chapter, 'Goodwill');
      expect(legacy.questions.first.correctIndex, 0);
      expect(legacy.details[1].givenIndex, 1);
      expect(legacy.selectionMeta.isServerScored, isFalse);
      expect(legacy.completedAt.millisecondsSinceEpoch, 0);

      expect((await db.select(db.cachedAttempts).get()).length, 15);
    });

    test('and the next launch shows the same list from the phone without asking again', () async {
      http.replies.add(FakeReply(200, jsonEncode([for (var n = 5; n >= 0; n--) _liveAttempt(n), _legacyAttempt()])));
      container.read(attemptsRepositoryProvider);
      await settled(container);

      final quiet = FakeHttpAdapter();
      final next = containerFor(db, quiet);
      next.read(attemptsRepositoryProvider);
      await settled(next);
      final state = next.read(attemptsRepositoryProvider);
      expect(state.value!.length, 7);
      expect(state.fromCache, isTrue);
      expect(state.value!.firstWhere((a) => a.id == 'att_0005').questions.length, 50);
      expect(quiet.requests, isEmpty);
    });
  });

  group('an upgrade over the older build', () {
    late Directory dir;

    setUp(() => dir = Directory.systemTemp.createTempSync('mm_upgrade_'));
    tearDown(() {
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    });

    AppDatabase openFile() => AppDatabase(NativeDatabase(File('${dir.path}/mockmob.sqlite')));

    test('keeps the cached list: opening the same file with this build reads it and asks nothing', () async {
      // As the older build left it: rows with the older body shape and no record of the list read.
      final old = openFile();
      final rows = [_legacyAttempt(), {..._legacyAttempt(), 'id': 'att_legacy2', 'completedAt': 1760000000000}];
      for (final r in rows) {
        await old.into(old.cachedAttempts).insert(CachedAttemptsCompanion.insert(
              userId: 'u1',
              attemptId: r['id']! as String,
              subject: 'accountancy',
              completedAtMs: (r['completedAt'] as int?) ?? 0,
              json: jsonEncode(r),
              fetchedAtMs: now.millisecondsSinceEpoch,
            ));
      }
      final userVersion = (await old.customSelect('PRAGMA user_version').getSingle()).data.values.first;
      await old.close();

      final upgraded = openFile();
      addTearDown(upgraded.close);
      expect((await upgraded.customSelect('PRAGMA user_version').getSingle()).data.values.first, userVersion);
      final quiet = FakeHttpAdapter();
      final c = containerFor(upgraded, quiet);
      c.read(attemptsRepositoryProvider);
      await settled(c);
      expect(c.read(attemptsRepositoryProvider).value!.map((a) => a.id), ['att_legacy2', 'att_legacy']);
      expect(c.read(attemptsRepositoryProvider).error, isNull);
      expect(quiet.requests, isEmpty);
    });

    test('the cache tables are the ones the older build created: a changed column needs a version bump and a migration', () async {
      // schemaVersion has been 1 since the first build and has no migration. If a column is added
      // to a cache table without raising it, the update crashes every read on a phone that already
      // has the table. Change these lists only together with schemaVersion and an onUpgrade.
      expect(db.schemaVersion, 1);
      List<String> names(Iterable<dynamic> columns) => [for (final c in columns) c.name as String];
      expect(names(db.cachedAttempts.$columns), ['user_id', 'attempt_id', 'subject', 'completed_at_ms', 'json', 'fetched_at_ms']);
      expect(names(db.cacheEntries.$columns), ['user_id', 'cache_key', 'json', 'fetched_at_ms']);
      expect(names(db.cachedPlan.$columns), ['user_id', 'minutes', 'json', 'fetched_at_ms']);
    });
  });

  group('when the list cannot be read', () {
    test('a body that is not a list is unreadable, never an empty record', () async {
      http.replies.add(const FakeReply(200, {'error': 'Failed to load attempts'}));
      container.read(attemptsRepositoryProvider);
      await settled(container);
      final state = container.read(attemptsRepositoryProvider);
      expect(state.value, isNull, reason: 'an empty list would tell a student with a record that they have none');
      expect(LoadProblem.of(state.error), LoadProblem.unreadable);
      expect(await db.select(db.cachedAttempts).get(), isEmpty);
    });

    test('a page from the front door is unreadable and says so', () async {
      http.replies.add(const FakeReply(200, '<html>Checking your browser</html>'));
      container.read(attemptsRepositoryProvider);
      await settled(container);
      expect(LoadProblem.of(container.read(attemptsRepositoryProvider).error), LoadProblem.unreadable);
    });

    test('a body too large for the server to send is not described as no connection', () async {
      http.replies.add(const FakeReply(413, {'error': 'Payload too large'}));
      container.read(attemptsRepositoryProvider);
      await settled(container);
      final problem = LoadProblem.of(container.read(attemptsRepositoryProvider).error);
      expect(problem, isNot(LoadProblem.offline));
      expect(problem, isNot(LoadProblem.slow));
    });

    test('the rows on the phone stay when a forced read comes back unreadable', () async {
      http.replies.add(FakeReply(200, jsonEncode([_liveAttempt(1), _liveAttempt(2)])));
      container.read(attemptsRepositoryProvider);
      await settled(container);
      http.replies.add(const FakeReply(200, '[{"id": "att_x", "details": '));
      await container.read(attemptsRepositoryProvider.notifier).refresh(force: true);
      final state = container.read(attemptsRepositoryProvider);
      expect(state.value!.length, 2, reason: 'the cached papers stay visible');
      expect(state.isStale, isTrue);
      expect(LoadProblem.of(state.error), LoadProblem.unreadable);
      expect((await db.select(db.cachedAttempts).get()).length, 2, reason: 'and the cache is not wiped by a bad read');
    });

    test('one cached row that no longer reads does not hide the others', () async {
      await db.into(db.cachedAttempts).insert(CachedAttemptsCompanion.insert(
          userId: 'u1', attemptId: 'broken', subject: 'accountancy', completedAtMs: 5, json: '{"id": "broken", ', fetchedAtMs: now.millisecondsSinceEpoch));
      await db.into(db.cachedAttempts).insert(CachedAttemptsCompanion.insert(
          userId: 'u1', attemptId: 'att_1', subject: 'accountancy', completedAtMs: 4, json: jsonEncode(_liveAttempt(1)), fetchedAtMs: now.millisecondsSinceEpoch));
      final quiet = FakeHttpAdapter();
      final c = containerFor(db, quiet);
      c.read(attemptsRepositoryProvider);
      await settled(c);
      expect(c.read(attemptsRepositoryProvider).value!.map((a) => a.id), ['att_0001']);
      expect(quiet.requests, isEmpty);
    });

    test('a cache that holds nothing readable goes to the network instead of showing an empty list', () async {
      await db.into(db.cachedAttempts).insert(CachedAttemptsCompanion.insert(
          userId: 'u1', attemptId: 'broken', subject: 'accountancy', completedAtMs: 5, json: 'not json', fetchedAtMs: now.millisecondsSinceEpoch));
      http.replies.add(FakeReply(200, jsonEncode([_liveAttempt(3)])));
      container.read(attemptsRepositoryProvider);
      await settled(container);
      expect(container.read(attemptsRepositoryProvider).value!.single.id, 'att_0003');
      expect(http.requests.length, 1);
    });
  });

  group('what Today says when the record did not load', () {
    final tuesday = DateTime.utc(2026, 10, 13, 16);
    MoveHero card(LoadProblem? problem, {bool offline = false}) =>
        buildMove(TodayInputs(now: tuesday, firstName: 'Asha', attemptsFailed: true, readProblem: problem, offline: offline));

    test('an unreadable answer is named, not called a connection problem', () {
      final hero = card(LoadProblem.unreadable);
      expect(hero.meaning, contains('could not read'));
      expect(hero.meaning, isNot(contains('Could not reach')));
      expect(hero.summary, hero.meaning);
    });

    test('each cause says its own sentence, and the general line stays only for an unknown cause', () {
      expect(card(LoadProblem.slow).meaning, startsWith(LoadProblem.slow.sentence));
      expect(card(LoadProblem.busy).meaning, startsWith(LoadProblem.busy.sentence));
      expect(card(LoadProblem.refused).meaning, startsWith(LoadProblem.refused.sentence));
      expect(card(LoadProblem.record).meaning, startsWith(LoadProblem.record.sentence));
      expect(card(LoadProblem.offline).meaning, TodayCopy.unavailableOffline);
      expect(card(null).meaning, TodayCopy.unavailableLine);
    });

    test('the phone being offline still says so, whatever failed first', () {
      expect(card(LoadProblem.busy, offline: true).meaning, TodayCopy.unavailableOffline);
    });
  });
}
