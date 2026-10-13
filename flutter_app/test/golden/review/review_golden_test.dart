import 'package:flutter/material.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/screens/mistakes_screen.dart';
import 'package:mockmob/features/review/screens/record_screen.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../unit/review/support/review_fixtures.dart';
import 'review_golden_support.dart';

void main() {
  reviewGolden('review_tab', () => const ReviewScreen(), overrides: () => reviewOverrides(records: [repairedRecord]));
  reviewGolden('review_tab_text130', () => const ReviewScreen(), overrides: () => reviewOverrides(records: [repairedRecord]), textScale: 1.3);

  reviewGolden(
    'review_tab_full',
    () => const ReviewScreen(),
    size: const Size(384, 2300),
    overrides: () => reviewOverrides(records: [repairedRecord]),
  );

  reviewGolden(
    'review_tab_late',
    () => const ReviewScreen(),
    overrides: () => reviewOverrides(records: [repairedRecord], nowUtc: lateUtc),
  );

  reviewGolden('review_tab_empty', () => const ReviewScreen(), overrides: () => reviewOverrides(attempts: const []));

  reviewGolden(
    'review_tab_all_clear',
    () => const ReviewScreen(),
    overrides: () => reviewOverrides(
      attempts: [quick],
      records: [
        RepairLocalRecord(
          attemptId: 'q1',
          questionId: 'q1-q3',
          requestId: 'req-0000000000000002',
          status: RepairLocalStatus.explained,
          ackedAt: DateTime.utc(2026, 10, 8, 15, 2),
        ),
      ],
    ),
  );

  reviewGolden(
    'review_tab_error',
    () => const ReviewScreen(),
    overrides: () => reviewOverrides(
      attemptsState: const RemoteState<List<Attempt>>(
        error: ApiError(kind: ApiErrorKind.network, code: 'network'),
      ),
    ),
  );

  reviewGolden(
    'review_tab_stale',
    () => const ReviewScreen(),
    overrides: () => reviewOverrides(
      attemptsState: RemoteState<List<Attempt>>(
        value: allAttempts,
        fetchedAt: eveningUtc,
        error: const ApiError(kind: ApiErrorKind.network, code: 'network'),
      ),
    ),
  );

  reviewGolden(
    'review_mistakes',
    () => const MistakesScreen(),
    size: const Size(384, 1500),
    overrides: () => reviewOverrides(records: [repairedRecord]),
  );

  reviewGolden('review_record', () => const RecordScreen(), overrides: () => reviewOverrides(records: [repairedRecord, ...tonightRecords]));
}

/// Two of tonight's Partnership mistakes: one repaired, one read with the key.
final tonightRecords = [
  RepairLocalRecord(
    attemptId: 'm7',
    questionId: 'm7-q0',
    requestId: 'req-0000000000000003',
    status: RepairLocalStatus.explained,
    ackedAt: DateTime.utc(2026, 10, 12, 17, 38),
  ),
  const RepairLocalRecord(attemptId: 'm7', questionId: 'm7-q13', requestId: 'req-0000000000000004', status: RepairLocalStatus.reviewed),
];
