import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/glass_surface.dart';
import '../pressable.dart';
import 'dock_tabs.dart';
import 'lit_tile.dart';

/// The tab half of the split glass dock: a glass pill with three labelled tabs and a lit tile
/// that slides to the active one on a spring (360 ms, bounce 0.18), stretching up to 1.15x with
/// its velocity. As the tile lands the tab's answer bubble inks in the direction it travelled.
/// Drag across the pill to scrub tabs: a `selectionClick` on each crossing, and the tab under the
/// finger opens on release.
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

class _DockPillState extends ConsumerState<DockPill> with SingleTickerProviderStateMixin {
  late final AnimationController _x = AnimationController.unbounded(vsync: this, value: widget.currentIndex.toDouble());
  bool _dragging = false;
  int _shown = 0;
  Offset _inkFrom = Offset.zero;

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
    _x.dispose();
    super.dispose();
  }

  void _glideTo(int index, {double velocity = 0}) {
    _inkFrom = Offset(index > _x.value ? -1 : 1, 0);
    setState(() => _shown = index);
    if (Motion.reduced(context)) {
      _x.value = index.toDouble();
      return;
    }
    _x.animateWith(Motion.spring(Springs.dock, _x.value, index.toDouble(), velocity: velocity == 0 ? _x.velocity : velocity));
  }

  void _tap(int index) {
    if (index != widget.currentIndex) ref.read(hapticsProvider).selection();
    widget.onTap(index);
  }

  void _dragStart(DragStartDetails d) {
    _dragging = true;
    _x.stop();
  }

  void _dragUpdate(DragUpdateDetails d) {
    final before = _x.value.round();
    _x.value = (_x.value + d.delta.dx / widget.slotWidth).clamp(0.0, kMmTabs.length - 1.0);
    final after = _x.value.round();
    if (after != before) {
      ref.read(hapticsProvider).selection();
      setState(() => _shown = after);
    }
  }

  void _dragEnd(DragEndDetails d) {
    _dragging = false;
    final velocity = d.velocity.pixelsPerSecond.dx / widget.slotWidth;
    final target = (_x.value + velocity * 0.08).round().clamp(0, kMmTabs.length - 1);
    _glideTo(target, velocity: velocity);
    if (target != widget.currentIndex) widget.onTap(target);
  }

  @override
  Widget build(BuildContext context) {
    final slot = widget.slotWidth;
    final tile = AnimatedBuilder(
      animation: _x,
      builder: (context, child) {
        // Squash and stretch: wider while moving fast, never more than 1.15x.
        final stretch = 1 + (_x.velocity.abs() * 0.03).clamp(0.0, 0.15);
        return Transform(
          transform: Matrix4.translationValues(_x.value * slot, 0, 0)..multiply(Matrix4.diagonal3Values(stretch, 2 - stretch * 0.6 - 0.4, 1)),
          alignment: Alignment.center,
          child: child,
        );
      },
      child: SizedBox(width: slot, height: MmDock.height - DockPill.pad * 2, child: const RepaintBoundary(child: LitTile())),
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
                Positioned(left: 0, top: 0, bottom: 0, child: tile),
                Row(
                  children: [
                    for (var i = 0; i < kMmTabs.length; i++)
                      SizedBox(
                        width: slot,
                        child: _DockTab(
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

class _DockTab extends StatefulWidget {
  const _DockTab({
    required this.tab,
    required this.active,
    required this.inkFrom,
    required this.showDot,
    required this.semanticsLabel,
    required this.onTap,
  });

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
class _DockTabState extends State<_DockTab> with SingleTickerProviderStateMixin {
  late final AnimationController _ink = AnimationController(vsync: this, duration: Motion.ui, value: 1);

  @override
  void didUpdateWidget(_DockTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      if (Motion.reduced(context)) {
        _ink.value = 1;
      } else {
        _ink.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    _ink.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final tab = widget.tab;
    final active = widget.active;
    final ink = colors.isNight ? colors.volt : colors.accentText;

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
                  AnimatedSwitcher(
                    duration: reduced ? Duration.zero : Motion.ui,
                    switchInCurve: Motion.glide,
                    switchOutCurve: Motion.exit,
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: ScaleTransition(scale: Tween(begin: 0.92, end: 1.0).animate(animation), child: child),
                    ),
                    child: Icon(
                      active ? tab.activeIcon : tab.icon,
                      key: ValueKey(active),
                      size: 24,
                      color: active ? colors.ink : colors.ink2,
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
