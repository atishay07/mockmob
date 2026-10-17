import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics/haptics.dart';
import '../theme/theme.dart';
import 'motion.dart';

/// Pull to refresh in the language of the app (MOTION.md C10), in place of the stock Material
/// spinner on Today, Review, Insights, Saved and Learn.
///
/// The content moves with the pull (GLASS-1017 5.9): the app's scroll views bounce, so the page
/// rubber-bands down under the finger and the ring rides in the gap it opens, centred half the
/// pull below the status bar (at most 36 dp down). On release past the threshold the page settles
/// [holdExtent] dp lower and keeps that gap open while the data loads, so the ring sits in clear
/// space and never over the title row or the greeting; when the data lands the page returns as the
/// ring lifts away. (Before the bounce, the content never moved: the views clamped and the ring
/// alone showed the pull. A view that still clamps works as it did.)
///
/// - **Pull.** An answer-bubble ring draws its stroke from nothing to a full circle as the pull grows
///   from 0 to [threshold] dp, with one selection tick when it closes.
/// - **Release past the threshold.** The ring becomes a reading arc (one turn in 1.2 s, indeterminate).
///   After 12 s it says so in words ("Still refreshing. Your page is safe.") and keeps turning.
///   After [letGoAfter] it lets go: the ring empties and leaves, the page returns to its place, and
///   the read goes on quietly (the screen shows what it brings). The words never stay pinned over
///   the top of the page (D28: "Still refreshing" stuck at the top on v13).
/// - **Data returns.** The ring inks volt over 160 ms and lifts away over 200 ms. The screen's
///   own numbers roll from their old values; this widget never replays an entrance.
/// - **Failure.** The ring empties and leaves, and [onError] runs so the screen can show its
///   banner.
/// - **Reduced motion.** A static ring and the word "Refreshing".
///
/// Wrap the scroll view itself; only its first vertical scrollable (notification depth 0) drives
/// the pull, and a pull that starts away from the top does nothing.
class MmPullRefresh extends ConsumerStatefulWidget {
  const MmPullRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
    this.onError,
    this.threshold = 72,
    this.enabled = true,
  });

  /// Reload the screen's data. A thrown error counts as a failure (the ring empties).
  final Future<void> Function() onRefresh;
  final Widget child;

  /// Called after a failed refresh with the error.
  final void Function(Object error)? onError;

  /// How far the finger pulls (dp) before the ring closes and a release refreshes.
  final double threshold;
  final bool enabled;

  /// After this long the arc is joined by words.
  static const Duration slowAfter = Duration(seconds: 12);

  /// After this long the pull lets go of the page even though the read has not answered.
  static const Duration letGoAfter = Duration(seconds: 20);

  /// The gap held open under the status bar while the ring turns: the ring's 40 dp, its 8 dp
  /// inset and 8 dp of air, so the first line of the page starts below it.
  static const double holdExtent = 56;

  /// The gap while words sit under the ring (reduced motion, or a slow refresh): one more line.
  static const double holdExtentWithWords = 76;

  @override
  ConsumerState<MmPullRefresh> createState() => _MmPullRefreshState();
}

enum _PullMode { idle, pulling, refreshing, landing, failing }

class _MmPullRefreshState extends ConsumerState<MmPullRefresh> with TickerProviderStateMixin {
  /// 0 to 1 and beyond: the pull as a share of the threshold.
  final ValueNotifier<double> _progress = ValueNotifier(0);

  /// How far the page is scrolled down from its top (dp, never negative). The ring belongs to the
  /// top of the page: once the page has scrolled away from it the ring goes with it, so it never
  /// sits over content lower down (v13 walk, finding 2).
  final ValueNotifier<double> _scrolled = ValueNotifier(0);

  /// The reading arc: one turn per 1.2 s.
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  /// Ink (0 to 1 over 160 ms) then lift (1 to 2 over 200 ms) on success; the empty-out on failure.
  late final AnimationController _land = AnimationController(vsync: this, duration: const Duration(milliseconds: 360));

  _PullMode _mode = _PullMode.idle;
  double _pull = 0;
  bool _armed = false;
  bool _slow = false;
  Timer? _slowTimer;
  int _generation = 0;

  @override
  void dispose() {
    _slowTimer?.cancel();
    _progress.dispose();
    _scrolled.dispose();
    _spin.dispose();
    _land.dispose();
    super.dispose();
  }

  /// Where the ring sits while pulling, relative to its resting place (its centre 28 dp below the
  /// status bar): centred half the pull down, at most 36 dp, so it rides in the gap the bouncing
  /// page opens.
  static double ringOffsetFor(double pull) => math.min(pull / 2, 36) - (MmSpace.s8 + 20);

  bool get _busy => _mode == _PullMode.refreshing || _mode == _PullMode.landing || _mode == _PullMode.failing;

