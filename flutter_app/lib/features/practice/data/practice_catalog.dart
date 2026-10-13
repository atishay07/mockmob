import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/attempts_repository.dart';

/// The commerce launch subjects with their names, used until `GET /api/subjects` answers (and
/// when it cannot), so the chips never wait on the network.
const Map<String, String> fallbackSubjectNames = {
  'english': 'English',
  'accountancy': 'Accountancy',
  'business_studies': 'Business Studies',
  'economics': 'Economics',
};

/// A subject as a chip: public id and display name.
class SubjectChoice {
  const SubjectChoice(this.id, this.name);

  final String id;
  final String name;

  @override
  bool operator ==(Object other) => other is SubjectChoice && other.id == id && other.name == name;

  @override
  int get hashCode => Object.hash(id, name);
}

/// A slim row of `GET /api/attempts/summary`: only what mock numbering needs.
class AttemptSummary {
  const AttemptSummary({required this.id, required this.subject, required this.mode});

  factory AttemptSummary.fromJson(Json j) =>
      AttemptSummary(id: asStringOr(j['id'], ''), subject: asStringOr(j['subject'], ''), mode: asString(j['mode']));

  final String id;

  /// Internal subject id (compare with `Subject.internalId`).
  final String subject;
  final String? mode;

  bool get isMock => mode == 'full' || mode == 'nta';
}

/// The reads this feature makes that core has no repository for: subjects, chapters and the
/// slim attempts list. Behind a class so tests and goldens replace it.
class PracticeCatalogApi {
  PracticeCatalogApi(this._api);

  final ApiClient _api;

  /// `GET /api/subjects`: public. Only supported subjects are returned.
  Future<List<Subject>> subjects() async {
    final response = await _api.get('/api/subjects', options: const ApiOptions(authenticated: false));
    return [for (final j in asJsonList(response.data)) Subject.fromJson(j)].where((s) => s.isSupported && s.id.isNotEmpty).toList();
  }

  /// `GET /api/chapters?subject=`: public.
  Future<ChapterCatalog> chapters(String subjectId) async {
    final response = await _api.get('/api/chapters', query: {'subject': subjectId}, options: const ApiOptions(authenticated: false));
    return ChapterCatalog.fromJson(response.map);
  }

  /// The student's attempts, newest first, read page by page (`limit` 50). Stops after
  /// [maxPages] so a very long history never blocks starting a mock.
  Future<List<AttemptSummary>> attemptSummaries({int maxPages = 8}) async {
    final out = <AttemptSummary>[];
    String? cursor;
    for (var page = 0; page < maxPages; page++) {
      final response = await _api.get('/api/attempts/summary', query: {'limit': '50', 'cursor': ?cursor});
      final body = response.map;
      out.addAll(asJsonList(body['items']).map(AttemptSummary.fromJson));
      cursor = asString(body['nextCursor']);
      if (cursor == null || cursor.isEmpty) break;
    }
    return out;
  }
}

final practiceCatalogApiProvider = Provider<PracticeCatalogApi>((ref) => PracticeCatalogApi(ref.watch(apiClientProvider)));

/// Supported subjects, read once per app run.
final practiceSubjectsProvider = FutureProvider<List<Subject>>((ref) => ref.watch(practiceCatalogApiProvider).subjects());

/// The chapters of one subject, for the chapter picker.
final practiceChaptersProvider = FutureProvider.autoDispose.family<ChapterCatalog, String>((ref, subjectId) async {
  try {
    return await ref.watch(practiceCatalogApiProvider).chapters(subjectId);
  } on ApiError {
    // The subject list carries the same names; use it when the chapters route is unreachable.
    final subjects = await ref.watch(practiceSubjectsProvider.future).catchError((_) => const <Subject>[]);
    for (final s in subjects) {
      if (s.id == subjectId && s.chapters.isNotEmpty) {
        return ChapterCatalog(
          units: [
            ChapterUnit(
              id: '',
              name: '',
              chapters: [for (var i = 0; i < s.chapters.length; i++) ChapterEntry(id: s.chapters[i], name: s.chapters[i], sortOrder: i)],
            ),
          ],
        );
      }
    }
    rethrow;
  }
});

String _prettyId(String id) {
  final words = id.replaceAll('_', ' ').trim();
  return words.isEmpty ? id : words[0].toUpperCase() + words.substring(1);
}

/// Display name for a public subject id from whatever is loaded.
String subjectNameFor(String id, List<Subject>? catalog) {
  for (final s in catalog ?? const <Subject>[]) {
    if (s.id == id) return s.name;
  }
  return fallbackSubjectNames[id] ?? _prettyId(id);
}

/// The attempt-side id of a public subject id (`general_test` is stored as `gat`).
String internalSubjectFor(String id, List<Subject>? catalog) {
  for (final s in catalog ?? const <Subject>[]) {
    if (s.id == id) return s.internalId;
  }
  return id == 'general_test' ? 'gat' : id;
}

/// The student's chosen subjects as chips (or the commerce four when none), with the current
/// [selected] subject always present, so a subject chosen from "Other subjects" stays visible.
List<SubjectChoice> subjectChoices({required List<String> chosen, required String selected, List<Subject>? catalog}) {
  final ids = <String>[...(chosen.isEmpty ? fallbackSubjectNames.keys : chosen)];
  if (!ids.contains(selected)) ids.add(selected);
  return [for (final id in ids) SubjectChoice(id, subjectNameFor(id, catalog))];
}

/// Supported subjects that are not already chips, for the "Other subjects" sheet.
List<SubjectChoice> otherSubjects({required List<SubjectChoice> shown, List<Subject>? catalog}) {
  final taken = {for (final c in shown) c.id};
  return [
    for (final s in catalog ?? const <Subject>[])
      if (!taken.contains(s.id)) SubjectChoice(s.id, s.name),
  ];
}

/// The subject the Practice tab starts on: the first subject the student chose, else Accountancy.
class PracticeSubject extends Notifier<String> {
  @override
  String build() {
    final chosen = ref.read(authSnapshotProvider).subjects;
    return chosen.isEmpty ? 'accountancy' : chosen.first;
  }

  void select(String id) => state = id;
}

final practiceSubjectProvider = NotifierProvider<PracticeSubject, String>(PracticeSubject.new);

/// How many full or NTA-style attempts the student has in a subject, from the slim summary
/// list, falling back to the cached attempts list. Null when neither can be read. Keyed by the
/// attempt-side subject id.
final completedMockCountProvider = FutureProvider.autoDispose.family<int?, String>((ref, internalSubject) async {
  try {
    final items = await ref.watch(practiceCatalogApiProvider).attemptSummaries();
    return items.where((a) => a.isMock && a.subject == internalSubject).length;
  } on ApiError {
    final cached = ref.read(attemptsRepositoryProvider).value;
    if (cached == null) return null;
    return cached.where((a) => a.isMock && a.subject == internalSubject).length;
  }
});

/// "Mock 7" for the mock about to start: finished mocks in the subject plus one.
String? mockLabelFor(int? completed) => completed == null ? null : 'Mock ${completed + 1}';
