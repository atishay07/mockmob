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
  const StateAction(this.label, this.onPressed, {this.loading = false});

  final String label;
  final VoidCallback onPressed;

  /// The action is running: the main key shows its spinner in place, keeps its size and ignores
  /// taps. Only the primary action shows it; the quiet secondary key has no spinner.
  final bool loading;
}

/// An empty, error or offline state: Mobi in a small pool of lamp light, a title, a message and
/// up to two actions (the volt pill and a quiet one). Empty shows the living Mobi reading,
/// offline shows Mobi resting, error shows Mobi thinking, in both themes. Pass a [pose] to choose Mobi yourself. Every ending is designed: pass the recovery
/// action here.
class StateView extends StatefulWidget {
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

  @override
  State<StateView> createState() => _StateViewState();
}

class _StateViewState extends State<StateView> {
  final MobiController _mobi = MobiController();
  final GlobalKey _action = GlobalKey(debugLabel: 'state-view-action');

  StateViewKind get kind => widget.kind;
  String get title => widget.title;
  String? get message => widget.message;
  StateAction? get primary => widget.primary;
  StateAction? get secondary => widget.secondary;
  MobiPose get pose => widget.pose;

  @override
  void initState() {
    super.initState();
    // Mobi's eyes lead the reader to the way out: once the screen is laid out it looks at the
    // main action (a held glance, not an idle loop). Still under reduced motion.
    if (widget.primary != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.lookAtWidget(_action);
      });
    }
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  Widget _art(BuildContext context, double size) {
    if (pose != MobiPose.idle) return Mobi(pose: pose, size: size, motion: MobiMotion.settle, controller: _mobi);
    // The living Mobi in both themes: reading over an empty sheet, resting while offline,
    // thinking over an error. The lamp-lit raster vignettes stay only behind the MOBI_RASTER
    // fallback, and only on Night, where they melt into the ground.
    if (Mobi.rasterFallback && context.mmColors.isNight) {
      switch (kind) {
        case StateViewKind.empty:
          return _Vignette(art: MmArt.emptyAllClear, height: size * 1.3);
        case StateViewKind.offline:
          return _Vignette(art: MmArt.emptyOffline, height: size * 1.3);
        case StateViewKind.error:
          break;
      }
    }
    return switch (kind) {
      StateViewKind.empty => Mobi(pose: MobiPose.read, size: size, motion: MobiMotion.settle, controller: _mobi),
      StateViewKind.offline => Mobi(pose: MobiPose.rest, size: size, motion: MobiMotion.settle, controller: _mobi),
      StateViewKind.error => Mobi(pose: MobiPose.think, size: size, motion: MobiMotion.settle, controller: _mobi),
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
    // Large enough to be the screen's picture, not a speck on an empty canvas (was 112 dp).
    final artSize = compact ? 96.0 : 148.0;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s24),
          // One entrance, in reading order: Mobi settles, then the title, the message and the
          // way out. Still under reduced motion.
          child: MmStagger(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                MmStaggerItem(
                  index: 0,
                  rise: 8,
                  child: SizedBox(
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
                        _art(context, artSize),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                MmStaggerItem(
                  index: 1,
                  child: Semantics(
                    header: true,
                    child: Text(title, style: type.title, textAlign: TextAlign.center),
                  ),
                ),
                if (message != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  MmStaggerItem(
                    index: 2,
                    child: Text(message!, style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
                  ),
                ],
                if (primary != null) ...[
                  const SizedBox(height: MmSpace.s20),
                  MmStaggerItem(
                    index: 3,
                    child: KeyedSubtree(key: _action, child: KeyButton(label: primary!.label, onPressed: primary!.onPressed, loading: primary!.loading)),
                  ),
                ],
                if (secondary != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  MmStaggerItem(
                    index: 4,
                    child: Align(child: KeyButton.quiet(label: secondary!.label, onPressed: secondary!.onPressed)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A landscape vignette with Mobi, settling once like Mobi does. Only for the MOBI_RASTER fallback.
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
