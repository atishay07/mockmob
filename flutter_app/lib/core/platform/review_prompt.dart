import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';

import '../api/api_providers.dart' show nowProvider;
import 'native_prefs.dart';

/// A good moment to ask for a store review: the student just got something real.
enum ReviewMoment {
  /// A mistake repair finished with at least one mistake repaired.
  repairFinished,

  /// A result that held steady against the one before it.
  resultHeld,

  /// A result that improved on the one before it.
  resultImproved,
}

/// The system review dialog (Play in-app review). Swapped for a fake in tests.
abstract class ReviewRequester {
  Future<bool> isAvailable();
  Future<void> request();
}

class InAppReviewRequester implements ReviewRequester {
  const InAppReviewRequester();

  @override
  Future<bool> isAvailable() => InAppReview.instance.isAvailable();

  @override
  Future<void> request() => InAppReview.instance.requestReview();
}

final reviewRequesterProvider = Provider<ReviewRequester>((ref) => const InAppReviewRequester());

/// When a review may be asked for: never in the first 3 days, at most once in 60 days, never in
/// NTA mode, and only when the app knows when it was first opened.
abstract final class ReviewPromptPolicy {
  static const Duration quietAtStart = Duration(days: 3);
  static const Duration spacing = Duration(days: 60);

  static bool allows({required DateTime now, required DateTime? firstSeen, required DateTime? lastAsked, bool ntaMode = false}) {
    if (ntaMode) return false;
    if (firstSeen == null || now.difference(firstSeen) < quietAtStart) return false;
    if (lastAsked != null && now.difference(lastAsked) < spacing) return false;
    return true;
  }
}

/// Asks for a store review at a good moment, within [ReviewPromptPolicy]. Whether Google then
/// shows the dialog is up to Play (it has its own quota), so the ask is counted once it is made,
/// not once it is seen. Never throws.
class ReviewPrompt {
  ReviewPrompt({required this.prefs, required this.requester, required this.now});

  final NativePrefs prefs;
  final ReviewRequester requester;
  final DateTime Function() now;
  bool _busy = false;

  /// Returns true when the request was made. [ntaMode] is true on NTA-mode screens, where this
  /// never asks.
  Future<bool> maybeAsk(ReviewMoment moment, {bool ntaMode = false}) async {
    if (_busy || ntaMode) return false;
    _busy = true;
    try {
      final at = now();
      final allowed = ReviewPromptPolicy.allows(
        now: at,
        firstSeen: await prefs.firstSeen(),
        lastAsked: await prefs.reviewAskedAt(),
        ntaMode: ntaMode,
      );
      if (!allowed || !await requester.isAvailable()) return false;
      // Counted before the dialog so a crash or a repeat call can never ask twice.
      await prefs.setReviewAskedAt(at);
      await requester.request();
      return true;
    } on Object {
      return false;
    } finally {
      _busy = false;
    }
  }
}

final reviewPromptProvider = Provider<ReviewPrompt>(
  (ref) => ReviewPrompt(prefs: ref.watch(nativePrefsProvider), requester: ref.watch(reviewRequesterProvider), now: ref.watch(nowProvider)),
);
