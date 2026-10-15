// My colleges on the server: `GET/PUT/POST/DELETE /api/me/colleges` (bearer; the website and the
// app share the list). The last list the server confirmed is kept on this phone per account, so an
// offline open shows it and says so; a list that never loaded is never shown as empty.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/my_colleges.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';

class MyCollegesRepository extends JsonRemoteNotifier<MyColleges> {
  static const String path = '/api/me/colleges';

  @override
  String get cacheKey => 'my-colleges';

  @override
  MyColleges parse(Object? json) => MyColleges.fromJson(json);

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get(path)).data;

  /// `POST`: adds at the end. 201 added, 200 already there; 409 `list_full` throws.
  Future<Object?> sendAdd(MyCollege entry, String userId) async =>
      (await ref.read(apiClientProvider).post(path, body: entry.toEntry(), expectUserId: userId)).data;

  /// `DELETE ?programmeId=..&college=..`: 200 even when the college was not there.
  Future<Object?> sendRemove(MyCollege entry, String userId) async => (await ref.read(apiClientProvider).request(
        'DELETE',
        path,
        query: {'programmeId': entry.programmeId, 'college': entry.college},
        expectUserId: userId,
      ))
      .data;

  /// `PUT`: the whole ordered list.
  Future<Object?> sendReplace(MyColleges list, String userId) async =>
      (await ref.read(apiClientProvider).put(path, body: list.toPutBody(), expectUserId: userId)).data;

  /// Shows [next] now, before the server has answered. Not kept on the phone.
  void showOptimistic(MyColleges next) {
    if (!ref.mounted) return;
    final s = state;
    state = RemoteState(value: next, fetchedAt: s.fetchedAt, fromCache: s.fromCache, loading: s.loading, error: s.error);
  }

  /// The server's answer to a change: shown and kept on the phone.
  Future<void> accept(Object? body, String userId) => setAcknowledged(Fetched(MyColleges.fromJson(body), body), forUserId: userId);
}

final myCollegesRepositoryProvider = NotifierProvider<MyCollegesRepository, RemoteState<MyColleges>>(MyCollegesRepository.new);
