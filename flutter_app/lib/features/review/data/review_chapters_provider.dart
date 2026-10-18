import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/repositories/pending_result_repository.dart' show PendingResult, unopenedResultsProvider;
import '../model/review_chapters.dart';
import '../model/review_record_adapter.dart';
import 'mistake_index.dart';
import 'repair_check_controller.dart' show repairCheckProvider;
import 'repair_check_logic.dart' show CheckPhase;
import 'review_providers.dart';

/// The Check it held outcomes this phone holds for the repaired mistakes on Review, by [mistakeKeyOf]: only a check the student
/// answered this session has an outcome here, so a repaired mistake whose check is not on this phone reads as waiting for it (the
/// result screen reads them the same way). It watches the answered result and nothing else, so a check in progress, a retry
/// or a pick does not rebuild the tab.
final reviewCheckOutcomesProvider = Provider<Map<String, CheckOutcome>>((ref) {
  final index = ref.watch(reviewIndexProvider);
  if (index == null) return const {};
  final out = <String, CheckOutcome>{};
  for (final g in index.groups) {
    for (final i in g.items) {
      if (i.stage != MistakeStage.repaired) continue;
      final result = ref.watch(
        repairCheckProvider((attemptId: i.attemptId, questionId: i.questionId)).select((v) => v.phase == CheckPhase.answered ? v.result : null),
      );
      if (result != null) out[i.key] = CheckOutcome(right: result.right, at: result.answeredAt);
    }
  }
  return out;
});

/// The weak-chapter page's numbers (the website's `body.lose`): chapters priced in marks, the saved repairs and the lines over
/// them, built from Review's own index so they agree with Today and the result. Null until the papers are read.
final reviewChaptersProvider = Provider<ChaptersBody?>((ref) {
  final record = ref.watch(reviewRecordProvider);
  if (record == null) return null;
  return chaptersBody(record, local: ref.watch(reviewClockProvider).local);
});

/// The one record Your papers reads (19 Oct, D106): the chapter list and the strip's open repairs are both built from it,
/// filtered by the same subject, so they can never print different numbers. Null until the papers are read.
final reviewRecordProvider = Provider<ReviewRecord?>((ref) {
  final index = ref.watch(reviewIndexProvider);
  if (index == null) return null;
  final unopened = {for (final u in ref.watch(reviewInputsProvider).unopened) u.attemptId};
  return reviewRecordOf(index, now: ref.watch(nowProvider)(), unopened: unopened, checks: ref.watch(reviewCheckOutcomesProvider));
});

/// The chapters' figures alone (marks lost, on offer, wrong and blank), the same `chapterRows` the weak-chapter page prints, for
/// another screen to read: Today's Weak chapters (final walk, H6). It leaves the Check it held outcomes out, as they change no
/// figure, so it never wakes a repair check.
final reviewChapterFiguresProvider = Provider<List<ChapterRow>?>((ref) {
  final index = ref.watch(reviewIndexProvider);
  if (index == null) return null;
  // The sealed papers straight from their source (what Review's inputs read too), so this never wakes the saved-repairs read.
  final unopened = {for (final u in ref.watch(unopenedResultsProvider).value ?? const <PendingResult>[]) u.attemptId};
  return chapterRows(reviewRecordOf(index, now: ref.watch(nowProvider)(), unopened: unopened));
});
