import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The NTA mode skin (NTA-MODE-SPEC sections 3 to 6, 9.1). In the default NTA style the whole
/// exam is the paper the student will meet on exam day, pinned in Night and Daylight alike: the
/// blue bar, the #EAF0F4 page, white cards, dark ink, the five palette states, the purple
/// "Mark for Review & Next" and the green "Save & Next" ([NtaPaperTheme] supplies the paper
/// colours). In the MockMob style the paper follows the app theme and only these exam keys stay.
@immutable
class NtaSkin {
  const NtaSkin._({
    required this.colors,
    required this.dark,
    required this.radio,
    required this.selectedRow,
    required this.selectedEdge,
    required this.currentRing,
    required this.tabLine,
    required this.type,
  });

  factory NtaSkin.of(BuildContext context) {
    final colors = context.mmColors;
    final dark = Theme.of(context).brightness == Brightness.dark;
    const nightRadio = Color(0xFF7DB0EE);
    final exam = NtaExamLook.of(context);
    // The MockMob look takes its accents from the app (volt on Night, its olive on Daylight)
    // where the exam look keeps the exam's blue, so the two never read as one.
    final accent = colors.accentText;
    return NtaSkin._(
      colors: colors,
      dark: dark,
      radio: !exam ? accent : (dark ? nightRadio : const Color(0xFF2769BD)),
      selectedRow: !exam
          ? Color.lerp(colors.raised, accent, dark ? 0.12 : 0.1)!
          : (dark ? Color.lerp(colors.raised, nightRadio, 0.12)! : const Color(0xFFEAF5FF)),
      selectedEdge: !exam
          ? Color.lerp(colors.raised, accent, 0.55)!
          : (dark ? Color.lerp(colors.raised, nightRadio, 0.55)! : const Color(0xFF9CC0DE)),
      currentRing: !exam ? accent : (dark ? const Color(0xFFA9CBE6) : const Color(0xFF306A92)),
      tabLine: !exam ? accent : (dark ? const Color(0xFFA9CBE6) : bar),
      type: NtaTypeSet._(exam, context.mmType),
    );
  }

  /// The skin's type: Arial in the exam look, the app's own faces in the MockMob style.
  final NtaTypeSet type;

  final MmColors colors;
  final bool dark;

  // The exam bar (nta-classic.css).
  static const Color bar = Color(0xFF32688F);
  static const Color barEdge = Color(0xFF225478);
  static const Color onBar = Color(0xFFFFFFFF);
  static const Color onBar2 = Color(0xD9FFFFFF);
  static const Color barTrack = Color(0x38FFFFFF);
  static const Color volt = Color(0xFFD2F000);

  // The two exam keys.
  static const Color purple = Color(0xFF754B9C);
  static const Color purpleEdge = Color(0xFF68408D);
  static const Color green = Color(0xFF348638);
  static const Color greenEdge = Color(0xFF28712D);

  // The five palette states (section 5 table).
  static const Color notVisitedTop = Color(0xFFFFFFFF);
  static const Color notVisitedBottom = Color(0xFFE4E4E4);
  static const Color notVisitedEdge = Color(0xFFB3B3B3);
  static const Color notVisitedText = Color(0xFF444444);
  static const Color notAnswered = Color(0xFFD84500);
  static const Color notAnsweredEdge = Color(0xFFC33D00);
  static const Color answered = Color(0xFF309816);
  static const Color answeredEdge = Color(0xFF27820F);
  static const Color markedLight = Color(0xFFB797DE);
  static const Color markedDeep = Color(0xFF512593);
  static const Color markedEdge = Color(0xFF7445A8);
  static const Color markedDot = Color(0xFF86EFAC);

  // Low time on the clock chip (under 60 seconds).
  static const Color lowFill = Color(0x40F87171);
  static const Color lowEdge = Color(0xD9F87171);

  /// The chosen option's radio.
  final Color radio;
  final Color selectedRow;
  final Color selectedEdge;

  /// The 2 dp ring around the current question's chip.
  final Color currentRing;

  /// The underline of the one section tab.
  final Color tabLine;

  /// Corner radius of the paper and the keys: crisp like the exam's console, not pill.
  static const double radius = 3;
  static const BorderRadius radiusAll = BorderRadius.all(Radius.circular(radius));
  static const BorderRadius keyRadius = BorderRadius.all(Radius.circular(4));
}

/// The colours of the exam's top bar and the bands that echo it (the palette's section band, the
/// summary's header, the candidate's initial). The NTA look is the exam's blue with white ink;
/// the MockMob look is the app's own chrome (a raised bar on the ground, ink text, the app's
/// accent for progress), so the two looks differ at the first glance, in Daylight too.
@immutable
class NtaBarColors {
  const NtaBarColors._({
    required this.fill,
    required this.edge,
    required this.on,
    required this.on2,
    required this.track,
    required this.progress,
    required this.chip,
    required this.chipEdge,
    required this.splash,
    required this.highlight,
    required this.band,
    required this.onBand,
    required this.onBand2,
    required this.avatar,
    required this.onAvatar,
    required this.statusIcons,
  });

