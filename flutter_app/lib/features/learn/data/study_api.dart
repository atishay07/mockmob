import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/study.dart';
import 'pending_event.dart';

/// The study endpoints of the API contract (2.10). Starting a run and sending an event are
/// idempotent on their `requestKey`, so they may be repeated after a network error.
class StudyApi {
  StudyApi(this._client);

  final ApiClient _client;

  static const _idempotentWrite = ApiOptions(retries: 2);

  Future<ApiResponse> catalog() => _client.get('/api/study/catalog');

  /// `POST /api/study/runs`. [unitId] focuses one lesson; leave it out for "everything due".
  Future<StudyRun> startRun({required String requestKey, required String mode, String? unitId}) async {
    final response = await _client.post(
      '/api/study/runs',
      body: {'requestKey': requestKey, 'mode': mode, 'unitId': ?unitId},
      options: _idempotentWrite,
    );
    return StudyRun.fromJson(response.map);
  }

  Future<StudyRun> run(String runId) async =>
      StudyRun.fromJson((await _client.get('/api/study/runs/${Uri.encodeComponent(runId)}')).map);

  Future<StudyRun> sendEvent(String runId, PendingEvent event) async {
    final response = await _client.post(
      '/api/study/runs/${Uri.encodeComponent(runId)}/events',
      body: event.toBody(),
      options: _idempotentWrite,
    );
    return StudyRun.fromJson(response.map);
  }

  /// `GET /api/study/summary?subject&chapter`: the published lessons of one chapter. The server
  /// records an exposure for each, so call it only when the student opens the reader.
  Future<Json> summary(String subject, String chapter) async =>
      (await _client.get('/api/study/summary', query: {'subject': subject, 'chapter': chapter})).map;

  /// `GET /api/study/units/{id}`. The server records an exposure, so call it only when the
  /// student opens the lesson, never to prefetch.
  Future<Json> unit(String id) async => (await _client.get('/api/study/units/${Uri.encodeComponent(id)}')).map;
}

final studyApiProvider = Provider<StudyApi>((ref) => StudyApi(ref.watch(apiClientProvider)));
