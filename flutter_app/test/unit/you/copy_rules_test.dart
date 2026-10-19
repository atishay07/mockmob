import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/you/edit_copy.dart';

/// The owner's slop list, applied to every string of the You feature (binding rules of spec 0).
void main() {
  // The You copy and the other files that say credits, questions and the Account sheet.
  final source = [
    'lib/features/you/copy.dart',
    'lib/features/credits/credits_copy.dart',
    'lib/features/you/help/faq.dart',
    'lib/features/account_sheet/account_copy.dart',
  ].map((f) => File(f).readAsStringSync()).join('\n');
  // Every single-quoted literal, with the escapes and interpolations of the file left in.
  final strings = RegExp(r"'((?:[^'\\]|\\.)*)'")
      .allMatches(source)
      .map((m) => m.group(1)!)
      .where((s) => s.trim().isNotEmpty && !s.startsWith('package:') && !s.startsWith('../'))
      .toList();

  test('the copy file has strings to check', () {
    expect(strings.length, greaterThan(100));
  });

  test('no em dash, and the credit names are the two: Practice credits and AI credits', () {
    for (final s in strings) {
      expect(s.contains('\u2014'), isFalse, reason: 'em dash in "$s"');
      for (final banned in ['explanation credit', 'wallet', 'PrepOS', 'practice credits', ' ai credits', 'Ai credit']) {
        // The lower-case spellings are out; the names are written with their capitals.
        expect(s.contains(banned), isFalse, reason: '"$banned" in "$s"');
      }
    }
  });

  test('no middle dots, emoji, arrows or exclamation marks', () {
    for (final s in strings) {
      expect(s.contains('·'), isFalse, reason: 'middle dot in "$s"');
      expect(s.contains('!'), isFalse, reason: 'exclamation in "$s"');
      expect(RegExp(r'[←-⇿➔➡▶►]').hasMatch(s), isFalse, reason: 'arrow in "$s"');
      expect(RegExp(r'[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]', unicode: true).hasMatch(s), isFalse, reason: 'emoji in "$s"');
      expect(RegExp(r'\s(->|=>|>>)$').hasMatch(s), isFalse, reason: 'appended arrow in "$s"');
    }
  });

  test('no all-caps eyebrows (sentence case)', () {
    for (final s in strings) {
      final words = RegExp(r'[A-Za-z]{4,}').allMatches(s).map((m) => m.group(0)!);
      for (final w in words) {
        // Allowed in full capitals: the exam names, and DELETE, the word the student types to
        // confirm account deletion (it must read exactly as the page says). No other word.
        expect(w == w.toUpperCase() && !{'CUET', 'CSAS', 'DELETE'}.contains(w), isFalse, reason: 'ALL CAPS "$w" in "$s"');
      }
    }
  });

  test('no prices, purchase wording or banned claims', () {
    final all = strings.join('\n').toLowerCase();
    for (final banned in ['mastered', 'upgrade', 'buy now', 'subscribe', 'checkout', '₹', 'discount', 'free trial']) {
      expect(all.contains(banned), isFalse, reason: banned);
    }
  });

  test('"saved" and "safe" never sit near "phone" (local work is "On this phone")', () {
    for (final s in strings) {
      final lower = s.toLowerCase();
      for (final m in RegExp(r'\b(saved|safe)\b').allMatches(lower)) {
        final window = lower.substring((m.start - 40).clamp(0, lower.length), (m.end + 40).clamp(0, lower.length));
        expect(window.contains('phone'), isFalse, reason: 'near phone: "$s"');
      }
    }
  });

  test('college figures are described in plain words, with no admission portal wording', () {
    final all = [source, File('lib/features/you/edit_copy.dart').readAsStringSync()].join('\n');
    expect(all, isNot(contains('admission.uod')));
    expect(all, isNot(contains('CSAS')));
    // The figures are the 2026 Round 1 minimum scores (owner decision, DU data audit U1-3): the note
    // names the year and the round instead of "last year", and never the portal's own wording.
    expect(all, isNot(contains('last year')));
    expect(EditCopy.collegesNote('UR'), 'Pick up to eight. Each figure is the lowest Round 1 score in 2026 for the unreserved category, out of 1000.');
    expect(EditCopy.noSeat, 'No seat in Round 1, 2026');
  });

  test('a category is said in words, never as the portal code', () {
    expect(categoryTitle('UR'), 'Unreserved');
    expect(categoryTitle('OBC-NCL'), 'OBC');
    expect(categoryTitle('SIKH'), 'Sikh minority');
    expect(categoryTitle('KM'), 'Kashmiri migrant');
    expect(categoryTitle('SGC'), 'Single girl child');
    expect(categoryTitle('ORPHAN-FEMALE'), 'Orphan (female)');
    expect(categoryTitle('ORPHAN-MALE'), 'Orphan (male)');
    expect(categoryTitle('PwBD'), 'PwBD');
    expect(categoryTitle('EWS'), 'EWS');
    expect(categoryTitle(null), 'Unreserved');
    expect(EditCopy.collegesNote('SGC'), contains('for the single girl child category,'));
  });

  test('times are written in 12-hour form', () {
    final all = strings.join('\n');
    expect(RegExp(r'\b(1[3-9]|2[0-3]):[0-5]\d\b').hasMatch(all), isFalse);
  });
}
