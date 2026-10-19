// Shared by the Pro nudge widget and golden tests: the overrides for a Free student with Play billing on
// (or off), Google Play's Pro price at Rs 150 (D82), memory prefs, and the student's facts as given.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/data/play_products.dart';
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/pro_nudge/data/pro_benefits.dart';
import 'package:mockmob/features/pro_nudge/data/pro_facts_provider.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart';
import 'package:mockmob/features/pro_nudge/widgets/upgrade_sheet.dart';

import '../../helpers/golden_harness.dart';
import '../billing/billing_test_support.dart';
import '../you/you_test_support.dart';

/// Google Play's Pro price in these tests (D82: Rs 150 on Google Play). A fixture: the app never writes it.
const String playProPrice = '₹149.00';

class NudgeRig {
  NudgeRig({this.on = true, this.pro = false, this.facts = ProFacts.empty, MemoryPrefsStore? prefs, FakePlayStore? store})
      : prefs = prefs ?? MemoryPrefsStore(),
        billing = BillingRig(on: on, store: store ?? FakePlayStore(prices: {...fixturePrices(), PlayProducts.proId: playProPrice}));

  final bool on;
  final bool pro;
  final ProFacts facts;
  final MemoryPrefsStore prefs;
  final BillingRig billing;

  List<Override> get overrides => [
        ...youOverrides(credits: creditsState(pro: pro, proUntil: pro ? '2027-07-31' : null)),
        ...billing.overrides,
        proNudgePrefsProvider.overrideWithValue(prefs),
        proFactsProvider.overrideWithValue(facts),
      ];
}

/// A screen with one key that opens the Upgrade sheet for [reason]; it records whether the sheet opened.
class OpenSheetHost extends StatelessWidget {
  const OpenSheetHost({super.key, required this.reason, this.onResult});

  final ProReason reason;
  final void Function(bool opened)? onResult;

  @override
  Widget build(BuildContext context) => Center(
        child: TextButton(
          onPressed: () {
            final opened = showUpgradeSheetIfOn(context, reason: reason);
            onResult?.call(opened);
          },
          child: const Text('open'),
        ),
      );
}

/// Runs the fakes (Google Play, the saved prefs) and lets the sheet's entrance finish, without
/// pumpAndSettle (a loading skeleton never settles).
Future<void> settleNudges(WidgetTester tester, {int rounds = 10}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump(const Duration(milliseconds: 80));
  }
}

Future<void> pumpNudges(
  WidgetTester tester,
  Widget child,
  NudgeRig rig, {
  Brightness brightness = Brightness.light,
  Size size = kGoldenSize,
  double textScale = 1,
}) async {
  await pumpMockmob(tester, child, brightness: brightness, size: size, textScale: textScale, overrides: rig.overrides, disableAnimations: true);
  await settleNudges(tester);
}

ProviderContainer containerOf(WidgetTester tester) => ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));
