import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// One way to practise, said as what you get. No cost here: costs live on the confirm sheet.
class ModeChoice {
  const ModeChoice({required this.icon, required this.title, required this.line, required this.onTap, this.tag, this.chips = const []});

  /// The answer-sheet drawing for this mode.
  final SheetGlyph icon;
  final String title;
  final String line;
  final VoidCallback onTap;

  /// A quiet tag after the title ("Pro").
  final String? tag;

  /// What the mode has, as quiet chips under the line (NTA mode: "50 questions", "Question palette").
  final List<String> chips;
}

/// The modes as rows on one solid panel, divided by hairlines (the work layer: calm, no art).
class ModeList extends StatelessWidget {
  const ModeList({super.key, required this.choices});

  final List<ModeChoice> choices;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
        shadows: colors.cardShadow,
      ),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(borderRadius: MmRadius.panelAll, top: colors.edgeTop, bottom: colors.edgeBottom.withValues(alpha: 0), sheen: false),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
          child: Column(
            children: [
              for (var i = 0; i < choices.length; i++) ...[
                if (i > 0) Divider(height: 1, thickness: 1, indent: 72, endIndent: MmSpace.s16, color: colors.line),
                _ModeRow(choice: choices[i]),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({required this.choice});

  final ModeChoice choice;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = choice;
    return MmPressable(
      semanticsLabel: '${c.title}${c.tag == null ? '' : ', ${c.tag}'}. ${c.line}',
      focusRadius: MmRadius.keyAll,
      pressedScale: 0.985,
      onTap: c.onTap,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        color: pressed ? colors.ink.withValues(alpha: 0.04) : Colors.transparent,
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s12),
        child: Row(
          children: [
            SheetGlyphTile(c.icon),
            const SizedBox(width: MmSpace.s16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Flexible(child: Text(c.title, style: type.cardTitle.copyWith(fontSize: 16))),
                      if (c.tag != null) ...[const SizedBox(width: MmSpace.s8), _Tag(c.tag!)],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(c.line, style: type.caption.copyWith(color: colors.ink2)),
                  if (c.chips.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s8),
                    Wrap(spacing: MmSpace.s6, runSpacing: MmSpace.s6, children: [for (final t in c.chips) _Tag(t, quiet: true)]),
                  ],
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text, {this.quiet = false});

  final String text;

  /// A fact chip (sunken, no outline) rather than the outlined "Pro" tag.
  final bool quiet;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: quiet ? colors.sunken : null,
        shape: StadiumBorder(side: quiet ? BorderSide.none : BorderSide(color: colors.lineStrong)),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: quiet ? 3 : 1),
        child: Text(text, style: context.mmType.caption.copyWith(fontSize: quiet ? 12 : 11, color: colors.ink2)),
      ),
    );
  }
}

/// The glyphs of the modes.
abstract final class ModeIcons {
  static const SheetGlyph quick = SheetGlyph.quick;
  static const SheetGlyph chapter = SheetGlyph.chapter;
  static const SheetGlyph smart = SheetGlyph.repair;
  static const SheetGlyph full = SheetGlyph.mock;
  static const SheetGlyph nta = SheetGlyph.exam;
}

/// Section heading on the tab ("Choose your own", "Concepts") with an optional trailing link.
class SectionHeading extends StatelessWidget {
  const SectionHeading({super.key, required this.title, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Row(
      children: [
        Expanded(child: Semantics(header: true, child: Text(title, style: type.title))),
        if (action != null && onAction != null) KeyButton.quiet(label: action!, onPressed: onAction),
      ],
    );
  }
}

