import 'json_helpers.dart';

/// One entry of `GET /api/subjects` [API 2.5]. Show only [isSupported] subjects.
class Subject {
  const Subject({
    required this.id,
    required this.internalId,
    required this.name,
    this.short,
    this.chapters = const [],
    this.practice = 'unknown',
    this.registryVersion,
  });

  factory Subject.fromJson(Json j) {
    final id = asStringOr(j['id'], '');
    return Subject(
      id: id,
      internalId: asStringOr(j['internalId'], id),
      name: asStringOr(j['name'], id),
      short: asString(j['short']),
      chapters: asStringList(j['chapters']),
      practice: asStringOr(j['practice'], 'unknown'),
      registryVersion: asString(j['registryVersion']),
    );
  }

  /// Public id (`general_test`). Send this as `subject` in API calls.
  final String id;

  /// Compare with `Attempt.subject` and `questionsSnapshot[].internalSubject`.
  final String internalId;
  final String name;
  final String? short;
  final List<String> chapters;

  /// `supported`, `not_offered`, `retired`, `merged` or `unknown`.
  final String practice;
  final String? registryVersion;

  bool get isSupported => practice == 'supported';
}

/// The four Commerce launch subjects that get free first practice (spec 5.1.2).
const launchSubjectIds = ['english', 'accountancy', 'business_studies', 'economics'];

class ChapterEntry {
  const ChapterEntry({required this.id, required this.name, this.sortOrder = 0});

  factory ChapterEntry.fromJson(Json j) =>
      ChapterEntry(id: asStringOr(j['id'], asStringOr(j['name'], '')), name: asStringOr(j['name'], ''), sortOrder: asInt(j['sortOrder']) ?? 0);

  final String id;

  /// The session API takes chapter NAMES, never ids.
  final String name;
  final int sortOrder;
}

class ChapterUnit {
  const ChapterUnit({required this.id, required this.name, this.chapters = const []});

  final String id;
  final String name;
  final List<ChapterEntry> chapters;
}

/// `GET /api/chapters?subject=`: either grouped into units or a flat list.
class ChapterCatalog {
  const ChapterCatalog({required this.units});

  factory ChapterCatalog.fromJson(Json j) {
    if (j['grouped'] == true) {
      return ChapterCatalog(units: [
        for (final u in asJsonList(j['units']))
          ChapterUnit(
            id: asStringOr(u['id'], ''),
            name: asStringOr(u['name'], ''),
            chapters: [for (final c in asJsonList(u['chapters'])) ChapterEntry.fromJson(c)],
          ),
      ]);
    }
    return ChapterCatalog(units: [
      ChapterUnit(id: '', name: '', chapters: [for (final c in asJsonList(j['chapters'])) ChapterEntry.fromJson(c)]),
    ]);
  }

  final List<ChapterUnit> units;

  List<ChapterEntry> get allChapters => [for (final u in units) ...u.chapters];
}
