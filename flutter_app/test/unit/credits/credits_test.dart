import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/json_helpers.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmChip, MmSurface;
import 'package:mockmob/features/credits/credits_copy.dart';
import 'package:mockmob/features/credits/credits_screen.dart';
import 'package:mockmob/features/credits/data/credit_figures.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show MeCreditsRepository, meCreditsProvider;
import 'package:mockmob/features/credits/data/credits_models.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import '../you/you_test_support.dart';

Finder _card(String label) => find.byWidgetPredicate((w) => w is MmSurface && w.semanticsLabel == label);

/// The shared contract fixture (`GET /api/me/credits`, v1): the parity file with the server and
/// the website. This file never edits it.
Map<String, dynamic> _fixture() =>
    jsonDecode(File('test/fixtures/credits/contract_credits_v1.json').readAsStringSync()) as Map<String, dynamic>;

RemoteState<CreditsOverview> _loaded([Map<String, dynamic>? body]) =>
    RemoteState(value: CreditsOverview.fromJson(body ?? _fixture()), fetchedAt: DateTime(2026, 10, 15, 21));

/// The older AI wallet read, driven by the test: [land] is a network read finishing.
class _Wallet extends CreditsRepository {
  @override
  RemoteState<AiCredits> build() => const RemoteState();

  void land(DateTime at, {bool cache = false}) => state = RemoteState(value: const AiCredits(state: 'available'), fetchedAt: at, fromCache: cache);
}

/// The overview read with no database and no network, counting forced reads.
class _Overview extends MeCreditsRepository {
  int reads = 0;

  @override
  bool get autoLoad => false;

  @override
  Future<void> refresh({bool force = false}) async => reads++;
}

