import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The binding rules of spec section 0 that a scan can check, run over every Dart file of the
/// feature (all user-facing strings live in `copy.dart`, but a stray literal elsewhere counts too).
void main() {
  final files = [
    for (final f in Directory('lib/features/onboarding').listSync(recursive: true))
      if (f is File && f.path.endsWith('.dart')) f,
  ];

  String strings(File f) => f.readAsStringSync();

  test('there is a copy file and it holds the strings', () {
    expect(File('lib/features/onboarding/copy.dart').existsSync(), isTrue);
  });

  test('no middle dots, emoji, arrows or exclamation marks in user-facing copy', () {
    final copy = File('lib/features/onboarding/copy.dart').readAsStringSync();
    final literals = RegExp("'([^'\\n]*)'").allMatches(copy).map((m) => m.group(1)!).toList();
    for (final text in literals) {
      expect(text.contains('·'), isFalse, reason: text);
      expect(text.contains('!'), isFalse, reason: text);
      expect(RegExp(r'[→←↗➜➔▸▶>]|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]', unicode: true).hasMatch(text), isFalse, reason: text);
    }
  });

  test('"saved" and "safe" never sit near "phone": local work is "On this phone"', () {
    final copy = File('lib/features/onboarding/copy.dart').readAsStringSync();
    for (final m in RegExp(r'(saved|safe)', caseSensitive: false).allMatches(copy)) {
      final from = (m.start - 40).clamp(0, copy.length);
      final to = (m.end + 40).clamp(0, copy.length);
      expect(copy.substring(from, to).toLowerCase().contains('phone'), isFalse, reason: copy.substring(from, to));
    }
  });

  test('no all-caps eyebrow labels and no price or purchase words', () {
    final copy = File('lib/features/onboarding/copy.dart').readAsStringSync();
    final literals = RegExp("'([^'\\n]*)'").allMatches(copy).map((m) => m.group(1)!);
    for (final text in literals) {
      expect(RegExp(r'^[A-Z][A-Z ]{3,}$').hasMatch(text), isFalse, reason: text);
      expect(RegExp(r'₹\s?\d|\bupgrade\b|\bbuy\b|\bmastered\b', caseSensitive: false).hasMatch(text), isFalse, reason: text);
    }
  });

  test('the usage-data switch label appears exactly once, unaltered', () {
    const label = 'Allow usage data to improve MockMob';
    final hits = files.where((f) => strings(f).contains("'$label'")).toList();
    expect(hits, hasLength(1));
    expect(RegExp(label).allMatches(strings(hits.single)), hasLength(1));
    // Nowhere else may carry a different spelling of it.
    for (final f in files) {
      expect(RegExp('Allow usage data', caseSensitive: false).allMatches(strings(f)).length, lessThanOrEqualTo(1), reason: f.path);
    }
  });

  test('no file is over about 400 lines', () {
    for (final f in files) {
      expect(f.readAsLinesSync().length, lessThanOrEqualTo(420), reason: f.path);
    }
  });
}
