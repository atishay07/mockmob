import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The owner's slop list, applied to every string of the You feature (binding rules of spec 0).
void main() {
  final source = File('lib/features/you/copy.dart').readAsStringSync();
  // Every single-quoted literal, with the escapes and interpolations of the file left in.
  final strings = RegExp(r"'((?:[^'\\]|\\.)*)'")
      .allMatches(source)
      .map((m) => m.group(1)!)
      .where((s) => s.trim().isNotEmpty && !s.startsWith('package:') && !s.startsWith('../'))
      .toList();

  test('the copy file has strings to check', () {
    expect(strings.length, greaterThan(100));
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

  test('times are written in 12-hour form', () {
    final all = strings.join('\n');
    expect(RegExp(r'\b(1[3-9]|2[0-3]):[0-5]\d\b').hasMatch(all), isFalse);
  });
}
