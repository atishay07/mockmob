import 'package:flutter/widgets.dart';

/// Where the last opened page or sheet should grow from: the global rect of the surface the
/// student tapped. `MmPressable(captureLaunch: true)` records it on tap; the container transform
/// (`MmTransition.container`) takes it once. A rect older than [maxAge] is ignored, so a page
/// opened by a link or a notification never grows out of a stale card.
abstract final class MmLaunchRect {
  static Rect? _rect;
  static DateTime? _at;

  static const Duration maxAge = Duration(seconds: 1);

  /// Records [context]'s render box as the launch rect.
  static void capture(BuildContext context) {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) return;
    set(box.localToGlobal(Offset.zero) & box.size);
  }

  static void set(Rect rect) {
    _rect = rect;
    _at = DateTime.now();
  }

  /// The recorded rect if it is fresh, and forgets it.
  static Rect? take() {
    final rect = peek();
    _rect = null;
    _at = null;
    return rect;
  }

  /// The recorded rect if it is fresh, without forgetting it.
  static Rect? peek() {
    final at = _at;
    if (_rect == null || at == null || DateTime.now().difference(at) > maxAge) return null;
    return _rect;
  }
}
