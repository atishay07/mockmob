import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../widgets/engrave.dart';

/// The frame of recap cards 2 to 4: the card's content in a scroll view (it scrolls at large text
/// sizes, never clips) and its keys pinned below. Swiping past the end goes to the next card,
/// past the start to the previous one, so "swipe up means continue" holds on every card.
///
/// One contract for every card: the body ends where the keys begin (it is never laid under
/// them), and whenever more of it waits below the fold its lower edge fades out, so a cut line of
/// text reads as "scroll" and never as a broken card.
class RecapCardPage extends StatefulWidget {
  const RecapCardPage({super.key, required this.children, required this.footer, required this.onNext, required this.onBack, this.topPadding = MmSpace.s8});

  final List<Widget> children;
  final Widget footer;

  /// Null on the last card.
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final double topPadding;

  static const double swipeDistance = 64;

  /// How tall the fade at the lower edge of the body is while more waits below it.
  static const double fadeHeight = 40;

  @override
  State<RecapCardPage> createState() => _RecapCardPageState();
}

class _RecapCardPageState extends State<RecapCardPage> {
  double _overscroll = 0;

  /// Keeps the scroll view's state (its offset, its drag) when the fade comes and goes around it:
  /// the fade wraps it in a mask only while more waits below, and without a key that wrap would
  /// rebuild the view from the top the moment the end was reached.
  final GlobalKey _scrollKey = GlobalKey();

  /// True while some of the body is still below the fold.
  bool _more = false;

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0) return false;
    _track(n.metrics);
    if (n is ScrollStartNotification) _overscroll = 0;
    if (n is OverscrollNotification && n.dragDetails != null) _overscroll += n.overscroll;
    if (n is ScrollEndNotification) {
      final o = _overscroll;
      _overscroll = 0;
      if (o > RecapCardPage.swipeDistance) widget.onNext?.call();
      if (o < -RecapCardPage.swipeDistance) widget.onBack?.call();
    }
    return false;
  }

  bool _onMetrics(ScrollMetricsNotification n) {
    if (n.depth == 0) _track(n.metrics);
    return false;
  }

  void _track(ScrollMetrics m) {
    final more = m.extentAfter > 2;
    if (more != _more && mounted) setState(() => _more = more);
  }

  /// The card's content arrives in reading order after the card itself: each block rises 16 dp
  /// and fades in, 55 ms after the one above it (480 ms each, emphasized), so the headline lands
  /// first and the evidence follows it. Spacers are not animated. Reduced motion: all at once.
  /// Blocks marked [RecapBleed] run nearly edge to edge; the rest sit in the card's gutters.
  List<Widget> _staggered(List<Widget> children) {
    var n = 0;
    return [
      for (final c in children)
        if (c is SizedBox && c.child == null)
          c
        else
          Padding(
            padding: EdgeInsets.symmetric(horizontal: c is RecapBleed ? RecapBleed.gutter : MmSpace.cardGutter),
            child: Arrive(
              delay: Duration(milliseconds: 90 + 55 * (n++).clamp(0, 8)),
              duration: const Duration(milliseconds: 480),
              rise: 16,
              child: c is RecapBleed ? c.child : c,
            ),
          ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final scroll = KeyedSubtree(
      key: _scrollKey,
      child: NotificationListener<ScrollMetricsNotification>(
        onNotification: _onMetrics,
        child: NotificationListener<ScrollNotification>(
          onNotification: _onScroll,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics()),
            slivers: [
              SliverPadding(
                padding: EdgeInsets.only(top: widget.topPadding, bottom: MmSpace.s24),
                // Built in full, never lazily: every block is in the tree for TalkBack and for tests.
                sliver: SliverToBoxAdapter(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _staggered(widget.children)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return Column(
      children: [
        Expanded(
          child: _BottomFade(active: _more, child: scroll),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s12), child: widget.footer),
      ],
    );
  }
}

/// Fades the lower [RecapCardPage.fadeHeight] of [child] to nothing while [active] (a functional
/// scrim: it says "more below", and carries no colour of its own, so it suits both themes).
class _BottomFade extends StatelessWidget {
  const _BottomFade({required this.active, required this.child});

  final bool active;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(end: active ? 1 : 0),
      duration: reduced ? Duration.zero : const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      child: child,
      builder: (context, t, child) {
        if (t <= 0.001) return child!;
        return ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (rect) {
            final fade = (RecapCardPage.fadeHeight * t).clamp(0.0, rect.height);
            final from = rect.height <= 0 ? 1.0 : 1 - fade / rect.height;
            return LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: const [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)],
              stops: [0, from, 1],
            ).createShader(rect);
          },
          child: child,
        );
      },
    );
  }
}

/// Marks a block of a recap card that runs nearly edge to edge (a printed sheet), instead of
/// sitting in the card's gutters.
class RecapBleed extends StatelessWidget {
  const RecapBleed({super.key, required this.child});

  final Widget child;

  static const double gutter = 8;

  @override
  Widget build(BuildContext context) => child;
}
