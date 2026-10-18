// Shared by the Wallet unit, widget and golden tests: a fake of `GET /api/wallet` (the one credits
// balance, owner D78) on top of the You test kit, with Google Play's fakes.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';

import '../billing/billing_test_support.dart';
import '../you/you_test_support.dart';

/// The body of `GET /api/wallet` for a student with 40 of 50 free credits left and 6 held. The
/// "packs" list carries the website's prices, which the app never reads.
Map<String, Object?> walletBody({int freeLeft = 40, int freeAllowance = 50, int held = 6, int? total, bool history = true}) => {
      'total': total ?? freeLeft + held,
      'freeLeft': freeLeft,
      'freeAllowance': freeAllowance,
      'resetAt': '2026-10-31T18:30:00.000Z',
      'held': held,
      'packs': [
        {'packId': 'credits_10_50', 'credits': 50, 'priceInr': 10},
        {'packId': 'credits_29_150', 'credits': 150, 'priceInr': 29},
        {'packId': 'credits_49_300', 'credits': 300, 'priceInr': 49, 'featured': true},
      ],
      'history': history
          ? [
              {'at': '2026-10-14T13:12:00.000Z', 'what': 'Practice set, Accountancy', 'delta': -10, 'balanceAfter': 46},
              {'at': '2026-10-14T09:40:00.000Z', 'what': 'Ask Mobi reply', 'delta': -1, 'balanceAfter': 56},
              {'at': '2026-10-13T15:05:00.000Z', 'what': 'Full mock 7', 'delta': -50, 'balanceAfter': 57},
              {'at': '2026-10-01T00:00:00.000Z', 'what': 'Monthly free credits', 'delta': 50, 'balanceAfter': 107},
            ]
          : <Object?>[],
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
      walletRepositoryProvider.overrideWith(() => FakeWalletRepo(read ?? walletState())),
      ...?rig?.overrides,
    ];
