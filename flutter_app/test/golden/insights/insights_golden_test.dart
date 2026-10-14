import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/insights/data/stream_controller.dart';
import 'package:mockmob/features/insights/data/trend.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/insights/screens/saved_screen.dart';
import 'package:mockmob/features/insights/screens/stream_screen.dart';
import 'package:mockmob/features/insights/widgets/entry_points.dart';
import 'package:mockmob/features/insights/widgets/trend_chart.dart';

import '../../unit/insights/support/insights_fixtures.dart';
import 'insights_golden_support.dart';

const _offline = ApiError(kind: ApiErrorKind.network, code: 'network');

StreamState _stream({Map<String, String> picks = const {}, StreamPhase phase = StreamPhase.ready, String? passage, Object? key = 'A'}) =>
    StreamState(
      filters: const StreamFilters(subject: 'accountancy', chapter: 'Partnership: admission of a partner'),
      questions: [question('q1', passage: passage, key: key), question('q2')],
      picks: picks,
      phase: phase,
      hasMore: true,
    );

class _Entries extends StatelessWidget {
  const _Entries();

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: context.mmColors.ground,
        body: const SafeArea(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [InsightsCard(), SizedBox(height: 24), ReviewInsightsRows(), StreamEntry()],
            ),
          ),
        ),
      );
}

/// A format whose latest sessions sit near the top of the chart, so the picked dot has no room
/// above it for the note.
final _topSeries = TrendSeries(
  key: 'top',
  subject: 'accountancy',
  mode: 'quick',
  total: 10,
  points: [
    for (var i = 0; i < 4; i++)
      TrendPoint(attemptId: 'top$i', at: DateTime.utc(2026, 10, 3 + i * 2, 12), marks: [41, 44, 47, 49][i], maxMarks: 50),
  ],
);

/// A format whose dots sit mid-chart: the note fits neither above nor below a dot, so it goes
/// beside it, off the marks scale and the dates (walk-through round 3, record chart).
final _midSeries = TrendSeries(
  key: 'mid',
  subject: 'business_studies',
  mode: 'quick',
  total: 10,
  points: [
    for (var i = 0; i < 3; i++)
      TrendPoint(attemptId: 'mid$i', at: DateTime.utc(2026, 10, 10 + i * 2, 12), marks: [33, 8, 21][i], maxMarks: 50),
  ],
);

