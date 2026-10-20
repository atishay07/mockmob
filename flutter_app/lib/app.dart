import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth.dart';
import 'core/home_widget/home_widget_sync.dart' show homeWidgetSyncProvider;
import 'core/mascot/mascot.dart' show MobiCelebrations, celebrationLevelFor;
import 'core/motion/mm_scroll_behavior.dart';
import 'core/motion/reduced_motion.dart';
import 'core/platform/native_touches.dart';
import 'core/router/router.dart';
import 'core/settings/appearance_settings.dart';
import 'core/settings/theme_cross_fade.dart';
import 'core/theme/theme.dart';
import 'core/widgets/brand/brand_opening.dart';
import 'core/widgets/status_tint.dart';
import 'features/billing/billing.dart' show playBillingEnabledProvider, playBillingProvider;
import 'features/notifications/notifications.dart';
import 'features/onboarding/onboarding_routes.dart' show sampleImportProvider;
import 'features/referrals/referral_data.dart' show referralClaimerProvider;
import 'features/referrals/welcome_credits_trigger.dart' show welcomeCreditsDemoStarterProvider;
import 'features/rhythm/rhythm.dart' show celebrationModeProvider, rhythmWatcherProvider;

/// The root widget. It must sit under a [ProviderScope] (see `main.dart`).
class MockMobApp extends ConsumerWidget {
  const MockMobApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Reading the snapshot starts auth (Supabase, the stored session, /me); it runs async and the
    // opening never waits for it (the router shows the launch screen until it is known).
    ref.watch(authSnapshotProvider);
    ref.watch(savedSettingsProvider);
    // The services that read the database and the network (guest carry-over, reminders, milestones,
    // launcher shortcuts and the Play update, the home-screen widget) are not watched here: that
    // would build Today's data in the first frame, the one the system splash waits for. They start
    // when the opening has handed off ([_AppServices]).
    // Steps glass down to Lite once if the raster thread keeps missing its budget.
    ref.watch(glassPerformanceWatchProvider);

    return const ReducedMotionScope(child: _AppView());
  }
}

/// Starts what must run for the whole life of the app, once the brand opening has handed off:
/// keeps the guest carry-over alive and starts reminder planning and tap handling; milestones that
/// arrive in any fresh rhythm read get their moment, whichever screen is open; launcher shortcuts,
/// the quiet Play update and the first-run mark for the review prompt; the home-screen widget
/// follows Today (core/home_widget). None of it is needed to draw the first screen.
class _AppServices extends ConsumerWidget {
  const _AppServices();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(sampleImportProvider);
    ref.watch(notificationsRuntimeProvider);
    ref.watch(rhythmWatcherProvider);
    ref.watch(nativeTouchesProvider);
    ref.watch(homeWidgetSyncProvider);
    // A friend's invite kept from a link is handed to the server as soon as a student is signed in (owner D165).
    ref.watch(referralClaimerProvider);
    // The device demo's welcome-credits fixture; nothing in the app.
    ref.watch(welcomeCreditsDemoStarterProvider);
    // Google Play Billing listens for purchases from the first moment (a purchase the server could not
    // confirm last time is sent again here). Off with PLAY_BILLING off: nothing is built.
    if (ref.watch(playBillingEnabledProvider)) ref.watch(playBillingProvider);
    return const SizedBox.shrink();
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
      // The Night to Day switch is a deliberate 250 ms cross-fade of the old frame ([ThemeCrossFade]),
      // not a 200 ms lerp of every colour: painters and cached pictures showed muddy mid-states.
      themeAnimationDuration: Duration.zero,
      // Every scroll the app owns bounces, iOS style, with no Android stretch (F3, GLASS 5.9).
      scrollBehavior: const MmScrollBehavior(),
      builder: (context, child) {
        // Large text is allowed up to 2.0 so layouts must reflow, not clip.
        final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 2.0);
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: _systemBars(context),
          child: GlassScope(
            quality: ref.watch(glassQualityProvider),
            lens: ref.watch(glassLensAllowedProvider),
            child: MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: scaler),
              // The brand opening covers the app on every cold start, then removes itself.
              child: BrandOpeningHost(
                afterOpening: const _AppServices(),
                child: _Celebrations(
                  child: ThemeCrossFade(child: _StatusBarScrim(child: child ?? const SizedBox.shrink())),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The student's Celebrations setting reaches every Mobi in the app: Quiet calms his proud, cheer
/// and celebrate to a nod, Off keeps him still. The setting is read from the phone's own
/// preferences (no network), so watching it here costs nothing on a cold start.
class _Celebrations extends ConsumerWidget {
  const _Celebrations({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final level = celebrationLevelFor(ref.watch(celebrationModeProvider));
    return MobiCelebrations(level: level, child: child);
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
                    ? Align(
                        alignment: Alignment.topCenter,
                        child: SizedBox(
                          height: top,
                          width: double.infinity,
                          child: ColoredBox(color: tint),
                        ),
                      )
                    : DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, stops: [0, top / (top + fade), 1], colors: [ground, ground, ground.withValues(alpha: 0)]),
                        ),
                      ),
              ),
            ),
          ),
      ],
    );
  }
}
