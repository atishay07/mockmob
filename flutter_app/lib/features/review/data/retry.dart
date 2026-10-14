import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/practice_quote.dart';
import '../../../core/models/subject.dart';
import '../../../core/repositories/quote_repository.dart';
import '../../../core/router/routes.dart';
import '../../practice/data/practice_catalog.dart';

/// The optional retry after a repair (spec 5.8): a separate Quick practice of 5 questions in
/// the same chapter, with its own quote, cost and receipt. Right or wrong in it never changes
/// the repair record.
const retryCount = 5;

/// What the retry offer shows.
sealed class RetryOffer {
  const RetryOffer();
}

/// The quote says it can start. [cost] is null when the quote did not say.
class RetryAvailable extends RetryOffer {
  const RetryAvailable({required this.subjectId, this.cost, this.free = false});

  final String subjectId;
  final int? cost;
  final bool free;
}

/// Not enough practice credits: the retry key is replaced.
class RetryShortOfCredits extends RetryOffer {
  const RetryShortOfCredits();
}

/// Offline, no access, no questions: nothing is offered.
class RetryHidden extends RetryOffer {
  const RetryHidden();
}

/// The public subject id for an attempt's internal id (`GET /api/subjects`), or the id itself.
Future<String> publicSubjectId(Ref ref, String internalId) async {
  try {
    final subjects = await ref.read(practiceSubjectsProvider.future);
    for (final Subject s in subjects) {
      if (s.internalId == internalId || s.id == internalId) return s.id;
    }
  } on Object {
    // Fall through to the attempt's own id.
  }
  return internalId;
}

/// The retry offer for an internal subject id, quoted once per screen.
final retryOfferProvider = FutureProvider.autoDispose.family<RetryOffer, String>((ref, internalSubject) async {
  try {
    final subject = await publicSubjectId(ref, internalSubject);
    final PracticeQuote quote = await ref.read(quoteRepositoryProvider).quote(subject: subject, mode: 'quick', count: retryCount);
    if (quote.isInsufficientCredits) return const RetryShortOfCredits();
    if (!quote.launchable) return const RetryHidden();
    return RetryAvailable(subjectId: subject, cost: quote.creditCost, free: quote.freeByAllowance);
  } on Object {
    return const RetryHidden();
  }
});

/// The practice setup route for the retry: chapter practice, 5 questions. The setup screen
/// shows the cost on its confirm sheet before anything is spent.
String retryRoute(String subjectId, String chapter) => Uri(
  path: AppRoutes.practiceSetup('chapter'),
  queryParameters: {'subject': subjectId, 'chapter': chapter, 'count': '$retryCount'},
).toString();
