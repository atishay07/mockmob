// The app's one source of the subject options (lib/core/domain/subject_options.dart, owner LK94) against the website's own:
// `test/fixtures/learn2/parity/subject_options.json` holds data/cuet_syllabus.js SUBJECT_OPTIONS and what its normalizeOption and
// defaultOption return (written by tool/learn2_parity/subject_options.mjs, which imports the web's module). Ids, labels, the
// "Section" or "Part" word and the default must match exactly: the server stores the id the app sends.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/subject_options.dart';

void main() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/subject_options.json').readAsStringSync()) as Map<String, dynamic>;

  test('the same subjects, ids, labels, word and default as the web', () {
    final web = (data['options'] as Map).cast<String, dynamic>();
    expect(kSubjectOptions.keys.toSet(), web.keys.toSet());
    for (final MapEntry(key: id, value: raw) in web.entries) {
      final set = kSubjectOptions[id]!;
      final w = (raw as Map).cast<String, dynamic>();
      expect(set.subject, id);
      expect(set.label, w['label'], reason: id);
      expect(set.defaultId, w['default'], reason: id);
      expect([for (final c in set.choices) {'id': c.id, 'label': c.label}], w['choices'], reason: id);
    }
  });

  test('defaultOption and normalizeOption answer as the web does', () {
    for (final row in (data['defaults'] as List).cast<Map<String, dynamic>>()) {
      expect(defaultSubjectOption(row['subject'] as String?), row['out'], reason: '${row['subject']}');
    }
    for (final row in (data['normalize'] as List).cast<Map<String, dynamic>>()) {
      expect(normalizeSubjectOption(row['subject'] as String?, row['option'] as String?), row['out'], reason: '${row['subject']} ${row['option']}');
    }
  });

  test("the app's own words: one question, two choices with one line each, the default among them", () {
    for (final set in kSubjectOptions.values) {
      expect(set.question, endsWith('does your school teach?'));
      expect(set.choices, hasLength(2));
      expect(set.choice(set.defaultId), isNotNull);
      for (final c in set.choices) {
        expect(c.note, isNotEmpty);
        expect(c.note, endsWith('.'));
        expect(c.note.contains('·'), isFalse, reason: 'no middle-dot lists');
      }
    }
    expect(kSubjectOptionLater, 'You can change this later in Learn.');
    expect(subjectOptionsFor('economics'), isNull);
    expect(subjectOptionsFor('accountancy')!.choice('cas')!.label, 'Computerised Accounting');
  });
}
