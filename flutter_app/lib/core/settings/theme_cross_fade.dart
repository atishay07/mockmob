import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../motion/motion.dart';
import 'appearance_settings.dart';

/// The Night to Day switch as one deliberate cross-fade (docs/brain/ui-phase2/MOTION.md 1.4).
///
/// `MaterialApp` used to lerp the theme for 200 ms, so painters and cached pictures showed muddy
/// mid-states (half-lit glass, olive ink). Now the app swaps the theme with a zero
/// `themeAnimationDuration`, and this host lays the frame the student was looking at over the new
/// one and fades it out over 250 ms on the glide curve. Under reduced motion there is no snapshot:
/// the switch is instant.
///
/// Put it inside the `MaterialApp` builder, around the app content.
class ThemeCrossFade extends ConsumerStatefulWidget {
  const ThemeCrossFade({super.key, required this.child});

  final Widget child;

  /// How long the old frame takes to fade out.
  static const Duration duration = Duration(milliseconds: 250);

  @override
  ConsumerState<ThemeCrossFade> createState() => _ThemeCrossFadeState();
}

class _ThemeCrossFadeState extends ConsumerState<ThemeCrossFade> with SingleTickerProviderStateMixin {
  final GlobalKey _boundary = GlobalKey();
  late final AnimationController _fade = AnimationController(vsync: this, duration: ThemeCrossFade.duration)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed) _release();
    });
  ui.Image? _snapshot;

  @override
  void dispose() {
    _fade.dispose();
    _snapshot?.dispose();
    _snapshot = null;
    super.dispose();
  }

  /// Called before the new theme paints: the render tree still holds the old frame.
  void _capture() {
    if (Motion.reduced(context)) {
      _release();
      return;
    }
    final object = _boundary.currentContext?.findRenderObject();
    if (object is! RenderRepaintBoundary) return;
    try {
      final ratio = MediaQuery.devicePixelRatioOf(context).clamp(1.0, 2.0);
      final image = object.toImageSync(pixelRatio: ratio);
      _snapshot?.dispose();
      setState(() => _snapshot = image);
      _fade.forward(from: 0);
    } on Object {
      // Not painted yet, or the engine cannot snapshot: the switch is instant, which is correct.
      _release();
    }
  }

  void _release() {
    if (_snapshot == null) return;
    _fade.stop();
    final old = _snapshot;
    setState(() => _snapshot = null);
    old?.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<ThemeMode>(themeModeProvider, (previous, next) {
      if (previous != null && previous != next) _capture();
    });
    final snapshot = _snapshot;
    return Stack(
      fit: StackFit.passthrough,
      children: [
        RepaintBoundary(key: _boundary, child: widget.child),
        if (snapshot != null)
          Positioned.fill(
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: FadeTransition(
                  opacity: ReverseAnimation(CurvedAnimation(parent: _fade, curve: Motion.glide)),
                  child: RawImage(image: snapshot, fit: BoxFit.fill, filterQuality: FilterQuality.low),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
