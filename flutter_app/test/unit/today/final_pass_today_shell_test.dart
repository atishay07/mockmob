// Final pass, Today shell (final walk 18 Oct): the Updated line names the newest papers Today shows;
// a retry on the failure card keeps the card up (no first-load skeleton); the This week sheet never says
// "3 of 4" beside "not planned" and leads with Plan next week on a Sunday; the attempts list asks for the
// summary view; one joiner keeps a sentence from getting a second full stop.
import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/copy/sentences.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/features/rhythm/data/rhythm_providers.dart';
import 'package:mockmob/features/rhythm/screens/week_sheet.dart';
import 'package:mockmob/features/rhythm/widgets/rhythm_page.dart' show FlushQuietKey;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/copy_ahead.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';
import '../core_data/support/test_db.dart';
import 'support/today_fixtures.dart';

class _FakeAuth extends AuthController {
  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co');
}

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  group('the Updated line names the newest papers Today shows', () {
    // 10:30 PM on Sunday 18 October in Kolkata.
    final now = DateTime.utc(2026, 10, 18, 17, 0);
    final listRead = DateTime.utc(2026, 10, 18, 16, 23); // 9:53 PM
    final paperAt = DateTime.utc(2026, 10, 18, 16, 41); // 10:11 PM
    final oldPaper = paper(id: 'old', completedAt: DateTime.utc(2026, 10, 17, 10, 0), runs: const [('Ratio analysis', V.right, 5)]);
    final newPaper = paper(id: 'new', completedAt: paperAt, runs: const [('Ratio analysis', V.right, 5)]);

    TodayInputs inputs({required bool attemptsStale, bool planStale = false, DateTime? planRead, DateTime? attemptsRead, bool withNewPaper = true, bool offline = false}) => TodayInputs(
      now: now,
      timezone: 'Asia/Kolkata',
      attempts: [if (withNewPaper) newPaper, oldPaper],
      attemptsFetchedAt: attemptsRead ?? listRead,
      attemptsStale: attemptsStale,
      planFetchedAt: planRead ?? listRead,
      planStale: planStale,
      offline: offline,
    );

    test('only the plan is a saved copy: the line is the papers read, not the older plan read', () {
      final read = DateTime.utc(2026, 10, 18, 16, 45); // 10:15 PM, after the new paper
      final line = buildHeader(inputs(attemptsStale: false, planStale: true, attemptsRead: read)).updatedLine;
      expect(line, 'Updated 10:15 PM');
    });

    test('a paper added after the last full read counts: the line is never older than the newest paper on screen', () {
      final line = buildHeader(inputs(attemptsStale: true)).updatedLine;
      expect(line, contains('10:11 PM'));
      expect(line, isNot(contains('9:53')));
    });

    test('with no newer paper, the last full read stands', () {
      final line = buildHeader(inputs(attemptsStale: true, withNewPaper: false)).updatedLine;
      expect(line, contains('9:53 PM'));
    });

    test('an unknown read time is never invented from a paper', () {
      final unknown = TodayInputs(now: now, timezone: 'Asia/Kolkata', attempts: [newPaper], attemptsStale: true);
      expect(buildHeader(unknown).updatedLine, isNull);
      expect(papersDataAt(unknown), isNull);
    });

    test('offline still names the older of the two reads (a saved copy of both)', () {
      final line = buildHeader(inputs(attemptsStale: true, planRead: DateTime.utc(2026, 10, 18, 15, 0), offline: true)).updatedLine;
      expect(line, startsWith('Offline. Last loaded '));
    });
  });

  group('a retry on the failure card is not a first load', () {
    test('the state remembers the failure while the new read runs, and forgets it when the read ends', () {
      const failure = ApiError(kind: ApiErrorKind.server, code: 'server');
      const failed = RemoteState<int>(error: failure);
      expect(failed.isFailedEmpty, isTrue);
      expect(failed.isRetryingAfterFailure, isFalse);

      final retrying = failed.copyWith(loading: true, clearError: true, priorError: failed.error);
      expect(retrying.isFailedEmpty, isFalse);
      expect(retrying.isInitialLoading, isTrue);
      expect(retrying.isRetryingAfterFailure, isTrue, reason: 'Today keeps the failure card up through the retry');
      expect(retrying.priorError, failure);

      final again = retrying.copyWith(loading: false, error: failure, clearPrior: true);
      expect(again.isFailedEmpty, isTrue);
      expect(again.isRetryingAfterFailure, isFalse);
    });

    test('a first load, with no failure before it, is still a first load (the skeleton)', () {
      const first = RemoteState<int>(loading: true);
      expect(first.isInitialLoading, isTrue);
      expect(first.isRetryingAfterFailure, isFalse);
    });

    test('the repository carries the failure across the retry, and a good read clears it', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final http = FakeHttpAdapter();
      final now = DateTime.utc(2026, 10, 16, 4, 48);
      final container = ProviderContainer(
        overrides: [
          authSnapshotProvider.overrideWith(_FakeAuth.new),
          appDatabaseProvider.overrideWithValue(db),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
          nowProvider.overrideWithValue(() => now),
        ],
      );
      addTearDown(container.dispose);

      http.replies.add(const FakeReply(500, {'error': 'busy'}));
      container.read(attemptsRepositoryProvider);
      Future<void> settled() async {
        for (var i = 0; i < 4000; i++) {
          final s = container.read(attemptsRepositoryProvider);
          if (!s.loading && (s.value != null || s.error != null)) return;
          await Future<void>.delayed(const Duration(milliseconds: 1));
        }
        fail('the read never settled');
      }

      await settled();
      expect(container.read(attemptsRepositoryProvider).isFailedEmpty, isTrue);

      // The retry: held open so its state can be seen while it runs.
      http.hold = Completer<void>();
      http.replies.add(const FakeReply(200, '[]'));
      final retry = container.read(attemptsRepositoryProvider.notifier).refresh(force: true);
      await Future<void>.delayed(const Duration(milliseconds: 50));
      final during = container.read(attemptsRepositoryProvider);
      expect(during.loading, isTrue);
      expect(during.isRetryingAfterFailure, isTrue);
      expect(during.error, isNull);

      http.hold!.complete();
      await retry;
      final after = container.read(attemptsRepositoryProvider);
      expect(after.isRetryingAfterFailure, isFalse);
      expect(after.priorError, isNull);
    });
  });

  group('the attempts list asks for the summary view', () {
    test('the list call carries view=summary; one paper\'s own read does not', () async {
      final db = newTestDb();
      addTearDown(db.close);
      final http = FakeHttpAdapter();
      final queries = <String, Map<String, dynamic>>{};
      http.handler = (options) {
        queries[options.path] = Map.of(options.queryParameters);
        return options.path == '/api/attempts' ? FakeReply(200, jsonEncode(<Object>[])) : const FakeReply(404, {'error': 'none'});
      };
      final now = DateTime.utc(2026, 10, 16, 4, 48);
      final container = ProviderContainer(
        overrides: [
          authSnapshotProvider.overrideWith(_FakeAuth.new),
          appDatabaseProvider.overrideWithValue(db),
          apiClientProvider.overrideWithValue(newApiClient(http, now: () => now)),
          nowProvider.overrideWithValue(() => now),
        ],
      );
      addTearDown(container.dispose);

      container.read(attemptsRepositoryProvider);
      for (var i = 0; i < 4000 && !queries.containsKey('/api/attempts'); i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
      expect(queries['/api/attempts'], {'view': 'summary'});

      container.read(attemptDetailProvider('att_1'));
      for (var i = 0; i < 4000 && !queries.containsKey('/api/attempts/att_1'); i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
      expect(queries['/api/attempts/att_1'], isEmpty, reason: 'one paper is read whole');
      expect(attemptsListQuery, {'view': 'summary'});
      expect(attemptsListPath, '/api/attempts');
    });
  });

  group('one joiner, no doubled full stops in a screen reader label', () {
    test('endSentence adds a stop only where one is missing', () {
      expect(endSentence('Paused weeks do not break your run'), 'Paused weeks do not break your run.');
      expect(endSentence('Paused weeks do not break your run.'), 'Paused weeks do not break your run.');
      expect(endSentence('Is it ready?'), 'Is it ready?');
      expect(endSentence('Done!'), 'Done!');
      expect(endSentence('  spaced  '), 'spaced.');
      expect(endSentence(''), '');
    });

    test('joinSentences skips empty parts and never doubles a stop', () {
      expect(joinSentences(['Your colleges', 'DU, 2026 Round 1. 2 more saved.', null, '', '3 of 12']), 'Your colleges. DU, 2026 Round 1. 2 more saved. 3 of 12.');
      expect(joinSentences(const []), '');
    });

    test('the four labels the walk heard doubled now read once', () {
      // "2 more saved.." (the colleges row), "starts Monday.." and "from Quick 10.." (the tiles), "keeps your run.." (the week).
      expect(TodayCopy.rowSemantics('Your colleges', 'Delhi University', 'CUET UG, 2026 Round 1. 2 more saved.', '3 of 12'), isNot(contains('..')));
      expect(GlanceCopy.tileSemantics('This week', '', GlanceCopy.weekNoDaysOpen), isNot(contains('..')));
      expect(GlanceCopy.tileSemantics('Last paper', '', 'Repair from Quick 10.'), 'Last paper. Repair from Quick 10.');
      expect(TodayCopy.weekSemantics('3 of 4 study days', '2 mocks', 'A pause keeps your run.'), 'This week, 3 of 4 study days. 2 mocks. A pause keeps your run. Opens your week.');
      expect(AheadCopy.weekSemantics('Next week', 'Plan', 'Starts Monday.'), 'Next week. Plan. Starts Monday. Change plan.');
      expect(SuggestedCopy.cardSemantics(1, 3, 'Free, about 10 min', 'Revise', 'Due today.', suggested: false), 'Card 1 of 3. Revise. Free, about 10 min. Due today.');
      expect(GlanceCopy.layerSemantics('Layer', '4', 'Ends Monday.', false), 'Layer. 4. Ends Monday. Show details.');
      expect(GlanceCopy.weakRowSemantics('Goodwill', '9 of 12 missed.', 41, true), 'Goodwill. 9 of 12 missed. 41 marks lost. Hide mistakes.');
    });
  });

  group('This week sheet', () {
    setUpAll(loadAppFonts);

    // Sunday 18 October 2026, 10:00 PM in India; Friday, Saturday and Sunday studied.
    final sunday = DateTime.utc(2026, 10, 18, 16, 30);

    RhythmSnapshot snapshot({List<String> days = const ['2026-10-16', '2026-10-17', '2026-10-18'], DateTime? at}) => composeSnapshot(
      rhythmState: loaded(rhythmFixture(studyDayDates: days, mocks: 4, repairs: 3)),
      goalState: const RemoteState(value: Goal(daysPerWeek: 4)),
      now: at ?? sunday,
      timezone: 'Asia/Kolkata',
    );

    Future<void> pump(WidgetTester tester, RhythmSnapshot s, {Set<int>? plan, VoidCallback? onChangeDays, Future<void> Function()? onPause}) async {
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: WeekSheetBody(
            snapshot: s,
            rhythmOff: false,
            onRetry: () {},
            onTurnOn: () {},
            onSeeRhythm: () {},
            plan: plan,
            onChangeDays: onChangeDays ?? () {},
            onPauseWeek: onPause ?? () async {},
          ),
        ),
        overrides: rhythmOverrides(rhythm: loaded(rhythmFixture())),
        disableAnimations: true,
        size: const Size(360, 1100),
      );
      await tester.pump(const Duration(milliseconds: 600));
    }

    testWidgets('no days planned: the count has no planned total, and the plan line stays', (tester) async {
      await pump(tester, snapshot());
      expect(find.text('3 study days so far'), findsOneWidget);
      expect(find.textContaining('3 of 4'), findsNothing);
      expect(find.text('You have not planned your days yet. Every day you study still counts.'), findsOneWidget);
    });

    testWidgets('days planned: "3 of 4 study days" returns and the not-planned line is gone', (tester) async {
      await pump(tester, snapshot(), plan: const {0, 2, 4, 5});
      expect(find.text('3 of 4 study days'), findsOneWidget);
      expect(find.text('3 study days so far'), findsNothing);
      expect(find.textContaining('have not planned'), findsNothing);
    });

    testWidgets('on a Sunday night the primary key plans next week and Pause is a quiet key under it', (tester) async {
      var planned = 0;
      await pump(tester, snapshot(), onChangeDays: () => planned++);
      expect(find.text('Plan next week'), findsOneWidget);
      expect(find.text('Pause this week'), findsOneWidget);
      expect(find.ancestor(of: find.text('Pause this week'), matching: find.byType(FlushQuietKey)), findsOneWidget);
      expect(find.ancestor(of: find.text('Plan next week'), matching: find.byType(FlushQuietKey)), findsNothing, reason: 'Plan next week is the primary key');
      expect(tester.getTopLeft(find.text('Plan next week')).dy, lessThan(tester.getTopLeft(find.text('Pause this week')).dy));
      // One way in to the editor, not two.
      expect(find.text('Set your study days'), findsNothing);
      await tester.tap(find.text('Plan next week'));
      expect(planned, 1);
    });

    testWidgets('midweek, with the goal out of reach, Pause stays the primary key and Plan next week is not offered', (tester) async {
      // Saturday 17 October: one day studied, two days left, three more needed for a goal of four.
      final saturday = DateTime.utc(2026, 10, 17, 16, 30);
      await pump(tester, snapshot(days: const ['2026-10-12'], at: saturday));
      expect(find.text('Plan next week'), findsNothing);
      expect(find.text('Pause this week'), findsOneWidget);
      expect(find.ancestor(of: find.text('Pause this week'), matching: find.byType(FlushQuietKey)), findsNothing);
    });
  });
}
