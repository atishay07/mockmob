// Names for every subject the server supports. Attempts carry internal ids (`gat`, `business`);
// the API takes public ids. Unknown ids read as a tidy title, never as raw snake case.

const Map<String, String> _aliases = {'business': 'business_studies', 'gat': 'general_test', 'bst': 'business_studies'};

const Map<String, String> _names = {
  'english': 'English',
  'general_test': 'General Test',
  'accountancy': 'Accountancy',
  'business_studies': 'Business Studies',
  'economics': 'Economics',
  'mathematics': 'Mathematics',
  'physics': 'Physics',
  'chemistry': 'Chemistry',
  'biology': 'Biology',
  'history': 'History',
  'political_science': 'Political Science',
  'geography': 'Geography',
  'psychology': 'Psychology',
  'sociology': 'Sociology',
  'computer_science': 'Computer Science',
};

/// The public id for an internal or public subject id.
String canonicalSubjectId(String id) => _aliases[id] ?? id;

String subjectDisplayName(String id) {
  final canonical = canonicalSubjectId(id);
  final known = _names[canonical];
  if (known != null) return known;
  final words = canonical.split('_').where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return 'Practice';
  return words.map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');
}

const Set<String> _languages = {
  'hindi', 'sanskrit', 'bengali', 'tamil', 'telugu', 'kannada', 'malayalam', 'marathi', 'gujarati',
  'odia', 'punjabi', 'assamese', 'urdu', 'french', 'german', 'spanish', 'japanese', 'russian',
  'chinese', 'persian', 'arabic', 'italian', 'nepali', 'tibetan', 'sindhi', 'kashmiri', 'konkani',
  'bodo', 'dogri', 'maithili', 'manipuri', 'santhali',
};

/// A subject this build has its own name and art for.
bool isKnownSubject(String id) => _names.containsKey(canonicalSubjectId(id.trim().toLowerCase()));

/// A language paper: these share the open notebook art and the "translate" glyph.
bool isLanguageSubject(String id) => _languages.contains(id.trim().toLowerCase());
