import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../widgets/engrave.dart';

/// The frame of recap cards 2 to 4: the card's content in a scroll view (it scrolls at large text
/// sizes, never clips) and its keys pinned below. Swiping past the end goes to the next card,
/// past the start to the previous one, so "swipe up means continue" holds on every card.
class RecapCardPage extends StatefulWidget {
  const RecapCardPage({
    super.key,
    required this.children,
    required this.footer,
    required this.onNext,
    required this.onBack,
    this.topPadding = MmSpace.s8,
    this.anchored,
  });

  final List<Widget> children;
  final Widget footer;

  /// Null on the last card.
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final double topPadding;

  /// Rests on the floor of the card, just above the keys, when the content is shorter than the
  /// card (the card's one moment, such as Mobi). Follows the content when it scrolls.
  final Widget? anchored;

  static const double swipeDistance = 64;

  @override
  State<RecapCardPage> createState() => _RecapCardPageState();
}

class _RecapCardPageState extends State<RecapCardPage> {
  double _overscroll = 0;

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0) return false;
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
    final anchored = widget.anchored;
    return Column(
      children: [
        Expanded(
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScroll,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics()),
              slivers: [
                SliverPadding(
                  padding: EdgeInsets.only(top: widget.topPadding, bottom: anchored == null ? MmSpace.s24 : 0),
                  // Built in full, never lazily: every block is in the tree for TalkBack and for tests.
                  sliver: SliverToBoxAdapter(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _staggered(widget.children)),
                  ),
                ),
                if (anchored != null)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s16, MmSpace.cardGutter, MmSpace.s16),
                      child: Align(
                        alignment: Alignment.bottomLeft,
                        child: Arrive(
                          delay: const Duration(milliseconds: 320),
                          duration: const Duration(milliseconds: 520),
                          rise: 20,
                          child: anchored,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s12), child: widget.footer),
      ],
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
