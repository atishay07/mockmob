import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The frame of a You screen: a lit glass back key, an inline Bricolage title and a scrolling body
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
                    // The list fades out above a pinned footer instead of being cut by a rule.
                    Expanded(
                      child: Stack(
                        children: [
                          Positioned.fill(child: _scroll(context, type)),
                          if (footer != null) Positioned(left: 0, right: 0, bottom: 0, height: 28, child: _FooterFade(color: colors.ground)),
                        ],
                      ),
                    ),
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
    // One authored entrance as the page arrives (route driver): the body's blocks rise in reading
    // order after the header. A page that is already up never moves, and scrolling never replays.
    return MmStagger(
      driver: MmStaggerDriver.route,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: YouHeader(title: title, showBack: showBack, large: large)),
          SliverList.list(children: [for (var i = 0; i < children.length; i++) MmStaggerItem(index: i, child: children[i])]),
          SliverToBoxAdapter(
            child: SizedBox(height: footer != null ? MmSpace.s24 : padBottom + MediaQuery.viewPaddingOf(context).bottom),
          ),
        ],
      ),
    );
  }
}

/// A functional scrim: the ground colour fading in over the last 28 dp of the list, so a row
/// that scrolls under the footer dissolves instead of being cut.
class _FooterFade extends StatelessWidget {
  const _FooterFade({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withValues(alpha: 0), color]),
        ),
      ),
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
      decoration: BoxDecoration(color: colors.ground),
      child: Padding(
        padding: EdgeInsets.fromLTRB(youText, MmSpace.s4, youText, MmSpace.s12 + bottom),
        child: child,
      ),
    );
  }
}

/// The header every You, Rhythm and Tools sub-page shares (SPACING.md 9): the lit back key at the
/// gutter, 12 dp, then the title inline in the `screenTitle` cut, in a 56 dp row; an optional
/// [trailing] action sits at the far end. One widget, so the screens and both themes never drift.
/// The stacked large headline is for moment screens only, so [large] is kept for callers but no
/// longer changes the layout.
class YouHeader extends StatelessWidget {
  const YouHeader({super.key, required this.title, this.showBack = true, this.large = true, this.onBack, this.trailing});

  final String title;
  final bool showBack;

  /// Kept so existing callers compile; the inline title is the same size for every page.
  final bool large;

  /// Replaces the pop (a screen that may be the first page goes to You instead).
  final VoidCallback? onBack;

  /// An action at the end of the row (a 48 dp target).
  final Widget? trailing;

  /// The back key is a 44 dp disc in a 48 dp target: this much of the target sits left of the
  /// disc, so the disc's edge lands on the gutter.
  static const double _targetSlop = (MmTarget.min - 44) / 2;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Padding(
        padding: EdgeInsets.fromLTRB(showBack ? MmSpace.gutter - _targetSlop : MmSpace.gutter, MmRhythm.screenTop, MmSpace.gutter, MmSpace.s8),
        child: Row(
          children: [
            if (showBack) ...[BackKey(onTap: onBack), const SizedBox(width: MmSpace.s12 - _targetSlop)],
            Expanded(
              child: Semantics(
                header: true,
                child: Text(title, style: type.screenTitle, maxLines: 2, overflow: TextOverflow.ellipsis),
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
          ],
        ),
      ),
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
          colors: colors.isNight ? [Color.lerp(colors.raised2, colors.lamp, 0.08)!, colors.raised] : [colors.raised, Color.lerp(colors.raised, colors.sunken, 0.5)!],
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

/// Where the words of a You screen start: the one page margin every section, heading and row
/// aligns to (16 dp), so left edges never zigzag down a page.
const double youText = MmSpace.gutter;

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
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, trailing == null ? MmSpace.gutter : MmSpace.s4, MmSpace.s8),
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

/// A section title in Bricolage 22: the step of hierarchy between a screen title and a row. Sentence
/// case, ink, with an optional action at the end of the line. [padding] defaults to the 4 dp inset
/// the rhythm screens use under their gutter; the hub passes its own.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing, this.padding, this.bottom = MmSpace.s12});

  final String text;
  final Widget? trailing;
  final EdgeInsetsGeometry? padding;
  final double bottom;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final title = Semantics(header: true, child: Text(text, style: type.title.copyWith(fontSize: 24, height: 28 / 24)));
    return Padding(
      padding: padding ?? EdgeInsets.fromLTRB(4, 0, 0, bottom),
      child: trailing == null ? title : Row(children: [Expanded(child: title), trailing!]),
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
