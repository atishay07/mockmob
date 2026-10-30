import 'dart:convert';

import 'package:crypto/crypto.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/storage/prefs_store.dart';
import 'keycards_models.dart';

/// What this phone kept of Key cards, for a read without a connection (KEYCARDS-BUILD-SPEC 4, Offline): each
/// opened deck under `keycards_deck_<chapterKey>` with the deck's sha, the home with its chapter states, and
/// the due queue. Every entry names the account it was read for, and another account's copy is never shown.
class KeyCardsCache {
  KeyCardsCache(this._store, {required this.userId, DateTime Function()? now}) : _now = now ?? DateTime.now;

  final PrefsStore _store;
  final String? userId;
  final DateTime Function() _now;

  static String deckKey(String chapterKey) => 'keycards_deck_$chapterKey';
  static const String homeKey = 'keycards_home';
  static const String dueKey = 'keycards_due';
  static const String reviewedKey = 'keycards_reviewed';

  /// Ratings made on this phone are remembered this long, to keep them out of a kept queue.
  static const Duration reviewedFor = Duration(hours: 48);

  /// The sha the deck is kept with: the server's own when it sends one, otherwise the sha-256 of the body.
  static String shaOf(Json body) {
    final own = asString(body['sha256']) ?? asString(body['sha']);
    if (own != null && own.isNotEmpty) return own;
    return sha256.convert(utf8.encode(jsonEncode(body))).toString();
  }

  Future<void> _put(String key, Json body, {Json extra = const {}}) async {
    final id = userId;
    if (id == null) return;
    try {
      await _store.setString(key, jsonEncode({'user': id, 'savedAt': _now().toUtc().toIso8601String(), ...extra, 'body': body}));
    } on Object {
      // A cache that cannot be written only means the next offline read has nothing to show.
    }
  }

  Future<({Json body, DateTime savedAt, Json raw})?> _get(String key) async {
    final id = userId;
    if (id == null) return null;
    try {
      final text = await _store.getString(key);
      if (text == null) return null;
      final j = asJson(jsonDecode(text));
      if (j['user'] != id) return null;
      final at = asDate(j['savedAt']);
      if (at == null) return null;
      return (body: asJson(j['body']), savedAt: at, raw: j);
    } on Object {
      return null;
    }
  }

  Future<void> saveHome(Json body) => _put(homeKey, body);

  Future<({KcHome home, DateTime savedAt})?> home() async {
    final got = await _get(homeKey);
    return got == null ? null : (home: KcHome.parse(got.body), savedAt: got.savedAt);
  }

  /// Keeps a deck. Returns its sha.
  Future<String> saveDeck(String chapterKey, Json body) async {
    final sha = shaOf(body);
    await _put(deckKey(chapterKey), body, extra: {'sha': sha});
    return sha;
  }

  Future<({KcDeck deck, DateTime savedAt, String sha})?> deck(String chapterKey) async {
    final got = await _get(deckKey(chapterKey));
    if (got == null) return null;
    return (deck: KcDeck.parse(got.body, chapterKey: chapterKey), savedAt: got.savedAt, sha: asStringOr(got.raw['sha'], ''));
  }

  Future<void> saveDue(Json body) => _put(dueKey, body);

  Future<({KcDue due, DateTime savedAt})?> due() async {
    final got = await _get(dueKey);
    return got == null ? null : (due: KcDue.parse(got.body), savedAt: got.savedAt);
  }

  /// Remembers that [cardId] was rated on this phone at [at].
  Future<void> markReviewed(String cardId, DateTime at) async {
    final kept = await _reviewed();
    kept[cardId] = at.toUtc();
    await _put(reviewedKey, {for (final e in kept.entries) e.key: e.value.toIso8601String()});
  }

  /// The cards rated on this phone in the last [reviewedFor], with when.
  Future<Map<String, DateTime>> reviewed() => _reviewed();

  Future<Map<String, DateTime>> _reviewed() async {
    final got = await _get(reviewedKey);
    if (got == null) return {};
    final cutoff = _now().toUtc().subtract(reviewedFor);
    return {
      for (final e in got.body.entries)
        if (asDate(e.value) case final at? when at.isAfter(cutoff)) e.key: at,
    };
  }
}
