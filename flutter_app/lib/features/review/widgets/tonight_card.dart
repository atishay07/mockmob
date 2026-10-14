import 'package:flutter/material.dart';

import '../../../core/art/art.dart' show SubjectEmblem;
import '../../../core/copy/formatters.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'mistake_run.dart';

/// Tonight's repair: the one lit element on Review and the hero of the tab. One surface, nothing
/// boxed inside it. The subject's light pools in the upper right and its object leans out of the
/// corner; the chapter is the headline; the number of mistakes is the monumental figure; the
/// mistakes are written out as the wrong bubbles of the sheet with their question numbers, with
/// "Show me" at the end of that row; Mobi pointing at the one volt key closes it. The four-step
/// thread lives on the record and the repair entry, not here.
class TonightCard extends StatefulWidget {
  const TonightCard({
    super.key,
    required this.pick,
    required this.onRepair,
    required this.onShowMe,
    required this.now,
    this.lateNight = false,
  });

  final TonightPick pick;
  final VoidCallback onRepair;
  final VoidCallback onShowMe;

  /// The student's clock, for "tonight" or "today".
  final DateTime now;

  /// After 11 PM: sleepy Mobi, and the source line becomes "Repair a little, then sleep." Nothing moves.
  final bool lateNight;

  @override
  State<TonightCard> createState() => _TonightCardState();
}

class _TonightCardState extends State<TonightCard> with SingleTickerProviderStateMixin {
  /// The object art settling in: 420 ms on the emphasized curve.
  late final AnimationController _art = AnimationController(vsync: this, duration: Motion.emphasizedDuration);
  late final CurvedAnimation _artCurve = CurvedAnimation(parent: _art, curve: Motion.emphasized);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _art.value = 1;
    } else {
      _art.forward();
    }
  }

  @override
  void dispose() {
    _artCurve.dispose();
    _art.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pick = widget.pick;
    final n = pick.items.length;
    final minutes = repairMinutes(n);
    final light = SubjectLight.forSubject(pick.subjectId);
    final large = MediaQuery.textScalerOf(context).scale(10) > 11.5;

    final lit = colors.isNight ? colors.volt : colors.accentText;
    const bleed = MmSpace.gutter;

    // No card: the hero is a field of light on the ground. The subject's colour pools in the
    // upper right, a lit volt line crosses the top edge to edge, and the object leans in from the
    // corner. Nothing is boxed; everything inside sits straight on the ground.
    return Stack(
      clipBehavior: Clip.none,
      children: [
        if (light != null)
          Positioned(
            left: -bleed,
            right: -bleed,
            top: -MmSpace.s20,
            height: 400,
            child: IgnorePointer(
              child: LightField(
                pools: [
                  LightPool(
                    color: light.of(Theme.of(context).brightness),
                    center: const Alignment(0.85, -0.55),
                    radius: 0.72,
                    strength: colors.isNight ? 1.25 : 0.95,
                  ),
                  LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.14 : 0.12), center: const Alignment(-1.1, -1.1), radius: 0.7),
                ],
              ),
            ),
          ),
        Positioned(
          left: -bleed,
          right: -bleed,
          top: 0,
          height: 3,
          child: IgnorePointer(
            child: CustomPaint(painter: LitEdgePainter(color: lit, radius: 0, width: 1.5)),
          ),
        ),
        // The subject's emblem leans in from the corner: the one emblem on this screen that
        // drifts. It settles in over the card's arrival.
        Positioned(
          right: -bleed - 24,
          top: 0,
          child: IgnorePointer(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _artCurve,
                child: SubjectEmblem(subject: pick.subjectId, size: 168, framed: false, animate: true),
                builder: (context, child) {
                  final t = _artCurve.value;
                  return Opacity(
                    opacity: t.clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, 10 * (1 - t)),
                      child: Transform.scale(scale: 0.93 + 0.07 * t, child: child),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s24, MmSpace.s4, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // The headline stays clear of the art leaning in from the corner.
              Padding(
                padding: EdgeInsets.only(right: large ? 72 : 140),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ReviewCopy.tonightOverline(widget.now, subjectName(pick.subjectId)), style: type.caption.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s6),
                    Semantics(
                      header: true,
                      child: Text(
                        pick.chapter,
                        maxLines: large ? 5 : 3,
                        overflow: TextOverflow.ellipsis,
                        style: type.headline.copyWith(fontSize: 26, height: 29 / 26),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s24),
              MonumentalNumber(
                value: '$n',
                unit: n == 1 ? 'mistake' : 'mistakes',
                style: type.figure.copyWith(fontSize: 72, height: 64 / 72),
                // The roll waits for the hero to arrive, then lands with one tick.
                delay: Motion.enterDuration,
                onLanded: () => mmHapticsOf(context)?.selection(),
                semanticsLabel: '${plural(n, 'mistake')} to repair',
              ),
              const SizedBox(height: MmSpace.s8),
              // After 11 PM the same line says it is fine to stop: the layout stays the day layout.
              Text(
                widget.lateNight ? ReviewCopy.lateNight : ReviewCopy.tonightSource(pick.source, n, pick.chapterOpen),
                style: type.small.copyWith(color: colors.ink2),
              ),
              const SizedBox(height: MmSpace.s20),
              // The questions are the evidence; "Show me" opens them. No second control beside it.
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(child: MistakeRun(numbers: [for (final i in pick.items) i.number])),
                  const SizedBox(width: MmSpace.s8),
                  _ShowMeLink(
                    onTap: widget.onShowMe,
                    semanticsLabel: 'Show me the ${n == 1 ? 'question' : '$n questions'} behind this',
                  ),
                ],
              ),
              const SizedBox(height: MmSpace.s24),
              // Mobi stands at the left of the key and points at it (asleep on his feet after 11 PM,
              // in the same place). The key sits at the same height every time of day.
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Mobi(
                    pose: widget.lateNight ? MobiPose.sleepy : MobiPose.point,
                    size: large ? 72 : 96,
                    motion: widget.lateNight ? MobiMotion.settle : MobiMotion.tilt,
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: MmSpace.s8),
                      child: KeyButton(
                        label: ReviewCopy.tonightKey(minutes),
                        semanticsLabel: ReviewCopy.tonightKeySpoken(n, minutes),
                        onPressed: widget.onRepair,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: MmSpace.s4),
            ],
          ),
        ),
      ],
    );
  }
}

/// "Show me" at the end of the question row: a quiet link to the exact questions behind tonight's
/// repair. 48 dp tall, never a second control competing with the key.
class _ShowMeLink extends StatelessWidget {
  const _ShowMeLink({required this.onTap, required this.semanticsLabel});

  final VoidCallback onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.97,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text(ReviewCopy.showMe, style: type.labelLarge.copyWith(color: colors.accentText)),
          ],
        ),
      ),
    );
  }
}
