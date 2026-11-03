// Round 5 on the app (LK38, LK45 fixes 2 to 4): what the keys promise (`returns`), the one count of "done", a run over several
// chapters, and the app's own words for them, held to the website's by the parity tests.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/run/run_view.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';

Map<String, dynamic> _fixture(String name) => jsonDecode(File('test/fixtures/learn2/$name.json').readAsStringSync()) as Map<String, dynamic>;

Map<String, dynamic> _cardJson({String id = 'it1', Map<String, dynamic>? returns}) {
  final run = _fixture('run_start_mix_pf_pro');
  final card = (run['items'] as List).cast<Map<String, dynamic>>().firstWhere((i) => i['type'] == 'card');
  return {...card, 'id': id, if (returns != null) 'returns': returns else ...{}}..remove(returns == null ? 'returns' : '');
}

Map<String, dynamic> _questionJson(String id) {
  final run = _fixture('run_start_mix_pf_pro');
  final q = (run['items'] as List).cast<Map<String, dynamic>>().firstWhere((i) => i['type'] == 'question');
  return {...q, 'id': id};
}

LearnItem _item(Map<String, dynamic> json) => LearnItem.tryParse(json)!;

void main() {
  group('the keys\' words (`returns`)', () {
    test('a card carries what each rating would do, in the server\'s words', () {
      final item = _item(_cardJson(returns: {'missed': 'in this session, then tomorrow', 'got': 'in 3 days', 'easy': 'in 8 days'})) as LearnCardItem;
      expect(item.returns?.missed, 'in this session, then tomorrow');
      expect(item.returns?.forRating(1), 'in this session, then tomorrow');
      expect(item.returns?.forRating(3), 'in 3 days');
      expect(item.returns?.forRating(4), 'in 8 days');
      expect(item.returns?.forRating(2), isNull);
    });

    test('no words: a look, a recap and a card back from earlier have none, and the keys then have no second line', () {
      final item = _item(_cardJson()) as LearnCardItem;
      expect(item.returns, isNull);
      expect(LearnReturns.tryParse(<String, dynamic>{}), isNull);
      expect(LearnReturns.tryParse('x'), isNull);
    });

    test('a put-back copy keeps the words, a moved card takes the server\'s fresh ones (no "in this run" any more)', () {
      final first = _item(_cardJson(id: 'a', returns: {'missed': 'in this session, then tomorrow', 'got': 'in 3 days', 'easy': 'in 8 days'}));
      final other = _item(_cardJson(id: 'b'));
      final list = [other, first, _item(_cardJson(id: 'c')), _item(_cardJson(id: 'd')), _item(_cardJson(id: 'e')), _item(_cardJson(id: 'f'))];
      final fresh = _item(_cardJson(id: 'a', returns: {'missed': 'tomorrow', 'got': 'in 3 days', 'easy': 'in 8 days'}));
      final moved = RunView.placeReinsert(list, itemId: 'a', at: 4, item: fresh, moved: true, current: 0);
      expect(moved.map((x) => x.id), ['b', 'c', 'd', 'e', 'a', 'f'], reason: 'moved closer (three on from the one on screen), never a copy');
      expect((moved[4] as LearnCardItem).returns?.missed, 'tomorrow');
      expect(RunView.again(first) is LearnCardItem && (RunView.again(first) as LearnCardItem).returns?.got == 'in 3 days', isTrue);
      expect((RunView.withId(first, 'z') as LearnCardItem).returns?.easy, 'in 8 days');
    });
  });

  group('one count of "done": the place of the last item the server holds an event for', () {
    test('reachedPlace', () {
      expect(StageEndModel.reachedPlace<bool>(const [], (h, _) => h), 0);
      expect(StageEndModel.reachedPlace<bool>(const [false, false, false], (h, _) => h), 0);
      expect(StageEndModel.reachedPlace<bool>(const [true, false, false], (h, _) => h), 1);
      expect(StageEndModel.reachedPlace<bool>(const [false, true, false, false], (h, _) => h), 2, reason: 'the place, not a count of events');
      expect(StageEndModel.reachedPlace<bool>(const [true, false, true, false, false], (h, _) => h, 3), 6, reason: 'a resumed run adds the items done before it');
    });

    test('itemHeld: a card passed, a lesson passed and an answered question hold one; a skipped question and the card on screen do not (until it is rated)', () {
      final card = _item(_cardJson(id: 'c'));
      final question = _item(_questionJson('q'));
      expect(RunView.itemHeld(item: card, index: 0, at: 2), isTrue, reason: 'a card before the one on screen was rated or looked at');
      expect(RunView.itemHeld(item: question, index: 0, at: 2), isFalse, reason: 'a question skipped writes nothing');
      expect(RunView.itemHeld(item: question, index: 0, at: 2, answered: true), isTrue);
      expect(RunView.itemHeld(item: card, index: 2, at: 2), isFalse, reason: 'on screen, not rated yet');
      expect(RunView.itemHeld(item: card, index: 2, at: 2, acted: true), isTrue, reason: 'its rating is in the server\'s hands while it flies away');
      expect(RunView.itemHeld(item: card, index: 3, at: 2, acted: true), isFalse, reason: 'ahead of the one on screen');
    });
  });

  group('a run over several chapters', () {
    test('arrives headed Revise with no place and the spans flag; one chapter keeps its name', () {
      final spans = LearnRunChapter.parse({'key': 'accountancy.admission-of-partner', 'title': 'Revise', 'ref': null, 'partTitle': null, 'number': null, 'place': null, 'spans': true});
      expect(spans.title, 'Revise');
      expect(spans.place, isNull);
      expect(spans.ref, isNull);
      expect(spans.spans, isTrue);
      final one = LearnRunChapter.parse({'key': 'accountancy.goodwill', 'title': 'Goodwill', 'place': {'n': 5, 'of': 14}});
      expect((one.title, one.spans, one.place?.label), ('Goodwill', false, 'Chapter 5 of 14'));
      final end = LearnEndChapter.tryParse({'key': 'accountancy.admission-of-partner', 'title': 'Revise', 'place': null, 'spans': true});
      expect(end?.title, 'Revise');
      expect(end?.place, isNull);
      expect(end?.spans, isTrue);
    });
  });
}
