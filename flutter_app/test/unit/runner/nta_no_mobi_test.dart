import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Mobi never appears while the NTA clock runs. Only the instructions screen, shown before the
/// paper starts, may draw him.
void main() {
  test('no Mobi in NTA paper files', () {
    const allowed = {'nta_instructions_screen.dart', 'nta_instructions_parts.dart'};
    final offenders = <String>[];
    for (final entity in Directory('lib/features/runner/nta').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final name = entity.uri.pathSegments.last;
      if (allowed.contains(name)) continue;
      final source = entity.readAsStringSync();
      if (RegExp(r'\bMobi(Character|Stage|Walker)\b|\bMobi\(').hasMatch(source)) offenders.add(name);
    }
    expect(offenders, isEmpty);
  });
}
