// The words of Learn home keep the app's rules (APP-1101 sections 7 and 8): plain, sentence case, no exclamation marks,
// emoji, middle dots or arrows, no 24-hour times, never "mastered" or a mastery percentage, and no motion the guard bans.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final files = [
    for (final f in Directory('lib/features/learn2/home').listSync())
      if (f is File && f.path.endsWith('.dart')) f,
  ];

  /// The text of every single-quoted string literal in a file (interpolation left in), line by line.
  Iterable<String> literals(File file) sync* {
    final literal = RegExp(r"'((?:[^'\\n]|\.)*)'");
    for (final line in file.readAsLinesSync()) {
      if (line.trimLeft().startsWith('//')) continue;
      for (final m in literal.allMatches(line)) {
        yield m.group(1)!;
      }
    }
  }

  test('the folder has its files', () => expect(files.length, greaterThanOrEqualTo(10)));

  test('no exclamation mark, middle dot, arrow or emoji in a word the student reads', () {
    final bad = RegExp(r'[!\u00b7\u2190-\u21ff\u2300-\u23ff\u2600-\u27bf\u{1f000}-\u{1faff}]', unicode: true);
    for (final f in files) {
      for (final s in literals(f)) {
        // A comparison in code ('!=') is not a word.
        expect(bad.hasMatch(s.replaceAll('!=', '')), isFalse, reason: '${f.path}: "$s"');
      }
    }
  });

  test('never "mastered", a mastery percentage, "marks to recover" or build talk', () {
    final bad = RegExp(r'master|marks to recover|placeholder|todo', caseSensitive: false);
    for (final f in files) {
      for (final s in literals(f)) {
        expect(bad.hasMatch(s), isFalse, reason: '${f.path}: "$s"');
      }
    }
  });

  test('no 24-hour time and no percentage in a word', () {
    final bad = RegExp(r'\b([01]?\d|2[0-3]):[0-5]\d\b|\d\s?%');
    for (final f in files) {
      for (final s in literals(f)) {
        expect(bad.hasMatch(s), isFalse, reason: '${f.path}: "$s"');
      }
    }
  });

  test('no bare AnimatedSwitcher and no Curves.ease outside core/motion', () {
    for (final f in files) {
      final code = f.readAsLinesSync().where((l) => !l.trimLeft().startsWith('//')).join('\n');
      expect(RegExp(r'\bAnimatedSwitcher\(').hasMatch(code), isFalse, reason: f.path);
      expect(RegExp(r'\bCurves\.ease\w*').hasMatch(code), isFalse, reason: f.path);
    }
  });

  test('colours come from the theme, not from raw values', () {
    for (final f in files) {
      final code = f.readAsLinesSync().where((l) => !l.trimLeft().startsWith('//')).join('\n');
      expect(RegExp(r'Color\(0x|\bColors\.').hasMatch(code), isFalse, reason: f.path);
    }
  });
}
