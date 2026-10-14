import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' hide SaveState;
import '../copy.dart';

/// The bottom bar, 72 dp above the gesture inset (spec 5.5): Previous as a glass pill and the
/// one volt key, Next, which becomes Review and submit on the last question. No haptic
/// on these: inside a timed paper only the option tick speaks.
///
/// Both keys take every tap (MOTION.md 1.1: nothing queues, a tap during an entrance works): no
/// tap lock, so Previous, Previous 150 ms apart goes back two questions. Opening the submit page
/// twice is guarded by the host, not by the key.
///
/// When every question has an answer the volt key carries the soft lit glow beneath it (14% volt,
/// never behind text): the one resting emphasis on the screen, saying the paper is ready to hand in.
/// Daylight has no glows (MOTION.md 1.4): there the same emphasis is a 1 dp olive edge round the key.
///
/// The moment the last answer is given and the server has acknowledged the save, the key plays one
/// 600 ms ready beat (the glow swells once in Night; in Daylight the olive edge draws round the
/// key) and [onReady] gives a soft haptic. Never on a reload of a paper already complete, never
/// twice, and never before the save is acknowledged.
class RunnerBottomBar extends StatefulWidget {
  const RunnerBottomBar({
    super.key,
    required this.isFirst,
    required this.isLast,
    required this.onPrevious,
    required this.onNext,
    this.allAnswered = false,
    this.save,
    this.onReady,
  });

  final bool isFirst;
  final bool isLast;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  /// Every question has an answer: the key glows.
  final bool allAnswered;

  /// The save state: the ready beat waits for [SaveState.saved].
  final ValueListenable<SaveSnapshot>? save;

  /// Called once, as the ready beat starts (the host gives the soft haptic).
  final VoidCallback? onReady;

  /// The room the primary key needs to say "Review and submit" on one line.
  static const double reviewLabelMinWidth = 170;

  /// The ready beat.
  static const Duration readyBeat = Duration(milliseconds: 600);

  @override
  State<RunnerBottomBar> createState() => _RunnerBottomBarState();
}

class _RunnerBottomBarState extends State<RunnerBottomBar> with SingleTickerProviderStateMixin {
  // At 1 once ready (the Daylight edge is drawn in full); runs 0 to 1 for the beat.
  late final AnimationController _beat;

  /// The paper became complete while open and the beat waits for the save.
  bool _armed = false;

  /// A paper that opens complete (a reload) has had its moment.
  late bool _played;

  @override
  void initState() {
    super.initState();
    // Made here, not lazily: a key that never glowed must still dispose it safely.
    _played = widget.allAnswered;
    _beat = AnimationController(vsync: this, duration: RunnerBottomBar.readyBeat, value: widget.allAnswered ? 1 : 0);
    widget.save?.addListener(_maybeBeat);
  }

  @override
  void didUpdateWidget(RunnerBottomBar old) {
    super.didUpdateWidget(old);
    if (old.save != widget.save) {
      old.save?.removeListener(_maybeBeat);
      widget.save?.addListener(_maybeBeat);
    }
    if (widget.allAnswered && !old.allAnswered) {
      if (_played) {
        _beat.value = 1;
      } else {
        _armed = true;
        _beat.value = 0;
        _maybeBeat();
      }
    } else if (!widget.allAnswered && old.allAnswered) {
      _armed = false;
      _beat.value = 0;
    }
  }

  void _maybeBeat() {
    if (!_armed || !widget.allAnswered || !mounted) return;
    final save = widget.save;
    if (save != null && save.value.state != SaveState.saved) return;
    _armed = false;
    _played = true;
    widget.onReady?.call();
    if (Motion.reduced(context)) {
      _beat.value = 1;
    } else {
      _beat.forward(from: 0);
    }
  }

