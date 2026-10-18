import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../copy.dart';
import '../data/pro_nudge_controller.dart';
import 'upgrade_sheet.dart';

/// Shows the first-session Upgrade sheet when it is due, and marks it shown so it never comes back
/// (the mark is saved on the phone). Returns whether it opened. The app shell calls this once the
/// student is on a calm screen (a tab root, nothing over it) after their first real action.
bool showFirstSessionUpgradeIfDue(BuildContext context, WidgetRef ref) {
  if (!ref.read(upgradePopupDueProvider)) return false;
  // Marked first: a second call while the sheet opens finds it already shown.
  ref.read(proNudgeProvider.notifier).popupShown();
  return showUpgradeSheetIfOn(context, reason: ProReason.firstSession);
}
