import 'package:flutter/material.dart';

import '../../../core/art/art.dart' show EmblemSizes, SubjectEmblem;
import '../../../core/copy/formatters.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/motion/flight.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'mistake_run.dart';
import 'review_layout.dart';

/// Tonight's repair: the one lit element on Review and the hero of the tab. One hero card at the
/// screen gutter (padding 20, radius 28, the volt lit edge on its top), nothing boxed inside it.
/// The subject's light pools in the card and its object sits in the header band, never cropped
/// by the top edge: the overline, the chapter and the number of mistakes are the band, the
/// emblem is a prop beside it. Under the band: what the number means, the mistakes written out
/// as the wrong bubbles of the sheet with "Show me" at the end of that row, and the one volt key,
/// full width. There is one object here and no Mobi (a hero carries either, never both); the
/// four-step thread lives on the record and the repair entry.
class TonightCard extends StatefulWidget {
  const TonightCard({
    super.key,
    required this.pick,
    required this.onRepair,
    required this.onShowMe,
    required this.now,
    this.lateNight = false,
    this.totalOpen,
  });

  final TonightPick pick;
  final VoidCallback onRepair;
  final VoidCallback onShowMe;

  /// The student's clock, for "tonight" or "today".
  final DateTime now;

  /// After 11 PM: the source line becomes "Repair a little, then sleep." Nothing moves.
  final bool lateNight;

  /// Every open mistake on the tab, so the line under the number can say how many more wait below it.
  final int? totalOpen;

  @override
  State<TonightCard> createState() => _TonightCardState();
}

class _TonightCardState extends State<TonightCard> with SingleTickerProviderStateMixin {
  /// The object art settling in: 420 ms on the emphasized curve, about its own centre.
  late final AnimationController _art = AnimationController(vsync: this, duration: Motion.emphasizedDuration);
  late final CurvedAnimation _artCurve = CurvedAnimation(parent: _art, curve: Motion.emphasized);
  final GlobalKey _card = GlobalKey(debugLabel: 'tonight-card');
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

  /// The repair entry grows out of this card: the card's rect is recorded for the container
  /// transform before the route is pushed.
  void _start() {
    final cardContext = _card.currentContext;
    if (cardContext != null) MmLaunchRect.capture(cardContext);
    // Its object flies on into the repair entry (M2).
    MmFlight.launch(context, widget.pick.subjectId);
    widget.onRepair();
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

    // At large text the emblem gives way: a smaller prop and less clear, so the title keeps room.
    final artSize = large ? EmblemSizes.tile : ReviewSpace.artSize;
    final artBox = artSize + 20;
    // The header band keeps clear of the emblem: its box, less the bleed, plus 12 dp of air, less
    // the card's own padding.
    final bandRight = artBox - ReviewSpace.artBleedRight + MmSpace.s12 - ReviewSpace.heroPad;

    final card = MmSurface.hero(
      lit: true,
      light: light?.of(Theme.of(context).brightness),
      padding: const EdgeInsets.all(ReviewSpace.heroPad),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The header band: overline, chapter (never wider than the clear column) and the
          // number, with the object beside it.
          Padding(
            padding: EdgeInsets.only(right: bandRight),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // The subject is never cut ("Business St..." read as broken, v13 walk, 9): when the
                // band is narrow the line wraps to a second line instead of ending in an ellipsis.
                Text(
                  ReviewCopy.tonightOverline(widget.now, subjectName(pick.subjectId)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: type.caption.copyWith(color: colors.ink2),
                ),
                const SizedBox(height: MmSpace.s4),
                Semantics(
                  header: true,
                  child: Text(
                    pick.chapter,
                    maxLines: large ? 5 : 3,
                    overflow: TextOverflow.ellipsis,
                    style: type.headline.copyWith(fontSize: 22, height: 26 / 22),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          // The number's unit sits beside it; the row scales down before it would reach the object.
          Padding(
            padding: EdgeInsets.only(right: bandRight),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: MonumentalNumber(
                value: '$n',
                unit: n == 1 ? 'mistake' : 'mistakes',
                style: type.figure.copyWith(fontSize: 72, height: 64 / 72),
                // The roll waits for the hero to arrive, then lands with one tick.
                delay: Motion.enterDuration,
                onLanded: () => mmHapticsOf(context)?.selection(),
                semanticsLabel: '${plural(n, 'mistake')} to repair',
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          // After 11 PM the same line says it is fine to stop: the layout stays the day layout.
          Text(
            widget.lateNight ? ReviewCopy.lateNight : ReviewCopy.tonightSource(pick.source, n, pick.chapterOpen, totalOpen: widget.totalOpen),
            style: type.small.copyWith(color: colors.ink2),
          ),
          // The row is a 48 dp target; its own slack above and below the 20 dp bubbles is counted
          // in the gaps, so the visible air is 16 to 20 dp either side.
          const SizedBox(height: MmSpace.s4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: MistakeRun(numbers: [for (final i in pick.items) i.number])),
              const SizedBox(width: MmSpace.s8),
              _ShowMeLink(
                onTap: widget.onShowMe,
                semanticsLabel: 'Show me the ${n == 1 ? 'question' : '$n questions'} this comes from',
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s4),
          KeyButton(
            label: ReviewCopy.tonightKey(n, minutes),
            semanticsLabel: ReviewCopy.tonightKeySpoken(n, minutes),
            onPressed: _start,
          ),
        ],
      ),
    );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        KeyedSubtree(key: _card, child: card),
        // The subject's object: a box 8 dp from the top, bled 10 dp past the right edge so the
        // drawing ends on the card edge. It settles in once (scale 0.94 to 1 about its own
        // centre, 8 dp of rise) and then stays still.
        Positioned(
          right: -ReviewSpace.artBleedRight,
          top: ReviewSpace.artTop,
          width: artBox,
          height: artBox,
          child: IgnorePointer(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _artCurve,
                child: Center(child: SubjectEmblem(subject: pick.subjectId, size: artSize, framed: false)),
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
