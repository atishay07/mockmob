import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart' show SpringSimulation;

import '../theme/theme.dart';
import 'motion.dart';

/// Moves art against the scroll: as its box travels up the viewport the child drifts down by
/// [factor] of its height, so the art sits deeper than the card it lives in. A `Flow` repaints
/// on scroll and never re-lays out. The child is laid out [factor] taller than the box and
/// clipped. Outside a scrollable, or under reduced motion, it is just the child.
///
/// With [lean] it also gives its art a tilt signal: [MmScrollLean] of the list it moves in, which
/// an object inside reads with [MmParallax.leanOf] to lean toward the scroll (the art tilts
/// itself; the parallax only translates).
///
/// Use it for art plates and light fields inside hero cards, never for text.
class MmParallax extends StatelessWidget {
  const MmParallax({super.key, required this.child, this.factor = 0.18, this.lean = false});

  final Widget child;

  /// Share of the box's height the child travels across the whole viewport.
  final double factor;

  /// Publish the scroll's lean to the art inside ([leanOf]).
  final bool lean;

  /// The lean of the list the nearest [MmParallax] with [lean] moves in, or null.
  static ValueListenable<double>? leanOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_LeanScope>()?.lean;

  @override
  Widget build(BuildContext context) {
    final scrollable = Scrollable.maybeOf(context);
    if (scrollable == null || Motion.reduced(context)) return child;
    final art = lean ? _LeanHost(child: child) : child;
    if (factor == 0) return art;
    return ClipRect(
      child: Flow(
        delegate: _ParallaxDelegate(scrollable: scrollable, item: context, factor: factor),
        children: [art],
      ),
    );
  }
}

/// How hard the list an object sits in is moving: -1 to 1, positive while the content travels
/// up (the student scrolls down), and back to 0 on [Springs.smooth] once it stops. The object
/// leans with it, so it reads as standing in the room rather than printed on the card.
class MmScrollLean extends ChangeNotifier implements ValueListenable<double> {
  MmScrollLean({required TickerProvider vsync}) : _c = AnimationController.unbounded(vsync: vsync) {
    _c.addListener(notifyListeners);
  }

  final AnimationController _c;
  ScrollPosition? _position;
  double? _last;

  /// Scroll in one frame that leans an object all the way (about 1700 dp a second).
  static const double fullLeanPx = 28;

  /// Follows [position] (null stops following).
  void attach(ScrollPosition? position) {
    if (identical(position, _position)) return;
    _position?.removeListener(_moved);
    _position = position;
    _last = position != null && position.hasPixels ? position.pixels : null;
    position?.addListener(_moved);
  }

  void _moved() {
    final p = _position;
    if (p == null || !p.hasPixels) return;
    final last = _last;
    _last = p.pixels;
    if (last == null) return;
    final target = ((p.pixels - last) / fullLeanPx).clamp(-1.0, 1.0);
    final next = _c.value + (target - _c.value) * 0.5;
    _c.value = next;
    _c.animateWith(SpringSimulation(Springs.smooth, next, 0, 0));
  }

  @override
  double get value => _c.value.clamp(-1.0, 1.0);

  @override
  void dispose() {
    attach(null);
    _c.dispose();
    super.dispose();
  }
}

class _LeanHost extends StatefulWidget {
  const _LeanHost({required this.child});

  final Widget child;

  @override
  State<_LeanHost> createState() => _LeanHostState();
}

class _LeanHostState extends State<_LeanHost> with SingleTickerProviderStateMixin {
  late final MmScrollLean _lean = MmScrollLean(vsync: this);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _lean.attach(Motion.reduced(context) ? null : Scrollable.maybeOf(context)?.position);
  }

  @override
  void dispose() {
    _lean.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _LeanScope(lean: _lean, child: widget.child);
}

class _LeanScope extends InheritedWidget {
  const _LeanScope({required this.lean, required super.child});

  final MmScrollLean lean;

  @override
  bool updateShouldNotify(_LeanScope old) => old.lean != lean;
}

class _ParallaxDelegate extends FlowDelegate {
  _ParallaxDelegate({required this.scrollable, required this.item, required this.factor}) : super(repaint: scrollable.position);

  final ScrollableState scrollable;
  final BuildContext item;
  final double factor;

