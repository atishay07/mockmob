import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The keys pinned at the foot of a screen on a raised bar, with an optional plain line above
/// them. The content above scrolls; these never leave the screen.
class PinnedActions extends StatelessWidget {
  const PinnedActions({super.key, required this.children, this.message});

  final List<Widget> children;

  /// A plain, announced line (an error or a state) shown above the keys.
  final String? message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      // A faint hairline: the bar is the ground, not a second surface.
      decoration: BoxDecoration(
        color: colors.ground,
        border: Border(
          top: BorderSide(color: colors.line.withValues(alpha: 0.5)),
        ),
      ),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              MmSpace.gutter,
              MmSpace.s12,
              MmSpace.gutter,
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
    );
  }
}

/// A 48 dp icon target with no ripple, named for TalkBack.
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
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Icon(icon, size: 24, color: context.mmColors.ink),
        ),
      ),
    );
  }
}

/// The top of the Concepts page: a small glass back disc and the title in the Bricolage cut.
class ConceptsHeader extends StatelessWidget {
  const ConceptsHeader({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        MmSpace.s12,
        MmSpace.s4,
        MmSpace.gutter,
        MmSpace.s8,
      ),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            MmPressable(
              semanticsLabel: LearnCopy.back,
              onTap: onBack,
              builder: (context, pressed, _) => SizedBox.square(
                dimension: MmTarget.min,
                child: Center(
                  child: SizedBox.square(
                    dimension: 44,
                    child: FakeGlass(
                      borderRadius: MmRadius.pillAll,
                      pressed: pressed,
                      grain: false,
                      child: Center(
                        child: Icon(
                          LucideIcons.arrowLeft,
                          size: 20,
                          color: colors.ink,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Semantics(
                header: true,
                child: Text(LearnCopy.title, style: context.mmType.screenTitle),
              ),
            ),
          ],
        ),
      ),
    );
  }
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
