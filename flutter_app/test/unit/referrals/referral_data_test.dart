// Friend invites in the app (owner D165): the code a link brings in is kept through sign-in and onboarding, a Mob invite
// counts, /pricing's creator codes never do, the first friend's link is kept, the server's status is read only when live,
// and the words match the website's.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/referral_data.dart';

void main() {
  final now = DateTime(2026, 10, 20, 10);
  Uri u(String s) => Uri.parse(s);

  test('codes are read the Crockford way, as the server reads them', () {
    expect(normaliseInviteCode('k7p 2m9x'), 'K7P2M9X');
    expect(normaliseInviteCode('K7P-2M9'), 'K7P2M9');
    expect(normaliseInviteCode('o1lIabcd'), '0111ABCD');
    expect(normaliseInviteCode('U2345'), isNull);
    expect(normaliseInviteCode('K7P2M9!'), isNull);
    expect(normaliseInviteCode(null), isNull);
    expect(isFriendCode('K7P2M9X'), isTrue);
    expect(isFriendCode('K7P2M9'), isFalse);
  });

  test('which links carry an invite: /r/<code>, a Mob invite /join/<code>, ?ref= on any page but /pricing', () {
    final r = PendingInvite.fromUri(u('https://www.mockmob.in/r/k7p2m9x'), now)!;
    expect([r.code, r.source, r.explicit], ['K7P2M9X', 'link', false]);
    final j = PendingInvite.fromUri(u('https://mockmob.in/join/K7P2M9'), now)!;
    expect([j.code, j.source, j.explicit], ['K7P2M9', 'mob_invite', true]);
    expect(PendingInvite.fromUri(u('https://www.mockmob.in/today?ref=K7P2M9X'), now)?.code, 'K7P2M9X');
    expect(PendingInvite.fromUri(u('https://www.mockmob.in/pricing?ref=K7P2M9X'), now), isNull, reason: 'creator codes');
    expect(PendingInvite.fromUri(u('https://www.mockmob.in/r/K7P2M9'), now), isNull, reason: 'a Mob code is not a friend link');
    expect(PendingInvite.fromUri(u('https://www.mockmob.in/join/K7P2M9X'), now), isNull);
    expect(PendingInvite.fromUri(u('https://evil.example/r/K7P2M9X'), now), isNull);
    expect(PendingInvite.fromUri(u('http://www.mockmob.in/r/K7P2M9X'), now), isNull);
    expect(PendingInvite.fromUri(u('https://www.mockmob.in/today'), now), isNull);
  });

  test('the phone keeps one invite: the first friend’s link stays, a Mob invite replaces a link, 30 days at most', () async {
    var clock = now;
    final prefs = MemoryPrefsStore();
    final store = PendingInviteStore(prefs, now: () => clock);
    expect(await store.read(), isNull);
    expect(await store.captureUri(u('https://www.mockmob.in/r/K7P2M9X')), isTrue);
    expect(await store.captureUri(u('https://www.mockmob.in/r/Q2W3E4R')), isFalse, reason: 'the first friend keeps it');
    expect((await store.read())!.code, 'K7P2M9X');
    expect(await store.captureUri(u('https://www.mockmob.in/join/ABCDEF')), isTrue, reason: 'joining a Mob is explicit');
    expect(await store.captureUri(u('https://www.mockmob.in/join/ABCDEF')), isFalse);
    final kept = (await store.read())!;
    expect([kept.code, kept.source], ['ABCDEF', 'mob_invite']);
    expect(PendingInvite.fromJson(jsonDecode(jsonEncode(kept.toJson())))!.code, 'ABCDEF');
    clock = now.add(const Duration(days: 31));
    expect(await store.read(), isNull, reason: 'expired, and forgotten');
    expect(prefs.values.containsKey('referral_pending_invite'), isFalse);
    await store.captureUri(u('https://www.mockmob.in/r/K7P2M9X'));
    await store.clear();
    expect(await store.read(), isNull);
    final id = await store.installId();
    expect(id, matches(RegExp(r'^[0-9a-f]{32}$')));
    expect(await store.installId(), id, reason: 'one id per install');
    prefs.values['referral_pending_invite'] = 'not json';
    expect(await store.read(), isNull);
  });

  test('the server’s status: nothing is live unless it says so', () {
    expect(ReferralStatus.fromJson({'ok': true, 'live': false}).live, isFalse);
    expect(ReferralStatus.fromJson(null).live, isFalse);
    expect(ReferralStatus.fromJson({'ok': true, 'live': true, 'code': 'K7P2M9X'}).live, isFalse, reason: 'no link, nothing to share');
    final s = ReferralStatus.fromJson({
      'ok': true, 'live': true, 'code': 'K7P2M9X', 'link': 'https://www.mockmob.in/r/K7P2M9X', 'reward': 100, 'monthlyCap': 10,
      'joined': 2, 'practised': 1, 'rewarded': 1, 'notCounted': 0, 'earned': 100, 'capReached': false, 'paused': false,
      'invited': {'state': 'joined', 'rewarded': false},
    });
    expect([s.live, s.reward, s.joined, s.practised, s.rewarded, s.earned, s.invitedState, s.invitedRewarded],
        [true, 100, 2, 1, 1, 100, 'joined', false]);
    expect(ReferralStatus.fromJson({'ok': true, 'live': true, 'code': 'X', 'link': 'https://x', 'joined': -3, 'reward': 0}).joined, 0);
  });

  test('words: the owner’s example status line, honest when a friend did not count, no exclamation marks', () {
    expect(ReferralCopy.summary(joined: 2, practised: 1, rewarded: 1, reward: 100), '2 friends joined, 1 practised: +100 each.');
    expect(ReferralCopy.summary(joined: 1, practised: 0, rewarded: 0, reward: 100), '1 friend joined, 0 practised.');
    expect(ReferralCopy.summary(joined: 3, practised: 3, rewarded: 2, reward: 100), '3 friends joined, 3 practised.');
    expect(ReferralCopy.summary(joined: 0, practised: 0, rewarded: 0, reward: 100), ReferralCopy.none);
    expect(ReferralCopy.title(100), 'Invite a friend, you both get 100 credits');
    final all = [
      ReferralCopy.title(100), ReferralCopy.how(100), ReferralCopy.mobLine(100), ReferralCopy.cap(10), ReferralCopy.share, ReferralCopy.copy,
      ReferralCopy.copied, ReferralCopy.shareFailed, ReferralCopy.shareText(100, 'https://www.mockmob.in/r/K7P2M9X'), ReferralCopy.none,
      ReferralCopy.paused, ReferralCopy.capReached(10, 100), ReferralCopy.invitedJoined(100), ReferralCopy.invitedRewarded(100),
      ReferralCopy.earned(100), ReferralCopy.notCounted(1), ReferralCopy.haveCode, ReferralCopy.codeAdded(100), ReferralCopy.codeBad,
      ReferralCopy.codeUnknown, ReferralCopy.codeOwn, ReferralCopy.codeUsed, ReferralCopy.codeNotNew, ReferralCopy.codeOffline,
    ];
    for (final w in all) {
      expect(w, isNot(contains('!')), reason: w);
      expect(w, isNot(contains('—')), reason: w);
      expect(w, isNot(contains('·')), reason: w);
    }
  });

  test('a friend’s link opens Today natively, never the website’s sign-up page', () {
    final t = ActionRouter.resolve('https://www.mockmob.in/r/K7P2M9X');
    expect(t, isA<NativeTarget>());
    expect((t as NativeTarget).location, AppRoutes.today);
    expect(ActionRouter.resolve('https://www.mockmob.in/signup?invite=1'), isA<UnsupportedTarget>());
  });
}
