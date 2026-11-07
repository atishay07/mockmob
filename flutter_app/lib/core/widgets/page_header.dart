import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../router/routes.dart';
import '../theme/theme.dart';
import 'materials/fake_glass.dart';
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
    this.closes = false,
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

  /// True for a page that opens over the one under it (Ask Mobi, N9): the key is a close mark that
  /// says "Close", not a back arrow, so the way out is as clear as the way in.
  final bool closes;

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
                // A labelled key, never a bare arrow (D43, R8 APP-10): "Back", or "Close" on a page that
                // opens over another.
                MmBackPill(
                  closes: closes,
                  label: closes ? 'Close' : backLabel,
                  onTap: onBack ?? () => context.canPop() ? context.pop() : context.go(fallbackRoute),
                ),
                const SizedBox(width: MmSpace.s12),
              ],
              // The title steps down to fit whole beside the key (never "Admission Comp..."), as on Ask Mobi.
              Expanded(
                child: Semantics(
                  header: true,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(title, style: type.screenTitle, maxLines: 1, softWrap: false),
                  ),
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

/// The one way back on a pushed page (D43: "a clear cut button to go back, rather than just that small back icon"): a
/// chevron and "Back" (or a cross and "Close") on a 44 dp glass pill in a 48 dp target. Glass, because it is chrome
/// floating over the page.
class MmBackPill extends StatelessWidget {
  const MmBackPill({super.key, required this.onTap, this.closes = false, this.label});

  final VoidCallback onTap;

  /// A cross and "Close" for a page that opens over the one under it; a chevron and "Back" otherwise.
  final bool closes;

  /// The word on the key; "Back" or "Close" by default.
  final String? label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final word = label ?? (closes ? 'Close' : 'Back');
    return MmPressable(
      semanticsLabel: word,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Center(
          child: FakeGlass(
            borderRadius: MmRadius.pillAll,
            pressed: pressed,
            grain: false,
            child: SizedBox(
              height: 44,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 16, 0),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(closes ? LucideIcons.x : LucideIcons.chevronLeft, size: closes ? 18 : 20, color: colors.ink),
                    const SizedBox(width: MmSpace.s4),
                    // The word is chrome: it grows with the system text up to 1.3x, never past the pill.
                    MediaQuery.withClampedTextScaling(
                      maxScaleFactor: 1.3,
                      child: Text(word, style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
