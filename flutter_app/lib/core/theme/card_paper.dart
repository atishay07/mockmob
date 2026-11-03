import 'package:flutter/material.dart';

import 'mm_colors.dart';

/// One kind family's colours on the Key card's paper: the kind word, the header band's wash and the 1 dp line under the band.
@immutable
class MmBandInk {
  const MmBandInk({required this.text, required this.band, required this.line});

  /// The kind word. AA on [band] in both themes (Night 6.94 to 7.32:1, Day 4.98 to 6.30:1).
  final Color text;

  /// The band: [text] at 12% over Night's paper, 13% over Day's (the web's `--kc-band`).
  final Color band;

  /// The line under the band: [text] at 26% over the paper (the web's `--kc-band-line`).
  final Color line;
}

/// The Key card as an index card from a deck (the web's keycards.css R8 `--kc-paper` tokens, commit 20762eb34, 3 Nov 2026):
/// Day a warm cream stock, Night a neutral charcoal (not green-tinted, no light rim), one quiet hairline and a soft shadow.
/// The four kind families wash the card's header band (lime stays the primary key's alone); the back's words sit on faint
/// ruled lines. Read with `context.mmColors.paper`.
@immutable
class MmPaper {
  const MmPaper({
    required this.paper,
    required this.line,
    required this.shadow,
    required this.ruling,
    required this.edgeNear,
    required this.edgeFar,
    required this.plain,
    required this.meaning,
    required this.rule,
    required this.parts,
    required this.fact,
  });

  /// The card stock.
  final Color paper;

  /// The card's one quiet hairline (its border, the foot's line).
  final Color line;

  /// The soft shadow under the card.
  final List<BoxShadow> shadow;

  /// The faint ruled lines on the back.
  final Color ruling;

  /// The deck under a run's card: the nearer edge a shade deeper than the paper, the farther one a shade deeper again.
  final Color edgeNear;
  final Color edgeFar;

  /// A card with no kind family (a lesson): ink at 6% over the paper, its word in ink-2, the hairline under it.
  final MmBandInk plain;

  /// Definition, Term, Word, One word, Idiom, Usage: a calm green.
  final MmBandInk meaning;

  /// Formula, Rule, Entry: lilac, plum in Day.
  final MmBandInk rule;

  /// List, Steps, Types, Difference: amber, brown in Day.
  final MmBandInk parts;

  /// Fact, Key line, Quote, Example: a cool blue.
  final MmBandInk fact;

  /// Night: charcoal #1e1f1c, a white hairline at 7.5%, rules at 4.5%.
  static const MmPaper night = MmPaper(
    paper: Color(0xFF1E1F1C),
    line: Color(0x13FFFFFF),
    shadow: [
      BoxShadow(color: Color(0x66000000), offset: Offset(0, 1), blurRadius: 2),
      BoxShadow(color: Color(0xBF000000), offset: Offset(0, 16), blurRadius: 36, spreadRadius: -22),
    ],
    ruling: Color(0x0BFFFFFF),
    edgeNear: Color(0xFF1B1C19),
    edgeFar: Color(0xFF191917),
    plain: MmBandInk(text: Color(0xFFBDB6A6), band: Color(0xFF2B2C28), line: Color(0x13FFFFFF)),
    meaning: MmBandInk(text: Color(0xFF8FD3B0), band: Color(0xFF2C352E), line: Color(0xFF3B4E42)),
    rule: MmBandInk(text: Color(0xFFC4B5FD), band: Color(0xFF323137), line: Color(0xFF494656)),
    parts: MmBandInk(text: Color(0xFFE0B93F), band: Color(0xFF353120), line: Color(0xFF504725)),
    fact: MmBandInk(text: Color(0xFF9CC0FF), band: Color(0xFF2D3237), line: Color(0xFF3F4957)),
  );

  /// Day: cream #faf6ec, a warm hairline, rules in a warm brown at 8.5%.
  static const MmPaper day = MmPaper(
    paper: Color(0xFFFAF6EC),
    line: Color(0xFFE2DBC9),
    shadow: [
      BoxShadow(color: Color(0x143C3014), offset: Offset(0, 1), blurRadius: 2),
      BoxShadow(color: Color(0x3D3C3014), offset: Offset(0, 14), blurRadius: 30, spreadRadius: -18),
    ],
    ruling: Color(0x166E5A32),
    edgeNear: Color(0xFFF3EEE3),
    edgeFar: Color(0xFFECE6D9),
    plain: MmBandInk(text: Color(0xFF454036), band: Color(0xFFECE8DF), line: Color(0xFFE2DBC9)),
    meaning: MmBandInk(text: Color(0xFF2A6246), band: Color(0xFFDFE3D6), line: Color(0xFFC4D0C1)),
    rule: MmBandInk(text: Color(0xFF5B3A9A), band: Color(0xFFE5DEE1), line: Color(0xFFD1C5D7)),
    parts: MmBandInk(text: Color(0xFF845400), band: Color(0xFFEBE1CD), line: Color(0xFFDBCCAF)),
    fact: MmBandInk(text: Color(0xFF2C5AA8), band: Color(0xFFDFE2E3), line: Color(0xFFC4CDDA)),
  );

  /// Every family's colours, the plain band first.
  List<MmBandInk> get inks => [plain, meaning, rule, parts, fact];
}

/// The Key card's paper for the theme these colours belong to.
extension MmPaperOf on MmColors {
  MmPaper get paper => isNight ? MmPaper.night : MmPaper.day;
}
