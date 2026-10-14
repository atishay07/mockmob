import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chapter_summary.dart';
import 'study_api.dart';

/// Opens a chapter summary. Not kept on the phone: it is a reading view of lessons that can each
/// be kept for offline from their own page.
final chapterSummaryProvider = FutureProvider.autoDispose
    .family<ChapterSummary, (String, String)>(retry: (count, error) => null, (
      ref,
      key,
    ) async {
      final (subject, chapter) = key;
      final json = await ref.read(studyApiProvider).summary(subject, chapter);
      return ChapterSummary.fromJson(json, subject: subject, chapter: chapter);
    });
