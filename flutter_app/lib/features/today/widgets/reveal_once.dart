// A block below the fold that draws itself in once, the first time it comes into view (D52 motion:
// the timeline's nodes, the marks line). Its own length, so each block keeps the timing the design
// gives it. It runs once per page life and never loops; under reduced motion it is complete from
// the first frame, so everything is in place at once.
import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

class RevealOnce extends StatefulWidget {
  const RevealOnce({super.key, required this.length, required this.builder});

  final Duration length;

  /// Builds the block from its 0 to 1 progress (linear; the block applies its own curves).
  final Widget Function(BuildContext context, Animation<double> progress) builder;

  @override
  State<RevealOnce> createState() => _RevealOnceState();
}

class _RevealOnceState extends State<RevealOnce> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: widget.length);
  ScrollPosition? _position;
  bool _decided = false;

  /// How far into the viewport the block's top must come before it plays.
  static const double _threshold = 72;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_decided && Motion.reduced(context)) {
      _decided = true;
      _t.value = 1;
    }
    if (_decided) return;
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_check);
      _position = position?..addListener(_check);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  void _check() {
    if (_decided || !mounted) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return;
    final viewport = _position?.context.storageContext.findRenderObject();
    var top = 0.0;
    var bottom = double.infinity;
    if (viewport is RenderBox && viewport.attached && viewport.hasSize) {
      top = box.localToGlobal(Offset.zero, ancestor: viewport).dy;
      bottom = viewport.size.height;
    }
    if (top < bottom - _threshold) {
      _decided = true;
      _position?.removeListener(_check);
      _position = null;
      _t.forward();
    }
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _t);
}
