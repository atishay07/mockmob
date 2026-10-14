// Subject names and id normalisation for Today. Attempts carry internal ids and the profile
// carries public ids; for the subjects Today names they differ only in these aliases.

const Map<String, String> _aliases = {'business': 'business_studies', 'gat': 'general_test'};

const Map<String, String> _names = {
  'accountancy': 'Accountancy',
  'business_studies': 'Business Studies',
  'economics': 'Economics',
  'english': 'English',
  'general_test': 'General Test',
  'mathematics': 'Mathematics',
  'applied_mathematics': 'Applied Mathematics',
};

/// The public id for [id] (`business` becomes `business_studies`).
String canonicalSubject(String id) => _aliases[id] ?? id;

/// "Business Studies" for `business_studies` or `business`; a readable fallback otherwise.
String subjectName(String id) {
  final canonical = canonicalSubject(id);
  final known = _names[canonical];
  if (known != null) return known;
  if (canonical.isEmpty) return 'your subject';
  final words = canonical.split('_').where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return canonical;
  final first = words.first;
  return [first[0].toUpperCase() + first.substring(1), ...words.skip(1)].join(' ');
}
