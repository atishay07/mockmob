/// The "Find a college" matcher of the onboarding ladder: a student types what they would say
/// aloud ("hans", "hansrj", "srcc", "lady shri ram") and the college is found.
///
/// Pure Dart. It follows the shared matcher the Colleges area specified (`app-tools-1016.md`
/// section 2.2: normalise punctuation and spacing, expand aliases, match word prefixes, allow a
/// small typo, rank the result), kept here until the shared one lands in `features/tools`, so the
/// onboarding does not wait on another area. The ranks and the alias table are the same, so a
/// later swap changes no behaviour.
library;

import 'du_catalog.dart';

abstract final class CollegeMatch {
  /// Lower case, "&" as "and", every other mark and run of spaces as one space, trimmed.
  static String normalise(String s) {
    final lower = s.toLowerCase().replaceAll('&', ' and ');
    return lower.replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
  }

  /// [normalise] without the spaces ("B.Com. (Hons.)" is "bcomhons").
  static String compact(String s) => normalise(s).replaceAll(' ', '');

  /// Whole query words a student types for something longer, expanded before matching.
  static const Map<String, List<String>> aliases = {
    'bcom': ['b', 'com'],
    'ba': ['b', 'a'],
    'bsc': ['b', 'sc'],
    'hons': ['hons'],
    'honours': ['hons'],
    'honors': ['hons'],
    'h': ['hons'],
    'eco': ['economics'],
    'econ': ['economics'],
    'econs': ['economics'],
    'polsci': ['political', 'science'],
    'pol': ['political'],
    'psych': ['psychology'],
    'psy': ['psychology'],
    'eng': ['english'],
    'math': ['mathematics'],
    'maths': ['mathematics'],
    'bms': ['bachelor', 'of', 'management', 'studies'],
    'srcc': ['shri', 'ram', 'college', 'of', 'commerce'],
    'lsr': ['lady', 'shri', 'ram', 'college', 'for', 'women'],
    'kmc': ['kirori', 'mal', 'college'],
    'svc': ['sri', 'venketeswara', 'college'],
    'jmc': ['jesus', 'and', 'mary', 'college'],
    'dcac': ['delhi', 'college', 'of', 'arts', 'and', 'commerce'],
    'sggscc': ['shri', 'guru', 'gobind', 'singh', 'college', 'of', 'commerce'],
    'hrc': ['hansraj', 'college'],
  };

  /// The query's words, with each alias expanded.
  static List<String> queryTokens(String query) {
    final out = <String>[];
    for (final word in normalise(query).split(' ')) {
      if (word.isEmpty) continue;
      out.addAll(aliases[word] ?? [word]);
    }
    return out;
  }

  /// How well [query] matches [candidate] (and any of its [extra] names): 0 the best, null no
  /// match. 0, the candidate starts with what was typed (spaces ignored); 1, it holds it; 2, every
  /// typed word starts a word of it; 3, every typed word of five letters or more is within one
  /// slip of a word of it (two from eight letters), and shorter words still start one.
  static int? rank(String query, String candidate, {List<String> extra = const []}) {
    final qc = compact(query);
    if (qc.isEmpty) return 0;
    final tokens = queryTokens(query);
    int? best;
    for (final name in [candidate, ...extra]) {
      final r = _rankOne(qc, tokens, name);
      if (r != null && (best == null || r < best)) best = r;
      if (best == 0) break;
    }
    return best;
  }

  static int? _rankOne(String qc, List<String> tokens, String name) {
    final cc = compact(name);
    if (cc.startsWith(qc)) return 0;
    if (cc.contains(qc)) return 1;
    final words = normalise(name).split(' ');
    if (tokens.every((t) => words.any((w) => w.startsWith(t)))) return 2;
    final typo = tokens.every((t) {
      if (words.any((w) => w.startsWith(t))) return true;
      if (t.length < 5) return false;
      final allowed = t.length >= 8 ? 2 : 1;
      return words.any((w) => _distance(t, w) <= allowed);
    });
    return typo ? 3 : null;
  }

  /// The colleges of [rows] that [query] finds, in the order given (the ladder's: highest first).
  /// An empty query finds them all.
  static List<DuOffering> filter(List<DuOffering> rows, String query) {
    if (normalise(query).isEmpty) return rows;
    return [
      for (final o in rows)
        if (rank(query, o.college, extra: [o.short]) != null) o,
    ];
  }

  /// Edits (one letter added, dropped, changed, or two side by side swapped) between [a] and [b].
  static int _distance(String a, String b) {
    if (a == b) return 0;
    if (a.isEmpty) return b.length;
    if (b.isEmpty) return a.length;
    final d = List.generate(a.length + 1, (i) => List<int>.filled(b.length + 1, 0));
    for (var i = 0; i <= a.length; i++) {
      d[i][0] = i;
    }
    for (var j = 0; j <= b.length; j++) {
      d[0][j] = j;
    }
    for (var i = 1; i <= a.length; i++) {
      for (var j = 1; j <= b.length; j++) {
        final cost = a[i - 1] == b[j - 1] ? 0 : 1;
        var v = [d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost].reduce((x, y) => x < y ? x : y);
        if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) {
          final t = d[i - 2][j - 2] + 1;
          if (t < v) v = t;
        }
        d[i][j] = v;
      }
    }
    return d[a.length][b.length];
  }
}
