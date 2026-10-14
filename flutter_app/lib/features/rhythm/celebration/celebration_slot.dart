// The L1 and L2 moment, drawn inline. It takes its own space in the layout, so it never covers a
// control: reserve a place for it on the screen and it collapses to nothing when there is
// nothing to show. Nothing here is a toast, a dialog or a full-screen reward.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/fake_glass.dart';
import '../../../core/widgets/materials/lit_edge.dart';
import '../../../core/widgets/mobi.dart';
import '../../../core/widgets/receipt_line.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../widgets/rhythm_page.dart' show FlushQuietKey;
import 'celebration_controller.dart';
import 'ring_sweep.dart';

/// Shows the celebration of [scope], if one fired. Place it on the ground, not inside a card.
/// Draws nothing while the student has turned rhythm off.
class CelebrationSlot extends ConsumerWidget {
  const CelebrationSlot({super.key, required this.scope});

  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(rhythmVisibleProvider)) return const SizedBox.shrink();
    final celebration = ref.watch(celebrationControllerProvider.select((s) => s.byScope[scope]));
    if (celebration == null || !celebration.showsMoment) return const SizedBox.shrink();
    return CelebrationMoment(key: ValueKey(celebration.id), celebration: celebration);
  }
}

/// The moment itself: ring or Mobi, one sentence, the receipt line. Fades in over 240 ms; the
/// ring sweeps once over 500 ms and Mobi hops once. Quiet mode is the same words with no motion.
class CelebrationMoment extends StatefulWidget {
  const CelebrationMoment({super.key, required this.celebration});

  final Celebration celebration;

  @override
  State<CelebrationMoment> createState() => _CelebrationMomentState();
}

class _CelebrationMomentState extends State<CelebrationMoment> with TickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(vsync: this, duration: Motion.card);

  /// The light band that crosses the pane once (700 ms) when a first or a week lands.
  late final AnimationController _sweep = AnimationController(vsync: this, duration: const Duration(milliseconds: 860));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context) || widget.celebration.textOnly) {
      _fade.value = 1;
    } else {
      _fade.forward();
      if (widget.celebration.mobiHop || widget.celebration.ring) {
        _sweep.forward();
      }
    }
  }

  @override
  void dispose() {
    _fade.dispose();
    _sweep.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.celebration;
    final colors = context.mmColors;
    final type = context.mmType;
    final label = [if (c.sentence != null) c.sentence!, if (c.receipt != null) c.receipt!].join(' ');

    final link = c.link;
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          container: true,
          liveRegion: true,
          label: label,
          excludeSemantics: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (c.sentence != null) Text(c.sentence!, style: type.subhead),
              if (c.sentence != null && c.receipt != null) const SizedBox(height: MmSpace.s4),
              if (c.receipt != null) ReceiptLine(text: c.receipt!),
            ],
          ),
        ),
        if (c.linkLabel != null && link != null)
          FlushQuietKey(
            chevron: true,
            label: c.linkLabel!,
            onPressed: () => GoRouter.maybeOf(context)?.push(link),
          ),
      ],
    );

    final row = Padding(
      padding: const EdgeInsets.all(MmSpace.s16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (c.ring) ...[const RingSweep(label: RhythmCopy.weekDoneLabel, size: 52), const SizedBox(width: MmSpace.s16)],
          Expanded(child: text),
          if (c.mobiHop) ...[
            const SizedBox(width: MmSpace.s12),
            const Mobi(pose: MobiPose.celebrating, size: 76, motion: MobiMotion.hop),
          ],
        ],
      ),
    );
    final body = SizedBox(
      width: double.infinity,
      child: LitEdge(
        child: FakeGlass(
          lamp: true,
          child: Stack(
            children: [
              row,
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(painter: _SweepPainter(progress: _sweep, color: colors.volt, night: colors.isNight)),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    return FadeTransition(opacity: CurvedAnimation(parent: _fade, curve: Motion.out), child: body);
  }
}

/// One soft diagonal band of light crossing the moment from left to right, once.
class _SweepPainter extends CustomPainter {
  _SweepPainter({required this.progress, required this.color, required this.night}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    // 160 ms of lead so the pane is up before the light crosses it, then 700 ms.
    final t = Motion.sweepCurve.transform(((progress.value * 860 - 160) / 700).clamp(0.0, 1.0));
    if (t <= 0 || t >= 1) return;
    final w = size.width * 0.34;
    final x = -w + (size.width + 2 * w) * t;
    canvas.save();
    canvas.translate(x, 0);
    final rect = Rect.fromLTWH(0, -8, w, size.height + 16);
    canvas.transform(Matrix4.skewX(-0.35).storage);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          colors: [color.withValues(alpha: 0), color.withValues(alpha: night ? 0.20 : 0.28), color.withValues(alpha: 0)],
        ).createShader(rect),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SweepPainter old) => old.color != color || old.night != night;
}
