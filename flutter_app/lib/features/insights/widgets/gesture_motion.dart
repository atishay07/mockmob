import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

// Two small gesture-motion primitives for the Saved list: a row that folds away toward the key that
// removed it (and unfolds again on Undo), and a row that can be swiped to commit one of two
// actions. Both move transform and opacity (the fold also collapses its own height, so the rows
// below glide up), both are interruptible, and both read the same under reduced motion: the fold
// is instant and the swipe still follows the finger.

/// A row that folds out of a list and back in.
///
/// While [visible], the row is at rest. When [visible] turns false it folds out toward [toward]
/// (it shrinks, drifts and fades 36 dp toward that side, then its height closes and the rows
/// under it glide up) over 380 ms, then calls [onGone] once. If [visible] turns true again before
/// or after it has gone, the row unfolds the same way in reverse: the Undo of a removal. A row
/// that first appears with [fresh] set unfolds in once.
class FoldExit extends StatefulWidget {
  const FoldExit({
    super.key,
    required this.visible,
    required this.child,
    this.fresh = false,
    this.toward = Alignment.centerRight,
    this.onGone,
  });

  final bool visible;
  final Widget child;

  /// Unfolds in on first build (a row that came back or arrived after the list was shown).
  final bool fresh;

  /// The side of the row the fold falls toward (the key that removed it).
  final Alignment toward;

  /// Called once each time the fold-out has finished.
  final VoidCallback? onGone;

  /// How long the whole fold takes.
  static const Duration duration = Duration(milliseconds: 380);

  @override
  State<FoldExit> createState() => _FoldExitState();
}

