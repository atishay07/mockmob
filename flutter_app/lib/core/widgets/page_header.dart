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
/// The header paints its own gutter as spacers in its row, so the back target's slop band lies
/// inside its bounds (a hit band outside a parent's box cannot be reached). Place it at the top of
/// the screen's column with no horizontal padding of its own.
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
    this.statusLine,
    this.reserveStatusLine = false,
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

  /// A live line under the row on the gutter that comes and goes ("Saved at 6:00 PM", a Sending
  /// pill). With [reserveStatusLine] its [statusLineHeight] is kept whether or not it shows, so
  /// nothing on the page moves when it appears.
  final Widget? statusLine;
  final bool reserveStatusLine;

  /// The status line's room: one small line, or the 30 dp save pill.
  static const double statusLineHeight = 32;

  /// The row's height.
  static const double rowHeight = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The gutter is a spacer inside the row, not padding around it: a padding box is not part of its
    // child's bounds, so a hit band reaching into it would never be tested.
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: rowHeight,
          child: Row(
            children: [
              const SizedBox(width: MmSpace.gutter),
              if (showBack) ...[
                // The arrow's glyph is 24 dp and sits on the gutter; the target reaches 16 dp to
                // its left (to the screen edge) and 8 dp to its right: 48 dp wide.
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
              const SizedBox(width: MmSpace.gutter),
            ],
          ),
        ),
        if (statusLine != null || reserveStatusLine)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: statusLineHeight),
              child: Align(alignment: Alignment.centerLeft, child: statusLine),
            ),
          ),
        if (caption != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
            child: Text(caption!, style: type.small.copyWith(color: colors.ink2)),
          ),
      ],
    );
  }
}
