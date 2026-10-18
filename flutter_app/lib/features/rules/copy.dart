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

  /// The server's "Never opened, last 3 Business Studies mocks, oldest first: 49, 49 and 49 of 50."
  /// said as a finding: "You left 49 of 50 questions unopened in each of your last 3 Business Studies
  /// mocks." Marks that differ keep their order ("7, 6 and 4 of 50 ... oldest first"). Any sentence
  /// that does not have this shape is returned as the server wrote it.
  static String neverOpenedLine(String serverText) {
    final m = RegExp(r'^Never opened, last (\d+) (.+?) mocks?, oldest first: ([\d, and]+) of (\d+)\.$').firstMatch(serverText);
    if (m == null) return serverText;
    final mocks = int.parse(m.group(1)!);
    final subject = m.group(2)!;
    final counts = m.group(3)!.split(RegExp(r', | and ')).where((s) => s.isNotEmpty).toList();
    final of = m.group(4)!;
    if (counts.length != mocks || counts.any((c) => int.tryParse(c) == null)) return serverText;
    if (mocks == 1) return 'You left ${counts.single} of $of questions unopened in your last $subject mock.';
    if (counts.toSet().length == 1) return 'You left ${counts.first} of $of questions unopened in each of your last $mocks $subject mocks.';
    final list = counts.length <= 2 ? counts.join(' and ') : '${counts.sublist(0, counts.length - 1).join(', ')} and ${counts.last}';
    return 'In your last $mocks $subject mocks you left $list of $of questions unopened, oldest first.';
  }

  /// The block's title before Across your mocks has loaded (the server's own title replaces it).
  static const String acrossTitle = 'Across your mocks';

  /// Before the block opens, the plain line of the app instead of the one from the server ("... your first Full or
  /// NTA mock that your device records", fresh-account walk 19 Oct): no timed mock yet.
  static const String acrossNone = 'Sit your first Full mock to start this. It shows the habits that cost you marks from one mock to the next.';

  /// [left] more timed mocks open the block.
  static String acrossBelowGate(int left) => left == 1
      ? 'One more Full mock opens this. It compares your mocks to show the habits that cost you marks.'
      : '$left more Full mocks open this. It compares your mocks to show the habits that cost you marks.';

  /// A habit's Wilson interval in words (the same sentence as the website's Rule book band):
  /// "8 of 23 (35%). At this count, the 95% interval runs from 19% to 55%."
  static String intervalLine(int k, int n, int pct, int low, int high) =>
      '$k of $n ($pct%). At this count, the 95% interval runs from $low% to $high%.';

  // Traps you meet (slice 4, spec 4.11): the website's `traps.labels` and `traps.unavailable`.
  static const String trapsTitle = 'Traps you meet';
  static const String trapsOpen = 'Your traps across mocks';
  static const String trapsUnavailable = 'Your traps could not be loaded. Try again shortly.';
  static const String trapsLoading = 'Reading your answers';
  static String trapsHeadSpoken(String label, {required bool open}) => open ? '$label. Hide.' : '$label. Show.';
  static String trapBarSpoken(int caught, int of) => '$caught of $of';
}