  bool _onScroll(ScrollNotification n) {
    if (!widget.enabled || n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    // Where the page is, even while a refresh holds the ring: it follows the page up and out.
    final scrolled = math.max(0.0, n.metrics.pixels);
    if (scrolled != _scrolled.value) _scrolled.value = scrolled;
    if (_busy) return false;
    if (n is OverscrollNotification && n.dragDetails != null && n.overscroll < 0) {
      _setPull(_pull - n.overscroll);
    } else if (n is ScrollUpdateNotification && n.dragDetails != null) {
      final pixels = n.metrics.pixels;
      // Bouncing physics reports the pull as negative pixels; away from the top there is no pull.
      if (pixels < 0) {
        _setPull(-pixels);
      } else if (pixels > 0 && _pull > 0) {
        _setPull(0);
      }
    } else if (n is ScrollUpdateNotification && _pull > 0) {
      // The finger has lifted and the page is springing back: decide now, not when it lands.
      _release();
    } else if (n is ScrollEndNotification && _pull > 0) {
      _release();
    }
    return false;
  }

  void _setPull(double pull) {
    _pull = math.max(0, pull);
    final p = _pull / widget.threshold;
    if (_mode == _PullMode.idle && p > 0) _mode = _PullMode.pulling;
    if (!_armed && p >= 1) {
      _armed = true;
      ref.read(hapticsProvider).selection();
    } else if (_armed && p < 0.9) {
      _armed = false;
    }
    _progress.value = p;
  }

  void _release() {
    final go = _armed && _mode == _PullMode.pulling;
    _pull = 0;
    _armed = false;
    if (go) {
      unawaited(_refresh());
    } else {
      _mode = _PullMode.idle;
      _progress.value = 0;
    }
  }

  /// Also the target of the TalkBack "Refresh" action.
  Future<void> _refresh() async {
    if (_busy) return;
    final generation = ++_generation;
    setState(() {
      _mode = _PullMode.refreshing;
      _slow = false;
    });
    _progress.value = 1;
    final reduced = Motion.reduced(context);
    if (!reduced) _spin.repeat();
    _slowTimer?.cancel();
    _slowTimer = Timer(MmPullRefresh.slowAfter, () {
      if (mounted && generation == _generation) setState(() => _slow = true);
    });
    Object? failure;
    var letGo = false;
    final work = widget.onRefresh();
    try {
      await work.timeout(MmPullRefresh.letGoAfter);
    } on TimeoutException {
      // The read is still out: the page is let go, and a late failure still reaches the screen.
      letGo = true;
      unawaited(work.then<void>((_) {}, onError: (Object error) {
        if (mounted) widget.onError?.call(error);
      }));
    } catch (error) {
      failure = error;
    }
    _slowTimer?.cancel();
    if (!mounted || generation != _generation) return;
    _spin.stop();
    if (letGo) {
      setState(() => _mode = _PullMode.failing);
    } else if (failure != null) {
      setState(() => _mode = _PullMode.failing);
      widget.onError?.call(failure);
    } else {
      setState(() => _mode = _PullMode.landing);
    }
    if (Motion.reduced(context)) {
      _land.value = 1;
    } else {
      await _land.forward(from: 0);
    }
    if (!mounted || generation != _generation) return;
    _land.value = 0;
    _progress.value = 0;
    setState(() {
      _mode = _PullMode.idle;
      _slow = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final top = MediaQuery.paddingOf(context).top;
    final hold = _mode == _PullMode.refreshing ? (reduced || _slow ? MmPullRefresh.holdExtentWithWords : MmPullRefresh.holdExtent) : 0.0;
    return Semantics(
      customSemanticsActions: {const CustomSemanticsAction(label: 'Refresh'): () => unawaited(_refresh())},
      child: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        // No platform stretch or glow on the top edge: the page itself bounces (GLASS-1017 5.9) and
        // the ring rides in the gap it opens. The bottom edge bounces the same way.
        child: NotificationListener<OverscrollIndicatorNotification>(
          onNotification: (n) {
            if (widget.enabled && n.leading && n.depth == 0) n.disallowIndicator();
            return false;
          },
          child: Stack(
          children: [
            // The gap held open while refreshing. The Padding is always in the tree (0 at rest), so
            // the scroll view below keeps its state.
            TweenAnimationBuilder<double>(
              tween: Tween(end: hold),
              duration: reduced ? Duration.zero : Motion.ui,
              curve: Motion.out,
              builder: (context, gap, child) => Padding(padding: EdgeInsets.only(top: gap), child: child),
              child: widget.child,
            ),
            Positioned(
              top: top + MmSpace.s8,
              left: 0,
              right: 0,
              child: IgnorePointer(
                child: Center(
                  child: ListenableBuilder(
                    listenable: Listenable.merge([_progress, _spin, _land, _scrolled]),
                    builder: (context, _) => _RingRide(
                      offset: _mode == _PullMode.pulling ? ringOffsetFor(_pull) : 0,
                      animate: _mode != _PullMode.pulling && !reduced,
                      // Scrolled away from the top: the ring rides up with the page and fades out
                      // over the held gap, so nothing of it ever overlays the content below.
                      child: _AwayFromTop(
                        scrolled: _scrolled.value,
                        child: _PullRing(
                        progress: _progress.value,
                        mode: _mode,
                        spin: _spin.value,
                        land: _land.value,
                        reduced: reduced,
                        slow: _slow,
                      ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }
}

class _PullRing extends StatelessWidget {
  const _PullRing({
    required this.progress,
    required this.mode,
    required this.spin,
    required this.land,
    required this.reduced,
    required this.slow,
  });

  final double progress;
  final _PullMode mode;
  final double spin;
  final double land;
  final bool reduced;
  final bool slow;

  /// The ink takes the first 160 of 360 ms, the lift the last 200.
  static const double _inkShare = 160 / 360;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (mode == _PullMode.idle && progress <= 0) return const SizedBox.shrink();

    var fade = 1.0;
    var lift = 0.0;
    var ink = 0.0;
    var shown = progress.clamp(0.0, 1.0);
    if (mode == _PullMode.landing) {
      ink = (land / _inkShare).clamp(0.0, 1.0);
      final out = ((land - _inkShare) / (1 - _inkShare)).clamp(0.0, 1.0);
      fade = 1 - out;
      lift = -16 * Curves.easeIn.transform(out);
      shown = 1;
    } else if (mode == _PullMode.failing) {
      // The ring empties, then leaves.
      shown = 1 - Motion.emphasized.transform(land);
      fade = 1 - Curves.easeIn.transform(((land - 0.5) * 2).clamp(0.0, 1.0));
    } else if (mode == _PullMode.pulling) {
      fade = Curves.easeOut.transform(progress.clamp(0.0, 0.4) / 0.4);
    }

    final refreshing = mode == _PullMode.refreshing;
    final words = refreshing && (reduced || slow);
    final label = slow ? 'Still refreshing. Your page is safe.' : 'Refreshing';

    return Semantics(
      liveRegion: refreshing,
      label: refreshing ? label : null,
      excludeSemantics: refreshing,
      child: Opacity(
        opacity: fade,
        child: Transform.translate(
          offset: Offset(0, lift),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: ShapeDecoration(
                  color: colors.raised,
                  shape: CircleBorder(side: BorderSide(color: colors.line)),
                  shadows: colors.isNight ? null : colors.cardShadow,
                ),
                child: SizedBox.square(
                  dimension: 40,
                  child: CustomPaint(
                    painter: _RingPainter(
                      progress: shown,
                      // A finished pull is a full circle; refreshing is a 28% arc turning.
                      arc: refreshing && !reduced ? 0.28 : null,
                      spin: spin,
                      ink: ink,
                      stroke: colors.accentText,
                      track: colors.line,
                      fill: colors.volt,
                    ),
                  ),
                ),
              ),
              if (words) ...[
                const SizedBox(height: MmSpace.s4),
                Text(label, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({
    required this.progress,
    required this.arc,
    required this.spin,
    required this.ink,
    required this.stroke,
    required this.track,
    required this.fill,
  });

  final double progress;
  final double? arc;
  final double spin;
  final double ink;
  final Color stroke;
  final Color track;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide / 2 - 9;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, base..color = track);
    if (ink > 0) {
      // The volt is a fill on both themes (a filled bubble), with the stroke riding on it.
      canvas.drawCircle(center, radius * ink + 0.01, Paint()..color = fill);
    }
    final sweep = arc;
    if (sweep != null) {
      canvas.drawArc(rect, -math.pi / 2 + spin * 2 * math.pi, sweep * 2 * math.pi, false, base..color = stroke);
    } else if (progress > 0) {
      canvas.drawArc(rect, -math.pi / 2, progress * 2 * math.pi, false, base..color = stroke);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress ||
      old.arc != arc ||
      old.spin != spin ||
      old.ink != ink ||
      old.stroke != stroke ||
      old.track != track;
}

/// Moves the ring to [offset] below its resting place: at once while the finger pulls, over
/// 200 ms on `Motion.out` back to rest when it lets go.
class _RingRide extends StatelessWidget {
  const _RingRide({required this.offset, required this.animate, required this.child});

  final double offset;
  final bool animate;
  final Widget child;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(end: offset),
    duration: animate ? Motion.ui : Duration.zero,
    curve: Motion.out,
    builder: (context, dy, child) => Transform.translate(offset: Offset(0, dy), child: child),
    child: child,
  );
}

/// Carries the ring away with the page: up by the scroll, and faded out over the first
/// [MmPullRefresh.holdExtent] dp of it. At the top of the page it changes nothing.
class _AwayFromTop extends StatelessWidget {
  const _AwayFromTop({required this.scrolled, required this.child});

  final double scrolled;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (scrolled <= 0) return child;
    final out = (scrolled / MmPullRefresh.holdExtent).clamp(0.0, 1.0);
    return Opacity(
      opacity: 1 - out,
      child: Transform.translate(offset: Offset(0, -scrolled), child: child),
    );
  }
}
