import 'package:flutter/material.dart';

/// Colour roles of the Night Sheet (brief section 3). Night is the default identity: a warm
/// late-night desk, not a cold studio. Daylight is warm paper. Read with `context.mmColors`.
///
/// Rules: volt is the only interactive accent; lamp amber is environment light only (glows,
/// light fields, art), never a button or text colour. Every solid role is opaque, so nothing
/// here needs alpha-over-alpha; the glass tints and glows are the deliberate exceptions.
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
    required this.lamp,
    required this.voltGlow,
    required this.glassTint,
    required this.glassTintLite,
    required this.edgeTop,
    required this.edgeBottom,
    required this.litTile,
    required this.glassShadow,
    required this.grain,
  });

  final Color ground;
  final Color raised;
  final Color raised2;

  /// Wells and pressed fills, a step below the ground.
  final Color sunken;

  /// The hairline.
  final Color line;
  final Color lineStrong;
  final Color ink;
  final Color ink2;

  /// 4.5:1 on ground and raised. On raised 2 (Night) it is 4.4:1, so keep meaning off raised 2.
  final Color ink3;

  /// Decorative only. Never use for text that carries meaning.
  final Color ink4;

  /// Action fill and the one light per screen.
  final Color volt;
  final Color voltInk;

  /// A darker volt for strokes on volt (the pressed rim of the primary pill).
  final Color voltEdge;

  /// Volt as text: volt itself on Night, `#526700` on Daylight.
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

  /// The rim under a solid answer option.
  final Color optionLip;

  /// One precomputed shadow for solid cards.
  final List<BoxShadow> cardShadow;

  /// Warm tungsten desk-lamp light (about 2700 K). Environment only: glows and light fields.
  final Color lamp;

  /// Volt at 14%: the soft glow beneath the one lit element, never behind text.
  final Color voltGlow;

  /// Live-glass tint (Full quality, over a blur).
  final Color glassTint;

  /// Glass tint without blur (Lite quality and fake glass): denser so text keeps 4.5:1.
  final Color glassTintLite;

  /// The 1 dp edge light along glass: bright at the top, fading down the sides.
  final Color edgeTop;
  final Color edgeBottom;

  /// The dock's lit tile pane: warm paper white at 12% on Night, ink at 7% on Daylight.
  final Color litTile;

  /// The soft drop under floating glass (rounded rects only, so Impeller draws it analytically).
  final List<BoxShadow> glassShadow;

  /// Opacity of the static noise tile on moment surfaces.
  final double grain;

  static const Color _volt = Color(0xFFD2F000);
  static const Color _voltInk = Color(0xFF0B1000);
  static const Color _voltEdge = Color(0xFF9DB400);
  static const Color _lamp = Color(0xFFF2A93B);

  /// Night: warm charcoal, paper-white ink, a lamp in the corner.
  static const MmColors dark = MmColors(
    ground: Color(0xFF12110E),
    raised: Color(0xFF1B1A16),
    raised2: Color(0xFF25231E),
    sunken: Color(0xFF0D0C0A),
    line: Color(0xFF312E27),
    lineStrong: Color(0xFF4A453B),
    ink: Color(0xFFF4F0E6),
    ink2: Color(0xFFBDB6A6),
    ink3: Color(0xFFA09989),
    ink4: Color(0xFF6A645A),
    volt: _volt,
    voltInk: _voltInk,
    voltEdge: _voltEdge,
    accentText: _volt,
    focusRing: _volt,
    badText: Color(0xFFFFA396),
    warnText: Color(0xFFEDB75A),
    goodText: Color(0xFFC6E86E),
    wrongSurface: Color(0xFF2A1614),
    wrongBorder: Color(0xFF7D3128),
    wrongText: Color(0xFFFFC9C2),
    scrim: Color(0x99080705),
    optionLip: Color(0xFF0A0907),
    cardShadow: [
      BoxShadow(color: Color(0x40000000), offset: Offset(0, 1), blurRadius: 1),
      BoxShadow(color: Color(0x59000000), offset: Offset(0, 18), blurRadius: 36, spreadRadius: -20),
    ],
    lamp: _lamp,
    voltGlow: Color(0x24D2F000),
    glassTint: Color(0x9E1C1A16),
    glassTintLite: Color(0xE01C1A16),
    edgeTop: Color(0x24FFF6E4),
    edgeBottom: Color(0x08FFF6E4),
    litTile: Color(0x1FFFF6E4),
    glassShadow: [
      BoxShadow(color: Color(0x80000000), offset: Offset(0, 20), blurRadius: 40, spreadRadius: -22),
      BoxShadow(color: Color(0x33000000), offset: Offset(0, 2), blurRadius: 6, spreadRadius: -2),
    ],
    grain: 0.05,
  );

  /// Daylight: warm paper, dark ink, volt as a fill and `#526700` as text.
  static const MmColors light = MmColors(
    ground: Color(0xFFF3EFE6),
    raised: Color(0xFFFFFDF8),
    raised2: Color(0xFFE9E4D8),
    sunken: Color(0xFFEAE5DA),
    line: Color(0xFFD8D1C2),
    lineStrong: Color(0xFFBDB4A2),
    ink: Color(0xFF17150F),
    ink2: Color(0xFF454036),
    ink3: Color(0xFF655F53),
    ink4: Color(0xFF8A8375),
    volt: _volt,
    voltInk: _voltInk,
    voltEdge: _voltEdge,
    accentText: Color(0xFF526700),
    focusRing: Color(0xFF526700),
    badText: Color(0xFFB0291F),
    warnText: Color(0xFF845400),
    goodText: Color(0xFF3D6600),
    wrongSurface: Color(0xFFFBE9E7),
    wrongBorder: Color(0xFFB93225),
    wrongText: Color(0xFFB0291F),
    scrim: Color(0x6617150F),
    optionLip: Color(0xFFD8D1C2),
    cardShadow: [
      BoxShadow(color: Color(0x0F2A2010), offset: Offset(0, 1), blurRadius: 2),
      BoxShadow(color: Color(0x262A2010), offset: Offset(0, 14), blurRadius: 30, spreadRadius: -18),
    ],
    lamp: _lamp,
    voltGlow: Color(0x38D2F000),
    glassTint: Color(0xB8FFFDF8),
    glassTintLite: Color(0xEBFFFDF8),
    edgeTop: Color(0xCCFFFFFF),
    edgeBottom: Color(0x1F2A2010),
    litTile: Color(0x1217150F),
    glassShadow: [
      BoxShadow(color: Color(0x2E2A2010), offset: Offset(0, 18), blurRadius: 36, spreadRadius: -20),
      BoxShadow(color: Color(0x142A2010), offset: Offset(0, 1), blurRadius: 3),
    ],
    grain: 0.035,
  );

  static MmColors forBrightness(Brightness brightness) => brightness == Brightness.dark ? dark : light;

  /// True for Night.
  bool get isNight => ground.computeLuminance() < 0.2;

  /// The one colour of a wrong mark (a wrong bubble, the wrong part of a marks bar), the same on
  /// every screen of a theme.
  Color get wrongMark => isNight ? Color.lerp(wrongBorder, wrongText, 0.5)! : wrongBorder;

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
    Color? lamp,
    Color? voltGlow,
    Color? glassTint,
    Color? glassTintLite,
    Color? edgeTop,
    Color? edgeBottom,
    Color? litTile,
    List<BoxShadow>? glassShadow,
    double? grain,
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
      lamp: lamp ?? this.lamp,
      voltGlow: voltGlow ?? this.voltGlow,
      glassTint: glassTint ?? this.glassTint,
      glassTintLite: glassTintLite ?? this.glassTintLite,
      edgeTop: edgeTop ?? this.edgeTop,
      edgeBottom: edgeBottom ?? this.edgeBottom,
      litTile: litTile ?? this.litTile,
      glassShadow: glassShadow ?? this.glassShadow,
      grain: grain ?? this.grain,
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
      lamp: c(lamp, other.lamp),
      voltGlow: c(voltGlow, other.voltGlow),
      glassTint: c(glassTint, other.glassTint),
      glassTintLite: c(glassTintLite, other.glassTintLite),
      edgeTop: c(edgeTop, other.edgeTop),
      edgeBottom: c(edgeBottom, other.edgeBottom),
      litTile: c(litTile, other.litTile),
      glassShadow: t < 0.5 ? glassShadow : other.glassShadow,
      grain: grain + (other.grain - grain) * t,
    );
  }
}
