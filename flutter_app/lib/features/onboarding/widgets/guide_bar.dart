import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The deck's top bar: the small Back icon and Skip when the step allows it, 48 dp targets. It
/// stands [topGap] under the status bar, so nothing on a step sits in it (D40). Mobi no longer
/// rides here: he stands in each step's group, sized to the phone (D44, StepFrame).
class GuideBar extends StatelessWidget {
  const GuideBar({
    super.key,
    required this.onBack,
    required this.onSkip,
    this.showBack = true,
    this.center,
  });

  /// Where the student is, in the bar itself, on a step that has no room for the sheet strip under
  /// it (the timed question, 19 Oct #19): the strip costs no height there, so the question keeps its
  /// room and the progress stays.
  final Widget? center;

  /// Off once the plan is sealed: the icon would sit on the painted sheet, and the labelled Back
  /// pill stays at the foot (v15 taste pass, D40).
  final bool showBack;

  /// The bar's own height (the targets are 48 dp, centred).
  static const double height = 48;

  /// The room between the status bar and the bar, so its icon sits 24 dp or more under it.
  static const double topGap = MmSpace.s12;

  /// The bar with the room above it.
  static const double extent = topGap + height;

  final VoidCallback onBack;
  final VoidCallback? onSkip;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(top: topGap),
      child: SizedBox(
        height: height,
        child: Row(
          children: [
            // The label sits on the pressable itself, so TalkBack's double tap reaches onTap.
            if (!showBack) const SizedBox.square(dimension: 48) else MmPressable(
              semanticsLabel: OnboardingCopy.back,
              onTap: onBack,
              pressedScale: 0.9,
              builder: (context, pressed, _) => SizedBox.square(
                dimension: 48,
                child: Center(child: Icon(LucideIcons.arrowLeft, size: 22, color: pressed ? colors.ink2 : colors.ink)),
              ),
            ),
            if (center != null) Expanded(child: Center(child: center)) else const Spacer(),
            if (onSkip != null) KeyButton.quiet(label: OnboardingCopy.skip, onPressed: onSkip),
          ],
        ),
      ),
    );
  }
}
