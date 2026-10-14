import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';

/// The top row of a pushed Review page: back, then the title in the Bricolage title cut.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.canPop() ? context.pop() : context.go(AppRoutes.review),
            tooltip: 'Back',
            icon: Icon(LucideIcons.arrowLeft, color: colors.ink),
          ),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Semantics(header: true, child: Text(title, style: context.mmType.screenTitle)),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