  @override
  BoxConstraints getConstraintsForChild(int i, BoxConstraints constraints) {
    final height = constraints.maxHeight.isFinite ? constraints.maxHeight * (1 + factor) : constraints.maxHeight;
    return BoxConstraints.tightFor(width: constraints.maxWidth, height: height);
  }

  @override
  void paintChildren(FlowPaintingContext context) {
    final box = item.findRenderObject();
    final viewport = scrollable.context.findRenderObject();
    var dy = 0.0;
    if (box is RenderBox && viewport is RenderBox && box.hasSize && viewport.hasSize && box.attached) {
      final top = box.localToGlobal(Offset.zero, ancestor: viewport).dy;
      // -0.5 when the box's centre is at the viewport's top, 0.5 at its bottom.
      final position = ((top + box.size.height / 2) / viewport.size.height - 0.5).clamp(-0.75, 0.75);
      final travel = context.size.height * factor;
      dy = -travel / 2 - position * travel;
    }
    context.paintChild(0, transform: Matrix4.translationValues(0, dy, 0));
  }

  @override
  bool shouldRepaint(_ParallaxDelegate old) => old.scrollable != scrollable || old.factor != factor || old.item != item;
}

/// A header at the top of a scrolling list that drifts up at half speed and fades out over its
/// first [distance] of scroll, for a hero or a greeting sitting above the content. Must be built
/// inside the scrollable. Under reduced motion it is just the child.
class MmScrollFadeHeader extends StatelessWidget {
  const MmScrollFadeHeader({super.key, required this.child, this.distance = 160, this.drift = 0.5});

  final Widget child;
  final double distance;

  /// The share of the scroll it moves back down by, so it leaves more slowly than the list.
  final double drift;

  @override
  Widget build(BuildContext context) {
    final scrollable = Scrollable.maybeOf(context);
    if (scrollable == null || Motion.reduced(context)) return child;
    final position = scrollable.position;
    return AnimatedBuilder(
      animation: position,
      child: child,
      builder: (context, child) {
        final pixels = position.hasPixels ? position.pixels.clamp(0.0, distance) : 0.0;
        final t = distance == 0 ? 0.0 : pixels / distance;
        return Transform.translate(
          offset: Offset(0, pixels * drift),
          child: Opacity(opacity: (1 - t).clamp(0.0, 1.0), child: child),
        );
      },
    );
  }
}

/// The large-title header for a screen built from slivers: the title, in the Bricolage title cut
/// at full size under the status bar, shrinks toward a compact bar as the list scrolls; once the
/// large title has gone the bar's ground fills in with a hairline under it, so content never
/// reads through. Transform and fade only; the bar is pinned.
///
/// ```dart
/// CustomScrollView(slivers: [
///   MmCollapsingTitle(title: 'Review'),
///   ...
/// ])
/// ```
class MmCollapsingTitle extends StatelessWidget {
  const MmCollapsingTitle({super.key, required this.title, this.overline, this.leading, this.trailing, this.gutter = MmSpace.gutter});

  final String title;
  final String? overline;
  final Widget? leading;
  final Widget? trailing;
  final double gutter;

  /// The compact bar under the status bar.
  static const double barHeight = 56;

  /// The extra room the large title takes below the bar.
  static const double largeHeight = 60;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.viewPaddingOf(context).top;
    return SliverPersistentHeader(
      pinned: true,
      delegate: _CollapsingTitleDelegate(
        top: top,
        title: title,
        overline: overline,
        leading: leading,
        trailing: trailing,
        gutter: gutter,
        reduced: Motion.reduced(context),
        textScale: MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.6),
      ),
    );
  }
}

class _CollapsingTitleDelegate extends SliverPersistentHeaderDelegate {
  _CollapsingTitleDelegate({
    required this.top,
    required this.title,
    required this.overline,
    required this.leading,
    required this.trailing,
    required this.gutter,
    required this.reduced,
    required this.textScale,
  });

  final double top;
  final String title;
  final String? overline;
  final Widget? leading;
  final Widget? trailing;
  final double gutter;
  final bool reduced;
  final double textScale;

  double get _large => MmCollapsingTitle.largeHeight * textScale + (overline == null ? 0 : 20 * textScale);

  @override
  double get minExtent => top + MmCollapsingTitle.barHeight;

