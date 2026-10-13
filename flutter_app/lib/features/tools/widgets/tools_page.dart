import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart';

export '../../you/widgets/you_page.dart' show BackKey, GlassDisc, GroupHeading, youGutter;
export '../../you/widgets/you_row.dart' show IconWell, RowFrame, YouPanel, YouRow;

/// The frame of a tools screen, matching You (the tools live behind it): the lit back key, a
/// Bricolage title, an optional lead line, then [slivers], at most 600 dp wide, with the desk
/// lamp's pool in the upper left. Solid work layer: nothing is drawn behind what you read.
class ToolsPage extends StatelessWidget {
  const ToolsPage({super.key, required this.title, required this.slivers, this.lead, this.large = true, this.controller});

  final String title;
  final String? lead;
  final List<Widget> slivers;

  /// The 28 sp headline, or the 22 sp title for a long programme name.
  final bool large;
  final ScrollController? controller;

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
                child: CustomScrollView(
                  controller: controller,
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  slivers: [
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.gutter, 0),
                        child: Row(children: [BackKey()]),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s12, MmSpace.gutter, 0),
                        child: Semantics(header: true, child: Text(title, style: large ? type.headline : type.title)),
                      ),
                    ),
                    if (lead != null)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s8, MmSpace.gutter + 4, 0),
                          child: Text(lead!, style: type.body.copyWith(color: colors.ink2)),
                        ),
                      ),
                    const SliverToBoxAdapter(child: SizedBox(height: MmSpace.s20)),
                    ...slivers,
                    SliverToBoxAdapter(child: SizedBox(height: MmSpace.s48 + MediaQuery.viewPaddingOf(context).bottom)),
                  ],
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
      ToolTone.mid => (colors.warnText, LucideIcons.minus),
      ToolTone.low => (colors.ink2, LucideIcons.arrowDown),
      ToolTone.quiet => (colors.ink2, null),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.isNight ? colors.raised2 : colors.sunken,
        borderRadius: MmRadius.pillAll,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 5)],
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
      padding: EdgeInsets.fromLTRB(MmSpace.gutter + 4, top, MmSpace.gutter + 4, 0),
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
  const ToolsSearchField({super.key, required this.controller, required this.hint, required this.onChanged});

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        onChanged: onChanged,
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
