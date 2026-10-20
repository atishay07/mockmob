/// Friend invites (owner D165, 20 Oct 2026; D182: any one practice counts): a referral gives both the inviter and the friend
/// +100 credits once the friend signs up and finishes one practice; the Mob invite link is also the referral link. The same words as the website
/// (src/lib/referrals/friendInvite.mjs; the final strings are kept in mockmob-next/tmp/v16-copy.md for it to mirror).
///
/// Version 16 (owner, 20 Oct 11:20 pm: the old lines were "very boring"): warm, plain and a little playful, with the same facts
/// (100 credits each, one finished practice, a cap a month). Sentence case: no "!", no emoji, no arrows, no em dash, no middle
/// dot, no hype; never a friend's name.
abstract final class ReferralCopy {
  static String title(int reward) => 'Bring a friend, you both get $reward credits';
  static String how(int reward) =>
      'Share your link. When they sign up with it and finish one practice, $reward credits land for both of you.';
  static String mobLine(int reward) =>
      'This link is a friend invite too. A new friend who joins with it and finishes one practice brings you both $reward credits.';
  static String cap(int cap) => 'Good for up to $cap ${cap == 1 ? 'friend' : 'friends'} a month.';
  static const String share = 'Share your link';
  static const String copy = 'Copy link';
  static const String copied = 'Link copied. Send it to a friend.';
  static const String shareFailed = 'The share sheet did not open. Copy the link instead.';
  static String shareText(int reward, String link) =>
      'Practising for CUET on MockMob. Join with my link and we both get $reward credits once you finish a practice: $link';
  static const String none = 'No friends on your link yet. One share starts it.';
  static const String paused = 'Invite rewards are on a short break. A practice done meanwhile still counts, and is paid when rewards return.';
  static String capReached(int cap, int reward) =>
      'That is $cap ${cap == 1 ? 'friend' : 'friends'} this month, the most one month pays for. New friends still get their $reward credits.';
  static String invitedJoined(int reward) => "You came in on a friend's link. Finish one practice and $reward credits land for both of you.";
  static String invitedRewarded(int reward) => 'Your first practice paid off: you and your friend each got $reward credits.';

  static String _n(int n, String one, String many) => '$n ${n == 1 ? one : many}';

  /// "2 friends joined, 1 practised: +100 each." (the owner's own example). "+N each" only when every friend who practised
  /// was paid, so it is never said over a friend who did not count.
  static String summary({required int joined, required int practised, required int rewarded, required int reward}) {
    if (joined <= 0) return none;
    final head = '${_n(joined, 'friend', 'friends')} joined, $practised practised';
    return rewarded > 0 && rewarded == practised ? '$head: +$reward each.' : '$head.';
  }

  static String earned(int credits) => 'Friends have brought you ${_n(credits, 'credit', 'credits')} so far.';
  static String notCounted(int n) => '${_n(n, 'invite', 'invites')} did not count toward a reward.';

  // A friend's code, typed by hand (after sign-in, and in the Wallet). The server decides; each answer says what happened and
  // what to do, never whose code it is.
  static const String haveCode = "Have a friend's code?";
  static const String codeLabel = "Friend's code";
  static const String codeHint = 'K7P 2M9X';
  static const String codeAdd = 'Add code';
  static String codeAdded(int reward) => 'Code added. Finish one practice and $reward credits land for both of you.';
  static const String codeBad = 'That code does not look quite right. Check it and try again.';
  static const String codeUnknown = 'No invite matches that code. Check it and try again.';
  static const String codeOwn = 'That one is your own code. Share it with a friend instead.';
  static const String codeUsed = "You already came in on a friend's invite, so another code cannot be added.";
  static const String codeNotNew = 'Friend codes are for new accounts, before their first practice.';
  static const String codeOffline = 'We could not check the code. Check your connection and try again.';
  static const String codeBusy = 'That is a lot of tries. Wait a few minutes and try again.';
  static const String codeOff = 'Invites are closed right now. Try again later.';

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

  // The welcome-credits sheet (owner, 20 Oct 11:20 pm: "Free 50 welcome credits. Want to earn extra? Invite your friends.").
  /// The welcome figure when no balance has been read yet.
  static const int welcomeCredits = 50;
  static const String welcomeUnit = 'welcome credits, yours';
  static const String welcomeWhat = "1 credit is 1 practice question. Mobi's fixes cost 1 too.";
  static String welcomeInviteTitle(int reward) => 'Bring a friend, you both get $reward more';
  static const String welcomeInviteHow = 'They sign up with your link and finish one practice.';
  static const String welcomeInvite = 'Invite a friend';
  static const String welcomeLater = 'Not now';
  static const String welcomeStart = 'Start practising';
  static String welcomeSemantics(int credits) => '$credits welcome credits, yours.';
}
