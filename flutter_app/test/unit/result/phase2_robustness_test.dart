import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/repositories.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/result/widgets/evidence_link.dart';
import 'package:mockmob/features/result/model/recap_variant.dart';
import 'package:mockmob/features/result/recap/recap_flow.dart';
import 'package:mockmob/features/result/recap/record_card.dart';
import 'package:mockmob/features/result/sheet/light_sweep.dart';
import 'package:mockmob/features/result/sheet/sheet_body.dart';
import 'package:mockmob/features/result/widgets/result_space.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

RecapData _data(RecapModel m) {
  final d = detail();
  return RecapData(model: m, attempt: d.attempt, detail: d, fetchedAt: DateTime(2026, 10, 12, 22, 44));
}

/// The data the screens read, changeable mid-test (the way the detail read lands later).
class _Holder extends Notifier<RecapData> {
  _Holder(this.initial);

  final RecapData initial;

  @override
  RecapData build() => initial;

  void set(RecapData d) => state = d;
}

class _Attempts extends AttemptsRepository {
  _Attempts(this.initial, this.onRefresh);

  final RemoteState<List<Attempt>> initial;
  final RemoteState<List<Attempt>> Function()? onRefresh;
  int refreshes = 0;

  @override
  RemoteState<List<Attempt>> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async {
    refreshes++;
    final next = onRefresh?.call();
    if (next != null) state = next;
  }
}

class _Detail extends AttemptDetailRepository {
  _Detail(super.attemptId, this.value);

  final AttemptDetail value;

  @override
  RemoteState<AttemptDetail> build() => RemoteState(value: value, fetchedAt: DateTime.utc(2026, 10, 12, 17, 14));

  @override
  Future<void> refresh({bool force = false}) async {}
}

