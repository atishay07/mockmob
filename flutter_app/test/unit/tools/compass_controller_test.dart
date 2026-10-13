// Compass's saved choices: a combination from Combo is shown without replacing the student's
// own subjects, work done for the subjects is not repeated on a score keystroke, and typing a
// score does not write on every key.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/tools/compass/compass_controller.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';

import 'tools_test_support.dart';

/// Prefs that take a moment to write, so overlapping saves can be seen.
class _SlowPrefs extends MemoryPrefsStore {
  int writes = 0;

  @override
  Future<void> setString(String key, String value) async {
    writes++;
    await Future<void>.delayed(const Duration(milliseconds: 5));
    values[key] = value;
  }
}

void main() {
  const mine = 'english,accountancy,business_studies,economics';

  ProviderContainer container(MemoryPrefsStore prefs) {
    final c = ProviderContainer(overrides: toolsOverrides(prefs: prefs));
    addTearDown(c.dispose);
    return c;
  }

  String saved(MemoryPrefsStore prefs) => (jsonDecode(prefs.values['mm.tools.compass.v1']! as String) as Map)['s'] as String;

  Future<DuSelection> combo(ProviderContainer c) async {
    final catalog = (await c.read(compassControllerProvider.future)).catalog;
    return DuSelection.fromIds(const ['english', 'mathematics', 'economics'], catalog);
  }

  test('a combination is shown without replacing the saved subjects', () async {
    final prefs = savedCompass(mine);
    final c = container(prefs);
    final other = await combo(c);
    c.read(compassControllerProvider.notifier).showCombination(other);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    final s = c.read(compassControllerProvider).requireValue;
    expect(s.selection, other);
    expect(s.previewing, isTrue);
    expect(saved(prefs), mine, reason: 'looking at a combination is not choosing it');
  });

  test('a score or category change while a combination is shown still saves the student\'s own subjects', () async {
    final prefs = savedCompass(mine);
    final c = container(prefs);
    final other = await combo(c);
    final n = c.read(compassControllerProvider.notifier)..showCombination(other);
    n.setScore('640');
    n.setCategory('OBC-NCL');
    await Future<void>.delayed(const Duration(milliseconds: 10));

    final m = jsonDecode(prefs.values['mm.tools.compass.v1']! as String) as Map;
    expect(m['s'], mine);
    expect(m['score'], '640');
    expect(m['c'], 'OBC-NCL');
  });

  test('changing a subject, or keeping the combination, makes it the saved choice', () async {
    final prefs = savedCompass(mine);
    final c = container(prefs);
    final other = await combo(c);
    final n = c.read(compassControllerProvider.notifier)..showCombination(other);
    n.keepCombination();
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(saved(prefs), other.encode());
    expect(c.read(compassControllerProvider).requireValue.previewing, isFalse);

    n.setSelection(DuSelection.empty);
    n.showCombination(other);
    n.toggle(other.picks.first);
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(c.read(compassControllerProvider).requireValue.previewing, isFalse);
    expect(saved(prefs), c.read(compassControllerProvider).requireValue.selection.encode());
  });

  test('a combination asked for before Compass has loaded is shown once it has, and not saved', () async {
    final prefs = savedCompass(mine);
    final c = container(prefs);
    final catalogProbe = ProviderContainer(overrides: toolsOverrides(prefs: savedCompass(mine)));
    addTearDown(catalogProbe.dispose);
    final other = await combo(catalogProbe);

    c.read(compassControllerProvider.notifier).showCombination(other);
    final s = await c.read(compassControllerProvider.future);
    expect(s.selection, other);
    expect(s.previewing, isTrue);
    await Future<void>.delayed(const Duration(milliseconds: 10));
    expect(saved(prefs), mine);
  });

  test('a score keystroke or category tap reuses what the subjects already worked out', () async {
    final c = container(savedCompass(mine));
    final n = c.read(compassControllerProvider.notifier);
    final first = await c.read(compassControllerProvider.future);
    final eligible = first.eligible;
    final unlocks = first.unlocks;

    n.setScore('6');
    n.setScore('65');
    n.setCategory('SC');
    final next = c.read(compassControllerProvider).requireValue;
    expect(next.scoreText, '65');
    expect(next.category, 'SC');
    expect(identical(next.eligible, eligible), isTrue);
    expect(identical(next.unlocks, unlocks), isTrue);

    n.toggle(next.selection.picks.first);
    expect(identical(c.read(compassControllerProvider).requireValue.eligible, eligible), isFalse, reason: 'new subjects, new answer');
  });

  test('typing a score does not write on every key, and the last value is what is saved', () async {
    final prefs = _SlowPrefs()..values['mm.tools.compass.v1'] = '{"s":"$mine","c":"UR","score":""}';
    final c = container(prefs);
    final n = c.read(compassControllerProvider.notifier);
    await c.read(compassControllerProvider.future);
    for (final t in ['6', '65', '650', '650.', '650.5']) {
      n.setScore(t);
    }
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(prefs.writes, lessThan(5));
    expect((jsonDecode(prefs.values['mm.tools.compass.v1']! as String) as Map)['score'], '650.5');
  });
}