class _FoldExitState extends State<FoldExit> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: FoldExit.duration,
    value: widget.visible && !widget.fresh ? 1 : 0,
  )..addStatusListener(_status);
  bool _started = false;

  bool _goneQueued = false;

  void _status(AnimationStatus status) {
    // animateTo always runs "forward" and ends "completed", even toward zero: read the value.
    final ended = status == AnimationStatus.completed || status == AnimationStatus.dismissed;
    if (ended && _c.value == 0 && !widget.visible) _notifyGone();
  }

  /// Tells the list the row has folded away, after the frame: the list changes its own rows in
  /// response, which it must never do while the tree is building.
  void _notifyGone() {
    if (_goneQueued) return;
    _goneQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _goneQueued = false;
      if (mounted && !widget.visible && _c.value == 0) widget.onGone?.call();
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.visible && widget.fresh) {
      if (Motion.reduced(context)) {
        _c.value = 1;
      } else {
        _c.forward();
      }
    } else if (!widget.visible) {
      _notifyGone();
    }
  }

  @override
  void didUpdateWidget(FoldExit old) {
    super.didUpdateWidget(old);
    if (old.visible == widget.visible) return;
    final target = widget.visible ? 1.0 : 0.0;
    if (Motion.reduced(context)) {
      _c.value = target;
      if (!widget.visible) _notifyGone();
    } else {
      // From wherever it is now, so an Undo mid-fold reverses rather than restarts.
      _c.animateTo(target, curve: Curves.linear, duration: FoldExit.duration * (target - _c.value).abs());
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final f = _c.value;
        if (f >= 1) return child!;
        // The content leaves first (f 1 to 0.4) and the height follows (f 0.7 to 0), so a row
        // that comes back opens its space and then shows itself.
        final content = Motion.out.transform(((f - 0.35) / 0.65).clamp(0.0, 1.0));
        final space = Curves.easeInOutCubic.transform((f / 0.7).clamp(0.0, 1.0));
        final side = widget.toward.x >= 0 ? 1.0 : -1.0;
        return IgnorePointer(
          child: ClipRect(
            child: Align(
              alignment: Alignment.topCenter,
              heightFactor: space,
              child: Opacity(
                opacity: content,
                child: Transform.translate(
                  offset: Offset(side * 36 * (1 - content), 0),
                  child: Transform.scale(scale: 0.9 + 0.1 * content, alignment: widget.toward, child: child),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// One side of a [SwipeCommit]: what the swipe reveals and does.
class SwipeAction {
  const SwipeAction({required this.label, required this.icon, required this.background, required this.foreground, required this.onCommit});

  final String label;
  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback onCommit;
}

/// A row that follows a horizontal drag and commits an action past [lockAt] of its width.
///
/// Dragging left reveals [end] (at the row's right edge); dragging right reveals [start] (at its
/// left edge). Past [lockAt] a selection haptic ticks and the revealed label settles into a
/// bold, popped state; letting go there commits the action and the row springs back to rest.
/// Letting go before it springs back and does nothing. A side with no action does not move.
/// The same actions are on the row's own keys and, for TalkBack, as custom actions, so a swipe
/// is never the only way.
class SwipeCommit extends StatefulWidget {
  const SwipeCommit({super.key, required this.child, this.start, this.end, this.lockAt = 0.45, this.enabled = true});

  final Widget child;
  final SwipeAction? start;
  final SwipeAction? end;
  final double lockAt;

  /// False leaves the row still (a removal is in flight).
  final bool enabled;

  @override
  State<SwipeCommit> createState() => _SwipeCommitState();
}

class _SwipeCommitState extends State<SwipeCommit> with SingleTickerProviderStateMixin {
  late final AnimationController _x = AnimationController.unbounded(vsync: this, value: 0);
  double _width = 0;
  bool _locked = false;

  @override
  void dispose() {
    _x.dispose();
    super.dispose();
  }

  bool _allowed(double dx) => dx == 0 || (dx < 0 ? widget.end != null : widget.start != null);

  void _update(DragUpdateDetails d) {
    if (!widget.enabled || _width <= 0) return;
    var next = _x.value + d.delta.dx;
    if (!_allowed(next)) next = 0;
    // A little give past the lock point so the edge never feels like a wall.
    final limit = _width * 0.72;
    if (next.abs() > limit) next = next.sign * (limit + (next.abs() - limit) * 0.25);
    _x.value = next;
    final locked = next.abs() >= _width * widget.lockAt;
    if (locked != _locked) {
      _locked = locked;
      if (locked) mmHapticsOf(context)?.selection();
      setState(() {});
    }
  }

  void _release(DragEndDetails d) {
    if (!widget.enabled) return;
    final action = _x.value < 0 ? widget.end : widget.start;
    final commit = _locked && action != null;
    _locked = false;
    _x.animateWith(Motion.spring(Springs.settle, _x.value, 0, velocity: Motion.reduced(context) ? 0 : d.velocity.pixelsPerSecond.dx));
    if (Motion.reduced(context)) _x.value = 0;
    setState(() {});
    if (commit) action.onCommit();
  }

  void _cancel() {
    _locked = false;
    _x.animateWith(Motion.spring(Springs.settle, _x.value, 0));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (widget.start == null && widget.end == null) return widget.child;
    return LayoutBuilder(
      builder: (context, box) {
        _width = box.maxWidth;
        return GestureDetector(
          behavior: HitTestBehavior.translucent,
          onHorizontalDragUpdate: _update,
          onHorizontalDragEnd: _release,
          onHorizontalDragCancel: _cancel,
          child: AnimatedBuilder(
            animation: _x,
            child: widget.child,
            builder: (context, child) {
              final dx = _x.value;
              final action = dx < 0 ? widget.end : widget.start;
              return Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  if (dx != 0 && action != null)
                    Positioned(
                      top: 1,
                      bottom: 1,
                      left: dx > 0 ? 0 : null,
                      right: dx < 0 ? 0 : null,
                      width: dx.abs(),
                      child: _Reveal(action: action, toLeft: dx > 0, locked: _locked, progress: (dx.abs() / (_width * widget.lockAt)).clamp(0.0, 1.0)),
                    ),
                  Transform.translate(offset: Offset(dx, 0), child: child),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _Reveal extends StatelessWidget {
  const _Reveal({required this.action, required this.toLeft, required this.locked, required this.progress});

  final SwipeAction action;

  /// The reveal sits at the row's left edge (a swipe to the right).
  final bool toLeft;
  final bool locked;
  final double progress;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return ClipRect(
      child: ColoredBox(
        color: action.background,
        child: OverflowBox(
          alignment: toLeft ? Alignment.centerRight : Alignment.centerLeft,
          minWidth: 112,
          maxWidth: 112,
          child: Opacity(
            opacity: Curves.easeOut.transform(math.min(1, progress * 1.4)),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  scale: locked ? 1.18 : 0.9 + 0.1 * progress,
                  duration: Motion.of(context, Motion.press),
                  curve: Motion.out,
                  child: Icon(action.icon, size: 20, color: action.foreground),
                ),
                const SizedBox(width: MmSpace.s8),
                Text(
                  action.label,
                  maxLines: 1,
                  style: type.label.copyWith(color: action.foreground, fontWeight: locked ? FontWeight.w700 : FontWeight.w600),
                ),
              ],
            ),
            ),
          ),
        ),
      ),
    );
  }
}
