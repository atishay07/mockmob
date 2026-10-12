import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth.dart';
import 'core/motion/reduced_motion.dart';
import 'core/router/router.dart';
import 'core/settings/appearance_settings.dart';
import 'core/theme/theme.dart';
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
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        );
      },
    );
  }
}
