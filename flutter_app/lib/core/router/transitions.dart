import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';

/// The page transitions (Night Sheet brief section 7; docs/brain/ui-blitz/motion.md 3.5).
enum MmTransition {
  /// Shared-axis push: the page arrives 28 dp from the trailing edge, fading in over the first
  /// 60% on Glide, while the page under it recedes. Back reverses it.
  push,

  /// Runner and focus screens: a short fade both ways, no travel.
  fade,

  /// A focus page rising 24 dp from 0.97 with a fade (results, endings, You).
  rise,

  /// Grows out of the surface the student tapped (`MmPressable(captureLaunch: true)` or
  /// [MmLaunchRect.capture]) on Emphasized 420 ms; [rise] when nothing was captured.
  container,
}

/// Launch rects taken by container pages, by page key: go_router rebuilds a page's object on
/// every navigation, and a rebuild must keep the rect the page was opened with.
final Map<ValueKey<String>, Rect?> _containerOrigins = {};

Rect? _originFor(ValueKey<String> key) {
  if (_containerOrigins.containsKey(key)) return _containerOrigins[key];
  if (_containerOrigins.length > 24) _containerOrigins.remove(_containerOrigins.keys.first);
  return _containerOrigins[key] = MmLaunchRect.take();
}

/// A page with a MockMob transition. Under reduced motion every transition is a 120 ms fade
/// and nothing recedes.
CustomTransitionPage<T> mmPage<T>({
  required BuildContext context,
  required GoRouterState state,
  required Widget child,
  MmTransition transition = MmTransition.push,
}) {
  final reduced = Motion.reduced(context);
  final origin = transition == MmTransition.container && !reduced ? _originFor(state.pageKey) : null;
  final kind = reduced
      ? MmTransition.fade
      : transition == MmTransition.container && origin == null
      ? MmTransition.rise
      : transition;
  final forward = switch (kind) {
    _ when reduced => Motion.reducedFade,
    MmTransition.push => Motion.pagePush,
    MmTransition.fade => Motion.runner,
    MmTransition.rise => Motion.glideDuration + const Duration(milliseconds: 40),
    MmTransition.container => Motion.emphasizedDuration,
  };
  final backward = switch (kind) {
    _ when reduced => Motion.reducedFade,
    MmTransition.push => Motion.pagePop,
    MmTransition.fade => Motion.runner,
    MmTransition.rise => Motion.pagePop,
    MmTransition.container => const Duration(milliseconds: 340),
  };

  return CustomTransitionPage<T>(
    key: state.pageKey,
    name: state.name ?? state.path,
    arguments: state.extra,
    restorationId: state.pageKey.value,
    child: child,
    transitionDuration: forward,
    reverseTransitionDuration: backward,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final entered = switch (kind) {
        MmTransition.push => MmSharedAxisPush(animation: animation, child: child),
        MmTransition.fade => FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Motion.glide, reverseCurve: Motion.exit.flipped),
          child: child,
        ),
        MmTransition.rise => MmRiseTransition(animation: animation, child: child),
        MmTransition.container => MmContainerTransform(animation: animation, origin: origin!, child: child),
      };
      // A fade page (the runner) never recedes: nothing is pushed over it but its own steps.
      if (reduced || kind == MmTransition.fade) return entered;
      return MmRecede(animation: secondaryAnimation, child: entered);
    },
  );
}

/// The tab roots' page: no transition of its own (the branch fades through), but it recedes
/// when a page is pushed over it inside its tab.
CustomTransitionPage<T> mmTabRootPage<T>({required BuildContext context, required GoRouterState state, required Widget child}) {
  final reduced = Motion.reduced(context);
  return CustomTransitionPage<T>(
    key: state.pageKey,
    name: state.name ?? state.path,
    arguments: state.extra,
    restorationId: state.pageKey.value,
    child: child,
    transitionDuration: Duration.zero,
    reverseTransitionDuration: Duration.zero,
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        reduced ? child : MmRecede(animation: secondaryAnimation, child: child),
  );
}

/// The shell's page (the three tabs and the dock): fades in once, and recedes with the dock
/// under any page pushed over it (Revolut's "first the card, then the details").
CustomTransitionPage<T> mmShellPage<T>({required BuildContext context, required GoRouterState state, required Widget child}) {
  final reduced = Motion.reduced(context);
  return CustomTransitionPage<T>(
    key: state.pageKey,
    name: state.name ?? state.path,
    child: child,
    transitionDuration: reduced ? Motion.reducedFade : Motion.glideDuration,
    reverseTransitionDuration: reduced ? Motion.reducedFade : Motion.pagePop,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final faded = FadeTransition(opacity: CurvedAnimation(parent: animation, curve: Motion.glide), child: child);
      return reduced ? faded : MmRecede(animation: secondaryAnimation, child: faded);
    },
  );
}

