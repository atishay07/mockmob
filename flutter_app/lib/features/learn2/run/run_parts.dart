/// The run's own parts on the stage (what only the run has; the stage parts are in `../stage/`). The run's phone band is the
/// web's `run.css` (A4 3.3, BUILD-1101 B2 with B7): its top bar puts the ticks under the Close row with the time left, and
/// its action bar holds the item's keys over one status line, so the run builds its own frame from the stage's keys:
///
///   RunTopBar       Close, the chapter's title, the In Revise pile and its count, "3 of 21"; under them the ticks and "about
///                   6 min left"
///   RunPileGlyph    the three stacked cards, the flight's target
///   RunFrame        the top bar, the item area (12 dp above and below), the action bar; the end is a layer over it
///   RunActionBar    the item's keys, 6 dp, then the one status line (20 dp, always reserved)
///   RunStatusView   an error, a note, the stamp, a coach line or Free's look line
///   RunRateKeys     Missed, Got it (the volt key), Easy, 52 dp, 8 dp apart
///   RunLessonCard   a lesson as a card: its kind, its title at the card's size, "Read this first."
///   RunSwipe        a recap card follows the finger sideways; past 72 dp (or a quick flick) it goes on
///   RunRound        a cards run's pause after every 20
///   RunCentreArea   a centred state in the item area
///   RunSkeleton     the whole run while it starts
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/edge_light.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/mm_spinner.dart';
import '../../../core/widgets/skeleton.dart';
import '../stage/card_face.dart';
import '../stage/stage_balance.dart';
import '../stage/stage_keys.dart';
import '../stage/stage_motion.dart';
import '../stage/stage_text.dart';
import '../stage/stage_ticks.dart';
import 'run_controller.dart';
import 'run_copy.dart';

// ---------------------------------------------------------------- the Revise pile glyph and its count

/// The Revise pile's glyph: three stacked cards (20 x 24), two under-papers at -9 and 6 degrees. It is the flight's target.
class RunPileGlyph extends StatelessWidget {
  const RunPileGlyph({super.key});

  static const double width = 20;
  static const double height = 24;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget paper({required double angle, required double shift, bool top = false}) => Positioned(
      left: 3,
      right: 3,
      top: 2,
      bottom: 2,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..rotateZ(angle * math.pi / 180)
          ..translateByDouble(shift, 0, 0, 1),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: top ? colors.raised2 : colors.raised,
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: colors.lineStrong),
          ),
        ),
      ),
    );
    return ExcludeSemantics(
      child: SizedBox(
        width: width,
        height: height,
        child: Stack(children: [paper(angle: -9, shift: -2), paper(angle: 6, shift: 1), paper(angle: 0, shift: 0, top: true)]),
      ),
    );
  }
}

/// `lr-pop`: when [trigger] changes the child swells to 1.12 at 45% and settles over 180 ms (nothing under reduced motion).
class RunPop extends StatefulWidget {
  const RunPop({super.key, required this.trigger, required this.child});

  final int trigger;
  final Widget child;

  @override
  State<RunPop> createState() => _RunPopState();
}

class _RunPopState extends State<RunPop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 180), value: 1);

  @override
  void didUpdateWidget(RunPop old) {
    super.didUpdateWidget(old);
    if (widget.trigger != old.trigger && !Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    child: widget.child,
    builder: (context, child) {
      final v = _c.value;
      if (v >= 1) return child!;
      final bump = v < 0.45 ? Motion.out.transform(v / 0.45) : 1 - Motion.out.transform((v - 0.45) / 0.55);
      return Transform.scale(scale: 1 + 0.12 * bump, child: child);
    },
  );
}

/// The glyph and its count (the count is hidden at 0 while the glyph stays as the flight's target; it pops when a card lands).
class RunPileCount extends StatelessWidget {
  const RunPileCount({super.key, required this.count, this.pop = 0, this.glyphKey});

  final int count;
  final int pop;

