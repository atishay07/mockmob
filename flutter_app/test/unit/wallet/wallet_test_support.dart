// Shared by the Wallet unit, widget and golden tests: a fake of `GET /api/wallet` (the one credits
// balance, owner D78) on top of the You test kit, with Google Play's fakes.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';

import '../billing/billing_test_support.dart';
import '../you/you_test_support.dart';

/// The body of `GET /api/wallet` exactly as the website sends it (docs/brain/WALLET-RAZORPAY.md, section 5), for a student with 40 of
/// 50 free credits left and 6 held. "packs", "proOffer" and "commerce" carry the website's prices and checkout state, which the
/// app never reads. [history]: false is a real empty history; [historyReadable]: false is the server's "unavailable" (null lines).
Map<String, Object?> walletBody({
  int freeLeft = 40,
  int freeAllowance = 50,
  int held = 6,
  int? total,
  bool history = true,
  bool historyReadable = true,
  bool pro = false,
}) =>
    {
      'ok': true,
      'credits': {
        'total': total ?? freeLeft + held,
        'freeLeft': freeLeft,
        'freeAllowance': freeAllowance,
        'held': held,
        'resetAt': '2026-10-31T18:30:00.000Z',
        'renewsOn': '2026-11-01',
        'parts': {'included': freeLeft, 'bonus': held, 'balance': 0},
        'label': 'Credits',
        'buys': '1 credit = 1 question or 1 Ask Mobi reply. A full mock is 50.',
      },
      'plan': {'name': pro ? 'Pro' : 'Free', 'until': pro ? '2027-07-31' : null},
      'proOffer': pro ? null : {'rupees': 99, 'expires': '2027-07-31', 'planId': 'pro_cuet_2027'},
      'packs': [
        {'packId': 'credits_10_50', 'label': '50 credits', 'credits': 50, 'priceInr': 10, 'pricePaise': 1000, 'perCreditInr': 0.2, 'featured': false},
        {'packId': 'credits_29_150', 'label': '150 credits', 'credits': 150, 'priceInr': 29, 'pricePaise': 2900, 'perCreditInr': 0.19, 'featured': false},
        {'packId': 'credits_49_300', 'label': '300 credits', 'credits': 300, 'priceInr': 49, 'pricePaise': 4900, 'perCreditInr': 0.16, 'featured': true},
      ],
      'commerce': {'open': false, 'message': 'Top-ups open soon.'},
      'history': !historyReadable
          ? null
          : history
              ? [
                  {'at': '2026-10-14T13:12:00.000Z', 'pool': 'practice', 'what': 'Practice set, Accountancy', 'delta': -10, 'balanceAfter': 46},
                  {'at': '2026-10-14T09:40:00.000Z', 'pool': 'ai', 'what': 'Ask Mobi reply', 'delta': -1, 'balanceAfter': 56},
                  {'at': '2026-10-13T15:05:00.000Z', 'pool': 'practice', 'what': 'Full mock 7', 'delta': -50, 'balanceAfter': 57},
                  {'at': '2026-10-01T00:00:00.000Z', 'pool': 'ai', 'what': 'Free credits for the month', 'delta': 50, 'balanceAfter': 107},
                ]
              : <Object?>[],
      'historyState': historyReadable ? 'ready' : 'unavailable',
    };

class FakeWalletRepo extends WalletRepository {
  FakeWalletRepo(this.initial);

  final RemoteState<WalletRead> initial;
  int refreshes = 0;

  @override
  RemoteState<WalletRead> build() => initial;

  @override
  Future<void> refresh({bool force = false}) async => refreshes++;
}

RemoteState<WalletRead> walletState([Map<String, Object?>? body]) =>
    RemoteState(value: WalletRead.fromJson(body ?? walletBody()), fetchedAt: DateTime(2026, 10, 14, 19));

/// The Wallet's overrides: signed in as the You kit's student (Pro or Free), the wallet read, and
/// (optionally) the billing rig's Google Play fakes.
List<Override> walletOverrides({RemoteState<WalletRead>? read, bool pro = false, BillingRig? rig}) => [
      ...youOverrides(
        auth: AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha Verma', isPro: pro, premiumUntil: pro ? DateTime(2027, 7, 31) : null),
      ),
      walletRepositoryProvider.overrideWith(() => FakeWalletRepo(read ?? walletState(walletBody(pro: pro)))),
      ...?rig?.overrides,
    ];
