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
import 'stage_paper.dart';
import 'stage_sci.dart';

/// The reading size of a card's back by `StageText.backSize` (the web's `.st-back[data-size]`): 17.5/1.62, and
/// 16.5/1.58 for 'l', 16/1.55 for 'xl'.
({double size, double height}) stageBackSize(String step) => switch (step) {
  'l' => (size: 16.5, height: 1.58),
  'xl' => (size: 16, height: 1.55),
  _ => (size: 17.5, height: 1.62),
};

/// A card's back as the book prints it, at [size] / [height], with the rule at its left and, when [showSource],
/// the reference (13/1.45 ink-3) set in 17 dp under it. On a ruled back ([pitch], R8) every line is [pitch] dp tall with no
/// space between paragraphs, list lines or the reference, so each sits on the card's lines.
class StageNcert extends StatelessWidget {
  const StageNcert({super.key, required this.card, required this.size, required this.height, this.showSource = true, this.ruleGap = 16, this.sci = false, this.pitch});

  final KeyCard card;
  final double size;
  final double height;
  final bool showSource;

  /// The space between the rule and the words.
  final double ruleGap;

  /// A chemistry card: the words draw with subscripts and superscripts (the web's `SciNcert`: its lines as a list for the list
  /// kinds, else paragraphs, with the blanks a term card marks).
  final bool sci;

  /// The ruled back's line height (already scaled, `StagePaper.pitchOf`); null sets the words at [height] with their own gaps.
  final double? pitch;

  bool get _ruled => pitch != null;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    var reading = type.body.copyWith(fontSize: size, height: height, fontWeight: FontWeight.w400, color: colors.ink);
    var cite = type.caption.copyWith(fontSize: 13, height: 1.45, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]);
    final p = pitch;
    if (p != null) {
      reading = StagePaper.onPitch(reading, p, scaler);
      cite = StagePaper.onPitch(cite, p, scaler);
    }
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
          if (!_ruled) const SizedBox(height: MmSpace.s12),
          Padding(
            padding: EdgeInsets.only(left: ruleGap + 1),
            child: Text(source, style: cite),
          ),
        ],
      ],
    );
  }

  Widget _words(TextStyle reading) => sci ? _sciWords(reading) : _plainWords(reading);

  /// `SciNcert`: the list kinds as a list, everything else as paragraphs (a line break starts one), the marked words kept.
  Widget _sciWords(TextStyle reading) {
    final lines = listKinds.contains(card.kind) ? backLines(card.back) : const <String>[];
    if (lines.length > 1) {
      final steps = card.kind == 'steps';
      return _Paragraphs(
        paragraphs: [for (final (i, l) in lines.indexed) (text: steps ? '${i + 1}. $l' : l, bullet: !steps)],
        style: reading,
        sci: true,
        spaced: !_ruled,
      );
    }
    final marked = blankKinds.contains(card.kind) ? markBlanks(card.back, card.blanks) : <KcPart>[(text: card.back, mark: false)];
    final paras = <List<KcPart>>[[]];
    for (final p in marked) {
      if (p.mark) {
        paras.last.add(p);
        continue;
      }
      for (final (i, t) in p.text.split(RegExp(r'\n+')).indexed) {
        if (i > 0) paras.add([]);
        if (t.isNotEmpty) paras.last.add((text: t, mark: false));
      }
    }
    final kept = [
      for (final p in paras)
        if (p.isNotEmpty) p,
    ];
    if (kept.length < 2) return _sciPara(kept.isEmpty ? const <KcPart>[] : kept.first, reading);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, p) in kept.indexed) ...[
          if (i > 0 && !_ruled) const SizedBox(height: MmSpace.s6),
          _sciPara(p, reading),
        ],
      ],
    );
  }

  static Widget _sciPara(List<KcPart> parts, TextStyle style) => Builder(
    builder: (context) {
      final colors = context.mmColors;
      final mark = colors.accentText;
      final marked = style.copyWith(
        fontWeight: FontWeight.w600,
        decoration: TextDecoration.underline,
        decorationColor: mark.withValues(alpha: mark.a * 0.7),
        decorationThickness: 2,
      );
      return Text.rich(
        TextSpan(
          style: style,
          children: [
            for (final p in parts)
              if (p.mark) TextSpan(style: marked, children: StageSci.spans(p.text, marked)) else ...StageSci.spans(p.text, style),
          ],
        ),
        semanticsLabel: parts.map((p) => p.text).join(),
      );
    },
  );

  Widget _plainWords(TextStyle reading) => switch (backShape(card)) {
    KcListBack(:final paragraphs) => _Paragraphs(paragraphs: paragraphs, style: reading, spaced: !_ruled),
    final KcFormulaBack f => _Paragraphs(paragraphs: [for (final t in f.texts) (text: t, bullet: false)], style: reading, tight: true, spaced: !_ruled),
    KcEntryBack(:final rows) => _Entry(rows: joinedNarrations(rows), style: reading),
    KcParasBack(:final paras) => paras.length == 1
        ? _para(paras.first, reading)
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, p) in paras.indexed) ...[
                if (i > 0 && !_ruled) const SizedBox(height: MmSpace.s6),
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
/// small bullet hung in the margin; a formula's second line stays close to its first. Not [spaced] (a ruled back): no space
/// between them, each on the next line.
class _Paragraphs extends StatelessWidget {
  const _Paragraphs({required this.paragraphs, required this.style, this.tight = false, this.sci = false, this.spaced = true});

  final List<KcParagraph> paragraphs;
  final TextStyle style;
  final bool tight;
  final bool spaced;

  /// A chemistry card: each line draws its subscripts and superscripts.
  final bool sci;

  @override
  Widget build(BuildContext context) {
    final lineHeight = MediaQuery.textScalerOf(context).scale(style.fontSize ?? 16) * (style.height ?? 1.4);
    const dot = 5.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, p) in paragraphs.indexed) ...[
          if (i > 0 && spaced) SizedBox(height: tight ? MmSpace.s2 : MmSpace.s6),
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
                Expanded(child: StageSci.text(p.text, style, sci: sci)),
              ],
            )
          else
            StageSci.text(p.text, style, sci: sci),
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