/// The incoming half of the shared-axis push: [Motion.axisTravel] from the trailing edge, a
/// fade over the first 60%, Glide in and Exit out.
class MmSharedAxisPush extends StatelessWidget {
  const MmSharedAxisPush({super.key, required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final direction = Directionality.of(context) == TextDirection.rtl ? -1.0 : 1.0;
    final travel = CurvedAnimation(parent: animation, curve: Motion.glide, reverseCurve: Motion.exit.flipped);
    final fade = CurvedAnimation(
      parent: animation,
      curve: const Interval(0, 0.6, curve: Motion.glide),
      reverseCurve: const Interval(0.25, 1, curve: Curves.linear),
    );
    return FadeTransition(
      opacity: fade,
      child: AnimatedBuilder(
        animation: travel,
        child: child,
        builder: (context, child) =>
            Transform.translate(offset: Offset(Motion.axisTravel * direction * (1 - travel.value), 0), child: child),
      ),
    );
  }
}

/// A focus page rising 24 dp from 0.97 with a fade.
class MmRiseTransition extends StatelessWidget {
  const MmRiseTransition({super.key, required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: animation, curve: Motion.emphasized, reverseCurve: Motion.exit.flipped);
    final fade = CurvedAnimation(parent: animation, curve: const Interval(0, 0.5, curve: Motion.glide));
    return FadeTransition(
      opacity: fade,
      child: AnimatedBuilder(
        animation: curved,
        child: child,
        builder: (context, child) {
          final t = curved.value;
          return Transform.translate(
            offset: Offset(0, 24 * (1 - t)),
            child: Transform.scale(scale: 0.97 + 0.03 * t, child: child),
          );
        },
      ),
    );
  }
}

/// A container transform: the page shows through a rounded window that grows from [origin]
/// (global) to the full screen, its corners opening from 24 dp to square, while a raised fill in
/// the window gives way to the page. Clip and fade only; the page is laid out once.
class MmContainerTransform extends StatelessWidget {
  const MmContainerTransform({super.key, required this.animation, required this.origin, required this.child});

  final Animation<double> animation;
  final Rect origin;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final fill = context.mmColors.raised;
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final t = Motion.emphasized.transform(animation.value.clamp(0.0, 1.0));
        return _window(t, fill, child!);
      },
    );
  }

  Widget _window(double t, Color fill, Widget child) {
    // Content comes through over the first 45% of the travel; the raised fill fades as it does.
    final content = (t / 0.45).clamp(0.0, 1.0);
    return ClipPath(
      clipper: _WindowClipper(origin: origin, t: t),
      // Once open, nothing is clipped: the page costs what it costs anywhere else.
      clipBehavior: t >= 1 ? Clip.none : Clip.antiAlias,
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          Opacity(opacity: content, child: child),
          if (content < 1)
            Positioned.fill(child: IgnorePointer(child: ColoredBox(color: fill.withValues(alpha: 1 - content)))),
        ],
      ),
    );
  }
}

class _WindowClipper extends CustomClipper<Path> {
  const _WindowClipper({required this.origin, required this.t});

  final Rect origin;
  final double t;

  @override
  Path getClip(Size size) {
    if (t >= 1) return Path()..addRect(Offset.zero & size);
    final rect = Rect.lerp(origin, Offset.zero & size, t)!;
    final radius = Radius.circular(24 * (1 - t));
    return Path()..addRRect(RRect.fromRectAndRadius(rect, radius));
  }

  @override
  bool shouldReclip(_WindowClipper old) => old.t != t || old.origin != origin;
}

/// The page under a push: moves [Motion.recedeShare] of the travel the other way and dims under
/// a ground scrim to [Motion.recedeScrim], so the new page reads as coming over it. A foreground
/// paint, no layer.
class MmRecede extends StatelessWidget {
  const MmRecede({super.key, required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    final direction = Directionality.of(context) == TextDirection.rtl ? -1.0 : 1.0;
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final t = Motion.glide.transform(animation.value.clamp(0.0, 1.0));
        return Transform.translate(
          offset: Offset(-Motion.axisTravel * Motion.recedeShare * direction * t, 0),
          child: DecoratedBox(
            position: DecorationPosition.foreground,
            decoration: BoxDecoration(color: ground.withValues(alpha: Motion.recedeScrim * t)),
            child: child,
          ),
        );
      },
    );
  }
}

