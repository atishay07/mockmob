// The row of covers and the pager under it (the web's ExploreCovers.jsx row, `.fxc-row` and `.fxc-pager`, phone band): a
// snapping row on the 16 dp gutter, one cover with the next one peeking 60 dp, and under it "3 of 14" between a previous
// and a next key (48 dp round keys, so the row never needs a swipe).
//
// The row is a horizontal list that comes to rest on a cover's start (the web's scroll-snap-align: start): the first cover
// starts on the gutter, the last ends on it, and a cover and the 12 dp after it are one step. A list, not a PageView: a
// PageView centres its pages in the viewport, so it cannot start on the gutter and end on it with 12 dp between covers.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';
import '../../../core/widgets/skeleton.dart';
import 'cover_card.dart';
import 'explore_copy.dart';

/// The covers and their pager. [onOpen] gets the cover and where it stands in the row (from 0).
///
/// First visit cue (R2 ruling 7, LK29): with [nudge] on, 0.9 s after the covers land the row slides 24 dp toward the next cover (420
/// ms out, 380 ms back) and settles, so a first-timer sees that covers page sideways. [onNudged] is told when it plays (the caller
/// remembers it, so it is once per phone); a touch or a scroll first cancels it, and reduced motion never plays it.
class ExploreCovers extends StatefulWidget {
  const ExploreCovers({super.key, required this.views, required this.onOpen, this.label, this.nudge = false, this.onNudged});

  final List<CoverView> views;
  final void Function(CoverView view, int index) onOpen;

  /// Play the first-visit nudge once the covers are on screen.
  final bool nudge;
  final VoidCallback? onNudged;

  /// The nudge's own timings and distance.
  static const Duration nudgeDelay = Duration(milliseconds: 900);
  static const Duration nudgeOut = Duration(milliseconds: 420);
  static const Duration nudgeBack = Duration(milliseconds: 380);
  static const double nudgePx = 24;

  /// What a screen reader calls the row ("Accountancy chapter feeds").
  final String? label;

  /// The row's list, for a test to scroll.
  static const Key rowKey = ValueKey<String>('explore-covers');

  @override
  State<ExploreCovers> createState() => _ExploreCoversState();
}

class _ExploreCoversState extends State<ExploreCovers> {
  final ScrollController _scroll = ScrollController();

  /// The cover in view, from 0 (the pager's number).
  final ValueNotifier<int> _index = ValueNotifier<int>(0);

  /// A cover and the gap after it, as laid out now.
  double _step = 0;

  Timer? _nudgeTimer;
  bool _nudgeOver = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_track);
    if (widget.nudge) _nudgeTimer = Timer(ExploreCovers.nudgeDelay, () => unawaited(_runNudge()));
  }

  @override
  void didUpdateWidget(ExploreCovers old) {
    super.didUpdateWidget(old);
    if (widget.nudge && !old.nudge && !_nudgeOver && _nudgeTimer == null) _nudgeTimer = Timer(ExploreCovers.nudgeDelay, () => unawaited(_runNudge()));
  }

  @override
  void dispose() {
    _nudgeOver = true;
    _nudgeTimer?.cancel();
    _scroll.dispose();
    _index.dispose();
    super.dispose();
  }

  /// A touch or a scroll first ends the nudge for good.
  void _cancelNudge() {
    _nudgeOver = true;
    _nudgeTimer?.cancel();
  }

  /// The nudge: only when a cover waits past the right edge, the row has not been moved, and motion is not reduced.
  Future<void> _runNudge() async {
    if (!mounted || _nudgeOver || Motion.reduced(context) || !_scroll.hasClients) return;
    final p = _scroll.position;
    if (!p.hasContentDimensions || p.pixels > 2 || p.maxScrollExtent <= 2) return;
    _nudgeOver = true;
    widget.onNudged?.call();
    await _scroll.animateTo(ExploreCovers.nudgePx, duration: ExploreCovers.nudgeOut, curve: Motion.out);
    if (!mounted || !_scroll.hasClients || _scroll.offset > ExploreCovers.nudgePx + 2) return;
    await _scroll.animateTo(0, duration: ExploreCovers.nudgeBack, curve: Motion.out);
  }

  /// The cover in view: the one the row has moved nearest to, and the last one once the row cannot go further (the web's
  /// `measure`).
  void _track() {
    if (!_scroll.hasClients || _step <= 0) return;
    final p = _scroll.position;
    if (!p.hasContentDimensions) return;
    final last = widget.views.length - 1;
    final at = p.maxScrollExtent > 2 && p.pixels >= p.maxScrollExtent - 2 ? last : (p.pixels / _step).round().clamp(0, last);
    if (at != _index.value) _index.value = at;
  }

  /// A key of the pager: the next or the previous cover, on the one curve of the paging (320 ms); at once when motion is
  /// reduced.
  void _go(int to) {
    if (!_scroll.hasClients || _step <= 0) return;
    final p = _scroll.position;
    final target = (to.clamp(0, widget.views.length - 1) * _step).clamp(p.minScrollExtent, p.maxScrollExtent);
    if (Motion.reduced(context)) {
      _scroll.jumpTo(target);
    } else {
      unawaited(_scroll.animateTo(target, duration: const Duration(milliseconds: 320), curve: Motion.drawer));
    }
  }

  @override
  Widget build(BuildContext context) {
    final views = widget.views;
    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth;
        final coverWidth = CoverLayout.coverWidth(width);
        _step = coverWidth + CoverLayout.gap;
        final size = CoverMetrics.measure(
          views: views,
          coverWidth: coverWidth,
          scaler: MediaQuery.textScalerOf(context),
          styles: CoverStyles.of(context),
        );
        Widget row = SizedBox(
          height: size.height,
          // The covers' shadows fall below the list's own edge: its clip stops at the sides only.
          child: ClipRect(
            clipper: const _RowClip(),
            child: ListView.separated(
              key: ExploreCovers.rowKey,
              controller: _scroll,
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              padding: const EdgeInsets.symmetric(horizontal: CoverLayout.gutter),
              physics: _CoverSnap(step: _step),
              itemCount: views.length,
              separatorBuilder: (context, i) => const SizedBox(width: CoverLayout.gap),
              itemBuilder: (context, i) => SizedBox(
                width: coverWidth,
                child: CoverCard(view: views[i], size: size, position: i, total: views.length, onTap: () => widget.onOpen(views[i], i)),
              ),
            ),
          ),
        );
        row = Listener(
          behavior: HitTestBehavior.translucent,
          onPointerDown: (_) => _cancelNudge(),
          child: NotificationListener<UserScrollNotification>(
            onNotification: (n) {
              if (n.direction != ScrollDirection.idle) _cancelNudge();
              return false;
            },
            child: row,
          ),
        );
        final label = widget.label;
        if (label != null) row = Semantics(container: true, label: label, child: row);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            row,
            const SizedBox(height: 6),
            ValueListenableBuilder<int>(
              valueListenable: _index,
              builder: (context, at, _) => CoverPager(index: at, count: views.length, onPrevious: () => _go(at - 1), onNext: () => _go(at + 1)),
            ),
          ],
        );
      },
    );
  }
}

