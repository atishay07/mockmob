// H13 of the final walk (18 Oct): on a server that keeps one credits balance the app still drew two pools, so
// the practice figure stayed at 390 while "AI credits" fell 45 to 25 after spending 5 and 20, and the Account
// sheet kept AI 45. The mode is now read from the server: one figure called "credits" everywhere on a
// one-balance server, today's two pools (with true labels) on an older one. The bodies here follow the website's
// own shapes: `GET /api/me/credits` with its `total` block (creditsBody and oneBalanceBlock in the credits core)
// and `GET /api/wallet` (WALLET-RAZORPAY.md section 5, wallet_test_support.dart).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/credits/credits_copy.dart';
import 'package:mockmob/features/credits/credits_screen.dart';
import 'package:mockmob/features/credits/data/credit_figures.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show meCreditsProvider;
import 'package:mockmob/features/credits/data/credits_models.dart';
import 'package:mockmob/features/credits/widgets/credit_tile.dart';
import 'package:mockmob/features/credits/widgets/pool_card.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';

import '../../helpers/golden_harness.dart';
import '../wallet/wallet_test_support.dart' show walletBody;
import '../you/you_test_support.dart';

/// History lines as a one-balance server writes them: each states the one balance after it, and a line from
/// before this month carries null.
const _oneHistory = [
  {'at': '2026-10-12T15:00:00.000Z', 'pool': 'ai', 'what': 'Ask Mobi', 'delta': -1, 'balanceAfter': 108},
  {'at': '2026-10-12T10:00:00.000Z', 'pool': 'practice', 'what': 'Practice set', 'delta': -20, 'balanceAfter': 109},
  {'at': '2026-09-28T10:00:00.000Z', 'pool': 'practice', 'what': 'Full mock', 'delta': -50, 'balanceAfter': null},
];

RemoteState<WalletRead> _wallet(Map<String, Object?> body, DateTime at) => RemoteState(value: WalletRead.fromJson(body), fetchedAt: at);

/// A credits read the test can move, as a read after a spend does.
class _MovingCredits extends FakeMeCredits {
  _MovingCredits(super.initial);

  void land(RemoteState<CreditsOverview> next) => state = next;
}

