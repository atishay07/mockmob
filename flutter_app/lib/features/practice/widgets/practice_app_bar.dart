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

/// The top row of a pushed practice screen: a small glass back disc and an optional title.
class PracticeAppBar extends StatelessWidget {
  const PracticeAppBar({super.key, this.title, this.showBack = true, this.onBack});

  final String? title;
  final bool showBack;

  /// Defaults to [leavePractice].
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s4, MmSpace.gutter, 0),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            if (showBack) GlassBackButton(onTap: onBack ?? () => leavePractice(context)) else const SizedBox(width: MmSpace.s4),
            const SizedBox(width: MmSpace.s8),
            if (title != null)
              Expanded(child: Semantics(header: true, child: Text(title!, style: context.mmType.title, maxLines: 1, overflow: TextOverflow.ellipsis))),
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
            dimension: 44,
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
