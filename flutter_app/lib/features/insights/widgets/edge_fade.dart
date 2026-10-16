import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show SchedulerBinding, SchedulerPhase;

/// Fades the edge of a scroller wherever there is more to scroll to, so a chip, a rail or a long
/// question never ends in a hard cut at the screen edge. The fade shows only on an edge that
/// has more behind it (none at rest on the start edge, none at the very end), and it is a mask,
/// never a coloured band, so it works on any ground and in both themes.
class EdgeFade extends StatefulWidget {
  const EdgeFade({super.key, required this.child, this.axis = Axis.horizontal, this.extent = 28});

  /// The scroll view; it must be this widget's only scrollable.
  final Widget child;
  final Axis axis;

  /// How far the fade reaches in from the edge, in dp.
  final double extent;

  @override
  State<EdgeFade> createState() => _EdgeFadeState();
}

class _EdgeFadeState extends State<EdgeFade> {
  bool _before = false, _after = false;

  bool _update(ScrollMetrics m) {
    if (m.axis != widget.axis || !m.hasContentDimensions) return false;
    final before = m.pixels > m.minScrollExtent + 2;
    final after = m.pixels < m.maxScrollExtent - 2;
    if (before != _before || after != _after) {
      // A scroller can start a settling scroll while it is being laid out (a rail that snaps to
      // its chips does when its size changes), and its notifications arrive then: a rebuild may
      // not be asked for during layout, so it waits for the end of the frame.
      if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
        SchedulerBinding.instance.addPostFrameCallback((_) {
          if (mounted) _apply(before, after);
        });
      } else {
        _apply(before, after);
      }
    }
    return false;
  }

  void _apply(bool before, bool after) {
    if (before == _before && after == _after) return;
    setState(() {
      _before = before;
      _after = after;
    });
  }

  @override
  Widget build(BuildContext context) {
    // The mask is always in the tree (adding it later would rebuild the scroller and lose its
    // place); with nothing to fade it is simply solid.
    final child = ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        final length = widget.axis == Axis.horizontal ? rect.width : rect.height;
        final f = length <= 0 ? 0.0 : (widget.extent / length).clamp(0.0, 0.5);
        const solid = Color(0xFFFFFFFF);
        const clear = Color(0x00FFFFFF);
        return LinearGradient(
          begin: widget.axis == Axis.horizontal ? Alignment.centerLeft : Alignment.topCenter,
          end: widget.axis == Axis.horizontal ? Alignment.centerRight : Alignment.bottomCenter,
          colors: [_before ? clear : solid, solid, solid, _after ? clear : solid],
          stops: [0, f, 1 - f, 1],
        ).createShader(rect);
      },
      child: widget.child,
    );
    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 ? _update(n.metrics) : false,
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => n.depth == 0 ? _update(n.metrics) : false,
        child: child,
      ),
    );
  }
}
