import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, showUpgradeSheetIfOn;
import '../copy.dart';

/// A practice mode that Pro holds (D101): NTA mode and Smart practice. A Free student always sees
/// it, with a quiet Pro tag, and it is never hidden.
enum LockedMode {
  nta(ProReason.ntaMode),
  smart(ProReason.smartPractice);

  const LockedMode(this.reason);

  /// The Upgrade sheet's reason, when Pro can be had here.
  final ProReason reason;
}

/// A Free student taps a mode Pro holds. With `PLAY_BILLING` on it opens the Upgrade sheet with the
/// mode's own reason; with it off, a calm sheet that says the plain fact ("NTA mode is part of Pro.
/// Pro opens in the app soon."), with no price and no link to buy elsewhere (anti-steering), and the
/// open mode that comes closest, so the tap is never a dead end ([onInstead]).
void openLockedMode(BuildContext context, {required LockedMode mode, required VoidCallback onInstead}) {
  if (showUpgradeSheetIfOn(context, reason: mode.reason)) return;
  unawaited(showMmSheet<void>(
    context: context,
    title: PracticeCopy.lockedTitle(mode == LockedMode.nta ? PracticeCopy.ntaTitle : PracticeCopy.smartTitle),
    builder: (sheet) => LockedModeSheetBody(
      mode: mode,
      onInstead: () {
        Navigator.of(sheet).pop();
        onInstead();
      },
      onClose: () => Navigator.of(sheet).maybePop(),
    ),
  ));
}

/// The calm sheet's body: two plain sentences, the open mode instead, and Not now.
class LockedModeSheetBody extends StatelessWidget {
  const LockedModeSheetBody({super.key, required this.mode, required this.onInstead, required this.onClose});

  final LockedMode mode;
  final VoidCallback onInstead;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final nta = mode == LockedMode.nta;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(PracticeCopy.lockedSoon, style: type.body.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.s8),
          Text(nta ? PracticeCopy.lockedNtaInstead : PracticeCopy.lockedSmartInstead, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s20),
          KeyButton(
            key: ValueKey('locked-${mode.name}-instead'),
            label: nta ? PracticeCopy.takeFullInstead : PracticeCopy.takeQuickInstead,
            onPressed: onInstead,
          ),
          const SizedBox(height: MmSpace.s4),
          KeyButton.quiet(label: PracticeCopy.lockedNotNow, expanded: true, onPressed: onClose),
        ],
      ),
    );
  }
}
