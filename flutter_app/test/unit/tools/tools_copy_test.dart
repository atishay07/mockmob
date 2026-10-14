// The tools keep every string in ToolsCopy, and the guide says the calendar plainly. The check
// reads the guide screen's source: what it shows through Text, ToolsHeading, ToolsNote, ToolTag
// and the page title must be a ToolsCopy (or guide content) value, never a typed literal.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/guide/guide_content.dart';

String _source(String path) => File(path).readAsStringSync();

/// The first argument of every `Name(` call, up to its first character.
Iterable<String> _firstArgs(String source, List<String> names) sync* {
  final call = RegExp('\\b(${names.join('|')})\\(\\s*(const\\s+)?([^\\s])');
  for (final m in call.allMatches(source)) {
    yield '${m.group(1)}: ${m.group(3)}';
  }
}

void main() {
  const screens = [
    'lib/features/tools/guide/guide_2027_screen.dart',
  ];

  for (final path in screens) {
    test('$path passes no typed string to Text, ToolsHeading, ToolsNote or ToolTag', () {
      final source = _source(path);
      final literal = _firstArgs(source, ['Text', 'ToolsHeading', 'ToolsNote', 'ToolTag']).where((a) => a.endsWith("'") || a.endsWith('"')).toList();
      expect(literal, isEmpty, reason: 'move these into ToolsCopy: $literal');
    });

    test('$path passes no typed string as a title, lead, note or label', () {
      final source = _source(path);
      final named = RegExp('\\b(title|lead|note|label|semanticsLabel):\\s*[\'"]').allMatches(source).map((m) => m.group(0)).toList();
      expect(named, isEmpty, reason: 'move these into ToolsCopy: $named');
    });
  }

  test('the guide screen takes its page title, note and heading from ToolsCopy', () {
    final source = _source(screens.first);
    expect(source, contains('ToolsCopy.guidePageTitle'));
    expect(source, contains('ToolsCopy.guideCommonQuestions'));
  });

  test('the guide says the dates are not published once, in the lead, with no footnote', () {
    expect(_source(screens.first), isNot(contains('guideDatesNote')));
    expect(guideIntro, 'The 2027 dates and rules are not out yet.');
    expect(ToolsCopy.guidePageTitle, 'CUET 2027');
    expect(ToolsCopy.guideCommonQuestions, 'Common questions');
  });

  test('no defensive footer string is left in the tools copy', () {
    final source = _source('lib/features/tools/copy.dart');
    for (final gone in ['comboFine', 'honesty', 'provisional', 'papersNote']) {
      expect(source.contains('static const $gone'), isFalse, reason: gone);
    }
    expect(ToolsCopy.overLimit(7, 5), 'You have picked 7 papers. The limit is 5.');
    expect(ToolsCopy.overLimit(7, 5), isNot(contains('202')));
  });
}
