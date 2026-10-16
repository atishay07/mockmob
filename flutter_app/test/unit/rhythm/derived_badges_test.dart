import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/derived_badges.dart';
import 'package:mockmob/features/rhythm/logic/fastest_answer.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';

Attempt _a(
  String id, {
  int day = 1,
  String subject = 'accountancy',
  String mode = 'quick',
  int correct = 7,
  int wrong = 2,
  int total = 10,
  String? formatId,
  String scoring = 'server_practice_v1',
  List<Map<String, Object?>> details = const [],
}) =>
    Attempt.fromJson({
      'id': id,
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': total - correct - wrong,
      'total': total,
      'details': details,
      'questionsSnapshot': const [],
      'selectionMeta': {'mode': mode, 'scoringVersion': scoring},
      'formatId': ?formatId,
      'completedAt': DateTime.utc(2026, 10, day).millisecondsSinceEpoch,
    });

void main() {
  group('derived badges are facts dated by the attempt that earned them', () {
    test('first NTA paper', () {
      final got = deriveBadges([_a('q', day: 1), _a('n', day: 3, mode: 'nta'), _a('n2', day: 5, mode: 'nta')]);
      expect(got['first_nta']?.attemptId, 'n');
      expect(got['first_nta']?.at, DateTime.utc(2026, 10, 3));
    });

    test('5 full mocks lands on the fifth, counting NTA; progress counts until then', () {
      final four = [for (var i = 1; i <= 4; i++) _a('m$i', day: i, mode: i == 2 ? 'nta' : 'full', total: 50, correct: 30, wrong: 5)];
      expect(deriveBadges(four).containsKey('full_mocks_5'), isFalse);
      expect(derivedProgress(four)['full_mocks_5'], 4);
      final five = [...four, _a('m5', day: 9, mode: 'full', total: 50, correct: 30, wrong: 5)];
      expect(deriveBadges(five)['full_mocks_5']?.attemptId, 'm5');
      expect(derivedProgress(five).containsKey('full_mocks_5'), isFalse);
    });

    test('clean set needs every answer right in 10 or more', () {
      expect(deriveBadges([_a('s', total: 8, correct: 8, wrong: 0)]).containsKey('clean_set'), isFalse);
      expect(deriveBadges([_a('c', total: 10, correct: 10, wrong: 0)])['clean_set']?.attemptId, 'c');
    });

    test('four subjects lands on the attempt that makes four', () {
      final list = [
        _a('1', day: 1, subject: 'english'),
        _a('2', day: 2, subject: 'accountancy'),
        _a('3', day: 3, subject: 'english'),
        _a('4', day: 4, subject: 'economics'),
        _a('5', day: 5, subject: 'business_studies'),
      ];
      expect(deriveBadges(list)['four_subjects']?.attemptId, '5');
      expect(derivedProgress(list.take(3).toList())['four_subjects'], 2);
    });

    test('new best needs a strictly higher mark on the same format', () {
      final list = [
        _a('a', day: 1, formatId: 'f1', correct: 6, wrong: 2),
        _a('b', day: 2, formatId: 'f1', correct: 6, wrong: 2),
        _a('c', day: 3, formatId: 'f2', correct: 9, wrong: 0),
        _a('d', day: 4, formatId: 'f1', correct: 7, wrong: 2),
      ];
      expect(deriveBadges(list)['new_best']?.attemptId, 'd');
    });

    test('device-scored attempts never count', () {
      expect(deriveBadges([_a('x', mode: 'nta', scoring: 'device_v0')]), isEmpty);
    });
  });

  group('the sixteen badges', () {
    test('new server ids show only once the server lists them', () {
      final merged = mergeDerived(const [RhythmMilestone(id: 'first_scored_session')], const {}, derivedIds: const ['first_nta', 'full_mocks_5', 'clean_set', 'four_subjects', 'new_best']);
      final shown = milestoneTracks(merged).fold<int>(0, (n, t) => n + t.steps.length);
      expect(shown, 14);
      final listed = [...merged, const RhythmMilestone(id: 'first_hold'), const RhythmMilestone(id: 'run_weeks_3')];
      expect(milestoneTracks(listed).fold<int>(0, (n, t) => n + t.steps.length), 16);
    });

    test('the server date wins over the derived one', () {
      final server = [RhythmMilestone(id: 'clean_set', achievedAt: DateTime.utc(2026, 9, 1))];
      final merged = mergeDerived(server, {'clean_set': DerivedBadge('clean_set', DateTime.utc(2026, 10, 1), 'a')});
      expect(merged.single.achievedAt, DateTime.utc(2026, 9, 1));
    });

    test('best work is not a sequence: every badge not earned is next', () {
      final merged = mergeDerived(const [], const {}, derivedIds: const ['clean_set', 'four_subjects', 'new_best']);
      final best = milestoneTracks(merged).firstWhere((t) => t.track == MilestoneTrack.best);
      expect(best.steps.every((s) => s.status == StepStatus.next), isTrue);
    });
  });

  group('fastest right answer', () {
    test('ignores answers under 3 seconds and wrong answers', () {
      final a = _a('t', details: [
        {'qid': 'q1', 'isCorrect': true, 'timeMs': 2000},
        {'qid': 'q2', 'isCorrect': false, 'timeMs': 4000},
        {'qid': 'q3', 'isCorrect': true, 'timeMs': 9200},
        {'qid': 'q4', 'isCorrect': true, 'timeMs': 12000},
      ]);
      final f = fastestRightAnswer([a]);
      expect(f?.seconds, 9);
      expect(f?.question, 3);
    });

    test('no timings, no claim', () {
      expect(fastestRightAnswer([_a('x')]), isNull);
    });
  });
}
