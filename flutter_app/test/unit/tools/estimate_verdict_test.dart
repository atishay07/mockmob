// The one estimate model of the Colleges area (L26): verdicts in words with real figures, which
// source wins, the mock range, the typed estimate's storage and its migration, and the keep
// reasons of the Combo planner (L27). Pure: no phone, no network.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/tools/compass/compass_controller.dart';
import 'package:mockmob/features/tools/data/tools_store.dart';
import 'package:mockmob/features/tools/domain/du_combos.dart';
import 'package:mockmob/features/tools/domain/du_mock_score.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/estimate/estimate.dart';
import 'package:mockmob/features/tools/estimate/estimate_providers.dart';

import 'tools_test_support.dart';

Attempt _mock(String subject, {required int correct, int day = 1}) => Attempt.fromJson({
      'id': '$subject-$day',
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': 0,
      'unattempted': 50 - correct,
      'total': 50,
      'mode': 'full',
      'completedAt': DateTime.utc(2026, 10, day).toIso8601String(),
    });

void main() {
  group('verdicts', () {
    const range = Estimate(source: EstimateSource.mocks, low: 588, high: 640);

    test('safe by the low end, in reach by the high end, needs by the gap to the high end', () {
      expect(verdictFor(range, 575.6).v, Verdict.clears);
      expect(verdictWords(verdictFor(range, 575.6)), 'Safe, with 12.4 marks to spare');
      expect(verdictWords(verdictFor(range, 612)), 'In reach if you score 612');
      expect(verdictWords(verdictFor(range, 907.5)), 'Needs 267.5 more');
      expect(verdictFor(range, null).v, Verdict.noSeat);
    });

    test('figures read to one decimal without a trailing zero', () {
      expect(estimateRange(range), '588 to 640');
      expect(estimateRange(const Estimate(source: EstimateSource.typed, low: 612, high: 612)), '612');
      expect(estimateFigure(907.5), '907.5');
      expect(estimateFigure(645.25), '645.3');
    });
  });

  group('which estimate wins', () {
    final typedOld = Estimate(source: EstimateSource.typed, low: 600, high: 650, at: DateTime.utc(2026, 10, 1));
    final typedNew = Estimate(source: EstimateSource.typed, low: 600, high: 650, at: DateTime.utc(2026, 10, 9));
    final mocks = Estimate(source: EstimateSource.mocks, low: 588, high: 640, at: DateTime.utc(2026, 10, 5));
    const projection = Estimate(source: EstimateSource.projection, low: 610, high: 660);

    test('a figure typed after the newest mock wins; a newer mock takes over', () {
      expect(pickEstimate(typed: typedNew, mocks: mocks, projection: projection), typedNew);
      expect(pickEstimate(typed: typedOld, mocks: mocks, projection: projection), mocks);
    });

    test('then mocks, then the projection; nothing when there is none', () {
      expect(pickEstimate(mocks: mocks, projection: projection), mocks);
      expect(pickEstimate(projection: projection), projection);
      expect(pickEstimate(typed: typedOld), typedOld);
      expect(pickEstimate(), isNull);
    });
  });

  group('the range from full mocks', () {
    final catalog = DuCatalog.fromJson((jsonDecode(duIndexJson) as Map).cast<String, dynamic>());
    final commerce = DuSelection.fromIds(commerceSubjects, catalog);

    test('each paper spans its last three full mocks; one mock each is a single figure', () {
      final r = duMockRange([
        _mock('english', correct: 30, day: 1), // 150, oldest of four: not counted
        _mock('english', correct: 34, day: 2), // 170
        _mock('english', correct: 36, day: 3), // 180
        _mock('english', correct: 32, day: 4), // 160 newest
        _mock('accountancy', correct: 40, day: 4),
        _mock('business_studies', correct: 30, day: 4),
        _mock('economics', correct: 36, day: 4),
      ], commerce);
      expect(r, isNotNull);
      expect(r!.low, 160 + 200 + 150 + 180);
      expect(r.high, 180 + 200 + 150 + 180);
      expect(r.latestTotal, 160 + 200 + 150 + 180);
      expect(r.at, DateTime.utc(2026, 10, 4));
    });

    test('fewer than four papers: no range, and the partial names what is missing', () {
      final attempts = [_mock('english', correct: 30), _mock('accountancy', correct: 40)];
      expect(duMockRange(attempts, commerce), isNull);
      final p = duMockPartial(attempts, commerce);
      expect(p?.filled, 2);
      expect(p?.missing, ['business_studies', 'economics']);
      expect(duMockPartial(const [], commerce), isNull);
    });
  });

  group('the typed estimate on this phone', () {
    test('a range and its time are saved and read back', () async {
      final prefs = MemoryPrefsStore();
      final store = ToolsStore(prefs);
      final at = DateTime.utc(2026, 10, 9, 8);
      await store.saveCompass(SavedCompass(subjects: 'english', score: '600', scoreHigh: '650', scoreAt: at));
      final back = await store.compass();
      expect(back?.score, '600');
      expect(back?.scoreHigh, '650');
      expect(back?.scoreAt, at.toLocal());
    });

    test('an old saved score becomes a typed point estimate stamped once (migration)', () async {
      final now = DateTime.utc(2026, 10, 16, 9);
      final prefs = savedCompass('english,accountancy,business_studies,economics', score: '640');
      final c = ProviderContainer(overrides: [
        ...toolsOverrides(prefs: prefs),
        nowProvider.overrideWithValue(() => now),
      ]);
      addTearDown(c.dispose);
      final s = await c.read(compassControllerProvider.future);
      expect(s.score, 640);
      expect(s.scoreAt, now);
      final e = c.read(typedEstimateProvider);
      expect(e?.isPoint, isTrue);
      expect(e?.at, now);
      await Future<void>.delayed(Duration.zero);
      expect(prefs.values['mm.tools.compass.v1'], contains('"scoreAt":${now.millisecondsSinceEpoch}'));
    });

    test('setEstimate keeps a range, swaps a reversed one, and clearEstimate drops it', () async {
      final c = ProviderContainer(overrides: toolsOverrides(prefs: savedCompass('english,accountancy,business_studies,economics')));
      addTearDown(c.dispose);
      await c.read(compassControllerProvider.future);
      final n = c.read(compassControllerProvider.notifier);
      n.setEstimate(650, 600);
      expect(c.read(typedEstimateProvider)?.low, 600);
      expect(c.read(typedEstimateProvider)?.high, 650);
      expect(c.read(estimateProvider)?.source, EstimateSource.typed);
      n.clearEstimate();
      expect(c.read(typedEstimateProvider), isNull);
      expect(c.read(estimateProvider), isNull);
    });
  });

  group('keep reasons', () {
    DuCombo combo(int unlocked, List<String> met) => DuCombo(items: const [], selection: DuSelection.empty, unlocked: unlocked, met: met);
    const maths = DuPick.domain('mathematics');
    const english = DuPick.language('english');

    test('each kept subject says what goes without it, in real counts', () {
      final plan = DuComboPlan(ranked: [combo(48, ['b-com-hons', 'b-a-hons-economics'])], keep: const [maths, english]);
      final reasons = duKeepReasons(plan, {
        maths: DuComboPlan(ranked: [combo(41, ['b-a-hons-economics'])]),
        english: const DuComboPlan(),
      }, (id) => id == 'b-com-hons' ? 'B.Com. (Hons.)' : id);
      expect(reasons, hasLength(2));
      expect(reasons[0].lostTarget, 'B.Com. (Hons.)');
      expect(reasons[0].fewer, 7);
      expect(reasons[1].nothing, isTrue);
    });
  });
}