/// The row's clip: the list's own sides, with room above and below for the covers' shadows.
class _RowClip extends CustomClipper<Rect> {
  const _RowClip();

  @override
  Rect getClip(Size size) => Rect.fromLTRB(0, -12, size.width, size.height + 40);

  @override
  bool shouldReclip(_RowClip old) => false;
}

/// Rests the row on a cover's start (the web's scroll-snap-align: start): a fling goes on to the next cover in its
/// direction, a slow drag settles on the nearest, and the row never rests short of its end. The page's spring.
class _CoverSnap extends ScrollPhysics {
  const _CoverSnap({super.parent, required this.step});

  final double step;

  @override
  _CoverSnap applyTo(ScrollPhysics? ancestor) => _CoverSnap(parent: buildParent(ancestor), step: step);

  @override
  Simulation? createBallisticSimulation(ScrollMetrics position, double velocity) {
    if ((velocity <= 0 && position.pixels <= position.minScrollExtent) || (velocity >= 0 && position.pixels >= position.maxScrollExtent)) {
      return super.createBallisticSimulation(position, velocity);
    }
    final tolerance = toleranceFor(position);
    var at = position.pixels / step;
    if (velocity < -tolerance.velocity) {
      at -= 0.5;
    } else if (velocity > tolerance.velocity) {
      at += 0.5;
    }
    final target = (at.roundToDouble() * step).clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() < tolerance.distance) return null;
    return ScrollSpringSimulation(Springs.settle, position.pixels, target, velocity, tolerance: tolerance);
  }
}

/// "3 of 14" between a previous and a next key. A key at its end is disabled.
class CoverPager extends StatelessWidget {
  const CoverPager({super.key, required this.index, required this.count, required this.onPrevious, required this.onNext});

  /// The cover in view, from 0.
  final int index;
  final int count;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  /// The room the pager takes: 48 dp keys.
  static const double height = 48;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return SizedBox(
      height: height,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _ArrowKey(icon: LucideIcons.chevronLeft, label: ExploreCopy.previous, onTap: index > 0 ? onPrevious : null),
          const SizedBox(width: MmSpace.s8),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 64),
            child: Text(
              ExploreCopy.pager(index + 1, count),
              textAlign: TextAlign.center,
              style: type.labelLarge.copyWith(fontSize: 13.5, height: 1.2, fontWeight: FontWeight.w600, color: colors.ink2),
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          _ArrowKey(icon: LucideIcons.chevronRight, label: ExploreCopy.next, onTap: index < count - 1 ? onNext : null),
        ],
      ),
    );
  }
}

/// A round key of the pager: 48 dp, the raised surface with a strong line, a 20 dp chevron in the second ink; at 38% when
/// it cannot go further.
class _ArrowKey extends StatelessWidget {
  const _ArrowKey({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return AnimatedOpacity(
      opacity: onTap == null ? 0.38 : 1,
      duration: Motion.of(context, const Duration(milliseconds: 150)),
      curve: Motion.out,
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        pressedScale: 0.94,
        focusRadius: BorderRadius.circular(24),
        semanticsLabel: label,
        builder: (context, pressed, _) => Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: ShapeDecoration(
            color: pressed ? colors.raised2 : colors.raised,
            shape: CircleBorder(side: BorderSide(color: colors.lineStrong)),
          ),
          child: Icon(icon, size: 20, color: colors.ink2),
        ),
      ),
    );
  }
}

/// The covers while they load, at the size of the real ones: five covers, the sixth cut by the screen's edge as the
/// web's skeleton row is, and the room of the pager. Static (the group's shimmer is the app's own switch).
class ExploreCoversSkeleton extends StatelessWidget {
  const ExploreCoversSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final scale = MediaQuery.textScalerOf(context).scale(1);
    final height = CoverLayout.baseHeight * (scale > 1 ? scale : 1);
    return SkeletonGroup(
      label: ExploreCopy.loading,
      child: LayoutBuilder(
        builder: (context, box) {
          final cover = CoverLayout.coverWidth(box.maxWidth);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: height,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(left: CoverLayout.gutter),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < 5; i++) ...[
                        if (i > 0) const SizedBox(width: CoverLayout.gap),
                        SizedBox(width: cover, child: CoverSkeleton(height: height)),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6 + CoverPager.height),
            ],
          );
        },
      ),
    );
  }
}
