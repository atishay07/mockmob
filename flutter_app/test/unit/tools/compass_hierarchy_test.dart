// Compass answers first and asks second: the best options lead (the most colleges, or what a
// score could clear), the programmes at one or two colleges fold under "Other programmes", and a
// score can come from the student's own latest mocks instead of being typed.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/tools/compass/compass_controller.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/score_sources.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/domain/du_mock_score.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/estimate/estimate.dart';
import 'package:mockmob/features/tools/estimate/estimate_providers.dart';

import 'tools_test_support.dart';

Attempt _mock(String subject, {required int correct, int wrong = 0, int total = 50, String mode = 'full', int day = 1}) => Attempt.fromJson({
      'id': '$subject-$day-$mode',
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': total - correct - wrong,
      'total': total,
      'mode': mode,
      'completedAt': DateTime.utc(2026, 10, day).toIso8601String(),
    });

void main() {
  final catalog = DuCatalog.fromJson((jsonDecode(duIndexJson) as Map).cast<String, dynamic>());
  final commerce = DuSelection.fromIds(commerceSubjects, catalog);

  group('best options', () {
    test('the open programmes with the most colleges lead, B.Com. (Hons.) first', () {
      final best = compassBestOptions(CompassState(catalog: catalog, selection: commerce));
      expect(best, hasLength(3));
      expect(best.first.group.name, 'B.Com. (Hons.)');
      expect(best.first.group.colleges, 55);
      expect(best.map((r) => r.group.colleges).toList(), orderedEquals([...best.map((r) => r.group.colleges)]..sort((a, b) => b - a)));
    });

    test('with a score, what it could clear comes before what it could not', () {
      final s = CompassState(catalog: catalog, selection: commerce, scoreText: '500');
      final best = compassBestOptions(s);
      final clearing = s.eligible.where((r) => r.group.hasCutoffs && s.couldClear(r.group)).length;
      for (final (i, r) in best.indexed) {
        expect(s.couldClear(r.group), i < clearing, reason: r.group.name);
      }
    });
  });

  group('other programmes', () {
    final s = CompassState(catalog: catalog, selection: commerce);

    test('programmes at one or two colleges, or with no cutoff list, fold away', () {
      final rows = s.eligible.where((r) => r.group.stream == 'Humanities & Social Sciences').toList();
      final split = compassSplitStream(rows, searching: false);
      expect(split.other, isNotEmpty);
      expect(split.other.every((r) => !r.group.hasCutoffs || r.group.colleges < 3), isTrue);
      expect(split.lead.every((r) => r.group.hasCutoffs && r.group.colleges >= 3), isTrue);
      expect(split.lead.length + split.other.length, rows.length);
    });

    test('nothing folds while searching, or when the whole stream is small', () {
      final rows = s.eligible.where((r) => r.group.stream == 'Humanities & Social Sciences').toList();
      expect(compassSplitStream(rows, searching: true).other, isEmpty);
      final vocational = s.eligible.where((r) => r.group.stream == 'Vocational').toList();
      if (vocational.isNotEmpty) expect(compassSplitStream(vocational, searching: false).other, isEmpty);
    });

    test('the row says what it holds', () {
      expect(ToolsCopy.otherProgrammesSemantics(9, false), contains('9 other programmes'));
      expect(ToolsCopy.otherProgrammesNote, isNot(contains('!')));
    });
  });

  group('a score from the latest mocks', () {
    test('the latest full mock per subject: one language and the best three domain papers', () {
      final score = duMockScore([
        _mock('english', correct: 40, wrong: 5, day: 3), // 195
        _mock('english', correct: 45, day: 1), // older: not counted
        _mock('accountancy', correct: 30, wrong: 10, day: 2), // 140
        _mock('business_studies', correct: 42, day: 2), // 210
        _mock('economics', correct: 36, wrong: 4, day: 2), // 176
      ], commerce);
      expect(score, isNotNull);
      expect(score!.total, 195 + 140 + 210 + 176);
      expect(score.papers.first.id, 'english');
      expect(score.papers.first.language, isTrue);
      expect(score.papers.skip(1).map((p) => p.marks).toList(), [210, 176, 140]);
    });

    test('a quick practice, a short paper or a subject not ticked is never counted', () {
      expect(
        duMockScore([
          _mock('english', correct: 40),
          _mock('accountancy', correct: 30),
          _mock('business_studies', correct: 42),
          _mock('economics', correct: 9, total: 10), // a short paper
        ], commerce),
        isNull,
      );
      expect(
        duMockScore([
          _mock('english', correct: 40),
          _mock('accountancy', correct: 30),
          _mock('business_studies', correct: 42),
          _mock('economics', correct: 30, mode: 'quick'),
        ], commerce),
        isNull,
      );
      expect(
        duMockScore([
          _mock('english', correct: 40),
          _mock('accountancy', correct: 30),
          _mock('business_studies', correct: 42),
          _mock('physics', correct: 30),
        ], commerce),
        isNull,
      );
    });

    test('the provider reads the ticked subjects and the attempts on this phone', () async {
      final c = ProviderContainer(
        overrides: toolsOverrides(
          attempts: [
            _mock('english', correct: 40),
            _mock('accountancy', correct: 30),
            _mock('business_studies', correct: 42),
            _mock('economics', correct: 36, mode: 'nta'),
          ],
        ),
      );
      addTearDown(c.dispose);
      await c.read(compassControllerProvider.future);
      await c.read(practiceSubjectsProvider.future);
      expect(c.read(compassMockScoreProvider)?.total, 200 + 150 + 210 + 180);
      expect(ToolsCopy.categorySummaryMocks('UR', 740), 'Unreserved. Your latest full mocks: 740 of 1000');
      // The one estimate every screen reads, from mocks: one mock per paper is the total plus and
      // minus its spread (19 Oct, D109), never a single figure that claims more than it knows.
      final e = c.read(estimateProvider);
      expect(e?.source, EstimateSource.mocks);
      expect(e!.isPoint, isFalse);
      expect(e.low, lessThan(740));
      expect(e.high, greaterThan(740));
      expect((e.low + e.high) / 2, closeTo(740, 5));
    });
  });
}
