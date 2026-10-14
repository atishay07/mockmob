import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'life_row.dart';
import 'mistake_run.dart';
import 'review_bits.dart';

/// Tonight's repair: the one lit element on Review and the hero of the tab. One surface, nothing
/// boxed inside it. The subject's light pools in the upper right and its object leans out of the
/// corner; the chapter is the headline; the number of mistakes is the monumental figure; the
/// mistakes are written out as the wrong bubbles of the sheet with their question numbers; the
/// thread every mistake walks (Found, Repaired, Checked, Holds) sits above the one volt key; the
/// evidence tag and Mobi pointing at the key close it.
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

  /// After 11 PM: sleepy Mobi says one line.
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
    final object = MmArt.subjectObject(pick.subjectId);
    final large = MediaQuery.textScalerOf(context).scale(10) > 11.5;

    return LitEdge(
      glow: true,
      child: MmClip(
        borderRadius: MmRadius.panelAll,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.raised, boxShadow: colors.cardShadow),
          child: Stack(
            children: [
              if (light != null)
                Positioned.fill(
                  child: IgnorePointer(
                    child: LightField.subject(context, light, center: const Alignment(0.95, -0.95), strength: colors.isNight ? 1.15 : 0.9),
                  ),
                ),
              Positioned.fill(child: IgnorePointer(child: Grain(opacity: colors.grain * 0.7))),
              if (object != null)
                Positioned(
                  right: -18,
                  top: -6,
                  child: IgnorePointer(
                    child: RepaintBoundary(
                      child: AnimatedBuilder(
                        animation: _artCurve,
                        child: ArtImage(object, width: 136, height: 136),
                        builder: (context, child) {
                          final t = _artCurve.value;
                          return Opacity(
                            opacity: t.clamp(0.0, 1.0),
                            child: Transform.translate(
                              offset: Offset(0, 8 * (1 - t)),
                              child: Transform.scale(scale: 0.94 + 0.06 * t, child: child),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The headline stays clear of the art leaning in from the corner.
                    Padding(
                      padding: EdgeInsets.only(right: large ? 56 : 84),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            ReviewCopy.tonightOverline(widget.now, subjectName(pick.subjectId)),
                            style: type.caption.copyWith(color: colors.ink2),
                          ),
                          const SizedBox(height: MmSpace.s6),
                          Semantics(
                            header: true,
                            child: Text(
                              pick.chapter,
                              maxLines: large ? 4 : 3,
                              overflow: TextOverflow.ellipsis,
                              style: type.headline.copyWith(fontSize: 26, height: 29 / 26),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MmSpace.s20),
                    MonumentalNumber(
                      value: '$n',
                      unit: n == 1 ? 'mistake' : 'mistakes',
                      style: type.figure.copyWith(fontSize: 64, height: 58 / 64),
                      semanticsLabel: '${plural(n, 'mistake')} to repair',
                    ),
                    const SizedBox(height: MmSpace.s8),
                    Text(
                      ReviewCopy.tonightSource(pick.source, n, pick.chapterOpen),
                      style: type.small.copyWith(color: colors.ink2),
                    ),
                    const SizedBox(height: MmSpace.s16),
                    MistakeRun(numbers: [for (final i in pick.items) i.number]),
                    const SizedBox(height: MmSpace.s20),
                    const LifeRow(stage: MistakeStage.found, bubbleSize: 16, animate: false),
                    const SizedBox(height: MmSpace.s20),
                    KeyButton(label: ReviewCopy.tonightKey(n, minutes), onPressed: widget.onRepair),
                    const SizedBox(height: MmSpace.s4),
                    Row(
                      children: [
                        ShowMeTag(
                          count: n,
                          onTap: widget.onShowMe,
                          semanticsLabel: 'Show me the ${n == 1 ? 'question' : '$n questions'} behind this',
                        ),
                        const Spacer(),
                        // Mobi stands by the key, pointing at it (asleep on his feet after 11 PM).
                        if (!widget.lateNight) const Mobi(pose: MobiPose.point, size: 48),
                      ],
                    ),
                    if (widget.lateNight) ...[
                      const SizedBox(height: MmSpace.s8),
                      const Mobi(pose: MobiPose.sleepy, size: 44, motion: MobiMotion.settle, say: ReviewCopy.lateNight),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
