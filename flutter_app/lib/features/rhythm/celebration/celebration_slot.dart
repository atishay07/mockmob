// The L1 and L2 moment, drawn inline. It takes its own space in the layout, so it never covers a
// control: reserve a place for it on the screen and it collapses to nothing when there is
// nothing to show. Nothing here is a toast, a dialog or a full-screen reward.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/art/scene_art.dart';
import '../../../core/widgets/materials/fake_glass.dart';
import '../../../core/widgets/materials/lit_edge.dart';
import '../../../core/widgets/receipt_line.dart';
import '../copy.dart';
import '../data/rhythm_prefs.dart';
import '../widgets/rhythm_page.dart' show BalancedText, FlushQuietKey;
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
/// real counts. A plain L1 is one compact glass line. Everything fades in over 240 ms.
///
/// The ladder (MOTION.md 1.2): a moment is one number or object landing, then at most one light
/// event, then Mobi once the thing has landed. A met week is the dial inking in and closing with
/// its one sweep (the dial's own light, 1180 ms at most, inside `Motion.momentT2`), and Mobi
/// arrives after it; the lamp pool never blooms on top of a sweep. A first with no ring has the
/// pool bloom (700 ms) as its one light event. Quiet mode is the same words with no motion.
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
    final headStyle = first ? type.headline.copyWith(fontSize: 22, height: 26 / 22) : type.subhead;
    // A wrapped headline is balanced: no single word hangs alone on its last line.
    final headline = c.sentence == null ? null : BalancedText(c.sentence!, style: headStyle);
    final receipt = c.receipt == null ? null : ReceiptLine(text: c.receipt!);
    final linkKey = c.linkLabel != null && link != null
        ? FlushQuietKey(label: c.linkLabel!, onPressed: () => GoRouter.maybeOf(context)?.push(link))
        : null;
    Widget said(List<Widget> children) => Semantics(
          container: true,
          liveRegion: true,
          label: label,
          excludeSemantics: true,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: children),
        );

    final Widget body;
    if (first && !c.textOnly) {
      // A first (first repair, first week met) stands under the painted check: the bubble-grid
      // check of the milestone art, its whole native frame feathered into the ground, with Mobi
      // standing under its long arm, looking up. The art arriving is the moment's one light
      // event when there is no ring (it replaces the pool bloom); with a ring the dial's sweep is,
      // and the art simply fades in with the moment.
      final ring = counted
          ? WeekDial(done: c.studyDays!, goal: c.goal!, size: 88, showWords: false, animate: true, sweep: true)
          : (c.ring ? const RingSweep(label: RhythmCopy.weekDoneLabel, size: 64) : null);
      final mobiAfter = counted
          ? WeekDial.settleAfter(done: c.studyDays!, goal: c.goal!, sweep: true)
          : (c.ring ? Motion.milestone : const Duration(milliseconds: 520));
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          MilestoneArtBand(
            arrive: c.ring ? null : _bloom,
            mobi: c.mobiHop ? ProudMobi(size: MilestoneArtBand.mobiSize, delay: mobiAfter) : null,
          ),
          said([
            if (ring != null) ...[ring, const SizedBox(height: MmSpace.s12)],
            ?headline,
            if (receipt != null) ...[const SizedBox(height: MmSpace.s8), receipt],
          ]),
          ?linkKey,
        ],
      );
    } else if (first) {
      final mobi = c.mobiHop;
      final lead = counted
          ? WeekDial(done: c.studyDays!, goal: c.goal!, size: 104, showWords: false, animate: !c.textOnly, sweep: !c.textOnly)
          : (c.ring ? const RingSweep(label: RhythmCopy.weekDoneLabel, size: 72) : null);
      // Mobi acts after the number has landed: after the ring's sweep, or after the sentence has
      // faded in when there is no ring.
      final mobiAfter = counted
          ? WeekDial.settleAfter(done: c.studyDays!, goal: c.goal!, sweep: true)
          : (c.ring ? Motion.milestone : Motion.card);
      // The words get the full width. Mobi sits with the ring (or beside the headline when there
      // is no ring) instead of squeezing the text into a column beside him.
      final Widget top = lead != null
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [lead, if (mobi) ...[const SizedBox(width: MmSpace.s8), ProudMobi(size: 104, delay: mobiAfter)]],
            )
          : (mobi
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [Expanded(child: headline ?? const SizedBox.shrink()), const SizedBox(width: MmSpace.s8), ProudMobi(size: 96, delay: mobiAfter)],
                )
              : (headline ?? const SizedBox.shrink()));
      final below = <Widget>[
        if (lead != null && headline != null) ...[const SizedBox(height: MmSpace.s12), headline],
        if (receipt != null) ...[SizedBox(height: first ? MmSpace.s8 : MmSpace.s4), receipt],
      ];
      body = Stack(
        clipBehavior: Clip.none,
        children: [
          // The pool is the light event of a first with no ring; with a ring the sweep is, and a
          // second light would make two.
          if (mobi && lead == null)
            Positioned(
              right: -MmSpace.s24 - MmSpace.s4,
              top: -MmSpace.s32,
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                said([top, ...below]),
                ?linkKey,
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
                WeekDial(done: c.studyDays!, goal: c.goal!, size: 72, showWords: false, animate: !c.textOnly, sweep: !c.textOnly)
              else
                const RingSweep(label: RhythmCopy.weekDoneLabel, size: 52),
              const SizedBox(width: MmSpace.s16),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  said([
                    ?headline,
                    if (headline != null && receipt != null) const SizedBox(height: MmSpace.s4),
                    ?receipt,
                  ]),
                  ?linkKey,
                ],
              ),
            ),
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

