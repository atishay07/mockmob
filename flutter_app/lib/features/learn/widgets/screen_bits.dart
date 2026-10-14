import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The surface for a state that is on: an answer just revealed, a callout in a lesson. Night
/// lifts it above the card (`raised2`); Day cannot go lighter than the card, so it keeps the card
/// colour and relies on the border (a taupe slab reads as disabled, SPACING.md 8.1). It follows
/// the core selection language ([MmSelection]), so it changes with it.
Color learnSelectedSurface(MmColors colors) =>
    MmSelection.fill(colors, selected: true);

/// The keys pinned at the foot of a screen, with an optional plain line above them. The content
/// above scrolls; these never leave the screen. A 24 dp fade from transparent to the ground sits
/// over the bottom of the content, so a row is never cut by a hard edge (SPACING.md 4.5); the bar
/// itself is the ground, not a second surface.
class PinnedActions extends StatelessWidget {
  const PinnedActions({
    super.key,
    required this.children,
    this.message,
    this.gutter = MmSpace.gutter,
  });

  final List<Widget> children;

  /// A plain, announced line (an error or a state) shown above the keys.
  final String? message;

  /// Side padding: 16 on screens with cards, 24 on moment screens (type and art, no cards).
  final double gutter;

  static const double fade = MmSpace.s24;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ColoredBox(
          color: colors.ground,
          child: Center(
            heightFactor: 1,
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: MmSpace.contentMaxWidth,
              ),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  gutter,
                  MmSpace.s8,
                  gutter,
                  MmSpace.s12,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (message != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: MmSpace.s8),
                        child: Semantics(
                          liveRegion: true,
                          child: Text(message!, style: context.mmType.body),
                        ),
                      ),
                    for (var i = 0; i < children.length; i++) ...[
                      if (i > 0) const SizedBox(height: MmSpace.s8),
                      children[i],
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
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
                  colors: [colors.ground.withAlpha(0), colors.ground],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A bare 48 dp icon target (the run's close key), named for TalkBack. It answers a touch on the
/// next frame: it sinks on the press spring and shows the press veil.
class IconTap extends StatelessWidget {
  const IconTap({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      semanticsLabel: label,
      onTap: onTap,
      highlight: true,
      builder: (context, pressed, _) => SizedBox.square(
        dimension: MmTarget.min,
        child: Center(
          child: Icon(icon, size: 24, color: context.mmColors.ink),
        ),
      ),
    );
  }
}

/// Between two sections of a screen: 32 dp of air, a 1 dp hairline, then 16 dp before the next
/// heading (SPACING.md 3.1).
class SectionBreak extends StatelessWidget {
  const SectionBreak({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s32, bottom: MmSpace.s16),
      child: SizedBox(
        height: 1,
        child: ColoredBox(color: context.mmColors.line),
      ),
    );
  }
}

/// The top bar of every Concepts page: the app's one page header ([MmPageHeader], SPACING.md
/// section 9), the back arrow on the gutter, the title in the screen-title cut, an optional
/// trailing key. Without a [title] the bar carries only the back key (a page whose title is its
/// content).
class LearnPageHeader extends StatelessWidget {
  const LearnPageHeader({
    super.key,
    required this.onBack,
    this.title,
    this.trailing,
    this.backLabel = LearnCopy.back,
  });

  final VoidCallback onBack;
  final String? title;
  final Widget? trailing;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    return MmPageHeader(
      title: title ?? '',
      onBack: onBack,
      backLabel: backLabel,
      trailing: trailing,
    );
  }
}

/// The Concepts tab's bar.
class ConceptsHeader extends StatelessWidget {
  const ConceptsHeader({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) =>
      LearnPageHeader(onBack: onBack, title: LearnCopy.title);
}

/// Makes system Back on a deep-linked Learn screen go to [fallback] instead of leaving the app.
/// With a screen underneath, Back pops as usual.
class LearnBackScope extends StatelessWidget {
  const LearnBackScope({
    super.key,
    required this.fallback,
    required this.child,
  });

  /// Where Back goes when nothing is under this screen (Practice for Learn, Learn for its pages).
  final String fallback;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final router = GoRouter.maybeOf(context);
    // Outside the app's router (the lab, a golden) there is nowhere to fall back to, and Back
    // keeps the navigator's own behaviour.
    if (router == null) return child;
    return PopScope(
      canPop: router.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && context.mounted) router.go(fallback);
      },
      child: child,
    );
  }
}
