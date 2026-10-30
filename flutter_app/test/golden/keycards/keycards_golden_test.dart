import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/mistake_lab_traps.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/keycards/data/keycards_cache.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/keycards/data/keycards_providers.dart';
import 'package:mockmob/features/keycards/data/keycards_rules.dart';
import 'package:mockmob/features/keycards/keycards_copy.dart';
import 'package:mockmob/features/keycards/screens/keycards_deck_screen.dart';
import 'package:mockmob/features/keycards/screens/keycards_home_screen.dart';
import 'package:mockmob/features/keycards/widgets/line_you_needed.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import 'package:mockmob/features/review/again/review_again_entry.dart';
import 'package:mockmob/features/review/revise/revise_data.dart';
import 'package:mockmob/features/review/revise/revise_screen.dart';

import '../../unit/keycards/support/keycards_fakes.dart';
import '../review/review_golden_support.dart' show reviewOverrides;
import 'kc_golden_support.dart';

/// A home read that never arrives (the skeleton).
class _NeverApi extends FakeKeyCardsApi {
  @override
  Future<(KcHome, Map<String, dynamic>)> home() => Completer<(KcHome, Map<String, dynamic>)>().future;
}

/// Revise with nothing of its own today: the Key cards due are the run. The server merges the same Key cards
/// into its queue (KEYCARDS-BUILD-SPEC 2e) and counts their minutes; the phone plays them from their own route
/// and counts them once.
class _EmptyRevise implements ReviseApi {
  _EmptyRevise([this.keyCards = const []]);

  /// The `card` bodies of the server's merged `keycard` items.
  final List<Map<String, dynamic>> keyCards;

  @override
  Future<ReviseRead> read({required int cap}) async => ReviseRead.parse({
    'version': 2,
    'queue': {
      'items': [for (final c in keyCards) {'kind': 'keycard', 'cardId': c['id'], 'card': c}],
      'counts': {'questions': 0, 'again': 0, 'checks': 0, 'cards': 0, 'back': 0, 'keycards': keyCards.length},
      'total': keyCards.length,
      'minutes': (keyCards.length * 15 / 60).ceil(),
    },
    'state': 'empty',
    'today': '2026-10-31',
    'cap': cap,
    'due': 0,
    'shown': 0,
    'answeredToday': 0,
    'minutes': 0,
    'boxes': [0, 0, 0, 0],
    'cards': 0,
    'nextDay': null,
    'nextDayLabel': null,
    'head': 'Nothing to revise today',
    'summary': null,
    'next': 'Questions you get wrong in a paper or a practice set come back here after 1, 3, 7 and 21 days.',
    'items': <dynamic>[],
  });

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) => throw StateError('no question');
}

MemoryPrefsStore _keptHome(FakeKeyCardsApi api) => MemoryPrefsStore()
  ..values[KeyCardsCache.homeKey] = jsonEncode({'user': 'u1', 'savedAt': kcNow.toUtc().toIso8601String(), 'body': api.homeBody()});

/// Revise that cannot be read: the phone is offline.
class _OfflineRevise implements ReviseApi {
  @override
  Future<ReviseRead> read({required int cap}) async => throw kcOffline;

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) => throw kcOffline;
}

/// The server's due cards for the student with progress, as `/api/keycards/due` and its Revise queue carry them.
List<Map<String, dynamic>> _dueBodies() {
  final api = FakeKeyCardsApi.withProgress();
  final states = [
    for (final c in api.cards)
      if (api.states[c.id] case final s?) KcDueCard(card: c, reps: s.reps, lapses: s.lapses, due: s.due),
  ];
  return [for (final d in KeyCardRules.dueQueue(states, now: kcNow, newAllowanceLeft: KeyCardRules.freeNewPerDay)) d.toJson()];
}

/// The due queue as this phone kept it at 9:40 PM.
MemoryPrefsStore _keptDue() => MemoryPrefsStore()
  ..values[KeyCardsCache.dueKey] = jsonEncode({
    'user': 'u1',
    'savedAt': kcNow.toUtc().toIso8601String(),
    'body': {'cards': _dueBodies(), 'today': {'due': 5, 'newLeft': 5, 'reviewsLeft': 10, 'minutes': 2}},
  });

