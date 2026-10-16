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
/// the window gives way to the page. Clip, scale and fade only; the page is laid out once.
///
/// MOTION.md C4 and C8: the page's content comes through over 30 to 80% of the raw controller on
/// Glide (the raised fill alone carries 0 to 30%), and no glyph shows while the window is under
/// 80% of its final size. The page grows from 0.94 about the origin's centre while it is clipped.
/// Pop decelerates into the card on Emphasized flipped, so it never holds and then snaps.
class MmContainerTransform extends StatelessWidget {
  const MmContainerTransform({super.key, required this.animation, required this.origin, required this.child});

  final Animation<double> animation;
  final Rect origin;
  final Widget child;

  /// The page's scale when the window is closed.
  static const double startScale = 0.94;

  static const Interval _content = Interval(0.30, 0.80, curve: Motion.glide);

  /// The window's growth `t` (0 at the origin, 1 full screen) and the content's opacity for a
  /// raw controller value. [reverse] is a pop.
  static ({double t, double content}) frameAt(double raw, {required bool reverse}) {
    final v = raw.clamp(0.0, 1.0);
    final t = reverse ? Motion.emphasized.flipped.transform(v) : Motion.emphasized.transform(v);
    // Never text in a half-grown window: content is held at 0 until the window passes 80%.
    final gate = ((t - 0.8) / 0.2).clamp(0.0, 1.0);
    final eased = _content.transform(v);
    final content = v >= 1 ? 1.0 : (eased < gate ? eased : gate);
    return (t: t, content: content);
  }

  @override
  Widget build(BuildContext context) {
    final fill = context.mmColors.raised;
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final frame = frameAt(animation.value, reverse: animation.status == AnimationStatus.reverse);
        return _window(frame.t, frame.content, fill, child!);
      },
    );
  }

  Widget _window(double t, double content, Color fill, Widget child) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final centre = origin.center;
        final alignment = size.width > 0 && size.height > 0 && size.isFinite
            ? Alignment(centre.dx / size.width * 2 - 1, centre.dy / size.height * 2 - 1)
            : Alignment.center;
        final scale = t >= 1 ? 1.0 : startScale + (1 - startScale) * t;
        return ClipPath(
          clipper: _WindowClipper(origin: origin, t: t),
          // Once open, nothing is clipped: the page costs what it costs anywhere else.
          clipBehavior: t >= 1 ? Clip.none : Clip.antiAlias,
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              Transform.scale(
                scale: scale,
                alignment: alignment,
                child: Opacity(opacity: content, child: child),
              ),
              if (content < 1)
                Positioned.fill(child: IgnorePointer(child: ColoredBox(color: fill.withValues(alpha: 1 - content)))),
            ],
          ),
        );
      },
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

/// The tab switch (DOCK.md section 5.4, MOTION.md C1): the outgoing branch fades out in about 90 ms
/// on exit (the incoming one is already rising by 60 ms: no blank frame), drifting 6 dp against the travel; then the incoming branch fades in over 200 ms on
/// glide, sliding 10 dp in from the side the bar's lens travelled toward (transforms only). The
/// bar's visual order (Today, Practice, Start, Review, Colleges, You) keeps branch order, so the branch
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
  late int _current = widget.currentIndex;

  /// Branches fading out, with the opacity and offset each had when the switch began (MOTION.md
  /// 1.1 Robustness: a switch during a switch starts from the current value, nothing jumps). A
  /// third branch still on screen from an earlier switch fades out with the rest over the out
  /// share (90 ms) instead of going offstage.
  final Map<int, ({double opacity, double dx})> _leaving = {};

  /// The incoming branch's opacity and offset when the switch began: 0 and a full slide for a
  /// branch that was offstage, its live values for one that was mid-fade.
  double _inFrom = 1;
  double _inDxFrom = 0;

  /// 1 when the new branch is to the right of the old one (it slides in from the right).
  double _side = 1;
  bool _reducedSwitch = false;

  double get _split =>
      FadingBranchContainer.fadeOut.inMicroseconds / (FadingBranchContainer.fadeOut + FadingBranchContainer.fadeIn).inMicroseconds;

  /// The hand-over overlaps: the outgoing tab is fading over the first [_split] of the switch
  /// while the incoming one starts at [_overlapStart], so there is never a frame with neither
  /// on screen (they used to meet at zero opacity at 90 ms).
  static const double _overlapStart = 0.22;

  late final Animation<double> _in = CurvedAnimation(parent: _controller, curve: const Interval(_overlapStart, 1, curve: Motion.glide));
  late final Animation<double> _out = ReverseAnimation(CurvedAnimation(parent: _controller, curve: Interval(0, _split + 0.1, curve: Motion.exit)));

  late final List<Animation<double>> _opacities = [
    for (var i = 0; i < widget.children.length; i++) _BranchOpacity(_controller, () => _opacityOf(i)),
  ];

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && _leaving.isNotEmpty) setState(_leaving.clear);
    });
  }

  double _inProgress() => _reducedSwitch ? _controller.value : _in.value;
  double _outProgress() => _reducedSwitch ? 1 - _controller.value : _out.value;

  double _opacityOf(int i) {
    if (i == _current) return _inFrom + (1 - _inFrom) * _inProgress();
    final leaving = _leaving[i];
    if (leaving != null) return leaving.opacity * _outProgress();
    return 0;
  }

  double _dxOf(int i) {
    if (_reducedSwitch) return 0;
    if (i == _current) return _inDxFrom * (1 - _in.value);
    final leaving = _leaving[i];
    if (leaving != null) return leaving.dx - FadingBranchContainer.drift * _side * (1 - _out.value);
    return 0;
  }

  @override
  void didUpdateWidget(FadingBranchContainer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex == _current) return;
    final next = widget.currentIndex;
    // Snapshot what is on screen now, before the switch changes the roles.
    final snapshot = <int, ({double opacity, double dx})>{
      for (final i in {_current, ..._leaving.keys}) i: (opacity: _opacityOf(i), dx: _dxOf(i)),
    };
    final incoming = snapshot.remove(next);
    _side = next > _current ? 1 : -1;
    _reducedSwitch = Motion.reduced(context);
    _leaving
      ..clear()
      ..addEntries(snapshot.entries.where((e) => e.value.opacity > 0.001));
    _inFrom = incoming?.opacity ?? 0;
    _inDxFrom = incoming?.dx ?? FadingBranchContainer.slide * _side;
    _current = next;
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
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < widget.children.length; i++)
          Offstage(
            offstage: i != _current && !_leaving.containsKey(i),
            child: TickerMode(
              enabled: i == _current,
              // Same widget types for every branch, so switching tabs never remounts one.
              child: IgnorePointer(
                ignoring: i != _current,
                child: FadeTransition(
                  opacity: i < _opacities.length ? _opacities[i] : kAlwaysCompleteAnimation,
                  // Always the same wrapper, so a branch never remounts; only the branches in
                  // the switch are offset.
                  child: AnimatedBuilder(
                    animation: _controller,
                    builder: (context, child) => Transform.translate(offset: Offset(_dxOf(i), 0), child: child),
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

/// One branch's opacity in a switch, read from the container's state on every tick.
class _BranchOpacity extends Animation<double> with AnimationWithParentMixin<double> {
  _BranchOpacity(this.parent, this._value);

  @override
  final Animation<double> parent;
  final double Function() _value;

  @override
  double get value => _value().clamp(0.0, 1.0);
}
