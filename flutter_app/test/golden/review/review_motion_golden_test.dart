import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';

import 'review_golden_support.dart';

/// A frame from the middle of the repair ending's motion, with animations on: the rings have
/// closed and the foil burst is playing. The settled ending lives in the repair golden file.
void main() {
  // The strip: the ending as it opens (0 ms), as the rings start to draw (320 ms), mid burst
  // (800 ms) and with the burst fading and the number in place (1200 ms).
  for (final ms in [0, 320, 800, 1200]) {
    reviewGolden(
      'motion_repair_ending_t$ms',
      () => const RepairEndingScreen(attemptId: 'm7'),
      disableAnimations: false,
      overrides: () => reviewOverrides(
        run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
      ),
      after: (tester) async {
        if (ms > 0) await tester.pump(Duration(milliseconds: ms));
      },
    );
  }
  reviewGolden(
    'motion_repair_ending_burst',
    () => const RepairEndingScreen(attemptId: 'm7'),
    disableAnimations: false,
    overrides: () => reviewOverrides(
      run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
    ),
    after: (tester) async {
      await tester.pump(const Duration(milliseconds: 700));
    },
  );
}
