/// The run's own parts on the stage (what only the run has; the stage parts are in `../stage/`). The run's phone band is the
/// web's `run.css` (A4 3.3, BUILD-1101 B2 with B7, R3 L4): its top bar is one row (Close, the ticks, "3 of 21") over the chapter's
/// name, and its action bar holds the item's keys over one status line, so the run builds its own frame from the stage's keys:
///
///   RunTopBar       Close (the X and the word), the ticks, "3 of 21" (the Revise flight lands on it); under them one quiet line
///                   with the chapter's name. No pile and no time left in a phone's bar
///   RunFrame        the top bar, the item area (12 dp above and below), the action bar; the end is a layer over it
///   RunActionBar    the item's keys, 6 dp, then the one status line (20 dp, always reserved)
///   RunStatusView   an error, a note, the stamp, a coach line or Free's look line
///   RunRateKeys     Missed it, Got it (the volt key), Easy, 8 dp apart, each with when the card comes back under its name (round 5)
///   RunLessonCard   a lesson as a card: its kind on the plain band, its title at the card's size, "Read this first."
///   RunDeck         the two card edges under a run's Key card (R8: a run has no peek, so this is its deck)
///   RunSwipe        a recap card follows the finger sideways; past 72 dp (or a quick flick) it goes on
///   RunRound        a cards run's pause after every 20
///   RunCentreArea   a centred state in the item area
///   RunSkeleton     the whole run while it starts
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/grain.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/mm_spinner.dart';
import '../../../core/widgets/skeleton.dart';
import '../data/learn_models.dart' show LearnReturns;
import '../data/learn_words.dart';
import '../stage/card_face.dart';
import '../stage/stage_balance.dart';
import '../stage/stage_keys.dart';
import '../stage/stage_motion.dart';
import '../stage/stage_paper.dart';
import '../stage/stage_text.dart';
import '../stage/stage_ticks.dart';
import 'run_controller.dart';
import 'run_copy.dart';

/// ---------------------------------------------------------------- the top bar and the frame

/// The phone's top bar (run.css `.lr-top`, R3 L4): one 44 dp row (Close, the ticks, "4 of 20"), 12 dp apart, and under it one quiet
/// 20 dp line with the chapter's name. Safe top (at least 4) above, 6 below, 16 at the sides. No Revise pile in a phone's bar and
/// no time left (both are drawn from 768 and 1024 dp): a card that goes to Revise flies into the counter ([posKey]).
class RunTopBar extends StatelessWidget {
  const RunTopBar({super.key, required this.onClose, this.closeLabel = RunCopy.closeLabel, this.title = '', this.ticks, this.position, this.of, this.posKey});

  final VoidCallback onClose;
  final String closeLabel;
  final String title;

  /// The ticks (`StageTicks`); null keeps the row empty.
  final Widget? ticks;
  final int? position;
  final int? of;

