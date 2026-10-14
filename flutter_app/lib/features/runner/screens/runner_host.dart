import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/connectivity/connectivity_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/router/routes.dart';
import '../../../core/sync/session/session_engine.dart';
import '../copy.dart';
import '../data/runner_effects.dart';
import '../data/runner_session.dart';

/// The focus-mode duties every runner skin shares (spec 5.5): immersive and wakelock, pause and
/// resume, the network coming back, the 5 and 1 minute warnings, and opening the submit page
/// whenever a submit starts (the student's tap, time up, a third warning, or a submit owed from
/// before a restart). The Night Sheet runner and the NTA mode skin both mix this in, so neither
/// reimplements the lifecycle.
mixin RunnerHost<W extends ConsumerStatefulWidget> on ConsumerState<W> {
  RunnerSession get session;

  late final AppLifecycleListener _lifecycle;
  late final RunnerSystemUi _systemUi;
  StreamSubscription<SessionWarning>? _warnings;
  Timer? _warningTimer;
  bool _submitOpen = false;

  /// "5 minutes left" while the warning holds the meta line.
  String? timeWarning;

  /// How long a 5 or 1 minute warning holds the meta line.
  static const Duration warningHold = Duration(seconds: 3);

  /// True while a skin keeps the submit page back on purpose (the NTA "Session ended" card is
  /// being read). The page then opens when the skin calls [openSubmit].
  bool get holdSubmitPage => false;

  /// A skin's own reaction to the app's lifecycle (the NTA integrity guard).
  void onLifecycleChange(AppLifecycleState state) {}

  void initHost() {
    _systemUi = ref.read(runnerSystemUiProvider);
    unawaited(_systemUi.enter());
    _lifecycle = AppLifecycleListener(
      onPause: () => unawaited(session.onPaused()),
      onResume: () {
        unawaited(_systemUi.enter());
        unawaited(session.onResumed());
      },
      onStateChange: onLifecycleChange,
    );
    _warnings = session.warnings.listen(_onWarning);
    session.submitState.addListener(onSubmitStage);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Killed mid-submit: the submit is owed, so retry it and show its stage.
      if (session.submitOwedOnOpen && session.submitState.value.stage == SubmitStage.idle) unawaited(session.submit());
      onSubmitStage();
    });
  }

  void disposeHost() {
    session.submitState.removeListener(onSubmitStage);
    unawaited(_warnings?.cancel());
    _warningTimer?.cancel();
    _lifecycle.dispose();
    unawaited(_systemUi.exit());
  }

  /// Call from build: a returning network sends what is waiting.
  void watchNetwork() {
    ref.listen(networkRestoredProvider, (_, next) {
      if (next.hasValue) session.onConnectivityRestored();
    });
  }

  void _onWarning(SessionWarning w) {
    if (!mounted) return;
    final text = switch (w) {
      SessionWarning.fiveMinutes => RunnerCopy.fiveMinutes,
      SessionWarning.oneMinute => RunnerCopy.oneMinute,
      SessionWarning.timeUp => null,
    };
    if (text == null) return;
    unawaited(ref.read(hapticsProvider).settle());
    unawaited(SemanticsService.sendAnnouncement(View.of(context), text, TextDirection.ltr));
    _warningTimer?.cancel();
    setState(() => timeWarning = text);
    _warningTimer = Timer(warningHold, () {
      if (mounted) setState(() => timeWarning = null);
    });
  }

  /// Any submit, however it started, is shown on the submit page.
  void onSubmitStage() {
    if (!mounted || _submitOpen || holdSubmitPage || session.submitState.value.stage == SubmitStage.idle) return;
    // Opened straight on `/run/:id/submit` (a restart, a deep link): the page is already up.
    if (GoRouter.of(context).routerDelegate.currentConfiguration.uri.path.endsWith('/submit')) return;
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) {
      // A sheet, drawer or page (the palette, the leave guard) is open over the runner.
      Navigator.of(context).popUntil((r) => r == route);
    }
    openSubmit();
  }

  void openSubmit() {
    if (_submitOpen) return;
    _submitOpen = true;
    unawaited(context.push<void>(AppRoutes.runSubmit(session.sessionId)).whenComplete(() => _submitOpen = false));
  }

  /// A tap on an option: the tick fires on the tap itself and the screen shows the answer on the
  /// next frame; the journal write happens after (a failed one is rolled back by the engine).
  /// The tick is the lock-in and nothing else: clearing an answer, or tapping the option that is
  /// already chosen, changes nothing and stays silent.
  Future<void> select(String qid, int? option) async {
    if (!session.canAnswer) return;
    if (option != null && session.answerFor(qid) != option) unawaited(ref.read(hapticsProvider).tick());
    session.dismissAway();
    await session.selectAnswer(qid, option);
  }

  void goTo(int index) {
    session.dismissAway();
    unawaited(session.goTo(index));
  }

  void previous() {
    if (session.currentIndex > 0) goTo(session.currentIndex - 1);
  }

  /// The next question, or the submit page after the last.
  void next() {
    if (session.currentIndex >= session.questions.length - 1) {
      session.dismissAway();
      openSubmit();
    } else {
      goTo(session.currentIndex + 1);
    }
  }
}
