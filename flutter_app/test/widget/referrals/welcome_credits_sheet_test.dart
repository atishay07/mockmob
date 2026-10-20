// The welcome-credits sheet (owner, 20 Oct 11:20 pm): the real balance as the hero; with invites live, "Invite a friend"
// shares the invite text with the link (the Wallet's own helper) and "Not now" closes; while the status loads, the
// invite key opens the Wallet; with invites off, one key, "Start practising".

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show showMmSheet;
import 'package:mockmob/features/credits/data/credit_figures.dart';
import 'package:mockmob/features/referrals/invite_reward.dart';
import 'package:mockmob/features/referrals/invite_share.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';
import 'package:mockmob/features/referrals/welcome_credits_sheet.dart';

import '../../helpers/golden_harness.dart';

const _link = 'https://www.mockmob.in/r/K7P2M9X';
const _live = ReferralStatus(live: true, code: 'K7P2M9X', link: _link);
const _openerKey = ValueKey('opener');

Future<void> _open(
  WidgetTester tester, {
  required Future<ReferralStatus> Function() status,
  List<String>? shared,
  bool shareFails = false,
  int? balance = 50,
  VoidCallback? onOpenWallet,
}) async {
  await pumpMockmob(
    tester,
    Builder(
      builder: (context) => Center(
        child: TextButton(
          key: _openerKey,
          onPressed: () => showMmSheet<void>(context: context, builder: (_) => WelcomeCreditsSheet(onOpenWallet: onOpenWallet)),
          child: const Text('open'),
        ),
      ),
    ),
    size: const Size(360, 780),
    disableAnimations: true,
    overrides: [
      referralStatusProvider.overrideWith((ref) => status()),
      creditFiguresProvider.overrideWithValue(CreditFigures(mode: CreditsMode.oneBalance, total: balance, practice: balance, ai: balance)),
      inviteSharerProvider.overrideWithValue((text) async {
        if (shareFails) throw StateError('no share sheet');
        shared?.add(text);
      }),
    ],
  );
  await tester.tap(find.byKey(_openerKey));
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

void main() {
  testWidgets('live: the balance, the line, the invite; Invite a friend shares the text with the link, then closes', (tester) async {
    final shared = <String>[];
    await _open(tester, status: () async => _live, shared: shared, balance: 50);
    expect(find.text(ReferralCopy.welcomeUnit), findsOneWidget);
    expect(find.bySemanticsLabel(ReferralCopy.welcomeSemantics(50)), findsOneWidget);
    expect(find.text(ReferralCopy.welcomeWhat.replaceFirst('. ', '.\n')), findsOneWidget);
    expect(find.text(ReferralCopy.welcomeInviteHow), findsOneWidget);
    expect(find.text(ReferralCopy.welcomeStart), findsNothing);

    await tester.tap(find.text(ReferralCopy.welcomeInvite));
    await _settle(tester);
    expect(shared, [ReferralCopy.shareText(100, _link)]);
    expect(shared.single, contains(_link));
    expect(find.text(ReferralCopy.welcomeInvite), findsNothing, reason: 'closed after sharing');
  });

  testWidgets('live: Not now closes without sharing', (tester) async {
    final shared = <String>[];
    await _open(tester, status: () async => _live, shared: shared);
    await tester.tap(find.text(ReferralCopy.welcomeLater));
    await _settle(tester);
    expect(shared, isEmpty);
    expect(find.text(ReferralCopy.welcomeUnit), findsNothing);
  });

  testWidgets('a share sheet that does not open keeps the sheet up and says to copy the link', (tester) async {
    await _open(tester, status: () async => _live, shareFails: true);
    await tester.tap(find.text(ReferralCopy.welcomeInvite));
    await _settle(tester);
    expect(find.text(ReferralCopy.welcomeInvite), findsOneWidget);
    expect(find.text(ReferralCopy.shareFailed), findsOneWidget);
  });

  testWidgets('the real balance is the hero (not always 50)', (tester) async {
    await _open(tester, status: () async => _live, balance: 62);
    expect(find.bySemanticsLabel(ReferralCopy.welcomeSemantics(62)), findsOneWidget);
    expect(find.text(ReferralCopy.welcomeUnitHeld), findsOneWidget, reason: 'more than the welcome figure is not called welcome credits');
  });

  testWidgets('no balance read yet: the welcome figure 50', (tester) async {
    await _open(tester, status: () async => _live, balance: null);
    expect(find.bySemanticsLabel(ReferralCopy.welcomeSemantics(ReferralCopy.welcomeCredits)), findsOneWidget);
  });

  testWidgets('off: no invite at all, one key, Start practising, which closes', (tester) async {
    final shared = <String>[];
    await _open(tester, status: () async => ReferralStatus.off, shared: shared);
    expect(find.text(ReferralCopy.welcomeInvite), findsNothing);
    expect(find.text(ReferralCopy.welcomeLater), findsNothing);
    expect(find.textContaining('100'), findsNothing);
    await tester.tap(find.text(ReferralCopy.welcomeStart));
    await _settle(tester);
    expect(find.text(ReferralCopy.welcomeUnit), findsNothing);
    expect(shared, isEmpty);
  });

  testWidgets('loading: no promise in words yet; Invite a friend opens the Wallet instead of sharing', (tester) async {
    final shared = <String>[];
    var wallet = 0;
    await _open(tester, status: () => Completer<ReferralStatus>().future, shared: shared, onOpenWallet: () => wallet++);
    expect(find.text(ReferralCopy.welcomeInviteHow), findsNothing);
    await tester.tap(find.text(ReferralCopy.welcomeInvite));
    await _settle(tester);
    expect(wallet, 1);
    expect(shared, isEmpty);
    expect(find.text(ReferralCopy.welcomeUnit), findsNothing);
  });

  testWidgets('the Wallet invite shares through the same helper', (tester) async {
    final shared = <String>[];
    await pumpMockmob(
      tester,
      const SingleChildScrollView(child: WalletInviteSection()),
      overrides: [
        referralStatusProvider.overrideWith((ref) async => _live),
        inviteSharerProvider.overrideWithValue((text) async => shared.add(text)),
      ],
    );
    await tester.pump();
    await tester.tap(find.text(ReferralCopy.share));
    await tester.pump();
    expect(shared, [ReferralCopy.shareText(100, _link)]);
  });
}
