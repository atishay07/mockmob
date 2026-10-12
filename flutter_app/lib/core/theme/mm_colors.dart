import 'package:flutter/material.dart';

/// Colour roles from spec 2.1. Every wash is pre-flattened to an opaque colour, so nothing
/// here needs alpha-over-alpha or a `saveLayer`. Read with `context.mmColors`.
@immutable
class MmColors extends ThemeExtension<MmColors> {
  const MmColors({
    required this.ground,
    required this.raised,
    required this.raised2,
    required this.sunken,
    required this.line,
    required this.lineStrong,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.ink4,
    required this.volt,
    required this.voltInk,
    required this.voltEdge,
    required this.accentText,
    required this.focusRing,
    required this.badText,
    required this.warnText,
    required this.goodText,
    required this.wrongSurface,
    required this.wrongBorder,
    required this.wrongText,
    required this.scrim,
    required this.optionLip,
    required this.cardShadow,
  });

  final Color ground;
  final Color raised;
  final Color raised2;
  final Color sunken;
  final Color line;
  final Color lineStrong;
  final Color ink;
  final Color ink2;
  final Color ink3;

  /// Decorative only. Never use for text that carries meaning.
  final Color ink4;

  /// Action fill: primary keys and the active-tab pill only (binding rule 12).
  final Color volt;
  final Color voltInk;

  /// The lip under a primary key.
  final Color voltEdge;

  /// Accent for text on paper. Volt itself is never text on light.
  final Color accentText;
  final Color focusRing;
  final Color badText;
  final Color warnText;
  final Color goodText;

  /// The wrong trio. Practice, repair and sample feedback only, never inside a mock.
  final Color wrongSurface;
  final Color wrongBorder;
  final Color wrongText;
  final Color scrim;

  /// The lip under an answer option (3 dp). Spec 2.4: `#0A0D09` on night, `lineStrong` on paper.
  final Color optionLip;

  /// One precomputed shadow for light cards. Empty in dark.
  final List<BoxShadow> cardShadow;

  static const Color _volt = Color(0xFFD2F000);
  static const Color _voltInk = Color(0xFF0B1000);
  static const Color _voltEdge = Color(0xFF9DB400);
  static const Color _scrim = Color(0x66000000);

  static const MmColors light = MmColors(
    ground: Color(0xFFF4F5F0),
    raised: Color(0xFFFFFFFF),
    raised2: Color(0xFFF8F9F4),
    sunken: Color(0xFFEEF0E8),
    line: Color(0xFFDCE1D4),
    lineStrong: Color(0xFFBCC5B0),
    ink: Color(0xFF172016),
    ink2: Color(0xFF3D4A39),
    ink3: Color(0xFF56624F),
    ink4: Color(0xFF646F5D),
    volt: _volt,
    voltInk: _voltInk,
    voltEdge: _voltEdge,
    accentText: Color(0xFF4F6400),
    focusRing: Color(0xFF4F6400),
    badText: Color(0xFFB0291F),
    warnText: Color(0xFF845400),
    goodText: Color(0xFF3D6600),
    wrongSurface: Color(0xFFFBE9E7),
    wrongBorder: Color(0xFFB93225),
    wrongText: Color(0xFFB0291F),
    scrim: _scrim,
    optionLip: Color(0xFFBCC5B0),
    cardShadow: [
      BoxShadow(color: Color(0x0F000000), offset: Offset(0, 1), blurRadius: 2),
      BoxShadow(color: Color(0x2E000000), offset: Offset(0, 12), blurRadius: 32, spreadRadius: -18),
    ],
  );

