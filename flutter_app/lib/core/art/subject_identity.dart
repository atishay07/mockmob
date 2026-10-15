import 'package:flutter/widgets.dart';

import '../theme/light_fields.dart';

/// Which of the drawn objects a subject wears. [other] has no object: its emblem shows the
/// subject's initials on its tile, never a wrong object.
enum EmblemKind {
  accountancy,
  businessStudies,
  economics,
  english,
  generalTest,
  mathematics,
  physics,
  chemistry,
  biology,
  history,
  politicalScience,
  geography,
  psychology,
  sociology,
  computerScience,
  language,
  // The thirteen subjects added on 15 Oct 2026 (production `questions` with status live): each has
  // its own lit object in `assets/art/obj-*.webp`, so none shows an initials card any more.
  environmentalStudies,
  massMedia,
  homeScience,
  physicalEducation,
  legalStudies,
  knowledgeTradition,
  anthropology,
  fineArts,
  performingArts,
  engineeringGraphics,
  entrepreneurship,
  agriculture,
  teachingAptitude,
  other,
}

/// A subject's identity in the art system: its name, its light field (brief section 3) and its
/// form ink.
///
/// Form ink is the colour a real OMR sheet is printed in: the scanner ignores it, so only the
/// student's marks count. Each subject's sheet is printed in its own quiet ink, and the only
/// bright thing on any screen stays the student's volt mark. Form ink is line work and art only:
/// the printed grid, the object's coloured parts, a 3 dp edge or a 24 dp chip ring. Never a
/// button, a fill behind text, a gradient or a text colour.
@immutable
class SubjectIdentity {
  const SubjectIdentity._({
    required this.id,
    required this.kind,
    required this.name,
    required this.short,
    required this.light,
    required this.inkNight,
    required this.inkDay,
    required this.deepNight,
    required this.deepDay,
    required this.phase,
  });

  /// The canonical public id (`business_studies`), or `language` for the language papers, or
  /// the id as given for a subject the art does not know.
  final String id;
  final EmblemKind kind;

  /// Display name in sentence case as the API spells it ("Business Studies").
  final String name;

  /// A short name for chips and tight rows ("BST", "Pol Sci").
  final String short;

  /// The subject's light field: low-saturation colour behind art only.
  final SubjectLight light;

  /// Form inks per theme; prefer [formInk] and [formInkDeep].
  final Color inkNight;
  final Color inkDay;
  final Color deepNight;
  final Color deepDay;

  /// Where this subject's idle drift starts in its 7.2 s cycle (0 to 1), so a row of emblems
  /// never moves together.
  final double phase;

  /// True when a drawn object exists (every subject but [EmblemKind.other]).
  bool get hasEmblem => kind != EmblemKind.other;

  /// The form ink: light on Night (it is printed on a dark sheet), deep on Daylight.
  Color formInk(Brightness brightness) => brightness == Brightness.dark ? inkNight : inkDay;

  /// The deep form ink: what the object's printed detail and shadows are drawn in.
  Color formInkDeep(Brightness brightness) => brightness == Brightness.dark ? deepNight : deepDay;

  /// The subject's light field colour for [brightness].
  Color field(Brightness brightness) => light.of(brightness);

  /// The fifteen CUET UG subjects the app teaches, in the order the gallery shows them.
  static const List<SubjectIdentity> subjects = [
    _accountancy,
    _business,
    _economics,
    _english,
    _generalTest,
    _mathematics,
    _physics,
    _chemistry,
    _biology,
    _history,
    _politicalScience,
    _geography,
    _psychology,
    _sociology,
    _computerScience,
  ];

  /// The identity the CUET language papers other than English share.
  static const SubjectIdentity language = _language;

  /// The thirteen other subjects that have live questions, largest question bank first. They share
  /// the language paper's light field (the tinted field behind art lives in `core/theme`); their
  /// object and their form ink are their own.
  static const List<SubjectIdentity> moreSubjects = [
    _environmentalStudies,
    _massMedia,
    _homeScience,
    _physicalEducation,
    _legalStudies,
    _knowledgeTradition,
    _anthropology,
    _fineArts,
    _performingArts,
    _engineeringGraphics,
    _entrepreneurship,
    _agriculture,
    _teachingAptitude,
  ];

  /// Every subject with an object of its own: the fifteen, then the thirteen more.
  static const List<SubjectIdentity> withObjects = [...subjects, ...moreSubjects];