  @override
  double get maxExtent => minExtent + _large;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final colors = context.mmColors;
    final type = context.mmType;
    final range = maxExtent - minExtent;
    final t = range <= 0 ? 1.0 : (shrinkOffset / range).clamp(0.0, 1.0);
    // The ground and hairline come in over the last third; the compact title after the large
    // one has mostly gone, so the two are never read at once.
    final fill = reduced ? (t >= 1 ? 1.0 : 0.0) : ((t - 0.66) / 0.34).clamp(0.0, 1.0);
    final compact = reduced ? (t >= 0.9 ? 1.0 : 0.0) : ((t - 0.7) / 0.3).clamp(0.0, 1.0);
    final large = reduced ? (t >= 0.9 ? 0.0 : 1.0) : (1 - t * 1.4).clamp(0.0, 1.0);

    return Stack(
      fit: StackFit.expand,
      children: [
        // The ground fills in under the bar.
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.ground.withValues(alpha: 0.96 * fill),
              border: Border(bottom: BorderSide(color: colors.line.withValues(alpha: fill))),
            ),
          ),
        ),
        // The large title, sliding up and shrinking toward the bar.
        Positioned(
          left: gutter,
          right: gutter,
          bottom: 8,
          child: IgnorePointer(
            ignoring: large < 0.5,
            child: Opacity(
              opacity: large,
              child: Transform.translate(
                offset: Offset(0, reduced ? 0 : -8 * t),
                child: Transform.scale(
                  scale: reduced ? 1 : 1 - 0.12 * t,
                  alignment: Alignment.bottomLeft,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (overline != null) Text(overline!, style: type.caption.copyWith(color: colors.ink2), maxLines: 1),
                      Semantics(
                        header: true,
                        child: Text(title, style: type.screenTitle.copyWith(fontSize: 34, height: 1.1), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        // The bar: leading, compact title, trailing.
        Positioned(
          left: gutter - 4,
          right: gutter - 4,
          top: top,
          height: MmCollapsingTitle.barHeight,
          child: Row(
            children: [
              ?leading,
              const SizedBox(width: MmSpace.s8),
              Expanded(
                child: ExcludeSemantics(
                  child: Opacity(
                    opacity: compact,
                    child: Transform.translate(
                      offset: Offset(0, 6 * (1 - compact)),
                      child: Text(title, style: type.title.copyWith(fontSize: 18), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
        ),
      ],
    );
  }

  @override
  bool shouldRebuild(_CollapsingTitleDelegate old) =>
      old.top != top ||
      old.title != title ||
      old.overline != overline ||
      old.leading != leading ||
      old.trailing != trailing ||
      old.reduced != reduced ||
      old.textScale != textScale ||
      old.gutter != gutter;
}

/// One scroll-to-top for every tab reselect (AP1-12, MOTION.md 5 item 4): from more than 1.5
/// viewports down it jumps to one viewport and glides the rest over 360 ms on Emphasized;
/// otherwise it glides over 300 ms. It never collapses the bar and never replays an entrance
/// (the list only scrolls). Under reduced motion it jumps.
abstract final class MmScroll {
  /// Past this many viewports the trip starts with a jump.
  static const double jumpAfterViewports = 1.5;
  static const Duration longGlide = Duration(milliseconds: 360);
  static const Duration shortGlide = Duration(milliseconds: 300);

  /// Where the trip jumps first (null: no jump) and how long the glide takes.
  static ({double? jumpTo, Duration glide}) planToTop(double pixels, double viewport) =>
      pixels > viewport * jumpAfterViewports ? (jumpTo: viewport, glide: longGlide) : (jumpTo: null, glide: shortGlide);

  static Future<void> toTop(BuildContext context, ScrollController controller) async {
    if (!controller.hasClients) return;
    final position = controller.position;
    if (position.pixels <= position.minScrollExtent) return;
    if (Motion.reduced(context)) {
      controller.jumpTo(position.minScrollExtent);
      return;
    }
    final plan = planToTop(position.pixels - position.minScrollExtent, position.viewportDimension);
    if (plan.jumpTo != null) controller.jumpTo(position.minScrollExtent + plan.jumpTo!);
    await controller.animateTo(position.minScrollExtent, duration: plan.glide, curve: Motion.emphasized);
  }
}
