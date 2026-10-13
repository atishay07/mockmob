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
    );
  }

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
