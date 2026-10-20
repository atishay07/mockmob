import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'referral_copy.dart';
import 'referral_data.dart';

/// Opens the phone's share sheet with [text]. Replaced in tests.
typedef InviteSharer = Future<void> Function(String text);

final inviteSharerProvider = Provider<InviteSharer>(
  (ref) => (text) async {
    await SharePlus.instance.share(ShareParams(text: text));
  },
);

/// Shares the student's invite (the referral text with their link) through the share sheet. One helper for the Wallet's
/// invite section and the welcome-credits sheet. True when the share sheet opened; false (with a line saying to copy the
/// link instead) when it did not, or when there is no link to share.
Future<bool> shareInvite(BuildContext context, WidgetRef ref, ReferralStatus s) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final link = s.link;
  if (link == null) return false;
  try {
    await ref.read(inviteSharerProvider)(ReferralCopy.shareText(s.reward, link));
    return true;
  } on Object {
    messenger?.showSnackBar(const SnackBar(content: Text(ReferralCopy.shareFailed)));
    return false;
  }
}
