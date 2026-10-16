import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/repair_check.dart';

/// `GET` and `POST /api/recovery/check` (contract `repair-check-v1`). Behind an interface so tests
/// replace it. The check is part of the repair's credit: nothing here spends a credit, and no
/// model is called.
abstract interface class RepairCheckApi {
  /// The fresh question (free), the stored answer, or a plain reason there is none. Throws
  /// [ApiError] for a non-2xx answer and [FormatException] for a 2xx body the app cannot show.
  Future<CheckLoad> load({required String attemptId, required String questionId});

  /// Marks [pick] (0 to 3, the position the student saw). The same [requestId] on a retry: the
  /// server stores the first answer and returns it again, so an answer counts once.
  Future<CheckAnswer> submit({
    required String attemptId,
    required String questionId,
    required String checkQuestionId,
    required int pick,
    required String requestId,
  });
}

class HttpRepairCheckApi implements RepairCheckApi {
  HttpRepairCheckApi(this._api);

  final ApiClient _api;

  static const path = '/api/recovery/check';

  /// The contract's pattern for a request id: one per student action.
  static final requestIdPattern = RegExp(r'^[A-Za-z0-9_-]{16,64}$');

  @override
  Future<CheckLoad> load({required String attemptId, required String questionId}) async {
    final res = await _api.get(path, query: {'attemptId': attemptId, 'questionId': questionId}, options: const ApiOptions(receiveTimeout: Duration(seconds: 12)));
    final parsed = CheckLoad.tryParse(res.data);
    if (parsed == null) throw const FormatException('check_load');
    return parsed;
  }

  @override
  Future<CheckAnswer> submit({
    required String attemptId,
    required String questionId,
    required String checkQuestionId,
    required int pick,
    required String requestId,
  }) async {
    final res = await _api.post(
      path,
      body: {'attemptId': attemptId, 'questionId': questionId, 'checkQuestionId': checkQuestionId, 'pick': pick, 'requestId': requestId},
      options: const ApiOptions(receiveTimeout: Duration(seconds: 15)),
    );
    final parsed = CheckAnswer.tryParse(res.data);
    if (parsed == null) throw const FormatException('check_answer');
    return parsed;
  }
}

final repairCheckApiProvider = Provider<RepairCheckApi>((ref) => HttpRepairCheckApi(ref.watch(apiClientProvider)));
