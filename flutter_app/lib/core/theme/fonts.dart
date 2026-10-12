/// Bundled font families (spec 2.2). The files live in `assets/fonts/` and are declared in
/// `pubspec.yaml` (see `pubspec_fonts_block.txt` next to it).
///
/// Gabarito is the display and UI family (400 to 800). Hanken Grotesk is the reading family
/// (400 to 700).
///
/// `tnum` check (done at setup): Gabarito ships the `tnum` feature, Hanken Grotesk does not.
/// Every number that must align (timers, marks, tables, the question counts) therefore uses a
/// Gabarito role (`timer`, `figure`, `label`, `button`) and never Hanken. Hanken text still
/// requests `tabularFigures` so it picks the feature up if the font is ever replaced.
abstract final class MmFonts {
  static const String gabarito = 'Gabarito';
  static const String hanken = 'HankenGrotesk';
}
