// Fixtures for the friend-invite areas. The demo build and the tests share them, so a fresh account with live invites is
// one place: a student who just signed up (no friends yet, no invite joined) while invites are open.
import 'package:mockmob/features/referrals/referral_data.dart';

/// GET /api/referrals for a fresh account while invites are live: the link and code to share, nothing joined yet, and the
/// student has not joined with an invite (so "Have a friend's code?" shows).
const Map<String, Object?> freshAccountInvitesJson = {
  'ok': true,
  'live': true,
  'code': 'K7P2M9X',
  'link': 'https://www.mockmob.in/r/K7P2M9X',
  'reward': 100,
  'monthlyCap': 10,
  'paused': false,
  'joined': 0,
  'practised': 0,
  'rewarded': 0,
  'notCounted': 0,
  'earned': 0,
  'rewardedThisMonth': 0,
  'capReached': false,
  'invited': null,
};

final ReferralStatus freshAccountInvites = ReferralStatus.fromJson(freshAccountInvitesJson);
