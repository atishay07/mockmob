import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderOrFamily;

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../practice/data/practice_catalog.dart' show practiceSubjectProvider;
import '../../today/logic/subjects.dart' show canonicalSubject;
import 'learn_api.dart';
import 'learn_models.dart';
import 'learn_prefs.dart';

/// The Learn v2 routes. Off by default, so a screen under test never reaches the network; the app wires [HttpLearnApi] in
/// `liveAppOverrides`, the device demo its PreviewLearnApi, tests a FixtureLearnApi.
final learnApiProvider = Provider<LearnApi>((ref) => const OffLearnApi());

/// The start request keys of the signed-in account, kept on this phone until each run ends.
final learnRequestKeysProvider = Provider<LearnRequestKeys>(
  (ref) => LearnRequestKeys(
    ref.watch(learn2PrefsStoreProvider),
    userId: ref.watch(authSnapshotProvider.select((s) => s.userId)),
    now: ref.watch(nowProvider),
  ),
);

/// The subject Learn shows: Practice's own subject (one shared state, B 3.2), as the public id the Learn routes take
/// (`business` is `business_studies`). Learn switches it with `ref.read(practiceSubjectProvider.notifier).select(id)`.
final learnSubjectIdProvider = Provider<String>((ref) => canonicalSubject(ref.watch(practiceSubjectProvider)));

/// No hidden retries: each screen's own Try again is the retry.
Duration? _noRetry(int count, Object error) => null;

/// `GET /api/learn/home` of one subject: Learn home in one read (the subject body plus the shelves, as the web's `learnHome()`,
/// LK28). A refresh (`ref.invalidate`) keeps the previous home on screen while it runs (`value` stays, `isRefreshing`), and a
/// failed refresh keeps it too (`value` and `error` together). The Learn switch, the Learn door, Practice's pull and the home all
/// share this one read.
final learnHomeProvider = FutureProvider.autoDispose.family<LearnSubjectData, String>(
  retry: _noRetry,
  (ref, subject) => ref.watch(learnApiProvider).home(canonicalSubject(subject)),
);

/// The home read under its older name (what the Learn switch and Practice's pull have always read): the same provider.
final learnSubjectProvider = learnHomeProvider;

/// `GET /api/learn/covers` of one subject (Explore).
final learnCoversProvider = FutureProvider.autoDispose.family<LearnCovers, String>(
  retry: _noRetry,
  (ref, subject) => ref.watch(learnApiProvider).covers(canonicalSubject(subject)),
);

/// `GET /api/learn/shelves` of one subject (Find's sets; [LearnShelves.dueTotal] for a badge). Learn home gets the same body in
/// its own read (`LearnSubjectData.shelves`).
final learnShelvesProvider = FutureProvider.autoDispose.family<LearnShelves, String>(
  retry: _noRetry,
  (ref, subject) => ref.watch(learnApiProvider).shelves(canonicalSubject(subject)),
);

/// `GET /api/learn/search` (Find). Under two characters nothing is asked: the answer is `tooShort`, as the server's.
final learnSearchProvider = FutureProvider.autoDispose.family<LearnSearch, ({String subject, String query})>(retry: _noRetry, (ref, args) async {
  final q = args.query.trim();
  if (q.length < 2) return LearnSearch(query: q, tooShort: true);
  return ref.watch(learnApiProvider).search(canonicalSubject(args.subject), q);
});

/// `GET /api/learn/cards?chapter=&filter=` (the Cards view).
final learnChapterCardsProvider = FutureProvider.autoDispose.family<LearnChapterCards, ({String chapterKey, String filter})>(
  retry: _noRetry,
  (ref, args) => ref.watch(learnApiProvider).chapterCards(args.chapterKey, filter: args.filter),
);

/// `GET /api/learn/cards?subject=&filter=` (Find's shelf over a subject).
final learnSubjectCardsProvider = FutureProvider.autoDispose.family<LearnSubjectCards, ({String subject, String filter})>(
  retry: _noRetry,
  (ref, args) => ref.watch(learnApiProvider).subjectCards(canonicalSubject(args.subject), filter: args.filter),
);

/// `POST /api/learn/runs/preview` for one `(chapterKey, minutes, leaveOut, addNext)`. Each length is its own entry, so a
/// page that changes the length keeps its last numbers on screen itself until the new ones come (the web's rule).
final learnPreviewProvider = FutureProvider.autoDispose.family<LearnPreview, LearnPreviewKey>(
  retry: _noRetry,
  (ref, key) => ref.watch(learnApiProvider).preview(chapterKey: key.chapterKey, minutes: key.minutes, leaveOut: key.leaveOut, addNext: key.addNext),
);

