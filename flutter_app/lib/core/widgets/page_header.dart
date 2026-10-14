import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../router/routes.dart';
import '../theme/theme.dart';
import 'hit_slop.dart';
import 'pressable.dart';

/// The one header of every pushed page (SPACING.md 9, audit G2): the back arrow on the gutter, the
/// title inline in the tab roots' `screenTitle` cut, an optional trailing action, on a 56 dp row,
/// and an optional caption under the row on the gutter. It replaces the stacked back-arrow-then-28
/// headline and the five bespoke bars (review `PageHeader`, practice `PracticeAppBar`, the auth,
/// result and mistake `_TopBar`s). The stacked large title stays for moments.
///
/// The header paints its own gutter, so the back target's slop band lies inside its bounds (a hit
/// band outside a parent's box cannot be reached). Place it at the top of the screen's column with
/// no horizontal padding of its own.
class MmPageHeader extends StatelessWidget {
  const MmPageHeader({
    super.key,
    required this.title,
    this.trailing,
    this.caption,
    this.onBack,
    this.fallbackRoute = AppRoutes.today,
    this.backLabel = 'Back',
    this.showBack = true,
  });

  final String title;

  /// A small action on the right (a key, an icon). Its own target is at least 48 dp.
  final Widget? trailing;

  /// One line under the row, on the gutter ("Updated 7:30 PM", the offline line).
  final String? caption;

  /// What Back does. Defaults to popping, or going to [fallbackRoute] when there is nothing to pop
  /// (a deep link opened this page).
  final VoidCallback? onBack;
  final String fallbackRoute;
  final String backLabel;

  /// False for a page that cannot go back (the title then starts on the gutter).
  final bool showBack;

  /// The row's height.
  static const double rowHeight = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: rowHeight,
            child: Row(
              children: [
                if (showBack) ...[
                  // The arrow's glyph is 24 dp and sits on the gutter; the target reaches 16 dp to
                  // its left (inside this header's own padding) and 8 dp to its right: 48 dp wide.
                  MmHitSlop(
                    slop: const EdgeInsets.fromLTRB(MmSpace.gutter, 2, MmSpace.s8, 2),
                    child: MmPressable(
                      semanticsLabel: backLabel,
                      haptic: MmPressHaptic.selection,
                      focusRadius: MmRadius.smallAll,
                      onTap: onBack ?? () => context.canPop() ? context.pop() : context.go(fallbackRoute),
                      builder: (context, pressed, _) => SizedBox(
                        width: 24,
                        height: 44,
                        child: Icon(LucideIcons.arrowLeft, size: 24, color: pressed ? colors.ink2 : colors.ink),
                      ),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s16),
                ],
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text(title, style: type.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ),
                if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
              ],
            ),
          ),
          if (caption != null)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Text(caption!, style: type.small.copyWith(color: colors.ink2)),
            ),
        ],
      ),
    );
  }
}
