import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The frame of a You screen: a lit glass back key, a large Bricolage title and a scrolling body
/// at most 600 dp wide on the warm ground. A faint desk lamp sits up and to the left of the
/// header, so the settings pages share the room's light without putting it behind the rows.
class YouPage extends StatelessWidget {
  const YouPage({
    super.key,
    required this.title,
    required this.children,
    this.showBack = true,
    this.large = true,
    this.padBottom = MmSpace.s48,
    this.lamp = true,
    this.footer,
  });

  final String title;
  final List<Widget> children;
  final bool showBack;

  /// The 28 sp moment headline (default) or the 22 sp title for a long, quiet page.
  final bool large;
  final double padBottom;

  /// The lamp pool in the upper left corner.
  final bool lamp;

  /// A key pinned under the scrolling body (an editor's Save), on the ground with a hairline
  /// above it. It rides above the keyboard.
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          if (lamp) const Positioned(left: 0, right: 0, top: 0, height: 300, child: YouHeaderLamp()),
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  children: [
                    Expanded(child: _scroll(context, type)),
                    if (footer != null) _Footer(child: footer!),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scroll(BuildContext context, MmType type) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: YouHeader(title: title, showBack: showBack, large: large)),
        SliverList.list(children: children),
        SliverToBoxAdapter(
          child: SizedBox(height: footer != null ? MmSpace.s24 : padBottom + MediaQuery.viewPaddingOf(context).bottom),
        ),
      ],
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.ground, border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12 + bottom),
        child: child,
      ),
    );
  }
}

/// The header every You and Rhythm screen shares: the lit back key, then the title in Bricolage.
/// One widget so the two feature areas, and both themes, never drift apart.
class YouHeader extends StatelessWidget {
  const YouHeader({super.key, required this.title, this.showBack = true, this.large = true, this.onBack});

  final String title;
  final bool showBack;

  /// The 28 sp moment headline (default) or the 22 sp title for a long, quiet page.
  final bool large;

  /// Replaces the pop (a screen that may be the first page goes to You instead).
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.gutter, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: showBack ? BackKey(onTap: onBack) : const SizedBox(height: MmTarget.min),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s12, MmSpace.gutter, MmSpace.s8),
          child: Semantics(header: true, child: Text(title, style: large ? type.headline : type.title)),
        ),
      ],
    );
  }
}

/// The desk lamp pool in the upper left of a You or Rhythm screen. It sits behind the header and
/// never behind rows.
class YouHeaderLamp extends StatelessWidget {
  const YouHeaderLamp({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return IgnorePointer(
      child: LightField(
        pools: [
          LightPool(
            color: colors.lamp.withValues(alpha: colors.isNight ? 0.13 : 0.10),
            center: const Alignment(-1.15, -1.25),
            radius: 0.95,
            aspect: 1.4,
          ),
        ],
      ),
    );
  }
}

/// A 44 dp lit glass disc with a back arrow, in a 48 dp target. It pops the current page; the
/// predictive back gesture does the same. [onTap] replaces the pop (a screen that may be the
/// first page goes to You instead).
class BackKey extends StatelessWidget {
  const BackKey({super.key, this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      semanticsLabel: 'Back',
      onTap: onTap ?? () => Navigator.of(context).maybePop(),
      builder: (context, pressed, _) => SizedBox.square(
        dimension: MmTarget.min,
        child: Center(child: GlassDisc(pressed: pressed, child: Icon(LucideIcons.arrowLeft, size: 20, color: context.mmColors.ink))),
      ),
    );
  }
}

/// A small round lit pane: the back key, the icon wells of rows on moment surfaces. Warm on
/// Night (a breath of lamp in the upper left), paper on Daylight.
class GlassDisc extends StatelessWidget {
  const GlassDisc({super.key, required this.child, this.size = 44, this.pressed = false});

  final Widget child;
  final double size;
  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors.isNight ? [Color.lerp(colors.raised2, colors.lamp, 0.08)!, colors.raised] : [colors.raised, colors.raised2],
        ),
        boxShadow: colors.cardShadow,
      ),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: MmRadius.pillAll,
          top: colors.edgeTop,
          bottom: colors.edgeBottom,
          boost: pressed ? MmElevation.pressedEdgeBoost : 1,
          sheen: false,
        ),
        child: SizedBox.square(dimension: size, child: Center(child: child)),
      ),
    );
  }
}

/// Horizontal padding every body block of a You screen shares.
const EdgeInsets youGutter = EdgeInsets.symmetric(horizontal: MmSpace.gutter);

/// A short sentence-case heading above a group, with an optional trailing action.
class GroupHeading extends StatelessWidget {
  const GroupHeading(this.text, {super.key, this.trailing, this.top = MmSpace.s32});

  final String text;
  final Widget? trailing;
  final double top;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter + 4, top, trailing == null ? MmSpace.gutter : MmSpace.s4, MmSpace.s8),
      child: Row(
        children: [
          Expanded(
            child: Semantics(header: true, child: Text(text, style: type.labelLarge.copyWith(color: context.mmColors.ink2))),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// A glass pill as wide as its label and 48 dp tall: the way a You page offers a side action (Try
/// again, Remove, See every event) with a visible shape and a full touch target. It is sized to
/// its label by [IntrinsicWidth] instead of the key's own intrinsic mode, which would draw the
/// label twice.
class PillKey extends StatelessWidget {
  const PillKey({super.key, required this.label, required this.onPressed, this.semanticsLabel});

  final String label;
  final VoidCallback? onPressed;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return IntrinsicWidth(
      child: KeyButton.secondary(label: label, minHeight: MmTarget.min, onPressed: onPressed, semanticsLabel: semanticsLabel),
    );
  }
}
