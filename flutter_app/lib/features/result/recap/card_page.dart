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
  });

  final List<Widget> children;
  final Widget footer;

  /// Null on the last card.
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final double topPadding;

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
  List<Widget> _staggered(List<Widget> children) {
    var n = 0;
    return [
      for (final c in children)
        if (c is SizedBox && c.child == null)
          c
        else
          Arrive(
            delay: Duration(milliseconds: 90 + 55 * (n++).clamp(0, 8)),
            duration: const Duration(milliseconds: 480),
            rise: 16,
            child: c,
          ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScroll,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics()),
              padding: EdgeInsets.fromLTRB(MmSpace.cardGutter, widget.topPadding, MmSpace.cardGutter, MmSpace.s24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _staggered(widget.children)),
            ),
          ),
        ),
        Padding(padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s12), child: widget.footer),
      ],
    );
  }
}
