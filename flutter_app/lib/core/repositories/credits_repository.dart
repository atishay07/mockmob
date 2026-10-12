import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/ai_credits.dart';
import '../models/json_helpers.dart';
import 'json_remote_notifier.dart';
import 'remote_state.dart';

/// `GET /api/ai/credits` (read only): the explanation wallet. A wallet whose balance is not
/// known is never shown as zero: use [AiCredits.explanationBalance], which is null then.
class CreditsRepository extends JsonRemoteNotifier<AiCredits> {
  @override
  String get cacheKey => 'ai-credits';

  @override
  AiCredits parse(Object? json) => AiCredits.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/ai/credits')).data;
}

final creditsRepositoryProvider = NotifierProvider<CreditsRepository, RemoteState<AiCredits>>(CreditsRepository.new);
