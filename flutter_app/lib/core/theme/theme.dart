import 'package:flutter/material.dart';

import 'fonts.dart';
import 'mm_colors.dart';
import 'mm_type.dart';
import 'tokens.dart';

export 'fonts.dart';
export 'glass_quality.dart';
export 'light_fields.dart';
export 'mm_colors.dart';
export 'mm_type.dart';
export 'tokens.dart';

/// Short access to the MockMob theme extensions.
extension MmThemeContext on BuildContext {
  MmColors get mmColors => Theme.of(this).extension<MmColors>() ?? MmColors.light;
  MmType get mmType => Theme.of(this).extension<MmType>() ?? MmType.light;
}

/// The page transition used by plain `Navigator` pushes (dialogs, the occasional `MaterialPageRoute`).
/// go_router pages use `MmTransitionPage` instead.
class _FadeOnlyTransitionsBuilder extends PageTransitionsBuilder {
  const _FadeOnlyTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return FadeTransition(opacity: animation, child: child);
  }
}

// On states are volt, the one interactive accent; a check glyph marks "on" so the state never
// depends on colour alone. Off states sit on the sunken well with a strong hairline.
SwitchThemeData _switchTheme(MmColors colors) => SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? colors.volt : colors.sunken),
      trackOutlineColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? colors.volt : colors.lineStrong),
      thumbColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? colors.voltInk : colors.ink2),
      thumbIcon: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected) ? Icon(Icons.check, size: 16, color: colors.volt) : null,
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
    );

CheckboxThemeData _checkboxTheme(MmColors colors) => CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? colors.volt : colors.sunken),
      checkColor: WidgetStatePropertyAll(colors.voltInk),
      side: BorderSide(color: colors.lineStrong, width: 1.5),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(6))),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
    );

RadioThemeData _radioTheme(MmColors colors) => RadioThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? colors.accentText : colors.lineStrong),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
    );

/// Builds the MockMob [ThemeData]. The `ColorScheme` exists only so framework widgets
/// (text fields, selection handles, dialogs) pick sensible colours; MockMob widgets read
/// [MmColors] and [MmType] directly.
ThemeData buildTheme(Brightness brightness) {
  final colors = MmColors.forBrightness(brightness);
  final type = brightness == Brightness.dark ? MmType.dark : MmType.light;

  final scheme = ColorScheme(
    brightness: brightness,
    // Ink, not volt: framework widgets paint text cursors and many small states in primary; the
    // MockMob controls choose volt themselves where it is the light.
    primary: colors.ink,
    onPrimary: colors.ground,
    secondary: colors.ink,
    onSecondary: colors.ground,
    error: colors.badText,
    onError: colors.ground,
    surface: colors.raised,
    onSurface: colors.ink,
    onSurfaceVariant: colors.ink2,
    outline: colors.lineStrong,
    outlineVariant: colors.line,
    surfaceContainerLowest: colors.sunken,
    surfaceContainerLow: colors.ground,
    surfaceContainer: colors.raised,
    surfaceContainerHigh: colors.raised2,
    surfaceContainerHighest: colors.raised2,
    scrim: colors.scrim,
  );

  final textTheme = TextTheme(
    displayLarge: type.figureHero,
    displayMedium: type.display,
    displaySmall: type.headline,
    headlineLarge: type.headline,
    headlineMedium: type.title,
    headlineSmall: type.title,
    titleLarge: type.title,
    titleMedium: type.subhead,
    titleSmall: type.label,
    bodyLarge: type.lead,
    bodyMedium: type.body,
    bodySmall: type.small,
    labelLarge: type.button,
    labelMedium: type.label,
    labelSmall: type.navLabel,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: colors.ground,
    canvasColor: colors.ground,
    fontFamily: MmFonts.hanken,
    textTheme: textTheme,
    primaryTextTheme: textTheme,
    extensions: <ThemeExtension<dynamic>>[colors, type],
    // No ripples (spec 2.3): pressed fills replace them.
    splashFactory: NoSplash.splashFactory,
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
    hoverColor: Colors.transparent,
    focusColor: Colors.transparent,
    dividerColor: colors.line,
    dividerTheme: DividerThemeData(color: colors.line, thickness: 1, space: 1),
    iconTheme: IconThemeData(color: colors.ink, size: 24),
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: _FadeOnlyTransitionsBuilder(),
        TargetPlatform.iOS: _FadeOnlyTransitionsBuilder(),
        TargetPlatform.fuchsia: _FadeOnlyTransitionsBuilder(),
        TargetPlatform.linux: _FadeOnlyTransitionsBuilder(),
        TargetPlatform.macOS: _FadeOnlyTransitionsBuilder(),
        TargetPlatform.windows: _FadeOnlyTransitionsBuilder(),
      },
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: colors.raised,
      modalBackgroundColor: colors.raised,
      modalBarrierColor: colors.scrim,
      elevation: 0,
      shape: const RoundedRectangleBorder(borderRadius: MmRadius.sheetTopOnly),
      clipBehavior: Clip.antiAlias,
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: colors.ink,
      selectionColor: Color.alphaBlend(colors.volt.withValues(alpha: 0.32), colors.raised),
      selectionHandleColor: colors.ink,
    ),
    switchTheme: _switchTheme(colors),
    checkboxTheme: _checkboxTheme(colors),
    radioTheme: _radioTheme(colors),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: colors.accentText, linearTrackColor: colors.line, circularTrackColor: colors.line),
    sliderTheme: SliderThemeData(
      activeTrackColor: colors.volt,
      inactiveTrackColor: colors.lineStrong,
      thumbColor: colors.ink,
      overlayColor: Colors.transparent,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.sunken,
      hintStyle: type.body.copyWith(color: colors.ink3),
      border: OutlineInputBorder(
        borderRadius: MmRadius.keyAll,
        borderSide: BorderSide(color: colors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: MmRadius.keyAll,
        borderSide: BorderSide(color: colors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: MmRadius.keyAll,
        borderSide: BorderSide(color: colors.focusRing, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: MmRadius.keyAll,
        borderSide: BorderSide(color: colors.badText, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: MmRadius.keyAll,
        borderSide: BorderSide(color: colors.badText, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s16),
    ),
  );
}
