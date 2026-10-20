// The Wallet's invite card and "Have a friend's code?" row for a fresh account, and what each state of the read shows:
// loading draws nothing, a read that failed for good is one quiet row that reads again, and the card is visual first (the
// figure as the anchor, the "no friends yet" line as a quiet caption).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/screens/after_sign_in_sheet.dart';
import 'package:mockmob/features/onboarding/state/sheet_sync.dart';
import 'package:mockmob/features/referrals/invite_code_row.dart';
import 'package:mockmob/features/referrals/invite_load_failed.dart';
import 'package:mockmob/features/referrals/invite_reward.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';

import '../../helpers/golden_harness.dart';
import '../../helpers/referral_fixtures.dart';

class _Claims implements ReferralClaimService {
  _Claims(this.outcome);

  ReferralClaimOutcome outcome;

  @override
  Future<ReferralClaimOutcome> claimPending({bool fresh = false}) async => outcome;
}

const _wallet = SingleChildScrollView(child: WalletInviteSection());

void main() {
  late MemoryPrefsStore prefs;

  setUp(() => prefs = MemoryPrefsStore());

  List<Override> fresh({ReferralClaimOutcome? outcome}) => [
        referralStatusProvider.overrideWith((ref) async => freshAccountInvites),
        referralPrefsProvider.overrideWithValue(prefs),
        referralClaimServiceProvider.overrideWithValue(_Claims(outcome ?? const ReferralClaimOutcome(ok: true, done: true, state: 'joined'))),
      ];

  testWidgets("a fresh account with live invites: the Wallet card shows the figure, the keys and the friend's code row", (tester) async {
    await pumpMockmob(tester, _wallet, overrides: fresh());
    await tester.pump();
    expect(find.byKey(const ValueKey('invite-figure')), findsOneWidget);
    expect(find.text('100'), findsOneWidget);
    expect(find.text(WalletInviteCopy.figureLabel), findsOneWidget);
    expect(find.text(ReferralCopy.how(100)), findsOneWidget);
    expect(find.text(ReferralCopy.share), findsOneWidget);
    expect(find.text(ReferralCopy.copy), findsOneWidget);
    expect(find.text(ReferralCopy.haveCode), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('no friends yet is one quiet caption, never bold', (tester) async {
    await pumpMockmob(tester, _wallet, overrides: fresh());
    await tester.pump();
    final none = tester.widget<Text>(find.text(ReferralCopy.summary(joined: 0, practised: 0, rewarded: 0, reward: 100)));
    final style = none.style!;
    expect(style.fontWeight == null || style.fontWeight!.value < FontWeight.w600.value, isTrue, reason: 'a quiet caption');
    expect(style.fontSize, lessThan(14));
  });

  testWidgets('with friends the counts stay, in the strong weight', (tester) async {
    await pumpMockmob(
      tester,
      _wallet,
      overrides: [
        referralStatusProvider.overrideWith((ref) async => ReferralStatus.fromJson({...freshAccountInvitesJson, 'joined': 2, 'practised': 1, 'rewarded': 1, 'earned': 100})),
        referralPrefsProvider.overrideWithValue(prefs),
      ],
    );
    await tester.pump();
    final counts = tester.widget<Text>(find.text('2 friends joined, 1 practised: +100 each.'));
    expect(counts.style!.fontWeight, FontWeight.w700);
  });

  testWidgets('while the read runs the card draws nothing', (tester) async {
    final hold = Completer<ReferralStatus>();
    await pumpMockmob(tester, _wallet, overrides: [referralStatusProvider.overrideWith((ref) => hold.future)]);
    await tester.pump();
    expect(find.text(InviteLoadCopy.failed), findsNothing);
    expect(find.text(ReferralCopy.share), findsNothing);
    expect(find.byKey(const ValueKey('invite-figure')), findsNothing);
    hold.complete(freshAccountInvites);
    await tester.pump();
    await tester.pump();
    expect(find.text(ReferralCopy.share), findsOneWidget);
  });

  testWidgets('a read that failed for good is one quiet row; a tap reads again and the card appears', (tester) async {
    var reads = 0;
    await pumpMockmob(
      tester,
      _wallet,
      overrides: [
        referralPrefsProvider.overrideWithValue(prefs),
        referralStatusProvider.overrideWith((ref) async {
          reads++;
          if (reads == 1) throw StateError('offline');
          return freshAccountInvites;
        }),
      ],
    );
    await tester.pump();
    await tester.pump();
    expect(find.text(InviteLoadCopy.failed), findsOneWidget);
    expect(find.text(ReferralCopy.share), findsNothing, reason: 'never a section with partial data');
    expect(tester.getSize(find.byType(InviteLoadFailedRow)).height, greaterThanOrEqualTo(44));
    await tester.tap(find.text(InviteLoadCopy.failed));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(reads, 2);
    expect(find.text(InviteLoadCopy.failed), findsNothing);
    expect(find.text(ReferralCopy.share), findsOneWidget);
    expect(find.text(ReferralCopy.haveCode), findsOneWidget);
  });

  testWidgets("the friend's code row says what failed too (the after-sign-in sheet)", (tester) async {
    await pumpMockmob(
      tester,
      const SingleChildScrollView(child: InviteCodeRow()),
      overrides: [referralStatusProvider.overrideWith((ref) async => throw StateError('offline'))],
    );
    await tester.pump();
    await tester.pump();
    expect(find.text(InviteLoadCopy.failed), findsOneWidget);
    expect(find.text(ReferralCopy.haveCode), findsNothing);
  });

  testWidgets("a fresh account sees \"Have a friend's code?\" in the after-sign-in sheet", (tester) async {
    await pumpMockmob(
      tester,
      SingleChildScrollView(
        child: SheetSavedView(
          phase: SheetSyncPhase.saved,
          startLabel: 'Start now, about 10 minutes',
          laterLabel: 'Tomorrow at 8:00 PM',
          onStart: () {},
          onLater: () {},
          onRetry: () {},
          onToggleUsage: (_) {},
          onToggleEvents: () {},
          onDone: () {},
          inviteRow: const InviteCodeRow(),
        ),
      ),
      overrides: fresh(),
    );
    await tester.pump();
    expect(find.text(ReferralCopy.haveCode), findsOneWidget);
  });

  testWidgets('an account that has practised: the server refuses with existing_account and the row says so under the field', (tester) async {
    await pumpMockmob(
      tester,
      const SingleChildScrollView(padding: EdgeInsets.all(20), child: WalletInviteSection()),
      overrides: fresh(outcome: const ReferralClaimOutcome(ok: false, done: true, reason: 'existing_account')),
    );
    await tester.pump();
    await tester.ensureVisible(find.text(ReferralCopy.haveCode));
    await tester.pump();
    await tester.tap(find.text(ReferralCopy.haveCode));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(find.byType(TextField), 'K7P2M9X');
    await tester.ensureVisible(find.text(ReferralCopy.codeAdd));
    await tester.pump();
    await tester.tap(find.text(ReferralCopy.codeAdd));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text(ReferralCopy.codeNotNew), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget, reason: 'the field stays so the student can see what was typed');
    expect(find.text(ReferralCopy.codeAdd), findsOneWidget);
  });

  testWidgets('at 1.3x text on a narrow phone the card does not overflow', (tester) async {
    await pumpMockmob(tester, _wallet, size: const Size(320, 700), textScale: 1.3, overrides: fresh());
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('at 1.3x text on a narrow phone the failed row does not overflow', (tester) async {
    await pumpMockmob(
      tester,
      _wallet,
      size: const Size(320, 700),
      textScale: 1.3,
      overrides: [referralStatusProvider.overrideWith((ref) async => throw StateError('offline'))],
    );
    await tester.pump();
    await tester.pump();
    expect(find.text(InviteLoadCopy.failed), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
