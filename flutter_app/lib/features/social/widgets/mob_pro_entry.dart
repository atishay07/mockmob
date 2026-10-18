import 'package:flutter/widgets.dart';

import '../../../core/theme/theme.dart';
import '../../pro_nudge/pro_nudge.dart' show ProNudgeCopy, ProReason, UpgradeEntry, showUpgradeSheetIfOn;
import '../data/mob_repository.dart';
import 'mob_parts.dart';

/// The Upgrade sheet's reason for a Mob failure that Pro answers (D80): a Free limit the student just
/// met (one Mob started, one Mob paper a week) has its own headline; any other Pro part of the Mob
/// opens on the side-by-side.
ProReason mobProReason(MobFailure f) => f == MobFailure.mobLimit || f == MobFailure.freePaperUsed ? ProReason.mobLimit : ProReason.mob;

/// The key under a Mob sentence that says a part is Pro's: it opens the Upgrade sheet on that part.
/// Draws nothing (and leaves no gap) for a failure Pro does not answer, with `PLAY_BILLING` off,
/// signed out, or for a Pro student, so the page is the one it was.
class MobProEntry extends StatelessWidget {
  const MobProEntry({super.key, this.failure, this.reason, this.label = ProNudgeCopy.gateAction, this.topGap = MmSpace.s8});

  /// The failure just said. Only one Pro answers ([MobFailure.needsPro]) shows the key.
  final MobFailure? failure;

  /// A Pro part said without a failure (the locked side-by-side, the plan line).
  final ProReason? reason;
  final String label;
  final double topGap;

  @override
  Widget build(BuildContext context) {
    final f = failure;
    final r = reason ?? (f != null && f.needsPro ? mobProReason(f) : null);
    if (r == null) return const SizedBox.shrink();
    return Align(alignment: Alignment.centerLeft, child: UpgradeEntry(reason: r, label: label, topGap: topGap));
  }
}

/// Says a failed Mob action in a toast, except when Pro is the answer and the Upgrade sheet can open
/// (D80: a tap on a Pro part opens the sheet). With the sheet off it is the toast it always was.
void sayMobFailure(BuildContext context, MobFailure failure, String message) {
  if (failure.needsPro && showUpgradeSheetIfOn(context, reason: mobProReason(failure))) return;
  showMobToast(context, message);
}
