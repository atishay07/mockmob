import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/connectivity/connectivity_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/router/routes.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_effects.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import '../widgets/leave_sheet.dart';
import '../widgets/palette_sheet.dart';
import '../widgets/runner_layout.dart';

/// The exam focus runner on an open session (spec 5.5). Concentration is the feeling: the
/// layout is still, selection answers on the next frame, and the only sounds are the option
/// tick and the 5 and 1 minute warnings.
///
/// Owns the focus-mode lifecycle: immersive and wakelock, pause and resume, the network coming
/// back, the warnings, the leave guard on Android back, and opening the submit page whenever a
/// submit starts (the student's tap, time up, or a submit owed from before a restart).
class RunnerView extends ConsumerStatefulWidget {
  const RunnerView({super.key, required this.session});

  final RunnerSession session;

  /// How long a 5 or 1 minute warning holds the meta line.
  static const Duration warningHold = Duration(seconds: 3);

  @override
  ConsumerState<RunnerView> createState() => _RunnerViewState();
}

class _RunnerViewState extends ConsumerState<RunnerView> {
  RunnerSession get _s => widget.session;
  late final AppLifecycleListener _lifecycle;
  late final RunnerSystemUi _systemUi;
  StreamSubscription<SessionWarning>? _warnings;
  Timer? _warningTimer;
  String? _warning;
  bool _submitOpen = false;

  @override
  void initState() {
    super.initState();
    _systemUi = ref.read(runnerSystemUiProvider);
    unawaited(_systemUi.enter());
    _lifecycle = AppLifecycleListener(
      onPause: () => unawaited(_s.onPaused()),
      onResume: () {
        unawaited(_systemUi.enter());
        unawaited(_s.onResumed());
      },
    );
    _warnings = _s.warnings.listen(_onWarning);
    _s.submitState.addListener(_onSubmitStage);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Killed mid-submit: the submit is owed, so retry it and show its stage.
      if (_s.submitOwedOnOpen && _s.submitState.value.stage == SubmitStage.idle) unawaited(_s.submit());
      _onSubmitStage();
    });
  }

  @override
  void dispose() {
    _s.submitState.removeListener(_onSubmitStage);
    unawaited(_warnings?.cancel());
    _warningTimer?.cancel();
    _lifecycle.dispose();
    unawaited(_systemUi.exit());
    super.dispose();
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
    setState(() => _warning = text);
    _warningTimer = Timer(RunnerView.warningHold, () {
      if (mounted) setState(() => _warning = null);
    });
  }

  /// Any submit, however it started, is shown on the submit page.
  void _onSubmitStage() {
    if (!mounted || _submitOpen || _s.submitState.value.stage == SubmitStage.idle) return;
    // Opened straight on `/run/:id/submit` (a restart, a deep link): the page is already up.
    if (GoRouter.of(context).routerDelegate.currentConfiguration.uri.path.endsWith('/submit')) return;
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) {
      // A sheet (the palette, the leave guard) is open over the runner: close it first.
      Navigator.of(context).popUntil((r) => r == route);
    }
    _openSubmit();
  }

  void _openSubmit() {
    if (_submitOpen) return;
    _submitOpen = true;
    unawaited(context.push<void>(AppRoutes.runSubmit(_s.sessionId)).whenComplete(() => _submitOpen = false));
  }

  Future<void> _select(String qid, int? option) async {
    final ok = await _s.selectAnswer(qid, option);
    if (ok && option != null) unawaited(ref.read(hapticsProvider).tick());
  }

  void _previous() {
    _s.dismissAway();
    unawaited(_s.goTo(_s.currentIndex - 1));
  }

  void _next() {
    _s.dismissAway();
    if (_s.currentIndex >= _s.questions.length - 1) {
      _openSubmit();
    } else {
      unawaited(_s.goTo(_s.currentIndex + 1));
    }
  }

  Future<void> _confirmLeave() async {
    if (_s.submitState.value.stage != SubmitStage.idle) return;
    unawaited(ref.read(hapticsProvider).warn());
    final leave = await showMmSheet<bool>(
      context: context,
      title: RunnerCopy.leaveTitle(_s.isMock),
      builder: (_) => LeaveSheet(isMock: _s.isMock, until: _s.endsAt),
    );
    // Leaving lands on Practice; the session stays resumable there and on Today.
    if (leave == true && mounted) context.go(AppRoutes.practice);
  }

  Future<void> _openPalette() async {
    final jump = await showMmSheet<int>(
      context: context,
      title: RunnerCopy.paletteTitle,
      builder: (sheetContext) => ListenableBuilder(
        listenable: _s,
        builder: (context, _) => PaletteSheet(
          cells: sheetCellsOf(_s),
          onJump: (i) => Navigator.of(sheetContext).pop(i),
          onReview: () => Navigator.of(sheetContext).pop(-1),
        ),
      ),
    );
    if (!mounted || jump == null) return;
    _s.dismissAway();
    if (jump < 0) {
      _openSubmit();
    } else {
      unawaited(ref.read(hapticsProvider).tick());
      unawaited(_s.goTo(jump));
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(networkRestoredProvider, (_, next) {
      if (next.hasValue) _s.onConnectivityRestored();
    });
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_confirmLeave());
      },
      child: ListenableBuilder(
        listenable: _s,
        builder: (context, _) => RunnerLayout(
          session: _s,
          warning: _warning,
          onLeave: () => unawaited(_confirmLeave()),
          onQuestions: () => unawaited(_openPalette()),
          onSelect: (qid, option) => unawaited(_select(qid, option)),
          onPrevious: _previous,
          onNext: _next,
        ),
      ),
    );
  }
}
