import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// Where one mistake of the run stands, as a segment of the run track.
enum RunSegmentState {
  /// Not reached yet.
  upcoming,

  /// The mistake on screen.
  current,

  /// Explained: the repair is recorded.
  done,

  /// Read with the answer key. Not a repair, so the segment is ringed, never filled.
  reviewed,

  /// Set aside while the answer key is checked.
  setAside,
}

/// The repair run as a stage track: one segment per mistake. A segment that completes fills
/// volt from its left edge over 420 ms on the emphasized curve and ticks once; the mistake on
/// screen is lifted by a brighter track and a taller bar. It is drawn only from the run's real
/// outcomes, and it sits under a live-region count, so it is never the only carrier of progress.
class RunTrack extends StatelessWidget {
  const RunTrack({super.key, required this.segments});

  final List<RunSegmentState> segments;

  static const double _height = 6;
  static const double _gap = 6;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox(
        height: 12,
        child: Row(
          children: [
            for (var i = 0; i < segments.length; i++) ...[
              if (i > 0) const SizedBox(width: _gap),
              Expanded(child: _Segment(state: segments[i])),
            ],
          ],
        ),
      ),
    );
  }
}

class _Segment extends ConsumerStatefulWidget {
  const _Segment({required this.state});

  final RunSegmentState state;

  @override
  ConsumerState<_Segment> createState() => _SegmentState();
}

class _SegmentState extends ConsumerState<_Segment> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: widget.state == RunSegmentState.done ? 1 : 0,
  );
  late final CurvedAnimation _curve = CurvedAnimation(parent: _fill, curve: Motion.emphasized);

  @override
  void didUpdateWidget(_Segment old) {
    super.didUpdateWidget(old);
    final nowDone = widget.state == RunSegmentState.done;
    if (nowDone && old.state != RunSegmentState.done) {
      if (Motion.reduced(context)) {
        _fill.value = 1;
      } else {
        _fill.forward(from: 0);
        ref.read(hapticsProvider).tick();
      }
    } else if (!nowDone) {
      _fill.value = 0;
    }
  }

  @override
  void dispose() {
    _curve.dispose();
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return RepaintBoundary(
      child: CustomPaint(
        painter: _SegmentPainter(
          state: widget.state,
          fill: _curve,
          track: widget.state == RunSegmentState.current ? colors.lineStrong : colors.line,
          done: colors.isNight ? colors.volt : colors.accentText,
          ring: colors.ink2,
          marker: colors.ink,
        ),
      ),
    );
  }
}

class _SegmentPainter extends CustomPainter {
  _SegmentPainter({required this.state, required this.fill, required this.track, required this.done, required this.ring, required this.marker})
      : super(repaint: fill);

  final RunSegmentState state;
  final Animation<double> fill;
  final Color track;
  final Color done;
  final Color ring;
  final Color marker;

  @override
  void paint(Canvas canvas, Size size) {
    final h = state == RunSegmentState.current ? RunTrack._height : RunTrack._height - 2;
    final bar = Rect.fromLTWH(0, (size.height - h) / 2, size.width, h);
    final r = RRect.fromRectAndRadius(bar, Radius.circular(h / 2));
    switch (state) {
      case RunSegmentState.reviewed:
        canvas.drawRRect(
          r.deflate(0.75),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = ring,
        );
      case RunSegmentState.setAside:
        const dash = 5.0, gap = 4.0;
        final p = Paint()
          ..color = ring
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round;
        for (var x = bar.left + 1; x < bar.right - 1; x += dash + gap) {
          canvas.drawLine(Offset(x, bar.center.dy), Offset((x + dash).clamp(0, bar.right - 1), bar.center.dy), p);
        }
      default:
        canvas.drawRRect(r, Paint()..color = track);
        final t = fill.value.clamp(0.0, 1.0);
        if (t > 0) {
          canvas.save();
          canvas.clipRRect(r);
          canvas.drawRect(Rect.fromLTWH(bar.left, bar.top, bar.width * t, bar.height), Paint()..color = done);
          canvas.restore();
        }
        if (state == RunSegmentState.current) {
          // A small ink cap at the left edge: where the student is.
          canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(bar.left, bar.top, 14, bar.height), Radius.circular(h / 2)), Paint()..color = marker);
        }
    }
  }

  @override
  bool shouldRepaint(_SegmentPainter old) =>
      old.state != state || old.fill != fill || old.track != track || old.done != done || old.ring != ring || old.marker != marker;
}
