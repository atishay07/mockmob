// The inline nudges' frequency cap, as on the website: at most one inline nudge per screen. Each place
// that draws one is its own file in lib/, so the cap is held here by counting the rows each file places.
// (The other caps, seven days quiet after Not now and the first-session pop-up once ever, are held by
// nudge_rules_test.dart and pro_nudge_controller_test.dart.)

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('no screen places more than one inline Pro nudge row', () {
    final placed = <String, int>{};
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>()) {
      final path = f.path.replaceAll(r'\', '/');
      if (!path.endsWith('.dart') || path.contains('/features/pro_nudge/')) continue;
      final n = RegExp(r'\bProNudgeRow\(').allMatches(f.readAsStringSync()).length;
      if (n > 0) placed[path] = n;
    }
    expect(placed, isNotEmpty, reason: 'the rows are placed somewhere');
    for (final e in placed.entries) {
      expect(e.value, 1, reason: '${e.key} places ${e.value} rows');
    }
  });
}
