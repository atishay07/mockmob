import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'app_overrides.dart';
import 'core/art/subject_emblem.dart' show SubjectEmblem;
import 'core/errors/errors.dart' show ErrorKinds, ErrorReporter, ErrorReportingHost;
import 'core/permissions/permission_requester.dart';
import 'core/router/error_fallback.dart';
import 'core/router/router.dart' show intendedRouteProvider;
import 'core/router/router_redirect.dart' show IntendedRoute;
import 'core/router/splash_screen.dart' show SplashScreen;
import 'core/storage/app_prefs.dart';
import 'core/storage/prefs_store.dart';
import 'core/theme/glass_quality.dart';
import 'core/widgets/brand/brand_opening.dart' show BrandOpeningHost;
import 'core/widgets/skeleton.dart' show SkeletonGroup;
import 'core/sync/sync.dart';
import 'features/notifications/services/android_permission_requester.dart';
import 'core/platform/startup_trace.dart';

void main() {
  runZonedGuarded(_start, (error, stack) => _report(error, stack, ErrorKinds.zone));
}

Future<void> _start() async {
  // L01: the log's clock for the way to Today's first card (`MMT` lines).
  StartupTrace.start();
  WidgetsFlutterBinding.ensureInitialized();
  _installErrorHandling();
  // Every loading skeleton carries the soft sweep in the app; tests keep the static default.
  SkeletonGroup.shimmerByDefault = true;
  // Animated subject emblems drift in the app; tests keep the static default so screens settle.
  SubjectEmblem.idleEnabled = true;
  // Subjects wear their photo-real objects from 40 dp up; tests keep the drawn emblems.
  SubjectEmblem.objectArt = true;
  // The launch screen of a slow start keeps Mobi's idle blink; tests keep the still frame.
  SplashScreen.idleEnabled = true;
  unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
  // The first frame is the "mo" alone: the app builds under the opening once the "mo" is on the
  // glass, so a slow phone does not hold the system splash while the router and the first
  // screen build.
  BrandOpeningHost.deferApp = true;
  // The saved glass quality, so a saved Lite or Off is right on the first frame; and where the
  // student was heading when the app last died during sign-in (a code read in the mail app,
  // Google sign-in in the browser): kept on the phone and restored here, so the target page and
  // the first-sign-in sheet survive the process being killed. Read together, not one after the
  // other: each is a round trip to the platform before the first frame.
  final boot = await Future.wait<Object>([
    GlassBoot.read(AppPrefs(SharedPrefsStore())),
    IntendedRoute.restored(SharedPrefsStore()),
  ]);
  final glass = boot[0] as GlassBoot;
  final intended = boot[1] as IntendedRoute;

  StartupTrace.mark('runApp');
  runApp(
    ProviderScope(
      overrides: [
        glassBootProvider.overrideWithValue(glass),
        intendedRouteProvider.overrideWithValue(intended),
        // Start, the bar's live capsule and its badges (shared with the device demo).
        ...liveAppOverrides(),
        // Module 11: the Android 13 notification permission.
        permissionRequesterProvider.overrideWith((ref) => ref.watch(androidPermissionRequesterProvider)),
      ],
      child: const ErrorReportingHost(child: MockMobApp()),
    ),
  );

  // The database, notifications and WorkManager are not needed to paint the first frame.
  WidgetsBinding.instance.addPostFrameCallback((_) {
    StartupTrace.mark('first frame');
    unawaited(_initAfterFirstFrame());
  });
}

Future<void> _initAfterFirstFrame() async {
  try {
    await initializeBackgroundWork();
  } on Object catch (error, stack) {
    _report(error, stack);
  }
}

/// A student never sees a red error screen in release: a failed widget draws a calm note with a
/// way back (small spots draw nothing), and the error is logged. Debug and profile builds keep the framework's loud behaviour.
void _installErrorHandling() {
  final framework = FlutterError.onError;
  FlutterError.onError = (details) {
    if (kDebugMode) {
      framework?.call(details);
    } else {
      _report(details.exception, details.stack, ErrorKinds.flutter);
    }
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    _report(error, stack, ErrorKinds.platform);
    return true;
  };
  if (kReleaseMode) {
    ErrorWidget.builder = buildErrorFallback;
  }
}

void _report(Object error, StackTrace? stack, [String kind = ErrorKinds.other]) {
  ErrorLog.add(error, stack);
  // Kept on the phone, and sent only if the student allowed usage data (core/errors).
  try {
    ErrorReporter.shared.report(error, stack, kind: kind);
  } on Object {
    // Never a second failure.
  }
}

