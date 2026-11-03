import '../../../core/permissions/permission_requester.dart';

/// How long after a Not now the pre-prompt sheet may come back.
const Duration prePromptReturnAfter = Duration(days: 14);

/// Whether to show the "Remind me when it matters" sheet now (spec 8).
///
/// It is offered only while the system question has never been asked. After one Not now it
/// returns once, no sooner than 14 days later. After a second Not now it is never offered
/// again; the student can still turn notifications on from You.
bool shouldOfferPrePrompt({
  required NotificationPermission permission,
  required int notNowCount,
  required DateTime? lastNotNowAt,
  required DateTime now,
}) {
  if (permission != NotificationPermission.notAsked) return false;
  if (notNowCount <= 0) return true;
  if (notNowCount >= 2) return false;
  return lastNotNowAt != null &&
      now.difference(lastNotNowAt) >= prePromptReturnAfter;
}
