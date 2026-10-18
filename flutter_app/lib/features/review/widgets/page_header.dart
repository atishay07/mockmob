import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/attempt.dart' show Attempt;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart' show RemoteState;
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/review_providers.dart' show ReviewClock;

/// "Offline. Last loaded 7:26 AM." as a legible 14 sp line with its glyph, living inside a
/// header row that is already tall enough for it: it adds no height, so nothing below it moves
/// when the phone goes offline and comes back.
class HeaderNotice extends StatelessWidget {
  const HeaderNotice(this.message, {super.key});

  /// The line for a failed read over a saved copy ([offline]: the phone has no connection), with the time of the last
  /// GOOD read of what is on screen ([lastGoodRead]): the same words Today says over its own saved copy.
  static String forFailure({required bool offline, DateTime? lastGoodRead}) =>
      offline ? ReviewCopy.savedOffline(lastGoodRead) : ReviewCopy.savedRefreshFailed(lastGoodRead);

  /// The header line over the attempts list the screen holds, or null while that list is fresh: offline or refresh
  /// failed by the failed read's own cause, and the time of the last GOOD read in the student's own clock.
  ///
  /// [offline] is the connection monitor's word, so the line shows the moment the radio drops (Today does the same), not only
  /// after a read has failed: the list on screen is then the last copy, whatever the next read does.
  static String? forAttempts(RemoteState<List<Attempt>> attempts, ReviewClock clock, {bool offline = false}) {
    if (!attempts.isStale && !(offline && attempts.value != null)) return null;
    final at = attempts.fetchedAt;
    return forFailure(offline: offline || (attempts.error?.isOffline ?? false), lastGoodRead: at == null ? null : clock.local(at));
  }

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.small.copyWith(color: colors.ink);
    return Semantics(
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ExcludeSemantics(child: Icon(LucideIcons.wifiOff, size: 14, color: colors.ink)),
          const SizedBox(width: MmSpace.s4),
          Expanded(child: OneLineNotice(message, style: style)),
        ],
      ),
    );
  }
}

/// Where the offline line sits under a title. It opens and closes with a size ease on a Motion curve, so a line that has to
/// wrap (a large system text size) pushes what is under it down smoothly instead of in one frame. On one line the header is
/// already tall enough and the slot adds no height at all, with or without the ease.
class _NoticeSlot extends StatelessWidget {
  const _NoticeSlot(this.notice);

  final String? notice;

  @override
  Widget build(BuildContext context) {
    return MmSizeEase(
      duration: Motion.card,
      curve: Motion.out,
      alignment: Alignment.topLeft,
      child: notice == null ? const SizedBox.shrink() : HeaderNotice(notice!),
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

  /// The width the offline line needs next to the title: its glyph, a gap and the text at its smallest drawn size.
  static double _noticeNeeds(BuildContext context, String notice) {
    final painter = TextPainter(
      text: TextSpan(text: notice, style: context.mmType.small),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final width = painter.width;
    painter.dispose();
    return 14 + MmSpace.s4 + width * noticeFloor;
  }

  /// The width of the labelled Ask pill: its padding, Mobi's face, the gap and the word.
  static double _pillWidth(BuildContext context) {
    final painter = TextPainter(
      text: TextSpan(text: ReviewCopy.askKey, style: context.mmType.labelLarge),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final width = painter.width;
    painter.dispose();
    return MmSpace.s16 * 2 + 24 + MmSpace.s8 + width;
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return LayoutBuilder(
      builder: (context, box) {
        // The pill loses its word, and keeps Mobi's face, only when the offline line cannot sit on one line beside the
        // labelled pill (a 360 dp phone with its account key on the left): the header keeps its height and the line its
        // one row, so the hero under it never moves when the line appears (v15 final walk).
        final compactAsk =
            onAsk != null && notice != null && _noticeNeeds(context, notice!) > box.maxWidth - _pillWidth(context) - MmSpace.s12;
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
                    _NoticeSlot(notice),
                  ],
                ),
              ),
              if (onAsk != null) ...[
                const SizedBox(width: MmSpace.s12),
                _AskPill(onTap: onAsk!, showMobi: showMobi, compact: compactAsk),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// "Ask Mobi" in the Review header: a ghost pill (a 1 dp line, no fill, so the one volt key on the
/// screen stays the hero's), drawn 40 dp tall and answering a finger anywhere in a 48 dp box.
class _AskPill extends StatelessWidget {
  const _AskPill({required this.onTap, this.showMobi = true, this.compact = false});

  final VoidCallback onTap;
  final bool showMobi;

  /// Mobi's face alone in the same 40 dp pill outline, while the offline line needs the room.
  final bool compact;

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
              padding: EdgeInsets.symmetric(horizontal: compact ? MmSpace.s8 : MmSpace.s16),
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
                  if (!compact) ...[
                    const SizedBox(width: MmSpace.s8),
                    Text(ReviewCopy.askKey, style: type.labelLarge.copyWith(color: colors.ink)),
                  ],
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
                  _NoticeSlot(notice),
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