void main() {
  group('a charge elsewhere reaches the overview', () {
    late _Wallet wallet;
    late _Overview overview;
    late ProviderContainer c;

    setUp(() {
      wallet = _Wallet();
      overview = _Overview();
      c = ProviderContainer(overrides: [
        creditsRepositoryProvider.overrideWith(() => wallet),
        meCreditsProvider.overrideWith(() => overview),
      ]);
      addTearDown(c.dispose);
      c.read(meCreditsProvider);
    });

    test('a second network read of the wallet (Ask Mobi after a reply) reads the overview again', () async {
      wallet.land(DateTime(2026, 10, 16, 21, 0));
      await Future<void>.delayed(Duration.zero);
      expect(overview.reads, 0, reason: 'the first read of the wallet is not a charge');
      wallet.land(DateTime(2026, 10, 16, 21, 2));
      await Future<void>.delayed(Duration.zero);
      expect(overview.reads, 1);
    });

    test('a wallet served from the cache does not', () async {
      wallet.land(DateTime(2026, 10, 16, 21, 0));
      wallet.land(DateTime(2026, 10, 16, 21, 1), cache: true);
      await Future<void>.delayed(Duration.zero);
      expect(overview.reads, 0);
    });
  });

  group('the contract fixture (parity with the server and the website)', () {
    test('parses to the two pools, the plan and the history, newest first', () {
      final o = CreditsOverview.fromJson(_fixture());
      expect(o.practice.balance, 40);
      expect(o.practice.renewsOn, isNull);
      expect(o.ai.balance, 9);
      expect(o.ai.renewsOn, DateTime(2026, 11, 1));
      expect(o.plan.name, 'Free');
      expect(o.plan.isPro, isFalse);
      expect(o.plan.until, isNull);
      expect(o.history, hasLength(7));
      expect(o.nextCursor, isNull);
      final times = [for (final e in o.history) e.at];
      expect([...times]..sort((a, b) => b.compareTo(a)), times, reason: 'history is newest first');
      expect(o.history.first.pool, CreditPool.practice);
      expect(o.history.first.what, 'Practice set');
      expect(o.history.first.delta, -10);
      expect(o.history.first.balanceAfter, 40);
      // Both pools and both signs appear in the shared fixture.
      expect({for (final e in o.history) e.pool}, {CreditPool.practice, CreditPool.ai});
      expect(o.history.any((e) => e.delta > 0), isTrue);
      expect(o.history.any((e) => e.delta < 0), isTrue);
    });

    test('the fixture keeps to the contract: only the documented keys and the two pool ids', () {
      final j = _fixture();
      expect(j.keys.toSet(), {'practice', 'ai', 'plan', 'history', 'nextCursor'});
      expect((j['practice'] as Map).keys.toSet(), {'balance', 'renewsOn', 'label'});
      expect((j['ai'] as Map).keys.toSet(), {'balance', 'renewsOn', 'label'});
      expect((j['plan'] as Map).keys.toSet(), {'name', 'until'});
      expect((j['practice'] as Map)['label'], 'Practice credits');
      expect((j['ai'] as Map)['label'], 'AI credits');
      for (final row in j['history'] as List) {
        expect((row as Map).keys.toSet(), {'at', 'pool', 'what', 'delta', 'balanceAfter'});
        expect(['practice', 'ai'], contains(row['pool']));
        expect(DateTime.tryParse(row['at'] as String), isNotNull);
      }
      expect(RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch((j['ai'] as Map)['renewsOn'] as String), isTrue);
    });

    test('the newest line of each pool ends at the balance the contract states', () {
      // A history that disagreed with the balance above it would show a student two numbers that
      // contradict each other.
      final o = CreditsOverview.fromJson(_fixture());
      for (final pool in CreditPool.values) {
        final newest = o.history.firstWhere((e) => e.pool == pool);
        expect(newest.balanceAfter, o.of(pool).balance, reason: pool.name);
      }
    });

    test('a Pro plan with a date and a further page', () {
      final j = _fixture()
        ..['plan'] = {'name': 'Pro', 'until': '2027-01-12'}
        ..['nextCursor'] = 'abc';
      final o = CreditsOverview.fromJson(j);
      expect(o.plan.isPro, isTrue);
      expect(o.plan.until, DateTime(2027, 1, 12));
      expect(o.nextCursor, 'abc');
    });

    test('a balance the server did not send is null, never 0, and an unusable row is left out', () {
      final o = CreditsOverview.fromJson({
        'practice': {'renewsOn': null},
        'ai': {'balance': 0},
        'plan': {'name': 'Free', 'until': null},
        'history': [
          {'at': 'not a time', 'pool': 'ai', 'what': 'x', 'delta': -1},
          {'at': '2026-10-15T10:00:00Z', 'pool': 'wallet', 'what': 'x', 'delta': -1},
          {'at': '2026-10-15T10:00:00Z', 'pool': 'ai', 'what': 'Ask Mobi', 'delta': -1},
        ],
        'nextCursor': '',
      });
      expect(o.practice.balance, isNull);
      expect(o.ai.balance, 0);
      expect(o.history, hasLength(1));
      expect(o.history.single.balanceAfter, isNull);
      expect(o.nextCursor, isNull);
    });
  });

  group('words', () {
    test('every spend line names its pool, the count and what is left', () {
      final o = CreditsOverview.fromJson(_fixture());
      expect(CreditsCopy.line(o.history[0]), 'Used 10 Practice credits. 40 Practice credits left.');
      expect(CreditsCopy.line(o.history[1]), 'Used 1 AI credit. 9 AI credits left.');
      expect(CreditsCopy.line(o.history[2]), 'Added 10 Practice credits. 50 Practice credits left.');
      expect(CreditsCopy.line(o.history[3]), 'Added 1 AI credit. 11 AI credits left.');
      expect(CreditsCopy.left(o.history[0]), '40 left');
      expect(CreditsCopy.tag(o.history[1]), 'AI credits');
    });

    test('there are two credit names only, and no banned punctuation', () {
      final strings = <String>[
        CreditsCopy.title,
        CreditsCopy.sectionPlan,
        CreditsCopy.planProIncludes,
        CreditsCopy.practiceMeaning,
        CreditsCopy.practiceProMeaning,
        CreditsCopy.aiMeaning,
        CreditsCopy.historyEmptyBody,
        CreditsCopy.historyFailedBody,
        CreditsCopy.historyEmptyFor(CreditPool.ai),
        CreditsCopy.moreFailed,
        for (final e in CreditsOverview.fromJson(_fixture()).history) CreditsCopy.line(e),
      ];
      for (final s in strings) {
        expect(s.contains('!'), isFalse, reason: s);
        expect(s.contains('—'), isFalse, reason: s);
        expect(s.contains('·'), isFalse, reason: s);
        for (final banned in ['explanation credit', 'wallet', 'PrepOS', 'practice credit', ' ai credit']) {
          expect(s.contains(banned), isFalse, reason: '"$banned" in "$s"');
        }
      }
      expect(CreditPool.practice.name, 'Practice credits');
      expect(CreditPool.ai.name, 'AI credits');
    });
  });

  group('the Credits page', () {
    Future<void> pump(WidgetTester tester, {required RemoteState<CreditsOverview> mine, MockApi? api}) async {
      tester.view.physicalSize = const Size(720, 3200);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: youOverrides(api: api, credits: mine, now: DateTime(2026, 10, 14, 20)),
          child: DefaultAssetBundle(
            bundle: FileAssetBundle(),
            child: MaterialApp(theme: buildTheme(Brightness.light), home: const CreditsScreen()),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    Map<String, dynamic> withMore() => _fixture()..['nextCursor'] = 'c1';

    testWidgets('both pools, the plan, and each history line with its pool and what is left', (tester) async {
      await pump(tester, mine: _loaded());
      expect(find.text('Practice credits'), findsWidgets);
      expect(find.text('AI credits'), findsWidgets);
      expect(find.text('Free'), findsOneWidget);
      expect(find.text('Free plan'), findsNothing, reason: 'the pill says it once');
      expect(_card('Practice credits, 40. For mocks and practice sets'), findsOneWidget);
      expect(_card('AI credits, 9. For Ask Mobi and repair explanations'), findsOneWidget);
      expect(find.text('Renews 1 November'), findsOneWidget);
      expect(find.text('Practice set'), findsOneWidget);
      expect(find.text('Repair, Q2 Accountancy'), findsOneWidget);
      // The value column says what is left; the long sentence is for TalkBack only.
      expect(find.text('40 left'), findsWidgets);
      expect(find.text('9 left'), findsWidgets);
      expect(find.text('11 left'), findsWidgets);
      expect(find.text('Used 10 Practice credits. 40 Practice credits left.'), findsNothing);
      expect(find.bySemanticsLabel(RegExp('Used 10 Practice credits. 40 Practice credits left.')), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Yesterday'), findsOneWidget);
      expect(find.text('Show earlier'), findsNothing, reason: 'the fixture has no further page');
      // Never a price or a purchase.
      expect(find.textContaining('₹'), findsNothing);
      expect(find.textContaining('Buy'), findsNothing);
    });

    testWidgets('a filter shows one pool only', (tester) async {
      await pump(tester, mine: _loaded());
      await tester.tap(find.widgetWithText(MmChip, 'AI credits'));
      await tester.pumpAndSettle();
      expect(find.text('Repair, Q2 Accountancy'), findsOneWidget);
      expect(find.text('Practice set'), findsNothing);
      await tester.tap(find.widgetWithText(MmChip, 'All'));
      await tester.pumpAndSettle();
      expect(find.text('Practice set'), findsOneWidget);
    });

    testWidgets('Show earlier asks for the next page with the cursor and appends it', (tester) async {
      final api = MockApi();
      when(() => api.get(any(), query: any(named: 'query'))).thenAnswer((_) async => ApiResponse(200, {
            'practice': {'balance': 40, 'renewsOn': null, 'label': 'Practice credits'},
            'ai': {'balance': 9, 'renewsOn': '2026-11-01', 'label': 'AI credits'},
            'plan': {'name': 'Free', 'until': null},
            'history': [
              {'at': '2026-09-20T09:00:00.000Z', 'pool': 'practice', 'what': 'Chapter set, Accountancy', 'delta': -1, 'balanceAfter': 91},
            ],
            'nextCursor': null,
          }));
      await pump(tester, mine: _loaded(withMore()), api: api);
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show earlier'));
      await tester.pumpAndSettle();
      verify(() => api.get('/api/me/credits', query: {'cursor': 'c1'})).called(1);
      expect(find.text('Chapter set, Accountancy'), findsOneWidget);
      expect(find.text('20 September'), findsOneWidget);
      expect(find.text('Show earlier'), findsNothing, reason: 'the last page has no cursor');
    });

    testWidgets('a failed next page says so, keeps what is shown and offers Try again', (tester) async {
      final api = MockApi();
      when(() => api.get(any(), query: any(named: 'query'))).thenThrow(const ApiError(kind: ApiErrorKind.network, code: 'network'));
      await pump(tester, mine: _loaded(withMore()), api: api);
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -3000));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show earlier'));
      await tester.pumpAndSettle();
      expect(find.text(CreditsCopy.moreFailed), findsOneWidget);
      expect(find.text('Practice set'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('nothing loaded: balances read Not loaded (never 0) and History offers Try again', (tester) async {
      await pump(tester, mine: const RemoteState(error: ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'unavailable')));
      expect(find.text('Not loaded'), findsWidgets);
      expect(find.text('0'), findsNothing);
      expect(find.text(CreditsCopy.historyFailedTitle), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('the first read still running: the balances say Checking, never 0', (tester) async {
      tester.view.physicalSize = const Size(720, 3200);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: youOverrides(
            credits: const RemoteState<CreditsOverview>(loading: true),
            auth: const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1'),
          ),
          child: DefaultAssetBundle(
            bundle: FileAssetBundle(),
            child: MaterialApp(theme: buildTheme(Brightness.light), home: const CreditsScreen()),
          ),
        ),
      );
      await tester.pump();
      expect(find.text(CreditsCopy.checking), findsWidgets);
      expect(find.text('0'), findsNothing);
    });

    testWidgets('a first spend is still to come: the empty state says what will show', (tester) async {
      final j = _fixture()
        ..['history'] = <Object?>[]
        ..['nextCursor'] = null;
      await pump(tester, mine: _loaded(j));
      expect(find.text(CreditsCopy.historyEmptyTitle), findsOneWidget);
      expect(find.text('Show earlier'), findsNothing);
    });

    testWidgets('a Pro plan shows the date and unlimited practice', (tester) async {
      final j = _fixture()..['plan'] = {'name': 'Pro', 'until': '2027-01-12'};
      await pump(tester, mine: _loaded(j));
      expect(find.text('Pro until 12 January 2027'), findsOneWidget);
      expect(find.text('Unlimited'), findsOneWidget);
      expect(find.text('Practice is unlimited on Pro'), findsOneWidget);
    });
  });

  group('creditFiguresProvider', () {
    ProviderContainer container(RemoteState<CreditsOverview> mine) {
      final c = ProviderContainer(overrides: youOverrides(credits: mine));
      addTearDown(c.dispose);
      return c;
    }

    test('the new read wins over the profile', () {
      final f = container(_loaded()).read(creditFiguresProvider);
      expect(f.practice, 40);
      expect(f.ai, 9);
      expect(f.aiRenews, DateTime(2026, 11, 1));
      expect(f.isPro, isFalse);
    });

    test('with nothing read, nothing is invented', () {
      final f = container(const RemoteState(error: ApiError(kind: ApiErrorKind.network, code: 'network'))).read(creditFiguresProvider);
      expect(f.ai, isNull);
      expect(f.failed, isTrue);
    });
  });

  test('a body that is not an object reads as nothing known', () {
    expect(CreditsOverview.fromJson(asJson('nope')).practice.balance, isNull);
  });
}
