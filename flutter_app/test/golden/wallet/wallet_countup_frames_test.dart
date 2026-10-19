// The confirmed top-up's count-up, frame by frame (D150): the server's new figure arrives and the hero
// counts from 46 to 346 in volt, then settles. 360 dp Night, fixed steps.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/count_up.dart';
import 'package:mockmob/features/wallet/data/wallet_data.dart';
import 'package:mockmob/features/wallet/wallet_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/billing/billing_test_support.dart';
import '../../unit/wallet/wallet_test_support.dart';
import '../you/you_golden_kit.dart' show loadMaterialIcons;
import 'wallet_golden_test.dart' show goldenPrices;

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });
  tearDown(() {
    disposeContainers();
    MmNumberMemory.clear();
  });

  testWidgets('wallet count-up frames, 360, night', (tester) async {
    final rig = BillingRig(store: FakePlayStore(prices: goldenPrices));
    await pumpMockmob(
      tester,
      const WalletScreen(),
      brightness: Brightness.dark,
      size: const Size(360, 520),
      wrapInScaffold: false,
      overrides: walletOverrides(rig: rig),
    );
    for (var i = 0; i < 6; i++) {
      await tester.runAsync(() => Future<void>.delayed(Duration.zero));
      await tester.pump(const Duration(milliseconds: 60));
    }
    await tester.pump(const Duration(seconds: 2));
    final repo = ProviderScope.containerOf(tester.element(find.byType(WalletScreen))).read(walletRepositoryProvider.notifier) as FakeWalletRepo;
    repo.serve(walletState(walletBody(held: 306)));
    await tester.pump();
    for (final ms in [0, 120, 240, 360, 520, 720, 1400]) {
      if (ms > 0) await tester.pump(Duration(milliseconds: ms == 1400 ? 680 : (ms <= 360 ? 120 : (ms == 520 ? 160 : 200))));
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/frames/wallet_countup_${ms.toString().padLeft(4, '0')}.png'));
    }
  });
}
