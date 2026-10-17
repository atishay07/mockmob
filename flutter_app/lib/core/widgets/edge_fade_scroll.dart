import 'package:flutter/widgets.dart';

/// A vertical scroll view whose edges dissolve when content runs past them, so a row cut off by a
/// sheet's bottom reads as "more here" instead of being sliced (v13 device walk, FS13: at 1.3x
/// text the Start sheet's mode tiles ended at the sheet's edge with no cue). At rest with
/// everything visible nothing is faded. The same rule as the body of `showMmSheet`.
class MmEdgeFadeScroll extends StatefulWidget {
  const MmEdgeFadeScroll({super.key, required this.child, this.topExtent = 24, this.bottomExtent = 32});

  final Widget child;

  /// How far the top and the bottom edges dissolve while more content waits past them.
  final double topExtent;
  final double bottomExtent;

  @override
  State<MmEdgeFadeScroll> createState() => _MmEdgeFadeScrollState();
}

class _MmEdgeFadeScrollState extends State<MmEdgeFadeScroll> {
  bool _above = false;
  bool _below = false;

  bool _onMetrics(ScrollMetrics m) {
    if (m.axis != Axis.vertical) return false;
    final above = m.extentBefore > 0.5;
    final below = m.extentAfter > 0.5;
    if (above != _above || below != _below) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _above = above;
          _below = below;
        });
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final scroll = NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
        child: SingleChildScrollView(child: widget.child),
      ),
    );
    // Always the mask, even with nothing to fade: swapping it in and out would rebuild the scroll
    // view and throw away its position mid-scroll.
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        final top = (widget.topExtent / rect.height).clamp(0.0, 0.5);
        final bottom = (widget.bottomExtent / rect.height).clamp(0.0, 0.5);
        const clear = Color(0x00FFFFFF);
        const solid = Color(0xFFFFFFFF);
        return LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_above ? clear : solid, solid, solid, _below ? clear : solid],
          stops: [0, top, 1 - bottom, 1],
        ).createShader(rect);
      },
      child: scroll,
    );
  }
}
