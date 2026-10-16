import 'package:flutter/material.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';

import 'review_golden_support.dart';

Widget repair() => const RepairScreen(attemptId: 'm7', questionId: 'm7-q0');

/// The repair's try step (L13): the question again with no key showing, the pick made in the paper
/// tagged in words, "Check my answer" off until a pick, what the reason costs, and the quiet way
/// to skip. Then the verdict in words, first under the folded question.
void main() {
  reviewGolden(
    'repair_try_ready',
    repair,
    overrides: () => reviewOverrides(
      run: runOf(tries: [TryStage.open, TryStage.open, TryStage.open]),
      credits: credits(43),
    ),
  );

  reviewGolden(
    'repair_try_picked',
    repair,
    overrides: () => reviewOverrides(
      run: runOf(tries: [TryStage.open, TryStage.open, TryStage.open], picks: [1]),
      credits: credits(43),
    ),
  );

  // The key is option B in the fixtures; the paper's pick was A.
  reviewGolden(
    'repair_verdict_right',
    repair,
    size: const Size(384, 1500),
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [explained], tries: [TryStage.done, TryStage.open, TryStage.open], picks: [1]),
      credits: credits(42),
    ),
  );

  reviewGolden(
    'repair_verdict_still',
    repair,
    size: const Size(384, 1500),
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [explained], tries: [TryStage.done, TryStage.open, TryStage.open], picks: [0]),
      credits: credits(42),
    ),
  );
}
