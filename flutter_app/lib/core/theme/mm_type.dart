
import 'package:flutter/material.dart';

import 'fonts.dart';
import 'mm_colors.dart';

/// Type roles from spec 2.2. Read with `context.mmType`.
///
/// Sizes are in sp and scale with the system text scale; only the bottom-nav labels clamp
/// (see `MmBottomNav`). Every role requests tabular figures (binding rule 2). Bold text
/// ("Bold text" system setting) is applied by the `Text` widget itself.
@immutable
class MmType extends ThemeExtension<MmType> {
  const MmType({
    required this.figureHero,
    required this.display,
    required this.headline,
    required this.title,
    required this.subhead,
    required this.figure,
    required this.figureCompact,
    required this.timer,
    required this.button,
    required this.label,
    required this.navLabel,
    required this.lead,
    required this.question,
    required this.body,
    required this.small,
  });

  final TextStyle figureHero;
  final TextStyle display;
  final TextStyle headline;
  final TextStyle title;
  final TextStyle subhead;

  /// Key figures, 48 sp (the spec allows 40 to 56).
  final TextStyle figure;

  /// The 40 sp end of the figure range.
  final TextStyle figureCompact;
  final TextStyle timer;
  final TextStyle button;
  final TextStyle label;

  /// Bottom-nav labels: 12 sp Gabarito 600.
  final TextStyle navLabel;
  final TextStyle lead;
  final TextStyle question;
  final TextStyle body;
  final TextStyle small;

  static const List<FontFeature> _tabular = [FontFeature.tabularFigures()];

  static TextStyle _gabarito(double size, double height, FontWeight weight, double trackingPercent, Color color) {
    return TextStyle(
      fontFamily: MmFonts.gabarito,
      fontSize: size,
      height: height,
      fontWeight: weight,
      letterSpacing: size * trackingPercent / 100,
      color: color,
      fontFeatures: _tabular,
    );
  }

  static TextStyle _hanken(double size, double height, FontWeight weight, Color color) {
    return TextStyle(
      fontFamily: MmFonts.hanken,
      fontSize: size,
      height: height,
      fontWeight: weight,
      color: color,
      fontFeatures: _tabular,
    );
  }

  /// All roles in the `ink` colour of [colors]. Use `copyWith(color: ...)` for quieter text.
  factory MmType.build(MmColors colors) {
    final ink = colors.ink;
    return MmType(
      figureHero: _gabarito(96, 1.0, FontWeight.w800, -3.5, ink),
      display: _gabarito(36, 1.05, FontWeight.w800, -3.5, ink),
      headline: _gabarito(28, 1.1, FontWeight.w800, -3, ink),
      title: _gabarito(22, 1.2, FontWeight.w700, -2, ink),
      subhead: _gabarito(17, 1.3, FontWeight.w700, -1, ink),
      figure: _gabarito(48, 1.0, FontWeight.w800, -3.5, ink),
      figureCompact: _gabarito(40, 1.0, FontWeight.w800, -3.5, ink),
      timer: _gabarito(20, 1.0, FontWeight.w700, 0, ink),
      button: _gabarito(17, 1.0, FontWeight.w700, 0, ink),
      label: _gabarito(13, 1.3, FontWeight.w600, 0, ink),
      navLabel: _gabarito(12, 1.3, FontWeight.w600, 0, ink),
      lead: _hanken(18, 1.45, FontWeight.w400, ink),
      question: _hanken(18, 1.5, FontWeight.w500, ink),
      body: _hanken(16, 1.55, FontWeight.w400, ink),
      small: _hanken(14, 1.5, FontWeight.w400, ink),
    );
  }

  static final MmType light = MmType.build(MmColors.light);
  static final MmType dark = MmType.build(MmColors.dark);

  @override
  MmType copyWith({
    TextStyle? figureHero,
    TextStyle? display,
    TextStyle? headline,
    TextStyle? title,
    TextStyle? subhead,
    TextStyle? figure,
    TextStyle? figureCompact,
    TextStyle? timer,
    TextStyle? button,
    TextStyle? label,
    TextStyle? navLabel,
    TextStyle? lead,
    TextStyle? question,
    TextStyle? body,
    TextStyle? small,
  }) {
    return MmType(
      figureHero: figureHero ?? this.figureHero,
      display: display ?? this.display,
      headline: headline ?? this.headline,
      title: title ?? this.title,
      subhead: subhead ?? this.subhead,
      figure: figure ?? this.figure,
      figureCompact: figureCompact ?? this.figureCompact,
      timer: timer ?? this.timer,
      button: button ?? this.button,
      label: label ?? this.label,
      navLabel: navLabel ?? this.navLabel,
      lead: lead ?? this.lead,
      question: question ?? this.question,
      body: body ?? this.body,
      small: small ?? this.small,
    );
  }

  @override
  MmType lerp(ThemeExtension<MmType>? other, double t) {
    if (other is! MmType) return this;
    TextStyle s(TextStyle a, TextStyle b) => TextStyle.lerp(a, b, t)!;
    return MmType(
      figureHero: s(figureHero, other.figureHero),
      display: s(display, other.display),
      headline: s(headline, other.headline),
      title: s(title, other.title),
      subhead: s(subhead, other.subhead),
      figure: s(figure, other.figure),
      figureCompact: s(figureCompact, other.figureCompact),
      timer: s(timer, other.timer),
      button: s(button, other.button),
      label: s(label, other.label),
      navLabel: s(navLabel, other.navLabel),
      lead: s(lead, other.lead),
      question: s(question, other.question),
      body: s(body, other.body),
      small: s(small, other.small),
    );
  }
}
