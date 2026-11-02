import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A text key with a hairline under it (the web's `lh-textkey`): 48 dp to touch, plain to look at. The offer's quiet link and the
/// error lines use it. (The three shelf tiles this file once held are gone: the offer's Revise row says the due cards, and the
/// student's sets are rows of Find, ruling R4.)
class HomeTextKey extends StatelessWidget {
  const HomeTextKey({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: Center(
            widthFactor: 1,
            child: Text(
              label,
              style: type.labelLarge.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: colors.ink,
                decoration: TextDecoration.underline,
                decorationColor: colors.lineStrong,
                decorationThickness: 1.5,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