Future<void> _rate(WidgetTester tester, String label) async {
  await kcTap(tester, find.text(KeyCardsCopy.tapToReveal));
  await kcTap(tester, kcKey(label));
}

/// Key cards (KEYCARDS-BUILD-SPEC 4) at 360 dp, Night and Day: home (Free, Pro, offline, loading, error), the
/// chapter deck in each mode (Free and Pro), an empty chapter, the report sheet, Revise playing Key cards
/// (and Free's daily limit), and the line you needed.
void main() {
  // Home.
  kcGolden('kc_home_free', () => const KeyCardsHomeScreen(), overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()), size: const Size(360, 900));
  kcGolden('kc_home_pro', () => const KeyCardsHomeScreen(), overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress(isPro: true)), size: const Size(360, 900));
  kcGolden(
    'kc_home_accountancy',
    () => const KeyCardsHomeScreen(initialSubject: 'accountancy'),
    overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()),
    size: const Size(360, 780),
  );
  kcGolden('kc_home_offline', () => const KeyCardsHomeScreen(), overrides: () {
    final api = FakeKeyCardsApi.withProgress();
    final store = _keptHome(api);
    api.failWith = kcOffline;
    return keyCardsOverrides(api, store: store);
  }, size: const Size(360, 900));
  kcGolden('kc_home_loading', () => const KeyCardsHomeScreen(), overrides: () => keyCardsOverrides(_NeverApi()), size: const Size(360, 700));
  kcGolden('kc_home_error', () => const KeyCardsHomeScreen(), overrides: () => keyCardsOverrides(FakeKeyCardsApi(failWith: kcOffline)), size: const Size(360, 700));

  // The chapter deck.
  kcGolden('kc_deck_read_free', () => const KeyCardsDeckScreen(chapterKey: kcChapter1), overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()), size: const Size(360, 1800));
  kcGolden('kc_deck_read_pro', () => const KeyCardsDeckScreen(chapterKey: kcChapter2), overrides: () => keyCardsOverrides(FakeKeyCardsApi(isPro: true)), size: const Size(360, 1300));
  kcGolden('kc_deck_study_front', () => const KeyCardsDeckScreen(chapterKey: kcChapter1, initialMode: KcMode.study), overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()), size: const Size(360, 900));
  kcGolden(
    'kc_deck_study_answer',
    () => const KeyCardsDeckScreen(chapterKey: kcChapter1, initialMode: KcMode.study),
    overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()),
    size: const Size(360, 1100),
    after: (tester) async {
      // To the third card (a term with its blank), then show its answer.
      await _rate(tester, KeyCardsCopy.gotIt);
      await _rate(tester, KeyCardsCopy.easy);
      await kcTap(tester, find.text(KeyCardsCopy.tapToReveal));
    },
  );
  kcGolden(
    'kc_deck_study_end',
    () => const KeyCardsDeckScreen(chapterKey: kcChapter1, initialMode: KcMode.study),
    overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()),
    size: const Size(360, 1100),
    after: (tester) async {
      for (final label in [KeyCardsCopy.gotIt, KeyCardsCopy.easy, KeyCardsCopy.missed, KeyCardsCopy.gotIt, KeyCardsCopy.gotIt]) {
        await _rate(tester, label);
      }
      tester.view.physicalSize = const Size(360, 800) * 2;
      await kcSettle(tester);
    },
  );
  kcGolden('kc_deck_last_look', () => const KeyCardsDeckScreen(chapterKey: kcChapter2, initialMode: KcMode.lastLook), overrides: () => keyCardsOverrides(FakeKeyCardsApi(isPro: true)), size: const Size(360, 900));
  kcGolden('kc_deck_empty', () => const KeyCardsDeckScreen(chapterKey: kcAccountancyChapter), overrides: () => keyCardsOverrides(FakeKeyCardsApi()), size: const Size(360, 640));
  kcGolden(
    'kc_report_sheet',
    () => const KeyCardsDeckScreen(chapterKey: kcChapter2),
    overrides: () => keyCardsOverrides(FakeKeyCardsApi(isPro: true)),
    size: const Size(360, 800),
    // The sheet is a route over the screen: the frame is the whole app.
    capture: () => find.byType(MaterialApp),
    after: (tester) async {
      await kcTap(tester, find.bySemanticsLabel(KeyCardsCopy.moreActions));
    },
  );

  // Revise with Key cards as the third kind of item.
  kcGolden(
    'kc_revise_front',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_EmptyRevise(_dueBodies())),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      keyCardsApiProvider.overrideWithValue(FakeKeyCardsApi.withProgress()),
      keyCardsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: const Size(360, 900),
  );
  kcGolden(
    'kc_revise_card',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_EmptyRevise(_dueBodies())),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      keyCardsApiProvider.overrideWithValue(FakeKeyCardsApi.withProgress()),
      keyCardsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: const Size(360, 1100),
    after: (tester) async {
      await kcTap(tester, find.text(KeyCardsCopy.tapToReveal));
    },
  );
  kcGolden(
    'kc_revise_cap',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_EmptyRevise(_dueBodies())),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      keyCardsApiProvider.overrideWithValue(FakeKeyCardsApi.withProgress(reviewsLeft: 1)),
      keyCardsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: const Size(360, 1100),
    after: (tester) async {
      await _rate(tester, KeyCardsCopy.gotIt);
      await _rate(tester, KeyCardsCopy.gotIt);
      tester.view.physicalSize = const Size(360, 900) * 2;
      await kcSettle(tester);
    },
  );

  // Offline: Revise's questions cannot be read, the Key cards this phone kept at 9:40 PM play on their own.
  kcGolden(
    'kc_revise_offline',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(nowUtc: kcNow.toUtc()),
      reviseApiProvider.overrideWithValue(_OfflineRevise()),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      keyCardsApiProvider.overrideWithValue(FakeKeyCardsApi.withProgress(failWith: kcOffline)),
      keyCardsPrefsStoreProvider.overrideWithValue(_keptDue()),
    ],
    size: const Size(360, 1000),
  );

  // The line you needed, under a wrong answer.
  kcGolden(
    'kc_line_needed',
    () => Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.mmColors.ground,
        body: const Padding(
          padding: EdgeInsets.all(MmSpace.gutter),
          child: Align(alignment: Alignment.topCenter, child: LineYouNeeded(questionId: 'q-wrong-1', topGap: 0)),
        ),
      ),
    ),
    overrides: () => keyCardsOverrides(FakeKeyCardsApi.withProgress()),
    size: const Size(360, 520),
  );

  // Free has read today's lines: the one just read stays, the Pro gate stands in the next block's place (once).
  kcGolden(
    'kc_line_gate',
    () => Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.mmColors.ground,
        body: const Padding(
          padding: EdgeInsets.all(MmSpace.gutter),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LineYouNeeded(questionId: 'q-wrong-1', topGap: 0),
              LineYouNeeded(questionId: 'q-wrong-2'),
              LineYouNeeded(questionId: 'q-wrong-3'),
            ],
          ),
        ),
      ),
    ),
    overrides: () {
      final api = FakeKeyCardsApi.withProgress();
      api.links['q-wrong-2'] = api.links['q-wrong-1']!;
      api.links['q-wrong-3'] = api.links['q-wrong-1']!;
      api.gatedLines.addAll(['q-wrong-2', 'q-wrong-3']);
      return [...keyCardsOverrides(api), proNudgesOnProvider.overrideWithValue(true)];
    },
    size: const Size(360, 760),
  );

  // Review's Revise row with only Key cards due (no question is).
  kcGolden(
    'kc_review_revise_row',
    () => Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.mmColors.ground,
        body: const Padding(
          padding: EdgeInsets.all(MmSpace.gutter),
          child: Align(alignment: Alignment.topCenter, child: ReviewAgainRow()),
        ),
      ),
    ),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_EmptyRevise()),
      keyCardsApiProvider.overrideWithValue(FakeKeyCardsApi.withProgress()),
      keyCardsPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: const Size(360, 200),
  );
}
