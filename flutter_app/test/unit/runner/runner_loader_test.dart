import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/local_scope.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/storage/app_database.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
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
  late ProviderContainer container;
  const wall = 2000000;

  Future<SessionEngine?> restore(SessionDraft d) async {
    restored.add(d.sessionId);
    return null;
  }

  setUp(() {
    db = newTestDb();
    drafts = SessionDraftRepository(LocalScope(db, () => 'u1', () => DateTime.fromMillisecondsSinceEpoch(wall)));
    restored = [];
    container = ProviderContainer(
      overrides: [
        sessionDraftRepositoryProvider.overrideWithValue(drafts),
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
}
