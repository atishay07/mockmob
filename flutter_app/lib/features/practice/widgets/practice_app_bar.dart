import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// Back to wherever the student came from, or to the Practice tab when there is nothing to pop
/// (the screen was opened by a link or after a session).
void leavePractice(BuildContext context) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(AppRoutes.practice);
  }
}

/// The top row of a pushed practice screen, on the one sub-page header pattern (SPACING.md 9):
/// the 44 dp back disc (48 target) with its edge on the gutter, 12, then an optional title inline
/// in the screen-title style, in a 56 dp row. Kept local until the shared `MmPageHeader` lands.
class PracticeAppBar extends StatelessWidget {
  const PracticeAppBar({super.key, this.title, this.showBack = true, this.onBack});

  final String? title;
  final bool showBack;

  /// Defaults to [leavePractice].
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    // The 48 dp target is 2 dp wider than the disc on each side: the disc's edge sits on the gutter
    // and the title starts 12 dp after it.
    const slop = (MmTarget.min - GlassBackButton.disc) / 2;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter - slop, MmSpace.s4, MmSpace.gutter, 0),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            if (showBack) GlassBackButton(onTap: onBack ?? () => leavePractice(context)) else const SizedBox(width: slop),
            const SizedBox(width: MmSpace.s12 - slop),
            if (title != null)
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(title!, style: context.mmType.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// A 44 dp smoked-glass disc with the back arrow, in a 48 dp target.
class GlassBackButton extends StatelessWidget {
  const GlassBackButton({super.key, required this.onTap, this.label = PracticeCopy.backSemantics, this.icon = LucideIcons.arrowLeft});

  final VoidCallback onTap;
  final String label;
  final IconData icon;

  /// The visible disc inside the 48 dp target.
  static const double disc = 44;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: label,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox.square(
        dimension: MmTarget.min,
        child: Center(
          child: SizedBox.square(
            dimension: disc,
            child: FakeGlass(
              borderRadius: MmRadius.pillAll,
              pressed: pressed,
              grain: false,
              child: Center(child: Icon(icon, size: 20, color: colors.ink)),
            ),
          ),
        ),
      ),
    );
  }
}
