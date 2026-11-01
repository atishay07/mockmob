import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/storage/prefs_store.dart';

/// Learn v2's own small memory on this phone (shared_preferences through [PrefsStore], as Key cards keep theirs):
/// the feed length, the chapter length, first-time flags, the start request keys and the last answer of the server switch.
/// Conveniences only: a failed read gives the default (a flag reads as already seen, so nothing repeats or blocks) and a
/// failed write is dropped. Replaced with a [MemoryPrefsStore] in tests.
final learn2PrefsStoreProvider = Provider<PrefsStore>((ref) {
  try {
    return SharedPrefsStore();
  } on Object {
    return MemoryPrefsStore();
  }
});

/// The Learn v2 keys and their typed reads and writes.
class LearnPrefs {
  LearnPrefs(this._store);

  final PrefsStore _store;

  /// The Explore feed length: 5 | 10 | 20, default 10.
  static const String feedMinutesKey = 'learn2.feedMinutes';

  /// The chapter page's last length (any length the page offers).
  static const String minutesKey = 'learn2.minutes';

  /// The one-time nudge after the first turn of the first feed.
  static const String feedNudgeKey = 'learn2.feed.nudge.v1';

  /// The one-time nudge of Explore's covers (R2 ruling 7, LK29): the row slides 24 dp toward the next cover and settles, once.
  static const String coversNudgeKey = 'learn2.covers.nudge.v1';

  /// The run's coach lines already shown, once each (a set of ids).
  static const String coachKey = 'learn2.coach.v1';

  /// The kept start request keys (see [LearnRequestKeys]).
  static const String requestKeysKey = 'learn2.requestKeys';

  /// The last answer of the server switch (true: `GET /api/learn/subject` answered; false: 404 LEARN_OFF).
  static const String onKey = 'learn2.on';

  static const List<int> feedLengths = [5, 10, 20];
  static const int defaultFeedMinutes = 10;

  /// The longest chapter run the page offers ("Your own" goes to 2 hours).
  static const int maxMinutes = 240;

  Future<int> feedMinutes() async {
    try {
      final m = await _store.getInt(feedMinutesKey);
      return feedLengths.contains(m) ? m! : defaultFeedMinutes;
    } on Object {
      return defaultFeedMinutes;
    }
  }

  Future<void> setFeedMinutes(int minutes) async {
    if (!feedLengths.contains(minutes)) return;
    await _write(() => _store.setInt(feedMinutesKey, minutes));
  }

  /// The chapter length kept on this phone, or null when none was chosen yet.
  Future<int?> chapterMinutes() async {
    try {
      final m = await _store.getInt(minutesKey);
      return m != null && m >= 1 && m <= maxMinutes ? m : null;
    } on Object {
      return null;
    }
  }

  Future<void> setChapterMinutes(int minutes) async {
    if (minutes < 1 || minutes > maxMinutes) return;
    await _write(() => _store.setInt(minutesKey, minutes));
  }

  /// True once the feed's one-time nudge was shown (and on a failed read).
  Future<bool> feedNudgeSeen() async {
    try {
      return await _store.getBool(feedNudgeKey) ?? false;
    } on Object {
      return true;
    }
  }

  Future<void> markFeedNudgeSeen() => _write(() => _store.setBool(feedNudgeKey, true));

  /// True once Explore's covers showed their nudge (and on a failed read).
  Future<bool> coversNudgeSeen() async {
    try {
      return await _store.getBool(coversNudgeKey) ?? false;
    } on Object {
      return true;
    }
  }

  Future<void> markCoversNudgeSeen() => _write(() => _store.setBool(coversNudgeKey, true));

  /// True once the coach line [id] was shown (and on a failed read).
  Future<bool> coachSeen(String id) async {
    try {
      return (await _store.getStringList(coachKey) ?? const <String>[]).contains(id);
    } on Object {
      return true;
    }
  }

  Future<void> markCoachSeen(String id) async {
    try {
      final seen = {...?await _store.getStringList(coachKey), id};
      await _store.setStringList(coachKey, seen.toList()..sort());
    } on Object {
      // The worst case is a coach line once more.
    }
  }

  /// The last answer of the server switch, or null when this phone never heard one.
  Future<bool?> learnOn() async {
    try {
      return await _store.getBool(onKey);
    } on Object {
      return null;
    }
  }

  Future<void> setLearnOn(bool on) => _write(() => _store.setBool(onKey, on));

  Future<void> _write(Future<void> Function() write) async {
    try {
      await write();
    } on Object {
      // A preference that cannot be written is only not remembered.
    }
  }
}

final learnPrefsProvider = Provider<LearnPrefs>((ref) => LearnPrefs(ref.watch(learn2PrefsStoreProvider)));

