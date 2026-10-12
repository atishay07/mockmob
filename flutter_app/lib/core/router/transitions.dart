import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../motion/motion.dart';

/// The page transitions of spec 3.2.
enum MmTransition {
  /// Push: 220 ms fade plus a 12 dp slide from the trailing edge; pop 180 ms.
  push,

  /// Runner and focus screens: 120 ms fade both ways, no travel.
  fade,
}

/// A page with a MockMob transition. Under reduced motion every transition is a 120 ms fade.
CustomTransitionPage<T> mmPage<T>({
  required BuildContext context,
  required GoRouterState state,
  required Widget child,
  MmTransition transition = MmTransition.push,
}) {
  final reduced = Motion.reduced(context);
  final slides = transition == MmTransition.push && !reduced;
  final forward = switch (transition) {
    MmTransition.push => reduced ? Motion.reducedFade : Motion.pagePush,
    MmTransition.fade => reduced ? Motion.reducedFade : Motion.runner,
  };
  final backward = switch (transition) {
    MmTransition.push => reduced ? Motion.reducedFade : Motion.pagePop,
    MmTransition.fade => reduced ? Motion.reducedFade : Motion.runner,
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
      final curved = CurvedAnimation(parent: animation, curve: Motion.out, reverseCurve: Curves.easeOut);
      final faded = FadeTransition(opacity: curved, child: child);
      if (!slides) return faded;
      final direction = Directionality.of(context) == TextDirection.rtl ? -1.0 : 1.0;
      return AnimatedBuilder(
        animation: curved,
        child: faded,
        builder: (context, child) => Transform.translate(offset: Offset(12 * direction * (1 - curved.value), 0), child: child),
      );
    },
  );
}

/// Fades the tab branches in 140 ms on a tab switch, with no travel (spec 3.2). The branches
/// stay mounted, like an `IndexedStack`, so each keeps its own navigation state.
class FadingBranchContainer extends StatefulWidget {
  const FadingBranchContainer({super.key, required this.currentIndex, required this.children});

  final int currentIndex;
  final List<Widget> children;

  @override
  State<FadingBranchContainer> createState() => _FadingBranchContainerState();
}

class _FadingBranchContainerState extends State<FadingBranchContainer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: Motion.tabSwitch, value: 1);
  late final Animation<double> _fade = CurvedAnimation(parent: _controller, curve: Motion.out);

  @override
  void didUpdateWidget(FadingBranchContainer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex == widget.currentIndex) return;
    if (Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward(from: 0);
    }
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
            offstage: i != widget.currentIndex,
            child: TickerMode(
              enabled: i == widget.currentIndex,
              // Same widget type for every branch, so switching tabs never remounts one.
              child: FadeTransition(
                opacity: i == widget.currentIndex ? _fade : const AlwaysStoppedAnimation<double>(1),
                child: widget.children[i],
              ),
            ),
          ),
      ],
    );
  }
}
