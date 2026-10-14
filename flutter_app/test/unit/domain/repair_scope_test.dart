import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/marks_at_stake.dart';
import 'package:mockmob/core/domain/repair_candidates.dart';
import 'package:mockmob/core/models/repair.dart';

RepairCandidate _c(String id, int n, String chapter) => RepairCandidate(questionId: id, number: n, chapter: chapter);

void main() {
  // FINDINGS 8 and 26: "Repair these 5" opened a run of one chapter. The key now says what it opens.
  final paper = [
    _c('q2', 2, 'Principles of management'),
    _c('q5', 5, 'Business environment'),
    _c('q9', 9, 'Business environment'),
    _c('q11', 11, 'Planning: meaning and features'),
    _c('q14', 14, 'Business environment'),
  ];

  group('RepairCandidates says what a repair key opens', () {
    test('without a start: tonight\'s chapter, its count, the time and the rest of the paper', () {
      final scope = RepairCandidates.scopeOf(paper)!;
      expect(scope.chapter, 'Business environment');
      expect(scope.firstQuestionId, 'q5');
      expect(scope.count, 3);
      expect(scope.othersInPaper, 2);
      expect(scope.minutes, 10);
      expect(RepairCandidates.keyLabel(scope), 'Repair 3 mistakes');
      expect(RepairCandidates.describe(scope), 'Business environment, about 10 minutes. The other 2 are in Review.');
    });

    test('from a tapped mistake: that chapter only, singular words', () {
      final scope = RepairCandidates.scopeOf(paper, startQuestionId: 'q2')!;
      expect(scope.count, 1);
      expect(scope.othersInPaper, 4);
      expect(RepairCandidates.keyLabel(scope), 'Repair 1 mistake');
      expect(RepairCandidates.describe(scope), 'Principles of management, about 5 minutes. The other 4 are in Review.');
      expect(RepairCandidates.spoken(scope), 'Repair 1 mistake. Principles of management, about 5 minutes. The other 4 are in Review.');
    });

    test('a long chapter name is shortened at its colon; a whole-paper chapter has no note', () {
      final scope = RepairCandidates.scopeOf([_c('a', 1, 'Planning: meaning and features'), _c('b', 4, 'Planning: meaning and features')])!;
      expect(RepairCandidates.describe(scope), 'Planning, about 10 minutes.');
    });

    test('a limit keeps the run to that many; an unknown start or no candidates opens nothing', () {
      expect(RepairCandidates.scopeOf(paper, limit: 2)!.count, 2);
      expect(RepairCandidates.scopeOf(paper, startQuestionId: 'nope'), isNull);
      expect(RepairCandidates.scopeOf(const []), isNull);
    });

    test('questions with no chapter are said plainly', () {
      final scope = RepairCandidates.scopeOf([_c('a', 1, '')])!;
      expect(scope.hasNamedChapter, isFalse);
      expect(RepairCandidates.describe(scope), 'Questions with no chapter, about 5 minutes.');
    });
  });

  group('marksAtStake, the same sentence as the website', () {
    test('CUET: 6 marks, 5 not earned and 1 penalty', () {
      final m = marksAtStake(MarkingScheme.cuet)!;
      expect(m.total, 6);
      expect(m.line, 'This answer cost 6 marks in this session: 5 not earned and 1 penalty.');
    });

    test('an unknown scheme shows no line', () {
      expect(marksAtStake(null), isNull);
      expect(markingSchemeOf(null), isNull);
    });
  });

  group('RepairExplanation reads v2 and keeps v1', () {
    test('v2 fields, the trap heading and the rule', () {
      final e = RepairExplanation.fromJson({
        'trap_type': 'partly_true',
        'trap': ' B names a real feature of planning. ',
        'why_wrong': 'It describes control, not planning.',
        'another_way': 'Planning looks forward; control looks back.',
        'contrast': 'If the question asked about control, B would be right.',
        'rule': 'Check whether the option looks forward or back.',
        'next_step': 'Try two more on planning.',
      });
      expect(e.isV2, isTrue);
      expect(e.trapHeading, 'A partly true option');
      expect(e.whyTempting, 'B names a real feature of planning.');
      expect(e.keyIdea, 'Check whether the option looks forward or back.', reason: 'the rule stands in for a missing key_idea');
      expect(e.keepLine, e.rule);
      expect(e.contrast, isNotNull);
    });

    test('an unknown trap type reads as neutral wording, never a code', () {
      final e = RepairExplanation.fromJson({'trap_type': 'brand_new_kind', 'rule': 'Read every word.'});
      expect(e.trapHeading, 'The trap in this option');
    });

    test('a v1 payload has no heading and keeps its key idea', () {
      final e = RepairExplanation.fromJson({'key_idea': 'The idea.', 'why_tempting': 'Tempting.', 'why_wrong': 'Wrong.'});
      expect(e.isV2, isFalse);
      expect(e.trapHeading, isNull);
      expect(e.keepLine, 'The idea.');
    });

    test('a v2 explained response with only a rule is accepted', () {
      final r = RepairResponse.fromJson({
        'status': 'explained',
        'repair': {'rule': 'Read every word.', 'trap': 'T.', 'why_wrong': 'W.'},
      });
      expect(r.explanation!.keyIdea, 'Read every word.');
    });
  });
}
