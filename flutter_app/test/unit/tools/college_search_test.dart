import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/tools/my_colleges/college_search.dart';

void main() {
  const programmes = <(String, int)>[
    ('B.A. (Hons.) Applied Psychology', 20),
    ('B.A. (Hons.) Business Economics', 10),
    ('B.A. (Hons.) Economics', 40),
    ('B.A. (Hons.) English', 48),
    ('B.A. (Hons.) Political Science', 50),
    ('B.A. (Programme)', 54),
    ('B.Com.', 44),
    ('B.Com. (Hons.)', 55),
    ('B.Sc. (Hons.) Home Science', 3),
    ('Bachelor of Management Studies (BMS)', 6),
  ];
  List<String> find(String q) => [for (final p in duSearch(q, programmes, (p) => p.$1, weight: (p) => p.$2)) p.$1];

  test('every way of typing B.Com finds B.Com. (Hons.) first and B.Com. second', () {
    for (final q in ['bcom', 'BCOM', 'b.com', 'B Com', 'b com', 'B.Com', 'b-com', 'Bcom']) {
      final r = find(q);
      expect(r.take(2), ['B.Com. (Hons.)', 'B.Com.'], reason: q);
    }
  });

  test('the honours spellings find B.Com. (Hons.) first', () {
    for (final q in ['bcom hons', 'B.Com (H)', 'bcom honours', 'b com (hons)', 'BCOM HONS', 'bcom h']) {
      expect(find(q).first, 'B.Com. (Hons.)', reason: q);
    }
  });

  test('eco finds both Economics programmes', () {
    final r = find('eco');
    expect(r, containsAll(['B.A. (Hons.) Economics', 'B.A. (Hons.) Business Economics']));
    expect(r, isNot(contains('B.Com. (Hons.)')));
  });

  test('pol sci finds Political Science; bms finds BMS', () {
    expect(find('pol sci').first, 'B.A. (Hons.) Political Science');
    expect(find('bms').first, 'Bachelor of Management Studies (BMS)');
  });

  test('nonsense finds nothing; an empty query keeps the caller order', () {
    expect(find('zzz'), isEmpty);
    expect(find('  '), [for (final p in programmes) p.$1]);
  });

  const colleges = [
    'Hansraj College',
    'Hindu College',
    'Kirori Mal College',
    'Lady Shri Ram College for Women',
    'Shri Ram College of Commerce',
    'Sri Venkateswara College',
  ];
  List<String> college(String q) => duSearch(q, colleges, (c) => c);

  test('Hansraj by name, spaced and with a slip', () {
    for (final q in ['hansraj', 'hans raj', 'hansrj', 'Hansraj', 'hnasraj']) {
      expect(college(q).first, 'Hansraj College', reason: q);
    }
  });

  test('short names find their college', () {
    expect(college('srcc').first, 'Shri Ram College of Commerce');
    expect(college('lsr').first, 'Lady Shri Ram College for Women');
    expect(college('kmc').first, 'Kirori Mal College');
    expect(college('svc').first, 'Sri Venkateswara College');
  });

  test('normalising', () {
    expect(duNormalise('B.Com. (Hons.)'), 'b com hons');
    expect(duCompact('B.Com. (Hons.)'), 'bcomhons');
    expect(duNormalise('Commerce & Economics'), 'commerce and economics');
    expect(duQueryTokens('bcom honours'), ['b', 'com', 'hons']);
  });
}
