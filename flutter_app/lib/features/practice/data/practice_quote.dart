import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/practice_quote.dart';
import '../../../core/repositories/quote_repository.dart';
import '../model/practice_selection.dart';

/// One quote for one selection. Never cached across screens (it lives 60 seconds) and never
/// refreshed on a timer: the launch re-quotes when [PracticeQuote.isExpiredAt] says so.
///
/// On this server a quote can take many seconds, so screens show a skeleton only after 400 ms
/// and keep every control usable meanwhile.
final practiceQuoteProvider = FutureProvider.autoDispose.family<PracticeQuote, QuoteQuery>((ref, query) {
  return ref.watch(quoteRepositoryProvider).quote(subject: query.subject, mode: query.apiMode, count: query.count, purpose: query.purpose);
});

/// Asks the server for a fresh quote right now, bypassing the provider's value.
Future<PracticeQuote> requote(WidgetRef ref, QuoteQuery query) => ref.refresh(practiceQuoteProvider(query).future);
