import 'package:flutter/widgets.dart';

import '../haptics/haptics.dart';

/// Where a scrub is: the finger's [x] in the scrubbed box (clamped to it), the [index] it snaps
/// to, and the box's [width].
@immutable
class MmScrubValue {
  const MmScrubValue({required this.x, required this.index, required this.width});

  final double x;
  final int index;
  final double width;

  /// [x] as a share of the width, 0 to 1.
  double get t => width <= 0 ? 0 : (x / width).clamp(0.0, 1.0);

  @override
  bool operator ==(Object other) => other is MmScrubValue && other.x == x && other.index == index && other.width == width;

  @override
  int get hashCode => Object.hash(x, index, width);

  @override
  String toString() => 'MmScrubValue(x: ${x.toStringAsFixed(1)}, index: $index)';
}

/// The index [x] snaps to among [count] points spread evenly from the left edge to the right edge
/// of a box [width] wide (the first point at 0, the last at [width]), as a road, a trend line or a
/// ribbon lays them out. -1 when there are no points.
int mmScrubIndex(double x, double width, int count) {
  if (count <= 0) return -1;
  if (count == 1 || width <= 0) return 0;
  final t = (x / width).clamp(0.0, 1.0);
  return (t * (count - 1)).round().clamp(0, count - 1);
}

/// The x of point [index] among [count] points laid out as [mmScrubIndex] expects.
double mmScrubX(int index, double width, int count) {
  if (count <= 1) return width / 2;
  return width * index.clamp(0, count - 1) / (count - 1);
}

/// Hold and slide across a road, a trend chart, a ribbon or an answer sheet to read each point.
///
/// A long press starts the scrub; sliding reports a continuous x and the index it snaps to through
/// [value] (a `ValueNotifier`, so a painter given it as `repaint:` redraws its cursor without a
/// rebuild); releasing clears it to null. Each change of index ticks a segment haptic (and one on
/// the start; `SEGMENT_TICK` where the phone has it, else a selection click), so the finger counts
/// the points. [onIndex] is told of each index change, for the caption a screen reader also hears.
///
/// [indexFor] replaces the even spread (a grid of answer bubbles, points at uneven dates).
///
/// It moves nothing itself; the painter decides how the cursor looks. Reduced motion changes
/// nothing here: the scrub is direct manipulation.
class MmScrub extends StatefulWidget {
  const MmScrub({
    super.key,
    required this.count,
    required this.child,
    this.value,
    this.indexFor,
    this.onIndex,
    this.onStart,
    this.onEnd,
    this.enabled = true,
    this.haptic = true,
  });

  /// How many points there are.
  final int count;
  final Widget child;

  /// Receives the scrub; null when not scrubbing. Owned by the caller when given, else internal.
  final ValueNotifier<MmScrubValue?>? value;

  /// The index for an x in a box this wide. Defaults to [mmScrubIndex].
  final int Function(double x, double width)? indexFor;
  final ValueChanged<int>? onIndex;
  final VoidCallback? onStart;
  final VoidCallback? onEnd;
  final bool enabled;
  final bool haptic;

  @override
  State<MmScrub> createState() => MmScrubState();
}

class MmScrubState extends State<MmScrub> {
  ValueNotifier<MmScrubValue?>? _own;
  ValueNotifier<MmScrubValue?> get notifier => widget.value ?? (_own ??= ValueNotifier<MmScrubValue?>(null));

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  int _indexFor(double x, double width) => widget.indexFor?.call(x, width) ?? mmScrubIndex(x, width, widget.count);

  /// Moves the scrub to [local] (a position inside the box). Public so tests and a keyboard can
  /// drive it.
  void scrubTo(Offset local) {
    final box = context.findRenderObject() as RenderBox?;
    final width = box?.size.width ?? 0;
    final x = local.dx.clamp(0.0, width);
    final index = _indexFor(x, width);
    final before = notifier.value;
    notifier.value = MmScrubValue(x: x, index: index, width: width);
    if (before == null || before.index != index) {
      if (widget.haptic) hapticsOf(context)?.segmentTick();
      if (index >= 0) widget.onIndex?.call(index);
    }
  }

  /// Ends the scrub.
  void end() {
    if (notifier.value == null) return;
    notifier.value = null;
    widget.onEnd?.call();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled || widget.count <= 0) return widget.child;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onLongPressStart: (d) {
        widget.onStart?.call();
        scrubTo(d.localPosition);
      },
      onLongPressMoveUpdate: (d) => scrubTo(d.localPosition),
      onLongPressEnd: (_) => end(),
      onLongPressCancel: end,
      child: widget.child,
    );
  }
}
