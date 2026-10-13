import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/storage/prefs_store.dart';
import '../../onboarding/data/subjects.dart' show Confidence, SheetSubject;
import '../../onboarding/state/student_sheet.dart' show studentSheetProvider;
import 'default_subject.dart';
import 'practice_prefs.dart';

export 'default_subject.dart' show defaultPracticeSubject;

/// Short proper names of the 15 practice subjects. Used before `GET /api/subjects` answers
/// (and when it cannot), and in place of the registry's long official names on a tile
/// ("Computer Science / Informatics Practices" reads as "Computer Science").
const Map<String, String> fallbackSubjectNames = {
  'english': 'English',
  'accountancy': 'Accountancy',
  'business_studies': 'Business Studies',
  'economics': 'Economics',
  'general_test': 'General Test',
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

/// Subject names are proper names ("Business Studies"), whatever case the catalogue sends.
String _properName(String id, String name) => fallbackSubjectNames[id] ?? name;

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

/// One row of `GET /api/subjects` with the server's own words for why practice is not open
/// (`practiceReason`), for the stale-subject banner.
class CatalogEntry {
  const CatalogEntry(this.subject, {this.reason, this.mergedInto});

  factory CatalogEntry.fromJson(Json j) =>
      CatalogEntry(Subject.fromJson(j), reason: asString(j['practiceReason']), mergedInto: asString(j['mergedInto']));

  final Subject subject;
  final String? reason;

  /// A merged legacy subject (Applied Mathematics) names the one to choose instead.
  final String? mergedInto;
}

/// The reads this feature makes that core has no repository for: subjects, chapters, question
/// counts and the slim attempts list. Behind a class so tests and goldens replace it.
class PracticeCatalogApi {
  PracticeCatalogApi(this._api);

  final ApiClient _api;

  /// `GET /api/subjects`: public. Every subject the registry knows, offered or not.
  Future<List<CatalogEntry>> registry() async {
    final response = await _api.get('/api/subjects', options: const ApiOptions(authenticated: false));
    return [
      for (final j in asJsonList(response.data))
        if (asStringOr(j['id'], '').isNotEmpty) CatalogEntry.fromJson(j),
    ];
  }

  /// Only the subjects practice can start in.
  Future<List<Subject>> subjects() async => [
    for (final e in await registry())
      if (e.subject.isSupported) e.subject,
  ];

  /// `GET /api/stats`: public, cached 30 s. Usable questions per subject, keyed by internal id.
  Future<Map<String, int>> questionCounts() async {
    final response = await _api.get('/api/stats', options: const ApiOptions(authenticated: false));
    final counts = asJson(response.map['subjectCounts']);
    return {
      for (final e in counts.entries)
        if (asInt(e.value) != null) e.key: asInt(e.value)!,
    };
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

/// Every subject of the registry, read once per app run.
final practiceRegistryProvider = FutureProvider<List<CatalogEntry>>((ref) => ref.watch(practiceCatalogApiProvider).registry());

/// Supported subjects, read once per app run.
final practiceSubjectsProvider = FutureProvider<List<Subject>>((ref) => ref.watch(practiceCatalogApiProvider).subjects());

/// Usable questions per subject (internal id), or empty when the count cannot be read: a
/// missing count is shown as nothing, never as zero.
final questionCountsProvider = FutureProvider.autoDispose<Map<String, int>>((ref) async {
  try {
    return await ref.watch(practiceCatalogApiProvider).questionCounts();
  } on ApiError {
    return const {};
  }
});

/// The student's saved subjects that practice cannot start in, with the server's reason. Empty
/// until the registry is known.
final staleSubjectsProvider = Provider.autoDispose<List<CatalogEntry>>((ref) {
  final registry = ref.watch(practiceRegistryProvider).value;
  final chosen = ref.watch(authSnapshotProvider.select((a) => a.subjects));
  if (registry == null || chosen.isEmpty) return const [];
  return [
    for (final id in chosen)
      for (final e in registry)
        if (e.subject.id == id && !e.subject.isSupported) e,
  ];
});

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
    if (s.id == id) return _properName(id, s.name);
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
/// Once the catalogue is known, a saved subject practice cannot start in is left out (the stale
/// banner names it instead).
List<SubjectChoice> subjectChoices({required List<String> chosen, required String selected, List<Subject>? catalog}) {
  final supported = catalog == null ? null : {for (final s in catalog) s.id};
  final ids = <String>[
    for (final id in chosen.isEmpty ? launchSubjectIds : chosen)
      if (supported == null || supported.contains(id)) id,
  ];
  if (!ids.contains(selected)) ids.add(selected);
  return [for (final id in ids) SubjectChoice(id, subjectNameFor(id, catalog))];
}

/// Supported subjects that are not already chips, for the "Other subjects" sheet.
List<SubjectChoice> otherSubjects({required List<SubjectChoice> shown, List<Subject>? catalog}) {
  final taken = {for (final c in shown) c.id};
  return [
    for (final s in catalog ?? const <Subject>[])
      if (!taken.contains(s.id)) SubjectChoice(s.id, _properName(s.id, s.name)),
  ];
}

/// The subject the student picked on a tile, kept apart from the default so nothing resets it:
/// a credit balance refresh after a start rebuilds the auth snapshot, and before this split it
/// also rebuilt the default and threw the pick away (the owner's "Business Studies goes back to
/// Accountancy" bug, 13 October).
///
/// The pick is kept on the phone per account (owner, 13 October: Business Studies must still be
/// the subject after a restart). It is read back once per account and trusted only when the
/// catalogue offers it (or, with no catalogue, when it is a subject the app knows); anything else
/// is dropped and the default applies.
class PickedPracticeSubject extends Notifier<String?> {
  int _generation = 0;
  Future<void> _restoring = Future.value();

  /// Completes once the stored pick for this account has been read (or found missing or
  /// invalid). A link that names no subject waits on this, so it starts in the pick.
  Future<void> get restored => _restoring;

  @override
  String? build() {
    final user = ref.watch(authSnapshotProvider.select((a) => a.userId));
    final generation = ++_generation;
    _restoring = user == null ? Future.value() : _restore(user, generation);
    return null;
  }

  Future<void> _restore(String user, int generation) async {
    final PrefsStore store;
    final String? stored;
    try {
      store = ref.read(practicePrefsStoreProvider);
      stored = await store.getString(pickedSubjectKey(user));
    } on Object {
      return;
    }
    if (stored == null) return;
    final valid = await _offered(stored);
    if (!ref.mounted || generation != _generation) return;
    if (!valid) {
      try {
        await store.remove(pickedSubjectKey(user));
      } on Object {
        // A stale key is ignored on every read anyway.
      }
      return;
    }
    // A pick made while the store was being read is newer: it wins.
    if (state == null) state = stored;
  }

  /// True when practice can start in [id]: the catalogue offers it, or, before the catalogue can
  /// be read, it is one of the subjects the app knows by name.
  Future<bool> _offered(String id) async {
    if (!storedSubjectId.hasMatch(id)) return false;
    try {
      final catalog = await ref.read(practiceSubjectsProvider.future);
      return catalog.any((s) => s.id == id);
    } on Object {
      return fallbackSubjectNames.containsKey(id);
    }
  }

  void set(String id) {
    state = id;
    final user = ref.read(authSnapshotProvider).userId;
    if (user == null) return;
    try {
      ref.read(practicePrefsStoreProvider).setString(pickedSubjectKey(user), id).catchError((Object _) {});
    } on Object {
      // The pick still holds for this run; it is only not remembered across a restart.
    }
  }
}

final pickedPracticeSubjectProvider = NotifierProvider<PickedPracticeSubject, String?>(PickedPracticeSubject.new);

/// The subject the Practice tab starts on: the student's own pick while practice can still
/// start in it, otherwise the default from their own data (see [defaultPracticeSubject]).
/// Rebuilt only when the saved subjects themselves change, never when credits or the plan do.
class PracticeSubject extends Notifier<String> {
  @override
  String build() {
    // Joined, so a fresh but equal list (every auth reload) is not a change.
    final chosenKey = ref.watch(authSnapshotProvider.select((a) => a.subjects.join(',')));
    final chosen = chosenKey.isEmpty ? const <String>[] : chosenKey.split(',');
    final picked = ref.watch(pickedPracticeSubjectProvider);
    // Watched, not read: on a cold start these are still loading when the first link opens,
    // and a default computed from nothing would stay Accountancy for good.
    final catalog = ref.watch(practiceSubjectsProvider.select((s) => s.value));
    if (picked != null && (catalog == null || catalog.any((s) => s.id == picked))) return picked;
    final sheet = ref.watch(studentSheetProvider);
    final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
    return defaultPracticeSubject(
      saved: chosen,
      onboarding: [for (final (subject, _) in sheet?.subjects ?? const <(SheetSubject, Confidence?)>[]) subject.id],
      attempts: attempts,
      catalog: catalog,
    );
  }

  void select(String id) => ref.read(pickedPracticeSubjectProvider.notifier).set(id);
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
