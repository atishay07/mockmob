import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
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
  final index = ref.watch(reviewIndexProvider);
  if (index == null) return null;
  final unopened = {for (final u in ref.watch(reviewInputsProvider).unopened) u.attemptId};
  final clock = ref.watch(reviewClockProvider);
  final record = reviewRecordOf(index, now: ref.watch(nowProvider)(), unopened: unopened, checks: ref.watch(reviewCheckOutcomesProvider));
  return chaptersBody(record, local: clock.local);
});
