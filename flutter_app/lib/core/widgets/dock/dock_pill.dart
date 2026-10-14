import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/edge_light.dart';
import '../materials/glass_surface.dart';
import '../materials/lit_edge.dart';
import '../pressable.dart';
import 'dock_tabs.dart';

/// The tab half of the split glass dock: a glass pill with three labelled tabs and a liquid lit
/// tile. On a switch the tile's two edges travel on two springs: the leading edge on a quick one
/// ([Springs.edgeLead]), the trailing edge on a slower one ([Springs.edgeTrail]), so the tile
/// stretches toward the new tab (and thins a little as it stretches), then gathers itself. As it
/// lands the tab's icon pops in with its own small gesture and its answer bubble inks in the
/// direction the tile travelled. Drag across the pill to scrub tabs: a `selectionClick` on each
/// crossing, and the tab under the finger opens on release.
class DockPill extends ConsumerStatefulWidget {
  const DockPill({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.showReviewDot = false,
    this.slotWidth = 88,
  });

  final int currentIndex;

  /// Called for every tap, including a re-tap of the current tab.
  final ValueChanged<int> onTap;

  /// A volt dot on Review while a received result has not been opened.
  final bool showReviewDot;
  final double slotWidth;

  static const double pad = 6;

  double get width => slotWidth * kMmTabs.length + pad * 2;

  @override
  ConsumerState<DockPill> createState() => _DockPillState();
}

class _DockPillState extends ConsumerState<DockPill> with TickerProviderStateMixin {
  // The tile's left and right edges, in slots: the tile spans [left, right + 1].
  late final AnimationController _left = AnimationController.unbounded(vsync: this, value: widget.currentIndex.toDouble());
  late final AnimationController _right = AnimationController.unbounded(vsync: this, value: widget.currentIndex.toDouble());
  late final Listenable _edges = Listenable.merge([_left, _right]);
  bool _dragging = false;
  int _shown = 0;
  Offset _inkFrom = Offset.zero;

  double get _x => (_left.value + _right.value) / 2;

  @override
  void initState() {
    super.initState();
    _shown = widget.currentIndex;
  }

