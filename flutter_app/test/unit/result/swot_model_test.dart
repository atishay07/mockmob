import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/features/result/full/swot_section.dart' show swotPracticeHref;

import 'support/fixtures.dart';

/// The hand-written stand-in for the 3-mock answer (`test/fixtures/swot_contract_stand_in.json`). It
/// carries unknown fields at three levels on purpose, and the specific values below are its own.
Map<String, dynamic> _contract() => jsonDecode(File('test/fixtures/swot_contract_stand_in.json').readAsStringSync()) as Map<String, dynamic>;

/// The website's real `contract_v1.json` (copied from `data/tests/fixtures/swot/`), built by the
/// server's own code. It must parse with no change to the models.
Map<String, dynamic> _webContract() => jsonDecode(File('test/fixtures/swot_contract_v1.json').readAsStringSync()) as Map<String, dynamic>;

AttemptDetail _detailWith(Map<String, dynamic> extra) => AttemptDetail.fromJson({...attemptJson(), ...extra});

Iterable<String> _strings(Object? v) sync* {
  if (v is String) yield v;
  if (v is List) {
    for (final e in v) {
      yield* _strings(e);
    }
  }
  if (v is Map) {
    for (final e in v.values) {
      yield* _strings(e);
    }
  }
}

void main() {
  group('the contract fixture', () {
    test('parses into the models, in the order the server sent it', () {
      final detail = _detailWith(_contract());
      final swot = detail.swot!;
      expect(swot.version, 1);
      expect(swot.state, Swot.ready);
      expect(swot.isReady, isTrue);
      expect(swot.isVisible, isTrue);
      expect(swot.message, isNull);

      expect(swot.basis!.line, 'From 49 of 50 questions in this paper and 212 earlier answers in Accountancy across 6 papers.');
      expect(swot.basis!.heldLine, '1 question under re-check or corrected is left out of this read.');
      expect([swot.basis!.counted, swot.basis!.total, swot.basis!.held], [49, 50, 1]);
      expect([swot.basis!.earlierPapers, swot.basis!.earlierAnswers, swot.basis!.timing], [6, 212, 'recorded']);

      expect(swot.quadrants.map((q) => q.id), [SwotQuadrant.strength, SwotQuadrant.weakness, SwotQuadrant.opportunity, SwotQuadrant.threat]);
      expect(swot.quadrants.map((q) => q.label), ['Strengths', 'Weaknesses', 'Opportunities', 'Threats']);
      expect(swot.quadrants.map((q) => q.items.length), [2, 2, 2, 2]);
      expect(swot.quadrants.every((q) => q.isVisible && q.empty == null), isTrue);

      final strong = swot.quadrants.first.items.first;
      expect([strong.id, strong.kind, strong.title, strong.chapter], ['strong_chapter:Partnership', 'strong_chapter', 'Partnership', 'Partnership']);
      expect(strong.detail, '14 right of 16 across 4 papers, 4 of 4 in this one.');
      expect(strong.questions, isEmpty);
      expect(strong.planId, isNull);

      final weak = swot.quadrants[1].items.first;
      expect(weak.questions, [9, 14, 27, 33]);
      expect(weak.planId, 'p2');

      expect(swot.plan.map((p) => p.id), ['p1', 'p2', 'p3']);
      final p2 = swot.plan[1];
      expect(p2.label, 'Practise 10 on Depreciation');
      expect(p2.reason, '22 marks lost here in this paper, and 6 right of 18 across 3 papers.');
      expect([p2.practice.subject, p2.practice.mode, p2.practice.count, p2.practice.chapter], ['accountancy', 'quick', 10, 'Depreciation']);
      expect(p2.href, startsWith('/dashboard?subject=accountancy'));
      expect(p2.later!.line, 'A set on this chapter on 16 Oct: 7 right of 10.');
      expect([p2.later!.at, p2.later!.right, p2.later!.of], [1792143000000, 7, 10]);
      expect(swot.plan.first.later, isNull);
    });

    test('record lines arrive per question, in order, and an unknown kind or field changes nothing', () {
      final detail = _detailWith(_contract());
      expect(detail.mistakeInsights.keys, ['q12', 'q18']);
      final lines = detail.mistakeInsights['q12']!.lines;
      expect(lines.map((l) => l.kind), ['change', 'time', 'repeat_same', 'chapter']);
      expect(lines.first.text, 'You first chose C here, then changed to B.');
      expect(lines[1].text, '41s on this question. Your median in this paper was 55s over 48 timed questions.');
      expect(detail.mistakeInsights['q18']!.lines, hasLength(1));
    });

    test('unknown fields (top level, swot, items) are ignored, and the attempt still parses', () {
      final detail = _detailWith(_contract());
      expect(detail.attempt.id, 'a7');
      expect(detail.swot!.quadrants, hasLength(4));
    });

    test('every string follows the copy rules: no exclamation mark, em dash, en dash or middle dot', () {
      final all = _strings(_contract()).toList();
      expect(all, isNotEmpty);
      for (final s in all) {
        expect(s, isNot(contains('!')), reason: s);
        expect(s, isNot(contains('—')), reason: s);
        expect(s, isNot(contains('–')), reason: s);
        expect(s, isNot(contains('·')), reason: s);
      }
    });
  });

  group("the website's contract_v1.json", () {
    test('parses with no change to the models, and every field matches the file in the server order', () {
      final raw = _webContract();
      final detail = _detailWith(raw);
      final rawSwot = raw['swot'] as Map<String, dynamic>;
      final swot = detail.swot!;
      expect(swot.state, rawSwot['state']);
      expect(swot.isReady, isTrue);
      expect(swot.isVisible, isTrue);

      final rawBasis = rawSwot['basis'] as Map<String, dynamic>;
      expect(swot.basis!.line, rawBasis['line']);
      expect(swot.basis!.heldLine, rawBasis['heldLine']);
      expect([swot.basis!.counted, swot.basis!.total, swot.basis!.held], [rawBasis['counted'], rawBasis['total'], rawBasis['held']]);
      expect([swot.basis!.earlierPapers, swot.basis!.earlierAnswers, swot.basis!.timing], [rawBasis['earlierPapers'], rawBasis['earlierAnswers'], rawBasis['timing']]);

      final rawQuadrants = (rawSwot['quadrants'] as List).cast<Map<String, dynamic>>();
      expect(swot.quadrants.map((q) => q.id), [SwotQuadrant.strength, SwotQuadrant.weakness, SwotQuadrant.opportunity, SwotQuadrant.threat]);
      expect(swot.quadrants.map((q) => q.id), rawQuadrants.map((q) => q['id']));
      for (var i = 0; i < rawQuadrants.length; i++) {
        final rq = rawQuadrants[i];
        final q = swot.quadrants[i];
        final rawItems = (rq['items'] as List).cast<Map<String, dynamic>>();
        expect(q.label, rq['label']);
        expect(q.empty, rq['empty']);
        expect(q.items.map((e) => e.id), rawItems.map((e) => e['id']), reason: q.id);
        for (var k = 0; k < rawItems.length; k++) {
          final it = q.items[k];
          final ri = rawItems[k];
          expect([it.kind, it.title, it.detail, it.chapter, it.planId], [ri['kind'], ri['title'], ri['detail'], ri['chapter'], ri['planId']], reason: it.id);
          expect(it.questions, (ri['questions'] as List).cast<int>(), reason: it.id);
        }
      }

      final rawPlan = (rawSwot['plan'] as List).cast<Map<String, dynamic>>();
      expect(swot.plan.map((p) => p.id), rawPlan.map((p) => p['id']));
      for (var i = 0; i < rawPlan.length; i++) {
        final p = swot.plan[i];
        final rp = rawPlan[i];
        final rpr = rp['practice'] as Map<String, dynamic>;
        expect([p.label, p.reason, p.href], [rp['label'], rp['reason'], rp['href']]);
        expect([p.practice.subject, p.practice.mode, p.practice.count, p.practice.chapter], [rpr['subject'], rpr['mode'], rpr['count'], rpr['chapter']]);
        final rl = rp['later'] as Map<String, dynamic>?;
        expect(p.later?.line, rl?['line']);
        expect([p.later?.at, p.later?.right, p.later?.of], [rl?['at'], rl?['right'], rl?['of']]);
      }
      expect(swot.plan.first.later, isNotNull);
    });

    test('every plan row that names a chapter opens chapter practice setup for that chapter', () {
      final swot = _detailWith(_webContract()).swot!;
      expect(swot.plan, isNotEmpty);
      for (final p in swot.plan) {
        final target = ActionRouter.resolve(swotPracticeHref(p.practice));
        expect(target, isA<NativeTarget>(), reason: p.id);
        final uri = Uri.parse((target as NativeTarget).location);
        expect(uri.path, '/practice/setup/chapter', reason: p.id);
        expect(uri.queryParameters['chapter'], p.practice.chapter, reason: p.id);
        expect(uri.queryParameters['subject'], p.practice.subject, reason: p.id);
        expect(uri.queryParameters['count'], '${p.practice.count}', reason: p.id);
      }
    });

    test('the record lines arrive per question in the server order, and the question numbers of each item fit the paper', () {
      final raw = _webContract();
      final detail = _detailWith(raw);
      final rawInsights = (raw['mistakeInsights'] as Map<String, dynamic>).cast<String, dynamic>();
      expect(detail.mistakeInsights.keys, rawInsights.keys);
      for (final e in rawInsights.entries) {
        final rawLines = ((e.value as Map<String, dynamic>)['lines'] as List).cast<Map<String, dynamic>>();
        final lines = detail.mistakeInsights[e.key]!.lines;
        expect(lines.map((l) => [l.kind, l.text]), rawLines.map((l) => [l['kind'], l['text']]), reason: e.key);
      }
      for (final q in detail.swot!.quadrants) {
        for (final it in q.items) {
          for (final n in it.questions) {
            expect(n, inInclusiveRange(1, 50), reason: it.id);
          }
        }
      }
    });

    test('every string follows the copy rules: no exclamation mark, em dash, en dash or middle dot', () {
      final all = _strings(_webContract()).toList();
      expect(all, isNotEmpty);
      for (final s in all) {
        expect(s, isNot(contains('!')), reason: s);
        expect(s, isNot(contains('—')), reason: s);
        expect(s, isNot(contains('–')), reason: s);
        expect(s, isNot(contains('·')), reason: s);
      }
    });
  });

  group('absent and empty', () {
    test('a result without swot or mistakeInsights has none', () {
      final detail = AttemptDetail.fromJson(attemptJson());
      expect(detail.swot, isNull);
      expect(detail.mistakeInsights, isEmpty);
    });

    test('null or malformed blocks give null and an empty map, never a throw', () {
      for (final junk in <Object?>[null, 'x', 7, <Object?>[], true]) {
        final detail = _detailWith({'swot': junk, 'mistakeInsights': junk});
        expect(detail.swot, isNull, reason: '$junk');
        expect(detail.mistakeInsights, isEmpty, reason: '$junk');
      }
    });

    test('checks_pending and too_few carry only their message', () {
      for (final state in [Swot.checksPending, Swot.tooFew]) {
        final swot = Swot.fromJson({
          'version': 1,
          'state': state,
          'message': 'This read appears once the answer checks load.',
          'basis': null,
          'quadrants': <Object>[],
          'plan': <Object>[],
        });
        expect(swot.isMessageOnly, isTrue, reason: state);
        expect(swot.isVisible, isTrue);
        expect(swot.isReady, isFalse);
        expect(swot.basis, isNull);
        expect(swot.quadrants, isEmpty);
        expect(swot.plan, isEmpty);
      }
    });

    test('not_available, an unknown state and a message state with no message draw nothing', () {
      expect(Swot.fromJson({'state': Swot.notAvailable}).isVisible, isFalse);
      expect(Swot.fromJson({'state': 'something_new', 'message': 'Hello.'}).isVisible, isFalse);
      expect(Swot.fromJson({'state': Swot.tooFew}).isVisible, isFalse);
      expect(Swot.fromJson({'state': Swot.tooFew, 'message': '  '}).isVisible, isFalse);
    });

    test('a quadrant has its items or its one quiet line, and neither draws nothing', () {
      final q = SwotQuadrant.fromJson({'id': 'opportunity', 'label': 'Opportunities', 'empty': 'Nothing extra to name from this paper.', 'items': <Object>[]});
      expect(q.isVisible, isTrue);
      expect(q.empty, 'Nothing extra to name from this paper.');
      expect(SwotQuadrant.fromJson({'id': 'threat', 'label': 'Threats', 'items': <Object>[]}).isVisible, isFalse);
      // A group whose label the server forgot still shows its items (the screen supplies the word).
      expect(SwotQuadrant.fromJson({'id': 'threat', 'items': [{'id': 'x', 'title': 'Missed again'}]}).isVisible, isTrue);
    });

    test('pieces that cannot be shown are dropped, the rest stay', () {
      final swot = Swot.fromJson({
        'state': 'ready',
        'quadrants': [
          {
            'id': 'weakness',
            'label': 'Weaknesses',
            'items': [
              {'id': 'a', 'title': 'Depreciation', 'detail': '2 of 6 right.', 'questions': [3, '4', 0, -2, 'x', null, 5.0]},
              {'id': 'b', 'title': '  ', 'detail': 'No title.'},
              {'title': 'No id'},
              'not a map',
            ],
          },
        ],
        'plan': [
          {'id': 'p1', 'label': 'Practise 10 on A', 'reason': 'Why.', 'practice': {'subject': 'accountancy', 'mode': 'quick', 'count': 10, 'chapter': 'A'}},
          {'id': 'p2', 'label': 'No practice', 'reason': 'Why.'},
          {'id': 'p3', 'label': '', 'practice': {'subject': 'accountancy', 'count': 10}},
          {'id': 'p4', 'label': 'No subject', 'practice': {'mode': 'quick', 'count': 10}},
          {'id': 'p5', 'label': 'Mixed', 'reason': 'Because.', 'practice': {'subject': 'english', 'count': '10'}, 'later': {'line': '', 'right': 1, 'of': 2}},
        ],
      });
      final items = swot.quadrants.single.items;
      expect(items.map((i) => i.id), ['a']);
      expect(items.single.questions, [3, 4, 5]);
      expect(items.single.chapter, isNull);
      expect(swot.plan.map((p) => p.id), ['p1', 'p5']);
      expect(swot.plan.last.practice.mode, 'quick');
      expect(swot.plan.last.practice.count, 10);
      expect(swot.plan.last.later, isNull, reason: 'a later line with no words is not shown');
    });

    test('a record entry with no usable line is left out of the map', () {
      final detail = _detailWith({
        'mistakeInsights': {
          'q1': {'lines': [{'kind': 'time', 'text': ''}, {'kind': 'time'}]},
          'q2': {'lines': [{'kind': 'weird_new_kind', 'text': '  Kept.  '}]},
          'q3': 'nope',
          'q4': {'lines': 'nope'},
        },
      });
      expect(detail.mistakeInsights.keys, ['q2']);
      expect(detail.mistakeInsights['q2']!.lines.single.text, 'Kept.');
      expect(detail.mistakeInsights['q2']!.lines.single.kind, 'weird_new_kind');
    });
  });

  group('the in-app link of a plan row', () {
    test('a chapter set opens chapter practice setup with subject, count and chapter', () {
      final p = Swot.fromJson(_contract()['swot'] as Map<String, dynamic>).plan[1].practice;
      expect(swotPracticeHref(p), '/dashboard?subject=accountancy&mode=chapter&count=10&chapter=Depreciation');
      expect(ActionRouter.resolve(swotPracticeHref(p)), const NativeTarget('/practice/setup/chapter?subject=accountancy&chapter=Depreciation&count=10'));
    });

    test('a set with no chapter opens Quick practice setup', () {
      const p = SwotPractice(subject: 'accountancy', mode: 'quick', count: 20);
      expect(swotPracticeHref(p), '/dashboard?subject=accountancy&mode=quick&count=20');
      expect(ActionRouter.resolve(swotPracticeHref(p)), const NativeTarget('/practice/setup/quick?subject=accountancy&count=20'));
    });

    test('a chapter with a space, an ampersand or a plus survives the round trip', () {
      const p = SwotPractice(subject: 'business_studies', mode: 'quick', count: 10, chapter: 'Cost & C++ basics');
      final target = ActionRouter.resolve(swotPracticeHref(p)) as NativeTarget;
      final uri = Uri.parse(target.location);
      expect(uri.path, '/practice/setup/chapter');
      expect(uri.queryParameters['chapter'], 'Cost & C++ basics');
      expect(uri.queryParameters['subject'], 'business_studies');
      expect(uri.queryParameters['count'], '10');
    });

    test('the General Test attempt id is turned into the public id the practice routes read', () {
      const p = SwotPractice(subject: 'gat', mode: 'quick', count: 10);
      expect(ActionRouter.resolve(swotPracticeHref(p)), const NativeTarget('/practice/setup/quick?subject=general_test&count=10'));
    });
  });
}
