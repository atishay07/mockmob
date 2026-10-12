import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'art/mm_art.dart';
import 'key_button.dart';
import 'materials/light_field.dart';
import 'mobi.dart';

enum StateViewKind { empty, error, offline }

/// A label and handler for one of the (at most two) actions of a [StateView].
class StateAction {
  const StateAction(this.label, this.onPressed);

  final String label;
  final VoidCallback onPressed;
}

/// An empty, error or offline state: Mobi in a small pool of lamp light, a title, a message and
/// up to two actions (the volt pill and a quiet one). Empty shows Mobi resting (or the
/// all-clear vignette), offline shows sleepy Mobi (or the offline vignette), error shows Mobi
/// thinking. Pass a [pose] to choose Mobi yourself. Every ending is designed: pass the recovery
/// action here.
class StateView extends StatelessWidget {
  const StateView({
    super.key,
    required this.kind,
    required this.title,
    this.message,
    this.primary,
    this.secondary,
    this.pose = MobiPose.idle,
  }) : assert(primary != null || secondary == null, 'A secondary action needs a primary action.');

  final StateViewKind kind;
  final String title;
  final String? message;
  final StateAction? primary;
  final StateAction? secondary;

  /// [MobiPose.idle] (the default) lets the kind choose the art.
  final MobiPose pose;

  Widget _art(double size) {
    if (pose != MobiPose.idle) return Mobi(pose: pose, size: size, motion: MobiMotion.settle);
    return switch (kind) {
      StateViewKind.empty => _Vignette(art: MmArt.emptyAllClear, height: size * 1.3),
      StateViewKind.offline => _Vignette(art: MmArt.emptyOffline, height: size * 1.3),
      StateViewKind.error => Mobi(pose: MobiPose.think, size: size, motion: MobiMotion.settle),
    };
  }

  @override
  Widget build(BuildContext context) {
    // Centred when it fits; scrolls (never clips) at large text sizes. Short slots get a
    // smaller Mobi so the actions stay in view.
    return LayoutBuilder(
      builder: (context, constraints) {
        final bounded = constraints.hasBoundedHeight;
        final compact = bounded && constraints.maxHeight < 600;
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: bounded ? constraints.maxHeight : 0),
            child: _content(context, compact),
          ),
        );
      },
    );
  }

  Widget _content(BuildContext context, bool compact) {
    final colors = context.mmColors;
    final type = context.mmType;
    final artSize = compact ? 80.0 : 112.0;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: artSize * 1.5,
                child: Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    Positioned.fill(
                      child: LightField(
                        pools: [
                          LightPool(
                            color: colors.lamp.withValues(alpha: colors.isNight ? 0.18 : 0.16),
                            center: const Alignment(-0.15, 0.15),
                            radius: 0.24,
                            aspect: 1.8,
                          ),
                        ],
                      ),
                    ),
                    _art(artSize),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s20),
              Semantics(
                header: true,
                child: Text(title, style: type.title, textAlign: TextAlign.center),
              ),
              if (message != null) ...[
                const SizedBox(height: MmSpace.s8),
                Text(message!, style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
              ],
              if (primary != null) ...[
                const SizedBox(height: MmSpace.s24),
                KeyButton(label: primary!.label, onPressed: primary!.onPressed),
              ],
              if (secondary != null) ...[
                const SizedBox(height: MmSpace.s4),
                Align(child: KeyButton.quiet(label: secondary!.label, onPressed: secondary!.onPressed)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A landscape vignette with Mobi, settling once like Mobi does.
class _Vignette extends StatefulWidget {
  const _Vignette({required this.art, required this.height});

  final MmArt art;
  final double height;

  @override
  State<_Vignette> createState() => _VignetteState();
}

class _VignetteState extends State<_Vignette> with SingleTickerProviderStateMixin {
  late final AnimationController _settle = AnimationController(vsync: this, duration: Mobi.settleDuration);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_settle.isAnimating || _settle.value > 0) return;
    if (Motion.reduced(context)) {
      _settle.value = 1;
    } else {
      _settle.forward();
    }
  }

  @override
  void dispose() {
    _settle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _settle,
        builder: (context, child) {
          final e = Motion.emphasized.transform(_settle.value);
          return Transform.translate(offset: Offset(0, 6 * (1 - e)), child: child);
        },
        child: ArtImage(widget.art, height: widget.height),
      ),
    );
  }
}
