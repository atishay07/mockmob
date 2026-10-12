import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/models/practice_quote.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'data/launch_flow.dart';
import 'data/practice_quote.dart';
import 'data/practice_starter.dart' show StartFailure;
import 'model/cost_line.dart';
import 'model/practice_selection.dart';
import 'widgets/failure_copy.dart';

/// `/practice/start`: starts Quick or chapter practice straight from a link or from Today, with
/// no setup screen, using the same quote check and launch as the setup screen. Mocks always go
/// through setup, because they need the pre-start sheet. Anything the student must look at (a
/// blocked quote, a failure) ends in a designed state with a way out, never a blank screen.
class PracticeStartScreen extends ConsumerStatefulWidget {
  const PracticeStartScreen({super.key, this.mode, this.subject, this.count, this.chapter, this.purpose});

  final PracticeMode? mode;
  final String? subject;
  final int? count;
  final String? chapter;
  final String? purpose;

  @override
  ConsumerState<PracticeStartScreen> createState() => _PracticeStartScreenState();
}

class _PracticeStartScreenState extends ConsumerState<PracticeStartScreen> {
  String? _message;
  StateViewKind _kind = StateViewKind.error;
  bool _working = true;
  String? _pendingSessionId;
  PracticeSelection? _selection;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_run()));
  }

  String get _setupLocation {
    final mode = widget.mode ?? PracticeMode.quick;
    return Uri(
      path: AppRoutes.practiceSetup(mode.name),
      queryParameters: {
        'subject': ?widget.subject,
        if (widget.count != null) 'count': '${widget.count}',
        'chapter': ?widget.chapter,
        'purpose': ?widget.purpose,
      },
    ).toString();
  }

  Future<void> _run() async {
    final mode = widget.mode;
    final subject = widget.subject;
    if (mode == null || subject == null || subject.isEmpty) {
      if (mounted) context.go(AppRoutes.practice);
      return;
    }
    final selection = PracticeSelection(
      mode: mode,
      subjectId: subject,
      count: nearestPracticeCount(widget.count),
      chapter: widget.chapter,
      purpose: widget.purpose == 'baseline' || widget.purpose == 'full_sample' ? widget.purpose : null,
    );
    // Mocks need the pre-start sheet, and chapter practice needs a chapter.
    if (mode.isMock || !selection.isComplete) {
      context.pushReplacement(_setupLocation);
      return;
    }
    _selection = selection;
    if (ref.read(networkStatusProvider) == NetworkStatus.offline) {
      _stop(PracticeCopy.offlineStart, StateViewKind.offline);
      return;
    }
    final PracticeQuote quote;
    try {
      quote = await ref.read(practiceQuoteProvider(selection.quoteQuery).future);
    } on ApiError catch (e) {
      if (mounted) {
        _stop(
          e.isOffline ? PracticeCopy.offlineStart : PracticeCopy.quoteFailed,
          e.isOffline ? StateViewKind.offline : StateViewKind.error,
        );
      }
      return;
    }
    if (!mounted) return;
    final result = await launchPractice(ref, selection, quote);
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        context.go(AppRoutes.run(sessionId));
      case LaunchNeedsLook(:final quote):
        _stop(costLineFor(quote).text ?? PracticeCopy.unavailableFallback, StateViewKind.error);
      case LaunchFailed(:final failure):
        final view = StartFailureView(failure);
        _stop(view.text, failure == StartFailure.offline ? StateViewKind.offline : StateViewKind.error);
      case LaunchPendingElsewhere(:final sessionId):
        _pendingSessionId = sessionId;
        _stop(PracticeCopy.earlierPending, StateViewKind.error);
    }
  }

  void _stop(String message, StateViewKind kind) => setState(() {
    _working = false;
    _message = message;
    _kind = kind;
  });

  void _retry() {
    setState(() {
      _working = true;
      _message = null;
    });
    unawaited(_run());
  }

  Widget _stopped() {
    final primary = _pendingSessionId != null
        ? StateAction(PracticeCopy.openEarlier, () => context.go(AppRoutes.run(_pendingSessionId!)))
        : (_selection == null ? null : StateAction(PracticeCopy.retry, _retry));
    final chooseAnother = StateAction(PracticeCopy.chooseAnother, () => context.pushReplacement(_setupLocation));
    return StateView(
      kind: _kind,
      title: _message ?? PracticeCopy.startFailed,
      primary: primary ?? chooseAnother,
      secondary: primary == null ? null : chooseAnother,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: _working
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(MmSpace.s24),
                  child: Semantics(
                    liveRegion: true,
                    container: true,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        MmSpinner(color: colors.ink, size: 28),
                        const SizedBox(height: MmSpace.s16),
                        Text(PracticeCopy.gettingReady, style: type.subhead, textAlign: TextAlign.center),
                        const SizedBox(height: MmSpace.s4),
                        Text(
                          PracticeCopy.gettingReadyNote,
                          style: type.small.copyWith(color: colors.ink2),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              )
            : _stopped(),
      ),
    );
  }
}
