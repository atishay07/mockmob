/// Science notation drawn (the web's `Sci.jsx`; R4-SPEC R4-run): a chemistry card's words with real subscripts and
/// superscripts from [SciText.parse]. Display only: the stored words are unchanged, and a screen reader reads the same
/// characters as the plain text.
///
///   [StageSci.spans]   one run of words as spans: plain [TextSpan]s and a [StageSciSpan] where the rules say
///   [StageSci.text]    the same as a `Text.rich`, named by the plain words
///
/// A subscript or superscript is 0.68 of the line's size, shifted off the baseline (0.32 em down, 0.5 em up of its own size, as
/// the web's `top`), and never opens the line's leading: it is a baseline-aligned inline box that is smaller than the line,
/// moved after layout. Flutter has no baseline shift in a text style, so the small run is an inline widget.
library;

import 'package:flutter/material.dart';

import 'sci_text.dart';

/// A subscript or superscript run inside a line of text.
class StageSciSpan extends WidgetSpan {
  StageSciSpan({required this.run, required this.base, required this.raised})
    : super(
        alignment: PlaceholderAlignment.baseline,
        baseline: TextBaseline.alphabetic,
        child: _SciRun(run: run, base: base, raised: raised),
      );

  /// The digits or signs.
  final String run;

  /// The line's own style (the run takes its family, weight and colour).
  final TextStyle base;

  /// True for a superscript.
  final bool raised;

  /// The size of a sub or sup against its line.
  static const double scale = 0.68;

  /// How far the run moves off the baseline, in its own em: down for a subscript, up for a superscript.
  static const double subShift = 0.32;
  static const double supShift = -0.5;

  /// The style the small run is drawn in: 0.68 of the line, tight, no letter spacing of its own.
  static TextStyle styleOf(TextStyle base) =>
      base.copyWith(fontSize: (base.fontSize ?? 16) * scale, height: 1, letterSpacing: 0, wordSpacing: 0, decoration: TextDecoration.none);

  /// The inline box's size for a painter that lays out this span without building the widget (the balanced wrap).
  PlaceholderDimensions measure({required TextScaler scaler, required TextDirection direction}) {
    final painter = TextPainter(text: TextSpan(text: run, style: styleOf(base)), textDirection: direction, textScaler: scaler)..layout();
    try {
      return PlaceholderDimensions(
        size: painter.size,
        alignment: PlaceholderAlignment.baseline,
        baseline: TextBaseline.alphabetic,
        baselineOffset: painter.computeDistanceToActualBaseline(TextBaseline.alphabetic),
      );
    } finally {
      painter.dispose();
    }
  }
}

class _SciRun extends StatelessWidget {
  const _SciRun({required this.run, required this.base, required this.raised});

  final String run;
  final TextStyle base;
  final bool raised;

  @override
  Widget build(BuildContext context) {
    final style = StageSciSpan.styleOf(base);
    final em = style.fontSize ?? 11;
    final k = MediaQuery.textScalerOf(context).scale(1);
    final shift = (raised ? StageSciSpan.supShift : StageSciSpan.subShift) * em * k;
    return ExcludeSemantics(
      child: Transform.translate(
        offset: Offset(0, shift),
        child: Text(run, style: style, maxLines: 1, softWrap: false),
      ),
    );
  }
}

abstract final class StageSci {
  /// [text] as spans in [style]: plain runs as [TextSpan]s, subscripts and superscripts as [StageSciSpan]s.
  static List<InlineSpan> spans(String text, TextStyle style) {
    final segments = SciText.parse(text);
    return [
      for (final s in segments)
        switch (s.kind) {
          SciKind.plain => TextSpan(text: s.text),
          SciKind.sub => StageSciSpan(run: s.text, base: style, raised: false),
          SciKind.sup => StageSciSpan(run: s.text, base: style, raised: true),
        },
    ];
  }

  /// Whether [text] has any notation to draw.
  static bool has(String text) => SciText.hasSci(SciText.parse(text));

  /// [text] as a `Text` in [style]: with notation (and [sci] on) a `Text.rich` named by the plain words, else the plain string.
  static Widget text(String text, TextStyle style, {bool sci = true, int? maxLines, TextOverflow? overflow, TextAlign? textAlign}) {
    if (!sci || !has(text)) return Text(text, style: style, maxLines: maxLines, overflow: overflow, textAlign: textAlign);
    return Text.rich(
      TextSpan(style: style, children: spans(text, style)),
      semanticsLabel: text,
      maxLines: maxLines,
      overflow: overflow,
      textAlign: textAlign,
    );
  }
}
