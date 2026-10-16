import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/review/revise/revise_copy.dart';
import 'package:mockmob/features/rules/copy.dart';

import 'support/lab_fixtures.dart';

/// The website's slice 4 contracts, copied byte for byte from `data/tests/fixtures/mistake_lab/`,
/// and its copy file (`data/mistake_lab.copy.json`), copied byte for byte too.
Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

final Map<String, dynamic> copy = jsonDecode(File('test/fixtures/mistake_lab/mistake_lab.copy.json').readAsStringSync()) as Map<String, dynamic>;

Iterable<String> strings(Object? v) sync* {
  if (v is String) yield v;
  if (v is Map) {
    for (final e in v.values) {
      yield* strings(e);
    }
  }
  if (v is List) {
    for (final e in v) {
      yield* strings(e);
    }
  }
}

/// Mistake Lab v4 slice 4 models: the trap tags, Traps you meet, Same mistakes later and Revise,
/// read from the website's own contracts, with the app's own few sentences held equal to the
/// website's copy file.
void main() {
  group('the contracts parse', () {
    test('the trap tags on a paper: where each name comes from, and the one sentence for a format trap', () {
      final traps = LabTraps.tryParse(contract('traps')['paper'])!;
      expect(traps.version, 1);
      expect(traps.tags.keys, ['p1-q1', 'p1-q2', 'p1-q3', 'p1-q4']);
      final named = traps.tagFor('p1-q1')!;
      expect(named.text, 'Trap: a look-alike term');
      expect(named.label, 'A look-alike term');
      expect(named.source, TrapTag.repair);
      expect(named.sourceText, 'Named by Mistake Repair');
      expect(named.detail, isNull);
      expect(named.index, 1);
      expect(named.letter, 'B');
      final format = traps.tagFor('p1-q2')!;
      expect(format.source, TrapTag.format);
      expect(format.sourceText, 'From the question format');
      expect(format.detail, 'This option and the key agree on both statements; only the link differs.');
      expect(traps.tagFor('p1-q3')!.detail, 'This option matches 2 of the 4 pairs as the key does.');
      expect(traps.tagFor('p1-q4')!.detail, 'This option puts 2 of the 4 items in the same place as the key.');
      expect(traps.tagFor('nope'), isNull);
    });

    test('Traps you meet: rows with their counts, the before and since split and the gate labels', () {
      final t = TrapsMeet.tryParse(contract('traps')['sheet'])!;
      expect(t.isReady, isTrue);
      expect(t.title, 'Traps you meet');
      expect(t.rows.length, 3);
      final first = t.rows.first;
      expect(first.text, 'A look-alike term: caught 5 of 10 times.');
      expect((first.caught, first.of), (5, 10));
      expect(first.share, 0.5);
      expect(first.status, TrapRow.falling);
      expect(first.statusLabel, 'Falling');
      expect(first.periods!.text, 'Before 8 Oct: 4 of 5. Since: 1 of 5.');
      expect((first.periods!.beforeK, first.periods!.beforeN, first.periods!.sinceK, first.periods!.sinceN), (4, 5, 1, 5));
      expect(t.rows[1].status, TrapRow.still);
      expect(t.rows[1].statusLabel, 'Still catching you');
      // No gate passed: no label at all.
      expect(t.rows[2].status, isNull);
      expect(t.rows[2].statusLabel, isNull);
      expect(t.basis, 'A chance is a question you answered where one wrong option carries this trap.');
      expect(t.fine, startsWith('A trap shows only where Mistake Repair named it'));
    });

    test('Traps you meet, empty: the sentence for how a trap shows up, no rows', () {
      final t = TrapsMeet.tryParse(contract('traps')['empty'])!;
      expect(t.state, TrapsMeet.empty);
      expect(t.isReady, isFalse);
      expect(t.rows, isEmpty);
      expect(t.message, 'Your traps show here once a named trap has been a wrong option on 3 questions you answered.');
    });

    test('Same mistakes later: tomorrow has no key, ready now does', () {
      final tomorrow = SameMistakesLater.tryParse(contract('later')['prove'])!;
      expect(tomorrow.title, 'Same mistakes later');
      expect((tomorrow.count, tomorrow.total), (7, 7));
      expect(tomorrow.when, SameMistakesLater.tomorrow);
      expect(tomorrow.ready, isFalse);
      expect(tomorrow.line, '7 of these come back tomorrow, Fri 16 Oct.');
      expect(tomorrow.note, 'Same questions, so this checks memory. Fresh questions check the idea.');
      expect(tomorrow.open, 'Open Revise');
      expect(tomorrow.dayLabel, 'Fri 16 Oct');
      expect(tomorrow.fine, contains('costs no credits'));
      final now = SameMistakesLater.tryParse(contract('later')['proveWithCards'])!;
      expect(now.ready, isTrue);
      expect((now.count, now.total), (5, 6));
      expect(now.line, '5 of these are ready to revise now.');
    });

    test('Revise: today\'s questions with no key, the four boxes, the finished sentences', () {
      final r = ReviseRead.parse(contract('later')['revise']);
      expect(r.state, ReviseRead.ready);
      expect(r.today, '2026-10-16');
      expect((r.cap, r.due, r.shown, r.answeredToday, r.minutes, r.cards), (10, 4, 4, 0, 5, 7));
      expect(r.boxes, [4, 1, 1, 1]);
      expect(r.head, '4 questions to revise today');
      expect(r.summary, '4 due today. 7 cards, 2 recalled twice.');
      expect(r.next, 'The next ones are due on Sat 17 Oct.');
      expect(r.nextDayLabel, 'Sat 17 Oct');
      expect(r.labels.title, 'Revise');
      expect(r.labels.boxes, {1: 'back after 1 day', 2: 'after 3 days', 3: 'after 7 days', 4: 'after 21 days'});
      expect(r.items.length, 4);
      expect(r.items.first.questionId, 'r-q5');
      expect(r.items.first.chapter, 'Cash Flow Statement');
      expect(r.items.first.options.length, 4);
      expect(r.items.first.passage, isNull);
      expect([for (final i in r.items) i.box], [1, 1, 2, 4]);
    });

    test('the server\'s grade of a recall, in each outcome', () {
      final a = contract('later')['answers'] as Map<String, dynamic>;
      final right = ReviseAnswer.tryParse(a['right'])!;
      expect((right.correct, right.keyIndex, right.outcome, right.box, right.retired), (true, 1, ReviseAnswer.right, 2, false));
      expect(right.line, 'Right. It comes back in 3 days.');
      expect(right.dueLabel, 'Mon 19 Oct');
      expect(right.explanation, 'Illustrative stored explanation 1.');
      final wrong = ReviseAnswer.tryParse(a['wrong'])!;
      expect((wrong.correct, wrong.outcome, wrong.box), (false, ReviseAnswer.wrong, 1));
      expect(wrong.line, 'Not this time. It comes back tomorrow.');
      final done = ReviseAnswer.tryParse(a['done'])!;
      expect((done.outcome, done.retired, done.dueDay, done.dueLabel), (ReviseAnswer.done, true, null, null));
      expect(done.line, 'Right again. This one is done.');
    });

    test('the lab carries the trap tags and Same mistakes later when the server sends them', () {
      final raw = {
        ...labContract('ready'),
        'traps': contract('traps')['paper'],
        'prove': {'later': contract('later')['prove']},
      };
      final lab = MistakeLab.tryParse(raw)!;
      expect(lab.traps!.tagFor('p1-q1')!.text, 'Trap: a look-alike term');
      expect(lab.later!.count, 7);
      // The slice 1 to 3 contract is unchanged: an older server has neither.
      final old = MistakeLab.tryParse(labContract('ready'))!;
      expect((old.traps, old.later), (null, null));
      // A prove object with its rule check only (slice 3) has no later.
      final slice3 = MistakeLab.tryParse({...labContract('ready'), 'prove': <String, dynamic>{}})!;
      expect(slice3.later, isNull);
    });
  });

  group('a part that cannot be read honestly is left out', () {
    test('tags: an unknown source or no words drop that tag, none left is null', () {
      final paper = contract('traps')['paper'] as Map<String, dynamic>;
      final tags = Map<String, dynamic>.from(paper['tags'] as Map);
      tags['p1-q1'] = {...tags['p1-q1'] as Map, 'source': 'guess'};
      tags['p1-q2'] = {...tags['p1-q2'] as Map, 'text': ' '};
      final traps = LabTraps.tryParse({'version': 1, 'tags': tags})!;
      expect(traps.tags.keys, ['p1-q3', 'p1-q4']);
      expect(LabTraps.tryParse({'tags': <String, dynamic>{}}), isNull);
      expect(LabTraps.tryParse('x'), isNull);
      expect(LabTraps.tryParse(null), isNull);
    });

    test('Traps you meet: ready with no rows, empty with no sentence, a row caught above its chances, an unknown state', () {
      final sheet = contract('traps')['sheet'] as Map<String, dynamic>;
      expect(TrapsMeet.tryParse({...sheet, 'rows': <dynamic>[]}), isNull);
      expect(TrapsMeet.tryParse({...contract('traps')['empty'] as Map<String, dynamic>, 'message': null}), isNull);
      expect(TrapsMeet.tryParse({...sheet, 'state': 'maybe'}), isNull);
      final rows = [...sheet['rows'] as List];
      rows[0] = {...rows[0] as Map, 'caught': 11};
      final t = TrapsMeet.tryParse({...sheet, 'rows': rows})!;
      expect(t.rows.length, 2);
    });

    test('a status with no words is left out: colour is never the only cue', () {
      final sheet = contract('traps')['sheet'] as Map<String, dynamic>;
      final rows = [...sheet['rows'] as List];
      rows[0] = {...rows[0] as Map, 'statusLabel': null};
      final t = TrapsMeet.tryParse({...sheet, 'rows': rows})!;
      expect(t.rows.first.status, isNull);
      expect(t.rows.first.statusLabel, isNull);
    });

    test('Same mistakes later: counts that do not add up, an unknown day kind or another state are null', () {
      final p = contract('later')['prove'] as Map<String, dynamic>;
      expect(SameMistakesLater.tryParse({...p, 'count': 8}), isNull);
      expect(SameMistakesLater.tryParse({...p, 'count': 0}), isNull);
      expect(SameMistakesLater.tryParse({...p, 'when': 'soon'}), isNull);
      expect(SameMistakesLater.tryParse({...p, 'state': 'none'}), isNull);
      expect(SameMistakesLater.tryParse({...p, 'line': null}), isNull);
      expect(SameMistakesLater.tryParse(null), isNull);
    });

    test('Revise: an unavailable read, an unknown state, a question with fewer than two options, a recall that is not ok', () {
      expect(ReviseRead.parse({'state': 'unavailable', 'items': <dynamic>[]}).isUnavailable, isTrue);
      expect(() => ReviseRead.parse({'state': 'maybe'}), throwsFormatException);
      expect(() => ReviseRead.parse('x'), throwsFormatException);
      final r = contract('later')['revise'] as Map<String, dynamic>;
      final items = [...r['items'] as List];
      items[0] = {...items[0] as Map, 'options': ['only one']};
      expect(ReviseRead.parse({...r, 'items': items}).items.length, 3);
      final a = (contract('later')['answers'] as Map<String, dynamic>)['right'] as Map<String, dynamic>;
      expect(ReviseAnswer.tryParse({...a, 'ok': false}), isNull);
      expect(ReviseAnswer.tryParse({...a, 'outcome': 'maybe'}), isNull);
      expect(ReviseAnswer.tryParse({...a, 'line': ''}), isNull);
      expect(ReviseAnswer.tryParse(null), isNull);
    });

    test('Revise with no card: empty, no items, the entry stays out of the way', () {
      final r = ReviseRead.parse({'state': 'empty', 'cap': 10, 'boxes': [0, 0, 0, 0], 'cards': 0, 'items': <dynamic>[]});
      expect(r.isEmpty, isTrue);
      expect(r.items, isEmpty);
      expect(r.labels.title, 'Revise');
    });
  });

  group('the app\'s own words equal the website\'s copy file', () {
    final revise = copy['revise'] as Map<String, dynamic>;
    final traps = copy['traps'] as Map<String, dynamic>;
    final later = copy['later'] as Map<String, dynamic>;

    String fill(String t, Map<String, Object> v) => t.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => '${v[m[1]] ?? m[0]}');

    test('Revise\'s sentences', () {
      expect(ReviseCopy.title, revise['title']);
      expect(ReviseCopy.unavailable, revise['unavailable']);
      expect(ReviseCopy.notDue, revise['notDue']);
      expect(ReviseCopy.capReached, revise['capReached']);
      expect(ReviseCopy.nextNone, revise['nextNone']);
      expect(ReviseCopy.minutes(5), fill(revise['minutes'] as String, {'m': 5}));
      expect(ReviseCopy.box(3), fill(revise['boxes'] as String, {'n': 3}));
      const labels = ReviseLabels();
      expect(labels.title, revise['title']);
      expect(labels.sub, revise['sub']);
      expect(labels.fine, revise['fine']);
      expect({for (final e in labels.boxes.entries) '${e.key}': e.value}, revise['boxDays']);
    });

    test('the end of a run, in each shape, equals the website\'s and the contract\'s', () {
      final end = revise['end'] as Map<String, dynamic>;
      final c = (contract('later')['end']) as Map<String, dynamic>;
      expect(ReviseCopy.end(right: 8, wrong: 2), fill(end['both'] as String, {'r': 8, 'w': 2}));
      expect(ReviseCopy.end(right: 3, wrong: 0), fill(end['right'] as String, {'r': 3}));
      expect(ReviseCopy.end(right: 0, wrong: 2), fill(end['wrong'] as String, {'w': 2}));
      expect(ReviseCopy.end(right: 8, wrong: 2), c['both']);
      expect(ReviseCopy.end(right: 3, wrong: 0), c['right']);
      expect(ReviseCopy.end(right: 0, wrong: 2), c['wrong']);
      expect(ReviseCopy.end(right: 0, wrong: 0), isNull);
    });

    test('Traps you meet\'s words', () {
      expect(RulesCopy.trapsTitle, (traps['labels'] as Map)['title']);
      expect(RulesCopy.trapsOpen, (traps['labels'] as Map)['open']);
      expect(RulesCopy.trapsUnavailable, traps['unavailable']);
    });

    test('Same mistakes later\'s fallbacks equal the contract', () {
      expect((later['labels'] as Map)['title'], SameMistakesLater.tryParse(contract('later')['prove'])!.title);
      expect((later['labels'] as Map)['open'], SameMistakesLater.tryParse(contract('later')['prove'])!.open);
      expect(later['note'], SameMistakesLater.tryParse(contract('later')['prove'])!.note);
    });

    test('the interval sentence is the website\'s Rule book band words', () {
      expect(RulesCopy.intervalLine(8, 23, 35, 19, 55), '8 of 23 (35%). At this count, the 95% interval runs from 19% to 55%.');
    });
  });

  group('plain words', () {
    test('no exclamation mark, em dash or middle dot in a contract sentence or in the app\'s own copy', () {
      final all = [...strings(contract('traps')), ...strings(contract('later')), ...strings(copy['traps']), ...strings(copy['later']), ...strings(copy['revise'])];
      for (final s in all) {
        expect(s, isNot(matches(RegExp('[!—·]'))), reason: s);
      }
      for (final s in [
        ReviseCopy.unavailable, ReviseCopy.notDue, ReviseCopy.capReached, ReviseCopy.nextNone, ReviseCopy.sendFailed, ReviseCopy.checking,
        ReviseCopy.entryNote, ReviseCopy.minutes(5), RulesCopy.trapsUnavailable, RulesCopy.trapsOpen, RulesCopy.intervalLine(1, 2, 50, 9, 91),
      ]) {
        expect(s, isNot(matches(RegExp('[!—·]'))), reason: s);
      }
    });
  });
}
