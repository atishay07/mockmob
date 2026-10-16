// One search matcher for every college and programme field of the Colleges area: the chooser,
// Compass's programme search, Combo's targets and onboarding's ladder. Students type "bcom",
// "B.Com", "b com" or "bcom hons" and all of them mean B.Com. (Hons.); a dropped letter
// ("hansrj") still finds Hansraj. Pure: tested without a phone.

/// Lower case, '&' as "and", punctuation as spaces, single spaces, trimmed.
String duNormalise(String s) => s
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAll(RegExp(r"[.()\[\],'’/\-:_]"), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

/// [duNormalise] without spaces ("bcomhons").
String duCompact(String s) => duNormalise(s).replaceAll(' ', '');

/// Whole query words that stand for longer ones. One table, unit tested.
const Map<String, String> duSearchAliases = {
  'bcom': 'b com',
  'ba': 'b a',
  'bsc': 'b sc',
  'hons': 'hons',
  'honours': 'hons',
  'honors': 'hons',
  'h': 'hons',
  'eco': 'economics',
  'econ': 'economics',
  'econs': 'economics',
  'polsci': 'political science',
  'pol': 'political',
  'psych': 'psychology',
  'psy': 'psychology',
  'eng': 'english',
  'math': 'mathematics',
  'maths': 'mathematics',
  'bms': 'bachelor of management studies',
  'bba': 'bba',
  'fia': 'financial investment analysis',
  'srcc': 'shri ram college of commerce',
  'lsr': 'lady shri ram college for women',
  'kmc': 'kirori mal college',
  'svc': 'sri venkateswara college',
  'jmc': 'jesus and mary college',
  'dcac': 'delhi college of arts and commerce',
  'sggscc': 'shri guru gobind singh college of commerce',
  'hrc': 'hansraj college',
};

/// The query's words after aliases ("bcom hons" -> b, com, hons).
List<String> duQueryTokens(String q) {
  final out = <String>[];
  for (final t in duNormalise(q).split(' ')) {
    if (t.isEmpty) continue;
    out.addAll((duSearchAliases[t] ?? t).split(' '));
  }
  return out;
}

List<String> _candidateTokens(String s) {
  final out = <String>[];
  for (final t in duNormalise(s).split(' ')) {
    if (t.isEmpty) continue;
    out.add(duSearchAliases[t] == 'hons' ? 'hons' : t);
  }
  return out;
}

/// How well [query] matches [candidate] (or one of its [extra] names): null for no match, lower
/// is better. 0: the candidate starts with the query (spaces and dots ignored); 1: contains it;
/// 2: every query word starts a candidate word; 3: every long query word is one slip away from a
/// candidate word (two at 8 letters or more), the short ones still start one.
int? duMatchRank(String query, String candidate, {List<String> extra = const []}) {
  final qc = duCompact(query);
  if (qc.isEmpty) return 0;
  int? best;
  for (final name in [candidate, ...extra]) {
    final r = _rank(query, qc, name);
    if (r != null && (best == null || r < best)) best = r;
    if (best == 0) break;
  }
  return best;
}

int? _rank(String query, String qc, String candidate) {
  final cc = duCompact(candidate);
  if (cc.isEmpty) return null;
  if (cc.startsWith(qc)) return 0;
  if (qc.length >= 3 && cc.contains(qc)) return 1;
  final qt = duQueryTokens(query);
  if (qt.isEmpty) return null;
  final ct = _candidateTokens(candidate);
  final aliased = duCompact(qt.join(' '));
  if (aliased != qc && cc.startsWith(aliased)) return 0;
  if (qt.every((q) => ct.any((c) => c.startsWith(q)))) return 2;
  final fuzzy = qt.every((q) {
    if (ct.any((c) => c.startsWith(q))) return true;
    if (q.length < 5) return false;
    final allowed = q.length >= 8 ? 2 : 1;
    // A slip inside a word, or across a space the student left out ("hans raj" / "hansrj").
    return ct.any((c) => _withinEdits(q, c, allowed) || (c.length > q.length && _withinEdits(q, c.substring(0, q.length), allowed))) ||
        _withinEdits(q, cc.length > q.length + allowed ? cc.substring(0, q.length + 1) : cc, allowed);
  });
  return fuzzy ? 3 : null;
}

/// Damerau (optimal string alignment) distance of at most [max].
bool _withinEdits(String a, String b, int max) {
  if ((a.length - b.length).abs() > max) return false;
  final n = a.length, m = b.length;
  var prev2 = List<int>.filled(m + 1, 0);
  var prev = List<int>.generate(m + 1, (j) => j);
  for (var i = 1; i <= n; i++) {
    final cur = List<int>.filled(m + 1, 0)..[0] = i;
    var rowMin = cur[0];
    for (var j = 1; j <= m; j++) {
      final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
      var v = [prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost].reduce((x, y) => x < y ? x : y);
      if (i > 1 && j > 1 && a.codeUnitAt(i - 1) == b.codeUnitAt(j - 2) && a.codeUnitAt(i - 2) == b.codeUnitAt(j - 1)) {
        final t = prev2[j - 2] + 1;
        if (t < v) v = t;
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[m] <= max;
}

/// [items] that match [query], best first; ties by [weight] (higher first), then name A to Z. An
/// empty query returns every item in the caller's order.
List<T> duSearch<T>(
  String query,
  List<T> items,
  String Function(T) name, {
  List<String> Function(T)? extra,
  int Function(T)? weight,
}) {
  if (duCompact(query).isEmpty) return List<T>.of(items);
  final scored = <(T, int)>[];
  for (final item in items) {
    final r = duMatchRank(query, name(item), extra: extra?.call(item) ?? const []);
    if (r != null) scored.add((item, r));
  }
  scored.sort((a, b) {
    final c = a.$2 - b.$2;
    if (c != 0) return c;
    if (weight != null) {
      final w = weight(b.$1) - weight(a.$1);
      if (w != 0) return w;
    }
    return name(a.$1).compareTo(name(b.$1));
  });
  return [for (final s in scored) s.$1];
}
