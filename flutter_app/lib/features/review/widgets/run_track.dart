import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// Where one mistake of the run stands, as a segment of the run track.
enum RunSegmentState {
  /// Not reached yet.
  upcoming,

  /// Reached before and left with nothing settled (a failure, a call still out): it can be shown
  /// again, so its track is drawn a step brighter than one not reached.
  seen,

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
/// screen is lifted by a taller bar, and while it is open by its ink cap. The lift travels: as
/// the run moves on it eases off the segment left behind and onto the next one over 240 ms, so
/// the track reads as one marker moving, not two bars swapping. It is drawn only from the run's
/// real outcomes, and it sits under a live-region count, so it is never the only carrier of
/// progress.
///
/// With [onTap], every segment already reached ([canTap]) is a key: a 48 dp tall target (the
/// painted bar stays thin, centred in it) that shows that mistake again without a new call. A
/// press lifts the segment at once, the same lift the mistake on screen has, so the finger sees
/// where it is going before the page moves; a press that slides off lets it settle back.
class RunTrack extends StatelessWidget {
  const RunTrack({super.key, required this.segments, this.onTap, this.canTap, this.onScreen});

  final List<RunSegmentState> segments;

  /// The mistake on screen (0-based). It stays lifted whatever its state, so going back to a
  /// repaired one still shows where you are. Null: the segment marked [RunSegmentState.current].
  final int? onScreen;

  /// Shows mistake i (0-based). Null: the track is a picture only.
  final ValueChanged<int>? onTap;

  /// Whether segment i can be shown. Null with [onTap]: none.
  final bool Function(int i)? canTap;

  static const double _height = 6;
  static const double _gap = 6;

  /// How long the lift takes to move from one segment to the next.
  static const Duration lift = Motion.card;

  /// The touch target of a segment.
  static const double target = 48;

  static String _word(RunSegmentState s) => switch (s) {
    RunSegmentState.current => ReviewCopy.trackOnScreen,
    RunSegmentState.done => ReviewCopy.trackRepaired,
    RunSegmentState.reviewed => ReviewCopy.trackReviewed,
    RunSegmentState.setAside => ReviewCopy.trackSetAside,
    RunSegmentState.seen => ReviewCopy.trackSeen,
    RunSegmentState.upcoming => ReviewCopy.trackAhead,
  };

  bool _lifted(int i) => onScreen == null ? segments[i] == RunSegmentState.current : onScreen == i;

