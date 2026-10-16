import '../../../core/models/models.dart';

/// The subject practice opens on when the student has not picked one yet, from their own data
/// in this order: the subject of their latest paper when it is one of their saved subjects (the
/// opening tile then matches what their record points to, L08), the subjects saved on the
/// account, the subjects ranked in onboarding, the subject of their latest paper, the first
/// subject the catalogue offers, then the first launch subject. Only subjects practice can start
/// in count once the catalogue is known.
String defaultPracticeSubject({
  required List<String> saved,
  List<String> onboarding = const [],
  List<Attempt>? attempts,
  List<Subject>? catalog,
}) {
  final supported = catalog == null ? null : {for (final s in catalog) s.id};
  bool usable(String id) => id.isNotEmpty && (supported == null || supported.contains(id));

  String? latestId;
  if (attempts != null && attempts.isNotEmpty) {
    final latest = attempts.reduce((a, b) => a.completedAt.isAfter(b.completedAt) ? a : b);
    latestId = publicIdOf(latest.subject, catalog);
    if (saved.contains(latestId) && usable(latestId)) return latestId;
  }
  for (final id in saved) {
    if (usable(id)) return id;
  }
  for (final id in onboarding) {
    if (usable(id)) return id;
  }
  if (latestId != null && usable(latestId)) return latestId;
  if (catalog != null && catalog.isNotEmpty) return catalog.first.id;
  return launchSubjectIds.first;
}

/// The public id of an attempt-side subject id (`gat` is stored for General Test).
String publicIdOf(String internal, List<Subject>? catalog) {
  for (final s in catalog ?? const <Subject>[]) {
    if (s.internalId == internal) return s.id;
  }
  return internal == 'gat' ? 'general_test' : internal;
}
