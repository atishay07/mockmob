import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'app_overrides.dart';
import 'core/art/subject_emblem.dart' show SubjectEmblem;
import 'core/permissions/permission_requester.dart';
import 'core/router/error_fallback.dart';
import 'core/router/router.dart' show intendedRouteProvider;
import 'core/router/router_redirect.dart' show IntendedRoute;
import 'core/storage/app_prefs.dart';
import 'core/storage/prefs_store.dart';
import 'core/theme/glass_quality.dart';
import 'core/widgets/skeleton.dart' show SkeletonGroup;
import 'core/sync/sync.dart';
import 'features/notifications/services/android_permission_requester.dart';

void main() {
  runZonedGuarded(_start, (error, stack) => _report(error, stack));
}

Future<void> _start() async {
  WidgetsFlutterBinding.ensureInitialized();
  _installErrorHandling();
  // Every loading skeleton carries the soft sweep in the app; tests keep the static default.
  SkeletonGroup.shimmerByDefault = true;
  // Animated subject emblems drift in the app; tests keep the static default so screens settle.
  SubjectEmblem.idleEnabled = true;
  unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
  // The saved glass quality, so a saved Lite or Off is right on the first frame.
  final glass = await GlassBoot.read(AppPrefs(SharedPrefsStore()));
  // Where the student was heading when the app last died during sign-in (a code read in the mail
  // app, Google sign-in in the browser): kept on the phone and restored here, so the target page
  // and the first-sign-in sheet survive the process being killed.
  final intended = await IntendedRoute.restored(SharedPrefsStore());

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
      child: const MockMobApp(),
    ),
  );

  // The database, notifications and WorkManager are not needed to paint the first frame.
  WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_initAfterFirstFrame()));
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
      _report(details.exception, details.stack);
    }
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    _report(error, stack);
    return true;
  };
  if (kReleaseMode) {
    ErrorWidget.builder = buildErrorFallback;
  }
}

void _report(Object error, StackTrace? stack) => ErrorLog.add(error, stack);