void main() {
  setUpAll(loadAppFonts);
  final d = detail();

  group('result-01: card 4 never offers a 0-minute repair', () {
    // Every wrong answer already repaired on this phone: nothing to repair yet.
    final wrongIds = {
      for (final q in d.attempt.questions)
        if (d.attempt.detailFor(q.id)?.isCorrect == false) q.id,
    };
    final empty = mock7(repaired: wrongIds);
    final full = mock7();

    test('the length follows the model as it is now, not as it was when the card mounted', () {
      expect(empty.candidates, isEmpty);
      expect(effectiveRepairMinutes(empty, null), 0);
      expect(full.candidates, isNotEmpty);
      expect(effectiveRepairMinutes(full, null), full.defaultRepairMinutes);
      expect(effectiveRepairMinutes(full, null), greaterThan(0));
    });

    test("a choice is kept while it is an option, and a stale one gives way to the default", () {
      expect(effectiveRepairMinutes(full, 5), 5);
      expect(effectiveRepairMinutes(full, 0), full.defaultRepairMinutes);
      expect(effectiveRepairMinutes(full, 45), full.defaultRepairMinutes);
    });

    testWidgets('candidates that arrive after the card mounted give a real length on the key', (tester) async {
      final holder = NotifierProvider<_Holder, RecapData>(() => _Holder(_data(empty)));
      final base = resultOverrides(attemptId: 'a7', data: _data(empty));
      await pumpResultRoute(
        tester,
        location: '/result/a7/recap/4',
        overrides: [recapDataProvider('a7').overrideWith((ref) => ref.watch(holder)), ...base.skip(1)],
      );
      await tester.pump(const Duration(seconds: 2));
      expect(find.textContaining(RegExp(r'(^|\D)0-minute')), findsNothing);

      ProviderScope.containerOf(tester.element(find.byType(RecordCard))).read(holder.notifier).set(_data(full));
      await tester.pump(const Duration(seconds: 1));
      expect(find.textContaining(RegExp(r'(^|\D)0-minute')), findsNothing);
      expect(find.text(ResultCopy.startRepair(full.defaultRepairMinutes)), findsOneWidget);
    });
  });

  group('result-03: a slow result says so and offers a way on', () {
    testWidgets('after 6 s the sealed skeleton gives way to Try again and Go to Review', (tester) async {
      await pumpResultRoute(
        tester,
        location: '/result/a7/sealed',
        overrides: resultOverrides(attemptId: 'a7', data: const RecapData(loading: true)),
      );
      await tester.pump(const Duration(seconds: 2));
      expect(find.text(ResultCopy.slowTitle), findsNothing);
      await tester.pump(RecapPlaceholder.slowAfter);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(ResultCopy.slowTitle), findsOneWidget);
      expect(find.text(ResultCopy.tryAgain), findsOneWidget);
      await tester.tap(find.text(ResultCopy.backToReview));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('AT /review'), findsOneWidget);
    });

    testWidgets('Try again asks again and starts the wait over', (tester) async {
      var retries = 0;
      final router = GoRouter(
        initialLocation: '/',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => RecapPlaceholder(data: const RecapData(loading: true), attemptId: 'a7', onRetry: () => retries++),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(ProviderScope(child: MaterialApp.router(routerConfig: router)));
      await tester.pump(RecapPlaceholder.slowAfter + const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(find.text(ResultCopy.tryAgain));
      await tester.pump();
      expect(retries, 1);
      expect(find.text(ResultCopy.slowTitle), findsNothing);
      await tester.pump(RecapPlaceholder.slowAfter + const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(ResultCopy.slowTitle), findsOneWidget);
    });
  });

  group('result-04: the first-mock token belongs to its own mock', () {
    final mine = RhythmMilestone(id: 'first_full_mock', achievedAt: d.attempt.completedAt);
    final web = RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 9, 1, 10));

    test('a milestone earned by an earlier mock (on the web) gives no token to this one', () {
      final m = mock7(withDetail: d, attempts: [d.attempt], milestones: [web]);
      expect(m.firstMockTokenAt, isNull);
      expect(mock7(withDetail: d, attempts: [d.attempt], milestones: [mine]).firstMockTokenAt, isNotNull);
    });

    test('the milestone time matches to within a second', () {
      final t = d.attempt.completedAt;
      expect(sameSecond(t, t.add(const Duration(milliseconds: 400))), isTrue);
      expect(sameSecond(t, t.add(const Duration(seconds: 2))), isFalse);
    });

    ProviderContainer container(_Attempts list) {
      final c = ProviderContainer(
        overrides: [
          attemptsRepositoryProvider.overrideWith(() => list),
          attemptDetailProvider('a7').overrideWith(() => _Detail('a7', d)),
          resultReceivedProvider('a7').overrideWith((ref) async => null),
          rhythmRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<Rhythm>()),
          creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
          userIdProvider.overrideWithValue('u1'),
          repairLocalRecordsProvider.overrideWith((ref) => Stream.value(const [])),
        ],
      );
      addTearDown(c.dispose);
      return c;
    }

    test('a list read before this mock was finished is read once more, and the reveal waits for it', () async {
      final old = DateTime.utc(2026, 10, 1);
      final fresh = DateTime.utc(2026, 10, 12, 17, 20);
      late _Attempts list;
      list = _Attempts(
        RemoteState(value: [d.attempt], fetchedAt: old),
        () => RemoteState(value: [d.attempt], fetchedAt: old, loading: true),
      );
      final c = container(list);
      final sub = c.listen(recapDataProvider('a7'), (_, _) {});
      addTearDown(sub.close);
      await Future<void>.delayed(Duration.zero);
      expect(list.refreshes, 1);
      expect(c.read(recapDataProvider('a7')).revealPending, isTrue);

      // The fresh list holds the six earlier mocks taken elsewhere: this one is Mock 7.
      list.state = RemoteState(value: [...history(), d.attempt], fetchedAt: fresh);
      final data = c.read(recapDataProvider('a7'));
      expect(data.revealPending, isFalse);
      expect(data.model!.ordinal, 7);
      expect(data.model!.variant, isNot(RecapVariant.firstMock));
      await Future<void>.delayed(Duration.zero);
      expect(list.refreshes, 1, reason: 'asked once, not on every rebuild');
    });

    test('a failed re-read falls back to the cached list without asking again', () async {
      final list = _Attempts(RemoteState(value: [...history(), d.attempt], fetchedAt: DateTime.utc(2026, 10, 1)), null);
      final c = container(list);
      final sub = c.listen(recapDataProvider('a7'), (_, _) {});
      addTearDown(sub.close);
      await Future<void>.delayed(Duration.zero);
      list.state = RemoteState(value: list.state.value, fetchedAt: DateTime.utc(2026, 10, 1), loading: false);
      await Future<void>.delayed(Duration.zero);
      expect(list.refreshes, 1);
      expect(c.read(recapDataProvider('a7')).revealPending, isFalse);
      expect(c.read(recapDataProvider('a7')).model!.ordinal, 7);
    });
  });

  group('result-05: the sealed ritual is kept per account', () {
    test('a second account on the phone starts its own ritual', () async {
      final store = MemoryPrefsStore();
      final legacy = AppPrefs(MemoryPrefsStore());
      final a = RitualStore(store, legacy, 'a');
      for (var i = 0; i < 3; i++) {
        await a.markOpened();
      }
      await a.markSkipHintShown();
      final b = RitualStore(store, legacy, 'b');
      expect(await a.sheetsOpened(), 3);
      expect(await b.sheetsOpened(), 0);
      expect(await b.skipHintShown(), isFalse);
      expect(const RecapRitual(sheetsOpened: 0).firstEver, isTrue, reason: 'B gets the first-sheet nudge');
    });

    test('the old per-phone counts go once, to the first account that reads them', () async {
      final store = MemoryPrefsStore();
      final legacyStore = MemoryPrefsStore();
      final legacy = AppPrefs(legacyStore);
      await legacy.incrementSheetsOpened();
      await legacy.incrementSheetsOpened();
      await legacy.setSkipRevealHintShown(true);
      expect(await RitualStore(store, legacy, 'a').sheetsOpened(), 2);
      expect(await RitualStore(store, legacy, 'a').skipHintShown(), isTrue);
      expect(await RitualStore(store, legacy, 'b').sheetsOpened(), 0);
      expect(await RitualStore(store, legacy, 'b').skipHintShown(), isFalse);
    });
  });

  group('the celebration ladder on the reveal (MOTION 1.2, P0-5, P0-6)', () {
    test('only a higher result on Full gets the light; Quiet keeps the ink; Off is words', () {
      RevealLevel of(RecapVariant v, CelebrationMode m, {bool reduced = false}) => RevealLevel.of(v, m, reduced: reduced);
      expect(of(RecapVariant.higher, CelebrationMode.full), RevealLevel.celebrate);
      expect(of(RecapVariant.higher, CelebrationMode.quiet), RevealLevel.plain);
      expect(of(RecapVariant.higher, CelebrationMode.off), RevealLevel.words);
      expect(of(RecapVariant.standard, CelebrationMode.full), RevealLevel.plain, reason: 'no sweep after an ordinary result');
      expect(of(RecapVariant.firstMock, CelebrationMode.full), RevealLevel.plain, reason: 'a first mock is never a score celebration');
      expect(of(RecapVariant.lower, CelebrationMode.full), RevealLevel.words);
      expect(of(RecapVariant.held, CelebrationMode.full), RevealLevel.words);
      expect(of(RecapVariant.higher, CelebrationMode.full, reduced: true), RevealLevel.words);
      expect(RevealLevel.celebrate.lights, isTrue);
      expect(RevealLevel.plain.lights, isFalse);
      expect(RevealLevel.plain.moves, isTrue);
      expect(RevealLevel.words.moves, isFalse);
    });

    final higher = detail(recap: {
      'tone': 'higher',
      'previousComparable': {'marks': 92, 'max': 250, 'attemptId': 'p5'},
    });

    for (final (mode, sweeps) in [(CelebrationMode.full, true), (CelebrationMode.quiet, false), (CelebrationMode.off, false)]) {
      testWidgets('a higher result on ${mode.name}: ${sweeps ? 'one sweep' : 'no sweep'}', (tester) async {
        final m = mock7(withDetail: higher);
        await pumpResultRoute(
          tester,
          location: '/result/a7/recap/1',
          overrides: resultOverrides(
            attemptId: 'a7',
            data: RecapData(model: m, attempt: higher.attempt, detail: higher),
            extra: [celebrationModeProvider.overrideWithValue(mode)],
          ),
        );
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.byType(LightSweep), sweeps ? findsOneWidget : findsNothing);
        await tester.pump(const Duration(seconds: 4));
      });
    }

    testWidgets('an ordinary result has no sweep even on Full', (tester) async {
      await pumpResultRoute(tester, location: '/result/a7/recap/1', overrides: resultOverrides(attemptId: 'a7', data: _data(mock7())));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(LightSweep), findsNothing);
      await tester.pump(const Duration(seconds: 4));
    });
  });

  group('layout (audit X1, X3)', () {
    testWidgets('the folded sheet sits in the middle of the band between the words and the keys', (tester) async {
      await pumpResultRoute(
        tester,
        location: '/result/a7/sealed',
        overrides: resultOverrides(attemptId: 'a7', data: _data(mock7()), ritual: const RecapRitual(sheetsOpened: 1)),
      );
      await tester.pump(const Duration(seconds: 1));
      final words = tester.getRect(find.text(ResultCopy.openWhenReady));
      final body = tester.getRect(find.byType(SheetBody));
      final tab = tester.getRect(find.text('Open your result'));
      final above = body.top - words.bottom;
      // The band ends 20 dp above the tab's key (the stage's own bottom padding) and the key's
      // text sits inside its 56 dp pill.
      expect(above, greaterThan(48));
      expect(tab.top - body.bottom, greaterThan(above - 40));
      expect(tab.top - body.bottom, lessThan(above + 80));
      await tester.pump(const Duration(seconds: 2));
    });

    testWidgets('card 4 is weighted, not stacked at the top over a hole', (tester) async {
      await pumpResultRoute(tester, location: '/result/a7/recap/4', overrides: resultOverrides(attemptId: 'a7', data: _data(mock7())));
      await tester.pump(const Duration(seconds: 2));
      final head = tester.getRect(find.text(ResultCopy.inRecord('Mock 7')));
      final last = tester.getRect(find.text(ResultCopy.shareSheet));
      final key = tester.getRect(find.textContaining('-minute repair'));
      final above = head.top - 56; // under the 56 dp story bar
      final below = key.top - last.bottom;
      expect(above, greaterThan(ResultSpace.moment));
      expect(below / above, lessThan(3.2));
    });
  });

  group('an evidence row stays lit while its sheet is up (MOTION C4 item 6)', () {
    testWidgets('the arrow turns toward the sheet and comes back when it closes', (tester) async {
      final closed = Completer<void>();
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            home: Scaffold(body: EvidenceLink(label: 'Why this?', onTap: () => closed.future)),
          ),
        ),
      );
      double turns() => tester.widget<AnimatedRotation>(find.byType(AnimatedRotation)).turns;
      expect(turns(), 0);
      await tester.tap(find.text('Why this?'));
      await tester.pump();
      expect(turns(), 0.25);
      closed.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(turns(), 0);
    });

    testWidgets('a row that opens a page, not a sheet, never lights', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildTheme(Brightness.dark),
            home: Scaffold(body: EvidenceLink(label: 'See the questions', onTap: () {})),
          ),
        ),
      );
      await tester.tap(find.text('See the questions'));
      await tester.pump();
      expect(tester.widget<AnimatedRotation>(find.byType(AnimatedRotation)).turns, 0);
    });
  });
}
