// The L1 and L2 moment, drawn inline. It takes its own space in the layout, so it never covers a
// control: reserve a place for it on the screen and it collapses to nothing when there is
// nothing to show. Nothing here is a toast, a dialog or a full-screen reward.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/mobi.dart';
import '../../../core/widgets/receipt_line.dart';
import 'celebration_controller.dart';
import 'ring_sweep.dart';

/// Shows the celebration of [scope], if one fired. Place it on the ground, not inside a card.
class CelebrationSlot extends ConsumerWidget {
  const CelebrationSlot({super.key, required this.scope});

  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

class _CelebrationMomentState extends State<CelebrationMoment> with SingleTickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(vsync: this, duration: Motion.card);
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
    }
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.celebration;
    final colors = context.mmColors;
    final type = context.mmType;
    final label = [if (c.sentence != null) c.sentence!, if (c.receipt != null) c.receipt!].join(' ');

    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (c.sentence != null) Text(c.sentence!, style: type.subhead),
        if (c.sentence != null && c.receipt != null) const SizedBox(height: MmSpace.s4),
        if (c.receipt != null) ReceiptLine(text: c.receipt!),
      ],
    );

    final body = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(MmSpace.s16),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (c.ring) ...[RingSweep(), const SizedBox(width: MmSpace.s12)],
          Expanded(child: text),
          if (c.mobiHop) ...[
            const SizedBox(width: MmSpace.s12),
            const Mobi(pose: MobiPose.celebrating, size: 56, motion: MobiMotion.hop),
          ],
        ],
      ),
    );

    return Semantics(
      container: true,
      liveRegion: true,
      label: label,
      excludeSemantics: true,
      child: FadeTransition(opacity: CurvedAnimation(parent: _fade, curve: Motion.out), child: body),
    );
  }
}
