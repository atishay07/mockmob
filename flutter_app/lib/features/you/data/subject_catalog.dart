// The subjects a student can put on their profile, for the subjects editor: every subject the
// registry offers for practice (`GET /api/subjects`, `practice == supported`), grouped the way
// students think of them, with the server's own reason for any saved subject practice cannot
// open.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/subject.dart' show isHiddenSubject;

/// Short proper names of the 15 practice subjects, keyed by public id. The registry's official
/// names can be long ("Computer Science / Informatics Practices"); these read on one line.
const Map<String, String> youSubjectNames = {
  'english': 'English',
  'general_test': 'General Test',
  'accountancy': 'Accountancy',
  'business_studies': 'Business Studies',
  'economics': 'Economics',
  'mathematics': 'Mathematics',
  'physics': 'Physics',
  'chemistry': 'Chemistry',
  'biology': 'Biology',
  'computer_science': 'Computer Science',
  'history': 'History',
  'political_science': 'Political Science',
  'geography': 'Geography',
  'psychology': 'Psychology',
  'sociology': 'Sociology',
};

/// The groups of the subjects editor, in a fixed order (the language and General Test first).
enum SubjectGroup {
  core('Language and General Test'),
  commerce('Commerce'),
  science('Science and Maths'),
  humanities('Humanities'),
  other('Other subjects');

  const SubjectGroup(this.label);

  final String label;

  static SubjectGroup of(String id) => switch (id) {
        'english' || 'general_test' || 'gat' => core,
        'accountancy' || 'business_studies' || 'economics' => commerce,
        'mathematics' || 'physics' || 'chemistry' || 'biology' || 'computer_science' => science,
        'history' || 'political_science' || 'geography' || 'psychology' || 'sociology' => humanities,
        _ => other,
      };
}

/// The stream word for the student's own subjects, for a label such as "CUET UG 2027, Science", or
/// null when the subjects do not say (none yet, or only subjects every stream takes). Never a
/// default: a science student is never called a Commerce student (owner, 19 Oct, I12).
///
/// Accountancy and Business Studies mark Commerce; Physics, Chemistry, Biology and Computer Science
/// mark Science; History, Political Science, Geography, Psychology and Sociology mark Humanities.
/// Economics and Mathematics are taken in more than one stream, so they mark none. Subjects from
/// two or more streams read "Mixed subjects".
String? streamWordFor(Iterable<String> subjectIds) {
  final streams = <String>{
    for (final id in subjectIds)
      ?switch (id) {
        'accountancy' || 'business_studies' => 'Commerce',
        'physics' || 'chemistry' || 'biology' || 'computer_science' => 'Science',
        'history' || 'political_science' || 'geography' || 'psychology' || 'sociology' => 'Humanities',
        _ => null,
      },
  };
  if (streams.isEmpty) return null;
  return streams.length == 1 ? streams.first : 'Mixed subjects';
}

/// One subject the student may choose, or one they hold that practice cannot open.
class SubjectOption {
  const SubjectOption({required this.id, required this.name, this.supported = true, this.reason});

  /// Public id: what `PATCH /api/users/{id}` takes.
  final String id;
  final String name;

  /// `practice == supported` in the registry.
  final bool supported;

  /// The registry's `practiceReason` for an unsupported subject.
  final String? reason;
}

/// What the editor lists: the registry's answer, or the known 15 when it could not be read.
class SubjectCatalog {
  const SubjectCatalog({required this.options, this.fromRegistry = true});

  /// The 15 practice subjects, used when the registry cannot be reached. The server still
  /// checks every id on save.
  static final SubjectCatalog fallback = SubjectCatalog(
    options: [for (final e in youSubjectNames.entries) SubjectOption(id: e.key, name: e.value)],
    fromRegistry: false,
  );

  final List<SubjectOption> options;

  /// False when this is [fallback].
  final bool fromRegistry;

  List<SubjectOption> get supported => [for (final o in options) if (o.supported) o];

  SubjectOption? byId(String id) {
    for (final o in options) {
      if (o.id == id) return o;
    }
    return null;
  }

  /// The supported subjects of [group], in the registry's order.
  List<SubjectOption> inGroup(SubjectGroup group) => [for (final o in supported) if (SubjectGroup.of(o.id) == group) o];
}

/// `GET /api/subjects` (public). A failure gives [SubjectCatalog.fallback], never an error, so
/// the editor always has a list; the screen says when it is the fallback.
final youSubjectCatalogProvider = FutureProvider.autoDispose<SubjectCatalog>((ref) async {
  try {
    final response = await ref.watch(apiClientProvider).get('/api/subjects', options: const ApiOptions(authenticated: false));
    final options = <SubjectOption>[
      for (final j in asJsonList(response.data))
        if (asStringOr(j['id'], '').isNotEmpty && asString(j['practice']) != 'merged' && !isHiddenSubject(asString(j['id'])))
          SubjectOption(
            id: asStringOr(j['id'], ''),
            name: youSubjectNames[asStringOr(j['id'], '')] ?? asStringOr(j['name'], asStringOr(j['id'], '')),
            supported: asString(j['practice']) == 'supported',
            reason: asString(j['practiceReason']),
          ),
    ];
    if (!options.any((o) => o.supported)) return SubjectCatalog.fallback;
    return SubjectCatalog(options: options);
  } on Object {
    return SubjectCatalog.fallback;
  }
});
