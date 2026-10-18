// The page behind Credits: the one Wallet when `GET /api/wallet` answers, today's Credits page when it
// cannot (the server has not shipped the wallet yet, or the read failed with nothing kept on the phone).
// No error and no blank: the student sees the credits display they already know.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../credits/credits_screen.dart';
import 'data/wallet_data.dart';
import 'wallet_screen.dart';

class WalletOrCreditsScreen extends ConsumerWidget {
  const WalletOrCreditsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Failed with nothing cached (a 404 included): fall back. A kept copy still shows the Wallet, stale.
    final unavailable = ref.watch(walletRepositoryProvider.select((s) => s.isFailedEmpty));
    return unavailable ? const CreditsScreen() : const WalletScreen();
  }
}
