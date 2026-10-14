import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/core/widgets/question_strip.dart' show QuestionCell;
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/model/practice_result_model.dart';

import '../core_data/support/fixtures.dart';

Attempt _attempt(List<(String, V)> questions) => attemptOf(id: 'p1', mode: 'quick', questions: questions);

void main() {
  group('PracticeResultModel', () {
    test('keeps right, wrong and not attempted apart, in question order', () {
      final attempt = _attempt([('Goodwill', V.right), ('Goodwill', V.wrong), ('Goodwill', V.blank), ('Goodwill', V.right)]);
      final model = PracticeResultModel.from(attempt);
      expect(model.cells, [QuestionCell.right, QuestionCell.wrong, QuestionCell.blank, QuestionCell.right]);
      expect(model.correct.map((q) => q.number), [1, 4]);
      expect(model.wrong.map((q) => q.number), [2]);
      expect(model.blank.map((q) => q.number), [3]);
      expect(model.wrong.first.givenIndex, 1);
      expect(model.blank.first.givenIndex, isNull);
    });

    test('an attempt with no per-question rows has none to list', () {
      final json = attemptJson(questions: [('A', V.right)]);
      json['details'] = <Map<String, dynamic>>[];
      final model = PracticeResultModel.from(Attempt.fromJson(json));
      expect(model.hasRows, isFalse);
    });

    test('a figure of 8 of 10 is correct over total, from the server counts', () {
      final attempt = _attempt([for (var i = 0; i < 8; i++) ('Goodwill', V.right), ('Goodwill', V.wrong), ('Goodwill', V.blank)]);
      expect(attempt.correct, 8);
      expect(attempt.total, 10);
      expect(attempt.wrong, 1);
      expect(attempt.unattempted, 1);
    });
  });

  group('KeyView follows the key rule of spec 5.7', () {
    Map<String, dynamic> detailJson({Map<String, dynamic>? reviews, String state = 'ready'}) => {
      ...attemptJson(id: 'p1', mode: 'quick', questions: [('Goodwill', V.wrong), ('Goodwill', V.right)]),
      'answerReviews': reviews ?? <String, dynamic>{},
      'answerReviewState': state,
    };

    test('no review marks the stored key and shows the explanation', () {
      final detail = AttemptDetail.fromJson(detailJson());
      final view = KeyView.of(detail, 'p1-q1');
      expect(view.state, KeyState.ready);
      expect(view.keyIndex, 0);
      expect(view.explanation, isNotEmpty);
    });

    test('a corrected review uses its current index', () {
      final detail = AttemptDetail.fromJson(
        detailJson(
          reviews: {
            'p1-q1': {'state': 'corrected', 'currentIndex': 1, 'explanation': 'Fixed.'},
          },
        ),
      );
      final view = KeyView.of(detail, 'p1-q1');
      expect(view.keyIndex, 1);
      expect(view.explanation, 'Fixed.');
    });

    test('any other review shows no key and no explanation', () {
      for (final state in ['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified']) {
        final detail = AttemptDetail.fromJson(
          detailJson(
            reviews: {
              'p1-q1': {'state': state},
            },
          ),
        );
        final view = KeyView.of(detail, 'p1-q1');
        expect(view.state, KeyState.held, reason: state);
        expect(view.keyIndex, isNull, reason: state);
        expect(view.explanation, isNull, reason: state);
      }
    });

    test('unavailable reviews mean no keys at all', () {
      final detail = AttemptDetail.fromJson(detailJson(state: 'unavailable'));
      final view = KeyView.of(detail, 'p1-q2');
      expect(view.state, KeyState.unavailable);
      expect(view.keyIndex, isNull);
    });

    test('before the result read arrives there is nothing to show', () {
      expect(KeyView.of(null, 'p1-q1').state, KeyState.loading);
    });
  });

  group('subject chips', () {
    test('the student\'s subjects first, the commerce four when none, the selection always present', () {
      expect(subjectChoices(chosen: const [], selected: 'accountancy').map((c) => c.id), [
        'english',
        'accountancy',
        'business_studies',
        'economics',
      ]);
      expect(subjectChoices(chosen: const ['economics', 'english'], selected: 'economics').map((c) => c.name), ['Economics', 'English']);
      expect(subjectChoices(chosen: const ['economics'], selected: 'physics').map((c) => c.id), ['economics', 'physics']);
    });

    test('other subjects exclude the chips already shown', () {
      const catalog = [
        Subject(id: 'english', internalId: 'english', name: 'English', practice: 'supported'),
        Subject(id: 'physics', internalId: 'physics', name: 'Physics', practice: 'supported'),
      ];
      final shown = subjectChoices(chosen: const ['english'], selected: 'english', catalog: catalog);
      expect(otherSubjects(shown: shown, catalog: catalog).map((c) => c.id), ['physics']);
    });

    test('the attempt-side subject id comes from the catalog, with gat as the one known exception', () {
      const catalog = [Subject(id: 'general_test', internalId: 'gat', name: 'General test', practice: 'supported')];
      expect(internalSubjectFor('general_test', catalog), 'gat');
      expect(internalSubjectFor('general_test', null), 'gat');
      expect(internalSubjectFor('accountancy', null), 'accountancy');
    });

    test('mock number is finished mocks plus one, and absent when unknown', () {
      expect(mockLabelFor(6), 'Mock 7');
      expect(mockLabelFor(0), 'Mock 1');
      expect(mockLabelFor(null), isNull);
    });
  });
}
