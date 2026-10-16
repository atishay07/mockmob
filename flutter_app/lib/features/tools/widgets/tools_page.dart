import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart';
import '../../you/widgets/you_row.dart' show IconWell;
import '../copy.dart' show ToolsCopy;
import 'tools_parts.dart';

export '../../you/widgets/you_page.dart' show BackKey, GlassDisc, GroupHeading, youGutter;
export '../../you/widgets/you_row.dart' show IconWell;
export 'tools_parts.dart';

/// The frame of a tools screen, matching You (the tools live behind it): the lit back key, a
/// Bricolage title, an optional lead line, then [slivers], at most 600 dp wide, with the desk
/// lamp's pool in the upper left. Solid work layer: nothing is drawn behind what you read.
///
/// One authored entrance, riding the page's own transition: the title, the lead and then the
/// first blocks arrive 45 ms apart. Nothing moves once the page is up, and scrolling never
/// replays it.
class ToolsPage extends StatelessWidget {
  const ToolsPage({super.key, required this.title, required this.slivers, this.lead, this.large = true, this.controller});

  final String title;
  final String? lead;
  final List<Widget> slivers;

  /// The 28 sp headline, or the 22 sp title for a long programme name.
  final bool large;
  final ScrollController? controller;

  /// How many blocks after the lead arrive in the entrance (the stagger caps at eight in all).
  static const int _entranceBlocks = 5;

  /// The first [_entranceBlocks] box slivers, each as the next item of the entrance.
  static List<Widget> _entering(List<Widget> slivers) {
    var next = 2;
    return [
      for (final sliver in slivers)
        if (next < 2 + _entranceBlocks && sliver is SliverToBoxAdapter && sliver.child != null)
          SliverToBoxAdapter(child: MmStaggerItem(index: next++, child: sliver.child!))
        else
          sliver,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 300,
            child: IgnorePointer(
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
            ),
          ),
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: MmStagger(
                  driver: MmStaggerDriver.route,
                  child: CustomScrollView(
                  controller: controller,
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  slivers: [
                    // A short title is the page header. A long one (a programme's full name) would
                    // be cut to one line there, so the header says the tool and the name follows
                    // on the gutter in the title cut, wrapping to as many lines as it needs.
                    SliverToBoxAdapter(
                      child: MmStaggerItem(index: 0, child: YouHeader(title: large ? title : ToolsCopy.compassTitle)),
                    ),
                    if (!large)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
                          child: Semantics(header: true, child: Text(title, style: type.title)),
                        ),
                      ),
                    if (lead != null)
                      SliverToBoxAdapter(
                        child: MmStaggerItem(
                          index: 1,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, 0),
                            child: Text(lead!, style: type.body.copyWith(color: colors.ink2)),
                          ),
                        ),
                      ),
                    SliverToBoxAdapter(child: SizedBox(height: lead != null ? MmRhythm.group : MmSpace.s16)),
                    ..._entering(slivers),
                    SliverToBoxAdapter(child: SizedBox(height: MmSpace.s48 + MediaQuery.viewPaddingOf(context).bottom)),
                  ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

enum ToolTone { good, mid, low, quiet }

/// A small written status ("Clears Round II", "Below every Round I cutoff"): a glyph and words
/// on a quiet well, the tone a second signal only.
class ToolTag extends StatelessWidget {
  const ToolTag(this.text, {super.key, this.tone = ToolTone.quiet});

  final String text;
  final ToolTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final (color, icon) = switch (tone) {
      ToolTone.good => (colors.goodText, LucideIcons.check),
      // Inside the range: a fact, not a warning. Neutral ink and a between-marker, never amber.
      ToolTone.mid => (colors.ink, LucideIcons.chevronsUpDown),
      ToolTone.low => (colors.ink2, LucideIcons.arrowDown),
      ToolTone.quiet => (colors.ink2, null),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.isNight ? colors.raised2 : colors.sunken,
        borderRadius: MmRadius.pillAll,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: MmSpace.s4)],
            Flexible(child: Text(text, style: context.mmType.caption.copyWith(color: color, fontWeight: FontWeight.w600))),
          ],
        ),
      ),
    );
  }
}

/// A quiet paragraph in the page gutter (fine print, provenance).
class ToolsNote extends StatelessWidget {
  const ToolsNote(this.text, {super.key, this.top = MmSpace.s16, this.icon});

  final String text;
  final double top;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(color: colors.ink3);
    return Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, MmSpace.gutter, 0),
      child: icon == null
          ? Text(text, style: style)
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 14, color: colors.ink3)),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(text, style: style)),
              ],
            ),
    );
  }
}

