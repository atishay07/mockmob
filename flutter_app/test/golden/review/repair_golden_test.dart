import 'package:flutter/material.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/retry.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/screens/repair_screen.dart';

import '../../unit/review/support/review_fixtures.dart';
import 'review_golden_support.dart';

Widget repair() => const RepairScreen(attemptId: 'm7', questionId: 'm7-q0');

void main() {
  reviewGolden(
    'repair_entry',
    repair,
    overrides: () => reviewOverrides(
      run: runOf(phase: RepairPhase.entry),
      credits: credits(9),
    ),
  );

  reviewGolden(
    'repair_entry_short',
    repair,
    overrides: () => reviewOverrides(
      run: runOf(phase: RepairPhase.entry),
      credits: credits(2),
    ),
  );

  reviewGolden(
    'repair_loading',
    repair,
    overrides: () => reviewOverrides(run: runOf(outcomes: [const OutcomeLoading()])),
  );

  reviewGolden(
    'repair_explained',
    repair,
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [explained]),
      concept: const ConceptLink(unitId: 'acc-partnership-2', title: 'Admission of a partner: the sacrificing ratio'),
    ),
  );

  reviewGolden(
    'repair_explained_full',
    repair,
    size: const Size(384, 1900),
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [explained]),
      concept: const ConceptLink(unitId: 'acc-partnership-2', title: 'Admission of a partner: the sacrificing ratio'),
    ),
  );

  reviewGolden(
    'repair_retry_short',
    repair,
    size: const Size(384, 1900),
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [explained]),
      retry: const RetryShortOfCredits(),
    ),
  );

  reviewGolden(
    'repair_set_aside',
    repair,
    overrides: () => reviewOverrides(run: runOf(outcomes: [explained, const OutcomeSetAside(heldByServer: true)], index: 1)),
  );

  reviewGolden(
    'repair_offline',
    repair,
    overrides: () => reviewOverrides(run: runOf(outcomes: [explained, explained2, const OutcomeFailed(RepairFailure.offline)], index: 2)),
  );

  reviewGolden(
    'repair_key_review',
    repair,
    size: const Size(384, 1300),
    overrides: () => reviewOverrides(
      run: runOf(outcomes: [const OutcomeKeyReview(KeyReviewReason.outOfCredits)]),
      credits: credits(0),
    ),
  );

  reviewGolden(
    'repair_ending_first',
    () => const RepairEndingScreen(attemptId: 'm7'),
    overrides: () => reviewOverrides(
      run: runOf(
        phase: RepairPhase.ending,
        outcomes: [explained, explained2, const OutcomeSetAside(heldByServer: true)],
        index: 2,
        repairedBefore: false,
      ),
    ),
  );

  reviewGolden(
    'repair_ending_more',
    () => const RepairEndingScreen(attemptId: 'm7'),
    overrides: () => reviewOverrides(
      nowUtc: lateUtc,
      run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
    ),
  );

  // As the app shows it: acknowledged repairs carry their requestId, so the ending fires the
  // repairFinished moment into its own slot, in the receipt's place.
  reviewGolden(
    'repair_ending_first_moment',
    () => const RepairEndingScreen(attemptId: 'm7'),
    overrides: () => reviewOverrides(
      run: runOf(
        phase: RepairPhase.ending,
        outcomes: [_withId(explained, 'req-a'), _withId(explained2, 'req-b'), const OutcomeSetAside(heldByServer: true)],
        index: 2,
        repairedBefore: false,
      ),
    ),
  );

  reviewGolden(
    'repair_ending_moment',
    () => const RepairEndingScreen(attemptId: 'm7'),
    overrides: () => reviewOverrides(
      run: runOf(phase: RepairPhase.ending, outcomes: [_withId(explained, 'req-a'), _withId(explained2, 'req-b')], index: 1),
    ),
  );

  reviewGolden(
    'repair_ending_nothing',
    () => const RepairEndingScreen(attemptId: 'm7'),
    overrides: () => reviewOverrides(
      run: runOf(
        phase: RepairPhase.ending,
        outcomes: [const OutcomeSetAside(heldByServer: true), const OutcomeKeyReview(KeyReviewReason.chosen)],
        index: 1,
      ),
    ),
  );
}

OutcomeExplained _withId(OutcomeExplained o, String requestId) => OutcomeExplained(o.response, ackedAt: o.ackedAt, requestId: requestId);
