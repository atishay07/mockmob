// Copy lint C-1 to C-4 (spec 7.1) over every string literal in the Mob v3 code: no price or currency,
// no exclamation marks, no counts of who has not played, no night-study words. Every file under v3 is
// scanned, with no exemption: the fixture bank (question text with rupee amounts, content and not
// copy) lives in lib/dev, outside the Mob.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

final _single = RegExp(r"'((?:[^'\\]|\\.)*)'");
final _double = RegExp(r'"((?:[^"\\]|\\.)*)"');

List<(String, String)> _strings() {
  final out = <(String, String)>[];
  final dir = Directory('lib/features/social/v3');
  for (final f in dir.listSync(recursive: true).whereType<File>()) {
    if (!f.path.endsWith('.dart')) continue;
    for (final line in f.readAsLinesSync()) {
      final t = line.trimLeft();
      if (t.startsWith('//') || t.startsWith('import ') || t.startsWith('export ')) continue;
      for (final m in [..._single.allMatches(line), ..._double.allMatches(line)]) {
        final s = (m.group(1) ?? '').replaceAll(RegExp(r'\$\{[^}]*\}'), '').replaceAll(RegExp(r'\$[a-zA-Z_]\w*'), '');
        if (s.isEmpty) continue;
        out.add((f.path, s));
      }
    }
  }
  return out;
}

void main() {
  final strings = _strings();

  test('there is copy to lint', () => expect(strings.length, greaterThan(200)));

  test('C-1: no price, currency or buying', () {
    final bad = RegExp(r'₹|\bRs\b|\bprice\b|\bbuy\b|per month', caseSensitive: false);
    final hits = [for (final (f, s) in strings) if (bad.hasMatch(s) && s != 'price' && !s.contains('can buy') && !s.contains('be bought')) '$f: $s'];
    expect(hits, isEmpty);
  });

  test('C-2: no exclamation marks', () {
    final hits = [for (final (f, s) in strings) if (RegExp(r'[A-Za-z.]!(\s|$)').hasMatch(s)) '$f: $s'];
    expect(hits, isEmpty);
  });

  test('C-3: never counts who has not played', () {
    final bad = RegExp(r'of you have not|still to play|one more can play|waiting on|^\s*Played\s*$', caseSensitive: true);
    final hits = [for (final (f, s) in strings) if (bad.hasMatch(s)) '$f: $s'];
    expect(hits, isEmpty);
  });

  test('C-4: no night-study words', () {
    final bad = RegExp(r'late night|all-nighter|night owl|up late|midnight|burn the', caseSensitive: false);
    final hits = [for (final (f, s) in strings) if (bad.hasMatch(s)) '$f: $s'];
    expect(hits, isEmpty);
  });

  test('spec 5.0: no loss or pressure words', () {
    final bad = RegExp(r'\blost\b|\bbehind\b(?! \$)|\blast place\b|waiting on you|\bhurry\b|streak at risk', caseSensitive: false);
    // "behind" is allowed only in the ghost pace chip ("4 s behind Kabir", "1 min 10 s behind Kabir",
    // spec R4): the bare " behind " between the gap and the name.
    final hits = [for (final (f, s) in strings) if (bad.hasMatch(s) && !s.contains(' s behind ') && s != ' behind ') '$f: $s'];
    expect(hits, isEmpty);
  });
}