  @override
  Widget build(BuildContext context) {
    final n = segments.length;
    final interactive = onTap != null;
    if (!interactive) {
      return ExcludeSemantics(
        child: SizedBox(
          height: 12,
          child: Row(
            children: [
              for (var i = 0; i < n; i++) ...[
                if (i > 0) const SizedBox(width: _gap),
                Expanded(child: _Segment(state: segments[i], lifted: _lifted(i))),
              ],
            ],
          ),
        ),
      );
    }
    // The gap is inside each target (half on each side), so a finger between two segments still
    // lands on one of them.
    return SizedBox(
      height: target,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < n; i++)
            Expanded(
              child: Builder(
                builder: (context) {
                  final tappable = canTap?.call(i) ?? false;
                  final current = segments[i] == RunSegmentState.current;
                  return Semantics(
                    container: true,
                    button: tappable,
                    selected: current,
                    label: ReviewCopy.trackSegment(i + 1, n, _word(segments[i])),
                    onTapHint: tappable ? ReviewCopy.trackGoHint : null,
                    onTap: tappable ? () => onTap!(i) : null,
                    excludeSemantics: true,
                    child: _SegmentKey(
                      onTap: tappable ? () => onTap!(i) : null,
                      builder: (pressed) => Padding(
                        padding: EdgeInsets.only(left: i == 0 ? 0 : _gap / 2, right: i == n - 1 ? 0 : _gap / 2),
                        child: Center(
                          child: SizedBox(height: 12, width: double.infinity, child: _Segment(state: segments[i], lifted: _lifted(i) || pressed)),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

/// A segment's touch target: it tells its segment while a finger is down on it, so the bar can
/// lift under the finger. Without [onTap] it is only the picture.
class _SegmentKey extends StatefulWidget {
  const _SegmentKey({required this.onTap, required this.builder});

  final VoidCallback? onTap;
  final Widget Function(bool pressed) builder;

  @override
  State<_SegmentKey> createState() => _SegmentKeyState();
}

class _SegmentKeyState extends State<_SegmentKey> {
  bool _pressed = false;

  void _press(bool down) {
    if (_pressed != down && mounted) setState(() => _pressed = down);
  }

  @override
  Widget build(BuildContext context) {
    final tap = widget.onTap;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: tap,
      onTapDown: tap == null ? null : (_) => _press(true),
      onTapUp: tap == null ? null : (_) => _press(false),
      onTapCancel: tap == null ? null : () => _press(false),
      child: widget.builder(_pressed && tap != null),
    );
  }
}

class _Segment extends ConsumerStatefulWidget {
  const _Segment({required this.state, required this.lifted});

  final RunSegmentState state;

  /// The mistake on screen, or the segment under a finger: a taller bar, a brighter track and,
  /// while it is open, the ink cap.
  final bool lifted;

  @override
  ConsumerState<_Segment> createState() => _SegmentState();
}

class _SegmentState extends ConsumerState<_Segment> with TickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: widget.state == RunSegmentState.done ? 1 : 0,
  );
  late final CurvedAnimation _curve = CurvedAnimation(parent: _fill, curve: Motion.emphasized);

  /// 0 at rest, 1 lifted. It eases on and off, so the lift travels along the track.
  late final AnimationController _lift = AnimationController(vsync: this, duration: RunTrack.lift, value: widget.lifted ? 1 : 0);
  late final CurvedAnimation _liftCurve = CurvedAnimation(parent: _lift, curve: Motion.out, reverseCurve: Motion.out.flipped);

  @override
  void didUpdateWidget(_Segment old) {
    super.didUpdateWidget(old);
    if (widget.lifted != old.lifted) {
      if (Motion.reduced(context)) {
        _lift.value = widget.lifted ? 1 : 0;
      } else if (widget.lifted) {
        _lift.forward();
      } else {
        _lift.reverse();
      }
    }
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
    _liftCurve.dispose();
    _lift.dispose();
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
          lift: _liftCurve,
          // A segment reached before keeps the brighter track; the lift brightens any other.
          track: widget.state == RunSegmentState.seen ? colors.lineStrong : colors.line,
          trackLifted: colors.lineStrong,
          // Volt fill in both themes, with a 1 dp olive rim in Day so it reads on paper.
          done: colors.volt,
          rim: colors.isNight ? null : colors.accentText,
          ring: colors.ink2,
          marker: colors.ink,
        ),
      ),
    );
  }
}

class _SegmentPainter extends CustomPainter {
  _SegmentPainter({
    required this.state,
    required this.fill,
    required this.lift,
    required this.track,
    required this.trackLifted,
    required this.done,
    required this.rim,
    required this.ring,
    required this.marker,
  }) : super(repaint: Listenable.merge([fill, lift]));

  final RunSegmentState state;
  final Animation<double> fill;

  /// 0 at rest to 1 lifted (the mistake on screen, or a segment pressed).
  final Animation<double> lift;
  final Color track;
  final Color trackLifted;
  final Color done;

  /// A 1 dp edge on the filled part in Day, or null on Night.
  final Color? rim;
  final Color ring;
  final Color marker;

  @override
  void paint(Canvas canvas, Size size) {
    final up = lift.value.clamp(0.0, 1.0);
    final h = RunTrack._height - 2 + 2 * up;
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
        canvas.drawRRect(r, Paint()..color = Color.lerp(track, trackLifted, up)!);
        final t = fill.value.clamp(0.0, 1.0);
        if (t > 0) {
          canvas.save();
          canvas.clipRRect(r);
          canvas.drawRect(Rect.fromLTWH(bar.left, bar.top, bar.width * t, bar.height), Paint()..color = done);
          if (rim != null) {
            canvas.drawRRect(
              r.deflate(0.5),
              Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 1
                ..color = rim!,
            );
          }
          canvas.restore();
        }
        if (state != RunSegmentState.done && up > 0) {
          // A small ink cap at the left edge: where the student is. It grows in with the lift and
          // shrinks away from the segment left behind, so it reads as one cap moving on.
          final w = math.max(h, 14 * up);
          canvas.drawRRect(
            RRect.fromRectAndRadius(Rect.fromLTWH(bar.left, bar.top, w, bar.height), Radius.circular(h / 2)),
            Paint()..color = marker.withValues(alpha: marker.a * up),
          );
        }
    }
  }

  @override
  bool shouldRepaint(_SegmentPainter old) =>
      old.state != state ||
      old.fill != fill ||
      old.lift != lift ||
      old.track != track ||
      old.trackLifted != trackLifted ||
      old.done != done ||
      old.rim != rim ||
      old.ring != ring ||
      old.marker != marker;
}
