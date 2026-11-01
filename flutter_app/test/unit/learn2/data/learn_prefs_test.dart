import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn2/data/learn_prefs.dart';

/// A store whose every read and write fails.
class _BrokenStore implements PrefsStore {
  @override
  Future<bool?> getBool(String key) => throw StateError('broken');
  @override
  Future<int?> getInt(String key) => throw StateError('broken');
  @override
  Future<String?> getString(String key) => throw StateError('broken');
  @override
  Future<List<String>?> getStringList(String key) => throw StateError('broken');
  @override
  Future<void> setBool(String key, bool value) => throw StateError('broken');
  @override
  Future<void> setInt(String key, int value) => throw StateError('broken');
  @override
  Future<void> setString(String key, String value) => throw StateError('broken');
  @override
  Future<void> setStringList(String key, List<String> value) => throw StateError('broken');
  @override
  Future<void> remove(String key) => throw StateError('broken');
}

void main() {
  group('request keys (BUILD-1101 1.3)', () {
    final morning = DateTime.utc(2026, 11, 1, 4); // 9:30 AM in India

    test("a key is 'lk_' and 24 hex characters", () {
      for (var i = 0; i < 50; i++) {
        expect(LearnRequestKeys.newKey(Random(i)), matches(LearnRequestKeys.pattern));
      }
      expect(LearnRequestKeys.newKey(), matches(LearnRequestKeys.pattern));
    });

    test('one key per scope until the run ends; renew takes a new one', () async {
      final keys = LearnRequestKeys(MemoryPrefsStore(), userId: 'u1', now: () => morning);
      final a = await keys.keyFor('feed|c');
      expect(await keys.keyFor('feed|c'), a);
      expect(await keys.keyFor('mix|c'), isNot(a));
      await keys.keep('feed|c', a, 'lr_1');
      expect(await keys.keyFor('feed|c'), a);
      final renewed = await keys.keyFor('feed|c', renew: true);
      expect(renewed, isNot(a));
      await keys.keep('feed|c', renewed, 'lr_2');
      await keys.forget('lr_2');
      expect(await keys.keptKey('feed|c'), isNull);
      expect(await keys.keyFor('feed|c'), isNot(renewed));
    });

    test('kept on the phone for the account and the India day it was made on', () async {
      final store = MemoryPrefsStore();
      var at = morning;
      final first = LearnRequestKeys(store, userId: 'u1', now: () => at);
      final key = await first.keyFor('feed|c');
      await first.keep('feed|c', key, 'lr_1');
      // A restart of the app: the same key from the store.
      expect(await LearnRequestKeys(store, userId: 'u1', now: () => at).keyFor('feed|c'), key);
      // Another account on the same phone never gets it.
      expect(await LearnRequestKeys(store, userId: 'u2', now: () => at).keptKey('feed|c'), isNull);
      // The next India day: 7:00 PM UTC is half past midnight in India.
      at = DateTime.utc(2026, 11, 1, 19);
      expect(LearnRequestKeys.istDay(at), '2026-11-02');
      expect(await LearnRequestKeys(store, userId: 'u1', now: () => at).keptKey('feed|c'), isNull);
      // Held in memory across the day's turn too.
      expect(await first.keptKey('feed|c'), isNull);
    });

    test('concurrent starts of one scope share one key', () async {
      final keys = LearnRequestKeys(MemoryPrefsStore(), userId: 'u1', now: () => morning);
      final both = await Future.wait([keys.keyFor('feed|c'), keys.keyFor('feed|c')]);
      expect(both[0], both[1]);
    });

    test('a broken store keeps the keys in memory', () async {
      final keys = LearnRequestKeys(_BrokenStore(), userId: 'u1', now: () => morning);
      final a = await keys.keyFor('feed|c');
      expect(await keys.keyFor('feed|c'), a);
      final memory = LearnRequestKeys.memory(now: () => morning);
      expect(await memory.keyFor('x'), await memory.keyFor('x'));
    });
  });

  group('LearnPrefs', () {
    test('feed minutes: 5, 10 or 20, default 10', () async {
      final store = MemoryPrefsStore();
      final prefs = LearnPrefs(store);
      expect(await prefs.feedMinutes(), 10);
      await prefs.setFeedMinutes(20);
      expect(await prefs.feedMinutes(), 20);
      expect(store.values[LearnPrefs.feedMinutesKey], 20);
      await prefs.setFeedMinutes(15);
      expect(await prefs.feedMinutes(), 20);
      store.values[LearnPrefs.feedMinutesKey] = 7;
      expect(await prefs.feedMinutes(), 10);
    });

    test('chapter minutes: none until chosen, any length the page offers', () async {
      final prefs = LearnPrefs(MemoryPrefsStore());
      expect(await prefs.chapterMinutes(), isNull);
      await prefs.setChapterMinutes(45);
      expect(await prefs.chapterMinutes(), 45);
      await prefs.setChapterMinutes(0);
      await prefs.setChapterMinutes(500);
      expect(await prefs.chapterMinutes(), 45);
    });

    test('first-time flags and the coach lines, once each', () async {
      final store = MemoryPrefsStore();
      final prefs = LearnPrefs(store);
      expect(await prefs.feedNudgeSeen(), isFalse);
      await prefs.markFeedNudgeSeen();
      expect(await prefs.feedNudgeSeen(), isTrue);
      expect(store.values[LearnPrefs.feedNudgeKey], isTrue);
      expect(await prefs.coachSeen('show'), isFalse);
      await prefs.markCoachSeen('show');
      await prefs.markCoachSeen('got');
      await prefs.markCoachSeen('show');
      expect(await prefs.coachSeen('show'), isTrue);
      expect(store.values[LearnPrefs.coachKey], ['got', 'show']);
    });

    test('the server switch: unknown until heard, then its last answer', () async {
      final prefs = LearnPrefs(MemoryPrefsStore());
      expect(await prefs.learnOn(), isNull);
      await prefs.setLearnOn(true);
      expect(await prefs.learnOn(), isTrue);
      await prefs.setLearnOn(false);
      expect(await prefs.learnOn(), isFalse);
    });

    test('a failed read gives the default and a flag reads as seen; a failed write is dropped', () async {
      final prefs = LearnPrefs(_BrokenStore());
      expect(await prefs.feedMinutes(), 10);
      expect(await prefs.chapterMinutes(), isNull);
      expect(await prefs.feedNudgeSeen(), isTrue);
      expect(await prefs.coachSeen('show'), isTrue);
      expect(await prefs.learnOn(), isNull);
      await prefs.setFeedMinutes(5);
      await prefs.markFeedNudgeSeen();
      await prefs.markCoachSeen('x');
      await prefs.setLearnOn(true);
    });
  });
}
