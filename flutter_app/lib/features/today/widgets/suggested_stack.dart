// "Suggested for you" (D51, TODAY-SWIPE-1018): the lead card's other moves as a small deck on the
// ground under the card (never a card inside the card). One card on top, two behind at 0.95 and
// 0.90 peeking 12 and 22 dp, the count and page dots above and below.
//
// The finger: a sideways drag locks after 12 dp (a vertical one is the page's scroll); the card
// follows it 1:1 and leans x/20 degrees about its foot. Past 30% of the width, or on a fling,
// right stamps "Do this instead" and the card flies up into the lead card, which swaps exactly as
// the old choices did (the old move comes down into the deck marked Suggested); left stamps
// "Skip" and the card goes to the back. A tap is right. Below the threshold it springs home. The
// threshold ticks a selection haptic both ways.
//
// Safeguard: nothing here starts a session or spends a credit. Right only makes a card the lead;
// the lead card's lime key starts it. The Skip and Do this instead buttons are the accessible path
// and do exactly what the swipes do. Reduced motion: the card still follows the finger, and the
// release swaps or skips at once with no flight.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy_glance.dart';
import '../copy_suggested.dart';
import '../logic/glance_model.dart';
import '../logic/suggested_deck.dart';
import 'glance_rows.dart' show GlanceLink;
import 'hero_stage.dart' show HeroArtView;
import 'today_type.dart';

/// A commit: past this share of the deck's width.
const double deckCommitShare = 0.30;

/// The sideways lock, in dp of finger travel.
const double deckLock = 12;

/// How much the card leans: one degree per this many dp.
const double deckLeanPer = 20;

/// The peek of the cards behind, in dp, at depth 1 and 2.
const double deckPeek1 = 12;
const double deckPeek2 = 22;

class SuggestedStack extends StatefulWidget {
  const SuggestedStack({super.key, required this.cards, required this.onChoose, this.onMore, this.leadKey});

  /// The deck, in order: [buildSuggestedDeck].
  final List<SuggestedCard> cards;

  /// "Do this instead" (a right swipe, a tap, the button): the screen swaps the lead card to it.
  final ValueChanged<MoveChoice> onChoose;

  /// "See every way to practise": the alternatives sheet. Null hides the words.
  final VoidCallback? onMore;

  /// The lead card, which a chosen card flies into.
  final GlobalKey? leadKey;

  /// On the card on top of the deck (tests find its buttons by it).
  static const Key topKey = ValueKey('suggested-top');

  @override
  State<SuggestedStack> createState() => _SuggestedStackState();
}

/// A chosen card on its way up into the lead card.
class _Flight {
  _Flight({required this.card, required this.from, required this.lean, required this.to, required this.at, required this.of});

  final SuggestedCard card;
  final Offset from;
  final double lean;
  final Offset to;
  final int at;
  final int of;
}

class _SuggestedStackState extends State<SuggestedStack> with TickerProviderStateMixin {
  late DeckPass _pass = DeckPass(_keys(widget.cards));

  /// The top card's sideways offset in dp.
  late final AnimationController _x;

  /// A chosen card flying into the lead card (0 to 1).
  late final AnimationController _fly;

  /// The new top card arriving after a pick: the old lead coming down into the deck.
  late final AnimationController _arrive;

  /// A skipped card settling in at the back.
  late final AnimationController _backIn;

  final GlobalKey _deckKey = GlobalKey(debugLabel: 'suggested-deck');
  _Flight? _flight;
  double _width = 360;
  double _raw = 0;
  bool _past = false;
  bool _dragging = false;
  bool _leaving = false;
  bool _hint = false;

  static List<String> _keys(List<SuggestedCard> cards) => [for (final c in cards) c.key];

  double get _threshold => _width * deckCommitShare;

  SuggestedCard? _card(String? key) => key == null ? null : widget.cards.where((c) => c.key == key).firstOrNull;