void main() {
  group('the mode comes from the server', () {
    CreditsMode modeOf({RemoteState<CreditsOverview>? credits, RemoteState<WalletRead>? wallet}) {
      final c = ProviderContainer(overrides: youOverrides(credits: credits, wallet: wallet));
      addTearDown(c.dispose);
      return c.read(creditsModeProvider);
    }

    test('a credits read with the total block is one balance', () {
      expect(modeOf(credits: oneBalanceState()), CreditsMode.oneBalance);
    });

    test('a credits read without it is the two pools (release 9 today)', () {
      expect(modeOf(credits: creditsState()), CreditsMode.twoPools);
    });

    test('when the credits read cannot answer, GET /api/wallet decides: 200 is one balance, 404 the two pools', () {
      const failed = RemoteState<CreditsOverview>(error: ApiError(status: 503, kind: ApiErrorKind.unavailable, code: 'unavailable'));
      expect(modeOf(credits: failed, wallet: _wallet(walletBody(), DateTime(2026, 10, 12, 21))), CreditsMode.oneBalance);
      expect(modeOf(credits: failed, wallet: walletMissing), CreditsMode.twoPools);
    });

    test('a total the server could not read is not a one-balance figure', () {
      expect(modeOf(credits: oneBalanceState(total: null)), CreditsMode.twoPools);
    });

    test('before anything answers, the mode is unknown and no figure is drawn', () {
      final c = ProviderContainer(overrides: youOverrides(credits: const RemoteState<CreditsOverview>(loading: true), auth: userWith()));
      addTearDown(c.dispose);
      expect(c.read(creditsModeProvider), CreditsMode.unknown);
      final f = c.read(creditFiguresProvider);
      expect(f.practice, isNull, reason: 'the profile balance cannot be labelled before the mode is known');
      expect(f.loading, isTrue);
    });
  });

  group('one balance: one figure for every reader', () {
    test('the total, its parts, and the same figure for practice and AI checks', () {
      final c = ProviderContainer(overrides: youOverrides(credits: oneBalanceState()));
      addTearDown(c.dispose);
      final f = c.read(creditFiguresProvider);
      expect(f.oneBalance, isTrue);
      expect(f.total, 108);
      expect(f.freeLeft, 38);
      expect(f.freeAllowance, 50);
      expect(f.held, 70);
      expect(f.freeRenews, DateTime(2026, 11, 1));
      expect(f.practice, 108, reason: 'a set is paid from the one balance');
      expect(f.ai, 108, reason: 'so is an Ask Mobi reply');
    });

    test('the newer of the credits read and the wallet read wins', () {
      final newer = _wallet(walletBody(freeLeft: 30, held: 70), DateTime(2026, 10, 12, 22));
      final c = ProviderContainer(overrides: youOverrides(credits: oneBalanceState(), wallet: newer));
      addTearDown(c.dispose);
      c.read(walletRepositoryProvider); // the Wallet page has read it
      expect(c.read(creditFiguresProvider).total, 100);
      final older = _wallet(walletBody(freeLeft: 30, held: 70), DateTime(2026, 10, 12, 20));
      final c2 = ProviderContainer(overrides: youOverrides(credits: oneBalanceState(), wallet: older));
      addTearDown(c2.dispose);
      c2.read(walletRepositoryProvider);
      expect(c2.read(creditFiguresProvider).total, 108);
    });

    test('Ask reads the same mode from its own credits read', () {
      AiCredits read(Map<String, Object?> extra) => AiCredits.fromJson({
            'state': 'available',
            'wallet': {'known': true, 'total': 108, 'includedRemaining': 38, 'includedMonthlyCredits': 50, 'bonusCredits': 0},
            ...extra,
          });
      expect(read({}).oneBalance, isFalse, reason: 'release 9 sends no credits block');
      expect(read({'credits': {'known': true, 'total': 108, 'freeLeft': 38, 'held': 70}}).oneBalance, isTrue);
      expect(read({'credits': {'known': false, 'total': null}}).oneBalance, isFalse);
    });
  });

  group('the screens', () {
    Future<void> pumpPage(WidgetTester tester, Widget page, {RemoteState<CreditsOverview>? credits, double width = 720, double scale = 1}) async {
      tester.view.physicalSize = Size(width, 3200);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: youOverrides(credits: credits, now: DateTime(2026, 10, 12, 22)),
          child: DefaultAssetBundle(
            bundle: FileAssetBundle(),
            child: MaterialApp(
              theme: buildTheme(Brightness.light),
              builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)), child: child!),
              home: page,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('Credits, one balance: one card, no pool names, no filters, the server\'s figure after each line', (tester) async {
      await pumpPage(tester, const CreditsScreen(), credits: oneBalanceState(history: _oneHistory));
      expect(find.byType(OneBalanceCard), findsOneWidget);
      expect(find.byType(PoolCard), findsNothing);
      expect(find.descendant(of: find.byType(OneBalanceCard), matching: find.text(CreditsCopy.oneName)), findsOneWidget);
      expect(find.text(CreditsCopy.freeLeft(38, 50)), findsOneWidget);
      expect(find.text(CreditsCopy.held(70)), findsOneWidget);
      expect(find.textContaining('Practice credits'), findsNothing);
      expect(find.textContaining('AI credits'), findsNothing);
      expect(find.byKey(const ValueKey('credits-filters')), findsNothing, reason: 'one balance has no pools to narrow by');
      expect(find.text('108 left'), findsOneWidget);
      expect(find.text('109 left'), findsOneWidget);
      expect(find.text('Full mock'), findsOneWidget);
      expect(find.textContaining('left'), findsNWidgets(3), reason: 'two lines with a figure, and the free credits line; the older line has none');
    });

    testWidgets('Credits, two pools at 360 dp and large text: the filters stay one row', (tester) async {
      await pumpPage(tester, const CreditsScreen(), credits: creditsState(history: _oneHistory), width: 720, scale: 1.3);
      final filters = find.byKey(const ValueKey('credits-filters'));
      expect(filters, findsOneWidget);
      final chips = find.descendant(of: filters, matching: find.text(CreditsCopy.filterAll));
      final ai = find.descendant(of: filters, matching: find.text(CreditsCopy.filterAi));
      expect(tester.getTopLeft(chips).dy, tester.getTopLeft(ai).dy, reason: 'one row, never wrapped');
      expect(find.textContaining(' left'), findsNothing, reason: 'no running figure on a two-pool server');
      expect(tester.takeException(), isNull);
    });

    Widget tiles() => Scaffold(
          body: Consumer(
            builder: (context, ref, _) => Padding(
              padding: const EdgeInsets.all(16),
              child: CreditTiles(figures: ref.watch(creditFiguresProvider), keyPrefix: 'account', flat: true, onOpen: () {}),
            ),
          ),
        );

    testWidgets('the tiles: one Credits tile on a one-balance server', (tester) async {
      await pumpPage(tester, tiles(), credits: oneBalanceState());
      expect(find.byKey(const ValueKey('account-credits')), findsOneWidget);
      expect(find.byKey(const ValueKey('account-practice')), findsNothing);
      expect(find.text('108'), findsOneWidget);
      expect(find.text(CreditsCopy.freeLeft(38, 50)), findsOneWidget);
      expect(find.textContaining('AI credits'), findsNothing);
      expect(find.textContaining('Practice credits'), findsNothing);
    });

    testWidgets('the tiles: two pools, each named, on an older server', (tester) async {
      await pumpPage(tester, tiles(), credits: creditsState());
      expect(find.byKey(const ValueKey('account-practice')), findsOneWidget);
      expect(find.byKey(const ValueKey('account-ai')), findsOneWidget);
      expect(find.byKey(const ValueKey('account-credits')), findsNothing);
    });

    testWidgets('after a spend the tile shows the read that follows it (the Account sheet kept AI 45)', (tester) async {
      tester.view.physicalSize = const Size(720, 1600);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final credits = _MovingCredits(oneBalanceState());
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            ...youOverrides().where((o) => !identical(o.origin, meCreditsProvider)),
            meCreditsProvider.overrideWith(() => credits),
          ],
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            home: Scaffold(
              body: Consumer(builder: (context, ref, _) => CreditTiles(figures: ref.watch(creditFiguresProvider), keyPrefix: 'account', onOpen: () {})),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('108'), findsOneWidget);
      // A set of 5 and a set of 20 come out of this month's free credits first: the one figure falls.
      credits.land(oneBalanceState(total: 83, freeLeft: 13));
      await tester.pumpAndSettle();
      expect(find.text('83'), findsOneWidget);
      expect(find.text('108'), findsNothing);
    });
  });
}
