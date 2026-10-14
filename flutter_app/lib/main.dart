import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/art/subject_emblem.dart' show SubjectEmblem;
import 'core/permissions/permission_requester.dart';
import 'core/repositories/repositories.dart';
import 'core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'core/connectivity/connectivity_providers.dart' show networkStatusProvider;
import 'core/sync/pending_work.dart' show pendingWorkProvider, pendingWorkCountProvider;
import 'core/widgets/bar/bar_badges.dart';
import 'core/widgets/bar/bar_live.dart';
import 'core/router/error_fallback.dart';
import 'core/router/quick_start.dart';
import 'core/router/router.dart' show intendedRouteProvider;
import 'core/router/router_redirect.dart' show IntendedRoute;
import 'core/storage/app_prefs.dart';
import 'core/storage/prefs_store.dart';
import 'core/theme/glass_quality.dart';
import 'core/widgets/skeleton.dart' show SkeletonGroup;
import 'core/sync/sync.dart';
import 'features/notifications/services/android_permission_requester.dart';
import 'features/practice/data/start_entries.dart' show practiceQuickNtaProvider;
import 'features/practice/data/practice_catalog.dart' show practiceSubjectProvider, practiceSubjectsProvider;
import 'features/review/data/review_providers.dart' show quickRepairFromReviewProvider, reviewIndexProvider;
import 'features/today/data/today_providers.dart' show todayInputsProvider, todayNextActionProvider, todayViewProvider;
import 'features/today/logic/move_builder.dart' show buildMove, paperLabel;
import 'features/today/logic/subjects.dart' show canonicalSubject;
import 'features/today/logic/today_model.dart' show GoTo, ResumeHero;

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
      // The Review tab dot follows results that arrived but have not been opened.
      overrides: [
        glassBootProvider.overrideWithValue(glass),
        intendedRouteProvider.overrideWithValue(intended),
        // Start's "Repair the next mistake" opens the ten-minute run from tonight's first mistake
        // (one pick for Today, Review and Start; the launcher's 10-min repair opens the same).
        quickStartRepairProvider.overrideWith((ref) => ref.watch(quickRepairFromReviewProvider)),
        // Start's NTA row follows Practice's quote for the student's practice subject.
        quickStartNtaProvider.overrideWith((ref) => ref.watch(practiceQuickNtaProvider)),
        // Start's hero is tonight's move, the same move Today's hero builds.
        startTonightMoveProvider.overrideWith((ref) {
          final action = ref.watch(todayNextActionProvider);
          final target = action?.target;
          if (action == null || target is! GoTo) return null;
          return StartMove(title: buildMove(ref.watch(todayInputsProvider)).summary, location: target.location, kind: action.actionType);
        }),
        // Start's subject chips: the student's practice subjects, opening on Practice's subject.
        startSubjectsProvider.overrideWith((ref) {
          final catalog = ref.watch(practiceSubjectsProvider).value;
          return catalog == null ? const <String>[] : [for (final s in catalog) s.id];
        }),
        startDefaultSubjectProvider.overrideWith((ref) => ref.watch(practiceSubjectProvider)),
        // The bar's live capsule and badges, each from its real source (DOCK.md 5.3 and 5.6).
        barSendingInputProvider.overrideWith((ref) {
          final draft = ref.watch(latestSessionDraftProvider).value;
          if (draft == null || !draft.pendingSubmission) return null;
          if (ref.watch(networkStatusProvider) == NetworkStatus.offline) return null;
          return _paper(draft.subject, mock: draft.isMock);
        }),
        barMarkedInputProvider.overrideWith((ref) {
          final unopened = ref.watch(unopenedResultsProvider).value ?? const [];
          if (unopened.isEmpty) return null;
          final first = unopened.first;
          final all = ref.watch(attemptsRepositoryProvider).value;
          final attempt = all == null ? null : [for (final a in all) if (a.id == first.attemptId) a].firstOrNull;
          return BarMarked(
            attemptId: first.attemptId,
            paper: all == null || attempt == null ? 'Your paper' : paperLabel(all, attempt),
            subject: attempt == null ? null : subjectDisplayName(canonicalSubject(attempt.subject)),
            more: unopened.length - 1,
          );
        }),
        barResumeInputProvider.overrideWith((ref) {
          final draft = ref.watch(resumeDraftProvider);
          if (draft == null) return null;
          final offer = ref.watch(resumeOfferProvider).value;
          return BarResume(
            sessionId: draft.sessionId,
            paper: _paper(draft.subject, mock: draft.isMock),
            total: draft.view.questions.length,
            answered: offer != null && offer.draft.sessionId == draft.sessionId ? offer.answered : null,
            endsAt: draft.isMock && draft.endsAtWallMs > 0 ? DateTime.fromMillisecondsSinceEpoch(draft.endsAtWallMs) : null,
          );
        }),
        barOfflineInputProvider.overrideWith((ref) {
          if (ref.watch(networkStatusProvider) != NetworkStatus.offline || !ref.watch(pendingWorkProvider)) return null;
          return ref.watch(pendingWorkCountProvider).value?.unsentAnswers ?? 0;
        }),
        // Today's hero already shows the open draft and the sealed result: the capsule stands down
        // for them on Today.
        todayHeroCoversProvider.overrideWith((ref) {
          final view = ref.watch(todayViewProvider);
          if (view.hero == null) return const {};
          final unopened = ref.watch(unopenedResultsProvider).value ?? const [];
          return {
            if (view.hero is ResumeHero) BarLiveKind.resume,
            if (unopened.isNotEmpty) BarLiveKind.marked,
          };
        }),
        barReviewCountProvider.overrideWith((ref) => ref.watch(reviewIndexProvider)?.tonight?.items.length ?? 0),
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

/// "Accountancy mock", "Business Studies practice".
String _paper(String subject, {required bool mock}) => '${subjectDisplayName(subject)} ${mock ? 'mock' : 'practice'}';
