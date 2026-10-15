import '../../core/api/api_error.dart';

/// The app's own words around the Rule book and Across your mocks. Every rule, count and gate is
/// the server's sentence (the same words as the website); these are only the controls, the
/// loading and failure lines and what a screen reader hears. Sentence case, no "!".
abstract final class RulesCopy {
  /// The Rule book's title before the book has loaded (the server's own title replaces it).
  static const String title = 'Your rules';

  static const String copy = 'Copy';
  static const String copied = 'Copied';
  static String copySpoken(String rule) => 'Copy this rule: $rule';
  static const String copiedSpoken = 'Rule copied';

  /// While "Use in my next mock" waits for the server.
  static const String saving = 'Saving';

  /// What a screen reader hears once the server has confirmed the rule.
  static String usedSpoken(String rule) => 'Your rule for your next mock is now: $rule';

  /// The rule row's tap target, folded and open.
  static String rowSpoken(String rule, {required bool open}) => open ? '$rule. Hide the actions.' : '$rule. Show the actions.';

  static const String loadFailed = 'Your rules could not be loaded.';
  static const String tryAgain = 'Try again';
  static const String loading = 'Loading your rules';
  static const String acrossLoadFailed = 'Your record across mocks could not be loaded.';
  static const String offlineNotice = 'Offline. Showing last loaded rules.';

  /// "Use in my next mock" failed: nothing changed on the server.
  static String useFailed(Object error) {
    if (error is ApiError) {
      if (error.isOffline) return "You're offline, so your rule was not changed.";
      if (error.isRateLimited) return 'Too many changes in a minute. Try again shortly.';
      if (error.isDefinitiveRefusal) return 'That rule is not in your Rule book right now. Your rules have been read again.';
    }
    return 'Your rule was not saved. Try again.';
  }

  /// The Review row's quiet line when a rule is in force.
  static String activeNote(String rule) => 'Next mock: $rule';

  /// "Show all 5" when the server sent no label.
  static String showAll(int n) => 'Show all $n';

  /// The block's title before Across your mocks has loaded (the server's own title replaces it).
  static const String acrossTitle = 'Across your mocks';
}
