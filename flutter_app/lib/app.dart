import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth.dart';
import 'core/motion/reduced_motion.dart';
import 'core/router/router.dart';
import 'core/settings/appearance_settings.dart';
import 'core/theme/theme.dart';
import 'core/widgets/brand/brand_opening.dart';
import 'core/widgets/status_tint.dart';
import 'features/notifications/notifications.dart';
import 'features/onboarding/onboarding_routes.dart' show sampleImportProvider;

/// The root widget. It must sit under a [ProviderScope] (see `main.dart`).
class MockMobApp extends ConsumerWidget {
  const MockMobApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Reading the snapshot starts auth (Supabase, the stored session, /me) after the first frame.
    ref.watch(authSnapshotProvider);
    ref.watch(savedSettingsProvider);
    // Keeps the guest carry-over alive and starts reminder planning and tap handling.
    ref.watch(sampleImportProvider);
    ref.watch(notificationsRuntimeProvider);
    // Steps glass down to Lite once if the raster thread keeps missing its budget.
    ref.watch(glassPerformanceWatchProvider);

    return const ReducedMotionScope(child: _AppView());
  }
}

/// Edge-to-edge system bars that follow the app theme: both bars transparent (the glass dock
/// floats over the content and the gesture bar), with icons that contrast with the ground.
SystemUiOverlayStyle _systemBars(BuildContext context) {
  final colors = context.mmColors;
  final iconBrightness = Theme.of(context).brightness == Brightness.dark ? Brightness.light : Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: iconBrightness,
    systemStatusBarContrastEnforced: false,
    systemNavigationBarColor: colors.ground.withValues(alpha: 0),
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarIconBrightness: iconBrightness,
    systemNavigationBarContrastEnforced: false,
  );
}

class _AppView extends ConsumerWidget {
  const _AppView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'MockMob',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ref.watch(themeModeProvider),
      builder: (context, child) {
        // Large text is allowed up to 2.0 so layouts must reflow, not clip.
        final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 2.0);
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: _systemBars(context),
          child: GlassScope(
            quality: ref.watch(glassQualityProvider),
            child: MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: scaler),
              // The brand opening covers the app on every cold start, then removes itself.
              child: BrandOpeningHost(child: _StatusBarScrim(child: child ?? const SizedBox.shrink())),
            ),
          ),
        );
      },
    );
  }
}

/// Edge to edge, scrolled content would run under the status bar icons. The ground colour sits
/// solid behind the bar and fades out over 24 dp below it, so the clock and icons stay legible on
/// every screen and no title shows through (it is environment, not chrome, so it never takes
/// touches). A screen whose own bar runs under the status bar (NTA mode) tints it instead.
class _StatusBarScrim extends StatelessWidget {
  const _StatusBarScrim({required this.child});

  final Widget child;

  static const double fade = 24;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final ground = context.mmColors.ground;
    // One tree shape whatever the inset: when the runner hides the status bar the inset drops
    // to 0, and returning `child` bare would re-parent the router and its navigators.
    return Stack(
      children: [
        Positioned.fill(child: child),
        if (top > 0)
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: top + fade,
            child: IgnorePointer(
              child: ValueListenableBuilder<Color?>(
                valueListenable: statusTintColor,
                builder: (context, tint, _) => tint != null
                    ? Align(alignment: Alignment.topCenter, child: SizedBox(height: top, width: double.infinity, child: ColoredBox(color: tint)))
                    : DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            stops: [0, top / (top + fade), 1],
                            colors: [ground, ground, ground.withValues(alpha: 0)],
                          ),
                        ),
                      ),
              ),
            ),
          ),
      ],
    );
  }
}
