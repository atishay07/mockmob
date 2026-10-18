// Route builder and opener for the Wallet (the old Credits page). router.dart binds `youCreditsScreen` (you_routes)
// to `/you/credits`; [openCreditsPage] pushes through the router when the path is registered and
// otherwise as a plain page (widget tests).

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../wallet/wallet_screen.dart';

abstract final class CreditsPaths {
  static const String credits = AppRoutes.youCredits;
}

Widget creditsScreen(BuildContext context, GoRouterState state) => const WalletScreen();

/// Opens Credits over the app.
Future<void> openCreditsPage(BuildContext context) async {
  final router = GoRouter.maybeOf(context);
  if (router != null && router.configuration.findMatch(Uri.parse(CreditsPaths.credits)).isNotEmpty) {
    await router.push<void>(CreditsPaths.credits);
    return;
  }
  await Navigator.of(context, rootNavigator: true).push<void>(MaterialPageRoute(builder: (_) => const WalletScreen()));
}
