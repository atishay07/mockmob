// Today's pressable secondary controls (TODAY-1017 4.2 and 4.4; owner F5: controls must look like
// buttons, not information). A pill is an outlined capsule with an icon and a label, 48 dp tall,
// under the move's one volt key ("Change length", "Something else"). A token is a value the
// student can change, drawn as one: a small outlined chip with an up-down glyph ("4 a week"),
// 34 dp to see and 48 dp to touch. Neither is ever volt: the move key keeps the screen's one fill.
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

class TodayPill extends StatelessWidget {
  const TodayPill({super.key, required this.label, required this.icon, required this.onTap, this.semanticsLabel});

  final String label;
  final IconData icon;

  /// Null shows the pill quiet and inert (offline, for a key that starts a session).
  final VoidCallback? onTap;
  final String? semanticsLabel;

  static const double height = MmTarget.min;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onTap != null;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel ?? label,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
        decoration: ShapeDecoration(
          color: pressed ? Color.alphaBlend(colors.ink.withValues(alpha: 0.04), colors.raised2) : colors.raised2,
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: enabled ? colors.ink : colors.ink3),
            const SizedBox(width: MmSpace.s8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: type.labelLarge.copyWith(color: enabled ? colors.ink : colors.ink3, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A value that opens its tuner: "4 a week" with the up-down glyph. [open] draws it held (its
/// tuner is open under it).
class TodayToken extends StatelessWidget {
  const TodayToken({super.key, required this.label, required this.onTap, this.open = false, this.semanticsLabel, this.tokenKey});

  final String label;
  final VoidCallback? onTap;
  final bool open;
  final String? semanticsLabel;
  final Key? tokenKey;

  static const double height = 34;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: height,
      child: MmPressable(
        key: tokenKey,
        onTap: onTap,
        semanticsLabel: semanticsLabel ?? label,
        selected: open,
        focusRadius: MmRadius.smallAll,
        pressedScale: 0.98,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => AnimatedContainer(
          duration: const Duration(milliseconds: 100),
          curve: Curves.easeOut,
          height: height,
          padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s8),
          decoration: BoxDecoration(
            color: pressed || open ? Color.alphaBlend(colors.ink.withValues(alpha: 0.05), colors.raised2) : colors.raised2,
            borderRadius: MmRadius.smallAll,
            border: Border.all(color: open ? colors.ink : colors.lineStrong, width: open ? 1.5 : 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                maxLines: 1,
                style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              const SizedBox(width: MmSpace.s4),
              Icon(LucideIcons.chevronsUpDown, size: 15, color: colors.ink2),
            ],
          ),
        ),
      ),
    );
  }
}