  @override
  void initState() {
    super.initState();
    _x = AnimationController.unbounded(vsync: this)..addListener(_moved);
    _fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 340));
    _arrive = AnimationController(vsync: this, duration: const Duration(milliseconds: 360), value: 1);
    _backIn = AnimationController(vsync: this, duration: const Duration(milliseconds: 220), value: 1);
    SuggestedHint.claim().then((show) {
      if (mounted && show != _hint) setState(() => _hint = show);
    });
  }

  @override
  void didUpdateWidget(SuggestedStack old) {
    super.didUpdateWidget(old);
    final keys = _keys(widget.cards);
    if (!_pass.sameDeck(keys)) {
      // A pick changed the deck: a fresh pass, the old lead arriving on top.
      _pass = DeckPass(keys);
      _x.value = 0;
      _leaving = false;
      if (_flight != null && !Motion.reduced(context)) _arrive.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _x.dispose();
    _fly.dispose();
    _arrive.dispose();
    _backIn.dispose();
    super.dispose();
  }

  void _moved() {
    final x = _x.value;
    final top = _card(_pass.top);
    final past = _dragging && x.abs() >= _threshold && (x < 0 || (top?.swipeable ?? false));
    if (past != _past) {
      setState(() => _past = past);
      if (_dragging) hapticsOf(context)?.selection();
    }
  }

  // The finger.

  void _start() {
    if (_leaving || _flight != null && _fly.isAnimating && _fly.value < 0.2) return;
    _x.stop();
    _raw = _x.value;
    _dragging = true;
  }

  void _update(double dx) {
    if (!_dragging) return;
    _raw += dx;
    final right = _card(_pass.top)?.swipeable ?? false;
    // A side that cannot commit gives only a little (the card is held, not thrown).
    _x.value = _raw > 0 && !right ? _raw * MmDragPolicy.resist : _raw;
  }

  void _cancel() {
    if (!_dragging) return;
    _dragging = false;
    _home(0);
  }

  void _end(double velocity) {
    if (!_dragging) return;
    _dragging = false;
    final top = _card(_pass.top);
    final side = top == null ? null : MmDragPolicy.commits(_x.value, velocity, distance: _threshold, left: true, right: top.swipeable);
    if (_past) setState(() => _past = false);
    switch (side) {
      case MmDragSide.right:
        _learned();
        _choose(top!);
      case MmDragSide.left:
        _learned();
        _skip(velocity: velocity);
      case null:
        _home(velocity);
    }
  }

  void _home(double velocity) {
    if (Motion.reduced(context)) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0, velocity: velocity));
    }
  }

  /// The student swiped: the hint has done its job.
  void _learned() {
    if (_hint) setState(() => _hint = false);
    unawaited(SuggestedHint.learned());
  }

  // The two outcomes.

  /// Skip: the top card leaves to the left and goes to the back.
  Future<void> _skip({double velocity = 0}) async {
    if (_leaving || _pass.top == null) return;
    if (Motion.reduced(context)) {
      setState(_pass.skip);
      _x.value = 0;
      return;
    }
    _leaving = true;
    final target = -(_width * 1.15 + 24);
    try {
      await _x.animateWith(Motion.spring(Springs.lift, _x.value, target, velocity: math.min(velocity, -900))).orCancel;
    } on TickerCanceled {
      return;
    }
    if (!mounted) return;
    setState(() {
      _pass.skip();
      _leaving = false;
    });
    _x.value = 0;
    _backIn.forward(from: 0);
  }

  /// Do this instead: the card flies up into the lead card and the lead swaps to it. It never
  /// starts anything; the lead card's key does.
  void _choose(SuggestedCard card) {
    final hero = card.choice.hero;
    if (Motion.reduced(context) || hero == null) {
      _x.value = 0;
      widget.onChoose(card.choice);
      return;
    }
    final x = _x.value;
    _flight = _Flight(card: card, from: Offset(x, _liftY(x)), lean: x / deckLeanPer, to: _leadOffset(), at: _pass.skips + 1, of: _pass.length);
    _fly.forward(from: 0).whenCompleteOrCancel(() {
      if (mounted) setState(() => _flight = null);
    });
    _x.value = 0;
    widget.onChoose(card.choice);
  }

  /// Where the lead card's middle is, from the top card's middle; straight up when it cannot be
  /// measured.
  Offset _leadOffset() {
    final lead = widget.leadKey?.currentContext?.findRenderObject();
    final deck = _deckKey.currentContext?.findRenderObject();
    if (lead is RenderBox && deck is RenderBox && lead.attached && deck.attached && lead.hasSize && deck.hasSize) {
      final a = lead.localToGlobal(lead.size.center(Offset.zero));
      final b = deck.localToGlobal(Offset(deck.size.width / 2, (deck.size.height - deckPeek2) / 2));
      return a - b;
    }
    return const Offset(0, -260);
  }

  void _again() => setState(_pass.again);

  // Drawing.

  /// The top card rises a little as it leaves, so it reads as lifted off the deck.
  static double _liftY(double x) => -x.abs() * 0.04;

  /// A card at [depth] (0 on top, fractional while the top one moves).
  static double _peek(double depth) => depth <= 0
      ? 0
      : depth <= 1
      ? deckPeek1 * depth
      : depth <= 2
      ? deckPeek1 + (deckPeek2 - deckPeek1) * (depth - 1)
      : deckPeek2;
  static double _scale(double depth) => 1 - 0.05 * depth.clamp(0.0, 2.0);
  static double _opacity(double depth) => depth <= 1
      ? 1 - 0.25 * depth
      : depth <= 2
      ? 0.75 - 0.30 * (depth - 1)
      : math.max(0, 0.45 * (3 - depth));

  String get _hintLine {
    if (!_past) return SuggestedCopy.hint;
    if (_x.value > 0) return SuggestedCopy.letGoRight;
    final next = _card(_pass.next);
    return next == null ? SuggestedCopy.letGoLast : SuggestedCopy.letGoLeft(next.title);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (widget.cards.isEmpty) {
      final more = widget.onMore;
      return more == null
          ? const SizedBox.shrink()
          : Center(
              child: GlanceLink(label: GlanceCopy.moreWays, onTap: more),
            );
    }
    final ended = _pass.ended;
    final head = Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Semantics(header: true, child: Text(SuggestedCopy.title, style: type.title.copyWith(fontSize: 19))),
        ),
        const SizedBox(width: MmSpace.s12),
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: MmOverlapSwitcher.fade(
            alignment: Alignment.centerRight,
            child: Text(
              _pass.countLine,
              key: ValueKey(_pass.countLine),
              textAlign: TextAlign.right,
              style: type.caption.copyWith(fontSize: 14, color: colors.ink3),
            ),
          ),
        ),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        head,
        const SizedBox(height: MmSpace.s12),
        MmSizeEase(
          duration: Motion.ui,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.none,
          child: ended
              ? _EndCard(count: _pass.length, onAgain: _again, onMore: widget.onMore)
              : LayoutBuilder(
                  builder: (context, box) {
                    _width = box.maxWidth;
                    return KeyedSubtree(key: _deckKey, child: _deck(context));
                  },
                ),
        ),
        const SizedBox(height: MmSpace.s8),
        _Dots(states: _pass.dots),
        MmSizeEase(
          duration: Motion.ui,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.none,
          child: _hint && !ended
              ? Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s8),
                  child: MmOverlapSwitcher.fade(
                    child: Text(
                      _hintLine,
                      key: ValueKey(_hintLine),
                      textAlign: TextAlign.center,
                      style: type.caption.copyWith(fontSize: 14, color: colors.ink3),
                    ),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }

  Widget _deck(BuildContext context) {
    final order = _pass.order;
    final n = order.length;
    final behind = math.min(n - 1, 2);
    final peekRoom = behind <= 0 ? 0.0 : (behind == 1 ? deckPeek1 : deckPeek2);
    final children = <Widget>[];
    // Back to front: every card is laid out (so the deck's height is the tallest card's and never
    // jumps between passes), but only the top three show.
    for (var d = n - 1; d >= 1; d--) {
      final card = _card(order[d])!;
      final back = d == n - 1 && n > 1;
      children.add(
        AnimatedBuilder(
          animation: Listenable.merge([_x, _backIn]),
          builder: (context, child) {
            final lift = (_x.value.abs() / _threshold).clamp(0.0, 1.0);
            final depth = d - lift;
            final arriving = back ? Curves.easeOut.transform(_backIn.value) : 1.0;
            return Opacity(
              opacity: (_opacity(depth) * arriving).clamp(0.0, 1.0),
              child: Transform(
                alignment: Alignment.bottomCenter,
                transform: Matrix4.translationValues(0, _peek(depth), 0)..scaleByDouble(_scale(depth), _scale(depth), 1, 1),
                child: _DeckCard(card: card, at: _pass.skips + d + 1, of: n, contentOpacity: (1 - depth).clamp(0.0, 1.0)),
              ),
            );
          },
        ),
      );
    }
    final top = _card(order.first)!;
    children.add(
      AnimatedBuilder(
        animation: Listenable.merge([_x, _arrive]),
        builder: (context, child) {
          final x = _x.value;
          final a = const Cubic(0.23, 1, 0.32, 1).transform(const Interval(0.25, 1).transform(_arrive.value));
          final stamp = (x.abs() / _threshold).clamp(0.0, 1.0);
          return Opacity(
            opacity: a,
            child: Transform(
              alignment: Alignment.bottomCenter,
              transform: Matrix4.translationValues(x, _liftY(x) - 18 * (1 - a), 0)
                ..rotateZ(x / deckLeanPer * math.pi / 180)
                ..scaleByDouble(0.97 + 0.03 * a, 0.97 + 0.03 * a, 1, 1),
              child: _Stamped(yes: x > 0 && top.swipeable ? stamp : 0, no: x < 0 ? stamp : 0, child: child!),
            ),
          );
        },
        child: RepaintBoundary(
          child: _DeckCard(key: SuggestedStack.topKey, card: top, at: _pass.skips + 1, of: n, interactive: true, onSkip: _leaving ? null : () => _skip(), onDo: _leaving ? null : () => _choose(top)),
        ),
      ),
    );
    final flight = _flight;
    if (flight != null) {
      children.add(
        IgnorePointer(
          child: AnimatedBuilder(
            animation: _fly,
            builder: (context, child) {
              final t = Motion.inOut.transform(_fly.value);
              final at = Offset.lerp(flight.from, flight.to, t)!;
              final scale = 1 - 0.38 * t;
              final fade = 1 - const Interval(0.4, 1, curve: Curves.easeIn).transform(_fly.value);
              return Opacity(
                opacity: fade,
                child: Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.translationValues(at.dx, at.dy, 0)
                    ..rotateZ(flight.lean * (1 - t) * math.pi / 180)
                    ..scaleByDouble(scale, scale, 1, 1),
                  child: child,
                ),
              );
            },
            child: _Stamped(
              yes: 1,
              no: 0,
              child: _DeckCard(card: flight.card, at: flight.at, of: flight.of),
            ),
          ),
        ),
      );
    }
    return Padding(
      padding: EdgeInsets.only(bottom: peekRoom),
      child: RawGestureDetector(
        behavior: HitTestBehavior.translucent,
        gestures: {
          _DeckDragRecognizer: GestureRecognizerFactoryWithHandlers<_DeckDragRecognizer>(
            () => _DeckDragRecognizer(debugOwner: this),
            (r) => r
              ..onStart = _start
              ..onUpdate = _update
              ..onEnd = _end
              ..onCancel = _cancel,
          ),
        },
        child: GestureDetector(
          // A tap on the card is "Do this instead"; the buttons are the accessible path.
          excludeFromSemantics: true,
          behavior: HitTestBehavior.opaque,
          onTap: _leaving || !top.swipeable ? null : () => _choose(top),
          child: IntrinsicHeight(
            child: Stack(fit: StackFit.expand, clipBehavior: Clip.none, children: children),
          ),
        ),
      ),
    );
  }
}

