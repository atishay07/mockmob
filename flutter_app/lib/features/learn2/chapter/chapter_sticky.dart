import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// Holds [child] where it lies in a scroll view until that place would fall below the bottom edge of the view (less
/// [bottomInset], the phone's gesture bar); from there it rides at that edge, for as long as the block named by [container]
/// is on screen, and never above that block's top. The same as CSS `position: sticky; bottom`: the Start key of the chapter
/// page is never under the edge of the screen, and goes away with the block it belongs to.
///
/// Nothing is laid out again as the page scrolls: the strip is painted (and hit-tested, and described to a screen reader)
/// where it rides, from the place the scroll view has put it. It paints over what lies before it in the page and never over
/// what comes after it (those lie below its own place, and the ride only moves it up).
class StickyBottom extends SingleChildRenderObjectWidget {
  const StickyBottom({super.key, required this.container, this.bottomInset = 0, required Widget child}) : super(child: child);

  /// The block the strip belongs to (its place bounds the ride).
  final GlobalKey container;

  /// What the screen keeps for the gesture bar.
  final double bottomInset;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderStickyBottom(container: container, bottomInset: bottomInset);

  @override
  void updateRenderObject(BuildContext context, RenderStickyBottom renderObject) {
    renderObject
      ..container = container
      ..bottomInset = bottomInset;
  }
}

class RenderStickyBottom extends RenderProxyBox {
  RenderStickyBottom({required this._container, required this._bottomInset});

  GlobalKey _container;
  GlobalKey get container => _container;
  set container(GlobalKey value) {
    if (value == _container) return;
    _container = value;
    markNeedsPaint();
  }

  double _bottomInset;
  double get bottomInset => _bottomInset;
  set bottomInset(double value) {
    if (value == _bottomInset) return;
    _bottomInset = value;
    markNeedsPaint();
  }

  /// How far above its own place the strip is painted now (zero or less).
  double _shift = 0;
  double get shift => _shift;

  /// Where the strip rides, from where it lies and where the view's edge is.
  double _computeShift() {
    final RenderObject? viewport = RenderAbstractViewport.maybeOf(this);
    if (viewport is! RenderBox || !viewport.hasSize || !hasSize) return 0;
    final top = localToGlobal(Offset.zero, ancestor: viewport).dy;
    final edge = viewport.size.height - _bottomInset;
    var shift = math.min(0.0, edge - (top + size.height));
    if (shift == 0) return 0;
    final block = _container.currentContext?.findRenderObject();
    if (block is RenderBox && block.attached && block.hasSize) {
      shift = math.max(shift, block.localToGlobal(Offset.zero, ancestor: viewport).dy - top);
    }
    return shift;
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final child = this.child;
    if (child == null) return;
    final before = _shift;
    _shift = _computeShift();
    if (before != _shift) markNeedsSemanticsUpdate();
    context.paintChild(child, offset + Offset(0, _shift));
  }

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    final child = this.child;
    if (child == null || !child.hasSize) return false;
    // The strip answers where it is painted, not where it lies.
    if (!Rect.fromLTWH(0, _shift, size.width, size.height).contains(position)) return false;
    return result.addWithPaintOffset(
      offset: Offset(0, _shift),
      position: position,
      hitTest: (result, transformed) => child.hitTest(result, position: transformed),
    );
  }

  @override
  void applyPaintTransform(RenderObject child, Matrix4 transform) {
    transform.translateByDouble(0, _shift, 0, 1);
  }
}
