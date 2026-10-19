// The WhatsApp invite card (spec 5.3 D5): the group art with the wordmark, "Aarav saved you a seat in
// Chai Circle", "An Accountancy Mob on MockMob. Code K7P 2M9." Rendered off-screen to PNG for
// share_plus. Owner: SOCIAL agent.
// STUB from the foundation commit: the owning agent replaces the bodies, keeping these signatures.

import 'package:flutter/material.dart';

/// The card as drawn on screen (the preview in D5).
class InviteCardPreview extends StatelessWidget {
  const InviteCardPreview({super.key, required this.youName, required this.mobName, required this.subjectName, required this.display});

  final String youName;
  final String mobName;
  final String subjectName;

  /// "K7P 2M9".
  final String display;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// Fetches an invite, renders the card to PNG and opens the share sheet (WhatsApp first).
Future<void> shareInviteCard(BuildContext context) async {}

/// Fetches an invite and copies its code; returns the display code or null.
Future<String?> copyInviteCode(BuildContext context) async => null;