  /// Maps any subject id the app meets (`business_studies`, `business`, `gat`, `maths`, `hindi`,
  /// spaces or hyphens instead of underscores, any case) to its identity. Null only for no id.
  static SubjectIdentity? of(String? subjectId) {
    final raw = subjectId?.trim().toLowerCase() ?? '';
    if (raw.isEmpty) return null;
    final id = raw.replaceAll(RegExp(r'[\s-]+'), '_');
    final known = switch (id) {
      'accountancy' || 'accounts' || 'accounting' => _accountancy,
      'business_studies' || 'business' || 'bst' => _business,
      'economics' || 'eco' => _economics,
      'english' => _english,
      'general_test' || 'gat' || 'gt' || 'general_aptitude_test' => _generalTest,
      'mathematics' || 'applied_mathematics' || 'maths' || 'math' || 'mathematics_applied_mathematics' => _mathematics,
      'physics' => _physics,
      'chemistry' => _chemistry,
      'biology' || 'biological_studies' => _biology,
      'history' => _history,
      'political_science' || 'pol_sci' || 'polity' => _politicalScience,
      'geography' || 'geography_geology' => _geography,
      'psychology' => _psychology,
      'sociology' => _sociology,
      'computer_science' || 'informatics_practices' || 'computer_science_informatics_practices' || 'cs' => _computerScience,
      'environmental_studies' || 'environmental_science' || 'evs' => _environmentalStudies,
      'mass_media' || 'mass_communication' || 'mass_media_mass_communication' => _massMedia,
      'home_science' => _homeScience,
      'physical_education' || 'physical_education_yoga_sports' => _physicalEducation,
      'legal_studies' => _legalStudies,
      'knowledge_tradition_india' || 'knowledge_tradition' || 'knowledge_tradition_practices_in_india' => _knowledgeTradition,
      'anthropology' => _anthropology,
      'fine_arts' || 'visual_arts' || 'fine_arts_visual_arts' || 'fine_arts_visual_arts_commercial_arts' => _fineArts,
      'performing_arts' || 'performing_arts_dance_drama_and_music' => _performingArts,
      'engineering_graphics' => _engineeringGraphics,
      'entrepreneurship' => _entrepreneurship,
      'agriculture' => _agriculture,
      'teaching_aptitude' => _teachingAptitude,
      _ => null,
    };
    if (known != null) return known;
    if (languagePaperIds.contains(id)) return _language;
    return SubjectIdentity._(
      id: id,
      kind: EmblemKind.other,
      name: _titleCase(id),
      short: _titleCase(id),
      light: SubjectLight.language,
      inkNight: _language.inkNight,
      inkDay: _language.inkDay,
      deepNight: _language.deepNight,
      deepDay: _language.deepDay,
      phase: 0.5,
    );
  }