/// Every Learn read, for a screen to read again after a run (a start, an answer or an end changes them all):
/// `invalidateLearnReads(ref.invalidate)`. Each keeps its previous value on screen while it reloads.
final List<ProviderOrFamily> learnReads = [
  learnSubjectProvider,
  learnCoversProvider,
  learnShelvesProvider,
  learnSearchProvider,
  learnChapterCardsProvider,
  learnSubjectCardsProvider,
  learnPreviewProvider,
];

void invalidateLearnReads(void Function(ProviderOrFamily provider) invalidate) {
  for (final p in learnReads) {
    invalidate(p);
  }
}

/// Whether the app shows Learn v2 (the server switch, APP-1101 decision 2): the last answer kept on this phone, refreshed
/// by every read of the shared subject (an answer: on; 404 LEARN_OFF: off; a failure keeps the last answer), so the Learn
/// door never flashes between the two. Off while [learnApiProvider] is [OffLearnApi]. Watching it reads the subject once,
/// which also fills [learnSubjectProvider] for the Learn home.
final learnOnProvider = NotifierProvider<LearnOnNotifier, bool>(LearnOnNotifier.new);

class LearnOnNotifier extends Notifier<bool> {
  bool? _heard;
  bool? _kept;
  Future<void>? _restoring;

  /// Completes once the answer kept on this phone has been read (or found missing). A screen that must not draw the
  /// wrong door for a moment on a cold start can wait on it, as Practice waits on its restored subject.
  Future<void> get restored => _restoring ?? Future<void>.value();

  @override
  bool build() {
    final api = ref.watch(learnApiProvider);
    if (api is OffLearnApi) return false;
    final prefs = ref.watch(learnPrefsProvider);
    final read = ref.listen<AsyncValue<LearnSubjectData>>(learnSubjectProvider(ref.watch(learnSubjectIdProvider)), (_, next) => _read(next));
    // A subject already read (the Learn home read it first) answers at once.
    final now = _answerOf(read.read());
    if (now != null && now != _heard) _remember(now);
    _restoring ??= _restore(prefs);
    return _heard ?? _kept ?? stateOrNull ?? false;
  }

  Future<void> _restore(LearnPrefs prefs) async {
    final kept = await prefs.learnOn();
    // A newer answer from the server wins over the kept one.
    if (!ref.mounted || kept == null || _heard != null) return;
    _kept = kept;
    state = kept;
  }

  /// On for an answer, off for 404 LEARN_OFF, null for a read that is loading or failed for another reason.
  static bool? _answerOf(AsyncValue<LearnSubjectData> value) {
    if (value.isLoading) return null;
    final error = value.error;
    if (error != null) return isLearnOff(error) ? false : null;
    return value.hasValue ? true : null;
  }

  void _read(AsyncValue<LearnSubjectData> next) {
    final on = _answerOf(next);
    if (on != null) heard(on);
  }

  /// What the server just said: on (a Learn route answered) or off (404 LEARN_OFF). Kept on the phone.
  void heard(bool on) {
    _remember(on);
    state = on;
  }

  void _remember(bool on) {
    _heard = on;
    if (_kept != on) {
      _kept = on;
      unawaited(ref.read(learnPrefsProvider).setLearnOn(on));
    }
  }
}

/// The Explore feed length, 5 | 10 | 20 (default 10), remembered on this phone.
final learnFeedMinutesProvider = NotifierProvider<LearnFeedMinutes, int>(LearnFeedMinutes.new);

class LearnFeedMinutes extends Notifier<int> {
  bool _chosen = false;

  @override
  int build() {
    final prefs = ref.watch(learnPrefsProvider);
    unawaited(_restore(prefs));
    return stateOrNull ?? LearnPrefs.defaultFeedMinutes;
  }

  Future<void> _restore(LearnPrefs prefs) async {
    final m = await prefs.feedMinutes();
    // A length chosen while the store was read is newer: it wins.
    if (!ref.mounted || _chosen) return;
    state = m;
  }

  void set(int minutes) {
    if (!LearnPrefs.feedLengths.contains(minutes)) return;
    _chosen = true;
    state = minutes;
    unawaited(ref.read(learnPrefsProvider).setFeedMinutes(minutes));
  }
}

/// The chapter page's last length on this phone (null until one is chosen: the page uses its own default).
final learnChapterMinutesProvider = NotifierProvider<LearnChapterMinutes, int?>(LearnChapterMinutes.new);

class LearnChapterMinutes extends Notifier<int?> {
  bool _chosen = false;

  @override
  int? build() {
    final prefs = ref.watch(learnPrefsProvider);
    unawaited(_restore(prefs));
    return stateOrNull;
  }

  Future<void> _restore(LearnPrefs prefs) async {
    final m = await prefs.chapterMinutes();
    if (!ref.mounted || _chosen || m == null) return;
    state = m;
  }

  void set(int minutes) {
    if (minutes < 1 || minutes > LearnPrefs.maxMinutes) return;
    _chosen = true;
    state = minutes;
    unawaited(ref.read(learnPrefsProvider).setChapterMinutes(minutes));
  }
}
