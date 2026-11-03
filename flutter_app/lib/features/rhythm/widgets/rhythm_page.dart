// The page frame shared by the three You screens of this feature: a back key, a title, and a
// scrolling body no wider than 600 dp. Rows are hairline-separated, never nested cards.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button.dart';

class RhythmPage extends StatelessWidget {
  const RhythmPage({super.key, required this.title, required this.child, this.scrollable = true});

  final String title;
  final Widget child;

  /// False when [child] scrolls by itself (a state view).
  final bool scrollable;

  void _back(BuildContext context) {
    final router = GoRouter.maybeOf(context);
    if (router != null && router.canPop()) {
      router.pop();
    } else if (router != null) {
      router.go(AppRoutes.you);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final body = scrollable
        ? SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s48),
            child: child,
          )
        : child;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.gutter, 0),
                  child: Row(
                    children: [
                      Semantics(
                        button: true,
                        label: 'Back',
                        excludeSemantics: true,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _back(context),
                          child: SizedBox(
                            width: MmTarget.min,
                            height: MmTarget.min,
                            child: Icon(LucideIcons.arrowLeft, size: 24, color: colors.ink),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Semantics(header: true, child: Text(title, style: type.title)),
                      ),
                    ],
                  ),
                ),
                Expanded(child: body),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A hairline-topped row: [child] with an optional trailing widget, at least 44 dp tall.
class HairlineRow extends StatelessWidget {
  const HairlineRow({super.key, required this.child, this.trailing, this.first = false, this.padding});

  final Widget child;
  final Widget? trailing;

  /// No hairline above the first row of a group.
  final bool first;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: colors.line))),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: padding ?? const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              Expanded(child: child),
              if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
            ],
          ),
        ),
      ),
    );
  }
}

/// A group heading: sentence case Gabarito label, no kicker caps.
class GroupHeading extends StatelessWidget {
  const GroupHeading(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s8),
      child: Semantics(header: true, child: Text(text, style: context.mmType.subhead)),
    );
  }
}

/// A quiet key whose label lines up with the text above it: the key keeps its 44 dp target and
/// its label sits where the body text starts, not 16 dp in.
class FlushQuietKey extends StatelessWidget {
  const FlushQuietKey({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  /// The horizontal padding inside a quiet key, which this widget gives back.
  static const double inset = 16;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Transform.translate(offset: const Offset(-inset, 0), child: KeyButton.quiet(label: label, onPressed: onPressed)),
    );
  }
}
