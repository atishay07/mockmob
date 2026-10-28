import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

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
      decoration: BoxDecoration(color: colors.raised, border: Border(top: BorderSide(color: colors.line))),
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
