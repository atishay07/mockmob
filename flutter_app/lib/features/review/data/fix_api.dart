import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/repair_check.dart';

/// "Fix it for good" checks (MOBI-CONTRACT 4): the repair's 2 fresh questions, slot 1 then slot 2, through the same
/// route as "Check it held" (`/api/recovery/check`). They come with the fix's credit: nothing here spends one. Kept
/// apart from [RepairCheckApi] so the run's check is untouched.
abstract interface class FixCheckApi {
  /// The question in [slot] (1 or 2), the stored answer, or a plain reason there is none. Throws [ApiError] for a
  /// non-2xx answer and [FormatException] for a body the app cannot show.
  Future<FixCheckLoad> load({required String attemptId, required String questionId, int slot = 1});

  /// Marks [pick] (0 to 3, as shown) for the question in [slot]. The same [requestId] on a retry: the first answer
  /// counts.
  Future<FixCheckAnswer> submit({
    required String attemptId,
    required String questionId,
    required String checkQuestionId,
    required int pick,
    required String requestId,
    int slot = 1,
  });
}

/// A fix check as `GET` answered it, with the job's verdict so far: slot 2 with no question left says whether the
/// first check decided it alone.
class FixCheckLoad {
  const FixCheckLoad(this.load, {this.held, this.heldLine});

  final CheckLoad load;
  final bool? held;
  final String? heldLine;
}

/// A marked fix check, with the job's verdict: [held] is true when every check offered is right, false when one is
/// wrong, and null while one is still open.
class FixCheckAnswer {
  const FixCheckAnswer({required this.result, this.replayed = false, this.held, this.heldLine});

  static FixCheckAnswer? tryParse(Object? body) {
    final answer = CheckAnswer.tryParse(body);
    if (answer == null) return null;
    final j = asJson(body);
    final inner = asJson(j['result']);
    final held = asBool(j['held']) ?? asBool(inner['held']);
    final line = (asString(j['heldLine']) ?? asString(inner['heldLine']))?.trim();
    return FixCheckAnswer(result: answer.result, replayed: answer.replayed, held: held, heldLine: line == null || line.isEmpty ? null : line);
  }

  final CheckResult result;
  final bool replayed;
  final bool? held;
  final String? heldLine;
}

class HttpFixCheckApi implements FixCheckApi {
  HttpFixCheckApi(this._api);

  final ApiClient _api;

  static const path = '/api/recovery/check';

  @override
  Future<FixCheckLoad> load({required String attemptId, required String questionId, int slot = 1}) async {
    final res = await _api.get(
      path,
      query: {'attemptId': attemptId, 'questionId': questionId, if (slot == 2) 'slot': '2'},
      options: const ApiOptions(receiveTimeout: Duration(seconds: 12)),
    );
    final parsed = CheckLoad.tryParse(res.data);
    if (parsed == null) throw const FormatException('fix_check_load');
    final j = asJson(res.data);
    final line = asString(j['heldLine'])?.trim();
    return FixCheckLoad(parsed, held: asBool(j['held']), heldLine: line == null || line.isEmpty ? null : line);
  }

  @override
  Future<FixCheckAnswer> submit({
    required String attemptId,
    required String questionId,
    required String checkQuestionId,
    required int pick,
    required String requestId,
    int slot = 1,
  }) async {
    final res = await _api.post(
      path,
      body: {
        'attemptId': attemptId,
        'questionId': questionId,
        'checkQuestionId': checkQuestionId,
        'pick': pick,
        'requestId': requestId,
        if (slot == 2) 'slot': 2,
      },
      options: const ApiOptions(receiveTimeout: Duration(seconds: 15)),
    );
    final parsed = FixCheckAnswer.tryParse(res.data);
    if (parsed == null) throw const FormatException('fix_check_answer');
    return parsed;
  }
}

final fixCheckApiProvider = Provider<FixCheckApi>((ref) => HttpFixCheckApi(ref.watch(apiClientProvider)));
