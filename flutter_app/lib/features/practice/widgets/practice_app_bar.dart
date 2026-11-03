import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'pressable.dart';

/// Back to wherever the student came from, or to the Practice tab when there is nothing to pop
/// (the screen was opened by a link or after a session).
void leavePractice(BuildContext context) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(AppRoutes.practice);
  }
}

/// The top row of a pushed practice screen: a 44 dp back key and the title as a heading.
class PracticeAppBar extends StatelessWidget {
  const PracticeAppBar({super.key, required this.title, this.showBack = true});

  final String title;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.gutter, 0),
      child: Row(
        children: [
          if (showBack)
            Pressable(
              onTap: () => leavePractice(context),
              semanticsLabel: PracticeCopy.backSemantics,
              minHeight: MmTarget.min,
              radius: MmRadius.key,
              builder: (_, _) => SizedBox(
                width: MmTarget.min,
                height: MmTarget.min,
                child: Icon(LucideIcons.arrowLeft, size: 24, color: colors.ink),
              ),
            )
          else
            const SizedBox(width: MmSpace.s12),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Semantics(header: true, child: Text(title, style: context.mmType.title)),
          ),
        ],
      ),
    );
  }
}