  /// On the glyph: where the flight lands.
  final GlobalKey? glyphKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: RunCopy.reviseLabel(count),
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            KeyedSubtree(key: glyphKey, child: const RunPileGlyph()),
            const SizedBox(width: MmSpace.s4),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 8),
              child: Visibility(
                visible: count > 0,
                maintainSize: true,
                maintainAnimation: true,
                maintainState: true,
                child: RunPop(
                  trigger: pop,
                  child: Text(
                    '$count',
                    maxLines: 1,
                    style: type.label.copyWith(
                      fontSize: 13,
                      height: 1,
                      fontWeight: FontWeight.w700,
                      color: colors.ink,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- the top bar and the frame

/// The phone's top bar (run.css `.lr-top`): row 1 is 44 dp (Close, the title, the pile, "3 of 21"), then 4 dp, then the 20 dp
/// row of the ticks and the time left; 8 dp (or the safe top) above and 10 below, 16 at the sides. "3 of 21" and the time left
/// share one column, as the web's grid has them.
class RunTopBar extends StatelessWidget {
  const RunTopBar({
    super.key,
    required this.onClose,
    this.closeLabel = RunCopy.closeLabel,
    this.title = '',
    this.ticks,
    this.pile,
    this.pileKey,
    this.pop = 0,
    this.position,
    this.of,
    this.left,
    this.reserveRight = true,
  });

  final VoidCallback onClose;
  final String closeLabel;
  final String title;

  /// The column of "3 of 21" and the time left keeps its width even while both are empty (the web's grid does); a skeleton
  /// and a state give it up so the ticks span the bar.
  final bool reserveRight;

  /// The ticks (`StageTicks`); null keeps the row empty.
  final Widget? ticks;

  /// The In Revise count; null hides the pile (a recap, a state).
  final int? pile;
  final GlobalKey? pileKey;
  final int pop;
  final int? position;
  final int? of;

  /// "about 6 min left".
  final String? left;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final top = math.max(8.0, MediaQuery.paddingOf(context).top);
    final tabular = [const FontFeature.tabularFigures()];
    final titleStyle = type.label.copyWith(fontSize: 13, height: 1.2, fontWeight: FontWeight.w600, color: colors.ink2);
    final pos = position != null && of != null
        ? Semantics(
            label: RunCopy.counterLabel(position!, of!),
            excludeSemantics: true,
            child: Text.rich(
              TextSpan(
                style: type.label.copyWith(fontSize: 14, height: 1, fontWeight: FontWeight.w500, color: colors.ink3, fontFeatures: tabular),
                children: [
                  TextSpan(
                    text: '$position',
                    style: TextStyle(fontWeight: FontWeight.w700, color: colors.ink),
                  ),
                  TextSpan(text: ' of $of'),
                ],
              ),
              maxLines: 1,
              softWrap: false,
            ),
          )
        : const SizedBox.shrink();
    final timeLeft = left != null && left!.isNotEmpty
        ? Text(
            left!,
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.end,
            style: type.label.copyWith(fontSize: 12.5, height: 1, fontWeight: FontWeight.w500, color: colors.ink3, fontFeatures: tabular),
          )
        : const SizedBox.shrink();
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, MmSpace.gutter, 10),
        child: LayoutBuilder(
          builder: (context, c) => Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 44,
                      child: Row(
                        children: [
                          // The key's box starts 10 dp left of the gutter, so its X lines up with the page.
                          Transform.translate(
                            offset: const Offset(-10, 0),
                            child: StageIconKey(icon: LucideIcons.x, size: 22, semanticsLabel: closeLabel, onTap: onClose),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: false, style: titleStyle),
                          ),
                          if (pile != null) ...[const SizedBox(width: 10), RunPileCount(count: pile!, pop: pop, glyphKey: pileKey)],
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    SizedBox(
                      height: 20,
                      child: Align(alignment: Alignment.center, child: ticks),
                    ),
                  ],
                ),
              ),
              if (reserveRight) ...[
                const SizedBox(width: 10),
                // At large text the time left may not take more than 42% of the bar: it ends in an ellipsis, the title keeps its room.
                ConstrainedBox(
                  constraints: BoxConstraints(minWidth: 72, maxWidth: math.max(72, c.maxWidth * 0.42)),
                  child: IntrinsicWidth(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          height: 44,
                          child: Align(alignment: Alignment.centerLeft, child: pos),
                        ),
                        const SizedBox(height: 4),
                        SizedBox(
                          height: 20,
                          child: Align(alignment: Alignment.centerRight, child: timeLeft),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The run's frame: the top bar, the item area (12 dp above the action bar), the action bar. [end] is a layer over the whole
/// frame; the frame fades out under it in 200 ms and takes no taps.
class RunFrame extends StatelessWidget {
  const RunFrame({super.key, required this.label, required this.topBar, this.child, this.bar, this.end});

  /// What the stage is, for a screen reader.
  final String label;
  final Widget topBar;
  final Widget? child;
  final Widget? bar;
  final Widget? end;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inEnd = end != null;
    final frame = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        topBar,
        Expanded(
          // The top bar's own 10 dp and a page's 16 dp give a question the web's 22 dp under the ticks; a card is centred.
          child: Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Semantics(container: true, label: label, child: child ?? const SizedBox.expand()),
          ),
        ),
        ?bar,
      ],
    );
    return ColoredBox(
      color: colors.ground,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedOpacity(
            opacity: inEnd ? 0 : 1,
            duration: Motion.of(context, const Duration(milliseconds: 200)),
            curve: Motion.out,
            child: IgnorePointer(
              ignoring: inEnd,
              child: ExcludeSemantics(
                excluding: inEnd,
                child: ExcludeFocus(excluding: inEnd, child: frame),
              ),
            ),
          ),
          if (end != null) Positioned.fill(child: StageIn(child: end!)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- the action bar and its status line

/// The action bar (run.css `.lr-bar__in`): the item's [keys], 6 dp, then the one [status] line; 10 dp above, 16 at the sides,
/// the safe bottom (at least 12) below, on the solid ground.
class RunActionBar extends StatelessWidget {
  const RunActionBar({super.key, required this.keys, this.status});

  final Widget keys;
  final RunStatusLine? status;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final bottom = math.max(12.0, MediaQuery.paddingOf(context).bottom);
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, 10, MmSpace.gutter, bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            keys,
            const SizedBox(height: 6),
            RunStatusView(line: status),
          ],
        ),
      ),
    );
  }
}

/// The one status line under the keys: 20 dp at least, centred, 13.5 ink-2; an error in the bad colour; the stamp as a small
/// bordered stamp that arrives, holds and leaves over 1.12 s.
class RunStatusView extends StatelessWidget {
  const RunStatusView({super.key, this.line});

  final RunStatusLine? line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final l = line;
    final Widget body;
    if (l == null) {
      body = const SizedBox(key: ValueKey<String>('none'), width: double.infinity);
    } else if (l.stamp) {
      body = _StampPill(key: ValueKey<String>('stamp-${l.n}'), text: l.text);
    } else {
      body = Text(
        l.text,
        key: ValueKey<String>(l.text),
        textAlign: TextAlign.center,
        style: type.body.copyWith(
          fontSize: 13.5,
          height: 1.45,
          fontWeight: l.bad ? FontWeight.w600 : FontWeight.w500,
          color: l.bad ? colors.badText : colors.ink2,
        ),
      );
    }
    return Semantics(
      liveRegion: true,
      container: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 20),
        child: Center(
          child: MmOverlapSwitcher.fade(duration: const Duration(milliseconds: 160), alignment: Alignment.center, child: body),
        ),
      ),
    );
  }
}

