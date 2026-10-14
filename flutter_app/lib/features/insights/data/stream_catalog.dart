import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/models/subject.dart';

/// Subjects the stream offers: `GET /api/subjects`, supported and not merged. Read once a run.
final streamSubjectsProvider = FutureProvider<List<Subject>>((ref) async {
  final res = await ref.watch(apiClientProvider).get('/api/subjects', options: const ApiOptions(authenticated: false));
  final list = res.data is List ? asJsonList(res.data) : asJsonList(res.map['subjects']);
  // Merged legacy subjects (Applied Mathematics) are never offered.
  return [
    for (final j in list)
      if (j['mergedInto'] == null) Subject.fromJson(j),
  ].where((s) => s.isSupported && s.id.isNotEmpty).toList();
});

/// `GET /api/chapters?subject=`: chapter names, grouped into units where the subject has them.
final streamChaptersProvider = FutureProvider.autoDispose.family<ChapterCatalog, String>((ref, subject) async {
  final res = await ref.watch(apiClientProvider).get('/api/chapters', query: {'subject': subject}, options: const ApiOptions(authenticated: false));
  final body = res.data;
  if (body is List) {
    return ChapterCatalog(units: [
      ChapterUnit(id: '', name: '', chapters: [for (final c in asJsonList(body)) ChapterEntry.fromJson(c)]),
    ]);
  }
  return ChapterCatalog.fromJson(res.map);
});

/// The stream opens on the student's first saved subject, or the first launch subject when the
/// account has none yet.
final defaultStreamSubjectProvider = Provider<String>((ref) {
  final mine = ref.watch(authSnapshotProvider.select((s) => s.subjects.join(',')));
  return mine.isEmpty ? launchSubjectIds.first : mine.split(',').first;
});