  /// The initials an emblem without an object shows: "Ph" for one word, "FA" for two.
  static String monogram(String? subjectId) {
    final words = (subjectId ?? '').trim().split(RegExp(r'[\s_-]+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '';
    // Count characters, not UTF-16 units: an id that starts with an emoji or an accented
    // letter must not be cut through the middle of it.
    String first(String w) => w.characters.first;
    if (words.length == 1) {
      final letters = words.first.characters;
      return letters.length == 1 ? first(words.first).toUpperCase() : first(words.first).toUpperCase() + letters.skip(1).first.toLowerCase();
    }
    return (first(words[0]) + first(words[1])).toUpperCase();
  }

  static String _titleCase(String id) {
    final words = id.split('_').where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return id;
    final first = words.first;
    return [first[0].toUpperCase() + first.substring(1), ...words.skip(1)].join(' ');
  }

  @override
  bool operator ==(Object other) => other is SubjectIdentity && other.id == id && other.kind == kind;

  @override
  int get hashCode => Object.hash(id, kind);

  @override
  String toString() => 'SubjectIdentity($id)';
}

/// The CUET UG language papers other than English. They share the language emblem.
const Set<String> languagePaperIds = {
  'hindi', 'assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', //
  'punjabi', 'tamil', 'telugu', 'urdu', 'sanskrit', 'arabic', 'bodo', 'chinese', 'dogri', //
  'french', 'german', 'italian', 'japanese', 'kashmiri', 'konkani', 'maithili', 'manipuri', //
  'nepali', 'persian', 'russian', 'santhali', 'sindhi', 'spanish', 'tibetan', 'language',
};

// Form inks. Night inks are light (printed on a dark sheet, about 6:1 on their field); day
// inks are deep (about 5:1 on warm paper). Deep inks carry the object's printed detail.
const _accountancy = SubjectIdentity._(
  id: 'accountancy',
  kind: EmblemKind.accountancy,
  name: 'Accountancy',
  short: 'Accounts',
  light: SubjectLight.accountancy,
  inkNight: Color(0xFFD9A55B),
  inkDay: Color(0xFF9C6514),
  deepNight: Color(0xFF6B4614),
  deepDay: Color(0xFF5A3806),
  phase: 0.00,
);
const _business = SubjectIdentity._(
  id: 'business_studies',
  kind: EmblemKind.businessStudies,
  name: 'Business Studies',
  short: 'BST',
  light: SubjectLight.businessStudies,
  inkNight: Color(0xFF93A3DB),
  inkDay: Color(0xFF3D5299),
  deepNight: Color(0xFF26346A),
  deepDay: Color(0xFF1D2A5C),
  phase: 0.137,
);
const _economics = SubjectIdentity._(
  id: 'economics',
  kind: EmblemKind.economics,
  name: 'Economics',
  short: 'Eco',
  light: SubjectLight.economics,
  inkNight: Color(0xFF6FC4B7),
  inkDay: Color(0xFF1F7A6E),
  deepNight: Color(0xFF15524B),
  deepDay: Color(0xFF0E443D),
  phase: 0.274,
);
const _english = SubjectIdentity._(
  id: 'english',
  kind: EmblemKind.english,
  name: 'English',
  short: 'English',
  light: SubjectLight.english,
  inkNight: Color(0xFFDE8FAC),
  inkDay: Color(0xFFA13A62),
  deepNight: Color(0xFF6A2140),
  deepDay: Color(0xFF5C1834),
  phase: 0.411,
);
const _generalTest = SubjectIdentity._(
  id: 'general_test',
  kind: EmblemKind.generalTest,
  name: 'General Test',
  short: 'GT',
  light: SubjectLight.generalTest,
  inkNight: Color(0xFFB1C774),
  inkDay: Color(0xFF5C7A1E),
  deepNight: Color(0xFF3D5418),
  deepDay: Color(0xFF33460E),
  phase: 0.548,
);
const _mathematics = SubjectIdentity._(
  id: 'mathematics',
  kind: EmblemKind.mathematics,
  name: 'Mathematics',
  short: 'Maths',
  light: SubjectLight.mathematics,
  inkNight: Color(0xFF93AACD),
  inkDay: Color(0xFF3E5D8C),
  deepNight: Color(0xFF293E62),
  deepDay: Color(0xFF1F3352),
  phase: 0.685,
);
const _physics = SubjectIdentity._(
  id: 'physics',
  kind: EmblemKind.physics,
  name: 'Physics',
  short: 'Physics',
  light: SubjectLight.physics,
  inkNight: Color(0xFFAE9CE0),
  inkDay: Color(0xFF5B48A3),
  deepNight: Color(0xFF3D2F78),
  deepDay: Color(0xFF2F2463),
  phase: 0.822,
);
const _chemistry = SubjectIdentity._(
  id: 'chemistry',
  kind: EmblemKind.chemistry,
  name: 'Chemistry',
  short: 'Chemistry',
  light: SubjectLight.chemistry,
  inkNight: Color(0xFF66C5B2),
  inkDay: Color(0xFF1B7C6B),
  deepNight: Color(0xFF0F5248),
  deepDay: Color(0xFF0B4339),
  phase: 0.959,
);
const _biology = SubjectIdentity._(
  id: 'biology',
  kind: EmblemKind.biology,
  name: 'Biology',
  short: 'Biology',
  light: SubjectLight.biology,
  inkNight: Color(0xFF93C26C),
  inkDay: Color(0xFF46802A),
  deepNight: Color(0xFF2E5418),
  deepDay: Color(0xFF234515),
  phase: 0.096,
);
const _history = SubjectIdentity._(
  id: 'history',
  kind: EmblemKind.history,
  name: 'History',
  short: 'History',
  light: SubjectLight.history,
  inkNight: Color(0xFFD9A076),
  inkDay: Color(0xFF9A5526),
  deepNight: Color(0xFF6A3A18),
  deepDay: Color(0xFF55290D),
  phase: 0.233,
);
const _politicalScience = SubjectIdentity._(
  id: 'political_science',
  kind: EmblemKind.politicalScience,
  name: 'Political Science',
  short: 'Pol Sci',
  light: SubjectLight.politicalScience,
  inkNight: Color(0xFFDE8F93),
  inkDay: Color(0xFFA2363E),
  deepNight: Color(0xFF6E2328),
  deepDay: Color(0xFF5A161B),
  phase: 0.37,
);
const _geography = SubjectIdentity._(
  id: 'geography',
  kind: EmblemKind.geography,
  name: 'Geography',
  short: 'Geography',
  light: SubjectLight.geography,
  inkNight: Color(0xFF76B6DA),
  inkDay: Color(0xFF22709C),
  deepNight: Color(0xFF154A6B),
  deepDay: Color(0xFF0F3C57),
  phase: 0.507,
);
const _psychology = SubjectIdentity._(
  id: 'psychology',
  kind: EmblemKind.psychology,
  name: 'Psychology',
  short: 'Psychology',
  light: SubjectLight.psychology,
  inkNight: Color(0xFFC99AD0),
  inkDay: Color(0xFF7D4389),
  deepNight: Color(0xFF552C5E),
  deepDay: Color(0xFF43204B),
  phase: 0.644,
);
const _sociology = SubjectIdentity._(
  id: 'sociology',
  kind: EmblemKind.sociology,
  name: 'Sociology',
  short: 'Sociology',
  light: SubjectLight.sociology,
  inkNight: Color(0xFFD3B464),
  inkDay: Color(0xFF8E6D14),
  deepNight: Color(0xFF5E4710),
  deepDay: Color(0xFF4D3A06),
  phase: 0.781,
);
const _computerScience = SubjectIdentity._(
  id: 'computer_science',
  kind: EmblemKind.computerScience,
  name: 'Computer Science',
  short: 'CS',
  light: SubjectLight.computerScience,
  inkNight: Color(0xFF7BC594),
  inkDay: Color(0xFF2A7A44),
  deepNight: Color(0xFF1B5430),
  deepDay: Color(0xFF123F22),
  phase: 0.918,
);
const _language = SubjectIdentity._(
  id: 'language',
  kind: EmblemKind.language,
  name: 'Language',
  short: 'Language',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.055,
);

// The thirteen subjects added on 15 Oct 2026. Their object is their colour, so the ink and the light
// field stay the shared language sepia that a subject without art has always had: the only place an ink
// shows is the 24 dp initials card, and it keeps its look. Each has its own idle phase, so a row of
// them never floats together. (Per-subject inks and fields belong with `core/theme/light_fields.dart`.)
const _environmentalStudies = SubjectIdentity._(
  id: 'environmental_studies',
  kind: EmblemKind.environmentalStudies,
  name: 'Environmental Studies',
  short: 'EVS',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.030,
);
const _massMedia = SubjectIdentity._(
  id: 'mass_media',
  kind: EmblemKind.massMedia,
  name: 'Mass Media',
  short: 'Media',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.110,
);
const _homeScience = SubjectIdentity._(
  id: 'home_science',
  kind: EmblemKind.homeScience,
  name: 'Home Science',
  short: 'Home sci',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.190,
);
const _physicalEducation = SubjectIdentity._(
  id: 'physical_education',
  kind: EmblemKind.physicalEducation,
  name: 'Physical Education',
  short: 'PE',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.255,
);
const _legalStudies = SubjectIdentity._(
  id: 'legal_studies',
  kind: EmblemKind.legalStudies,
  name: 'Legal Studies',
  short: 'Law',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.350,
);
const _knowledgeTradition = SubjectIdentity._(
  id: 'knowledge_tradition_india',
  kind: EmblemKind.knowledgeTradition,
  name: 'Knowledge Tradition of India',
  short: 'KTI',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.430,
);
const _anthropology = SubjectIdentity._(
  id: 'anthropology',
  kind: EmblemKind.anthropology,
  name: 'Anthropology',
  short: 'Anthro',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.570,
);
const _fineArts = SubjectIdentity._(
  id: 'fine_arts',
  kind: EmblemKind.fineArts,
  name: 'Fine Arts',
  short: 'Fine arts',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.610,
);
const _performingArts = SubjectIdentity._(
  id: 'performing_arts',
  kind: EmblemKind.performingArts,
  name: 'Performing Arts',
  short: 'Perf arts',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.700,
);
const _engineeringGraphics = SubjectIdentity._(
  id: 'engineering_graphics',
  kind: EmblemKind.engineeringGraphics,
  name: 'Engineering Graphics',
  short: 'EG',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.750,
);
const _entrepreneurship = SubjectIdentity._(
  id: 'entrepreneurship',
  kind: EmblemKind.entrepreneurship,
  name: 'Entrepreneurship',
  short: 'Entre',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.840,
);
const _agriculture = SubjectIdentity._(
  id: 'agriculture',
  kind: EmblemKind.agriculture,
  name: 'Agriculture',
  short: 'Agri',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.890,
);
const _teachingAptitude = SubjectIdentity._(
  id: 'teaching_aptitude',
  kind: EmblemKind.teachingAptitude,
  name: 'Teaching Aptitude',
  short: 'Teaching',
  light: SubjectLight.language,
  inkNight: Color(0xFFCDAC84),
  inkDay: Color(0xFF7E603A),
  deepNight: Color(0xFF5A4126),
  deepDay: Color(0xFF44321A),
  phase: 0.990,
);
