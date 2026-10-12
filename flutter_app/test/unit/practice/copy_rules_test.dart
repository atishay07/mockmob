import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/practice/copy.dart';

/// The binding rules of spec 0 as a check over every string the feature can show.
void main() {
  final source = File('lib/features/practice/copy.dart').readAsStringSync();
  final literals = RegExp(r"'((?:[^'\\]|\\.)*)'").allMatches(source).map((m) => m.group(1)!).toList();

  test('copy.dart has strings to check', () {
    expect(literals.length, greaterThan(100));
  });

  test('no middle dots, emoji, arrows, ellipsis or exclamation marks', () {
    for (final s in literals) {
      expect(s.contains('·'), isFalse, reason: s);
      expect(s.contains('!'), isFalse, reason: s);
      expect(s.contains('…'), isFalse, reason: s);
      expect(RegExp('[←-⇿▶→›]').hasMatch(s), isFalse, reason: s);
      expect(RegExp('[\u{1F300}-\u{1FAFF}☀-➿]', unicode: true).hasMatch(s), isFalse, reason: s);
    }
  });

  test('no prices, purchase words, "mastered" or "upgrade"', () {
    for (final s in literals) {
      final lower = s.toLowerCase();
      expect(lower.contains('mastered'), isFalse, reason: s);
      expect(lower.contains('upgrade'), isFalse, reason: s);
      expect(lower.contains('buy'), isFalse, reason: s);
      expect(lower.contains('subscribe'), isFalse, reason: s);
      expect(RegExp(r'(rs\.?|inr|₹)\s*\d', caseSensitive: false).hasMatch(s), isFalse, reason: s);
    }
  });

  test('the exact spec sentences', () {
    expect(PracticeCopy.offlineStart, 'Connect to start. Your downloaded reviews still work.');
    expect(
      PracticeCopy.startFailed,
      'We could not start the session. Try again. If you were charged, trying again will not charge you twice.',
    );
    expect(PracticeCopy.notEnoughQuestions, 'We do not have enough questions for this yet. Nothing was charged.');
    expect(PracticeCopy.sheetTimer, 'The timer keeps running if you leave the app. Submit ends the mock.');
    expect(PracticeCopy.sheetDnd, 'For fewer interruptions, turn on Do Not Disturb from Quick Settings.');
    expect(PracticeCopy.fullMockLine(questions: 50, minutes: 60), '50 questions, 60 minutes');
    expect(PracticeCopy.quickLine, '5 to 20 questions');
    expect(PracticeCopy.chapterModeLine, 'Practice, not proof');
    expect(PracticeCopy.partOfPro, 'Part of Pro');
    expect(PracticeCopy.freeFirstIn('Accountancy'), 'Free, your first one in Accountancy');
    expect(PracticeCopy.usesCredits(50, 120), 'Uses 50 credits. You have 120.');
    expect(
      PracticeCopy.sheetTicket(DateTime(2026, 10, 12, 23, 42)),
      'If you leave, open MockMob again before 11:42 PM so your answers can be sent.',
    );
    expect(PracticeCopy.feedbackAfter, 'Feedback comes after you finish.');
  });

  test('the practice result sentences', () {
    expect(PracticeCopy.figureNumber(8) + PracticeCopy.figureRest(10), '8 of 10 correct');
    expect(PracticeCopy.countsLine(1, 1), '1 wrong, 1 not attempted');
    expect(PracticeCopy.countsLine(2, 0), '2 wrong');
    expect(PracticeCopy.countsLine(0, 3), '3 not attempted');
    expect(PracticeCopy.reviewWrong(1), 'Review 1 wrong answer');
    expect(PracticeCopy.reviewWrong(3), 'Review 3 wrong answers');
    expect(PracticeCopy.chapterLine('Admission of a partner'), 'Chapter: Admission of a partner.');
    expect(PracticeCopy.chapterLine('Goodwill.'), 'Chapter: Goodwill.');
    expect(PracticeCopy.finished(DateTime(2026, 10, 12, 23, 51)), 'Practice recorded at 11:51 PM.');
  });
}
