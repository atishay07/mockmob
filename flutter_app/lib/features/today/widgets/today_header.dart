// Today's masthead (TODAY-1017 4.1): the date line and a greeting by first name, the account
// avatar on the left. No Mobi here and no week: the week is "This week" under the move. When
// Today shows what it last loaded, a quiet time line takes the date line's place, so a Wi-Fi flip
// never moves the page (audit T6).
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/account/account_avatar.dart' show AccountLeading;
import '../copy.dart';
import '../logic/today_model.dart';
import 'today_entrance.dart';

class TodayHeader extends StatefulWidget {
  const TodayHeader({super.key, required this.header, this.onWeek, this.aim, this.bleed = 0, this.onRefresh, this.refreshing = false});

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
    // The date line and the greeting, with the account avatar on the left (L16). No Mobi in the
    // header (TODAY-1017 4.6), and the week moved under the move as "This week" (4.3).
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
  });

  final VoidCallback? onRefresh;

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
                  AnimatedSwitcher(
                    duration: Motion.of(context, Motion.crossFade),
                    layoutBuilder: (current, previous) => Stack(
                      alignment: Alignment.centerLeft,
                      children: [...previous, ?current],
                    ),
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
                                child: Text(
                                  updatedLine!,
                                  style: type.caption.copyWith(
                                    color: colors.ink2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
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
        ],
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
