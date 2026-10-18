// Today's masthead (TODAY-1017 4.1): the date line and a greeting by first name, the account
// avatar on the left, and Mobi back on the right (D52 item 1, TODAY-SWIPE-1018): 46 dp in his
// greeting pose, a tap opens Ask Mobi. The greeting keeps one line beside him (it scales down to
// fit at 360 dp and large text, never wraps or ends in an ellipsis). When the move card already has
// Mobi (day one, coming back) the header leaves him out: never two Mobis on one screen. No week
// here: the week is "This week" under the move. When Today shows what it last loaded, a quiet time
// line takes the date line's place, so a Wi-Fi flip never moves the page (audit T6).
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/account/account_avatar.dart' show AccountLeading;
import '../../../core/widgets/widgets.dart' show Mobi, MobiPose, MmHitSlop, MmPressable, MmPressHaptic, OneLineNotice;
import '../copy.dart';
import '../copy_ahead.dart';
import '../logic/today_model.dart';
import 'today_entrance.dart';

class TodayHeader extends StatefulWidget {
  const TodayHeader({super.key, required this.header, this.onWeek, this.aim, this.bleed = 0, this.onRefresh, this.refreshing = false, this.onMobi, this.showMobi = true});

  /// Mobi's tap: Ask Mobi. Without it he is still there, as a picture.
  final VoidCallback? onMobi;

  /// False while the move card holds Mobi, so he is never on the screen twice.
  final bool showMobi;

  /// Mobi's height in the header (D52: 46 dp).
  static const double mobiSize = 46;

  /// A refresh failed online (S7): the date and greeting run Try again, the icon turning while
  /// the read runs.
  final VoidCallback? onRefresh;
  final bool refreshing;

  /// How far the masthead's box reaches past the content edge on each side: the week rail's day
  /// columns use it to be 48 dp wide on a 360 dp phone (the road rail uses it). Everything drawn
  /// stays inset by it. The screen takes the same amount off its own gutter and pads every other
  /// block by it.
  final double bleed;

  /// What Today borrows from its 16 dp gutter for the week rail's touch columns.
  static const double gutterBleed = 8;

  final HeaderModel header;
  final VoidCallback? onWeek;

  /// The move card's key, so the header Mobi can point at it.
  final GlobalKey? aim;

  @override
  State<TodayHeader> createState() => _TodayHeaderState();
}

class _TodayHeaderState extends State<TodayHeader> {
  @override
  Widget build(BuildContext context) {
    final header = widget.header;
    // The date line and the greeting, with the account avatar on the left (L16) and Mobi on the
    // right (D52); the week moved under the move as "This week" (4.3).
    return TodayEnter(
      delay: Duration.zero,
      rise: 0,
      length: const Duration(milliseconds: 200),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: widget.bleed),
        child: AccountLeading(
          child: _GreetingRow(
            dateLine: header.dateLine,
            updatedLine: header.updatedLine,
            greeting: header.greeting,
            onRefresh: header.refreshable ? widget.onRefresh : null,
            offline: header.offline,
            refreshing: widget.refreshing,
            mobi: widget.showMobi ? _HeaderMobi(onTap: widget.onMobi) : null,
          ),
        ),
      ),
    );
  }
}

/// The tab-root top row (date line, title, trailing; You is a place on the bar) with one
/// difference: "Good evening, Asha" is a full sentence, so a long one scales down to fit beside
/// Mobi instead of ending in an ellipsis.
class _GreetingRow extends StatelessWidget {
  const _GreetingRow({
    required this.dateLine,
    required this.greeting,
    this.updatedLine,
    this.onRefresh,
    this.refreshing = false,
    this.offline = false,
    this.mobi,
  });

  final VoidCallback? onRefresh;

  /// Mobi at the end of the row, or null.
  final Widget? mobi;

  /// Only a phone that is really offline gets the cloud-off mark.
  final bool offline;
  final bool refreshing;

  final String dateLine;

  /// "Updated 7:30 PM. You are offline." In the date line's place, on one line, so the row keeps
  /// its height whether or not it is shown.
  final String? updatedLine;
  final String greeting;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          Expanded(
            child: _Refreshable(
              onRefresh: onRefresh,
              label: updatedLine,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // The date and the freshness line stand at one spot: one leaves, then the other arrives (the spinner used to
                  // sit over the date for a frame when a read ended).
                  MmFadeThrough(
                    alignment: Alignment.centerLeft,
                    child: updatedLine == null
                        ? Text(
                            dateLine,
                            key: const ValueKey('date'),
                            style: type.caption.copyWith(color: colors.ink2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          )
                        : Row(
                            key: const ValueKey('updated'),
                            children: [
                              Icon(
                                offline ? LucideIcons.cloudOff : LucideIcons.rotateCw,
                                size: 14,
                                color: colors.ink2,
                              ).spinning(refreshing && !offline),
                              const SizedBox(width: MmSpace.s6),
                              Flexible(
                                // One line beside Mobi, a step smaller when it must be: the time at the end is what
                                // the line is for, so it never ends in an ellipsis (v15.1 walk, 360 dp).
                                child: OneLineNotice(updatedLine!, style: type.caption.copyWith(color: colors.ink2)),
                              ),
                            ],
                          ),
                  ),
                  Semantics(
                    header: true,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        greeting,
                        style: type.screenTitle,
                        maxLines: 1,
                        softWrap: false,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (mobi != null) ...[const SizedBox(width: 10), mobi!],
        ],
      ),
    );
  }
}

/// Mobi in the header: his greeting pose at 46 dp, a 48 dp target that opens Ask Mobi.
class _HeaderMobi extends StatelessWidget {
  const _HeaderMobi({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    const figure = Mobi(pose: MobiPose.greet, size: TodayHeader.mobiSize);
    final tap = onTap;
    if (tap == null) return const ExcludeSemantics(child: figure);
    // His figure is about 38 dp wide: the target reaches 10 dp towards the greeting (the right edge stays
    // flush with the margin) and 1 dp above and below, so it is 48 x 48.
    const vertical = (48 - TodayHeader.mobiSize) / 2;
    return MmHitSlop(
      slop: const EdgeInsets.fromLTRB(10, vertical, 0, vertical),
      child: MmPressable(
        onTap: tap,
        semanticsLabel: AheadCopy.askMobi,
        focusRadius: MmRadius.pillAll,
        pressedScale: 0.94,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => const SizedBox(height: TodayHeader.mobiSize, child: figure),
      ),
    );
  }
}

/// The date line when a refresh failed online: the whole line runs Try again and is the target
/// (at least 48 dp tall), so the line needs no key of its own.
class _Refreshable extends StatelessWidget {
  const _Refreshable({required this.child, this.onRefresh, this.label});

  final Widget child;
  final VoidCallback? onRefresh;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final tap = onRefresh;
    if (tap == null) return child;
    return Semantics(
      button: true,
      label: '${label ?? ''} ${TodayCopy.refreshSemantics}',
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: tap, child: ExcludeSemantics(child: child)),
    );
  }
}

extension on Icon {
  /// Turns while [on] (a read is running), still otherwise.
  Widget spinning(bool on) => on ? _Spin(child: this) : this;
}

class _Spin extends StatefulWidget {
  const _Spin({required this.child});

  final Widget child;

  @override
  State<_Spin> createState() => _SpinState();
}

class _SpinState extends State<_Spin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Motion.reduced(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}
