import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../widgets/engrave.dart';
import '../widgets/result_space.dart';

/// The frame of recap cards 2 to 4: the card's content in a scroll view (it scrolls at large text
/// sizes, never clips) and its keys pinned below. Swiping past the end goes to the next card,
/// past the start to the previous one, so "swipe up means continue" holds on every card.
///
/// One contract for every card: the body ends where the keys begin (it is never laid under
/// them), and whenever more of it waits below the fold its lower edge fades out, so a cut line of
/// text reads as "scroll" and never as a broken card.
///
/// A card shorter than the screen is weighted, not top-stacked (SPACING 7, audit X3): the free
/// height splits two parts above the content to three below it, so no hole opens above the key.
class RecapCardPage extends StatefulWidget {
  const RecapCardPage({super.key, required this.children, required this.footer, required this.onNext, required this.onBack, this.topPadding = MmSpace.s8});

  final List<Widget> children;
  final Widget footer;

  /// Null on the last card.
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final double topPadding;

  static const double swipeDistance = 64;

  /// How tall the fade at the lower edge of the body is while more waits below it (the pinned
  /// bar's 24 dp fade, SPACING 4.5).
  static const double fadeHeight = MmSpace.s24;

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

  /// The pinned footer's height (measured) and whether the body is taller than its box. A body that
  /// scrolls gets the footer's height as extra room at its end, so its last line can be carried
  /// well clear of the keys and of the fade above them (at large text "Share your sheet" sat half
  /// behind the Repair key and could not be scrolled out from under it). A body that fits gets
  /// none, so a short card never gains a scroll.
  final GlobalKey _footerKey = GlobalKey();
  double _footerHeight = 0;
  bool _overflows = false;

  /// The extra room the last build applied, so the overflow test can leave it out.
  double _extra = 0;

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
    final overflows = m.maxScrollExtent - _extra > 0.5;
    if ((more != _more || overflows != _overflows) && mounted) {
      setState(() {
        _more = more;
        _overflows = overflows;
      });
    }
  }

  void _measureFooter() {
    final box = _footerKey.currentContext?.findRenderObject();
    if (!mounted || box is! RenderBox || !box.hasSize) return;
    if ((box.size.height - _footerHeight).abs() > 0.5) setState(() => _footerHeight = box.size.height);
  }

  /// The card's content arrives in reading order after the card itself: each block rises 12 dp
  /// and fades in, 45 ms after the one above it (420 ms each, emphasized; MOTION 4.8), so the
  /// headline lands first and the evidence follows it. Spacers are not animated. Reduced
  /// motion: all at once.
  /// Blocks marked [RecapBleed] run nearly edge to edge; the rest sit in the card's gutters.
  List<Widget> _staggered(List<Widget> children) {
    var n = 0;
    return [
      for (final c in children)
        if (c is SizedBox && c.child == null)
          c
        else
          Padding(
            padding: EdgeInsets.symmetric(horizontal: c is RecapBleed ? RecapBleed.gutter : ResultSpace.moment),
            child: Arrive(
              delay: Duration(milliseconds: 90 + ResultMotion.blockStagger.inMilliseconds * (n++).clamp(0, 8)),
              duration: ResultMotion.block,
              rise: ResultMotion.blockRise,
              child: c is RecapBleed ? c.child : c,
            ),
          ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    _extra = _overflows ? _footerHeight : 0;
    WidgetsBinding.instance.addPostFrameCallback((_) => _measureFooter());
    final scroll = KeyedSubtree(
      key: _scrollKey,
      child: NotificationListener<ScrollMetricsNotification>(
        onNotification: _onMetrics,
        child: NotificationListener<ScrollNotification>(
          onNotification: _onScroll,
          child: LayoutBuilder(
            builder: (context, box) {
              final content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _staggered(widget.children));
              final free = box.maxHeight.isFinite ? box.maxHeight - widget.topPadding - MmSpace.s24 : 0.0;
              return CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics()),
                slivers: [
                  SliverPadding(
                    padding: EdgeInsets.only(top: widget.topPadding, bottom: MmSpace.s24 + _extra),
                    // Built in full, never lazily: every block is in the tree for TalkBack and for
                    // tests. At least the screen's height, with the content at 2 : 3 in it; a
                    // taller card simply scrolls from its top.
                    sliver: SliverToBoxAdapter(
                      child: ConstrainedBox(
                        constraints: BoxConstraints(minHeight: free > 0 ? free : 0),
                        child: Align(alignment: const Alignment(0, ResultSpace.momentWeight), child: content),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
    return Column(
      children: [
        Expanded(
          child: _BottomFade(active: _more, child: scroll),
        ),
        Padding(key: _footerKey, padding: const EdgeInsets.fromLTRB(ResultSpace.moment, MmSpace.s8, ResultSpace.moment, MmSpace.s12), child: widget.footer),
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
