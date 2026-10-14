import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Extends a control's touch target past its painted size without taking layout space.
///
/// A chip, a quiet key, a "Show me" pill and a segmented track are drawn at their visual size
/// (40, 40, 32 and 44 dp) so the gaps around them are the gaps the spec codes, and still answer a
/// finger anywhere in a 48 dp box (SPACING.md 3.3, audit G7). Before this each of them was laid out
/// as a 48 dp box with a smaller face inside, which added about 8 dp of phantom gap above and below
/// every one.
///
/// A touch that lands in the [slop] band outside the child is passed to the child as if it had
/// landed on its nearest edge, so the child's own gesture handling (press spring, tap) runs
/// unchanged. The semantics node is inflated by the same amount, so TalkBack and the Android
/// tap-target guideline see the full box. The slop band must lie inside the parent's own bounds
/// (it always does in a card or a column with a gap); a band outside the parent is not reachable.
class MmHitSlop extends SingleChildRenderObjectWidget {
  const MmHitSlop({super.key, this.slop = const EdgeInsets.symmetric(vertical: 4), required Widget child})
    : super(child: child);

  /// A control whose visual height is [visual] dp inside a [target] dp box (48 by default).
  factory MmHitSlop.toTarget({Key? key, required double visual, double target = 48, required Widget child}) {
    final extra = ((target - visual) / 2).clamp(0.0, 24.0);
    return MmHitSlop(
      key: key,
      slop: EdgeInsets.symmetric(vertical: extra),
      child: child,
    );
  }

  /// How far the target reaches past each edge of the child.
  final EdgeInsets slop;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderMmHitSlop(slop);

  @override
  void updateRenderObject(BuildContext context, RenderMmHitSlop renderObject) => renderObject.slop = slop;
}

class RenderMmHitSlop extends RenderProxyBox {
  RenderMmHitSlop(this._slop);

  EdgeInsets _slop;
  EdgeInsets get slop => _slop;
  set slop(EdgeInsets value) {
    if (value == _slop) return;
    _slop = value;
    markNeedsSemanticsUpdate();
  }

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    if (size.contains(position)) return super.hitTest(result, position: position);
    final reach = _slop.inflateRect(Offset.zero & size);
    if (!reach.contains(position)) return false;
    // Hand the child the nearest point on its own edge, so its gesture handling runs unchanged.
    final inside = Offset(position.dx.clamp(0.0, size.width - 0.01), position.dy.clamp(0.0, size.height - 0.01));
    return result.addWithRawTransform(
      transform: Matrix4.translationValues(inside.dx - position.dx, inside.dy - position.dy, 0),
      position: position,
      hitTest: (result, position) => super.hitTest(result, position: position),
    );
  }

  @override
  Rect get semanticBounds => _slop.inflateRect(Offset.zero & size);

  @override
  void describeSemanticsConfiguration(SemanticsConfiguration config) {
    super.describeSemanticsConfiguration(config);
    if (_slop == EdgeInsets.zero) return;
    // One node, as big as the touch target, carrying what the child says.
    config
      ..isSemanticBoundary = true
      ..isMergingSemanticsOfDescendants = true;
  }
}
