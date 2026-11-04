// The app's stage text rules against the website's own: `test/fixtures/learn2/parity/stage_text.json` holds what
// stageText.mjs and runMath.js stemParts return for the Learn preview's 53 real questions, the Key cards of the display
// parity fixture and a set of edge strings (written by tool/learn2_parity/stage_text.mjs, which imports the web's
// functions). Every case is checked on every output, so a rule that drifts on one real stem fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/stage_text.dart';

List<Map<String, String>> _list(List<StageListItem> items) => [for (final x in items) {'label': x.label, 'text': x.text}];

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/stage_text.json').readAsStringSync()) as Map<String, dynamic>;
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();

  test('the fixture holds the real questions, every stem shape and the cards', () {
    final counts = data['counts'] as Map<String, dynamic>;
    expect(counts['questions'], 53);
    expect(counts['cards'], greaterThan(300));
    final stems = rows('stems');
    expect(stems.where((s) => s['assertionReason'] != null).length, greaterThanOrEqualTo(4));
    expect(stems.where((s) => s['matchLists'] != null).length, greaterThanOrEqualTo(4));
    expect(stems.where((s) => s['statementList'] != null).length, greaterThanOrEqualTo(5));
    expect(stems.where((s) => s['stemParts'] != null).length, greaterThanOrEqualTo(10));
  });

  group('stems', () {
    for (final s in rows('stems')) {
      test('${s['id']}', () {
        final stem = s['stem'] as String;
        final ar = StageText.assertionReason(stem);
        final wantAr = s['assertionReason'] as Map<String, dynamic>?;
        expect(ar == null ? null : {'assertion': ar.assertion, 'reason': ar.reason}, wantAr, reason: 'assertionReason');

        final ml = StageText.matchLists(stem);
        final wantMl = s['matchLists'] as Map<String, dynamic>?;
        expect(ml == null ? null : {'lead': ml.lead, 'one': _list(ml.one), 'two': _list(ml.two), 'tail': ml.tail}, wantMl, reason: 'matchLists');

        final st = StageText.statementList(stem);
        final wantSt = s['statementList'] as Map<String, dynamic>?;
        expect(st == null ? null : {'lead': st.lead, 'items': _list(st.items), 'tail': st.tail}, wantSt, reason: 'statementList');

        final sp = StageText.stemParts(stem);
        final wantSp = s['stemParts'] as Map<String, dynamic>?;
        expect(sp == null ? null : {'lead': sp.lead, 'steps': _list(sp.steps), 'tail': sp.tail}, wantSp, reason: 'stemParts');

        expect(StageText.stemSize(stem), s['stemSize'], reason: 'stemSize');
      });
    }
  });

  test('option texts and two columns, for every option set', () {
    for (final o in rows('options')) {
      final options = [
        for (final x in (o['options'] as List).cast<Map<String, dynamic>>()) (key: x['key'] as String, text: x['text'] as String),
      ];
      final texts = StageText.optionTexts(options);
      expect(texts, o['optionTexts'], reason: 'optionTexts of $options');
      expect(StageText.twoColumns(texts), o['twoColumns'], reason: 'twoColumns of $texts');
    }
  });

  test('front sizes and the spoken front, for every card front', () {
    for (final f in rows('fronts')) {
      final t = f['text'] as String;
      expect(StageText.frontSize(t), f['frontSize'], reason: 'frontSize of "$t"');
      expect(StageText.speakable(t), f['speakable'], reason: 'speakable of "$t"');
    }
  });

  test('back sizes, for every card back', () {
    for (final b in rows('backs')) {
      final t = b['text'] as String;
      expect(StageText.backSize(t), b['backSize'], reason: 'backSize of "$t"');
    }
  });

  test('the done line', () {
    for (final d in rows('doneLines')) {
      final input = d['input'] as Map<String, dynamic>;
      expect(
        StageText.doneLine(reached: (input['reached'] as num?)?.toInt() ?? 0, of: (input['of'] as num?)?.toInt() ?? 0, minutes: input['minutes'] as num?),
        d['out'],
        reason: 'doneLine $input',
      );
    }
  });

  test('time left', () {
    for (final t in rows('timeLeft')) {
      expect(StageText.timeLeft(t['seconds'] as num), t['out'], reason: 'timeLeft ${t['seconds']}');
    }
  });

  test('minutes left (walk I12)', () {
    for (final t in rows('leftMinutes')) {
      expect(StageText.leftMinutes(t['seconds'] as num?), t['out'], reason: 'leftMinutes ${t['seconds']}');
    }
  });

  test('the chapter book line', () {
    for (final r in rows('chapterRefs')) {
      final input = r['input'] as Map<String, dynamic>;
      expect(
        StageText.chapterRef(ref: input['ref'] as String?, partTitle: input['partTitle'] as String?, title: input['title'] as String?),
        r['out'],
        reason: 'chapterRef $input',
      );
    }
  });

  test('plural', () {
    for (final p in rows('plurals')) {
      expect(StageText.plural((p['n'] as num).toInt(), p['one'] as String, p['many'] as String?), p['out']);
    }
  });

  test('the drawn letters (Question.jsx letterOf)', () {
    const options = [(key: 'A', text: 'one'), (key: 'B', text: 'two'), (key: 'C', text: 'three')];
    expect(StageText.letterOf(options, 'B'), 'B');
    expect(StageText.letterOf(const [(key: '7', text: 'x'), (key: '9', text: 'y')], '9'), 'B');
    expect(StageText.letterOf(options, 'Z'), 'Z');
  });
}