/// The stack's place while Today loads (L03): the heading, one card with the peek under it, and
/// the dots, at their resting heights. Today's skeleton already says it is loading.
class SuggestedStackSkeleton extends StatefulWidget {
  const SuggestedStackSkeleton({super.key, this.delay = const Duration(milliseconds: 400)});

  /// Like Today's own skeleton, the bars show only after [delay]: a fast load never flashes them,
  /// but the place is held from the first frame.
  final Duration delay;

  /// The skeleton's height: the heading, the card, the peek and the dots.
  static const double height = 22 + MmSpace.s12 + 188 + deckPeek2 + MmSpace.s8 + 6;

  @override
  State<SuggestedStackSkeleton> createState() => _SuggestedStackSkeletonState();
}

class _SuggestedStackSkeletonState extends State<SuggestedStackSkeleton> {
  Timer? _timer;
  late bool _visible = widget.delay == Duration.zero;

  @override
  void initState() {
    super.initState();
    if (!_visible) _timer = Timer(widget.delay, () => mounted ? setState(() => _visible = true) : null);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible) return const SizedBox(height: SuggestedStackSkeleton.height);
    return const ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Align(alignment: Alignment.centerLeft, child: Skeleton.line(width: 168, height: 22)),
          SizedBox(height: MmSpace.s12),
          Skeleton(height: 188, radius: MmRadius.panel),
          SizedBox(height: deckPeek2 + MmSpace.s8 + 6),
        ],
      ),
    );
  }
}

