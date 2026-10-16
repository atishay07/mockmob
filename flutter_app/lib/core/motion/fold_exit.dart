import 'package:flutter/widgets.dart';

import 'motion.dart';

/// A row leaving a list for good, reversibly: it slides [travel] dp and fades (200 ms on [Motion.out]),
/// then its height folds to nothing (200 ms on [Motion.out]) so the rows below glide up into the
/// gap instead of jumping. Setting [folded] back to false plays it in reverse (an Undo): the gap
/// opens, then the row slides home and brightens.
///
/// [onFolded] fires when the fold has closed, which is when a caller may drop the row from its
/// list. Only the height phase lays out per frame; the slide and fade are transform and opacity on
/// the row's own layer. Under reduced motion the row fades for [Motion.reducedFade] and the gap
/// closes at once.
class MmFoldExit extends StatefulWidget {
  const MmFoldExit({
    super.key,
    required this.child,
    required this.folded,
    this.travel = -24,
    this.onFolded,
    this.onRestored,
  });

  final Widget child;
  final bool folded;

  /// The slide in dp; negative goes left. A row swiped away should pass its own swipe direction.
  final double travel;
  final VoidCallback? onFolded;
  final VoidCallback? onRestored;

  /// The slide and fade, then the fold.
  static const Duration slide = Duration(milliseconds: 200);
  static const Duration fold = Duration(milliseconds: 200);

  /// The share of the whole timeline the slide takes.
  static double get slideShare => slide.inMicroseconds / (slide + fold).inMicroseconds;

  @override
  State<MmFoldExit> createState() => _MmFoldExitState();
}

class _MmFoldExitState extends State<MmFoldExit> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(
    vsync: this,
    duration: MmFoldExit.slide + MmFoldExit.fold,
    value: widget.folded ? 1 : 0,
  )..addStatusListener(_status);

  void _status(AnimationStatus s) {
    if (s == AnimationStatus.completed) widget.onFolded?.call();
    if (s == AnimationStatus.dismissed) widget.onRestored?.call();
  }

  @override
  void didUpdateWidget(MmFoldExit old) {
    super.didUpdateWidget(old);
    if (old.folded == widget.folded) return;
    final reduced = Motion.reduced(context);
    if (reduced) {
      _t.duration = Motion.reducedFade;
      if (widget.folded) {
        _t.forward();
      } else {
        _t.reverse();
      }
      return;
    }
    _t.duration = MmFoldExit.slide + MmFoldExit.fold;
    if (widget.folded) {
      _t.forward();
    } else {
      _t.reverse();
    }
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final share = MmFoldExit.slideShare;
    return AnimatedBuilder(
      animation: _t,
      builder: (context, child) {
        final v = _t.value;
        final double fade;
        final double move;
        final double height;
        if (reduced) {
          fade = 1 - v;
          move = 0;
          height = v >= 1 ? 0.0 : 1.0;
        } else {
          final a = (v / share).clamp(0.0, 1.0);
          final b = ((v - share) / (1 - share)).clamp(0.0, 1.0);
          // Out, never ease-in (AP1-14, standards s8 [T-103]): the row answers at once and keeps
          // moving, so a swiped row never hangs before it goes.
          fade = 1 - Motion.out.transform(a);
          move = widget.travel * Motion.out.transform(a);
          height = 1 - Motion.out.transform(b);
        }
        // One structure at every value, so the row keeps its state through a fold and an Undo.
        return IgnorePointer(
          ignoring: v > 0,
          child: ExcludeSemantics(
            excluding: v >= 1,
            child: ClipRect(
              clipBehavior: height < 1 ? Clip.hardEdge : Clip.none,
              child: Align(
                alignment: Alignment.topCenter,
                heightFactor: height.clamp(0.0, 1.0),
                child: Opacity(
                  opacity: fade.clamp(0.0, 1.0),
                  child: Transform.translate(offset: Offset(move, 0), child: child),
                ),
              ),
            ),
          ),
        );
      },
      child: RepaintBoundary(child: widget.child),
    );
  }
}
