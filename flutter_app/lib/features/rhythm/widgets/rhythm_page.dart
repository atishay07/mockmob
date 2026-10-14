// The page frame shared by the You screens of this feature: the lit back key with the title inline
// on one 56 dp row, the lamp in the upper left, and a scrolling body no wider than 600 dp, every
// left edge on the 16 dp gutter (SPACING.md 1.1 and 9).
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button.dart';
import '../../../core/widgets/pressable.dart';
import '../../you/widgets/you_page.dart' show YouHeaderLamp;
import 'rhythm_layout.dart';

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
    final header = RhythmHeader(title: title, onBack: () => _back(context));
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
                        padding: EdgeInsets.only(bottom: MmSpace.s32 + bottom),
                        children: [header, const SizedBox(height: MmSpace.s16), body],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [header, Expanded(child: child)],
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

/// A quiet pill: a 48 dp outlined capsule for the choices that sit under a volt primary. It reads
/// as a button (a visible edge, a pressed fill) without competing with it. With [danger] the label
/// and the edge take the warm error tone, for the one action that switches something off.
/// Put it in an `Expanded` to share a row; it fills the width it is given.
class QuietPill extends StatelessWidget {
  const QuietPill({super.key, required this.label, required this.onPressed, this.danger = false, this.semanticsLabel});

  final String label;
  final VoidCallback? onPressed;
  final bool danger;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onPressed != null;
    final tone = !enabled ? colors.ink4 : (danger ? colors.badText : colors.ink);
    final edge = danger ? colors.wrongBorder.withValues(alpha: colors.isNight ? 0.7 : 0.55) : colors.lineStrong;
    return MmPressable(
      onTap: onPressed,
      semanticsLabel: semanticsLabel ?? label,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: pressed ? (colors.isNight ? colors.raised2 : colors.sunken) : Colors.transparent,
          borderRadius: MmRadius.pillAll,
          border: Border.all(color: edge),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s8),
            child: Center(child: Text(label, textAlign: TextAlign.center, style: type.button.copyWith(color: tone))),
          ),
        ),
      ),
    );
  }
}

/// A headline that wraps evenly. When [text] needs more than one line at the width it is given,
/// the width shrinks to the narrowest that still needs the same number of lines, so no single
/// word is left alone on the last line. The string itself is untouched.
class BalancedText extends StatelessWidget {
  const BalancedText(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    return LayoutBuilder(
      builder: (context, box) {
        final full = box.maxWidth;
        if (!full.isFinite) return Text(text, style: style);
        int lines(double width) {
          final painter = TextPainter(text: TextSpan(text: text, style: style), textDirection: direction, textScaler: scaler)..layout(maxWidth: width);
          final n = painter.computeLineMetrics().length;
          painter.dispose();
          return n;
        }

        final n = lines(full);
        if (n < 2) return Text(text, style: style);
        var lo = full / 2;
        var hi = full;
        for (var i = 0; i < 9; i++) {
          final mid = (lo + hi) / 2;
          if (lines(mid) <= n) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        return Align(alignment: Alignment.centerLeft, child: SizedBox(width: hi.ceilToDouble() + 1, child: Text(text, style: style)));
      },
    );
  }
}
