// Feature wave 15 Oct, K0: the paper pattern contract. The fixtures in
// test/fixtures/paper_pattern/ are the website's `data/fixtures/paper_pattern/` byte for byte
// (`serializePattern(paperPattern(blueprint, { variant }))` in `data/paper_pattern.mjs`), so the
// app reads exactly what the server sends.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/pattern/paper_pattern.dart';
import 'package:mockmob/core/pattern/paper_pattern_repository.dart';

const _dir = 'test/fixtures/paper_pattern';
const _files = [
  'accountancy.json',
  'business_studies.json',
  'economics.json',
  'english.json',
  'mathematics.json',
  'mathematics-applied.json',
];

String _text(String file) => File('$_dir/$file').readAsStringSync().replaceAll('\r\n', '\n');

Object? _raw(String file) => jsonDecode(_text(file));

PaperPattern _pattern(String file) => PaperPattern.tryParse(_raw(file))!;

/// Answers GETs from a table and counts them.
class _FakeApi implements ApiClient {
  _FakeApi(this.answer);

  final Future<ApiResponse> Function(String path, Map<String, Object?>? query) answer;
  final List<String> calls = [];

  @override
  Future<ApiResponse> get(String path, {Map<String, Object?>? query, ApiOptions options = const ApiOptions(), String? expectUserId}) {
    calls.add(query == null || query.isEmpty ? path : '$path?${query.entries.map((e) => '${e.key}=${e.value}').join('&')}');
    return answer(path, query);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('fixtures', () {
    test('every fixture is the canonical serialisation (JSON.stringify with 2 spaces, one newline)', () {
      for (final file in _files) {
        final text = _text(file);
        expect('${const JsonEncoder.withIndent('  ').convert(jsonDecode(text))}\n', text, reason: file);
      }
    });

    test('every fixture parses and writes back the same JSON', () {
      for (final file in _files) {
        final pattern = PaperPattern.tryParse(_raw(file));
        expect(pattern, isNotNull, reason: file);
        expect(jsonDecode(jsonEncode(pattern!.toJson())), _raw(file), reason: file);
      }
    });

    test('every pattern carries its source, its confidence and the 2027 caveat', () {
      for (final file in _files) {
        final p = _pattern(file);
        expect(p.sourceLine, isNotEmpty, reason: file);
        expect(p.sourceLine.contains('!'), isFalse, reason: file);
        expect(p.sourceLine.contains('—'), isFalse, reason: 'no em dash: $file');
        expect(p.provisional2027, isTrue, reason: file);
        expect(p.chaptersInferred, isTrue, reason: file);
        expect(p.totalQuestions, 50, reason: file);
        expect(p.sections.fold<int>(0, (sum, s) => sum + s.questions), p.totalQuestions, reason: file);
      }
    });
  });

  group('accountancy', () {
    final p = _pattern('accountancy.json');

    test('units add up to the paper and keep syllabus order', () {
      expect(p.subject, 'accountancy');
      expect(p.blueprintVersion, isNotEmpty);
      expect(p.sourceLine, 'Based on the 2025 CUET paper and the NTA bulletin.');
      expect(p.unitConfidence, PatternConfidence.medium);
      expect(p.units.fold<int>(0, (sum, u) => sum + u.quota.target), 50);
      expect(p.chapters.first.name, 'Partnership Fundamentals');
      expect(p.secondsPerQuestion, 72);
      expect(p.variant.id, 'default');
    });

    test('a chapter carries its unit, target and range', () {
      final admission = p.chapterNamed('admission of partner ')!;
      expect(admission.unit, 'Reconstitution of a Partnership firm');
      expect(admission.target, 5);
      expect((admission.quota.min, admission.quota.max), (3, 6));
      expect(admission.optional, isFalse);
    });

    test('the optional unit is marked, and a zero-target alias is not optional', () {
      final cas = p.chapterNamed('Computerized Accounting System')!;
      expect(cas.excluded, isTrue);
      expect(cas.optional, isTrue);
      expect(cas.target, 0);
      final alias = p.chapterNamed('Dissolution of Partnership')!;
      expect(alias.target, 0);
      expect(alias.optional, isFalse, reason: 'its range reaches 10: one topic with the Firm chapter');
      expect(p.excludedChapters.single.name, 'Computerized Accounting System');
    });

    test('formats map to the blueprint quotas', () {
      expect(p.quotaFor(PaperFormat.sequence)!.target, 6);
      expect(p.quotaFor(PaperFormat.match)!.target, 4);
      expect(p.quotaFor(PaperFormat.statements)!.target, 5);
      expect(p.quotaFor(PaperFormat.assertionReason)!.target, 0);
      expect(p.quotaFor(PaperFormat.plain)!.target, 35);
      expect(p.quotaFor(PaperFormat.numerical), isNull);
      expect(p.numericalShare!.target, 0.25);
      expect(p.typeConfidence, PatternConfidence.medium);
    });
  });

  test('economics: the lowest confidence word wins, and aliases find a chapter', () {
    final p = _pattern('economics.json');
    expect(p.unitConfidence, PatternConfidence.low, reason: 'its note says "medium (IED low)"');
    final national = p.chapterNamed('National Income and Related Aggregates');
    expect(national, isNotNull);
    expect(national!.name, 'National Income & Related Aggregates');
  });

  test('business studies: a chapter out of the syllabus is listed with its reason, not as a tile', () {
    final p = _pattern('business_studies.json');
    expect(p.excludedChapters.map((e) => e.name), contains('Entrepreneurship Development'));
    expect(p.chapterNamed('Entrepreneurship Development'), isNull);
    expect(p.excludedChapters.every((e) => e.reason.isNotEmpty), isTrue);
  });

  test('english: no single-correct quota and no numericals', () {
    final p = _pattern('english.json');
    expect(p.quotaFor(PaperFormat.plain), isNull);
    expect(p.numericalShare, isNull);
    expect(p.typeQuotas.keys, contains('match_the_following'));
  });

  test('mathematics: the default is the core paper, and the applied variant has its own sections', () {
    final core = _pattern('mathematics.json');
    expect(core.variant.id, 'core');
    expect(core.variants.map((v) => v.id), ['core', 'applied']);
    expect(core.sections.map((s) => s.id), ['A', 'B1']);
    final applied = _pattern('mathematics-applied.json');
    expect(applied.variant.id, 'applied');
    expect(applied.sections.map((s) => s.id), ['A', 'B2']);
    expect(applied.chapters.every((c) => c.section == 'A' || c.section == 'B2'), isTrue);
  });

  test('a pattern this app cannot read is null, never zeros', () {
    final good = _raw('accountancy.json')! as Map<String, dynamic>;
    expect(PaperPattern.tryParse(null), isNull);
    expect(PaperPattern.tryParse('accountancy'), isNull);
    expect(PaperPattern.tryParse({...good, 'schemaVersion': 2}), isNull);
    expect(PaperPattern.tryParse({...good, 'chapters': <Object>[]}), isNull);
    expect(PaperPattern.tryParse({...good, 'subject': ''}), isNull);
    expect(PatternConfidence.parse('certain'), PatternConfidence.low);
    expect(PaperFormat.byId('sequence'), PaperFormat.sequence);
    expect(PaperFormat.byId('Sequence'), isNull);
  });

  group('repository', () {
    test('reads each subject once per run, shares a read in flight, and passes the variant', () async {
      final api = _FakeApi((path, query) async => ApiResponse(200, _raw(query?['variant'] == 'applied' ? 'mathematics-applied.json' : 'accountancy.json')));
      final repo = PaperPatternRepository(api);
      final both = await Future.wait([repo.forSubject('accountancy'), repo.forSubject('Accountancy ')]);
      expect(both.every((p) => p?.subject == 'accountancy'), isTrue);
      expect(await repo.forSubject('accountancy'), same(both.first));
      expect(repo.cached('accountancy'), same(both.first));
      expect(api.calls, ['/api/subjects/accountancy/pattern']);

      final applied = await repo.forSubject('mathematics', variant: 'applied');
      expect(applied!.variant.id, 'applied');
      expect(api.calls.last, '/api/subjects/mathematics/pattern?variant=applied');
    });

    test('no blueprint is remembered as null; a failed read is not remembered', () async {
      var fail = true;
      final api = _FakeApi((path, query) async {
        if (path.contains('environmental_studies')) throw const ApiError(kind: ApiErrorKind.notFound, code: 'unknown_subject', status: 404);
        if (fail) throw const ApiError(kind: ApiErrorKind.network, code: 'network');
        return ApiResponse(200, _raw('accountancy.json'));
      });
      final repo = PaperPatternRepository(api);
      expect(await repo.forSubject('environmental_studies'), isNull);
      expect(await repo.forSubject('environmental_studies'), isNull);
      expect(api.calls.where((c) => c.contains('environmental_studies')), hasLength(1));

      await expectLater(repo.forSubject('accountancy'), throwsA(isA<ApiError>()));
      fail = false;
      expect((await repo.forSubject('accountancy'))?.subject, 'accountancy');
    });

    test('a malformed id never reaches the server', () async {
      final api = _FakeApi((path, query) async => ApiResponse(200, _raw('accountancy.json')));
      final repo = PaperPatternRepository(api);
      for (final bad in ['', '../me', 'a/b', 'acc ountancy', 'x' * 65]) {
        expect(await repo.forSubject(bad), isNull, reason: bad);
      }
      expect(await repo.forSubject('mathematics', variant: '../x'), isNull);
      expect(api.calls, isEmpty);
    });
  });
}
