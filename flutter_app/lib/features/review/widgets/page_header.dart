import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';

/// "Offline. Showing last loaded data." as a legible 14 sp line with its glyph, living inside a
/// header row that is already tall enough for it: it adds no height, so nothing below it moves
/// when the phone goes offline and comes back.
class HeaderNotice extends StatelessWidget {
  const HeaderNotice(this.message, {super.key});

  /// What the offline header says.
  static const offline = 'Offline. Showing last loaded data.';

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ExcludeSemantics(child: Icon(LucideIcons.wifiOff, size: 14, color: colors.ink)),
          const SizedBox(width: MmSpace.s4),
          Expanded(child: Text(message, style: type.small.copyWith(color: colors.ink))),
        ],
      ),
    );
  }
}

/// The top row of the Review tab: the title (You is a place on the bar now) and, when the data on
/// screen is the last loaded copy, the offline line under the title. The row keeps the 56 dp every
/// tab root has, so the line costs no height.
class ReviewTabHeader extends StatelessWidget {
  const ReviewTabHeader({super.key, required this.title, this.notice});

  final String title;
  final String? notice;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(header: true, child: Text(title, style: type.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (notice != null) HeaderNotice(notice!),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The top row of a pushed Review page: the back key (a 48 dp target whose arrow sits on the
/// gutter), then the title in the tab roots' `screenTitle` cut on the same 56 dp row, and the
/// offline line under it when the page shows the last loaded copy.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.trailing, this.notice});

  final String title;
  final Widget? trailing;
  final String? notice;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      // The arrow's glyph is 24 dp centred in its 48 dp target, so 4 dp of row padding puts it on
      // the gutter (16) like every other screen's left edge.
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Row(
          children: [
            IconButton(
              onPressed: () => context.canPop() ? context.pop() : context.go(AppRoutes.review),
              tooltip: 'Back',
              icon: Icon(LucideIcons.arrowLeft, color: colors.ink),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Semantics(header: true, child: Text(title, style: context.mmType.screenTitle)),
                  if (notice != null) HeaderNotice(notice!),
                ],
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}