/// One card: what it costs, its title, its evidence, its art, and the two buttons.
class _DeckCard extends StatelessWidget {
  const _DeckCard({super.key, required this.card, required this.at, required this.of, this.interactive = false, this.contentOpacity = 1, this.onSkip, this.onDo});

  final SuggestedCard card;
  final int at;
  final int of;
  final bool interactive;
  final double contentOpacity;
  final VoidCallback? onSkip;
  final VoidCallback? onDo;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 84),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (card.suggested) ...[
                Text(
                  SuggestedCopy.suggestedTag,
                  style: type.micro.copyWith(color: accent, fontWeight: FontWeight.w700, letterSpacing: 0.2),
                ),
                const SizedBox(height: MmSpace.s2),
              ],
              if (card.cost != null)
                Text(
                  card.cost!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: type.caption.copyWith(fontSize: 14, color: colors.ink3),
                ),
              const SizedBox(height: MmSpace.s2),
              Text(
                card.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: type.title.copyWith(fontSize: 19, height: 24 / 19, letterSpacing: -0.2, color: colors.ink),
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s6),
        Padding(
          padding: const EdgeInsets.only(right: MmSpace.s24),
          child: Text(
            card.line,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: type.small.copyWith(color: colors.ink2),
          ),
        ),
        // The buttons sit at the card's foot: every card in the deck is the tallest one's height.
        const SizedBox(height: MmSpace.s12),
        const Spacer(),
        // Side by side at the card's ends; under each other when large text cannot fit both.
        SizedBox(
          width: double.infinity,
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: MmSpace.s4,
            children: [
              _SkipButton(onTap: interactive ? onSkip : null, semanticsLabel: SuggestedCopy.skipSemantics(card.title)),
              _DoButton(onTap: interactive ? onDo : null, semanticsLabel: SuggestedCopy.doThisSemantics(card.title)),
            ],
          ),
        ),
      ],
    );
    final body = Stack(
      fit: StackFit.expand,
      clipBehavior: Clip.none,
      children: [
        Semantics(
          container: true,
          label: interactive ? SuggestedCopy.cardSemantics(at, of, card.cost, card.title, card.line, suggested: card.suggested) : null,
          child: words,
        ),
        Positioned(
          top: -4,
          right: -6,
          child: ExcludeSemantics(
            child: SizedBox(width: 76, height: 72, child: _Art(card: card)),
          ),
        ),
      ],
    );
    Widget out = DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
        boxShadow: colors.cardShadow,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, 18, MmSpace.cardPadding, MmSpace.s12),
        child: Opacity(opacity: contentOpacity, child: body),
      ),
    );
    if (!interactive) out = IgnorePointer(child: ExcludeSemantics(child: out));
    return out;
  }
}