void main() {
  // ---- The trend note ----
  // The note flips below a dot near the top, and stays out of the heading above the chart.
  insightsGolden(
    'trend_picked_top',
    () => Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: [_topSeries]))),
    ),
    size: const Size(384, 420),
    after: (tester) async {
      final chart = tester.getRect(find.byType(CustomPaint).last);
      // The last dot, at the top right of the plot.
      await tester.tapAt(Offset(chart.right - 10, chart.top + 12));
      await tester.pump();
    },
  );

  for (final (name, first) in [('trend_picked_side_first', true), ('trend_picked_side_last', false)]) {
    insightsGolden(
      name,
      () => Builder(
        builder: (context) => Scaffold(
          backgroundColor: context.mmColors.ground,
          body: SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: TrendSection(series: [_midSeries]))),
        ),
      ),
      size: const Size(384, 420),
      after: (tester) async {
        final chart = tester.getRect(find.byType(CustomPaint).last);
        // The first dot sits at the left of the plot (after the marks scale), the last at the right.
        await tester.tapAt(Offset(first ? chart.left + 36 : chart.right - 12, chart.center.dy));
        await tester.pump();
      },
    );
  }

  // ---- Your record ----
  insightsGolden('record_top', () => const InsightsScreen());
  insightsGolden('record_full_free', () => const InsightsScreen(), size: const Size(384, 3000));
  insightsGolden('record_full_pro', () => const InsightsScreen(), size: const Size(384, 3300), overrides: () => insightsOverrides(pro: true));
  insightsGolden(
    'record_thin',
    () => const InsightsScreen(),
    size: const Size(384, 1900),
    overrides: () => insightsOverrides(insights: RemoteState(value: thin()), attempts: thinAttempts()),
  );
  insightsGolden(
    'record_attempts_loading',
    () => const InsightsScreen(),
    size: const Size(384, 1500),
    overrides: () => insightsOverrides(attemptsState: const RemoteState<List<Attempt>>(loading: true)),
  );
  insightsGolden(
    'record_attempts_failed',
    () => const InsightsScreen(),
    size: const Size(384, 1500),
    overrides: () => insightsOverrides(attemptsState: const RemoteState<List<Attempt>>(error: ApiError(kind: ApiErrorKind.server, code: 'x', status: 503))),
  );
  insightsGolden(
    'record_sparse',
    () => const InsightsScreen(),
    overrides: () => insightsOverrides(insights: RemoteState(value: sparse()), attempts: sparseAttempts()),
  );
  insightsGolden('record_empty', () => const InsightsScreen(), overrides: () => insightsOverrides(insights: RemoteState(value: empty()), attempts: const []));
  insightsGolden(
    'record_error',
    () => const InsightsScreen(),
    overrides: () => insightsOverrides(insights: const RemoteState<PrepInsights>(error: ApiError(kind: ApiErrorKind.server, code: 'insights_unavailable', status: 503))),
  );
  insightsGolden(
    'record_stale',
    () => const InsightsScreen(),
    overrides: () => insightsOverrides(insights: RemoteState(value: rich(), error: _offline)),
  );
  insightsGolden('record_loading', () => const InsightsScreen(), overrides: () => insightsOverrides(insights: const RemoteState<PrepInsights>(loading: true)));
  insightsGolden('record_text130', () => const InsightsScreen(), textScale: 1.3);

  // ---- Entry points ----
  insightsGolden(
    'entries',
    () => const _Entries(),
    size: const Size(384, 640),
    overrides: () => insightsOverrides(saved: RemoteState(value: SavedList(ids: const ['q1', 'q2', 'q3'], questions: [question('q1'), question('q2')], count: 3))),
  );

  // ---- Saved ----
  final savedList = SavedList(
    ids: const ['q1', 'q2', 'q3', 'q4'],
    questions: [
      question('q1', saved: true),
      question(
        'q2',
        saved: true,
        subject: 'economics',
        chapter: 'Money and banking',
        body: 'Which of these is not a function of the central bank of a country?',
      ),
      question(
        'q3',
        saved: true,
        subject: 'business_studies',
        chapter: 'Principles of management',
        body: 'Which principle of Fayol says that each employee should receive orders from only one superior?',
      ),
    ],
    count: 4,
  );
  insightsGolden('saved_list', () => const SavedScreen(), overrides: () => insightsOverrides(saved: RemoteState(value: savedList)));
  insightsGolden(
    'saved_removing',
    () => const SavedScreen(),
    overrides: () => insightsOverrides(saved: RemoteState(value: savedList), marks: const SaveMarks(pending: {'q2'})),
  );
  insightsGolden('saved_empty', () => const SavedScreen(), overrides: () => insightsOverrides(saved: const RemoteState(value: SavedList())));
  insightsGolden('saved_offline', () => const SavedScreen(), overrides: () => insightsOverrides(saved: const RemoteState<SavedList>(error: _offline)));

  // ---- Question stream ----
  insightsGolden('stream_question', () => const StreamScreen(), overrides: () => insightsOverrides(stream: _stream()));
  insightsGolden(
    'stream_right',
    () => const StreamScreen(),
    size: const Size(384, 1100),
    overrides: () => insightsOverrides(stream: _stream(picks: {'q1': 'A'}), marks: const SaveMarks(acked: {'q1': true})),
  );
  insightsGolden('stream_wrong', () => const StreamScreen(), size: const Size(384, 1100), overrides: () => insightsOverrides(stream: _stream(picks: {'q1': 'C'})));
  insightsGolden(
    'stream_passage',
    () => const StreamScreen(),
    overrides: () => insightsOverrides(
      stream: _stream(passage: 'Read the following and answer. A and B were partners in a firm sharing profits and losses in the ratio 3:2. '
          'On 1 April 2025 they admitted C as a new partner for a 1/5 share in the future profits of the firm, which he acquired equally from A and B. '
          'C brought his share of goodwill in cash.'),
    ),
  );
  insightsGolden('stream_no_key', () => const StreamScreen(), overrides: () => insightsOverrides(stream: _stream(key: 'Z')));
  insightsGolden(
    'stream_end',
    () => const StreamScreen(),
    overrides: () => insightsOverrides(
      stream: StreamState(
        filters: const StreamFilters(subject: 'accountancy'),
        questions: [question('q1'), question('q2')],
        picks: const {'q1': 'A', 'q2': 'C'},
        index: 2,
        phase: StreamPhase.end,
      ),
    ),
  );
  insightsGolden(
    'stream_empty_filters',
    () => const StreamScreen(),
    overrides: () => insightsOverrides(stream: const StreamState(filters: StreamFilters(subject: 'economics', difficulty: 'hard'), phase: StreamPhase.emptyFilters)),
  );
  insightsGolden(
    'stream_offline',
    () => const StreamScreen(),
    overrides: () => insightsOverrides(stream: const StreamState(filters: StreamFilters(subject: 'economics'), phase: StreamPhase.failed, error: _offline)),
  );
  insightsGolden(
    'stream_loading',
    () => const StreamScreen(),
    overrides: () => insightsOverrides(stream: const StreamState(filters: StreamFilters(subject: 'economics'))),
  );

  // ---- Ask ----
  insightsGolden('ask_start', () => const AskScreen());
  insightsGolden(
    'ask_conversation',
    () => const AskScreen(),
    size: const Size(384, 1300),
    overrides: () => insightsOverrides(
      credits: const AiCredits(state: 'available', wallet: AiWallet(known: true, spendable: 0)),
      ask: const AskState(messages: [
        AskMessage.student('Where am I losing marks?'),
        AskMessage.reply(
          'Partnership: admission of a partner is where the most marks are open. Accountancy: 6 right, 4 wrong, 3 left blank out of 13 '
          'questions over 3 sessions. Those 7 questions were worth 35 marks.',
          origin: AskOrigin.phone,
          actions: [('Practise Partnership: admission of a partner', '/dashboard?subject=accountancy&mode=quick')],
        ),
        AskMessage.student('Why does goodwill get shared in the sacrificing ratio?'),
        AskMessage.reply(
          'Because the old partners give up part of their future profit to the new partner, so they are compensated in the same '
          'proportion they gave it up.',
          origin: AskOrigin.model,
        ),
        AskMessage.student('And for retirement?'),
        AskMessage.failed(AskFailure.noCredits, balance: 0),
      ]),
    ),
  );
  insightsGolden(
    'ask_paused_offline',
    () => const AskScreen(),
    overrides: () => insightsOverrides(
      credits: const AiCredits(state: 'paused'),
      ask: const AskState(messages: [AskMessage.student('Make me a plan for this week'), AskMessage.failed(AskFailure.offline)]),
    ),
  );
}
