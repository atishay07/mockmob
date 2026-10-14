import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/glass_surface.dart';

/// A container transform from a small glass shape (the Start circle) into a glass sheet at the
/// bottom of the screen (brief section 6): the glass grows out of [origin] in 420 ms while the
/// sheet's content comes up with it, scaling out of the origin from the first fifth of the
/// morph, so the growing shape is never an empty slab. Back,
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
    this.volt = const Color(0xFFD2F000),
    super.settings,
  });

  /// The shape the sheet grows from, in global coordinates.
  final Rect origin;
  final WidgetBuilder builder;
  final Color scrim;
  final bool reduced;
  final String? semanticsLabel;

  /// The colour of the disc the sheet grows out of (Start's volt).
  final Color volt;

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

  /// Where the content scales out of: the origin's centre, as an alignment inside the sheet.
  Alignment _anchor(Size screen) {
    final width = math.min(screen.width - 2 * margin, MmSpace.contentMaxWidth);
    final left = (screen.width - width) / 2;
    return Alignment(((origin.center.dx - left) / width * 2 - 1).clamp(-1.0, 1.0), 1);
  }

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    final media = MediaQuery.of(context);
    final bottom = media.viewPadding.bottom + margin;
    final colors = context.mmColors;
    final blur = GlassScope.of(context) == GlassQuality.full;
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

    final sheet = Align(
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
                final clipper = _MorphClipper(
                  origin: origin,
                  progress: _growCurve.transform(animation.value),
                  screen: media.size,
                  bottom: bottom,
                  margin: margin,
                );
                return ClipRRect(
                  clipper: clipper,
                  child: Stack(
                    children: [
                      // The glass reads as glass from the first frame: while it grows, the page
                      // behind it is blurred (one filter, clipped to the growing shape, gone
                      // once the sheet has arrived), then the tint thickens under the text.
                      if (blur && animation.value < 0.9)
                        Positioned.fill(
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 14 * (1 - animation.value / 0.9), sigmaY: 14 * (1 - animation.value / 0.9)),
                            child: const SizedBox.expand(),
                          ),
                        ),
                      child ?? const SizedBox.shrink(),
                      // A lamp pool in the upper left and the rim of the growing shape.
                      Positioned.fill(
                        child: IgnorePointer(
                          child: CustomPaint(
                            painter: _MorphRim(
                              animation: animation,
                              clipper: clipper,
                              lamp: colors.lamp.withValues(alpha: colors.isNight ? 0.16 : 0.12),
                              edge: colors.edgeTop,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
              child: AnimatedBuilder(
                animation: animation,
                builder: (context, content) => GlassSurface(
                  role: GlassRole.sheet,
                  borderRadius: const BorderRadius.all(Radius.circular(30)),
                  // Thin at the start (the page shows through), resting density at 55% of the
                  // morph, when the content (arriving from 12%) is mostly in.
                  sheetTintAlpha: reduced ? null : _tintAlpha(animation.value),
                  child: content!,
                ),
                child: _ContentReveal(animation: animation, reduced: reduced, anchor: _anchor(media.size), child: content),
              ),
            ),
          ),
        ),
      ),
    );
    if (reduced) return sheet;
    // Start's volt disc stays where it was and dissolves as the glass grows out of it (and
    // gathers again as the sheet closes into it), so the eye never loses the object it touched.
    return Stack(
      children: [
        sheet,
        Positioned.fromRect(
          rect: origin,
          child: IgnorePointer(
            child: RepaintBoundary(
              child: CustomPaint(painter: _OriginDisc(animation: animation, color: volt)),
            ),
          ),
        ),
      ],
    );
  }
}

/// How the shape grows: fast off the button, then settling. Softer at the start than
/// [Motion.emphasized] (which has already covered most of the way by 50 ms), so the rectangle
/// is seen coming out of the button instead of appearing beside it.
const Cubic _growCurve = Cubic(0.3, 0.55, 0.2, 1);

/// The sheet's tint strength through the morph: 45% at the first frame (the page still shows
/// through the growing glass), the resting 98.5% from 55% of the way, by when the content is
/// mostly in.
double _tintAlpha(double t) => 0.45 + (0.985 - 0.45) * Motion.glide.transform((t / 0.55).clamp(0.0, 1.0));

/// The growing shape's rim and lamp: a warm pool in its upper left and a 1 dp top edge light
/// along its (moving) outline, fading out as the sheet's own edge light takes over.
class _MorphRim extends CustomPainter {
  _MorphRim({required this.animation, required this.clipper, required this.lamp, required this.edge}) : super(repaint: animation);

  final Animation<double> animation;
  final _MorphClipper clipper;
  final Color lamp;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final fade = 1 - Motion.glide.transform(((animation.value - 0.55) / 0.45).clamp(0.0, 1.0));
    if (fade <= 0) return;
    final rrect = clipper.getClip(size);
    final bounds = rrect.outerRect;
    canvas.save();
    canvas.clipRRect(rrect);
    canvas.drawRect(
      bounds,
      Paint()
        ..shader = RadialGradient(
          center: Alignment.topLeft,
          radius: 1.1,
          colors: [lamp.withValues(alpha: lamp.a * fade), lamp.withValues(alpha: 0)],
        ).createShader(Rect.fromLTWH(bounds.left, bounds.top, bounds.width * 1.4, bounds.height * 0.9)),
    );
    canvas.restore();
    canvas.drawRRect(
      rrect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [edge.withValues(alpha: (edge.a * 1.6).clamp(0.0, 1.0) * fade), edge.withValues(alpha: 0)],
        ).createShader(bounds),
    );
  }

  @override
  bool shouldRepaint(_MorphRim old) => old.animation != animation || old.clipper != clipper || old.lamp != lamp || old.edge != edge;
}

/// The volt disc left at the origin: full at 0, swelling a little and gone by 30% of the morph.
class _OriginDisc extends CustomPainter {
  _OriginDisc({required this.animation, required this.color}) : super(repaint: animation);

  final Animation<double> animation;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // Gone by 30% of the morph, its alpha falling fastest at first, so the volt never
    // sits half-faded (olive) over the glass.
    final t = (animation.value / 0.3).clamp(0.0, 1.0);
    if (t >= 1) return;
    final e = Motion.glide.transform(t);
    final alpha = (1 - e) * (1 - e);
    canvas.drawCircle(size.center(Offset.zero), 23 * (1 + 0.2 * e), Paint()..color = color.withValues(alpha: alpha));
  }

  @override
  bool shouldRepaint(_OriginDisc old) => old.animation != animation || old.color != color;
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

/// The sheet's content riding the growing glass: it fades in over 12% to 62% of the morph and
/// scales up from 0.5 with the glass, out of the origin (the button), so the shape is never an empty slab and
/// the text seems to come out of the button with it. Closing, it leaves over the first half.
class _ContentReveal extends StatelessWidget {
  const _ContentReveal({required this.animation, required this.reduced, required this.anchor, required this.child});

  final Animation<double> animation;
  final bool reduced;
  final Alignment anchor;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (reduced) return child;
    final fade = CurvedAnimation(parent: animation, curve: const Interval(0.12, 0.62, curve: Motion.glide), reverseCurve: const Interval(0.4, 1));
    return FadeTransition(
      opacity: fade,
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, 14 * (1 - fade.value)),
          // The content grows with the glass (half size at the first frame), so it sits inside
          // the rising shape and is not cropped by its left edge: it comes out of the button.
          child: Transform.scale(scale: 0.5 + 0.5 * _growCurve.transform(animation.value.clamp(0.0, 1.0)), alignment: anchor, child: child),
        ),
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
