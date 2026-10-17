import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/repair_local_repository.dart' show RepairLocalRecord, repairLocalRecordsProvider;
import '../../credits/data/credit_figures.dart';
import '../../review/data/mistake_index.dart' show MistakeStage;
import '../../review/data/repair_check_controller.dart' show repairCheckProvider;
import '../../review/data/repair_check_logic.dart' show CheckPhase;
import '../../review/data/review_providers.dart' show reviewIndexProvider;

/// What the next-move rules need beyond the paper itself, read from what the app already holds: which mistakes are
/// repaired (acknowledged by the server, on this phone or in Review's index), which checks the server has marked in
/// this session, and the two credit balances (null when unknown, never zero).
class MoveState {
  const MoveState({this.repaired = const {}, this.checks = const {}, this.aiCredits, this.practiceCredits, this.isPro = false});

  final Set<String> repaired;
  final Map<String, bool> checks;
  final int? aiCredits;
  final int? practiceCredits;
  final bool isPro;

  /// Reads the state of [attemptId]'s wrong answers ([wrongQids]).
  static MoveState watch(WidgetRef ref, {required String attemptId, required Iterable<String> wrongQids}) {
    final records = ref.watch(repairLocalRecordsProvider).value ?? const <RepairLocalRecord>[];
    final index = ref.watch(reviewIndexProvider);
    final repaired = <String>{
      for (final r in records)
        if (r.attemptId == attemptId && r.isRepaired && r.isAcknowledged) r.questionId,
      for (final qid in wrongQids)
        if (index?.item(attemptId, qid)?.stage == MistakeStage.repaired) qid,
    };
    final checks = <String, bool>{};
    for (final qid in repaired) {
      final view = ref.watch(repairCheckProvider((attemptId: attemptId, questionId: qid)));
      final result = view.result;
      if (view.phase == CheckPhase.answered && result != null) checks[qid] = result.right;
    }
    final credits = ref.watch(creditFiguresProvider);
    // A balance read from the saved copy (the last read failed) may be from before this paper's own charge, so it is
    // unknown here: the line says what the action costs and leaves out "You have N" (never a wrong N).
    return MoveState(
      repaired: repaired,
      checks: checks,
      aiCredits: credits.stale ? null : credits.ai,
      practiceCredits: credits.stale ? null : credits.practice,
      isPro: credits.isPro,
    );
  }
}
