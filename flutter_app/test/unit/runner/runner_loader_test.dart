import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_clock.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/sync/session/session_journal.dart';
import 'package:mockmob/core/sync/sync_providers.dart';
import 'package:mockmob/features/runner/data/runner_loader.dart';
import 'package:mockmob/features/runner/nta/nta_copy.dart' show NtaRules;

import '../core_data/support/fixtures.dart';
import '../core_data/support/test_db.dart';

/// NTA mode is exactly 50 questions: a paper of any other length is refused at load, before an
/// engine (and with it the clock) exists (review round 3, pkg-04 #6).
void main() {
  late AppDatabase db;
  late SessionDraftRepository drafts;
  late List<String> restored;
  late List<SessionDraft> restoredDrafts;
  late ProviderContainer container;
  const wall = 2000000;

  Future<SessionEngine?> restore(SessionDraft d) async {
    restored.add(d.sessionId);
    restoredDrafts.add(d);
    return null;
  }

  setUp(() {
    db = newTestDb();
    drafts = SessionDraftRepository(LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall)));
    restored = [];
    restoredDrafts = [];
    container = ProviderContainer(
      overrides: [
        sessionDraftRepositoryProvider.overrideWithValue(drafts),
        nowProvider.overrideWithValue(() => DateTime.fromMillisecondsSinceEpoch(wall)),
        // Records that the engine (and the clock) would have been built; null reads as ended.
        sessionEngineRestorerProvider.overrideWithValue(restore),
      ],
    );
  });

  tearDown(() async {
    container.dispose();
    await db.close();
  });

  Future<RunnerLoad> open(String sessionId) => container.read(runnerOpenerProvider)(sessionId);

  for (final count in [NtaRules.questions - 1, NtaRules.questions + 1]) {
    test('an NTA paper of $count questions is refused and never started', () async {
      await drafts.save(draftOf(sessionId: 'nta-$count', count: count, mode: 'nta', endsAtWallMs: wall + 3600000, mockNumber: null));
      final load = await open('nta-$count');
      expect(load, isA<RunnerBadPaper>().having((l) => l.count, 'count', count));
      expect(restored, isEmpty, reason: 'no engine, so no clock');
    });
  }

  test('an NTA paper of exactly 50 questions opens', () async {
    await drafts.save(draftOf(sessionId: 'nta-50', count: NtaRules.questions, mode: 'nta', endsAtWallMs: wall + 3600000, mockNumber: null));
    final load = await open('nta-50');
    expect(load, isNot(isA<RunnerBadPaper>()));
    expect(restored, ['nta-50']);
  });

  test('the 50 rule is NTA only: a short practice opens', () async {
    await drafts.save(draftOf(sessionId: 'quick-10', count: 10, mode: 'quick', endsAtWallMs: wall + 600000, mockNumber: null));
    await open('quick-10');
    expect(restored, ['quick-10']);
  });

  /// NTA-02: a paper whose clock ran out while the app was killed, with answers the server does
  /// not hold, used to open as "ended" and wait for a backup job the phone may hold back past the
  /// 120 s window. It now opens as owed, so the rebuilt engine sends at once.
  group('time ran out while the app was away', () {
    Future<void> answered(String sessionId) async {
      final clock = SessionClock(monotonicMs: () => 0, wallMs: () => wall)..restore(startedRefWallMs: wall - 3600000, endsAtWallMs: wall);
      final journal = await SessionJournal.open(db, userId: 'u1', sessionId: sessionId);
      await journal.recordAnswer('q1', 2, clock);
    }

    test('unsent answers inside the window reopen the draft as owed', () async {
      await drafts.save(draftOf(sessionId: 'late', mode: 'nta', count: NtaRules.questions, endsAtWallMs: wall - 60000, mockNumber: null));
      await answered('late');
      await open('late');
      expect(restoredDrafts, hasLength(1));
      expect(restoredDrafts.single.pendingSubmission, isTrue, reason: 'the engine must see a submit owed and send at once');
    });

    test('past the 120 s window it stays ended: there is nothing the server would take', () async {
      await drafts.save(draftOf(sessionId: 'gone', mode: 'nta', count: NtaRules.questions, endsAtWallMs: wall - 130000, mockNumber: null));
      await answered('gone');
      final load = await open('gone');
      expect(restoredDrafts.single.pendingSubmission, isFalse);
      expect(load, isA<RunnerEnded>());
    });

    test('with every answer already on the server there is nothing to send', () async {
      await drafts.save(draftOf(sessionId: 'sent', mode: 'nta', count: NtaRules.questions, endsAtWallMs: wall - 60000, mockNumber: null));
      await open('sent');
      expect(restoredDrafts.single.pendingSubmission, isFalse);
    });

    test('a rejected or closed draft is never reopened as owed', () async {
      final base = draftOf(sessionId: 'refused', mode: 'nta', count: NtaRules.questions, endsAtWallMs: wall - 60000, mockNumber: null);
      await drafts.save(base.copyWith(rejected: true));
      await answered('refused');
      await open('refused');
      expect(restoredDrafts.single.pendingSubmission, isFalse);
    });

    test('a paper still running opens as it is', () async {
      await drafts.save(draftOf(sessionId: 'live', mode: 'nta', count: NtaRules.questions, endsAtWallMs: wall + 600000, mockNumber: null));
      await answered('live');
      await open('live');
      expect(restoredDrafts.single.pendingSubmission, isFalse);
    });
  });
}
