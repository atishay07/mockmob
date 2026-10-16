// A My colleges server for tests: the list lives in memory, answers in the contract's shape
// (test/fixtures/colleges/contract_colleges_v1.json) and can be told to fail.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/my_colleges.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/tools/data/my_colleges_repository.dart';

MyCollege mc(String programmeId, String college, [String programme = '']) => MyCollege(programmeId: programmeId, college: college, programme: programme);

Map<String, Object?> body(List<MyCollege> list, {String? result}) => {
      'colleges': [for (final (i, c) in list.indexed) {...c.toJson(), 'position': i + 1, 'addedAt': '2026-10-16T05:30:00.000Z'}],
      'count': list.length,
      'max': 8,
      'result': ?result,
    };

class FakeMyColleges extends MyCollegesRepository {
  FakeMyColleges({List<MyCollege> start = const [], this.readError, this.cached, this.writeError}) : server = [...start];

  /// What the server holds.
  final List<MyCollege> server;

  /// Set to fail the next reads / writes.
  ApiError? readError;
  ApiError? writeError;

  /// A copy kept on the phone, shown before the read.
  List<MyCollege>? cached;

  final calls = <String>[];

  @override
  Future<CachedValue<MyColleges>?> readCache(String userId) async =>
      cached == null ? null : CachedValue(MyColleges.fromJson(body(cached!)), DateTime.utc(2026, 10, 16, 5));

  @override
  Future<void> writeCache(String userId, Fetched<MyColleges> fetched, DateTime at) async => cached = fetched.value.colleges;

  @override
  Future<Object?> fetchJson() async {
    calls.add('GET');
    final e = readError;
    if (e != null) throw e;
    return body(server);
  }

  @override
  Future<Object?> sendAdd(MyCollege entry, String userId) async {
    calls.add('POST ${entry.key}');
    final e = writeError;
    if (e != null) throw e;
    if (server.any(entry.sameAs)) return body(server, result: 'exists');
    if (server.length >= 8) throw const ApiError(status: 409, kind: ApiErrorKind.conflict, code: 'list_full');
    server.add(entry);
    return body(server, result: 'added');
  }

  @override
  Future<Object?> sendRemove(MyCollege entry, String userId) async {
    calls.add('DELETE ${entry.key}');
    final e = writeError;
    if (e != null) throw e;
    server.removeWhere(entry.sameAs);
    return body(server);
  }

  @override
  Future<Object?> sendReplace(MyColleges list, String userId) async {
    calls.add('PUT ${list.colleges.map((c) => c.college).join('|')}');
    final e = writeError;
    if (e != null) throw e;
    server
      ..clear()
      ..addAll(list.colleges);
    return body(server);
  }
}

/// An override that gives a test an empty (or given) list and no network.
Override myCollegesOverride(FakeMyColleges fake) => myCollegesRepositoryProvider.overrideWith(() => fake);
