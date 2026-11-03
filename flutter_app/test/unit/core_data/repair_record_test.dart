import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/repair_record.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/repair_record_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/storage/storage_providers.dart';

import 'support/fakes.dart';
import 'support/test_db.dart';

/// The body `GET /api/me/repair-record` returns, field for field as src/lib/server/repairRecord.js
/// builds it (`buildRepairRecord`), after dio has decoded it: a Map holding a List of Maps.
Map<String, Object?> _row({
  String attemptId = 'att-1',
  String questionId = 'q-9',
  Object? chapter = 'Correct Word Usage',
  Object? subject = 'english',
  Object? foundAt = '2026-10-09T15:30:00.000Z',
  String repairedAt = '2026-10-10T17:20:11.000Z',
  String checkedState = 'pending',
  Object? retriedAt,
}) => {
      'attemptId': attemptId,
      'questionId': questionId,
      'chapter': chapter,
      'subject': subject,
      'foundAt': foundAt,
      'repairedAt': repairedAt,
      'checkedState': checkedState,
      'retriedAt': retriedAt,
    };

Map<String, Object?> _body(List<Map<String, Object?>> rows) => {'repairs': rows};

class _FakeAuth extends AuthController {
  _FakeAuth(this.snapshot);

  final AuthSnapshot snapshot;

  @override
  AuthSnapshot build() => snapshot;

  void switchTo(AuthSnapshot next) => state = next;
}

const _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co');

RepairLocalRecord _local(String attempt, String question, String status, {DateTime? at, String requestId = 'req-local-0000001'}) =>
    RepairLocalRecord(attemptId: attempt, questionId: question, requestId: requestId, status: status, ackedAt: at);

