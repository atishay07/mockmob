const Map<String, String> _names = {
  'accountancy': 'Accountancy',
  'business_studies': 'Business Studies',
  'business': 'Business Studies',
  'economics': 'Economics',
  'english': 'English',
  'gat': 'General Test',
  'general_test': 'General Test',
  'mathematics': 'Mathematics',
  'maths': 'Mathematics',
};

/// Display name for an attempt-side subject id. Unknown ids read as words ("legal_studies"
/// becomes "Legal studies").
String subjectDisplayName(String id) {
  final known = _names[id];
  if (known != null) return known;
  final words = id.replaceAll('_', ' ').trim();
  return words.isEmpty ? 'Mock' : words[0].toUpperCase() + words.substring(1);
}

/// Public subject id for routes (`gat` is `general_test` outside attempts).
String publicSubjectId(String id) => id == 'gat' ? 'general_test' : id;