/// The same push and recede for plain `Navigator` routes (`MaterialPageRoute`): put it in the
/// theme's `PageTransitionsTheme` so a route opened outside go_router moves like the rest.
class MmPageTransitionsBuilder extends PageTransitionsBuilder {
  const MmPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (Motion.reduced(context)) return FadeTransition(opacity: animation, child: child);
    final pushed = route.isFirst ? child : MmSharedAxisPush(animation: animation, child: child);
    return MmRecede(animation: secondaryAnimation, child: pushed);
  }
}

/// The tab switch (DOCK.md section 5.4, MOTION.md C1): the outgoing branch fades out in 90 ms on
/// exit, drifting 6 dp against the travel; then the incoming branch fades in over 200 ms on
/// glide, sliding 10 dp in from the side the bar's lens travelled toward (transforms only). The
/// bar's visual order (Today, Practice, Start, Review, You) keeps branch order, so the branch
/// index gives the direction. The branches stay mounted, like an `IndexedStack`, so
/// each keeps its own navigation state; only the two involved are painted, and only for the
/// switch. Under reduced motion it is a 120 ms fade.
class FadingBranchContainer extends StatefulWidget {
  const FadingBranchContainer({super.key, required this.currentIndex, required this.children});

  final int currentIndex;
  final List<Widget> children;

  static const Duration fadeOut = Duration(milliseconds: 90);
  static const Duration fadeIn = Duration(milliseconds: 200);

  /// How far the incoming branch slides.
  static const double slide = 10;

  /// How far the outgoing branch drifts, against the travel.
  static const double drift = 6;

  @override
  State<FadingBranchContainer> createState() => _FadingBranchContainerState();
}

class _FadingBranchContainerState extends State<FadingBranchContainer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: FadingBranchContainer.fadeOut + FadingBranchContainer.fadeIn, value: 1);
  int? _previous;

  /// 1 when the new branch is to the right of the old one (it slides in from the right).
  double _side = 1;
  bool _reducedSwitch = false;

  double get _split =>
      FadingBranchContainer.fadeOut.inMicroseconds / (FadingBranchContainer.fadeOut + FadingBranchContainer.fadeIn).inMicroseconds;

  late final Animation<double> _in = CurvedAnimation(parent: _controller, curve: Interval(_split, 1, curve: Motion.glide));
  late final Animation<double> _out = ReverseAnimation(CurvedAnimation(parent: _controller, curve: Interval(0, _split, curve: Motion.exit)));

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && _previous != null) setState(() => _previous = null);
    });
  }

  @override
  void didUpdateWidget(FadingBranchContainer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex == widget.currentIndex) return;
    _side = widget.currentIndex > oldWidget.currentIndex ? 1 : -1;
    _reducedSwitch = Motion.reduced(context);
    _previous = oldWidget.currentIndex;
    _controller.duration = _reducedSwitch ? Motion.reducedFade : FadingBranchContainer.fadeOut + FadingBranchContainer.fadeIn;
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final previous = _previous;
    final reduced = _reducedSwitch;
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < widget.children.length; i++)
          Offstage(
            offstage: i != widget.currentIndex && i != previous,
            child: TickerMode(
              enabled: i == widget.currentIndex,
              // Same widget types for every branch, so switching tabs never remounts one.
              child: IgnorePointer(
                ignoring: i != widget.currentIndex,
                child: FadeTransition(
                  opacity: i == widget.currentIndex
                      ? (reduced ? _controller : _in)
                      : i == previous
                      ? (reduced ? ReverseAnimation(_controller) : _out)
                      : kAlwaysCompleteAnimation,
                  // Always the same wrapper, so a branch never remounts; only the two branches
                  // in the switch are offset.
                  child: AnimatedBuilder(
                    animation: _controller,
                    builder: (context, child) => Transform.translate(
                      offset: Offset(
                        reduced
                            ? 0
                            : i == widget.currentIndex
                            ? FadingBranchContainer.slide * _side * (1 - _in.value)
                            : i == previous && _controller.isAnimating
                            ? -FadingBranchContainer.drift * _side * (1 - _out.value)
                            : 0,
                        0,
                      ),
                      child: child,
                    ),
                    child: widget.children[i],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
