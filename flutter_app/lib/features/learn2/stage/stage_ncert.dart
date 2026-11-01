/// NCERT's own words on the stage (the web's `NcertText` inside `.st-back` and `.st-line`): the Key cards' layout of a
/// back (`backShape`: a list, a formula, a journal entry or paragraphs, the blanked words marked) at the stage's
/// reading sizes, behind a 1 dp rule like a quoted passage, and the book's reference under it. The words are the
/// card's own; only the size and the rule are the stage's.
///
/// The three small layouts below follow the Key cards' `KcBlankText`, `KcParagraphs` and `KcEntryText` rule for rule
/// (the shapes themselves come from the shared `backShape`). They live here so the stage depends only on the Key
/// cards' data, not on their screens' widget file, which reaches the whole app through its upgrade sheet.
library;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../keycards/data/keycards_lines.dart';
import '../../keycards/data/keycards_models.dart';
import '../../keycards/data/keycards_rules.dart' show BlankedLine;

/// The reading size of a card's back by `StageText.backSize` (the web's `.st-back[data-size]`): 17.5/1.62, and
/// 16.5/1.58 for 'l', 16/1.55 for 'xl'.
({double size, double height}) stageBackSize(String step) => switch (step) {
  'l' => (size: 16.5, height: 1.58),
  'xl' => (size: 16, height: 1.55),
  _ => (size: 17.5, height: 1.62),
};

/// A card's back as the book prints it, at [size] / [height], with the rule at its left and, when [showSource],
/// the reference (13/1.45 ink-3) set in 17 dp under it.
class StageNcert extends StatelessWidget {
  const StageNcert({super.key, required this.card, required this.size, required this.height, this.showSource = true, this.ruleGap = 16});

  final KeyCard card;
  final double size;
  final double height;
  final bool showSource;

  /// The space between the rule and the words.
  final double ruleGap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reading = type.body.copyWith(fontSize: size, height: height, fontWeight: FontWeight.w400, color: colors.ink);
    final source = card.source.reference;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(border: Border(left: BorderSide(color: colors.lineStrong))),
          child: Padding(padding: EdgeInsets.only(left: ruleGap), child: _words(reading)),
        ),
        if (showSource && source != null) ...[
          const SizedBox(height: MmSpace.s12),
          Padding(
            padding: EdgeInsets.only(left: ruleGap + 1),
            child: Text(
              source,
              style: type.caption.copyWith(fontSize: 13, height: 1.45, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ),
        ],
      ],
    );
  }

  Widget _words(TextStyle reading) => switch (backShape(card)) {
    KcListBack(:final paragraphs) => _Paragraphs(paragraphs: paragraphs, style: reading),
    final KcFormulaBack f => _Paragraphs(paragraphs: [for (final t in f.texts) (text: t, bullet: false)], style: reading, tight: true),
    KcEntryBack(:final rows) => _Entry(rows: joinedNarrations(rows), style: reading),
    KcParasBack(:final paras) => paras.length == 1
        ? _para(paras.first, reading)
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, p) in paras.indexed) ...[
                if (i > 0) const SizedBox(height: MmSpace.s6),
                _para(p, reading),
              ],
            ],
          ),
  };

  static Widget _para(List<KcPart> parts, TextStyle style) {
    if (parts.any((p) => p.mark)) {
      return StageMarkedText(line: BlankedLine([for (final p in parts) (text: p.text, blank: p.mark)]), style: style);
    }
    return Text(parts.map((p) => p.text).join(), style: style);
  }
}

/// A line with its blanks (the Key cards' `KcBlankText` rule): in a question a gap is an underlined space read as
/// "blank"; in an answer the words that carry marks are set a weight up with a quiet accent underline.
class StageMarkedText extends StatelessWidget {
  const StageMarkedText({super.key, required this.line, required this.style, this.maxLines, this.semanticsLabel});

  final BlankedLine line;
  final TextStyle style;
  final int? maxLines;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final mark = colors.accentText;
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          for (final p in line.parts)
            if (!p.blank)
              TextSpan(text: p.text)
            else if (p.text.isEmpty)
              TextSpan(
                text: ' ' * 12,
                semanticsLabel: 'blank',
                style: TextStyle(decoration: TextDecoration.underline, decorationColor: colors.ink3, decorationThickness: 2),
              )
            else
              TextSpan(
                text: p.text,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  decoration: TextDecoration.underline,
                  decorationColor: mark.withValues(alpha: mark.a * 0.7),
                  decorationThickness: 2,
                ),
              ),
        ],
      ),
      maxLines: maxLines,
      overflow: maxLines == null ? null : TextOverflow.ellipsis,
      semanticsLabel: semanticsLabel,
    );
  }
}

/// A back the book breaks into lines (the Key cards' `KcParagraphs` rule): a paragraph a line, a list item with a
/// small bullet hung in the margin; a formula's second line stays close to its first.
class _Paragraphs extends StatelessWidget {
  const _Paragraphs({required this.paragraphs, required this.style, this.tight = false});

  final List<KcParagraph> paragraphs;
  final TextStyle style;
  final bool tight;

  @override
  Widget build(BuildContext context) {
    final lineHeight = MediaQuery.textScalerOf(context).scale(style.fontSize ?? 16) * (style.height ?? 1.4);
    const dot = 5.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, p) in paragraphs.indexed) ...[
          if (i > 0) SizedBox(height: tight ? MmSpace.s2 : MmSpace.s6),
          if (p.bullet)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Padding(
                    padding: EdgeInsets.only(top: (lineHeight - dot) / 2, right: MmSpace.s12 - 1),
                    child: DecoratedBox(
                      decoration: ShapeDecoration(shape: const CircleBorder(), color: context.mmColors.ink3),
                      child: const SizedBox.square(dimension: dot),
                    ),
                  ),
                ),
                Expanded(child: Text(p.text, style: style)),
              ],
            )
          else
            Text(p.text, style: style),
        ],
      ],
    );
  }
}

/// A journal entry as the book sets it out (the Key cards' `KcEntryText` rule): each debit with "Dr." at the right,
/// "To" each credit set in under the debits, the narration in a quieter size below.
class _Entry extends StatelessWidget {
  const _Entry({required this.rows, required this.style});

  final List<KcEntryRow> rows;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final narration = style.copyWith(fontSize: (style.fontSize ?? 16) - 2, height: 1.45, color: colors.ink2);
    final children = <Widget>[];
    for (final (i, row) in rows.indexed) {
      final previous = i == 0 ? null : rows[i - 1].kind;
      final gap = switch (row.kind) {
        _ when i == 0 => 0.0,
        KcEntryRowKind.narration => MmSpace.s4,
        KcEntryRowKind.debit when previous != KcEntryRowKind.debit => MmSpace.s12,
        _ => MmSpace.s2,
      };
      if (gap > 0) children.add(SizedBox(height: gap));
      children.add(switch (row.kind) {
        KcEntryRowKind.debit => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(row.text, style: style)),
            const SizedBox(width: MmSpace.s12),
            Text('Dr.', style: style),
            if (row.amount != null) ...[const SizedBox(width: MmSpace.s12), Text(row.amount!, style: style)],
          ],
        ),
        KcEntryRowKind.credit => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Padding(padding: const EdgeInsets.only(left: MmSpace.s24), child: Text(row.text, style: style))),
            if (row.amount != null) ...[const SizedBox(width: MmSpace.s12), Text(row.amount!, style: style)],
          ],
        ),
        KcEntryRowKind.narration => Text(row.text, style: narration),
        KcEntryRowKind.plain => Text(row.text, style: style),
      });
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}