/// Start request keys (BUILD-1101 1.3): one `lk_` and 24 hex characters per start, kept per scope (`kind|chapter` or
/// `kind|first card`) in memory and on the phone until the run ends ([forget]), so a retried or reloaded start returns
/// the same run instead of a second one. `fresh` ([keyFor] with `renew`) takes a new key. A key is kept for the India day
/// it was made on (the server resumes a run the same day only) and for the account it was made for.
class LearnRequestKeys {
  LearnRequestKeys(this._store, {this.userId, DateTime Function()? now, Random? random})
    : _now = now ?? DateTime.now,
      _random = random ?? _secureRandom();

  /// Keys held in memory only (tests, a build without a store).
  LearnRequestKeys.memory({String? userId, DateTime Function()? now, Random? random}) : this(null, userId: userId, now: now, random: random);

  final PrefsStore? _store;
  final String? userId;
  final DateTime Function() _now;
  final Random _random;

  Map<String, ({String key, String? runId, String day})>? _kept;
  Future<void> _queue = Future.value();

  static final RegExp pattern = RegExp(r'^lk_[0-9a-f]{24}$');

  static Random _secureRandom() {
    try {
      return Random.secure();
    } on UnsupportedError {
      return Random();
    }
  }

  /// A new key: 'lk_' and 24 hex characters (the server takes 8 to 100 of [A-Za-z0-9_-]).
  static String newKey([Random? random]) {
    final r = random ?? _secureRandom();
    return 'lk_${[for (var i = 0; i < 12; i++) r.nextInt(256).toRadixString(16).padLeft(2, '0')].join()}';
  }

  /// The India day of [at] ('2026-11-01'): a kept key lives for the day it was made on.
  static String istDay(DateTime at) {
    final ist = at.toUtc().add(const Duration(hours: 5, minutes: 30));
    return '${ist.year.toString().padLeft(4, '0')}-${ist.month.toString().padLeft(2, '0')}-${ist.day.toString().padLeft(2, '0')}';
  }

  /// The key of a start at [scope]: the kept one (a retry or a reload), or a new one when there is none or [renew].
  Future<String> keyFor(String scope, {bool renew = false}) => _locked(() async {
    final kept = await _load();
    final have = kept[scope];
    if (!renew && have != null) return have.key;
    final key = newKey(_random);
    kept[scope] = (key: key, runId: null, day: istDay(_now()));
    await _save(kept);
    return key;
  });

  /// The start at [scope] with [key] made run [runId].
  Future<void> keep(String scope, String key, String runId) => _locked(() async {
    final kept = await _load();
    kept[scope] = (key: key, runId: runId, day: istDay(_now()));
    await _save(kept);
  });

  /// The run ended: its key goes, so the next start of that scope makes a new run.
  Future<void> forget(String runId) => _locked(() async {
    final kept = await _load();
    final before = kept.length;
    kept.removeWhere((_, v) => v.runId == runId);
    if (kept.length != before) await _save(kept);
  });

  /// The key kept for [scope], if any (for tests and diagnostics).
  Future<String?> keptKey(String scope) => _locked(() async => (await _load())[scope]?.key);

  Future<T> _locked<T>(Future<T> Function() body) {
    final run = _queue.then((_) => body());
    _queue = run.then<void>((_) {}, onError: (Object _) {});
    return run;
  }

  Future<Map<String, ({String key, String? runId, String day})>> _load() async {
    final have = _kept;
    final today = istDay(_now());
    if (have != null) {
      have.removeWhere((_, v) => v.day != today);
      return have;
    }
    final out = <String, ({String key, String? runId, String day})>{};
    try {
      final text = await _store?.getString(LearnPrefs.requestKeysKey);
      if (text != null) {
        final j = asJson(jsonDecode(text));
        if (j['user'] == userId) {
          for (final e in asJson(j['keys']).entries) {
            final v = asJson(e.value);
            final key = asString(v['key']);
            final day = asString(v['day']);
            if (key != null && pattern.hasMatch(key) && day == today) out[e.key] = (key: key, runId: asString(v['runId']), day: day!);
          }
        }
      }
    } on Object {
      // Nothing kept: every start takes a new key.
    }
    return _kept = out;
  }

  Future<void> _save(Map<String, ({String key, String? runId, String day})> kept) async {
    final store = _store;
    if (store == null) return;
    try {
      await store.setString(
        LearnPrefs.requestKeysKey,
        jsonEncode({
          'user': userId,
          'keys': {
            for (final e in kept.entries) e.key: {'key': e.value.key, 'runId': e.value.runId, 'day': e.value.day},
          },
        }),
      );
    } on Object {
      // Kept in memory for this run of the app.
    }
  }
}
