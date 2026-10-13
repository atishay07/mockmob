import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/notifications/copy.dart';
import 'package:mockmob/features/notifications/logic/pre_prompt_variants.dart';

/// Capital letters that are right in the middle of a sentence.
const _proper = {'Android', 'MockMob', 'Sunday', 'AM', 'PM'};

/// An emoji, a dingbat, a symbol or an arrow: none belongs in these lines.
bool _isPictograph(int rune) =>
    rune >= 0x1F000 || (rune >= 0x2600 && rune <= 0x27BF) || (rune >= 0x2190 && rune <= 0x21FF) || rune == 0xFE0F;

bool _isUpper(String s) => s.isNotEmpty && s[0] != s[0].toLowerCase() && s[0] == s[0].toUpperCase();

/// The words that start with a capital when they should not (sentence case).
List<String> _stray(String text) {
  final stray = <String>[];
  var sentenceStart = true;
  for (final raw in text.split(' ')) {
    final word = raw.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
    if (word.isEmpty) continue;
    if (!sentenceStart && _isUpper(word) && !_proper.contains(word)) stray.add(word);
    if (!_proper.contains(word) && word == word.toUpperCase() && RegExp(r'[A-Z]{2,}').hasMatch(word)) stray.add(word);
    sentenceStart = raw.endsWith('.');
  }
  return stray;
}

void main() {
  // Every string a student can read on the re-ask: the six wordings (with and without a time),
  // the settings note and the key.
  List<String> every() => [
    for (var asks = 0; asks < prePromptVariantCount; asks++) ...[
      prePromptVariantFor(asks).title,
      prePromptVariantFor(asks).line,
      prePromptVariantFor(asks, studyTime: '8:30 PM').title,
      prePromptVariantFor(asks, studyTime: '8:30 PM').line,
    ],
    NotificationsCopy.promptBlockedNote,
    NotificationsCopy.promptOpenSettings,
  ];

  group('the wording rotation', () {
    test('there are six different wordings, each with its own title and line', () {
      expect(prePromptVariantCount, 6);
      final variants = [for (var i = 0; i < prePromptVariantCount; i++) prePromptVariantFor(i)];
      expect({for (final v in variants) v.title}.length, 6);
      expect({for (final v in variants) v.line}.length, 6);
    });

    test('the first ask uses the original wording', () {
      final first = prePromptVariantFor(0);
      expect(first.title, 'Remind me when it matters');
      expect(first.line, NotificationsCopy.promptLead);
    });

    test('the wording is chosen by how many times it was asked, and starts over after six', () {
      for (var asks = 0; asks < 24; asks++) {
        expect(prePromptVariantIndex(asks), asks % prePromptVariantCount);
        expect(prePromptVariantFor(asks).title, prePromptVariantFor(asks + prePromptVariantCount).title);
      }
      expect(prePromptVariantIndex(-3), 0, reason: 'a bad count reads as the first ask');
    });

    test('the next ask never repeats the wording of the one before', () {
      for (var asks = 0; asks < 40; asks++) {
        expect(prePromptVariantFor(asks).title, isNot(prePromptVariantFor(asks + 1).title), reason: 'ask $asks to ${asks + 1}');
        expect(prePromptVariantFor(asks).line, isNot(prePromptVariantFor(asks + 1).line));
      }
    });

    test('each wording is tied to something a reminder really does', () {
      expect(prePromptVariantFor(1).title, 'A nudge at your study time');
      expect(prePromptVariantFor(2).line, contains('repair'));
      expect(prePromptVariantFor(3).line, contains('result'));
      expect(prePromptVariantFor(4).line, contains('Sunday evening'));
      expect(prePromptVariantFor(5).line, contains('Studying works the same'));
    });

    test('the study-time wording uses the start of the student\'s own study window, and no number without one', () {
      expect(prePromptVariantFor(1, studyTime: '8:30 PM').line, contains('starts at 8:30 PM'));
      expect(prePromptVariantFor(1).line, isNot(matches(RegExp(r'\d'))));
      // Only that wording takes a time.
      expect(prePromptVariantFor(2, studyTime: '8:30 PM').line, prePromptVariantFor(2).line);
    });
  });

  group('the tone of every line', () {
    test('the check itself sees an emoji and an arrow', () {
      expect('Hello \u{1F600}'.runes.any(_isPictograph), isTrue);
      expect('Next →'.runes.any(_isPictograph), isTrue);
      expect('Plain words.'.runes.any(_isPictograph), isFalse);
    });

    test('no exclamation marks, emoji, dashes or middle dots', () {
      for (final s in every()) {
        expect(s.contains('!'), isFalse, reason: s);
        expect(s.contains('—') || s.contains('–'), isFalse, reason: 'dash in: $s');
        expect(s.contains('·') || s.contains('•'), isFalse, reason: s);
        expect(s.runes.any(_isPictograph), isFalse, reason: 'emoji or arrow in: $s');
      }
    });

    test('sentence case', () {
      for (final s in every()) {
        expect(_isUpper(s), isTrue, reason: 'starts with a capital: $s');
        expect(_stray(s), isEmpty, reason: s);
      }
    });

    test('no guilt, no urgency, no hype', () {
      const banned = [
        'streak',
        'miss out',
        'missing out',
        'last chance',
        'hurry',
        'urgent',
        'immediately',
        'right now',
        'before it is too late',
        'falling behind',
        'behind',
        'forget',
        'you should',
        'you must',
        'don\'t',
        'amazing',
        'unlock',
        'supercharge',
        'boost',
        'never miss',
      ];
      for (final s in every()) {
        final lower = s.toLowerCase();
        for (final word in banned) {
          expect(lower.contains(word), isFalse, reason: '"$word" in: $s');
        }
      }
    });

    test('each line is short enough for a sheet, and one or two sentences', () {
      for (var asks = 0; asks < prePromptVariantCount; asks++) {
        final v = prePromptVariantFor(asks, studyTime: '8:30 PM');
        expect(v.title.length, lessThanOrEqualTo(32), reason: v.title);
        expect(v.line.length, lessThanOrEqualTo(120), reason: v.line);
        expect('.'.allMatches(v.line).length, inInclusiveRange(1, 2), reason: v.line);
      }
    });

    test('the key after Android stopped asking says Open settings', () {
      expect(NotificationsCopy.promptOpenSettings, 'Open settings');
    });
  });
}
