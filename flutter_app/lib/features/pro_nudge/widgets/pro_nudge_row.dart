import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/pro_nudge_controller.dart';
import 'upgrade_sheet.dart';

/// One quiet row that says what Pro changes at this spot, with one action: the whole line opens the
/// Upgrade sheet. A small close on the right dismisses it, and a dismissed row stays quiet for seven
/// days.
///
/// It draws nothing (and takes no space, [topGap] and [bottomGap] included) when `PLAY_BILLING` is
/// off, the student is signed out or already Pro, or the row was dismissed inside the last seven
/// days. A screen places at most one.
class ProNudgeRow extends ConsumerWidget {
  const ProNudgeRow({super.key, required this.surface, this.text, this.reason, this.show = true, this.topGap = 0, this.bottomGap = 0});

  final ProNudgeSurface surface;

  /// The line, when the place has better words than the surface's own.
  final String? text;

  /// The reason line on the sheet it opens, when it differs from the surface's own.
  final ProReason? reason;

  /// False while the place has nothing to say yet (a cost that is not known). The row keeps its spot in the
  /// tree, so what is around it does not rebuild when it comes and goes.
  final bool show;

  /// Space above and below the row. They belong to the row so that, with the nudge off, no gap is left.
  final double topGap;
  final double bottomGap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(proNudgesOnProvider)) return const SizedBox.shrink();
    final visible = show && ref.watch(proNudgeVisibleProvider(surface));
    final line = text ?? ProNudgeCopy.lineFor(surface);
    return MmSizeEase(
      duration: Motion.of(context, Motion.glideDuration),
      curve: Motion.glide,
      alignment: Alignment.topCenter,
      child: visible
          ? Padding(
              padding: EdgeInsets.only(top: topGap, bottom: bottomGap),
              child: _Row(
                line: line,
                onOpen: () => showUpgradeSheetIfOn(context, reason: reason ?? ProNudgeCopy.reasonFor(surface)),
                onDismiss: () => ref.read(proNudgeProvider.notifier).dismiss(surface),
              ),
            )
          : const SizedBox(width: double.infinity),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.line, required this.onOpen, required this.onDismiss});

  final String line;
  final VoidCallback onOpen;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        Expanded(
          child: MmPressable(
            onTap: onOpen,
            semanticsLabel: '$line. ${ProNudgeCopy.nudgeAction}',
            focusRadius: MmRadius.keyAll,
            builder: (context, pressed, focused) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
                  child: Text.rich(
                    TextSpan(
                      style: type.small.copyWith(color: colors.ink2),
                      children: [
                        TextSpan(text: '$line '),
                        TextSpan(text: ProNudgeCopy.nudgeAction, style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        MmPressable(
          onTap: onDismiss,
          semanticsLabel: ProNudgeCopy.nudgeDismiss,
          focusRadius: MmRadius.pillAll,
          builder: (context, pressed, focused) => SizedBox.square(
            dimension: MmTarget.min,
            child: Center(child: Icon(LucideIcons.x, size: 18, color: colors.ink3)),
          ),
        ),
      ],
    );
  }
}
