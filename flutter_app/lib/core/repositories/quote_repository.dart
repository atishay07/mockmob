import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_providers.dart';
import '../models/practice_quote.dart';

/// `GET /api/practice/quote`: what a practice session would cost, with no side effects.
/// A blocked quote still arrives as HTTP 200 with `launchable:false`, so read [PracticeQuote]
/// rather than catching errors. Never cached: it lives 60 seconds (`expiresAt`).
class QuoteRepository {
  QuoteRepository(this._api);

  final ApiClient _api;

  /// [mode] is `quick`, `full`, `nta` or `smart`. [purpose] is `baseline` or `full_sample` for
  /// the free first-use allowances, null for ordinary practice. Chapter practice costs the same
  /// as Quick practice, so the quote takes no chapter.
  Future<PracticeQuote> quote({
    required String subject,
    required String mode,
    int? count,
    String? purpose,
  }) async {
    final response = await _api.get('/api/practice/quote', query: {
      'subject': subject,
      'mode': mode,
      'count': ?count,
      'purpose': ?purpose,
    });
    return PracticeQuote.fromJson(response.map);
  }
}

final quoteRepositoryProvider = Provider<QuoteRepository>((ref) => QuoteRepository(ref.watch(apiClientProvider)));
