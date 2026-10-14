import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// The one layout of every moment screen (SPACING.md 7, audit G11): a header, then the content
/// block weighted to the optical centre (flex 2 above, flex 3 below), then the pinned action band.
/// It fixes the hollow screens, where content top-stacked and left a 190 to 256 dp hole above the
/// pinned key (repair entry and ending, the result card 4, the sealed sheet, the onboarding save,
/// the weekly goal).
///
/// When the content is taller than the room, it scrolls and the air above and below it collapses
/// to 24 dp each. [gutter] is the moment gutter (24): a moment is type and art with no cards, and
/// never mixes it with the 16 dp card gutter.
class MomentScaffold extends StatelessWidget {
  const MomentScaffold({
    super.key,
    required this.child,
    this.header,
    this.actions,
    this.gutter = MmSpace.momentGutter,
    this.topFlex = 2,
    this.bottomFlex = 3,
  });

  /// The content block: art, headline, a line or two. Centred horizontally.
  final Widget child;

  /// The 56 dp header row (a back key, a close, a step count), or null.
  final Widget? header;

  /// The pinned action band's content (a [MmPinnedActions] is made around it). Null for a moment
  /// with no key.
  final Widget? actions;

  final double gutter;
  final int topFlex;
  final int bottomFlex;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ?header,
          Expanded(
            child: CustomScrollView(
              physics: const ClampingScrollPhysics(),
              slivers: [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: gutter),
                    child: Column(
                      children: [
                        Spacer(flex: topFlex),
                        // The air that stays when the content fills the room.
                        const SizedBox(height: MmSpace.s24),
                        child,
                        const SizedBox(height: MmSpace.s24),
                        Spacer(flex: bottomFlex),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (actions != null) MmPinnedActions(child: actions!),
        ],
      ),
    );
  }
}

/// The pinned action band of a sheet, the runner, a result and onboarding (SPACING.md 4.5): a
/// 24 dp fade from transparent to ground above it, solid ground below, and the key stack inside on
/// the gutter. Put it last in a column, under the scrolling content. The fade overlays the bottom
/// 24 dp of that content, so a row or chip is dimmed under it and never half visible; give the
/// scrolling content bottom padding of at least 16 so its last row scrolls fully clear.
///
/// This is the action band of a screen. The floating navigation bar is `MmBottomBar`.
class MmPinnedActions extends StatelessWidget {
  const MmPinnedActions({super.key, required this.child, this.gutter = MmSpace.gutter, this.top = MmSpace.s8});

  final Widget child;

  /// Side padding. The card gutter by default; a moment passes [MmSpace.momentGutter].
  final double gutter;

  /// Air between the fade's end and the first key.
  final double top;

  /// How tall the fade above the band is.
  static const double fade = 24;

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: 0,
          right: 0,
          top: -fade,
          height: fade,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [ground.withValues(alpha: 0), ground],
                ),
              ),
            ),
          ),
        ),
        ColoredBox(
          color: ground,
          child: Padding(
            padding: EdgeInsets.fromLTRB(gutter, top, gutter, MmSpace.s16),
            child: child,
          ),
        ),
      ],
    );
  }
}
