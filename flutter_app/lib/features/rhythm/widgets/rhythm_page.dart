// The page frame shared by the You screens of this feature: the lit back key, a large title,
// the lamp in the upper left, and a scrolling body no wider than 600 dp. Same frame as the rest
// of You, so moving between them never jumps.
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button.dart';
import '../../you/widgets/you_page.dart' show YouHeader, YouHeaderLamp;

class RhythmPage extends StatelessWidget {
  const RhythmPage({super.key, required this.title, required this.child, this.scrollable = true, this.padded = true});

  final String title;
  final Widget child;

  /// False when [child] fills the rest of the page by itself (a state view).
  final bool scrollable;

  /// Gives [child] the screen gutter. Off for children that bring their own (panels).
  final bool padded;

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
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    final header = [YouHeader(title: title, onBack: () => _back(context))];
    final body = padded ? Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: child) : child;

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          const Positioned(left: 0, right: 0, top: 0, height: 300, child: YouHeaderLamp()),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: scrollable
                    ? ListView(
                        padding: EdgeInsets.only(bottom: MmSpace.s48 + bottom),
                        children: [...header, const SizedBox(height: MmSpace.s8), body],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [...header, Expanded(child: child)],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A hairline-topped row: [child] with an optional trailing widget, at least 48 dp tall.
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

/// A group heading: sentence case, quiet, no kicker caps.
class GroupHeading extends StatelessWidget {
  const GroupHeading(this.text, {super.key, this.trailing});

  final String text;

  /// An optional action at the end of the line.
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final label = Semantics(header: true, child: Text(text, style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink2)));
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: MmSpace.s8),
      child: trailing == null ? label : Row(children: [Expanded(child: label), trailing!]),
    );
  }
}

/// A quiet key whose label lines up with the text above it: the key keeps its 48 dp target and
/// its label sits where the body text starts, not 16 dp in. With [chevron] a small arrow follows
/// the label, so a key that opens another screen reads as a way in and not as plain text.
class FlushQuietKey extends StatelessWidget {
  const FlushQuietKey({super.key, required this.label, required this.onPressed, this.chevron = false});

  final String label;
  final VoidCallback? onPressed;
  final bool chevron;

  /// The horizontal padding inside a quiet key, which this widget gives back.
  static const double inset = 16;

  @override
  Widget build(BuildContext context) {
    final key = KeyButton.quiet(label: label, onPressed: onPressed);
    final Widget row = chevron
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              key,
              // Sits inside the key's own right padding, so it adds no width and the key's
              // whole face stays the target.
              Transform.translate(
                offset: const Offset(-14, 0),
                child: IgnorePointer(
                  child: ExcludeSemantics(child: Icon(LucideIcons.chevronRight, size: 16, color: onPressed == null ? context.mmColors.ink4 : context.mmColors.ink2)),
                ),
              ),
            ],
          )
        : key;
    return Align(
      alignment: Alignment.centerLeft,
      child: Transform.translate(offset: const Offset(-inset, 0), child: row),
    );
  }
}
