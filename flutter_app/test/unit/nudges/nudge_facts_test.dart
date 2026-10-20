// How the nudges read the account (D191): the attempts list, the store, and the demo's fixtures for every kind.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/nudges/nudges.dart';

import 'nudge_test_kit.dart';

Attempt _paper(String id, {required String subject, required int correct, required int wrong, int total = 10, required DateTime at}) =>
    Attempt.fromJson({'id': id, 'subject': subject, 'score': 0, 'correct': correct, 'wrong': wrong, 'unattempted': total - correct - wrong, 'total': total, 'completedAt': at.toUtc().toIso8601String()});

void main() {
  final now = DateTime(2026, 10, 21, 19, 30);

  test('every kind has a demo fixture that picks it, and a fresh account picks none', () {
    for (final kind in NudgeKind.values) {
      final at = NudgeFixtures.nowFor(kind);
      final offer = NudgeRules.pick(nudgeFactsFor(NudgeFixtures.forKind(kind, now: at), at));
      expect(offer?.kind, kind, reason: kind.name);
      expect(offer?.surface, kind == NudgeKind.friendPaid || kind == NudgeKind.mobGame ? NudgeSurface.sheet : NudgeSurface.card);
    }
    expect(NudgeRules.pick(nudgeFactsFor(NudgeSignals.none, now)), isNull);
  });

  test('the attempts say practised today and the latest result as a share of the marks', () {
    final yesterday = now.subtract(const Duration(days: 1));
    final papers = [
      _paper('a1', subject: 'economics', correct: 5, wrong: 2, at: yesterday.subtract(const Duration(days: 2))),
      // 9 right, 1 wrong: 44 of 50 marks, 88 percent, the best in economics.
      _paper('a2', subject: 'economics', correct: 9, wrong: 1, at: yesterday),
    ];
    final r = attemptSignals(papers, now);
    expect(r.practisedToday, isFalse);
    expect(r.latest?.attemptId, 'a2');
    expect(r.latest?.percent, 88);
    expect(r.latest?.best, isTrue);

    final today = attemptSignals([...papers, _paper('a3', subject: 'english', correct: 3, wrong: 0, at: now.subtract(const Duration(hours: 1)))], now);
    expect(today.practisedToday, isTrue);
    expect(today.latest?.attemptId, 'a3');
    // The first paper in a subject is never a "best".
    expect(today.latest?.best, isFalse);
    expect(attemptSignals(const [], now).latest, isNull);
  });

  test('the store keeps one JSON string per account and reads back what it wrote', () async {
    final prefs = MemoryPrefsStore();
    final store = NudgeStore(prefs);
    expect((await store.load('u1')).seenEvents, isEmpty);
    await store.save('u1', NudgeMemory.empty.dismiss(NudgeKind.creditsLow, now).seen('reward:1'));
    expect(prefs.values.keys, ['nudges.v1.u1']);
    final back = await store.load('u1');
    expect(back.dismissedAt[NudgeKind.creditsLow], now);
    expect(back.seenEvents, {'reward:1'});
    expect((await store.load('u2')).seenEvents, isEmpty);
    // Something that is not JSON reads as nothing remembered.
    await prefs.setString('nudges.v1.u3', '{not json');
    expect((await store.load('u3')).dismissedAt, isEmpty);
  });
}
