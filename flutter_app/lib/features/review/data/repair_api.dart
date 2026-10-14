import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/repair.dart';

/// `POST /api/recovery/repair` [API 2.9]. Behind an interface so tests replace it.
abstract interface class RepairApi {
  /// Throws [ApiError] for a non-2xx answer and [RepairResponseFormatException] for a body
  /// outside the four documented outcomes.
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId});
}

class HttpRepairApi implements RepairApi {
  HttpRepairApi(this._api);

  final ApiClient _api;

  @override
  Future<RepairResponse> repair({required String attemptId, required String questionId, required String requestId}) async {
    final response = await _api.post(
      '/api/recovery/repair',
      body: {'attemptId': attemptId, 'questionId': questionId, 'requestId': requestId},
      // The explanation can take a while to write.
      options: const ApiOptions(receiveTimeout: Duration(seconds: 45)),
    );
    return RepairResponse.fromJson(response.map);
  }
}

final repairApiProvider = Provider<RepairApi>((ref) => HttpRepairApi(ref.watch(apiClientProvider)));