/// The milestone art (`scene-milestone-check-*`, Night and Day): the check made of filled bubbles
/// over the bubble grid, shown as its whole native 3:2 frame (1536 by 1024), as wide as the slot
/// plus the gutter on each side. The file is feathered to transparent at every edge, so it sits
/// on the ground with no box and the band needs no mask of its own. [mobi] stands under the
/// check's long arm. With [arrive], the art rises 6 dp and comes up from 96% over that animation
/// (the moment's light event).
class MilestoneArtBand extends StatelessWidget {
  const MilestoneArtBand({super.key, this.arrive, this.mobi});

  final Animation<double>? arrive;
  final Widget? mobi;

  /// Mobi's height in dp, where he stands across the band (a share of its width) and where his
  /// feet land down it (a share of its height: above the feathered foot of the frame).
  static const double mobiSize = 92;
  static const double mobiX = 0.74;
  static const double mobiFootY = 0.92;

  /// How far the art runs past the slot on each side (the moment gutter).
  static const double bleed = MmSpace.s24;

  @override
  Widget build(BuildContext context) {
    final art = SceneArt.milestone(context.mmColors);
    return LayoutBuilder(
      builder: (context, box) {
        final slot = box.hasBoundedWidth ? box.maxWidth : 336.0;
        final w = slot + bleed * 2;
        final h = w * art.aspect;
        Widget picture = RepaintBoundary(child: SceneImage(art, width: w, height: h));
        final a = arrive;
        if (a != null) {
          picture = AnimatedBuilder(
            animation: a,
            child: picture,
            builder: (context, child) {
              final t = Motion.out.transform(a.value);
              return Opacity(
                opacity: t,
                child: Transform.translate(offset: Offset(0, 6 * (1 - t)), child: Transform.scale(scale: 0.96 + 0.04 * t, child: child)),
              );
            },
          );
        }
        return SizedBox(
          height: h,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(left: -bleed, top: 0, width: w, height: h, child: IgnorePointer(child: ExcludeSemantics(child: picture))),
              if (mobi != null)
                Positioned(
                  left: -bleed + w * mobiX - mobiSize,
                  width: mobiSize * 2,
                  bottom: h * (1 - mobiFootY),
                  height: mobiSize,
                  child: Align(alignment: Alignment.bottomCenter, child: mobi),
                ),
            ],
          ),
        );
      },
    );
  }
}
