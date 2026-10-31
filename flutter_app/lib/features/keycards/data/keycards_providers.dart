import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../../core/storage/prefs_store.dart';
import 'keycards_api.dart';
import 'keycards_cache.dart';
import 'keycards_models.dart';
import 'keycards_reviews.dart';
import 'keycards_rules.dart';

/// The Key cards routes. Off by default: core keeps the safe default so a screen under test never reaches
/// the network; the app wires the real routes in `liveAppOverrides` and the device demo its fixture deck.
final keyCardsApiProvider = Provider<KeyCardsApi>((ref) => const OffKeyCardsApi());

/// Where ratings and reports go: straight through [keyCardsApiProvider] by default, through the outbox in
/// the app (`liveAppOverrides`).
final keyCardReviewsProvider = Provider<KeyCardReviews>((ref) => DirectKeyCardReviews(ref.watch(keyCardsApiProvider)));

/// Replaced with a [MemoryPrefsStore] in tests.
final keyCardsPrefsStoreProvider = Provider<PrefsStore>((ref) {
  try {
    return SharedPrefsStore();
  } on Object {
    return MemoryPrefsStore();
  }
});

final keyCardsCacheProvider = Provider<KeyCardsCache>(
  (ref) => KeyCardsCache(
    ref.watch(keyCardsPrefsStoreProvider),
    userId: ref.watch(authSnapshotProvider.select((s) => s.userId)),
    now: ref.watch(nowProvider),
  ),
);

/// A read and, when it came from this phone's copy because the server could not be reached, when that copy
/// was made ("As of 9:40 PM").
class KcRead<T> {
  const KcRead(this.value, {this.savedAt});

  final T value;
  final DateTime? savedAt;

  bool get cached => savedAt != null;
}

/// A read failed for a reason the kept copy may stand in for: no connection, a slow or failing server.
bool _canUseKept(Object e) => e is ApiError && (e.isOffline || e.isBlocked || e.kind == ApiErrorKind.server || e.kind == ApiErrorKind.unavailable);

/// `GET /api/keycards`, only while signed in. Off (no entry anywhere) when the server has them off. No hidden
/// retries: the screen's own Try again is the retry.
final keyCardsHomeProvider = FutureProvider.autoDispose<KcRead<KcHome>>(retry: (count, error) => null, (ref) async {
  // Off before anything else is read: a screen under test, or a build without the routes, touches nothing.
  final api = ref.watch(keyCardsApiProvider);
  if (api is OffKeyCardsApi) return const KcRead(KcHome.off);
  final userId = ref.watch(authSnapshotProvider.select((s) => s.userId));
  if (userId == null) return const KcRead(KcHome.off);
  final cache = ref.watch(keyCardsCacheProvider);
  try {
    final (home, body) = await api.home();
    if (home.enabled) unawaited(cache.saveHome(body));
    return KcRead(home);
  } on KeyCardsOff {
    return const KcRead(KcHome.off);
  } on Object catch (e) {
    if (_canUseKept(e)) {
      final kept = await cache.home();
      if (kept != null && kept.home.enabled) return KcRead(kept.home, savedAt: kept.savedAt);
    }
    rethrow;
  }
});

/// Whether Key cards are on for this student: the entries in Learn and Review show only then. Loading or a
/// failed read is "not on", so nothing points at a page that cannot open.
final keyCardsOnProvider = Provider.autoDispose<bool>((ref) => ref.watch(keyCardsHomeProvider).value?.value.enabled ?? false);

/// One chapter's deck, kept on the phone with its sha each time it is read.
final keyCardsDeckProvider = FutureProvider.autoDispose.family<KcRead<KcDeck>, String>(retry: (count, error) => null, (ref, chapterKey) async {
  final api = ref.watch(keyCardsApiProvider);
  final cache = ref.watch(keyCardsCacheProvider);
  try {
    final (deck, body) = await api.deck(chapterKey);
    unawaited(cache.saveDeck(chapterKey, body));
    return KcRead(deck);
  } on Object catch (e) {
    if (_canUseKept(e)) {
      final kept = await cache.deck(chapterKey);
      if (kept != null) return KcRead(kept.deck, savedAt: kept.savedAt);
    }
    rethrow;
  }
});

