/// Bundled font families (Night Sheet brief, section 4). The files live in `assets/fonts/` and
/// are declared in `pubspec.yaml`.
///
/// Bricolage Grotesque is cut into static instances by `tool/cut_fonts.py` (no runtime variable
/// axes): a condensed bold for monumental numbers, a semi-condensed headline for moments, a
/// normal-width title for screens, and a tiny lowercase-only cut for the wordmark. Hanken Grotesk
/// carries everything a student reads.
///
/// `tnum` check (done when cutting): every Bricolage cut ships `tnum`, so roles that show data
/// request `FontFeature.tabularFigures()`. Hanken Grotesk has no `tnum` feature but its default
/// digits are already equal width (560 units), so its figures line up on their own.
/// Gabarito is retired from the UI.
abstract final class MmFonts {
  /// Hero numbers: width 75, weight 700, optical size 96.
  static const String condensed = 'BricolageCondensed';

  /// Moment headlines: width 87, weight 650, optical size 48.
  static const String headline = 'BricolageHeadline';

  /// Screen titles: width 100, weight 600, optical size 24.
  static const String title = 'BricolageTitle';

  /// The `mockmob` wordmark only (lowercase a to z).
  static const String wordmark = 'BricolageWordmark';

  /// Body, questions, labels and captions.
  static const String hanken = 'HankenGrotesk';
}
