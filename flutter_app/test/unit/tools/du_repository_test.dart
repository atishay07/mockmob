import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/tools/data/du_repository.dart';
import 'package:mockmob/features/tools/data/tools_store.dart';

import 'tools_test_support.dart';

void main() {
  final index = File('assets/du/2026/index.json').readAsStringSync();
  final offerings = File('test/unit/tools/fixtures/b-com-hons.json').readAsStringSync();
  final now = DateTime(2026, 10, 13, 12);

  DuRepository repo(FakeSource s) => DuRepository(s, const InlineDuDecoder(), now: () => now);

  test('a fresh copy on the phone is used without touching the network', () async {
    final s = FakeSource(cache: {'index.json': (body: index, savedAt: now.subtract(const Duration(hours: 2)))});
    final c = await repo(s).catalog();
    expect(c.groups, hasLength(73));
    expect(s.fetched, isEmpty);
  });

  test('a stale copy is used at once and refreshed in the background', () async {
    final s = FakeSource(cache: {'index.json': (body: index, savedAt: now.subtract(const Duration(days: 3)))}, server: {'index.json': index});
    await repo(s).catalog();
    await Future<void>.delayed(Duration.zero);
    expect(s.fetched, ['index.json']);
    expect(s.written.keys, ['index.json']);
  });

  test('with no copy the bundled index is used, offline too', () async {
    final s = FakeSource(bundled: index, offline: true);
    final c = await repo(s).catalog();
    expect(c.groups, hasLength(73));
  });

  test('with nothing anywhere: offline says offline, a bad body says error and is not kept', () async {
    await expectLater(repo(FakeSource(offline: true)).catalog(), throwsA(isA<DuLoadError>().having((e) => e.offline, 'offline', isTrue)));
    final bad = FakeSource(server: {'index.json': '<html>captive portal</html>'});
    await expectLater(repo(bad).catalog(), throwsA(isA<DuLoadError>().having((e) => e.offline, 'offline', isFalse)));
    expect(bad.written, isEmpty);
  });

  test('offerings come from the server once, then from the phone', () async {
    final s = FakeSource(server: {'offerings/b-com-hons.json': offerings});
    final first = await repo(s).offerings('b-com-hons');
    expect(first.seats, hasLength(55));
    expect(s.written.keys, ['offerings/b-com-hons.json']);
  });

  test('tools choices are saved and read back', () async {
    final store = ToolsStore(MemoryPrefsStore());
    expect(await store.compass(), isNull);
    await store.saveCompass(const SavedCompass(subjects: 'english,accountancy', category: 'OBC-NCL', score: '650'));
    final c = await store.compass();
    expect([c!.subjects, c.category, c.score], ['english,accountancy', 'OBC-NCL', '650']);
    await store.saveCombo(const SavedCombo(targets: ['b-com-hons'], pool: ['language:english'], maxPapers: 4));
    final k = await store.combo();
    expect([k!.targets, k.pool, k.maxPapers], [['b-com-hons'], ['language:english'], 4]);
  });
}