/// The Key cards due now, for Revise: held while Revise is up, so a rating never reorders the run. Without a
/// connection it is the queue this phone kept, put in order again by the website's own rules and without the
/// cards rated since. Off or unreadable: none (Revise then plays what it had before).
final keyCardsDueProvider = FutureProvider.autoDispose<KcRead<KcDue>>(retry: (count, error) => null, (ref) async {
  final api = ref.watch(keyCardsApiProvider);
  if (api is OffKeyCardsApi) return const KcRead(KcDue.none);
  final userId = ref.watch(authSnapshotProvider.select((s) => s.userId));
  if (userId == null) return const KcRead(KcDue.none);
  final cache = ref.watch(keyCardsCacheProvider);
  final now = ref.watch(nowProvider);
  try {
    final (due, body) = await api.due();
    unawaited(cache.saveDue(body));
    final reviewed = await cache.reviewed();
    return KcRead(KcDue(cards: KeyCardRules.withoutReviewed(due.cards, reviewed), today: due.today));
  } on KeyCardsOff {
    return const KcRead(KcDue.none);
  } on Object catch (e) {
    if (_canUseKept(e)) {
      final kept = await cache.due();
      if (kept != null) {
        final reviewed = await cache.reviewed();
        // New cards go chapter by chapter in the syllabus order the home screen last showed.
        final home = (await cache.home())?.home;
        final rank = <String, int>{
          if (home != null)
            for (final (i, key) in [for (final s in home.subjects) for (final u in s.units) for (final c in u.chapters) c.key].indexed) key: i,
        };
        final queue = KeyCardRules.dueQueue(
          KeyCardRules.withoutReviewed(kept.due.cards, reviewed),
          now: now(),
          newAllowanceLeft: kept.due.today.newLeft ?? KeyCardRules.freeNewPerDay,
          chapterRank: (key) => rank[key] ?? (1 << 30),
        );
        return KcRead(KcDue(cards: queue, today: kept.due.today), savedAt: kept.savedAt);
      }
    }
    return const KcRead(KcDue.none);
  }
});

/// "The line you needed" for one question: nothing (hidden) when Key cards are off, the server found no
/// line, or the read failed; [KcLine.gated] when Free has read today's lines (402).
final keyCardsLineProvider = FutureProvider.autoDispose.family<KcLine, String>(retry: (count, error) => null, (ref, questionId) async {
  final api = ref.watch(keyCardsApiProvider);
  if (questionId.isEmpty || api is OffKeyCardsApi) return KcLine.none;
  if (ref.watch(authSnapshotProvider.select((s) => s.userId)) == null) return KcLine.none;
  try {
    final line = await api.line(questionId);
    // Free has a few lines a day and each read counts: an answer opened again shows the line it already
    // has instead of asking (and spending) again.
    ref.keepAlive();
    return line;
  } on KeyCardsProRequired {
    // Free read today's lines: the Pro gate stands in the block's place. Not kept, so a student who upgrades
    // and comes back reads again (this answer costs nothing).
    return KcLine.gated;
  } on Object {
    return KcLine.none;
  }
});

/// Pro's chapter reasons (`GET /api/me/chapters`), for the deck's header. Null when it cannot be read.
final keyCardsMyChaptersProvider = FutureProvider.autoDispose.family<KcMyChapters?, String>(retry: (count, error) => null, (ref, subject) async {
  try {
    return await ref.watch(keyCardsApiProvider).myChapters(subject);
  } on Object {
    return null;
  }
});

/// Rates one card: remembers the rating on this phone (so a kept queue drops the card) and sends it.
Future<KcSendOutcome> rateKeyCard(WidgetRef ref, {required String cardId, required int rating, required String mode}) async {
  final at = ref.read(nowProvider)();
  final outcome = await ref.read(keyCardReviewsProvider).review(cardId: cardId, rating: rating, mode: mode, at: at);
  if (outcome.kind == KcSendKind.sent || outcome.kind == KcSendKind.waiting) {
    unawaited(ref.read(keyCardsCacheProvider).markReviewed(cardId, at));
  }
  return outcome;
}

/// Which answer shows the Pro gate for "The line you needed" on the screen now: the first to ask. Free sees it
/// once per screen, not under every wrong answer. Released when no gate is on screen.
final keyCardsLineGateOwnerProvider = Provider.autoDispose<_GateOwner>((ref) => _GateOwner());

class _GateOwner {
  String? _owner;

  /// True when [questionId] owns the gate (and claims it if nobody does).
  bool claim(String questionId) => (_owner ??= questionId) == questionId;
}
