import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/art/subject_emblem.dart' show SubjectEmblem;
import 'core/permissions/permission_requester.dart';
import 'core/repositories/repositories.dart';
import 'core/router/app_shell.dart';
import 'core/router/error_fallback.dart';
import 'core/router/quick_start.dart';
import 'core/storage/app_prefs.dart';
import 'core/storage/prefs_store.dart';
import 'core/theme/glass_quality.dart';
import 'core/widgets/skeleton.dart' show SkeletonGroup;
import 'core/sync/sync.dart';
import 'features/notifications/services/android_permission_requester.dart';
import 'features/practice/data/start_entries.dart' show practiceQuickNtaProvider;
import 'features/review/data/review_providers.dart' show quickRepairFromReviewProvider;

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

  runApp(
    ProviderScope(
      // The Review tab dot follows results that arrived but have not been opened.
      overrides: [
        glassBootProvider.overrideWithValue(glass),
        // Start's "Repair the next mistake" opens the ten-minute run from tonight's first mistake
        // (one pick for Today, Review and Start; the launcher's 10-min repair opens the same).
        quickStartRepairProvider.overrideWith((ref) => ref.watch(quickRepairFromReviewProvider)),
        // Start's NTA row follows Practice's quote for the student's practice subject.
        quickStartNtaProvider.overrideWith((ref) => ref.watch(practiceQuickNtaProvider)),
        reviewDotProvider.overrideWith((ref) => ref.watch(hasUnopenedResultProvider)),
        // The dock's Start breathes when a session can be resumed.
        dockResumeKeyProvider.overrideWith((ref) => ref.watch(resumeDraftProvider)?.sessionId),
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
