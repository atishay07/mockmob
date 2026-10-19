import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import 'mobi_models.dart';

/// The Mobi v13 routes beside the chat (MOBI-CONTRACT sections 1 and 3). Behind an interface so tests replace it.
/// Nothing here spends a credit: the standing is read from the record, and a thread's 2 questions come with the
/// doubt's credit.
abstract interface class MobiApi {
  /// `GET /api/mobi/standing`. Throws [ApiError] for a non-2xx answer and [FormatException] for a body the app cannot
  /// show.
  Future<MobiStanding> standing();

  /// `POST /api/mobi/thread { op: 'checks' }`: attaches the thread's 2 questions on [chapter], once.
  Future<({List<ThreadCheck> checks, String? note})> attachChecks({required String threadId, required String subject, required String chapter});

  /// `POST /api/mobi/thread { op: 'answer' }`: marks [pick] (0 to 3, as shown). The same [requestId] on a retry: the
  /// first answer counts.
  Future<CheckMark> answer({required String threadId, required String checkQuestionId, required int pick, required String requestId});
}

class HttpMobiApi implements MobiApi {
  HttpMobiApi(this._api);

  final ApiClient _api;

  @override
  Future<MobiStanding> standing() async {
    final res = await _api.get('/api/mobi/standing', options: const ApiOptions(receiveTimeout: Duration(seconds: 12)));
    final parsed = MobiStanding.tryParse(res.data);
    if (parsed == null) throw const FormatException('standing');
    return parsed;
  }

  @override
  Future<({List<ThreadCheck> checks, String? note})> attachChecks({required String threadId, required String subject, required String chapter}) async {
    final res = await _api.post(
      '/api/mobi/thread',
      body: {'op': 'checks', 'threadId': threadId, 'subject': subject, 'chapter': chapter},
      options: const ApiOptions(receiveTimeout: Duration(seconds: 15)),
    );
    final j = res.map;
    if (j['ok'] == false) throw const FormatException('checks');
    final note = asString(j['checksNote'])?.trim();
    return (checks: [for (final c in asJsonList(j['checks'])) ?ThreadCheck.tryParse(c)].take(2).toList(), note: note == null || note.isEmpty ? null : note);
  }

  @override
  Future<CheckMark> answer({required String threadId, required String checkQuestionId, required int pick, required String requestId}) async {
    final res = await _api.post(
      '/api/mobi/thread',
      body: {'op': 'answer', 'threadId': threadId, 'checkQuestionId': checkQuestionId, 'pick': pick, 'requestId': requestId},
      options: const ApiOptions(receiveTimeout: Duration(seconds: 15)),
    );
    final mark = CheckMark.tryParse(res.map['result']);
    if (mark == null) throw const FormatException('answer');
    return mark;
  }
}

final mobiApiProvider = Provider<MobiApi>((ref) => HttpMobiApi(ref.watch(apiClientProvider)));

/// Where you stand, read once per open of Ask Mobi and again after a pull (it changes only with new practice). Per
/// account: another student's standing never shows.
final mobiStandingProvider = FutureProvider.autoDispose<MobiStanding>((ref) {
  ref.watch(authSnapshotProvider.select((s) => s.userId));
  return ref.watch(mobiApiProvider).standing();
});
