import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// Where a chip the student just committed came from, so the chip that arrives in its new list
/// can fly in from there. The unlock chip records its rect under the pick's id before it commits;
/// the [FlyInChip] that appears for that id takes it once.
abstract final class ChipFlight {
  static final Map<String, ({Rect from, DateTime at})> _from = {};

  /// A rect older than this is forgotten, so a chip added later by another route never flies
  /// from a stale place.
  static const Duration maxAge = Duration(seconds: 1);

  static void launch(String id, Rect from) => _from[id] = (from: from, at: DateTime.now());

  /// The recorded origin for [id] if it is fresh, and forgets it.
  static Rect? take(String id) {
    final hit = _from.remove(id);
    if (hit == null || DateTime.now().difference(hit.at) > maxAge) return null;
    return hit.from;
  }

  /// The global rect of [context]'s render box, or null before layout.
  static Rect? rectOf(BuildContext context) {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  static const Duration flight = Duration(milliseconds: 360);
}

/// A chip arriving in a list after the page is up: with a recorded origin ([ChipFlight]) a ghost
/// of it flies along a small arc from there while the real chip waits, then the real chip springs
/// in (a 1.08 overshoot settling to 1); with none it just springs in. Chips there when the list
/// first shows ([arrives] false) are drawn as they are. Under reduced motion the chip is simply
/// there. The ghost is a painted pill over the overlay; the list is laid out once.
class FlyInChip extends StatefulWidget {
  const FlyInChip({super.key, required this.id, required this.label, required this.arrives, required this.child});

  /// Matches the id the origin was launched with.
  final String id;

  /// Drawn on the ghost.
  final String label;

  /// Whether this chip is new to a list that is already on screen.
  final bool arrives;
  final Widget child;

  @override
  State<FlyInChip> createState() => _FlyInChipState();
}

class _FlyInChipState extends State<FlyInChip> with TickerProviderStateMixin {
  late final AnimationController _fly = AnimationController(vsync: this, duration: ChipFlight.flight, value: 1);
  late final AnimationController _land = AnimationController(vsync: this, duration: const Duration(milliseconds: 360), value: 1);
  OverlayEntry? _ghost;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.arrives || Motion.reduced(context)) return;
    final from = ChipFlight.take(widget.id);
    if (from == null) {
      _land.forward(from: 0);
      return;
    }
    // The real chip waits, unseen, until the ghost has landed on its place.
    _fly.value = 0;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final to = ChipFlight.rectOf(context);
      final overlay = Overlay.maybeOf(context, rootOverlay: true);
      if (to == null || overlay == null) {
        _fly.value = 1;
        _land.forward(from: 0);
        return;
      }
      final entry = OverlayEntry(builder: (context) => _Ghost(from: from, to: to, t: _fly, label: widget.label));
      _ghost = entry;
      overlay.insert(entry);
      _fly.forward(from: 0).whenComplete(() {
        _removeGhost();
        if (mounted) _land.forward(from: 0);
      });
    });
  }

  void _removeGhost() {
    _ghost?.remove();
    _ghost?.dispose();
    _ghost = null;
  }

  @override
  void dispose() {
    _removeGhost();
    _fly.dispose();
    _land.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_fly, _land]),
      child: widget.child,
      builder: (context, child) {
        if (_fly.value < 1) return Opacity(opacity: 0, child: child);
        final t = _land.value;
        if (t >= 1) return child!;
        // 0.8 to 1.08 and back to 1 on a spring-like ease; the chip is never smaller than 0.8.
        final scale = 0.8 + 0.2 * Curves.easeOutBack.transform(t);
        return Opacity(opacity: Interval(0, 0.4).transform(t), child: Transform.scale(scale: scale, child: child));
      },
    );
  }
}

class _Ghost extends StatelessWidget {
  const _Ghost({required this.from, required this.to, required this.t, required this.label});

  final Rect from;
  final Rect to;
  final Animation<double> t;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final e = Motion.emphasized.transform(t.value.clamp(0.0, 1.0));
        final center = Offset.lerp(from.center, to.center, e)! - Offset(0, 28 * math.sin(math.pi * e));
        final size = Size.lerp(from.size, to.size, e)!;
        return Positioned(
          left: center.dx - size.width / 2,
          top: center.dy - size.height / 2,
          width: size.width,
          height: size.height,
          child: IgnorePointer(
            child: Opacity(
              opacity: (1 - Interval(0.8, 1).transform(t.value)).clamp(0.0, 1.0),
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: colors.raised,
                  shape: StadiumBorder(side: BorderSide(color: colors.accentText.withValues(alpha: 0.6))),
                  shadows: [BoxShadow(color: colors.ink.withValues(alpha: 0.12), blurRadius: 12, offset: const Offset(0, 4))],
                ),
                child: Center(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    softWrap: false,
                    style: type.labelLarge.copyWith(fontSize: 14, color: colors.ink, decoration: TextDecoration.none),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
