import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Gives a line shorter than a finger a taller touch band without growing the line, so nothing
/// below it moves: a point up to [vertical] dp above or below the child is handed to the child at
/// its nearest edge. Whatever the child holds there (a control that spans the line's height)
/// takes the tap.
///
/// Siblings keep priority where they overlap the band only if they are hit-tested first: in a
/// `Column` that is every child after this one (a column tests its last child first). Turn it
/// off ([vertical] 0) when the line holds nothing that needs the larger target.
class TapSlop extends SingleChildRenderObjectWidget {
  const TapSlop({super.key, required this.vertical, super.child});

  final double vertical;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderTapSlop(vertical);

  @override
  void updateRenderObject(BuildContext context, RenderTapSlop renderObject) => renderObject.vertical = vertical;
}

class RenderTapSlop extends RenderProxyBox {
  RenderTapSlop(this.vertical);

  double vertical;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    if (size.contains(position) || vertical <= 0) return super.hitTest(result, position: position);
    if (position.dx < 0 || position.dx >= size.width || position.dy < -vertical || position.dy >= size.height + vertical) return false;
    final inside = Offset(position.dx, position.dy.clamp(0.0, size.height - 0.5));
    if (!hitTestChildren(result, position: inside)) return false;
    result.add(BoxHitTestEntry(this, inside));
    return true;
  }
}
