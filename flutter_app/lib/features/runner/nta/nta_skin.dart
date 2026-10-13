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
    return NtaSkin._(
      colors: colors,
      dark: dark,
      radio: dark ? nightRadio : const Color(0xFF2769BD),
      selectedRow: dark ? Color.lerp(colors.raised, nightRadio, 0.12)! : const Color(0xFFEAF5FF),
      selectedEdge: dark ? Color.lerp(colors.raised, nightRadio, 0.55)! : const Color(0xFF9CC0DE),
      currentRing: dark ? const Color(0xFFA9CBE6) : const Color(0xFF306A92),
      tabLine: dark ? const Color(0xFFA9CBE6) : bar,
      type: NtaTypeSet._(NtaExamLook.of(context), context.mmType),
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

/// Marks the subtree as the exam look (the NTA style): the paper the student will meet on exam
/// day, in its own type. Placed by `NtaStyleTheme`; absent in the MockMob style.
class NtaExamLook extends InheritedWidget {
  const NtaExamLook({super.key, required super.child});

  static bool of(BuildContext context) => context.getInheritedWidgetOfExactType<NtaExamLook>() != null;

  @override
  bool updateShouldNotify(NtaExamLook oldWidget) => false;
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
  TextStyle question(double scale) => _exam ? _arial(18 * scale, 1.55, FontWeight.w400) : _base.question.copyWith(fontSize: 18 * scale, height: 1.55);

  /// An option's text: 16 px.
  TextStyle option(double scale) => _exam ? _arial(16 * scale, 1.45, FontWeight.w400) : _base.body.copyWith(fontSize: 16 * scale, height: 1.45);

  /// The passage well.
  TextStyle passage(double scale) => _exam ? _arial(15.5 * scale, 1.7, FontWeight.w400) : _base.body.copyWith(fontSize: 15.5 * scale, height: 1.7);

  /// A page heading on the instructions and preparing pages.
  TextStyle get headline => _exam ? _arial(26, 1.2, FontWeight.w700) : _base.headline;
}
