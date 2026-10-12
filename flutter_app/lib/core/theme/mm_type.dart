import 'package:flutter/material.dart';

import 'fonts.dart';
import 'mm_colors.dart';

/// Type roles of the Night Sheet (brief section 4). Read with `context.mmType`.
///
/// Bricolage (condensed, headline, title cuts) is for numbers, moments and screen titles;
/// Hanken Grotesk is for everything a student reads. Sizes scale with the system text scale;
/// only the dock labels clamp. Every role requests tabular figures.
///
/// The original role names are kept so existing screens adopt the new look without edits:
/// [figureHero], [figure] and [figureCompact] are condensed numbers, [display] and [headline]
/// are moment headlines, [title] is the screen title, [subhead] is the card title.
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
    required this.hero,
    required this.moment,
    required this.screenTitle,
    required this.cardTitle,
    required this.labelLarge,
    required this.caption,
  });

  /// Monumental number, 96 sp condensed.
  final TextStyle figureHero;

  /// Moment headline, 36/38.
  final TextStyle display;

  /// Smaller moment headline, 28 sp.
  final TextStyle headline;

  /// Section or sheet title, 22 sp Bricolage.
  final TextStyle title;

  /// Card title, Hanken 17/22 bold.
  final TextStyle subhead;

  /// Key figures, 52 sp condensed.
  final TextStyle figure;

  /// The 40 sp end of the figure range.
  final TextStyle figureCompact;

  /// The runner timer and other live counters.
  final TextStyle timer;

  /// Button labels, Hanken 16 semibold.
  final TextStyle button;

  /// Small labels, Hanken 13/18 semibold.
  final TextStyle label;

  /// Dock labels, 12 sp Hanken 600.
  final TextStyle navLabel;
  final TextStyle lead;

  /// Questions, 17/26.
  final TextStyle question;

  /// Body, 16/24.
  final TextStyle body;
  final TextStyle small;

  /// The biggest number on a moment screen: 112 sp condensed, line 0.86.
  final TextStyle hero;

  /// Moment headline (welcome, plan reveal, milestone): 36/38, two lines at most.
  final TextStyle moment;

  /// Screen title at a tab root: 26/30 Bricolage.
  final TextStyle screenTitle;

  /// Card title: Hanken 17/22 bold.
  final TextStyle cardTitle;

  /// Labels you act on: Hanken 15/20 semibold.
  final TextStyle labelLarge;

  /// Captions: Hanken 13/18 medium.
  final TextStyle caption;

  static const List<FontFeature> _tabular = [FontFeature.tabularFigures()];

  static TextStyle _bricolage(String family, double size, double lineHeight, double trackingPercent, Color color) {
    return TextStyle(
      fontFamily: family,
      fontSize: size,
      height: lineHeight / size,
      // Each static cut is registered at its real weight, so the engine never fakes bold.
      fontWeight: family == MmFonts.condensed ? FontWeight.w700 : FontWeight.w600,
      letterSpacing: size * trackingPercent / 100,
      color: color,
      fontFeatures: _tabular,
      leadingDistribution: TextLeadingDistribution.even,
    );
  }

  static TextStyle _hanken(double size, double lineHeight, FontWeight weight, Color color, {double tracking = 0}) {
    return TextStyle(
      fontFamily: MmFonts.hanken,
      fontSize: size,
      height: lineHeight / size,
      fontWeight: weight,
      letterSpacing: size * tracking / 100,
      color: color,
      fontFeatures: _tabular,
      leadingDistribution: TextLeadingDistribution.even,
    );
  }

  /// All roles in the `ink` colour of [colors]. Use `copyWith(color: ...)` for quieter text.
  factory MmType.build(MmColors colors) {
    final ink = colors.ink;
    return MmType(
      figureHero: _bricolage(MmFonts.condensed, 96, 86, -1, ink),
      display: _bricolage(MmFonts.headline, 36, 38, -2.5, ink),
      headline: _bricolage(MmFonts.headline, 28, 31, -2, ink),
      title: _bricolage(MmFonts.title, 22, 27, -1.5, ink),
      subhead: _hanken(17, 22, FontWeight.w700, ink, tracking: -0.5),
      figure: _bricolage(MmFonts.condensed, 52, 50, -1, ink),
      figureCompact: _bricolage(MmFonts.condensed, 40, 40, -0.5, ink),
      timer: _bricolage(MmFonts.title, 20, 22, 0, ink),
      button: _hanken(16, 20, FontWeight.w600, ink),
      label: _hanken(13, 18, FontWeight.w600, ink),
      navLabel: _hanken(12, 15, FontWeight.w600, ink),
      lead: _hanken(18, 26, FontWeight.w400, ink),
      question: _hanken(17, 26, FontWeight.w500, ink),
      body: _hanken(16, 24, FontWeight.w400, ink),
      small: _hanken(14, 20, FontWeight.w400, ink),
      hero: _bricolage(MmFonts.condensed, 112, 96, -1.5, ink),
      moment: _bricolage(MmFonts.headline, 36, 38, -2.5, ink),
      screenTitle: _bricolage(MmFonts.title, 26, 30, -1.5, ink),
      cardTitle: _hanken(17, 22, FontWeight.w700, ink, tracking: -0.5),
      labelLarge: _hanken(15, 20, FontWeight.w600, ink),
      caption: _hanken(13, 18, FontWeight.w500, ink),
    );
  }

  static final MmType light = MmType.build(MmColors.light);
  static final MmType dark = MmType.build(MmColors.dark);

  List<TextStyle> get all => [
        figureHero, display, headline, title, subhead, figure, figureCompact, timer, button, label, navLabel, //
        lead, question, body, small, hero, moment, screenTitle, cardTitle, labelLarge, caption,
      ];

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
    TextStyle? hero,
    TextStyle? moment,
    TextStyle? screenTitle,
    TextStyle? cardTitle,
    TextStyle? labelLarge,
    TextStyle? caption,
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
      hero: hero ?? this.hero,
      moment: moment ?? this.moment,
      screenTitle: screenTitle ?? this.screenTitle,
      cardTitle: cardTitle ?? this.cardTitle,
      labelLarge: labelLarge ?? this.labelLarge,
      caption: caption ?? this.caption,
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
      hero: s(hero, other.hero),
      moment: s(moment, other.moment),
      screenTitle: s(screenTitle, other.screenTitle),
      cardTitle: s(cardTitle, other.cardTitle),
      labelLarge: s(labelLarge, other.labelLarge),
      caption: s(caption, other.caption),
    );
  }
}
