import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/glass_surface.dart';

/// A container transform from a small glass shape (the Start circle) into a glass sheet at the
/// bottom of the screen (brief section 6): the glass grows out of [origin] along the emphasized
/// curve in 420 ms while the sheet's content glides in once the glass has mostly opened. Back,
/// the scrim and a drag down close it the same way: the sheet follows the finger, closes past
/// [closeFraction] of its height or on a flick faster than [closeVelocity], and springs back
/// otherwise. TalkBack gets a "Close" action. Under reduced motion it is a 200 ms fade.
class MorphSheetRoute<T> extends PopupRoute<T> {
  MorphSheetRoute({
    required this.origin,
    required this.builder,
    required this.scrim,
    required this.reduced,
    this.semanticsLabel,
    super.settings,
  });

  /// The shape the sheet grows from, in global coordinates.
  final Rect origin;
  final WidgetBuilder builder;
  final Color scrim;
  final bool reduced;
  final String? semanticsLabel;

  static const double margin = 10;

  /// A drag past this share of the sheet's height closes it.
  static const double closeFraction = 0.3;

  /// A release faster than this (logical px per second, downward) closes it.
  static const double closeVelocity = 300;

  @override
  Color? get barrierColor => scrim;

  @override
  bool get barrierDismissible => true;

  @override
  String? get barrierLabel => 'Close';

  @override
  Duration get transitionDuration => reduced ? Motion.crossFade : Motion.emphasizedDuration;

  @override
  Duration get reverseTransitionDuration => reduced ? Motion.crossFade : const Duration(milliseconds: 300);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    final media = MediaQuery.of(context);
    final bottom = media.viewPadding.bottom + margin;
    void close() => Navigator.of(context).maybePop();
    final content = Semantics(
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label: semanticsLabel,
      onDismiss: close,
      customSemanticsActions: {const CustomSemanticsAction(label: 'Close'): close},
      // Text and ink need a Material ancestor; the glass is the surface, so it is transparent.
      child: Material(type: MaterialType.transparency, child: builder(context)),
    );

    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: EdgeInsets.fromLTRB(margin, 0, margin, bottom),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
          child: _DragToClose(
            reduced: reduced,
            onClose: close,
            child: AnimatedBuilder(
              animation: animation,
              builder: (context, child) {
                if (reduced) return FadeTransition(opacity: animation, child: child);
                return ClipRRect(
                  clipper: _MorphClipper(
                    origin: origin,
                    progress: Motion.emphasized.transform(animation.value),
                    screen: media.size,
                    bottom: bottom,
                    margin: margin,
                  ),
                  child: child,
                );
              },
              child: GlassSurface(
                role: GlassRole.sheet,
                borderRadius: const BorderRadius.all(Radius.circular(30)),
                child: _ContentReveal(animation: animation, reduced: reduced, child: content),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Lets the sheet follow a downward drag, then closes it or springs it back.
class _DragToClose extends StatefulWidget {
  const _DragToClose({required this.reduced, required this.onClose, required this.child});

  final bool reduced;
  final VoidCallback onClose;
  final Widget child;

  @override
  State<_DragToClose> createState() => _DragToCloseState();
}

class _DragToCloseState extends State<_DragToClose> with SingleTickerProviderStateMixin {
  late final AnimationController _offset = AnimationController.unbounded(vsync: this);
  bool _closing = false;

  @override
  void dispose() {
    _offset.dispose();
    super.dispose();
  }

  double get _height => context.size?.height ?? 1;

  void _update(DragUpdateDetails d) {
    if (_closing) return;
    _offset.stop();
    // Down follows the finger; up barely gives, the sheet already sits on the floor.
    final next = _offset.value + d.delta.dy;
    _offset.value = next < -6 ? -6 : next;
  }

  void _end(DragEndDetails d) {
    if (_closing) return;
    final velocity = d.primaryVelocity ?? 0;
    if (_offset.value > _height * MorphSheetRoute.closeFraction || velocity > MorphSheetRoute.closeVelocity) {
      _closing = true;
      widget.onClose();
      return;
    }
    if (widget.reduced) {
      _offset.value = 0;
    } else {
      _offset.animateWith(Motion.spring(Springs.smooth, _offset.value, 0, velocity: velocity));
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragUpdate: _update,
      onVerticalDragEnd: _end,
      onVerticalDragCancel: () => _end(DragEndDetails(primaryVelocity: 0)),
      child: AnimatedBuilder(
        animation: _offset,
        builder: (context, child) => Transform.translate(offset: Offset(0, _offset.value), child: child),
        child: widget.child,
      ),
    );
  }
}

class _ContentReveal extends StatelessWidget {
  const _ContentReveal({required this.animation, required this.reduced, required this.child});

  final Animation<double> animation;
  final bool reduced;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (reduced) return child;
    final fade = CurvedAnimation(parent: animation, curve: const Interval(0.35, 1, curve: Motion.glide), reverseCurve: const Interval(0.4, 1));
    return FadeTransition(
      opacity: fade,
      child: AnimatedBuilder(
        animation: fade,
        builder: (context, child) => Transform.translate(offset: Offset(0, 14 * (1 - fade.value)), child: child),
        child: child,
      ),
    );
  }
}

/// Clips the sheet to a rounded rectangle that grows from the origin circle to the full sheet.
class _MorphClipper extends CustomClipper<RRect> {
  const _MorphClipper({required this.origin, required this.progress, required this.screen, required this.bottom, required this.margin});

  final Rect origin;
  final double progress;
  final Size screen;
  final double bottom;
  final double margin;

  @override
  RRect getClip(Size size) {
    // The sheet's top-left in global coordinates (it is centred, bottom aligned).
    final left = (screen.width - size.width) / 2;
    final top = screen.height - bottom - size.height;
    final from = origin.shift(Offset(-left, -top));
    final to = Offset.zero & size;
    final rect = Rect.lerp(from, to, progress)!;
    final radius = Radius.circular(30 + (origin.shortestSide / 2 - 30) * (1 - progress));
    return RRect.fromRectAndRadius(rect, radius);
  }

  @override
  bool shouldReclip(_MorphClipper old) =>
      old.progress != progress || old.origin != origin || old.screen != screen || old.bottom != bottom;
}
