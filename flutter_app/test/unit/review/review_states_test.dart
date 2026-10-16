import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/load_problem.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiCharacter;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/notes/sample_row.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

/// A mock with every answer right: nothing to repair.
final _clean = Attempt.fromJson(mockJson(id: 'ok', completedAt: DateTime.utc(2026, 10, 12, 14, 30)));

Future<void> _pump(
  WidgetTester tester, {
  List<Attempt>? attempts,
  RemoteState<List<Attempt>>? state,
  List<RepairLocalRecord> records = const [],
}) => pumpMockmob(
  tester,
  const ReviewScreen(),
  size: const Size(384, 1800),
  disableAnimations: true,
  wrapInScaffold: false,
  overrides: reviewOverrides(attempts: attempts, attemptsState: state, records: records),
);

const _server = ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 500);
const _offline = ApiError(kind: ApiErrorKind.network, code: 'network');

void main() {
  setUpAll(loadAppFonts);

  group('review-states: the record that did not load is never the empty state', () {
    testWidgets('a failed read with nothing cached names the cause and offers Try again', (tester) async {
      await _pump(tester, state: const RemoteState<List<Attempt>>(error: _server));
      expect(find.text(ReviewCopy.loadErrorTitle), findsOneWidget);
      expect(find.text(ReviewCopy.loadErrorMessage(LoadProblem.busy)), findsOneWidget);
      expect(find.text(ReviewCopy.tryAgainKey), findsOneWidget);
      expect(find.text(ReviewCopy.emptyTitle), findsNothing);
    });

    testWidgets('offline with nothing cached says so, still not the empty state', (tester) async {
      await _pump(tester, state: const RemoteState<List<Attempt>>(error: _offline));
      expect(find.text(ReviewCopy.offlineTitle), findsOneWidget);
      expect(find.text(ReviewCopy.tryAgainKey), findsOneWidget);
      expect(find.text(ReviewCopy.emptyTitle), findsNothing);
    });

    testWidgets('a retry in flight keeps the failure on screen with the key busy', (tester) async {
      await _pump(tester, state: const RemoteState<List<Attempt>>(error: _server, loading: true));
      expect(find.text(ReviewCopy.loadErrorTitle), findsOneWidget);
      expect(find.text(ReviewCopy.emptyTitle), findsNothing);
    });

    testWidgets('a read still loading with nothing cached shows neither', (tester) async {
      await _pump(tester, state: const RemoteState<List<Attempt>>(loading: true));
      expect(find.text(ReviewCopy.loadErrorTitle), findsNothing);
      expect(find.text(ReviewCopy.emptyTitle), findsNothing);
    });

    testWidgets('the unreadable answer names itself', (tester) async {
      const unreadable = ApiError(kind: ApiErrorKind.unknown, code: 'unusable_response');
      await _pump(tester, state: const RemoteState<List<Attempt>>(error: unreadable));
      expect(find.textContaining('could not read'), findsOneWidget);
    });
  });

  group('review-states: the empty state is only for a read that succeeded with no papers', () {
    testWidgets('a successful empty list says nothing to review yet, with the key to start', (tester) async {
      await _pump(tester, attempts: const []);
      expect(find.text('Nothing to review yet'), findsOneWidget);
      expect(find.text(ReviewCopy.emptyMessage), findsOneWidget);
      expect(find.textContaining(SampleRow.tag, findRichText: true), findsOneWidget);
      expect(find.text('Start 10 questions'), findsOneWidget);
      expect(find.text('Your mistakes gather here'), findsNothing);
    });

    testWidgets('an account with papers never sees it', (tester) async {
      await _pump(tester);
      expect(find.text('Nothing to review yet'), findsNothing);
      expect(find.text('Mistakes to repair'), findsOneWidget);
    });
  });

  group('review-states: a saved copy says so in the header', () {
    testWidgets('offline over a saved record', (tester) async {
      await _pump(tester, state: RemoteState(value: allAttempts, fetchedAt: eveningUtc, error: _offline));
      expect(find.text('Offline. Showing what is saved on this phone.'), findsOneWidget);
    });

    testWidgets('online but the refresh failed', (tester) async {
      await _pump(tester, state: RemoteState(value: allAttempts, fetchedAt: eveningUtc, error: _server));
      expect(find.text('Could not refresh. Showing your saved record.'), findsOneWidget);
    });
  });

  group('review-states: Review again', () {
    final repaired = RepairLocalRecord(
      attemptId: 'm7',
      questionId: 'm7-q0',
      requestId: 'req-m7-q0-000000000000',
      status: 'explained',
      ackedAt: DateTime.utc(2026, 10, 13),
    );

    testWidgets('the row shows once a mistake was repaired', (tester) async {
      await _pump(tester, records: [repaired]);
      expect(find.text('Review again'), findsOneWidget);
      expect(find.textContaining('you repaired, answered before the key shows'), findsOneWidget);
    });

    testWidgets('no repaired mistake, no row: it never points at nothing', (tester) async {
      await _pump(tester);
      expect(find.text('Review again'), findsNothing);
    });

    testWidgets('the all-clear key is Review again when something was repaired', (tester) async {
      final done = RepairLocalRecord(
        attemptId: 'q1',
        questionId: 'q1-q3',
        requestId: 'req-0000000000000002',
        status: RepairLocalStatus.explained,
        ackedAt: DateTime.utc(2026, 10, 8, 15, 2),
      );
      await _pump(tester, attempts: [quick], records: [done]);
      expect(find.text('Review again'), findsWidgets);
      expect(find.text('Start 10 questions'), findsNothing);
    });

    testWidgets('the all-clear key starts a fresh set when nothing was repaired', (tester) async {
      await _pump(tester, attempts: [_clean]);
      expect(find.text('Start 10 questions'), findsOneWidget);
    });
  });

  group('review-states: one Mobi per screen', () {
    testWidgets('the full tab has Mobi once, in the Ask pill', (tester) async {
      await _pump(tester);
      expect(find.byType(MobiCharacter), findsOneWidget);
      expect(find.text('Ask Mobi'), findsOneWidget);
    });

    testWidgets('the empty state carries Mobi in its scene, so the pill keeps its chat glyph', (tester) async {
      await _pump(tester, attempts: const []);
      expect(find.byIcon(LucideIcons.messageCircle), findsOneWidget);
    });
  });
}
