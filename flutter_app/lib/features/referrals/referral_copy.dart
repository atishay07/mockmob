/// Friend invites (owner D165, 20 Oct 2026): a referral gives both the inviter and the friend +100 credits once the friend
/// signs up and finishes one practice; the Mob invite link is also the referral link. The same words as the website
/// (src/lib/referrals/friendInvite.mjs). Plain sentence case: no "!", no em dash, no middle dot; never a friend's name.
abstract final class ReferralCopy {
  static String title(int reward) => 'Invite a friend, you both get $reward credits';
  static String how(int reward) =>
      'Share your link. When your friend signs up with it and finishes one practice, you each get $reward credits.';
  static String mobLine(int reward) =>
      'This link is also a friend invite: when a new friend joins with it and finishes one practice, you each get $reward credits.';
  static String cap(int cap) => 'You can earn this for up to $cap ${cap == 1 ? 'friend' : 'friends'} a month.';
  static const String share = 'Share your link';
  static const String copy = 'Copy link';
  static const String copied = 'Link copied';
  static const String shareFailed = 'The share sheet did not open. Copy the link instead.';
  static String shareText(int reward, String link) =>
      'Practise for CUET with me on MockMob. Sign up with my link and we both get $reward credits after your first practice. $link';
  static const String none = 'No friends have joined with your link yet.';
  static const String paused = 'Invite rewards are paused for now. A friend who practises meanwhile is paid when they resume.';
  static String capReached(int cap, int reward) =>
      'You have reached $cap ${cap == 1 ? 'friend' : 'friends'} this month. Friends who join still get their $reward credits.';
  static String invitedJoined(int reward) => "You joined with a friend's invite. Finish one practice and you both get $reward credits.";
  static String invitedRewarded(int reward) => 'You and your friend each got $reward credits for your first practice.';

  static String _n(int n, String one, String many) => '$n ${n == 1 ? one : many}';

  /// "2 friends joined, 1 practised: +100 each." (the owner's own example). "+N each" only when every friend who practised
  /// was paid, so it is never said over a friend who did not count.
  static String summary({required int joined, required int practised, required int rewarded, required int reward}) {
    if (joined <= 0) return none;
    final head = '${_n(joined, 'friend', 'friends')} joined, $practised practised';
    return rewarded > 0 && rewarded == practised ? '$head: +$reward each.' : '$head.';
  }

  static String earned(int credits) => 'You have earned ${_n(credits, 'credit', 'credits')} from invites.';
  static String notCounted(int n) => '${_n(n, 'invite', 'invites')} did not count toward your reward.';
}
