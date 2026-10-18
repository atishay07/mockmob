import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../copy.dart';
import '../data/pro_nudge_controller.dart';
import 'upgrade_sheet.dart';

/// Shows the first-session Upgrade sheet when it is due, and marks it shown so it never comes back
/// (the mark is saved on the phone). Returns whether it opened. The app shell calls this once the
/// student is on a calm screen (a tab root, nothing over it) after their first real action.
bool showFirstSessionUpgradeIfDue(BuildContext context, WidgetRef ref) {
  // The rules again, with the clock as it is now; marked before the sheet opens.
  if (!ref.read(proNudgeProvider.notifier).takePopup()) return false;
  return showUpgradeSheetIfOn(context, reason: ProReason.firstSession);
}