  static const MmColors dark = MmColors(
    ground: Color(0xFF0B100E),
    raised: Color(0xFF131A16),
    raised2: Color(0xFF18211B),
    sunken: Color(0xFF0F1512),
    line: Color(0xFF253026),
    lineStrong: Color(0xFF384736),
    ink: Color(0xFFF2F4EC),
    ink2: Color(0xFFBCC5B9),
    ink3: Color(0xFF93A08F),
    ink4: Color(0xFF7F8B7B),
    volt: _volt,
    voltInk: _voltInk,
    voltEdge: _voltEdge,
    accentText: Color(0xFFD2F000),
    focusRing: Color(0xFFD2F000),
    badText: Color(0xFFFF9D92),
    warnText: Color(0xFFE0B93F),
    goodText: Color(0xFFB6E36E),
    wrongSurface: Color(0xFF2A1614),
    wrongBorder: Color(0xFF7D3128),
    wrongText: Color(0xFFFFC9C2),
    scrim: _scrim,
    optionLip: Color(0xFF0A0D09),
    cardShadow: [],
  );

  static MmColors forBrightness(Brightness brightness) => brightness == Brightness.dark ? dark : light;

  @override
  MmColors copyWith({
    Color? ground,
    Color? raised,
    Color? raised2,
    Color? sunken,
    Color? line,
    Color? lineStrong,
    Color? ink,
    Color? ink2,
    Color? ink3,
    Color? ink4,
    Color? volt,
    Color? voltInk,
    Color? voltEdge,
    Color? accentText,
    Color? focusRing,
    Color? badText,
    Color? warnText,
    Color? goodText,
    Color? wrongSurface,
    Color? wrongBorder,
    Color? wrongText,
    Color? scrim,
    Color? optionLip,
    List<BoxShadow>? cardShadow,
  }) {
    return MmColors(
      ground: ground ?? this.ground,
      raised: raised ?? this.raised,
      raised2: raised2 ?? this.raised2,
      sunken: sunken ?? this.sunken,
      line: line ?? this.line,
      lineStrong: lineStrong ?? this.lineStrong,
      ink: ink ?? this.ink,
      ink2: ink2 ?? this.ink2,
      ink3: ink3 ?? this.ink3,
      ink4: ink4 ?? this.ink4,
      volt: volt ?? this.volt,
      voltInk: voltInk ?? this.voltInk,
      voltEdge: voltEdge ?? this.voltEdge,
      accentText: accentText ?? this.accentText,
      focusRing: focusRing ?? this.focusRing,
      badText: badText ?? this.badText,
      warnText: warnText ?? this.warnText,
      goodText: goodText ?? this.goodText,
      wrongSurface: wrongSurface ?? this.wrongSurface,
      wrongBorder: wrongBorder ?? this.wrongBorder,
      wrongText: wrongText ?? this.wrongText,
      scrim: scrim ?? this.scrim,
      optionLip: optionLip ?? this.optionLip,
      cardShadow: cardShadow ?? this.cardShadow,
    );
  }

  @override
  MmColors lerp(ThemeExtension<MmColors>? other, double t) {
    if (other is! MmColors) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return MmColors(
      ground: c(ground, other.ground),
      raised: c(raised, other.raised),
      raised2: c(raised2, other.raised2),
      sunken: c(sunken, other.sunken),
      line: c(line, other.line),
      lineStrong: c(lineStrong, other.lineStrong),
      ink: c(ink, other.ink),
      ink2: c(ink2, other.ink2),
      ink3: c(ink3, other.ink3),
      ink4: c(ink4, other.ink4),
      volt: c(volt, other.volt),
      voltInk: c(voltInk, other.voltInk),
      voltEdge: c(voltEdge, other.voltEdge),
      accentText: c(accentText, other.accentText),
      focusRing: c(focusRing, other.focusRing),
      badText: c(badText, other.badText),
      warnText: c(warnText, other.warnText),
      goodText: c(goodText, other.goodText),
      wrongSurface: c(wrongSurface, other.wrongSurface),
      wrongBorder: c(wrongBorder, other.wrongBorder),
      wrongText: c(wrongText, other.wrongText),
      scrim: c(scrim, other.scrim),
      optionLip: c(optionLip, other.optionLip),
      cardShadow: t < 0.5 ? cardShadow : other.cardShadow,
    );
  }
}