/// `lr-stamp`: in over the first 11% (rising 4 dp from 1.06), held to 80%, out over the last fifth. Reduced motion: plain.
class _StampPill extends StatefulWidget {
  const _StampPill({super.key, required this.text});

  final String text;

  @override
  State<_StampPill> createState() => _StampPillState();
}

class _StampPillState extends State<_StampPill> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: RunController.stampFor);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pill = DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: colors.ink2, width: 1.5),
        borderRadius: BorderRadius.circular(7),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 24),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Center(
            widthFactor: 1,
            child: Text(
              widget.text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: type.label.copyWith(
                fontSize: 13,
                height: 1,
                fontWeight: FontWeight.w700,
                color: colors.ink2,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ),
    );
    return AnimatedBuilder(
      animation: _c,
      child: pill,
      builder: (context, child) {
        if (Motion.reduced(context) || !_c.isAnimating && _c.value == 0) return child!;
        final v = _c.value;
        final into = Motion.out.transform((v / 0.11).clamp(0.0, 1.0));
        final out = v < 0.8 ? 0.0 : Motion.out.transform(((v - 0.8) / 0.2).clamp(0.0, 1.0));
        return Opacity(
          opacity: (into * (1 - out)).clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(0, 4 * (1 - into)),
            child: Transform.scale(scale: 1.06 - 0.06 * into, child: child),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------- the keys

/// Missed, Got it (the volt key) and Easy: 52 dp, equal, 8 dp apart, a group named "How well did you recall it?". [busy] is the
/// rating on its way (a spinner in its key); every key waits while one is, and while the card leaves ([disabled]). No haptic of
/// their own: the screen gives the confirm or the tick once the server has the rating.
class RunRateKeys extends StatelessWidget {
  const RunRateKeys({super.key, required this.onRate, this.busy, this.disabled = false});

  final ValueChanged<int> onRate;
  final int? busy;
  final bool disabled;

  static const List<(int, String)> ratings = [(1, RunCopy.missed), (3, RunCopy.gotIt), (4, RunCopy.easy)];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      container: true,
      explicitChildNodes: true,
      label: RunCopy.ratingGroup,
      child: Row(
        children: [
          for (final (i, (rating, label)) in ratings.indexed) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  StageStepKey(
                    label: busy == rating ? ' ' : label,
                    semanticsLabel: label,
                    tone: rating == 3 ? StageTone.volt : StageTone.line,
                    haptic: false,
                    onTap: disabled || busy != null ? null : () => onRate(rating),
                  ),
                  if (busy == rating) IgnorePointer(child: MmSpinner(color: rating == 3 ? colors.voltInk : colors.ink, size: 16, strokeWidth: 2.2)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Keys side by side with equal gaps: [Expanded] slots with the given flex.
class RunKeyRow extends StatelessWidget {
  const RunKeyRow({super.key, required this.keys, this.flex = const [], this.gap = 8});

  final List<Widget> keys;
  final List<int> flex;
  final double gap;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      for (final (i, k) in keys.indexed) ...[if (i > 0) SizedBox(width: gap), Expanded(flex: i < flex.length ? flex[i] : 1, child: k)],
    ],
  );
}

/// The answered question's keys: Save (a 56 dp slot, its label under it) and Next, level with each other's middle.
class RunNextRow extends StatelessWidget {
  const RunNextRow({super.key, required this.next, this.save});

  final Widget next;
  final Widget? save;

  @override
  Widget build(BuildContext context) {
    if (save == null) return next;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        save!,
        const SizedBox(width: MmSpace.s12),
        Expanded(child: next),
      ],
    );
  }
}

// ---------------------------------------------------------------- a lesson as a card

/// A lesson item (run.css `.lr-card--lesson`): the card's surface with its kind ("Lesson, 7 min"), the lesson's title at the
/// card's size for its length, and "Read this first. Its cards come next in this run." It does not turn.
class RunLessonCard extends StatelessWidget {
  const RunLessonCard({super.key, required this.kindLabel, required this.title, required this.line, this.cardKey});

  final String kindLabel;
  final String title;
  final String line;
  final GlobalKey? cardKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final media = MediaQuery.sizeOf(context);
    final r = BorderRadius.circular(CardFace.radius);
    final p = CardFace.promptStyle(StageText.frontSize(title), media.width);
    final style = type.title.copyWith(fontSize: p.size, height: p.height, letterSpacing: p.size * p.tracking, wordSpacing: 0, color: colors.ink);
    return KeyedSubtree(
      key: cardKey,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: mmShapeBorder(r, side: BorderSide(color: colors.lineStrong)),
          shadows: colors.cardShadow,
        ),
        child: CustomPaint(
          foregroundPainter: EdgeLightPainter(borderRadius: r, top: colors.edgeTop, bottom: colors.edgeBottom.withValues(alpha: 0), sheen: false),
          child: MmClip(
            borderRadius: r,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: CardFace.minHeightFor(media.height)),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 18),
                      child: Text(kindLabel, style: type.label.copyWith(fontSize: 13, height: 1.3, color: colors.ink3)),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Semantics(
                            header: true,
                            child: StageBalancedText(TextSpan(text: title, style: style)),
                          ),
                          const SizedBox(height: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 330),
                            child: Text(
                              line,
                              style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- a recap card's swipe

/// A recap card follows the finger sideways 1:1; past 72 dp (or over 24 dp at a quick flick, 0.7 dp/ms) it goes on or back.
class RunSwipe extends StatefulWidget {
  const RunSwipe({super.key, required this.child, required this.onPrev, required this.onNext, this.enabled = true});

  final Widget child;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final bool enabled;

  /// The drag that commits, and the shorter one with a flick.
  static const double distance = 72;
  static const double flickDistance = 24;
  static const double flickSpeed = 0.7;

  @override
  State<RunSwipe> createState() => _RunSwipeState();
}

class _RunSwipeState extends State<RunSwipe> {
  double _dx = 0;
  double _downX = 0;

  void _end(DragEndDetails d) {
    final mx = _dx;
    final v = (d.primaryVelocity ?? 0).abs() / 1000;
    setState(() => _dx = 0);
    if (mx < -RunSwipe.distance || (mx < -RunSwipe.flickDistance && v > RunSwipe.flickSpeed)) {
      widget.onNext();
    } else if (mx > RunSwipe.distance || (mx > RunSwipe.flickDistance && v > RunSwipe.flickSpeed)) {
      widget.onPrev();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragDown: (d) => _downX = d.globalPosition.dx,
      onHorizontalDragUpdate: (d) => setState(() => _dx = d.globalPosition.dx - _downX),
      onHorizontalDragEnd: _end,
      onHorizontalDragCancel: () => setState(() => _dx = 0),
      child: Transform.translate(offset: Offset(_dx, 0), child: widget.child),
    );
  }
}

// ---------------------------------------------------------------- states

/// A centred state in the item area, scrolling when the words are taller (text scale 1.3).
class RunCentreArea extends StatelessWidget {
  const RunCentreArea({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final bias = 0.04 * MediaQuery.sizeOf(context).height;
    return LayoutBuilder(
      builder: (context, c) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: math.max(0, c.maxHeight)),
          child: Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, bias),
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}

/// A cards run's pause after every 20: the number, "cards rated", "12 more are lined up.", then Next round and Finish here.
class RunRound extends StatelessWidget {
  const RunRound({super.key, required this.rated, required this.left, required this.keys});

  final int rated;
  final int left;
  final List<Widget> keys;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final quiet = type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Column(
              children: [
                Text(
                  '$rated',
                  style: type.headline.copyWith(
                    fontSize: 56,
                    height: 1,
                    letterSpacing: -1.7,
                    fontWeight: FontWeight.w800,
                    color: colors.ink,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 4),
                Text(RunCopy.roundTitle, style: quiet),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(RunCopy.roundLine(left), textAlign: TextAlign.center, style: quiet),
          const SizedBox(height: 24),
          for (final (i, k) in keys.indexed) ...[if (i > 0) const SizedBox(height: 10), k],
        ],
      ),
    );
  }
}

/// The whole run while it starts, at its final shape: the top bar (Close and one hairline for the ticks), a card block at the
/// card's least height, and the key's block; no invented numbers.
class RunSkeleton extends StatelessWidget {
  const RunSkeleton({super.key, required this.onClose, this.label = RunCopy.loadingLabel});

  final VoidCallback onClose;
  final String label;

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context).height;
    return RunFrame(
      label: label,
      topBar: RunTopBar(onClose: onClose, ticks: const StageTicks(), reserveRight: false),
      bar: const RunActionBar(
        keys: SkeletonGroup(label: RunCopy.loadingLabel, child: Skeleton(height: 52, radius: 14)),
      ),
      child: Semantics(
        label: label,
        liveRegion: true,
        child: SkeletonGroup(
          label: label,
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 0.04 * screen),
            child: Center(
              child: Skeleton(height: CardFace.minHeightFor(screen), radius: CardFace.radius),
            ),
          ),
        ),
      ),
    );
  }
}