void main() {
  group('parseRepairRecord (the route body after dio decoded it)', () {
    test('reads the real Map shape with every field', () {
      final out = parseRepairRecord(_body([
        _row(retriedAt: '2026-10-12T08:00:00.000Z', checkedState: 'passed'),
        _row(attemptId: 'att-2', questionId: 'q-3', chapter: null, subject: null, foundAt: null, checkedState: 'not_passed'),
      ]));
      expect(out, hasLength(2));
      final a = out.first;
      expect(a.attemptId, 'att-1');
      expect(a.questionId, 'q-9');
      expect(a.chapter, 'Correct Word Usage');
      expect(a.subject, 'english');
      expect(a.foundAt, DateTime.utc(2026, 10, 9, 15, 30));
      expect(a.repairedAt, DateTime.utc(2026, 10, 10, 17, 20, 11));
      expect(a.checkedState, RepairCheckedState.passed);
      expect(a.retriedAt, DateTime.utc(2026, 10, 12, 8));
      final b = out.last;
      expect(b.chapter, isNull);
      expect(b.subject, isNull);
      expect(b.foundAt, isNull);
      expect(b.retriedAt, isNull);
      expect(b.checkedState, RepairCheckedState.notPassed);
    });

    test('an empty record is an empty list, not an error', () {
      expect(parseRepairRecord(_body(const [])), isEmpty);
    });

    test('a bare List of rows reads too', () {
      expect(parseRepairRecord([_row()]), hasLength(1));
    });

    test('a JSON string that lost its content type still reads', () {
      expect(parseRepairRecord('{"repairs":[{"attemptId":"a","questionId":"q","repairedAt":"2026-10-10T17:20:11.000Z"}]}'), hasLength(1));
    });

    test('the four check words, and an unknown word reads as not available', () {
      Iterable<RepairCheckedState> states(List<String> words) =>
          parseRepairRecord(_body([for (var i = 0; i < words.length; i++) _row(questionId: 'q$i', checkedState: words[i])])).map((r) => r.checkedState);
      expect(states(['pending', 'passed', 'not_passed', 'not_available', 'mystery']), [
        RepairCheckedState.pending,
        RepairCheckedState.passed,
        RepairCheckedState.notPassed,
        RepairCheckedState.notAvailable,
        RepairCheckedState.notAvailable,
      ]);
    });

    test('a row with no ids or no repair time is left out, the rest stay', () {
      final out = parseRepairRecord(_body([
        _row(attemptId: ''),
        _row(questionId: 'q-ok'),
        {'attemptId': 'a', 'questionId': 'q', 'repairedAt': null},
        {'attemptId': 'a', 'questionId': 'q', 'repairedAt': 'not a date'},
        {'questionId': 'q', 'repairedAt': '2026-10-10T17:20:11.000Z'},
      ]));
      expect(out.map((r) => r.questionId), ['q-ok']);
    });

    test('rows that are not maps are left out; a repeated mistake keeps its first (newest) row', () {
      final out = parseRepairRecord({
        'repairs': [
          'junk',
          7,
          null,
          _row(repairedAt: '2026-10-11T10:00:00.000Z'),
          _row(repairedAt: '2026-10-10T10:00:00.000Z'),
        ],
      });
      expect(out, hasLength(1));
      expect(out.single.repairedAt, DateTime.utc(2026, 10, 11, 10));
    });

    test('blank chapter and subject read as missing', () {
      final out = parseRepairRecord(_body([_row(chapter: '  ', subject: '')]));
      expect(out.single.chapter, isNull);
      expect(out.single.subject, isNull);
    });

    test('a body that is not a record throws, so the screen keeps what it had', () {
      expect(() => parseRepairRecord(const <String, Object?>{}), throwsFormatException);
      expect(() => parseRepairRecord({'error': 'unavailable', 'message': 'Try again shortly.'}), throwsFormatException);
      expect(() => parseRepairRecord({'repairs': 'nope'}), throwsFormatException);
      expect(() => parseRepairRecord('<html>Bad gateway</html>'), throwsFormatException);
      expect(() => parseRepairRecord(null), throwsFormatException);
      expect(() => parseRepairRecord(42), throwsFormatException);
    });
  });

  group('mergeRepairRecords', () {
    final t1 = DateTime.utc(2026, 10, 10, 17);
    final t2 = DateTime.utc(2026, 10, 11, 9);
    ServerRepair server(String a, String q, DateTime at, {RepairCheckedState check = RepairCheckedState.pending}) => ServerRepair(
          attemptId: a,
          questionId: q,
          repairedAt: at,
          chapter: 'Correct Word Usage',
          subject: 'english',
          foundAt: DateTime.utc(2026, 10, 9),
          checkedState: check,
        );

    test('both empty is empty', () {
      expect(mergeRepairRecords(local: const [], server: const []), isEmpty);
    });

    test('server only: kept, with its time and its check', () {
      final out = mergeRepairRecords(local: const [], server: [server('a1', 'q1', t1, check: RepairCheckedState.passed)]);
      final e = out.single;
      expect(e.source, RepairRecordSource.server);
      expect(e.isRepaired, isTrue);
      expect(e.status, RepairLocalStatus.stored);
      expect(e.ackedAt, t1);
      expect(e.chapter, 'Correct Word Usage');
      expect(e.checkedState, RepairCheckedState.passed);
      expect(e.requestId, '');
      expect(e.waitsForSync, isFalse);
      final asLocal = e.toLocalRecord();
      expect(asLocal.isRepaired, isTrue);
      expect(asLocal.isAcknowledged, isTrue);
      expect(asLocal.ackedAt, t1);
    });

    test('phone only: kept untouched until the server has it, and waits for sync when repaired', () {
      final out = mergeRepairRecords(
        local: [
          _local('a1', 'q1', RepairLocalStatus.explained, at: t1),
          _local('a1', 'q2', RepairLocalStatus.pending),
          _local('a1', 'q3', RepairLocalStatus.reviewed),
        ],
        server: const [],
      );
      expect(out, hasLength(3));
      final byQ = {for (final e in out) e.questionId: e};
      expect(byQ['q1']!.source, RepairRecordSource.phone);
      expect(byQ['q1']!.status, RepairLocalStatus.explained);
      expect(byQ['q1']!.ackedAt, t1);
      expect(byQ['q1']!.waitsForSync, isTrue);
      expect(byQ['q2']!.status, RepairLocalStatus.pending);
      expect(byQ['q2']!.waitsForSync, isFalse);
      expect(byQ['q2']!.toLocalRecord().isAcknowledged, isFalse);
      expect(byQ['q3']!.status, RepairLocalStatus.reviewed);
    });

    test('same mistake in both: the server wins, the phone keeps its request id', () {
      final out = mergeRepairRecords(
        local: [_local('a1', 'q1', RepairLocalStatus.pending, requestId: 'req-keep-0000001')],
        server: [server('a1', 'q1', t2)],
      );
      final e = out.single;
      expect(e.source, RepairRecordSource.both);
      expect(e.status, RepairLocalStatus.stored);
      expect(e.isRepaired, isTrue);
      expect(e.ackedAt, t2);
      expect(e.requestId, 'req-keep-0000001');
      expect(e.waitsForSync, isFalse);
    });

    test('the server time wins even when the phone holds a different one', () {
      final out = mergeRepairRecords(
        local: [_local('a1', 'q1', RepairLocalStatus.explained, at: t2)],
        server: [server('a1', 'q1', t1)],
      );
      expect(out.single.ackedAt, t1);
    });

    test('the server wins over a local not-a-mistake or held row', () {
      final out = mergeRepairRecords(
        local: [
          _local('a1', 'q1', RepairLocalStatus.notAMistake),
          _local('a1', 'q2', RepairLocalStatus.heldForRecheck),
        ],
        server: [server('a1', 'q1', t1), server('a1', 'q2', t1)],
      );
      expect(out.every((e) => e.isRepaired), isTrue);
    });

    test('the same question in two different papers is two mistakes', () {
      final out = mergeRepairRecords(
        local: [_local('a2', 'q1', RepairLocalStatus.explained, at: t1)],
        server: [server('a1', 'q1', t2)],
      );
      expect(out, hasLength(2));
      expect({for (final e in out) e.key: e.source}, {'a1/q1': RepairRecordSource.server, 'a2/q1': RepairRecordSource.phone});
    });

    test('newest first, rows with no time last, ties by key', () {
      final out = mergeRepairRecords(
        local: [
          _local('a9', 'q1', RepairLocalStatus.pending),
          _local('a3', 'q1', RepairLocalStatus.explained, at: DateTime.utc(2026, 10, 12)),
        ],
        server: [server('a1', 'q1', t1), server('a2', 'q1', t2), server('a0', 'q1', t2)],
      );
      expect(out.map((e) => e.key), ['a3/q1', 'a0/q1', 'a2/q1', 'a1/q1', 'a9/q1']);
    });
  });

  group('repository and providers', () {
    late AppDatabase db;
    late FakeHttpAdapter http;
    late DateTime now;
    late ProviderContainer container;
    var local = <RepairLocalRecord>[];

    ProviderContainer newContainer({FakeHttpAdapter? adapter, AuthSnapshot auth = _signedIn}) => ProviderContainer(overrides: [
          authSnapshotProvider.overrideWith(() => _FakeAuth(auth)),
          appDatabaseProvider.overrideWithValue(db),
          apiClientProvider.overrideWithValue(newApiClient(adapter ?? http, now: () => now)),
          nowProvider.overrideWithValue(() => now),
          repairLocalRecordsProvider.overrideWith((ref) => Stream.value(local)),
        ]);

    setUp(() {
      db = newTestDb();
      http = FakeHttpAdapter();
      now = DateTime.utc(2026, 10, 16, 16);
      local = [];
      container = newContainer();
    });

    tearDown(() async {
      container.dispose();
      await db.close();
    });

    Future<void> until(bool Function() done) async {
      for (var i = 0; i < 400 && !done(); i++) {
        await Future<void>.delayed(Duration.zero);
      }
      expect(done(), isTrue, reason: 'state never settled');
    }

    bool settled(ProviderContainer c) {
      final s = c.read(repairRecordRepositoryProvider);
      return !s.loading && (s.value != null || s.error != null);
    }

    test('reads GET /api/me/repair-record with the route limit and the sign-in header', () async {
      http.replies.add(FakeReply(200, _body([_row(), _row(questionId: 'q-2', checkedState: 'passed')])));
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      expect(http.requests, hasLength(1));
      final r = http.requests.single;
      expect(r.method, 'GET');
      expect(r.path, '/api/me/repair-record');
      expect(r.headers['Authorization'], startsWith('Bearer '));
      final s = container.read(repairRecordRepositoryProvider);
      expect(s.value, hasLength(2));
      expect(s.fromCache, isFalse);
      expect(s.fetchedAt, now);
    });

    test('sends limit=100 as a query', () async {
      Object? seen;
      http.handler = (o) {
        seen = o.queryParameters['limit'];
        return FakeReply(200, _body(const []));
      };
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      expect('$seen', '100');
    });

    test('an empty record is a value (no repairs), not a failure', () async {
      http.replies.add(FakeReply(200, _body(const [])));
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      final s = container.read(repairRecordRepositoryProvider);
      expect(s.value, isEmpty);
      expect(s.error, isNull);
    });

    test('a record with rows is cached, then shown first and offline next time', () async {
      http.replies.add(FakeReply(200, _body([_row()])));
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));

      final offline = FakeHttpAdapter()..handler = (_) => const FakeReply.network();
      now = now.add(const Duration(hours: 5));
      final second = newContainer(adapter: offline);
      addTearDown(second.dispose);
      second.read(repairRecordRepositoryProvider);
      await until(() => second.read(repairRecordRepositoryProvider).error != null);
      final s = second.read(repairRecordRepositoryProvider);
      expect(s.value, hasLength(1));
      expect(s.value!.single.chapter, 'Correct Word Usage');
      expect(s.fromCache, isTrue);
      expect(s.isStale, isTrue);
      expect(s.fetchedAt!.toUtc(), DateTime.utc(2026, 10, 16, 16));
    });

    test('a 503 with nothing cached is a failed, empty state and the phone rows still show', () async {
      local = [_local('a1', 'q1', RepairLocalStatus.explained, at: DateTime.utc(2026, 10, 15))];
      http.handler = (_) => const FakeReply(503, {'error': 'unavailable', 'message': 'Your repair record could not be loaded. Try again shortly.'});
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      expect(container.read(repairRecordRepositoryProvider).isFailedEmpty, isTrue);
      await until(() => container.read(repairRecordEntriesProvider).isNotEmpty);
      final entries = container.read(repairRecordEntriesProvider);
      expect(entries.single.source, RepairRecordSource.phone);
      expect(entries.single.isRepaired, isTrue);
    });

    test('a 401 is an error state and shows no server rows', () async {
      http.handler = (_) => const FakeReply(401, {'error': 'Unauthorized', 'message': 'Please sign in.'});
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      expect(container.read(repairRecordRepositoryProvider).value, isNull);
      expect(container.read(repairRecordRepositoryProvider).error, isNotNull);
    });

    test('a 200 whose body is not a record is an error, not an empty record', () async {
      http.replies.add(const FakeReply(200, {'something': 'else'}));
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      final s = container.read(repairRecordRepositoryProvider);
      expect(s.value, isNull);
      expect(s.error?.code, 'unusable_response');
    });

    test('mergedRepairRecordsProvider joins server and phone for Review (server wins, phone-only kept)', () async {
      local = [
        _local('att-1', 'q-9', RepairLocalStatus.pending),
        _local('att-5', 'q-1', RepairLocalStatus.explained, at: DateTime.utc(2026, 10, 15, 22)),
      ];
      http.replies.add(FakeReply(200, _body([_row(), _row(attemptId: 'att-7', questionId: 'q-4', repairedAt: '2026-10-14T12:00:00.000Z')])));
      container.listen(mergedRepairRecordsProvider, (_, _) {});
      await until(() => container.read(mergedRepairRecordsProvider).length == 3);
      final merged = container.read(mergedRepairRecordsProvider);
      final byKey = {for (final r in merged) '${r.attemptId}/${r.questionId}': r};
      expect(byKey.keys.toSet(), {'att-1/q-9', 'att-5/q-1', 'att-7/q-4'});
      expect(byKey['att-1/q-9']!.isRepaired, isTrue);
      expect(byKey['att-1/q-9']!.ackedAt, DateTime.utc(2026, 10, 10, 17, 20, 11));
      expect(byKey['att-7/q-4']!.isRepaired, isTrue);
      expect(byKey['att-7/q-4']!.isAcknowledged, isTrue);
      expect(byKey['att-5/q-1']!.status, RepairLocalStatus.explained);
      expect(merged.map((r) => '${r.attemptId}/${r.questionId}').first, 'att-5/q-1', reason: 'newest first');
    });

    test('repairCheckStatesProvider names the check only for mistakes the server lists', () async {
      local = [_local('att-5', 'q-1', RepairLocalStatus.explained, at: DateTime.utc(2026, 10, 15, 22))];
      http.replies.add(FakeReply(200, _body([_row(checkedState: 'not_passed')])));
      container.listen(repairCheckStatesProvider, (_, _) {});
      await until(() => container.read(repairCheckStatesProvider).isNotEmpty);
      final states = container.read(repairCheckStatesProvider);
      expect(states, {'att-1/q-9': RepairCheckedState.notPassed});
      expect(states.containsKey('att-5/q-1'), isFalse);
    });

    test('a different signed-in user starts empty and does not see the cached record', () async {
      http.replies.add(FakeReply(200, _body([_row()])));
      container.read(repairRecordRepositoryProvider);
      await until(() => settled(container));
      expect(container.read(repairRecordRepositoryProvider).value, hasLength(1));
      http.replies.add(FakeReply(200, _body(const [])));
      (container.read(authSnapshotProvider.notifier) as _FakeAuth).switchTo(const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2'));
      await until(() => container.read(repairRecordRepositoryProvider).value?.isEmpty ?? false);
      expect(container.read(repairRecordRepositoryProvider).fromCache, isFalse);
    });

    test('signed out reads nothing from the server', () async {
      final out = newContainer(auth: const AuthSnapshot(status: AuthStatus.signedOut));
      addTearDown(out.dispose);
      out.read(repairRecordRepositoryProvider);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(http.requests, isEmpty);
      expect(out.read(repairRecordRepositoryProvider).value, isNull);
    });
  });
}
