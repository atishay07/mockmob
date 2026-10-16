import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// "Offline. Showing what is saved on this phone." as a legible 14 sp line with its glyph, living inside a
/// header row that is already tall enough for it: it adds no height, so nothing below it moves
/// when the phone goes offline and comes back.
class HeaderNotice extends StatelessWidget {
  const HeaderNotice(this.message, {super.key});

  /// What the offline header says.
  static const offline = ReviewCopy.savedOffline;

  /// Online, but the last refresh failed: the saved record is on screen.
  static const refreshFailed = ReviewCopy.savedRefreshFailed;

  /// The line for a failed read over a saved copy ([offline]: the phone has no connection).
  static String forFailure({required bool offline}) => offline ? ReviewCopy.savedOffline : ReviewCopy.savedRefreshFailed;

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
  const ReviewTabHeader({super.key, required this.title, this.notice, this.onAsk, this.showMobi = true});

  final String title;
  final String? notice;

  /// Opens Ask Mobi. Null leaves the header as a title alone (the loading and error states).
  final VoidCallback? onAsk;

  /// Mobi's face in the Ask pill (20 dp, at rest). Off while a scene on screen carries the one
  /// Mobi of the screen (the empty state, the all-clear hero, a load failure).
  final bool showMobi;

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
          if (onAsk != null) ...[const SizedBox(width: MmSpace.s12), _AskPill(onTap: onAsk!, showMobi: showMobi)],
        ],
      ),
    );
  }
}

/// "Ask Mobi" in the Review header: a ghost pill (a 1 dp line, no fill, so the one volt key on the
/// screen stays the hero's), drawn 40 dp tall and answering a finger anywhere in a 48 dp box.
class _AskPill extends StatelessWidget {
  const _AskPill({required this.onTap, this.showMobi = true});

  final VoidCallback onTap;
  final bool showMobi;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 40,
      child: MmPressable(
        onTap: onTap,
        focusRadius: MmRadius.pillAll,
        haptic: MmPressHaptic.selection,
        highlight: true,
        semanticsLabel: 'Ask Mobi, a question about your record',
        builder: (context, pressed, _) => DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.raised2 : null,
            shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
          ),
          child: SizedBox(
            height: 40,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Mobi is who answers, so his face leads the pill (excluded from semantics: the
                  // label says "Ask Mobi"). Where a scene carries him instead, the chat glyph stays.
                  ExcludeSemantics(
                    child: showMobi
                        ? const SizedBox.square(
                            dimension: 24,
                            child: MobiCharacter(size: 24, head: true, shadow: false, watchTaps: false, entrance: MobiAct.idle),
                          )
                        : Icon(LucideIcons.messageCircle, size: 16, color: colors.ink),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Text(ReviewCopy.askKey, style: type.labelLarge.copyWith(color: colors.ink)),
                ],
              ),
            ),
          ),
        ),
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
