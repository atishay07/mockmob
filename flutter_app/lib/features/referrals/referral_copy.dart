/// Friend invites (owner D165, 20 Oct 2026; D182: any one practice counts): a referral gives both the inviter and the friend
/// +100 credits once the friend signs up and finishes one practice; the Mob invite link is also the referral link. The same words as the website
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
      'Practise for CUET with me on MockMob. Sign up with my link and we both get $reward credits when you finish one practice. $link';
  static const String none = 'No friends have joined with your link yet.';
  static const String paused = 'Invite rewards are paused for now. A friend who practises meanwhile is paid when they resume.';
  static String capReached(int cap, int reward) =>
      'You have reached $cap ${cap == 1 ? 'friend' : 'friends'} this month. Friends who join still get their $reward credits.';
  static String invitedJoined(int reward) => "You joined with a friend's invite. Finish one practice and you both get $reward credits.";
  static String invitedRewarded(int reward) => 'You and your friend each got $reward credits for finishing one practice.';

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

  // A friend's code, typed by hand (after sign-in, and in the Wallet). The server decides; each answer says what happened and
  // what to do, never whose code it is.
  static const String haveCode = "Have a friend's code?";
  static const String codeLabel = "Friend's code";
  static const String codeHint = 'K7P 2M9X';
  static const String codeAdd = 'Add code';
  static String codeAdded(int reward) => 'Code added. When you finish one practice, you both get $reward credits.';
  static const String codeBad = 'That code does not look right. Check it and try again.';
  static const String codeUnknown = 'We could not find that code. Check it and try again.';
  static const String codeOwn = 'That is your own code. Share it with a friend instead.';
  static const String codeUsed = "You already joined with a friend's invite, so another code cannot be added.";
  static const String codeNotNew = 'Friend codes work for a new account that has not practised yet.';
  static const String codeOffline = 'We could not check the code. Check your connection and try again.';
  static const String codeBusy = 'Too many tries. Wait a few minutes and try again.';
  static const String codeOff = 'Invites are not open right now. Try again later.';

  /// The line under the code field for a claim the server refused (or could not answer).
  static String codeProblem(String? reason) => switch (reason) {
        'bad_code' || 'no_invite' => codeBad,
        'unknown_code' => codeUnknown,
        'self' => codeOwn,
        'already_referred' => codeUsed,
        'existing_account' || 'user_not_found' => codeNotNew,
        'rate_limited' => codeBusy,
        'off' => codeOff,
        _ => codeOffline,
      };
}
