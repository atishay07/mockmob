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
import '../../../core/widgets/receipt_line.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../widgets/rhythm_page.dart' show FlushQuietKey;
import 'celebration_controller.dart';
import 'celebration_event.dart' show CelebrationLevel;
import '../widgets/proud_mobi.dart';
import '../widgets/week_dial.dart';
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

/// The moment itself. A first (L2) stands on the ground with no box: Mobi at 104 dp in his own
/// pool of lamp light, the sentence in Bricolage 22, and for a met week the week dial with the
/// real counts. A plain L1 is one compact glass line. Everything fades in over 240 ms; the lamp
/// pool blooms once over 700 ms, the dial closes its own ring, Mobi hops once. Quiet mode is the
/// same words with no motion.
class CelebrationMoment extends StatefulWidget {
  const CelebrationMoment({super.key, required this.celebration});

  final Celebration celebration;

  @override
  State<CelebrationMoment> createState() => _CelebrationMomentState();
}

class _CelebrationMomentState extends State<CelebrationMoment> with TickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(vsync: this, duration: Motion.card);

  /// The lamp pool behind Mobi blooms once (700 ms) when a first lands.
  late final AnimationController _bloom = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context) || widget.celebration.textOnly) {
      _fade.value = 1;
      _bloom.value = 1;
    } else {
      _fade.forward();
      _bloom.forward();
    }
  }

  @override
  void dispose() {
    _fade.dispose();
    _bloom.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.celebration;
    final colors = context.mmColors;
    final type = context.mmType;
    final label = [if (c.sentence != null) c.sentence!, if (c.receipt != null) c.receipt!].join(' ');
    final first = c.level == CelebrationLevel.l2;
    final counted = c.ring && c.studyDays != null && c.goal != null;

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
              if (c.sentence != null) Text(c.sentence!, style: first ? type.headline.copyWith(fontSize: 22, height: 26 / 22) : type.subhead),
              if (c.sentence != null && c.receipt != null) SizedBox(height: first ? MmSpace.s8 : MmSpace.s4),
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

    final Widget body;
    if (first) {
      final mobiSize = c.mobiHop ? 104.0 : 0.0;
      final lead = counted
          ? WeekDial(done: c.studyDays!, goal: c.goal!, size: 88, showWords: false, animate: !c.textOnly)
          : (c.ring ? const RingSweep(label: RhythmCopy.weekDoneLabel, size: 64) : null);
      body = Stack(
        clipBehavior: Clip.none,
        children: [
          if (c.mobiHop)
            Positioned(
              right: -28,
              top: -30,
              width: 220,
              height: 220,
              child: IgnorePointer(
                child: FadeTransition(
                  opacity: CurvedAnimation(parent: _bloom, curve: Motion.out),
                  child: ScaleTransition(
                    scale: Tween<double>(begin: 0.7, end: 1).animate(CurvedAnimation(parent: _bloom, curve: Motion.out)),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(colors: [colors.lamp.withValues(alpha: colors.isNight ? 0.24 : 0.20), colors.lamp.withValues(alpha: 0)]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (lead != null) ...[lead, const SizedBox(height: MmSpace.s12)],
                      text,
                    ],
                  ),
                ),
                if (c.mobiHop) ...[
                  const SizedBox(width: MmSpace.s8),
                  ProudMobi(size: mobiSize),
                ],
              ],
            ),
          ),
        ],
      );
    } else {
      // A plain L1: one compact glass line, the week dial small when a week was met.
      final row = Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (c.ring) ...[
              if (counted)
                WeekDial(done: c.studyDays!, goal: c.goal!, size: 64, showWords: false, animate: !c.textOnly)
              else
                const RingSweep(label: RhythmCopy.weekDoneLabel, size: 52),
              const SizedBox(width: MmSpace.s16),
            ],
            Expanded(child: text),
          ],
        ),
      );
      body = SizedBox(
        width: double.infinity,
        child: LitEdge(child: FakeGlass(lamp: true, child: row)),
      );
    }

    return FadeTransition(opacity: CurvedAnimation(parent: _fade, curve: Motion.out), child: body);
  }
}
