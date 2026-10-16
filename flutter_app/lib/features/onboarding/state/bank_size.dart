import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';

/// How many questions the live bank holds, read from `GET /api/stats` (public: it needs no
/// account, so the save step can say it before sign-in). Null when the count cannot be read: the
/// line that quotes it then leaves the number out, and nothing is shown as zero.
final questionBankSizeProvider = FutureProvider.autoDispose<int?>((ref) async {
  try {
    final response = await ref.watch(apiClientProvider).get('/api/stats', options: const ApiOptions(authenticated: false, retries: 0));
    final n = asInt(response.map['bankSize']);
    return n != null && n > 0 ? n : null;
  } on ApiError {
    return null;
  }
});