  @override
  void dispose() {
    widget.save?.removeListener(_maybeBeat);
    _beat.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    final isLast = widget.isLast;
    final ready = widget.allAnswered && !Motion.reduced(context);
    final glow = ready && colors.isNight;
    final edge = ready && !colors.isNight;
    final primary = AnimatedContainer(
      duration: Motion.glideDuration,
      curve: Motion.glide,
      decoration: BoxDecoration(
        borderRadius: MmRadius.pillAll,
        boxShadow: glow ? [BoxShadow(color: colors.voltGlow, blurRadius: 22, offset: const Offset(0, 6), spreadRadius: -2)] : const [],
      ),
      // "Review and submit" would wrap in the room a narrow phone leaves, so the last
      // key says "Review" there (it opens the same page).
      child: LayoutBuilder(
        builder: (context, box) => KeyButton(
          label: !isLast
              ? RunnerCopy.next
              : box.maxWidth < RunnerBottomBar.reviewLabelMinWidth
              ? RunnerCopy.review
              : RunnerCopy.reviewAndSubmit,
          semanticsLabel: isLast ? RunnerCopy.reviewAndSubmit : null,
          onPressed: widget.onNext,
          hapticOnCommit: false,
          tapLock: Duration.zero,
        ),
      ),
    );
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.5,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.ground,
          border: Border(top: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s8 + inset),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Row(
              children: [
                KeyButton.secondary(
                  label: RunnerCopy.previous,
                  onPressed: widget.isFirst ? null : widget.onPrevious,
                  expanded: false,
                  hapticOnCommit: false,
                  tapLock: Duration.zero,
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // The Night swell: one extra breath of the glow under the key, then gone.
                      if (glow)
                        Positioned.fill(
                          child: IgnorePointer(
                            child: AnimatedBuilder(
                              animation: _beat,
                              builder: (context, _) {
                                final swell = _beat.isAnimating ? math.sin(math.pi * _beat.value) : 0.0;
                                if (swell <= 0) return const SizedBox.expand();
                                return DecoratedBox(
                                  decoration: BoxDecoration(
                                    borderRadius: MmRadius.pillAll,
                                    boxShadow: [
                                      BoxShadow(
                                        color: colors.voltGlow.withValues(alpha: (colors.voltGlow.a * 1.6 * swell).clamp(0.0, 1.0)),
                                        blurRadius: 22 + 16 * swell,
                                        offset: const Offset(0, 6),
                                        spreadRadius: -2 + 4 * swell,
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                      primary,
                      // The Daylight edge, painted over the key so it takes no room: it draws round
                      // the key during the beat and then stays.
                      if (edge)
                        Positioned.fill(
                          child: IgnorePointer(
                            child: RepaintBoundary(
                              child: CustomPaint(
                                painter: _EdgePainter(progress: _beat, color: colors.accentText),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The 1 dp olive edge round the volt key, drawn from the top centre both ways round as
/// [progress] runs to 1, then held.
class _EdgePainter extends CustomPainter {
  _EdgePainter({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.glide.transform(progress.value.clamp(0.0, 1.0));
    if (t <= 0) return;
    final rect = (Offset.zero & size).deflate(0.5);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(rect.height / 2));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    if (t >= 0.999) {
      canvas.drawRRect(rrect, paint);
      return;
    }
    // The outline starts at the top centre and is drawn from both ends towards the bottom.
    final r = rect.height / 2;
    final path = Path()
      ..moveTo(rect.center.dx, rect.top)
      ..lineTo(rect.right - r, rect.top)
      ..arcToPoint(Offset(rect.right - r, rect.bottom), radius: Radius.circular(r))
      ..lineTo(rect.left + r, rect.bottom)
      ..arcToPoint(Offset(rect.left + r, rect.top), radius: Radius.circular(r))
      ..close();
    for (final metric in path.computeMetrics()) {
      final half = metric.length * t / 2;
      canvas.drawPath(metric.extractPath(0, half), paint);
      canvas.drawPath(metric.extractPath(metric.length - half, metric.length), paint);
    }
  }

  @override
  bool shouldRepaint(_EdgePainter old) => old.color != color;
}