/// A card with its stamps over it: "Do this instead" top left as it goes right, "Skip" top right
/// as it goes left, each at its strength (0 to 1 at the threshold).
class _Stamped extends StatelessWidget {
  const _Stamped({required this.yes, required this.no, required this.child});

  final double yes;
  final double no;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    return Stack(
      fit: StackFit.expand,
      clipBehavior: Clip.none,
      children: [
        child,
        if (yes > 0.01)
          Positioned(
            top: 16,
            left: 18,
            child: _Stamp(label: SuggestedCopy.doThis, color: accent, edge: accent, lean: -8, strength: yes),
          ),
        if (no > 0.01)
          Positioned(
            top: 16,
            right: 18,
            child: _Stamp(label: SuggestedCopy.skip, color: colors.ink2, edge: colors.ink3, lean: 8, strength: no),
          ),
      ],
    );
  }
}

/// The subject's object, Mobi, or the stopwatch, in the card's corner.
class _Art extends StatelessWidget {
  const _Art({required this.card});

  final SuggestedCard card;

  @override
  Widget build(BuildContext context) => Center(
    child: switch (card.art) {
      SuggestedArt.mobi => Mobi(pose: HeroArtView.poseFor(card.pose), size: 64),
      SuggestedArt.stopwatch => const HybridStopwatch(height: 60),
      SuggestedArt.subject => SubjectEmblem(subject: card.subjectId, size: EmblemSizes.tile, framed: false),
    },
  );
}

