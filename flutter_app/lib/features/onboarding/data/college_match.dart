/// The "Find a college" matcher of the onboarding ladder: a student types what they would say
/// aloud ("hans", "hansrj", "srcc", "lady shri ram") and the college is found.
///
/// There is one matcher for every college field of the app: the Colleges area's
/// `duMatchRank` (`features/tools/my_colleges/college_search.dart`, also exported by
/// `tools_routes.dart`). This file only applies it to the ladder's rows and keeps the ladder's own
/// order (highest figure first), so a search narrows the ladder and never reshuffles it.
library;

import '../../tools/my_colleges/college_search.dart';
import 'du_catalog.dart';

abstract final class CollegeMatch {
  /// Lower case, "&" as "and", every other mark and run of spaces as one space, trimmed.
  static String normalise(String s) => duNormalise(s);

  /// [normalise] without the spaces ("B.Com. (Hons.)" is "bcomhons").
  static String compact(String s) => duCompact(s);

  /// The query's words, with each alias expanded ("srcc" is shri, ram, college, of, commerce).
  static List<String> queryTokens(String query) => duQueryTokens(query);

  /// How well [query] matches [candidate] (and any of its [extra] names): 0 the best, null no
  /// match. See `duMatchRank`.
  static int? rank(String query, String candidate, {List<String> extra = const []}) => duMatchRank(query, candidate, extra: extra);

  /// The colleges of [rows] that [query] finds, in the order given (the ladder's: highest first).
  /// An empty query finds them all.
  static List<DuOffering> filter(List<DuOffering> rows, String query) {
    if (normalise(query).isEmpty) return rows;
    return [
      for (final o in rows)
        if (rank(query, o.college, extra: [o.short]) != null) o,
    ];
  }
}