  /// On the counter: where the Revise flight lands.
  final GlobalKey? posKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final top = math.max(4.0, MediaQuery.paddingOf(context).top);
    final tabular = [const FontFeature.tabularFigures()];
    final pos = position != null && of != null
        ? Semantics(
            label: RunCopy.counterLabel(position!, of!),
            excludeSemantics: true,
            child: KeyedSubtree(
              key: posKey,
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
            ),
          )
        : (posKey == null ? const SizedBox.shrink() : SizedBox(key: posKey, width: 0, height: 14));
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.fromLTRB(0, top, 0, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The row starts 10 dp left of the gutter (Close's own padding, so its X lines up with the page).
            Padding(
              padding: const EdgeInsets.only(left: MmSpace.gutter - 10, right: MmSpace.gutter),
              child: SizedBox(
                height: 44,
                child: Row(
                  children: [
                    StageCloseKey(inBar: true, semanticsLabel: closeLabel, onTap: onClose),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(child: Center(child: SizedBox(height: 20, child: Align(alignment: Alignment.center, child: ticks)))),
                    if (position != null || posKey != null) ...[const SizedBox(width: MmSpace.s12), pos],
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: SizedBox(
                height: 20,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: type.label.copyWith(fontSize: 13, height: 20 / 13, fontWeight: FontWeight.w500, color: colors.ink3),
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
          fontWeight: l.bad || l.cue ? FontWeight.w600 : FontWeight.w500,
          color: l.bad ? colors.badText : (l.cue ? colors.ink : colors.ink2),
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

/// Missed it, Got it (the volt key) and Easy: equal, 8 dp apart, a group named "How well did you recall it?". Round 5 (LK38): each
/// key says when the card would come back under its name ("back tomorrow", the server's words from FSRS, [returns]), so a student
/// sees what each key does before pressing it; no words, no second line. A second line that wraps ("back in this run, then
/// tomorrow") makes the three keys the same height. [busy] is the rating on its way (a spinner in its key); every key waits while
/// one is, and while the card leaves ([disabled]). No haptic of their own: the screen gives the confirm or the tick once the
/// server has the rating.
class RunRateKeys extends StatelessWidget {
  const RunRateKeys({super.key, required this.onRate, this.returns, this.busy, this.disabled = false});

  final ValueChanged<int> onRate;
  final LearnReturns? returns;
  final int? busy;
  final bool disabled;

  /// A key with words is at least this tall (the web's 60); without words, the plain 52.
  static const double tallest = 60;
  static const double _subSize = 12;
  static const double _padX = 8;
  static const double _gap = 8;
  static const int _subLines = 3;

  /// The height every key shares: the tallest of the three at this width and text scale, never under 52 (no words) or 60 (words).
  static double keyHeight(BuildContext context, double width, LearnReturns? returns) {
    final scaler = MediaQuery.textScalerOf(context);
    final dir = Directionality.of(context);
    final type = context.mmType;
    final slot = (width - 2 * _gap) / 3 - 2 * _padX;
    final label = type.button.copyWith(fontSize: 16, height: 1.25, fontWeight: FontWeight.w600);
    final sub = type.body.copyWith(fontSize: _subSize, height: 1.3, fontWeight: FontWeight.w500);
    var tall = returns == null ? 52.0 : tallest;
    for (final (rating, name) in ratings) {
      final words = returns?.forRating(rating);
      final l = TextPainter(text: TextSpan(text: name, style: label), textDirection: dir, textScaler: scaler)..layout(maxWidth: slot);
      var h = l.height + 2 * MmSpace.s8;
      l.dispose();
      if (words != null) {
        final s = TextPainter(text: TextSpan(text: LearnWords.backLine(words), style: sub), textDirection: dir, textScaler: scaler, maxLines: _subLines)..layout(maxWidth: slot);
        h += 2 + s.height;
        s.dispose();
      }
      tall = math.max(tall, h);
    }
    return tall;
  }

  static const List<(int, String)> ratings = [(1, RunCopy.missed), (3, RunCopy.gotIt), (4, RunCopy.easy)];

  String? _sub(int rating) {
    final words = returns?.forRating(rating);
    return words == null ? null : LearnWords.backLine(words);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return LayoutBuilder(
      builder: (context, box) {
        final height = keyHeight(context, box.maxWidth, returns);
        return Semantics(
          container: true,
          explicitChildNodes: true,
          label: RunCopy.ratingGroup,
          child: Row(
            children: [
              for (final (i, (rating, label)) in ratings.indexed) ...[
                if (i > 0) const SizedBox(width: _gap),
                Expanded(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      StageStepKey(
                        label: busy == rating ? ' ' : label,
                        sub: busy == rating ? null : _sub(rating),
                        subLines: _subLines,
                        subSize: _subSize,
                        padX: _padX,
                        minHeight: height,
                        semanticsLabel: _sub(rating) == null ? label : '$label, ${_sub(rating)}',
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
      },
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

/// A lesson item (run.css `.lr-card--lesson`): the card's paper with its kind on the plain band ("Lesson, 7 min" in ink-2, R8), the
/// lesson's title at the card's size for its length, and "Read this first. Its cards come next in this run." It does not turn and
/// has no deck under it.
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
    const side = StagePaper.side;
    return KeyedSubtree(
      key: cardKey,
      child: DecoratedBox(
        decoration: StagePaper.surface(colors.paper, r),
        child: MmClip(
          borderRadius: r,
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              const Positioned.fill(child: IgnorePointer(child: RepaintBoundary(child: Grain()))),
              ConstrainedBox(
                constraints: BoxConstraints(minHeight: CardFace.minHeightFor(media.height)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    StageKindBand(kind: kindLabel),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(side, StagePaper.gap, side, StagePaper.gap),
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
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- the deck under a run's card

/// The deck under a run's Key card (run.css R8): a run has no peek, so two card edges of the same paper show under the card,
/// the nearer 7 dp down and 10 dp in at each side, the farther 14 dp down and 20 dp in, each a shade deeper (the light falls on
/// the top card), with the paper's hairline and shadow. They stay put while the card turns, leaves after a rating and the next
/// one rises; the card gives up the 14 dp they take. Nothing here moves or takes a touch.
class RunDeck extends StatelessWidget {
  const RunDeck({super.key, required this.child});

  final Widget child;

  /// How far the deck shows under the card.
  static const double depth = 14;

  @override
  Widget build(BuildContext context) {
    final paper = context.mmColors.paper;
    Widget edge(Color fill) => IgnorePointer(
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: fill,
          shape: mmShapeBorder(const BorderRadius.vertical(bottom: Radius.circular(22)), side: BorderSide(color: paper.line)),
          shadows: paper.shadow,
        ),
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: depth),
      child: Stack(
        clipBehavior: Clip.none,
        fit: StackFit.passthrough,
        children: [
          Positioned(left: 20, right: 20, bottom: -depth, height: 48, child: edge(paper.edgeFar)),
          Positioned(left: 10, right: 10, bottom: -depth / 2, height: 48, child: edge(paper.edgeNear)),
          child,
        ],
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
      topBar: RunTopBar(onClose: onClose, ticks: const StageTicks()),
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