  factory NtaBarColors.of(BuildContext context) => NtaExamLook.of(context) ? exam : NtaBarColors.fromApp(context.mmColors);

  /// The MockMob look's bar, from the app's own colours [c].
  factory NtaBarColors.fromApp(MmColors c) {
    return NtaBarColors._(
      fill: c.raised,
      edge: c.line,
      on: c.ink,
      on2: c.ink2,
      track: c.line,
      progress: c.accentText,
      chip: c.sunken,
      chipEdge: c.line,
      splash: c.ink.withValues(alpha: 0.1),
      highlight: c.ink.withValues(alpha: 0.06),
      band: c.sunken,
      onBand: c.ink,
      onBand2: c.ink2,
      avatar: c.volt,
      onAvatar: c.voltInk,
      statusIcons: c.isNight ? Brightness.light : Brightness.dark,
    );
  }

  /// The exam's own bar (nta-classic.css).
  static const NtaBarColors exam = NtaBarColors._(
    fill: NtaSkin.bar,
    edge: NtaSkin.barEdge,
    on: NtaSkin.onBar,
    on2: NtaSkin.onBar2,
    track: NtaSkin.barTrack,
    progress: NtaSkin.volt,
    chip: Color(0x1FFFFFFF),
    chipEdge: Color(0x4DFFFFFF),
    splash: Color(0x22FFFFFF),
    highlight: Color(0x14FFFFFF),
    band: NtaSkin.bar,
    onBand: NtaSkin.onBar,
    onBand2: NtaSkin.onBar2,
    avatar: NtaSkin.bar,
    onAvatar: NtaSkin.onBar,
    statusIcons: Brightness.light,
  );

  /// The bar and the strip under the status bar.
  final Color fill;
  final Color edge;

  /// Text and icons on the bar, and the quieter second line.
  final Color on;
  final Color on2;

  /// The progress line: its track and its fill.
  final Color track;
  final Color progress;

  /// The clock's chip, and the press colours of the bar's keys.
  final Color chip;
  final Color chipEdge;
  final Color splash;
  final Color highlight;

  /// The section band of the palette and the summary, the ink on it, and the candidate's initial.
  final Color band;
  final Color onBand;
  final Color onBand2;
  final Color avatar;
  final Color onAvatar;

  /// The status bar's icons over [fill].
  final Brightness statusIcons;
}

/// Marks the subtree as the exam look (the NTA style): the paper the student will meet on exam
/// day, in its own type. Placed by `NtaStyleTheme` in both styles, with [exam] false in the
/// MockMob style, so a change of style never changes the tree under it.
class NtaExamLook extends InheritedWidget {
  const NtaExamLook({super.key, this.exam = true, required super.child});

  final bool exam;

  static bool of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<NtaExamLook>()?.exam ?? false;

  @override
  bool updateShouldNotify(NtaExamLook oldWidget) => oldWidget.exam != exam;
}

/// The exam skin's type set (NTA-MODE-SPEC 9.1): Arial, the exam console's face, with the
/// platform sans behind it (Android has no Arial, so it draws Roboto, which is what Chrome on an
/// Android phone shows for the website). An 18 px question, a bold clock with tabular figures so
/// the second hand never makes it jitter. Used in the exam look only: in the MockMob style and
/// everywhere else in the app these resolve to the app's own faces (Bricolage, Hanken).
@immutable
class NtaTypeSet {
  const NtaTypeSet._(this._exam, this._base);

  final bool _exam;
  final MmType _base;

  static const String family = 'Arial';
  static const List<String> fallback = ['Roboto', 'Helvetica Neue', 'Helvetica', 'sans-serif'];

  static TextStyle _arial(double size, double height, FontWeight weight, {bool tabular = false}) => TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    fontSize: size,
    height: height,
    fontWeight: weight,
    leadingDistribution: TextLeadingDistribution.even,
    fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
  );

  /// The clock in the bar: bold, tabular, 19 px.
  TextStyle get clock => _exam ? _arial(19, 1, FontWeight.w700, tabular: true) : _base.timer.copyWith(fontSize: 19, height: 1);

  /// The subject in the bar.
  TextStyle get barTitle => _exam ? _arial(18, 1.15, FontWeight.w700) : _base.cardTitle.copyWith(height: 1.15);

  /// The question: 18 px at the default text size.
  TextStyle question(double scale) {
    // From 1.15x the stem's lines sit a little closer, so a large stem leaves room for options.
    final height = scale >= 1.15 ? 1.4 : 1.55;
    return _exam ? _arial(18 * scale, height, FontWeight.w400) : _base.question.copyWith(fontSize: 18 * scale, height: height);
  }

  /// An option's text: 16 px.
  TextStyle option(double scale) => _exam ? _arial(16 * scale, 1.45, FontWeight.w400) : _base.body.copyWith(fontSize: 16 * scale, height: 1.45);

  /// The passage well.
  TextStyle passage(double scale) => _exam ? _arial(15.5 * scale, 1.7, FontWeight.w400) : _base.body.copyWith(fontSize: 15.5 * scale, height: 1.7);

  /// A page heading on the instructions and preparing pages.
  TextStyle get headline => _exam ? _arial(26, 1.2, FontWeight.w700) : _base.headline;
}