/// "Do this instead" or "Skip", pressed onto the card as it crosses the threshold.
class _Stamp extends StatelessWidget {
  const _Stamp({required this.label, required this.color, required this.edge, required this.lean, required this.strength});

  final String label;
  final Color color;
  final Color edge;
  final double lean;
  final double strength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // It lands from 1.08 to 1 as it reaches full strength: pressed on, not faded on.
    final s = 1.08 - 0.08 * strength;
    return Opacity(
      opacity: strength.clamp(0.0, 1.0),
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.rotationZ(lean * math.pi / 180)..scaleByDouble(s, s, 1, 1),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.raised,
            borderRadius: const BorderRadius.all(Radius.circular(8)),
            border: Border.all(color: edge, width: 2),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            child: Text(
              label,
              style: type.labelLarge.copyWith(fontSize: 15, height: 24 / 15, fontWeight: FontWeight.w700, color: color),
            ),
          ),
        ),
      ),
    );
  }
}

class _SkipButton extends StatelessWidget {
  const _SkipButton({required this.onTap, required this.semanticsLabel});

  final VoidCallback? onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 44,
      child: MmPressable(
        onTap: onTap,
        semanticsLabel: semanticsLabel,
        focusRadius: MmRadius.pillAll,
        pressedScale: 0.97,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => Container(
          height: 44,
          padding: const EdgeInsets.only(left: MmSpace.s8, right: 14),
          decoration: ShapeDecoration(color: pressed ? colors.raised2 : Colors.transparent, shape: const StadiumBorder()),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.x, size: 18, color: colors.ink2),
              const SizedBox(width: MmSpace.s6),
              Flexible(
                child: Text(
                  SuggestedCopy.skip,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DoButton extends StatelessWidget {
  const _DoButton({required this.onTap, required this.semanticsLabel});

  final VoidCallback? onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmHitSlop.toTarget(
      visual: 44,
      child: MmPressable(
        onTap: onTap,
        semanticsLabel: semanticsLabel,
        focusRadius: MmRadius.pillAll,
        pressedScale: 0.97,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => Container(
          height: 44,
          padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s16),
          decoration: ShapeDecoration(
            color: pressed ? colors.raised : colors.raised2,
            shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.arrowUp, size: 18, color: colors.ink),
              const SizedBox(width: MmSpace.s8),
              Flexible(
                child: Text(
                  SuggestedCopy.doThis,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The page dots: the card on top is the long one; those already seen are a step brighter.
class _Dots extends StatelessWidget {
  const _Dots({required this.states});

  final List<DotState> states;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var k = 0; k < states.length; k++) ...[
            if (k > 0) const SizedBox(width: MmSpace.s6),
            AnimatedContainer(
              duration: Motion.ui,
              curve: Motion.out,
              width: states[k] == DotState.on ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: switch (states[k]) {
                  DotState.on => colors.ink,
                  DotState.seen => colors.ink3,
                  DotState.ahead => colors.ink4,
                },
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The end of the deck: a dashed card with Mobi thinking, and the two ways on.
class _EndCard extends StatelessWidget {
  const _EndCard({required this.count, required this.onAgain, this.onMore});

  final int count;
  final VoidCallback onAgain;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final more = onMore;
    return CustomPaint(
      painter: _DashedEdge(color: colors.lineStrong),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 184),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24, vertical: MmSpace.s16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Mobi(pose: MobiPose.think, size: 64),
              const SizedBox(height: MmSpace.s6),
              Text(
                SuggestedCopy.allSeen(count),
                textAlign: TextAlign.center,
                style: type.labelLarge.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: colors.ink),
              ),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: MmSpace.s6,
                children: [
                  GlanceLink(label: SuggestedCopy.again, onTap: onAgain),
                  if (more != null) ...[
                    Text(SuggestedCopy.or, style: type.small.copyWith(color: colors.ink2)),
                    Semantics(
                      label: SuggestedCopy.everyWaySemantics,
                      excludeSemantics: true,
                      button: true,
                      child: GlanceLink(label: SuggestedCopy.everyWay, onTap: more),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedEdge extends CustomPainter {
  _DashedEdge({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final path = Path()..addRRect(MmRadius.panelAll.toRRect(Offset.zero & size).deflate(0.75));
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, math.min(d + 6, metric.length)), paint);
        d += 11;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedEdge old) => old.color != color;
}

/// A sideways drag that locks after [deckLock] dp of mostly sideways travel and gives way at once
/// to a mostly vertical one (the page's scroll).
class _DeckDragRecognizer extends OneSequenceGestureRecognizer {
  _DeckDragRecognizer({super.debugOwner});

  VoidCallback? onStart;
  ValueChanged<double>? onUpdate;
  ValueChanged<double>? onEnd;
  VoidCallback? onCancel;

  VelocityTracker? _tracker;
  Offset _travel = Offset.zero;
  bool _won = false;
  bool _dragging = false;
  int? _pointer;

  static bool claims(Offset d) => d.dx.abs() >= deckLock && d.dx.abs() > d.dy.abs();
  static bool yields(Offset d) => d.dy.abs() >= deckLock && d.dy.abs() >= d.dx.abs();

  @override
  void addAllowedPointer(PointerDownEvent event) {
    if (_pointer != null) return;
    super.addAllowedPointer(event);
    _pointer = event.pointer;
    _travel = Offset.zero;
    _won = false;
    _dragging = false;
    _tracker = VelocityTracker.withKind(event.kind)..addPosition(event.timeStamp, event.localPosition);
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event.pointer != _pointer) return;
    if (event is PointerMoveEvent) {
      _tracker?.addPosition(event.timeStamp, event.localPosition);
      if (_dragging) {
        onUpdate?.call(event.localDelta.dx);
        return;
      }
      _travel += event.localDelta;
      if (claims(_travel)) {
        if (!_won) resolve(GestureDisposition.accepted);
        if (_won) _begin();
      } else if (yields(_travel)) {
        if (!_won) resolve(GestureDisposition.rejected);
        stopTrackingPointer(event.pointer);
      }
    } else if (event is PointerUpEvent || event is PointerCancelEvent) {
      if (_dragging) {
        _dragging = false;
        if (event is PointerUpEvent) {
          onEnd?.call(_tracker?.getVelocity().pixelsPerSecond.dx ?? 0);
        } else {
          onCancel?.call();
        }
      } else if (!_won) {
        resolve(GestureDisposition.rejected);
      }
      stopTrackingPointer(event.pointer);
    }
  }

  void _begin() {
    if (_dragging) return;
    _dragging = true;
    onStart?.call();
    onUpdate?.call(_travel.dx);
  }

  @override
  void acceptGesture(int pointer) {
    _won = true;
    if (claims(_travel)) _begin();
  }

  @override
  void rejectGesture(int pointer) {
    if (_dragging) {
      _dragging = false;
      onCancel?.call();
    }
    _won = false;
    stopTrackingPointer(pointer);
  }

  @override
  void didStopTrackingLastPointer(int pointer) {
    _pointer = null;
    _tracker = null;
  }

  @override
  String get debugDescription => 'suggested deck drag';
}
