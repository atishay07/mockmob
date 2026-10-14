import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The way from a claim to its evidence: a plain line of text with an arrow, in the volt of the
/// one accent, 48 dp tall. It names what opens ("See the 6 questions"), so it needs no dots or
/// pill to say what it is. It sits flush with the text above it.
class EvidenceLink extends StatelessWidget {
  const EvidenceLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                label,
                style: type.labelLarge.copyWith(color: pressed ? colors.ink2 : colors.ink, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Icon(LucideIcons.arrowRight, size: 18, color: pressed ? colors.ink2 : colors.volt),
          ],
        ),
      ),
    );
  }
}