  @override
  void didUpdateWidget(DockPill oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex != oldWidget.currentIndex && !_dragging) _glideTo(widget.currentIndex);
  }

  @override
  void dispose() {
    _left.dispose();
    _right.dispose();
    super.dispose();
  }

  void _glideTo(int index, {double velocity = 0}) {
    final target = index.toDouble();
    final rightward = target > _x;
    _inkFrom = Offset(rightward ? -1 : 1, 0);
    setState(() => _shown = index);
    if (Motion.reduced(context)) {
      _left.value = target;
      _right.value = target;
      return;
    }
    // The edge on the side of travel leads; the other follows on a slower spring.
    final lead = rightward ? _right : _left;
    final trail = rightward ? _left : _right;
    lead.animateWith(Motion.spring(Springs.edgeLead, lead.value, target, velocity: velocity == 0 ? lead.velocity : velocity));
    trail.animateWith(Motion.spring(Springs.edgeTrail, trail.value, target, velocity: velocity == 0 ? trail.velocity : velocity * 0.6));
  }

  void _tap(int index) {
    if (index != widget.currentIndex) ref.read(hapticsProvider).selection();
    widget.onTap(index);
  }

  void _dragStart(DragStartDetails d) {
    _dragging = true;
    _left.stop();
    _right.stop();
    final x = _x;
    _left.value = x;
    _right.value = x;
  }

  void _dragUpdate(DragUpdateDetails d) {
    final before = _x.round();
    final next = (_x + d.delta.dx / widget.slotWidth).clamp(0.0, kMmTabs.length - 1.0);
    _left.value = next;
    _right.value = next;
    final after = next.round();
    if (after != before) {
      ref.read(hapticsProvider).selection();
      setState(() => _shown = after);
    }
  }

  void _dragEnd(DragEndDetails d) {
    _dragging = false;
    final velocity = d.velocity.pixelsPerSecond.dx / widget.slotWidth;
    final target = (_x + velocity * 0.08).round().clamp(0, kMmTabs.length - 1);
    _glideTo(target, velocity: velocity);
    if (target != widget.currentIndex) widget.onTap(target);
  }

  @override
  Widget build(BuildContext context) {
    final slot = widget.slotWidth;
    final colors = context.mmColors;
    final tile = Positioned.fill(
      child: IgnorePointer(
        child: RepaintBoundary(
          child: CustomPaint(
            painter: _LiquidTilePainter(
              left: _left,
              right: _right,
              slot: slot,
              repaint: _edges,
              fill: colors.litTile,
              edgeTop: colors.edgeTop,
              edgeBottom: colors.edgeBottom,
              volt: colors.isNight ? colors.volt : colors.accentText,
            ),
          ),
        ),
      ),
    );

    return GestureDetector(
      onHorizontalDragStart: _dragStart,
      onHorizontalDragUpdate: _dragUpdate,
      onHorizontalDragEnd: _dragEnd,
      onHorizontalDragCancel: () {
        _dragging = false;
        _glideTo(widget.currentIndex);
      },
      child: GlassSurface(
        role: GlassRole.dock,
        borderRadius: MmRadius.pillAll,
        child: SizedBox(
          width: widget.width,
          height: MmDock.height,
          child: Padding(
            padding: const EdgeInsets.all(DockPill.pad),
            child: Stack(
              children: [
                tile,
                Row(
                  children: [
                    for (var i = 0; i < kMmTabs.length; i++)
                      SizedBox(
                        width: slot,
                        child: _DockTab(
                          index: i,
                          tab: kMmTabs[i],
                          active: i == _shown,
                          inkFrom: _inkFrom,
                          showDot: i == 2 && widget.showReviewDot,
                          semanticsLabel: tabSemanticsLabel(i, newResult: i == 2 && widget.showReviewDot),
                          onTap: () => _tap(i),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The lit tile, painted straight onto the pill between its two edges: a soft white pane with
/// its own edge light and the volt top edge. As it stretches past one slot it thins a little
/// (up to 8%), so it reads as a drop of light, not a sliding block. No layout per frame.
class _LiquidTilePainter extends CustomPainter {
  _LiquidTilePainter({
    required this.left,
    required this.right,
    required this.slot,
    required this.fill,
    required this.edgeTop,
    required this.edgeBottom,
    required this.volt,
    required Listenable repaint,
  }) : super(repaint: repaint);

  final Animation<double> left;
  final Animation<double> right;
  final double slot;
  final Color fill;
  final Color edgeTop;
  final Color edgeBottom;
  final Color volt;

  @override
  void paint(Canvas canvas, Size size) {
    final l = math.min(left.value, right.value);
    final r = math.max(left.value, right.value);
    final width = (r - l + 1) * slot;
    final stretch = ((width / slot) - 1).clamp(0.0, 1.0);
    final height = size.height * (1 - 0.08 * stretch);
    final rect = Rect.fromLTWH(l * slot, (size.height - height) / 2, width, height);
    canvas.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(height / 2)), Paint()..color = fill);

    canvas.save();
    canvas.translate(rect.left, rect.top);
    final local = rect.size;
    EdgeLightPainter(borderRadius: MmRadius.pillAll, top: edgeTop, bottom: edgeBottom.withValues(alpha: 0), sheen: false)
        .paint(canvas, local);
    // The edge follows the tile's own corner (half its height), so the light wraps the shoulder
    // instead of cutting across it, at every stretch of the travel.
    LitEdgePainter(color: volt, radius: local.height / 2, width: 1.5, wrap: 0.4).paint(canvas, local);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_LiquidTilePainter old) =>
      old.left != left ||
      old.right != right ||
      old.slot != slot ||
      old.fill != fill ||
      old.edgeTop != edgeTop ||
      old.edgeBottom != edgeBottom ||
      old.volt != volt;
}

class _DockTab extends StatefulWidget {
  const _DockTab({
    required this.index,
    required this.tab,
    required this.active,
    required this.inkFrom,
    required this.showDot,
    required this.semanticsLabel,
    required this.onTap,
  });

  /// Which tab (0 Today, 1 Practice, 2 Review): each icon has its own arrival gesture.
  final int index;
  final MmTab tab;
  final bool active;
  final Offset inkFrom;
  final bool showDot;
  final String semanticsLabel;
  final VoidCallback onTap;

  /// The answer bubble's diameter.
  static const double bubble = 24;

  @override
  State<_DockTab> createState() => _DockTabState();
}

/// As the lit tile lands, the tab's answer bubble inks: a 24 dp volt circle that grows in from
/// the side the tile came from ([_DockTab.inkFrom]) and fades as it fills, leaving the filled
/// icon. Under reduced motion there is no ink, only the icon swap.
class _DockTabState extends State<_DockTab> with TickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: Motion.ui, value: 1);

  /// The icon's arrival: 0 just switched, 1 at rest (the dock spring overshoots a little).
  late final AnimationController _pop = AnimationController.unbounded(vsync: this, value: 1);

  @override
  void didUpdateWidget(_DockTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      if (Motion.reduced(context)) {
        _ink.value = 1;
        _pop.value = 1;
      } else {
        _ink.forward(from: 0);
        _pop.value = 0;
        _pop.animateWith(Motion.spring(Springs.iconPop, 0, 1));
      }
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    _pop.dispose();
    super.dispose();
  }

  /// Each tab's own arrival: Today's sun-moon turns in, Practice's pen writes a short stroke,
  /// Review's checks drop in. [v] runs 0 to 1 (and a touch past it on the spring).
  Matrix4 _gesture(double v) {
    final rest = 1 - v;
    final scale = 0.82 + 0.18 * v;
    final (dx, dy, turn) = switch (widget.index) {
      0 => (0.0, 0.0, -0.5 * rest),
      1 => (-3 * rest, 2 * rest, 0.32 * rest),
      _ => (0.0, -5 * rest, 0.0),
    };
    return Matrix4.translationValues(dx, dy, 0)
      ..multiply(Matrix4.rotationZ(turn))
      ..multiply(Matrix4.diagonal3Values(scale, scale, 1));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final tab = widget.tab;
    final active = widget.active;
    final ink = colors.isNight ? colors.volt : colors.accentText;
    final icon = Icon(active ? tab.activeIcon : tab.icon, key: ValueKey(active), size: 24, color: active ? colors.ink : colors.ink2);

    return MmPressable(
      semanticsLabel: widget.semanticsLabel,
      selected: active,
      pressedScale: 0.94,
      onTap: widget.onTap,
      builder: (context, pressed, _) => SizedBox.expand(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 32,
              height: 24,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  // The ink, behind the icon; idle (nothing drawn) once it has filled.
                  Positioned.fill(
                    child: IgnorePointer(
                      child: AnimatedBuilder(
                        animation: _ink,
                        builder: (context, _) {
                          final t = _ink.value;
                          if (t >= 1 || reduced) return const SizedBox.shrink();
                          final grow = Motion.glide.transform(t);
                          // Inks in over the first third, then fades as the filled icon lands.
                          final alpha = 0.5 * (t < 0.35 ? t / 0.35 : (1 - t) / 0.65);
                          return Center(
                            child: Transform.translate(
                              offset: Offset(widget.inkFrom.dx * 8 * (1 - grow), 0),
                              child: Transform.scale(
                                scale: 0.3 + 0.7 * grow,
                                alignment: Alignment(widget.inkFrom.dx, 0),
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: ink.withValues(alpha: alpha),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const SizedBox.square(dimension: _DockTab.bubble),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  AnimatedBuilder(
                    animation: _pop,
                    builder: (context, child) => Transform(
                      transform: _gesture(_pop.value),
                      alignment: Alignment.center,
                      child: child,
                    ),
                    // Reduced motion swaps the outline for the filled icon in place (a switcher
                    // would still play out the fade it started before the setting changed).
                    child: reduced
                        ? icon
                        : AnimatedSwitcher(
                            duration: Motion.ui,
                            switchInCurve: Motion.glide,
                            switchOutCurve: Motion.exit,
                            transitionBuilder: (child, animation) => FadeTransition(opacity: animation, child: child),
                            child: icon,
                          ),
                  ),
                  if (widget.showDot)
                    Positioned(
                      top: -1,
                      right: 0,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.isNight ? colors.volt : colors.accentText,
                          shape: BoxShape.circle,
                          border: Border.all(color: colors.raised, width: 1.5),
                        ),
                        child: const SizedBox.square(dimension: 9),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            // Shrinks rather than clips on narrow phones with large text. The pill and its volt
            // arc mark the active tab; the label carries no dot of its own.
            FittedBox(
              fit: BoxFit.scaleDown,
              child: MediaQuery.withClampedTextScaling(
                maxScaleFactor: 1.2,
                child: Text(
                  tab.label,
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: type.navLabel.copyWith(color: active ? colors.ink : colors.ink2, fontWeight: active ? FontWeight.w600 : null),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
