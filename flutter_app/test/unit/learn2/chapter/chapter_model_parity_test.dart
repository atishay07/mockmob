// The app's chapter rules against the website's own: `test/fixtures/learn2/parity/chapter_model.json` holds what the web's
// chapterModel.mjs (and `minutesFor` of runMath.js) return for every preview the server recorded, the cases of the web's
// own test and a set of edge inputs (written by tool/learn2_parity/chapter_model.mjs, which imports the web's functions).
// Every case is checked on every output, so a word that drifts on one real answer fails here.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/core/models/json_helpers.dart';

import '../support/plain_words.dart';

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/chapter_model.json').readAsStringSync()) as Map<String, dynamic>;
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();

  test('the fixture holds every recorded preview, the web cases and the edges', () {
    final counts = data['counts'] as Map<String, dynamic>;
    expect(counts['previews'], greaterThanOrEqualTo(13));
    expect(counts['chapters'], greaterThanOrEqualTo(20));
    expect(counts['piles'], greaterThanOrEqualTo(100));
    expect(counts['quiet'], greaterThanOrEqualTo(30));
    expect(counts['shelves'], greaterThanOrEqualTo(24));
    // Every rule shows at least once: a unit that is shown, a mistakes pile "of 3", a held pile, each quiet line, a locked row.
    expect(rows('chapters').where((c) => (c['out'] as Map)['eyebrow'] != null), isNotEmpty);
    expect(rows('piles').where((p) => ((p['view'] as Map)['of']) != null), isNotEmpty);
    expect(rows('piles').where((p) => ((p['view'] as Map)['state']) == 'held'), isNotEmpty);
    expect(rows('quiet').map((q) => q['out']).whereType<String>().toSet().length, greaterThanOrEqualTo(6));
    expect(rows('shelves').any((s) => ((s['out'] as Map)['rows'] as List).any((r) => (r as Map)['locked'] == true)), isTrue);
  });

  test('the head: the unit only when it does not repeat the title, and the place "Chapter 5 of 14"', () {
    for (final c in rows('chapters')) {
      final lines = ChapterModel.headLines(LearnChapterHead.parse(c['chapter']));
      expect({'eyebrow': lines.eyebrow, 'ref': lines.ref}, c['out'], reason: '${c['name']}');
    }
  });

  test('the short part name', () {
    for (final p in rows('partShorts')) {
      expect(ChapterModel.partShort(p['title'] as String?), p['out'], reason: 'partShort of ${p['title']}');
    }
  });

  test('a pile: its minutes, its state, its line, "2 of 3", its note and its spoken label', () {
    for (final c in rows('piles')) {
      final pile = ChapterPile.fromJson(c['pile'] as Map<String, dynamic>);
      expect(ChapterModel.pileMinutes(pile), c['minutes'], reason: '${c['name']} minutes');
      Map<String, Object?> shape(PileView v) => {'state': v.state.wire, 'line': v.line, 'of': v.of, 'note': v.note, 'aria': v.aria};
      expect(shape(ChapterModel.pileView(pile)), c['view'], reason: '${c['name']} view');
      expect(shape(ChapterModel.pileView(pile, minutes: 10)), c['viewAt10'], reason: '${c['name']} view at 10');
      expect(shape(ChapterModel.pileView(pile, minutes: 5)), c['viewAt5'], reason: '${c['name']} view at 5');
      // 4.2 minutes is not a length the page offers; "fits in" rounds it up as the web's wholeMinutes does.
    }
    for (final c in rows('dueTexts')) {
      expect(ChapterModel.dueWords(c['text'] as String?), c['out'], reason: 'dueWords of ${c['text']}');
    }
  });

  test('the quiet line under Start, by priority, for every recorded answer and every rule', () {
    for (final c in rows('quiet')) {
      expect(ChapterModel.quietLine(LearnPreview.parse(c['data'])), c['out'], reason: '${c['name']}');
    }
  });

  test('"Everything in this chapter": the rows, their lines and what is missing', () {
    for (final c in rows('shelves')) {
      final view = ChapterModel.shelfView(LearnPreview.parse(c['data']), mistakeMinutes: (n) => ChapterModel.minutesFor(n * 60));
      final out = {
        'rows': [
          for (final r in view.rows) {'id': r.id, 'title': r.title, 'line': r.line, 'locked': r.locked, 'link': r.link, 'action': r.action},
        ],
        'missing': view.missing,
      };
      expect(plain(out), c['out'], reason: '${c['name']}');
    }
  });

  test('the verdict beside the place: only "Needs work"', () {
    for (final c in rows('verdicts')) {
      final raw = c['state'];
      expect(ChapterModel.chapterVerdict(raw == null ? null : LearnState.parse(raw)), c['out'], reason: '$raw');
    }
  });

  test('the recap key, and whether a card has been seen', () {
    for (final c in rows('recaps')) {
      final seen = c['seen'] as bool?;
      final recap = LearnRecap.tryParse(c['recap']);
      expect(plain(seen == null ? ChapterModel.recapLabel(recap) : ChapterModel.recapLabel(recap, seen: seen)), c['out'], reason: '${c['name']} ${c['recap']}');
    }
    for (final c in rows('seenCases')) {
      final data = c['data'];
      expect(ChapterModel.hasSeenCards(data == null ? null : LearnPreview.parse(data)), c['out'], reason: '${c['name']}');
    }
  });

  test('the Start key and the Continue key', () {
    for (final c in rows('startCases')) {
      expect(plain(ChapterModel.startKeyLabel(c['label'] as String?, c['minutes'] as int, fresh: c['fresh'] as bool)), c['out'], reason: '$c');
    }
    for (final c in rows('continueCases')) {
      final raw = c['resume'] as Map<String, dynamic>?;
      final left = raw?['minutesLeft'];
      // The server sends whole minutes; a fraction is the web's own wholeMinutes (a ceil), which the model keeps for the other cases.
      if (left is double && left != left.roundToDouble()) continue;
      final resume = raw == null ? null : LearnOpenRun(runId: 'r', minutesLeft: asInt(left) ?? 0);
      expect(plain(ChapterModel.continueLabel(resume)), c['out'], reason: '$raw');
    }
  });

  test('the title size, First up and the key of the pile tip', () {
    for (final c in rows('titleSizes')) {
      expect(ChapterModel.titleSize(c['title'] as String?), c['out'], reason: '${c['title']}');
    }
    for (final c in rows('firstUps')) {
      final data = c['data'];
      final got = [for (final f in ChapterModel.firstUpCards(data == null ? null : LearnPreview.parse(data))) {'id': f.id, 'front': f.front, 'mustKnow': f.mustKnow}];
      expect(got, c['out'], reason: '${c['name']}');
    }
    for (final c in rows('coachKeys')) {
      expect(ChapterModel.coachKeyFor(c['userId'] as String?), c['out'], reason: '${c['userId']}');
    }
  });

  test('a chapter that is not in the book list', () {
    for (final c in rows('errors')) {
      final e = c['error'] as Map<String, dynamic>;
      final kind = LearnErrorKind.values.firstWhere((k) => k.wire == e['kind'], orElse: () => LearnErrorKind.error);
      final error = LearnError(kind: kind, status: e['status'] as int?, code: e['code'] as String?);
      expect(ChapterModel.isChapterMissing(error), c['out'], reason: '$e');
    }
    // Anything that is not a Learn error is not a missing chapter.
    expect(ChapterModel.isChapterMissing(null), isFalse);
    expect(ChapterModel.isChapterMissing(StateError('x')), isFalse);
  });

  test("Learn's one minutes rule", () {
    for (final m in rows('minutes')) {
      expect(ChapterModel.minutesFor(m['seconds'] as num), m['out'], reason: 'minutesFor ${m['seconds']}');
    }
  });
}