/// A search field in the warm well, with a clear key once something is typed.
class ToolsSearchField extends StatelessWidget {
  const ToolsSearchField({super.key, required this.controller, required this.hint, required this.onChanged, this.focusNode, this.autofocus = false});

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final FocusNode? focusNode;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        focusNode: focusNode,
        autofocus: autofocus,
        onChanged: onChanged,
        // A field low in a sheet scrolls itself into view above the keyboard.
        scrollPadding: const EdgeInsets.all(96),
        textInputAction: TextInputAction.search,
        style: context.mmType.body,
        decoration: InputDecoration(
          hintText: hint,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: 14),
          prefixIcon: Icon(LucideIcons.search, size: 18, color: colors.ink3),
          suffixIcon: value.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Clear search',
                  icon: Icon(LucideIcons.x, size: 16, color: colors.ink2),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                ),
        ),
      ),
    );
  }
}

/// A group of rows in one plain surface, in the page gutter: the rows are divided by hairlines
/// that start at [dividerIndent] and each presses edge to edge. Use it instead of a stack of
/// identical boxes.
class ToolsPanel extends StatelessWidget {
  const ToolsPanel({
    super.key,
    required this.children,
    this.dividerIndent = MmSpace.s20,
    this.margin = const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
  });

  final List<Widget> children;

  /// 64 lines up with the text beside a 36 dp icon well; 20 is a row without a leading mark.
  final double dividerIndent;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) => Padding(
        padding: margin,
        child: MmRowGroup(dividerIndent: dividerIndent, children: children),
      );
}

/// A navigation row of a [ToolsPanel]: an icon well, a title, an optional note, an optional
/// live value and a quiet chevron (or the external glyph for a page that opens outside the app).
class ToolsLinkRow extends StatelessWidget {
  const ToolsLinkRow({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.note,
    this.value,
    this.external = false,
    this.flat = false,
  });

  final IconData icon;
  final String title;
  final String? note;

  /// A short live fact on the right ("14 of 70").
  final String? value;
  final bool external;
  final VoidCallback onTap;

  /// A row of a [ToolsFlatList]: on the ground, with a 40 dp icon tile.
  final bool flat;

  /// Where a [ToolsPanel]'s hairlines start for these rows.
  static const double dividerIndent = 64;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (flat) {
      return ToolsRowFrame(
        onTap: onTap,
        semanticsLabel: [title, ?note, ?value].join('. '),
        padding: const EdgeInsets.symmetric(horizontal: ToolsFlatList.edge, vertical: MmSpace.s12),
        child: Row(
          children: [
            ToolsIconTile(icon),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: type.labelLarge.copyWith(fontSize: 16)),
                  if (note != null) ...[
                    const SizedBox(height: MmSpace.s2),
                    Text(note!, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ],
              ),
            ),
            if (value != null) ...[
              const SizedBox(width: MmSpace.s8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 120),
                child: Text(value!, style: type.caption.copyWith(color: colors.ink2), textAlign: TextAlign.end),
              ),
            ],
            const SizedBox(width: MmSpace.s8),
            Icon(external ? LucideIcons.externalLink : LucideIcons.chevronRight, size: 16, color: colors.ink3),
          ],
        ),
      );
    }
    return MmRow(
      title: title,
      subtitle: note,
      leading: ExcludeSemantics(child: IconWell(icon)),
      semanticsLabel: [title, ?note, ?value].join('. '),
      onTap: onTap,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (value != null) ...[
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Text(value!, style: type.caption.copyWith(color: colors.ink2), textAlign: TextAlign.end),
            ),
            const SizedBox(width: MmSpace.s8),
          ],
          Icon(external ? LucideIcons.externalLink : LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
      ),
    );
  }
}

/// One free-form row of a [ToolsPanel] (a programme, a college, a switch): at least 56 dp, the
/// whole row the target, the press veil and a selection tick. [onTap] null makes it information
/// only. [toggled] marks a switch row for TalkBack.
class ToolsRowFrame extends StatelessWidget {
  const ToolsRowFrame({
    super.key,
    required this.child,
    this.onTap,
    this.semanticsLabel,
    this.toggled,
    this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? semanticsLabel;
  final bool? toggled;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    Widget frame() => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(padding: padding, child: Align(alignment: Alignment.centerLeft, child: child)),
        );
    final tap = onTap;
    if (tap == null) {
      if (semanticsLabel == null) return frame();
      return Semantics(container: true, label: semanticsLabel, excludeSemantics: true, child: frame());
    }
    // One node for TalkBack: the row's words, button or switch, and the tap.
    return Semantics(
      container: true,
      button: toggled == null,
      toggled: toggled,
      label: semanticsLabel,
      onTap: () {
        mmFireHaptic(context, MmPressHaptic.selection);
        tap();
      },
      excludeSemantics: semanticsLabel != null,
      child: MmPressable(
        pressedScale: 0.985,
        focusRadius: BorderRadius.zero,
        haptic: MmPressHaptic.selection,
        highlight: true,
        onTap: tap,
        builder: (context, pressed, _) => frame(),
      ),
    );
  }
}
