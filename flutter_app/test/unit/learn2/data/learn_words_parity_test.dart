// The app's shared words against the website's own: `test/fixtures/learn2/parity/words.json` holds what the web's words.js and the
// Free lines of allowance.js return (written by tool/learn2_parity/words.mjs, which imports the web's modules). Every output is
// checked, so a word that drifts in one place fails here. A number the web is given as a string, NaN or nothing is the app's null:
// the same label comes out.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_words.dart';

num? _n(Object? v) => switch (v) {
  num n => n,
  'NaN' => double.nan,
  'Infinity' => double.infinity,
  String s => num.tryParse(s),
  _ => null,
};

/// The words as the web writes them: the app joins a number to its unit with a no-break space (I9), nothing else differs.
String _plain(String s) => s.replaceAll(' ', ' ');

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/words.json').readAsStringSync()) as Map<String, dynamic>;
  List<Map<String, dynamic>> rows(String key) => (data[key] as List).cast<Map<String, dynamic>>();

  test('the labels are the web\'s', () {
    final w = data['words'] as Map<String, dynamic>;
    expect(LearnWords.turnOver, w['turnOver']);
    expect(LearnWords.turnCue, w['turnCue']);
    expect(LearnWords.pickHint, w['pickHint']);
    expect(LearnWords.continueWord, w['continue']);
    expect(LearnWords.keepGoing, w['keepGoing']);
    expect(LearnWords.nextChapter, w['nextChapter']);
    expect(LearnWords.reviseLater, w['reviseLater']);
    expect(LearnWords.inRevise, w['inRevise']);
    expect(LearnWords.save, w['save']);
    expect(LearnWords.saved, w['saved']);
    expect(LearnWords.skipKnown, w['skipKnown']);
    expect(LearnWords.quickRecap, w['quickRecap']);
    expect(LearnWords.seePro, w['seePro']);
    expect(LearnWords.singles, w['singles']);
    expect(LearnWords.revise, w['revise']);
    expect(LearnWords.missedIt, w['missedIt']);
    expect(LearnWords.coachRatings, w['coachRatings']);
  });

  test("when a rated card comes back is said in the web's words (round 5, LK38)", () {
    for (final r in rows('returnWords')) {
      expect(LearnWords.returnWords(_n(r['days'])), r['out'], reason: 'returnWords of ${r['days']}');
    }
    for (final r in rows('backs')) {
      final w = r['words'] as String;
      expect(_plain(LearnWords.backStamp(w)), r['stamp']);
      expect(_plain(LearnWords.backLine(w)), r['line']);
      expect(LearnWords.missedWords(w, true), r['missedInRun']);
      expect(LearnWords.missedWords(w, false), r['missed']);
    }
  });

  test('Free after the day\'s session says what the web says', () {
    final f = data['free'] as Map<String, dynamic>;
    expect(LearnFreeWords.doneHeadline, f['doneHeadline']);
    expect(LearnFreeWords.doneLine, f['doneLine']);
    expect(LearnFreeWords.sessionDone, f['sessionDone']);
    expect(LearnFreeWords.endLine, f['endLine']);
    expect(LearnFreeWords.capped, f['capped']);
    expect(LearnFreeWords.cardsOnly, f['cardsOnly']);
  });

  test('a time after a label is " · N min", rounded up, at least 1', () {
    for (final r in rows('whole')) {
      expect(LearnWords.wholeMinutes(_n(r['n'])), r['out'], reason: 'wholeMinutes of ${r['n']}');
    }
    for (final r in rows('withMinutes')) {
      expect(_plain(LearnWords.withMinutes('Continue', _n(r['n']))), r['out'], reason: 'withMinutes of ${r['n']}');
    }
  });

  test('a number and its unit never split across two lines (I9)', () {
    expect(LearnWords.withMinutes('Continue', 2), 'Continue · 2 min');
    expect(LearnWords.backLine('in 3 days'), 'back in 3 days');
    expect(LearnWords.backStamp('in 2 weeks'), 'Back in 2 weeks');
    expect(LearnWords.backStamp('tomorrow'), 'Back tomorrow');
    expect(LearnWords.fixMistakes(3, 4), 'Fix 3 open mistakes · 4 min', reason: 'a count of things is not a unit of time');
  });

  test('the counted names', () {
    for (final r in rows('fixMistakes')) {
      expect(_plain(LearnWords.fixMistakes(_n(r['n']), r['minutes'] as num)), r['out'], reason: 'fixMistakes ${r['n']} ${r['minutes']}');
    }
    for (final r in rows('reviseDue')) {
      expect(_plain(LearnWords.reviseDue(_n(r['n']), r['minutes'] as num)), r['out'], reason: 'reviseDue ${r['n']} ${r['minutes']}');
    }
    for (final r in rows('reviseQuestions')) {
      expect(LearnWords.reviseQuestions(_n(r['n'])), r['out'], reason: 'reviseQuestions ${r['n']}');
    }
    for (final r in rows('pileLabel')) {
      expect(LearnWords.pileLabel(_n(r['n'])), r['out'], reason: 'pileLabel ${r['n']}');
    }
  });

  test('a chapter\'s place: "Chapter 5 of 14" and "Chapter 5", empty without the numbers', () {
    for (final r in rows('places')) {
      final raw = r['place'];
      // The web reads a string "3" as a number; the app's model reads the server's own numbers.
      final place = raw is Map && (raw['n'] is String || raw['of'] is String || raw['n'] is double || raw['of'] is double) ? null : LearnPlace.tryParse(raw);
      if (raw is Map && (raw['n'] is String || raw['n'] is double || raw['of'] is double || raw['of'] is String)) continue;
      expect(LearnWords.chapterPlace(place), r['place_label'], reason: 'chapterPlace of $raw');
      expect(LearnWords.chapterShort(place), r['short'], reason: 'chapterShort of $raw');
    }
  });
}
