// The Colleges area's words never ask for or name a score the student does not have, never
// point at the admissions portal, and carry no defensive or filler lines (L26, L28).

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  const banned = [
    'CSAS dashboard',
    'Your CUET score',
    'your CUET score',
    'not affiliated',
    'not a prediction',
    'stay on this phone for now',
    'ad or analytics companies',
    'Fine.',
    'Round I,',
    'Round II',
    'Clears Round I',
    'chance of admission',
  ];

  test('no banned phrase in the Colleges area copy', () {
    final files = [
      'lib/features/tools/copy.dart',
      'lib/features/tools/colleges/colleges_copy.dart',
      'lib/features/tools/my_colleges/my_colleges_copy.dart',
      'lib/features/tools/compass/stream_fold.dart',
      'lib/features/tools/combo/combo_progress.dart',
      'lib/features/tools/domain/du_eligibility.dart',
      'lib/features/tools/estimate/estimate.dart',
    ];
    for (final f in files) {
      final text = File(f).readAsStringSync();
      for (final b in banned) {
        expect(text.contains(b), isFalse, reason: '"$b" in $f');
      }
    }
  });
}
