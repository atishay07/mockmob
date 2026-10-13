import 'package:flutter/material.dart';
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
      decoration: BoxDecoration(color: colors.ground, border: Border(top: BorderSide(color: colors.line))),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s8),
                    child: Semantics(liveRegion: true, child: Text(message!, style: context.mmType.body)),
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
  const IconTap({super.key, required this.icon, required this.label, required this.onTap});

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
        child: SizedBox(width: 48, height: 48, child: Icon(icon, size: 24, color: context.mmColors.ink)),
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
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s4, MmSpace.gutter, MmSpace.s8),
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
                      child: Center(child: Icon(LucideIcons.arrowLeft, size: 20, color: colors.ink)),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Semantics(header: true, child: Text(LearnCopy.title, style: context.mmType.screenTitle)),
            ),
          ],
        ),
      ),
    );
  }
}
